// 질의응답마다 붙는 「fork」 버튼과 팝업. 「압축」, 「압축 안 함」, 「취소」 와 「이 질의응답만 가져가기」 를 고르면
// 새 대화를 만들어 저장하고 onCreated 로 넘긴다. 원래 대화는 바꾸지 않는다.
import { h } from './dom.js';
import { put, newId } from './store.js';
import { describeError } from './api.js';
import { resolveChoice } from './chat-choice.js';
import { pairIndex, forkPairs, buildForkChat } from './chat-fork.js';
import { summarizeChat } from './chat-summary.js';

let onCreated = () => {};
let closeOpen = null; // 열린 팝업을 닫는 함수

// onCreated(chat) 는 새 대화를 저장한 뒤 부른다 (main.js 가 묻기 화면에서 연다).
export function initFork(options) {
  onCreated = options.onCreated;
}

// getChat() 은 저장된 원래 대화를 준다 (지워졌으면 undefined).
export function forkButton(getChat, pair) {
  const button = h('button', { type: 'button', 'data-qa': 'fork' }, 'fork');
  button.addEventListener('click', () => openForkDialog(getChat(), pair, button));
  return button;
}

function openForkDialog(origin, pair, opener) {
  if (!origin) return;
  const index = pairIndex(origin.history, pair);
  if (index < 0) return;
  closeOpen?.();

  const single = h('input', { type: 'checkbox', 'data-fork': 'single' });
  const note = h('p', { class: 'muted small fork-note' });
  const status = h('p', { class: 'small fork-status', role: 'status', hidden: true });
  const summarize = h('button', { type: 'button', 'data-fork': 'summary' }, '압축');
  const copy = h('button', { type: 'button', 'data-fork': 'copy' }, '압축 안 함');
  const cancel = h('button', { type: 'button', 'data-fork': 'cancel' }, '취소');
  const dialog = h(
    'div',
    { class: 'fork-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'fork-title' },
    h('h3', { id: 'fork-title' }, '이 질문에서 새 대화 만들기'),
    h('p', { class: 'small' }, '원래 대화는 그대로 두고, 새 대화를 만들어 이어서 물어요.'),
    h('label', { class: 'check' }, single, '이 질의응답만 가져가기'),
    note,
    status,
    h('div', { class: 'actions' }, summarize, copy, cancel),
  );
  const overlay = h('div', { class: 'fork-overlay' }, dialog);
  let busy = false;
  let closed = false;

  function sync() {
    summarize.disabled = busy || single.checked;
    copy.disabled = busy;
    single.disabled = busy;
    note.replaceChildren(
      ...(single.checked
        ? ['이 질의응답 하나만 그대로 가져가요. 이 질의응답만 가져갈 때는 압축하지 않아요.']
        : ['압축: 처음부터 이 질문까지 요약해서 가져가요. 요약에 API 요청이 한 번 들어가요.', h('br'), '압축 안 함: 처음부터 이 질문까지 그대로 가져가요.']),
    );
  }

  function close() {
    if (closed) return;
    closed = true;
    closeOpen = null;
    overlay.remove();
    document.removeEventListener('keydown', onKey);
    if (opener.isConnected) opener.focus();
  }

  function onKey(event) {
    if (event.key === 'Escape') close();
  }

  function finish(chat) {
    put('chats', chat);
    close();
    onCreated(chat);
  }

  async function runSummary() {
    busy = true;
    sync();
    status.hidden = false;
    status.classList.remove('error');
    status.textContent = '요약하는 중… 지금 취소해도 보낸 요청의 비용은 들어요.';
    try {
      const { text } = await summarizeChat({
        context: origin.context,
        summary: origin.summary,
        pairs: forkPairs(origin.history, index, false),
        choice: resolveChoice(origin.choice, origin.history),
      });
      if (closed) return;
      finish(buildForkChat(origin, index, { id: newId(), summary: text }));
    } catch (err) {
      if (closed) return;
      busy = false;
      sync();
      status.textContent = describeError(err);
      status.classList.add('error');
    }
  }

  single.addEventListener('change', sync);
  summarize.addEventListener('click', runSummary);
  copy.addEventListener('click', () => finish(buildForkChat(origin, index, { id: newId(), single: single.checked })));
  cancel.addEventListener('click', close);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });
  document.addEventListener('keydown', onKey);
  closeOpen = close;
  sync();
  document.body.append(overlay);
  copy.focus();
}
