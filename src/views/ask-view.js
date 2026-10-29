// 「묻기」 화면: 질문으로 시작하는 튜터 대화. 푼 문제에서 넘어온 대화도 여기서 이어 간다.
import { $, h, fillSelect, remember } from '../dom.js';
import { appendBubble, appendSources, streamInto, showBubbleError } from '../chat-ui.js';
import { renderMarkdown } from '../markdown.js';
import { TOPICS } from '../topics.js';
import { askFree, chatToContext, tutorContext } from '../quiz.js';
import { describeError } from '../api.js';
import { collectSources, hasSearchBlocks } from '../web-search.js';
import { put, list, newId } from '../store.js';

const FREE_CATEGORY = '자유 질문';

// 첫 질문 앞에 붙일 문제 맥락. 「더 물어보기」 와 같은 모양으로 보낸다.
function withContext(context, question) {
  return context ? `${context}\n\n## 질문\n${question}` : question;
}

// 저장된 글만으로 API 에 보낼 대화를 만든다. thinking 블록과 검색 블록은 들어가지 않는다.
function textMessages(history, context) {
  return history.flatMap((t, i) => [
    { role: 'user', content: i === 0 ? withContext(context, t.q) : t.q },
    { role: 'assistant', content: t.a },
  ]);
}

// { id, at, title, category, history: [{ q, a, at, sources? }], messages: API 에 보낼 대화,
//   푼 문제에서 넘어왔으면 recordId, topic, context: 문제·내 답·채점 결과 글 }
let chat = null;
let onQuizCallback = () => {};

function renderChrome() {
  const hasAnswer = chat?.history.length > 0;
  $('#a-empty').hidden = !!chat;
  $('#a-quiz').hidden = !hasAnswer;
  $('#a-new').hidden = !chat;
}

function newChat() {
  chat = null;
  $('#a-log').replaceChildren();
  $('#a-input').value = '';
  renderChrome();
  $('#a-input').focus();
}

async function send(event) {
  event.preventDefault();
  const input = $('#a-input');
  const text = input.value.trim();
  if (!text) return;
  chat ??= {
    id: newId(),
    at: Date.now(),
    title: text.slice(0, 60),
    category: $('#a-category').value,
    history: [],
    messages: [],
  };
  const webSearch = $('#a-web').checked;
  // 검색을 끈 채로 보내면 도구 정의가 없어 이전 검색 블록이 거절되므로, 저장된 글로 대화를 다시 만든다.
  if (!webSearch && hasSearchBlocks(chat.messages)) chat.messages = textMessages(chat.history, chat.context);
  chat.messages.push({ role: 'user', content: chat.messages.length ? text : withContext(chat.context, text) });
  input.value = '';
  renderChrome();
  appendBubble($('#a-log'), 'user', text);
  const body = appendBubble($('#a-log'), 'assistant', '…');
  const button = $('#a-form button');
  button.disabled = true;

  try {
    const { message, text: answer } = await streamInto(body, (onText) =>
      askFree({ messages: chat.messages, webSearch, onText }),
    );
    // thinking 블록과 검색 블록까지 포함한 content 전체를 그대로 이어 붙인다.
    chat.messages.push({ role: 'assistant', content: message.content });
    const sources = collectSources(message.content);
    appendSources(body, sources);
    chat.history.push({ q: text, a: answer, at: Date.now(), ...(sources.length && { sources }) });
    const { messages, ...saved } = chat;
    put('chats', saved);
  } catch (err) {
    chat.messages.pop();
    showBubbleError(body, describeError(err));
  } finally {
    button.disabled = false;
    renderChrome();
  }
}

function quizFromChat() {
  if (!chat?.history.length) return;
  onQuizCallback({
    topic: chat.topic ?? { path: [chat.category || FREE_CATEGORY], detail: chat.title },
    context: chatToContext(chat.history),
  });
}

// 푼 문제에서 넘어온 대화는 맨 위에 문제 맥락을 접어서 보여 준다.
function contextBlock(saved) {
  const body = h('div', { class: 'md' });
  renderMarkdown(body, saved.context);
  return h('details', { class: 'chat-context' }, h('summary', {}, `푼 문제: ${saved.title.replace(/^문제: /, '')}`), body);
}

// 기록에 저장된 대화를 이어서 묻는다. 저장된 글만으로 대화를 다시 만든다.
export function resumeChat(saved) {
  chat = {
    ...saved,
    history: [...saved.history],
    messages: textMessages(saved.history, saved.context),
  };
  $('#a-category').value = saved.category ?? '';
  $('#a-log').replaceChildren();
  if (saved.context) $('#a-log').append(contextBlock(saved));
  for (const t of saved.history) {
    appendBubble($('#a-log'), 'user', t.q);
    appendSources(appendBubble($('#a-log'), 'assistant', t.a), t.sources);
  }
  renderChrome();
}

// 푼 문제의 「더 물어보기」 대화를 「묻기」 대화로 옮겨 이어 간다. 이미 옮긴 문제면 그 대화를 연다.
export function continueFromRecord(record) {
  const tutor = (record.tutor ?? []).map(({ q, a, at }) => ({ q, a, at }));
  const existing = list('chats').find((c) => c.recordId === record.id);
  if (existing) {
    // 옮긴 뒤 「더 물어보기」 에서 더 물은 것이 있으면 시간 순으로 끼워 넣는다.
    const known = new Set(existing.history.map((t) => t.at));
    const added = tutor.filter((t) => !known.has(t.at));
    const history = [...existing.history, ...added].sort((a, b) => a.at - b.at);
    resumeChat(added.length ? put('chats', { ...existing, history }) : existing);
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
  };
  // 주고받은 질문이 없으면 첫 답을 받을 때 저장한다.
  if (saved.history.length) put('chats', saved);
  resumeChat(saved);
  $('#a-input').focus();
}

export function initAskView({ onQuiz }) {
  onQuizCallback = onQuiz;
  fillSelect(
    $('#a-category'),
    [{ value: '', label: '(정하지 않음)' }, ...TOPICS.map((t) => ({ value: t.label, label: t.label }))],
    '',
  );
  $('#a-category').addEventListener('change', () => {
    if (!chat) return;
    chat.category = $('#a-category').value;
    if (chat.history.length) {
      const { messages, ...saved } = chat;
      put('chats', saved);
    }
  });
  $('#a-web').checked = remember('askWebSearch') === true;
  $('#a-web').addEventListener('change', () => remember('askWebSearch', $('#a-web').checked));
  $('#a-form').addEventListener('submit', send);
  $('#a-input').addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) $('#a-form').requestSubmit();
  });
  $('#a-new').addEventListener('click', newChat);
  $('#a-quiz').addEventListener('click', quizFromChat);
  renderChrome();
}
