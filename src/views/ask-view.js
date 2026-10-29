// 「묻기」 화면: 문제 없이 질문으로 시작하는 튜터 대화.
import { $, fillSelect } from '../dom.js';
import { appendBubble, streamInto, showBubbleError } from '../chat-ui.js';
import { TOPICS } from '../topics.js';
import { askFree, chatToContext } from '../quiz.js';
import { describeError } from '../api.js';
import { put, newId } from '../store.js';

const FREE_CATEGORY = '자유 질문';

// { id, at, title, category, history: [{ q, a, at }], messages: API 에 보낼 대화 }
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
  chat.messages.push({ role: 'user', content: text });
  input.value = '';
  renderChrome();
  appendBubble($('#a-log'), 'user', text);
  const body = appendBubble($('#a-log'), 'assistant', '…');
  const button = $('#a-form button');
  button.disabled = true;

  try {
    const { message, text: answer } = await streamInto(body, (onText) => askFree({ messages: chat.messages, onText }));
    // thinking 블록까지 포함한 content 전체를 그대로 이어 붙인다.
    chat.messages.push({ role: 'assistant', content: message.content });
    chat.history.push({ q: text, a: answer, at: Date.now() });
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
    topic: { path: [chat.category || FREE_CATEGORY], detail: chat.title },
    context: chatToContext(chat.history),
  });
}

// 기록에 저장된 대화를 이어서 묻는다. 저장된 글만으로 대화를 다시 만든다.
export function resumeChat(saved) {
  chat = {
    ...saved,
    history: [...saved.history],
    messages: saved.history.flatMap((t) => [
      { role: 'user', content: t.q },
      { role: 'assistant', content: t.a },
    ]),
  };
  $('#a-category').value = saved.category ?? '';
  $('#a-log').replaceChildren();
  for (const t of saved.history) {
    appendBubble($('#a-log'), 'user', t.q);
    appendBubble($('#a-log'), 'assistant', t.a);
  }
  renderChrome();
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
  $('#a-form').addEventListener('submit', send);
  $('#a-input').addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) $('#a-form').requestSubmit();
  });
  $('#a-new').addEventListener('click', newChat);
  $('#a-quiz').addEventListener('click', quizFromChat);
  renderChrome();
}
