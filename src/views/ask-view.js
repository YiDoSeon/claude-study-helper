// 「묻기」 화면: 질문으로 시작하는 튜터 대화. 푼 문제에서 넘어온 대화도 여기서 이어 간다.
import { $, h, fillSelect, remember } from '../dom.js';
import { appendBubble, appendSources, appendMeta, streamInto, showBubbleError, chatContextBlock } from '../chat-ui.js';
import { attachChatNav } from '../chat-nav.js';
import { attachDockToggle, expandDock } from '../dock-toggle.js';
import { appendPairActions, attachExport } from '../qa-export.js';
import { tapConfirm } from '../tap-confirm.js';
import { TOPICS } from '../topics.js';
import { askFree, chatToContext, tutorContext } from '../quiz.js';
import { describeError } from '../api.js';
import { createChoicePicker, defaultChoice, resolveChoice } from '../chat-choice.js';
import { onModelHintUpdate } from '../model-hint.js';
import { collectSources, hasSearchBlocks } from '../web-search.js';
import { put, list, newId } from '../store.js';
import { chatPreface } from '../chat-fork.js';
import { forkOriginLine, summaryBlock } from '../fork-ui.js';
import { withContext, textMessages, pairConv } from '../chat-thread.js';
import { attachMemoryFinder } from '../memory-finder.js';

const FREE_CATEGORY = '자유 질문';

// { id, at, title, category, history: [{ q, a, at, meta, sources? }], messages: API 에 보낼 대화,
//   choice: 마지막으로 고른 { model, effort },
//   푼 문제에서 넘어왔으면 recordId, topic, context: 문제·내 답·채점 결과 글,
//   fork 로 만들었으면 forkOf, 압축했으면 summary: 이전 대화 요약 (chat-fork.js) }
let chat = null;
let onQuizCallback = () => {};
let onOpenChatCallback = () => {};
let picker = null; // 입력 영역의 모델·노력 칸
let idleTouched = false; // 대화가 없을 때 사용자가 칸을 바꿨는지. 바꿨으면 설정이 바뀌어도 덮어쓰지 않는다.

// 고른 분야의 세부 분야를 #a-sub 에 채운다 (풀기 화면 #q-sub 와 같은 목록). 분야가 비면 칸을 숨긴다.
// selected 가 목록에 없으면 (내 주제 등) 선택지에 남겨 값을 유지한다.
function fillSub(selected = '') {
  const category = $('#a-category').value;
  const children = TOPICS.find((t) => t.label === category)?.children ?? [];
  const options = [{ value: '', label: '전체' }, ...children.map((c) => ({ value: c, label: c }))];
  if (selected && !children.includes(selected)) options.push({ value: selected, label: selected });
  fillSelect($('#a-sub'), options, selected);
  $('#a-sub-field').hidden = !category;
}

// 고른 분야와 주제로 대화의 category 와 topic 을 정한다. 자유 질문이면 topic 을 두지 않는다.
function applyChoice(target) {
  const category = $('#a-category').value;
  target.category = category;
  if (category) target.topic = { path: [category, $('#a-sub').value].filter(Boolean), detail: target.topic?.detail ?? target.title };
  else delete target.topic;
}

function renderChrome() {
  const hasAnswer = chat?.history.length > 0 || !!chat?.summary;
  $('#a-empty').hidden = !!chat;
  $('#a-quiz').hidden = !hasAnswer;
  $('#a-new').hidden = !chat;
}

function newChat() {
  chat = null;
  idleTouched = false;
  picker.set(defaultChoice());
  $('#a-log').replaceChildren();
  $('#a-input').value = '';
  renderChrome();
  expandDock();
  $('#a-input').focus();
}

// 기록에서 지운 대화가 지금 열려 있으면 새 대화 상태로 비운다. 비우지 않으면 이어 쓸 때 put 이 대화를 다시 살린다.
export function closeChatIfOpen(id) {
  if (chat?.id !== id) return;
  chat = null;
  idleTouched = false;
  picker.set(defaultChoice());
  $('#a-log').replaceChildren();
  $('#a-input').value = '';
  renderChrome();
}

