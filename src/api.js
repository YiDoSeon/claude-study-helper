// Claude API 호출과 비용 추정. 키는 이 브라우저에 저장된 것을 쓴다.
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { getSetting } from './settings.js';

// 가격은 1M 토큰당 USD. 비용 표시는 추정치다.
// webSearch 는 모델이 지원하는 웹 검색 도구 버전이다. Haiku 5.5 는 동적 필터링 버전을 지원하지 않는다.
export const MODELS = {
  'claude-opus-5-5': { label: 'Opus 5.5', input: 4, output: 20, cacheRead: 0.2, fallback: true, webSearch: 'web_search_20260209' },
  'claude-sonnet-5-5': { label: 'Sonnet 5.5', input: 2, output: 10, cacheRead: 0.2, fallback: true, webSearch: 'web_search_20260209' },
  'claude-haiku-5-5': { label: 'Haiku 5.5', input: 0.1, output: 0.5, cacheRead: 0.01, fallback: false, webSearch: 'web_search_20250305' },
};

const COST_KEY = 'study.cost.v1';
const WEB_SEARCH_PRICE = 0.01; // 검색 1회당 USD
const WEB_SEARCH_MAX_USES = 5; // 답 하나에 검색할 수 있는 최대 횟수
const MAX_CONTINUATIONS = 5; // pause_turn 으로 멈춘 응답을 이어 받는 최대 횟수

export class RefusalError extends Error {}
export class FormatError extends Error {}

let cachedClient = null;
let cachedKey = '';

function client() {
  const key = getSetting('anthropicKey');
  if (!key) throw new Error('설정에서 Claude API 키를 먼저 넣어 주세요.');
  if (key !== cachedKey) {
    cachedClient = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true, maxRetries: 2 });
    cachedKey = key;
  }
  return cachedClient;
}

function currentModel() {
  const id = getSetting('model');
  return MODELS[id] ? id : 'claude-opus-5-5';
}

// 안전 분류기가 거절하면 서버가 다른 모델로 다시 시도하게 한다. Haiku 5.5 는 지원하지 않는다.
function fallbackParams(model) {
  return MODELS[model].fallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } : {};
}

function trackCost(message) {
  const price = MODELS[message.model] ?? MODELS[currentModel()];
  const u = message.usage;
  const cost =
    ((u.input_tokens ?? 0) * price.input +
      (u.cache_creation_input_tokens ?? 0) * price.input * 1.25 +
      (u.cache_read_input_tokens ?? 0) * price.cacheRead +
      (u.output_tokens ?? 0) * price.output) /
      1_000_000 +
    (u.server_tool_use?.web_search_requests ?? 0) * WEB_SEARCH_PRICE;
  const total = getCostTotal() + cost;
  try {
    localStorage.setItem(COST_KEY, String(total));
  } catch {
    // 누적값 저장 실패는 무시한다.
  }
  return cost;
}

export function getCostTotal() {
  try {
    return Number(localStorage.getItem(COST_KEY)) || 0;
  } catch {
    return 0;
  }
}

export function resetCostTotal() {
  try {
    localStorage.removeItem(COST_KEY);
  } catch {
    // 무시
  }
}

// 사용자에게 보여 줄 오류 문장.
export function describeError(err) {
  if (err instanceof RefusalError) return '이 요청은 모델이 답하지 않았어요. 주제를 조금 바꿔 다시 시도해 주세요.';
  if (err instanceof FormatError) return '응답 형식이 맞지 않았어요. 다시 시도해 주세요.';
  if (err instanceof Anthropic.AuthenticationError) return 'API 키가 올바르지 않아요. 설정에서 확인해 주세요.';
  if (err instanceof Anthropic.PermissionDeniedError) return '이 키로는 이 모델을 쓸 수 없어요.';
  if (err instanceof Anthropic.RateLimitError) return '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.';
  if (err instanceof Anthropic.BadRequestError) return `요청 오류: ${err.message}`;
  if (err instanceof Anthropic.APIConnectionError) return '네트워크에 연결할 수 없어요.';
  if (err instanceof Anthropic.APIError) return `API 오류 ${err.status ?? ''}: ${err.message}`;
  return err?.message ?? String(err);
}

// 구조화된 JSON 응답 하나를 받는다. schema 는 zod 객체.
export async function callJson({ system, user, schema, effort = 'medium', maxTokens = 16000 }) {
  const model = currentModel();
  const api = client();
  let message;
  try {
    message = await api.beta.messages.parse({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
      output_config: { effort, format: betaZodOutputFormat(schema) },
      ...fallbackParams(model),
    });
  } catch (err) {
    // API 오류가 아니면 응답 JSON 이 스키마 검증을 통과하지 못한 것이다.
    if (err instanceof Anthropic.APIError) throw err;
    throw new FormatError(err?.message);
  }
  trackCost(message);
  if (message.stop_reason === 'refusal') throw new RefusalError();
  if (!message.parsed_output) throw new FormatError();
  return message.parsed_output;
}

// 대화형 응답을 스트리밍으로 받는다. messages 는 대화 전체이고,
// 돌려받은 content 를 그대로 다음 요청에 붙여야 thinking 블록이 유지된다.
// webSearch 가 true 면 서버 웹 검색 도구를 넣는다. 검색이 길어 pause_turn 으로 멈추면
// 받은 content 를 assistant 차례로 붙여 다시 보내고, 이어 받은 content 를 하나로 합쳐 돌려준다.
export async function streamChat({ system, messages, effort = 'medium', webSearch = false, onText }) {
  const model = currentModel();
  const tools = webSearch ? [{ type: MODELS[model].webSearch, name: 'web_search', max_uses: WEB_SEARCH_MAX_USES }] : undefined;
  const content = [];
  let wroteText = false;
  let toolSinceText = false;
  for (let turn = 0; ; turn++) {
    const stream = client().beta.messages.stream({
      model,
      max_tokens: 16000,
      system,
      messages: content.length ? [...messages, { role: 'assistant', content }] : messages,
      tools,
      cache_control: { type: 'ephemeral' },
      output_config: { effort },
      ...fallbackParams(model),
    });
    // 검색 앞뒤의 글이 붙어 보이지 않게 빈 줄을 넣는다. 인용 때문에 나뉜 글 블록 사이에는 넣지 않는다.
    stream.on('streamEvent', (event) => {
      if (event.type !== 'content_block_start') return;
      const type = event.content_block.type;
      if (type === 'server_tool_use' || type === 'web_search_tool_result') toolSinceText = true;
      if (type === 'text' && toolSinceText && wroteText) onText('\n\n');
      if (type === 'text') toolSinceText = false;
    });
    stream.on('text', (delta) => {
      wroteText = true;
      onText(delta);
    });
    const message = await stream.finalMessage();
    trackCost(message);
    if (message.stop_reason === 'refusal') throw new RefusalError();
    content.push(...message.content);
    if (message.stop_reason !== 'pause_turn' || turn >= MAX_CONTINUATIONS) return { ...message, content };
  }
}
