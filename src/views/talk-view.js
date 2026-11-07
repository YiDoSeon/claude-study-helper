// 「대화」 화면: 공부와 상관없는 범용 대화. 기록은 chats 컬렉션에 mode: 'general' 로 저장한다 (talk.js).
import { $, remember } from '../dom.js';
import { appendBubble, appendSources, appendMeta, streamInto, showBubbleError } from '../chat-ui.js';
import { attachChatNav } from '../chat-nav.js';
import { attachDockToggle, expandDock } from '../dock-toggle.js';
import { appendPairActions, attachExport } from '../qa-export.js';
import { tapConfirm } from '../tap-confirm.js';
import { describeError } from '../api.js';
import { createChoicePicker, defaultChoice, resolveChoice } from '../chat-choice.js';
import { onModelHintUpdate } from '../model-hint.js';
import { collectSources, mergeSources, hasSearchBlocks, hasLink } from '../web-search.js';
import { fetchReleaseNotes } from '../github-release.js';
import { put, get, newId } from '../store.js';
import { attachItemActions } from '../item-actions.js';
import { chatPreface } from '../chat-fork.js';
import { forkOriginLine, summaryBlock } from '../fork-ui.js';
import { withContext, textMessages, pairConv } from '../chat-thread.js';
import { askGeneral, TALK_MODE } from '../talk.js';
import { attachMemoryFinder } from '../memory-finder.js';

// { id, at, title, mode: 'general', history: [{ q, a, at, meta, sources? }], messages: API 에 보낼 대화,
//   choice: 마지막으로 고른 { model, effort }, fork 로 만들었으면 forkOf 와 summary }
let chat = null;
let picker = null;
let idleTouched = false; // 대화가 없을 때 사용자가 칸을 바꿨는지. 바꿨으면 설정이 바뀌어도 덮어쓰지 않는다.
let onOpenChatCallback = () => {};
let itemActions = null; // 입력 영역의 즐겨찾기·보관·삭제 버튼 (item-actions.js)

function renderChrome() {
  $('#g-empty').hidden = !!chat;
  $('#g-new').hidden = !chat;
  itemActions?.refresh();
}

function clearChat() {
  chat = null;
  idleTouched = false;
  picker.set(defaultChoice());
  $('#g-log').replaceChildren();
  $('#g-input').value = '';
  renderChrome();
}

function newChat() {
  clearChat();
  expandDock();
  $('#g-input').focus();
}

// 기록에서 지운 대화가 지금 열려 있으면 새 대화 상태로 비운다.
export function closeTalkIfOpen(id) {
  if (chat?.id === id) clearChat();
}

function saveChat() {
  const { messages, ...saved } = chat;
  put('chats', saved);
}

async function send(event) {
  event.preventDefault();
  const input = $('#g-input');
  const text = input.value.trim();
  if (!text) return;
  chat ??= { id: newId(), at: Date.now(), title: text.slice(0, 60), mode: TALK_MODE, category: '', history: [], messages: [] };
  // 질문에 링크가 있으면 체크하지 않았어도 그 페이지를 열 수 있게 웹 도구를 넣는다 (묻기와 같다).
  const webSearch = $('#g-web').checked || hasLink(text);
  const choice = picker.get();
  // 검색을 끈 채로 보내거나 모델이 바뀌면 이전 검색 블록이 거절되므로 저장된 글로 대화를 다시 만든다 (묻기와 같다).
  const prevModel = chat.history.at(-1)?.meta?.model ?? chat.choice?.model;
  const modelChanged = !!prevModel && prevModel !== choice.model;
  if ((!webSearch || modelChanged) && hasSearchBlocks(chat.messages)) chat.messages = textMessages(chat);
  input.value = '';
  renderChrome();
  appendBubble($('#g-log'), 'user', text);
  const body = appendBubble($('#g-log'), 'assistant', '…');
  const button = $('#g-form button');
  button.disabled = true;
  // GitHub 릴리스 링크는 앱이 직접 받아 질문 뒤에 붙인다 (github-release.js, 묻기와 같다).
  const release = await fetchReleaseNotes(text);
  const sent = text + release.note;
  chat.messages.push({ role: 'user', content: chat.messages.length ? sent : withContext(chatPreface(chat), sent) });

  try {
    const { message, text: answer } = await streamInto(body, (onText) =>
      askGeneral({ messages: chat.messages, webSearch, choice, onText }),
    );
    chat.messages.push({ role: 'assistant', content: message.content });
    const sources = mergeSources(release.sources, collectSources(message.content));
    appendSources(body, sources);
    appendMeta(body, message.meta);
    const pair = { q: text, a: answer, at: Date.now(), meta: message.meta, ...(sources.length && { sources }), ...(release.note && { linkNote: release.note }) };
    chat.history.push(pair);
    chat.choice = choice;
    saveChat();
    appendPairActions(body, pairConv(chat), pair);
  } catch (err) {
    chat.messages.pop();
    showBubbleError(body, describeError(err));
  } finally {
    button.disabled = false;
    renderChrome();
  }
}