async function send(event) {
  event.preventDefault();
  const input = $('#a-input');
  const text = input.value.trim();
  if (!text) return;
  const fresh = !chat;
  chat ??= {
    id: newId(),
    at: Date.now(),
    title: text.slice(0, 60),
    history: [],
    messages: [],
  };
  if (fresh) applyChoice(chat);
  const webSearch = $('#a-web').checked;
  const choice = picker.get();
  // 직전 답을 한 모델과 달라졌는지. 웹 검색 도구 버전이 모델마다 달라 이전 검색 블록이 거절될 수 있다.
  const prevModel = chat.history.at(-1)?.meta?.model ?? chat.choice?.model;
  const modelChanged = !!prevModel && prevModel !== choice.model;
  // 검색을 끈 채로 보내거나 모델이 바뀌면 도구 정의가 달라 이전 검색 블록이 거절되므로, 저장된 글로 대화를 다시 만든다.
  if ((!webSearch || modelChanged) && hasSearchBlocks(chat.messages)) chat.messages = textMessages(chat);
  chat.messages.push({ role: 'user', content: chat.messages.length ? text : withContext(chatPreface(chat), text) });
  input.value = '';
  renderChrome();
  appendBubble($('#a-log'), 'user', text);
  const body = appendBubble($('#a-log'), 'assistant', '…');
  const button = $('#a-form button');
  button.disabled = true;

  try {
    const { message, text: answer } = await streamInto(body, (onText) =>
      askFree({ messages: chat.messages, webSearch, choice, onText }),
    );
    // thinking 블록과 검색 블록까지 포함한 content 전체를 그대로 이어 붙인다.
    chat.messages.push({ role: 'assistant', content: message.content });
    const sources = collectSources(message.content);
    appendSources(body, sources);
    appendMeta(body, message.meta);
    const pair = { q: text, a: answer, at: Date.now(), meta: message.meta, ...(sources.length && { sources }) };
    chat.history.push(pair);
    chat.choice = choice;
    const { messages, ...saved } = chat;
    put('chats', saved);
    appendPairActions(body, pairConv(chat), pair);
  } catch (err) {
    chat.messages.pop();
    showBubbleError(body, describeError(err));
  } finally {
    button.disabled = false;
    renderChrome();
  }
}

function quizFromChat() {
  if (!chat?.history.length && !chat?.summary) return;
  const summary = chat.summary ? `이전 대화 요약:\n${chat.summary}` : '';
  onQuizCallback({
    topic: chat.topic ?? { path: [chat.category || FREE_CATEGORY], detail: chat.title },
    context: [summary, chatToContext(chat.history)].filter(Boolean).join('\n\n'),
  });
}

// 기록에 저장된 대화를 이어서 묻는다. 저장된 글만으로 대화를 다시 만든다.
export function resumeChat(saved) {
  chat = {
    ...saved,
    history: [...saved.history],
    messages: textMessages(saved),
  };
  picker.set(resolveChoice(saved.choice, saved.history));
  $('#a-category').value = saved.category ?? '';
  fillSub(saved.topic?.path?.[0] === saved.category ? (saved.topic.path[1] ?? '') : '');
  $('#a-log').replaceChildren();
  const origin = forkOriginLine(saved, onOpenChatCallback);
  if (origin) $('#a-log').append(origin);
  if (saved.context) $('#a-log').append(chatContextBlock(saved));
  const summary = summaryBlock(saved);
  if (summary) $('#a-log').append(summary);
  for (const t of saved.history) {
    appendBubble($('#a-log'), 'user', t.q);
    const body = appendBubble($('#a-log'), 'assistant', t.a);
    appendSources(body, t.sources);
    appendMeta(body, t.meta);
    appendPairActions(body, pairConv(saved), t);
  }
  renderChrome();
}

