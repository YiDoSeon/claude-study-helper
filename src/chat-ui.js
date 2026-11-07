// 튜터 대화 말풍선. 「풀기」 의 더 물어보기와 「묻기」 화면이 같이 쓴다.
import { h } from './dom.js';
import { renderMarkdown } from './markdown.js';
import { MODELS } from './api.js';

// 푼 문제에서 넘어온 대화 (context 가 있는 대화) 의 문제 맥락을 접어서 보여 준다. 묻기 화면과 기록 상세가 같이 쓴다.
export function chatContextBlock(saved) {
  const body = h('div', { class: 'md' });
  renderMarkdown(body, saved.context);
  return h('details', { class: 'chat-context' }, h('summary', {}, `푼 문제: ${saved.title.replace(/^문제: /, '')}`), body);
}

export function appendBubble(log, role, text) {
  const body = h('div', { class: 'md' });
  if (role === 'user') body.textContent = text;
  else renderMarkdown(body, text, { visuals: true });
  log.append(h('div', { class: `bubble ${role}` }, body));
  return body;
}

// run(onText) 은 스트리밍 요청을 보내고 최종 message 를 돌려준다.
// 받은 글을 화면 갱신 주기에 맞춰 body 에 그리고, { message, text } 를 돌려준다.
export async function streamInto(body, run) {
  let text = '';
  let frame = 0;
  try {
    const message = await run((delta) => {
      text += delta;
      if (!frame) {
        frame = requestAnimationFrame(() => {
          frame = 0;
          renderMarkdown(body, text);
        });
      }
    });
    cancelAnimationFrame(frame);
    renderMarkdown(body, text, { visuals: true });
    return { message, text };
  } catch (err) {
    cancelAnimationFrame(frame);
    throw err;
  }
}

// 웹 검색 출처 링크 목록. sources 는 [{ url, title }] 이고, 없으면 null.
export function sourcesBlock(sources) {
  if (!sources?.length) return null;
  const links = sources.map(({ url, title }) =>
    h('li', {}, h('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, title)),
  );
  return h('div', { class: 'sources' }, h('p', { class: 'muted small' }, '출처'), h('ol', {}, links));
}

// 출처 목록을 말풍선 아래에 붙인다.
export function appendSources(body, sources) {
  const block = sourcesBlock(sources);
  if (block) body.parentElement.append(block);
}

// 답 하나의 모델, effort, 토큰, 추정 금액 한 줄. meta 는 streamChat 이 돌려준 것이고, 없으면 null.
// 입력은 캐시에서 읽은 토큰까지 더한 값이다. 출력에는 thinking 토큰이 들어 있다.
// meta.stop 이 있으면 답이 끝나지 않고 멈춘 것이라 줄 앞에 이유를 붙인다.
const STOP_NOTE = {
  max_tokens: '답이 출력 한도에서 끊겼어요. 「이어서 써 줘」 라고 보내면 이어 받을 수 있어요.',
  pause_turn: '검색이 길어 답이 중간에 멈췄어요. 「이어서 써 줘」 라고 보내면 이어 받을 수 있어요.',
};

export function metaLine(meta) {
  if (!meta) return null;
  const n = (v) => v.toLocaleString('en-US');
  const input = meta.input + meta.cacheRead + meta.cacheWrite;
  const parts = [
    MODELS[meta.model]?.label ?? meta.model,
    `effort ${meta.effort}`,
    `입력 ${n(input)}${meta.cacheRead ? ` (캐시 ${n(meta.cacheRead)})` : ''}`,
    `출력 ${n(meta.output)}`,
    meta.searches ? `검색 ${meta.searches}회` : '',
    meta.fetches ? `링크 열기 ${meta.fetches}회` : '',
    `약 $${meta.cost.toFixed(3)}`,
  ];
  const line = h('p', { class: 'answer-meta' }, parts.filter(Boolean).join(' · '));
  const note = STOP_NOTE[meta.stop];
  return note ? h('div', {}, h('p', { class: 'answer-stop' }, note), line) : line;
}

export function appendMeta(body, meta) {
  const line = metaLine(meta);
  if (line) body.parentElement.append(line);
}

export function showBubbleError(body, message) {
  body.textContent = message;
  body.parentElement.classList.add('error');
}