// 저장된 범용 대화를 이어 간다. 저장된 글만으로 대화를 다시 만든다.
export function resumeTalk(saved) {
  chat = { ...saved, history: [...saved.history], messages: textMessages(saved) };
  picker.set(resolveChoice(saved.choice, saved.history));
  const log = $('#g-log');
  log.replaceChildren();
  const origin = forkOriginLine(saved, onOpenChatCallback);
  if (origin) log.append(origin);
  const summary = summaryBlock(saved);
  if (summary) log.append(summary);
  for (const t of saved.history) {
    appendBubble(log, 'user', t.q);
    const body = appendBubble(log, 'assistant', t.a);
    appendSources(body, t.sources);
    appendMeta(body, t.meta);
    appendPairActions(body, pairConv(saved), t);
  }
  renderChrome();
}

// fork 로 만든 새 대화를 열어 바로 물을 수 있게 한다.
export function openForkedTalk(saved) {
  resumeTalk(saved);
  expandDock();
  $('#g-input').focus();
}

// onOpenChat(id) 는 fork 한 대화의 「원래 대화 보기」 를 누르면 부른다.
export function initTalkView({ onOpenChat }) {
  onOpenChatCallback = onOpenChat;
  picker = createChoicePicker($('#g-choice'), (choice) => {
    if (!chat) {
      idleTouched = true;
      return;
    }
    chat.choice = choice;
    if (chat.history.length) saveChat();
  });
  picker.set(defaultChoice());
  onModelHintUpdate(() => {
    if (!chat && !idleTouched) picker.set(defaultChoice());
  });
  $('#g-web').checked = remember('talkWebSearch') === true;
  $('#g-web').addEventListener('change', () => remember('talkWebSearch', $('#g-web').checked));
  $('#g-form').addEventListener('submit', send);
  $('#g-input').addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) $('#g-form').requestSubmit();
  });
  tapConfirm($('#g-new'), { confirmLabel: '한 번 더 누르면 새 대화', onConfirm: newChat });
  attachDockToggle($('#view-talk .chat-dock'));
  const nav = attachChatNav($('#g-log'), { questionSelector: '.bubble.user', bottom: $('#g-form'), dock: $('#view-talk .chat-dock') });
  attachExport(nav, $('#g-log'), () => chat && { title: chat.title, pairs: chat.history });
  attachMemoryFinder(nav, $('#g-log'), () => chat);
  itemActions = attachItemActions($('#g-item-actions'), {
    getTarget: () => (chat && get('chats', chat.id) ? { kind: 'chat', id: chat.id } : null),
    onDeleted: ({ id }) => closeTalkIfOpen(id),
    onRestored: ({ id }) => {
      const saved = get('chats', id);
      if (!chat && saved) resumeTalk(saved);
    },
  });
  renderChrome();
}