// fork 로 만든 새 대화를 열어 바로 물을 수 있게 한다.
export function openForkedChat(saved) {
  resumeChat(saved);
  expandDock();
  $('#a-input').focus();
}

// 푼 문제의 「더 물어보기」 대화를 「묻기」 대화로 옮겨 이어 간다. 이미 옮긴 문제면 그 대화를 연다.
export function continueFromRecord(record) {
  const tutor = (record.tutor ?? []).map(({ q, a, at, meta }) => ({ q, a, at, meta }));
  const existing = list('chats').find((c) => c.recordId === record.id);
  if (existing) {
    // 옮긴 뒤 「더 물어보기」 에서 더 물은 것이 있으면 시간 순으로 끼워 넣는다.
    const known = new Set(existing.history.map((t) => t.at));
    const added = tutor.filter((t) => !known.has(t.at));
    const history = [...existing.history, ...added].sort((a, b) => a.at - b.at);
    resumeChat(added.length ? put('chats', { ...existing, history }) : existing);
    expandDock();
    $('#a-input').focus();
    return;
  }
  const saved = {
    id: newId(),
    at: Date.now(),
    title: `문제: ${record.question.concept}`,
    category: TOPICS.some((t) => t.label === record.topic.path[0]) ? record.topic.path[0] : '',
    topic: record.topic,
    recordId: record.id,
    context: tutorContext(record),
    history: tutor,
    choice: resolveChoice(record.tutorChoice, tutor),
  };
  // 주고받은 질문이 없으면 첫 답을 받을 때 저장한다.
  if (saved.history.length) put('chats', saved);
  resumeChat(saved);
  expandDock();
  $('#a-input').focus();
}

// onOpenChat(id) 는 fork 한 대화의 「원래 대화 보기」 를 누르면 부른다.
export function initAskView({ onQuiz, onOpenChat }) {
  onQuizCallback = onQuiz;
  onOpenChatCallback = onOpenChat;
  fillSelect(
    $('#a-category'),
    [{ value: '', label: '(정하지 않음)' }, ...TOPICS.map((t) => ({ value: t.label, label: t.label }))],
    '',
  );
  fillSub();
  picker = createChoicePicker($('#a-choice'), (choice) => {
    if (!chat) {
      idleTouched = true;
      return;
    }
    chat.choice = choice;
    if (chat.history.length) {
      const { messages, ...saved } = chat;
      put('chats', saved);
    }
  });
  picker.set(defaultChoice());
  // 설정에서 모델이나 노력을 바꾸면 아직 시작하지 않은 대화의 칸도 새 기본값을 따른다.
  onModelHintUpdate(() => {
    if (!chat && !idleTouched) picker.set(defaultChoice());
  });
  const choiceChanged = () => {
    if (!chat) return;
    applyChoice(chat);
    if (chat.history.length) {
      const { messages, ...saved } = chat;
      put('chats', saved);
    }
  };
  $('#a-category').addEventListener('change', () => {
    fillSub();
    choiceChanged();
  });
  $('#a-sub').addEventListener('change', choiceChanged);
  $('#a-web').checked = remember('askWebSearch') === true;
  $('#a-web').addEventListener('change', () => remember('askWebSearch', $('#a-web').checked));
  $('#a-form').addEventListener('submit', send);
  $('#a-input').addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) $('#a-form').requestSubmit();
  });
  tapConfirm($('#a-new'), { confirmLabel: '한 번 더 누르면 새 대화', onConfirm: newChat });
  attachDockToggle($('#view-ask .chat-dock'));
  const nav = attachChatNav($('#a-log'), { questionSelector: '.bubble.user', bottom: $('#a-form'), dock: $('#view-ask .chat-dock') });
  attachExport(nav, $('#a-log'), () => chat && { title: chat.title, context: chat.context, pairs: chat.history });
  attachMemoryFinder(nav, $('#a-log'), () => chat);
  tapConfirm($('#a-quiz'), { confirmLabel: '한 번 더 누르면 문제 풀기', onConfirm: quizFromChat });
  renderChrome();
}
