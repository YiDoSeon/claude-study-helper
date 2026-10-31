// 「기록」 화면: 분야별 정답률, 최근에 푼 문제, 「묻기」 대화. 항목을 누르면 목록 대신 상세 화면을 보여 준다.
import { $, h, formatDate } from '../dom.js';
import { renderMarkdown } from '../markdown.js';
import { sourcesBlock, metaLine } from '../chat-ui.js';
import { attachChatNav, hideChatNavPanels } from '../chat-nav.js';
import { list } from '../store.js';
import { findItemForRecord, addFromRecord } from '../review.js';

const VERDICT_LABEL = { correct: '정답', partial: '부분', wrong: '오답' };
const RECENT_LIMIT = 50;
const CHAT_LIMIT = 30;

let onResumeChat = () => {};
let onContinueRecord = () => {};
// 상세 화면에 연 항목. { kind: 'record' | 'chat', id } 이고, 목록을 보고 있으면 null.
let opened = null;
let listScrollY = 0;

export function initRecordsView({ onResume, onContinue }) {
  onResumeChat = onResume;
  onContinueRecord = onContinue;
  $('#s-back').addEventListener('click', backToList);
  // 폰의 뒤로 가기로도 목록으로 돌아간다.
  window.addEventListener('popstate', () => {
    if (opened && !history.state?.recordsDetail) closeDetail();
  });
  attachChatNav($('#s-detail-body'), { questionSelector: '.qa-q' });
}

function statsByCategory(records) {
  const byCat = new Map();
  for (const r of records) {
    const cat = r.topic.path[0] ?? '기타';
    const s = byCat.get(cat) ?? { cat, total: 0, correct: 0, partial: 0 };
    s.total += 1;
    if (r.verdict === 'correct') s.correct += 1;
    if (r.verdict === 'partial') s.partial += 1;
    byCat.set(cat, s);
  }
  return [...byCat.values()].sort((a, b) => b.total - a.total);
}

function mdBlock(text) {
  const el = h('div', { class: 'md' });
  renderMarkdown(el, text);
  return el;
}

// 이 문제의 개념이 복습 목록에 없으면 넣는 버튼, 있으면 안내 글.
function reviewAction(r) {
  const item = findItemForRecord(r);
  if (item && !item.done) return h('span', { class: 'muted small' }, '복습 목록에 있어요');
  return h('button', { type: 'button', onclick: () => addFromRecord(r) }, item ? '복습에 다시 넣기' : '복습에 넣기');
}

function qaBlock(t) {
  return h('div', { class: 'qa' }, h('p', { class: 'qa-q' }, t.q), mdBlock(t.a), sourcesBlock(t.sources), metaLine(t.meta));
}

// ── 목록 ──────────────────────────────────────────────

function recordRow(r) {
  return h(
    'li',
    {},
    h(
      'button',
      { type: 'button', class: 'record-row', 'data-key': `record:${r.id}`, onclick: () => openDetail({ kind: 'record', id: r.id }) },
      h('span', { class: `pill ${r.verdict}` }, VERDICT_LABEL[r.verdict]),
      ' ',
      h('strong', {}, r.question.concept),
      h('span', { class: 'muted small' }, ` · ${r.topic.path.join(' › ')} · ${formatDate(r.at)}`),
    ),
  );
}

function chatRow(c) {
  return h(
    'li',
    {},
    h(
      'button',
      { type: 'button', class: 'record-row', 'data-key': `chat:${c.id}`, onclick: () => openDetail({ kind: 'chat', id: c.id }) },
      h('strong', {}, c.title),
      h('span', { class: 'muted small' }, ` · ${c.category || '자유 질문'} · 질문 ${c.history.length}개 · ${formatDate(c.updatedAt ?? c.at)}`),
    ),
  );
}

function renderLists() {
  const chats = list('chats').sort((a, b) => (b.updatedAt ?? b.at) - (a.updatedAt ?? a.at));
  $('#s-chats-card').hidden = chats.length === 0;
  $('#s-chats').replaceChildren(...chats.slice(0, CHAT_LIMIT).map(chatRow));

  const records = list('records').sort((a, b) => b.at - a.at);
  const stats = statsByCategory(records);
  $('#s-empty').hidden = records.length > 0;
  $('#s-table').hidden = records.length === 0;
  $('#s-table tbody').replaceChildren(
    ...stats.map((s) =>
      h(
        'tr',
        {},
        h('td', {}, s.cat),
        h('td', { class: 'num' }, s.total),
        h('td', { class: 'num' }, `${Math.round((s.correct / s.total) * 100)}%`),
        h('td', { class: 'num' }, s.partial),
      ),
    ),
  );
  $('#s-recent').replaceChildren(...records.slice(0, RECENT_LIMIT).map(recordRow));
}

// ── 상세 화면 ─────────────────────────────────────────

function recordDetail(r) {
  const q = r.question;
  return [
    h('h2', { class: 'detail-title' }, h('span', { class: `pill ${r.verdict}` }, VERDICT_LABEL[r.verdict]), ' ', q.concept),
    h('p', { class: 'muted small' }, `${r.topic.path.join(' › ')} · ${formatDate(r.at)}`),
    h('h4', {}, '문제'),
    mdBlock(q.prompt),
    q.code ? h('pre', {}, h('code', {}, q.code)) : '',
    q.choices.length ? h('ol', {}, q.choices.map((c) => h('li', {}, c))) : '',
    h('h4', {}, '내 답'),
    h('p', {}, r.userAnswer || '(모르겠어요)'),
    r.feedback ? mdBlock(r.feedback) : '',
    h('h4', {}, '모범 답안'),
    mdBlock(q.choices.length ? `${q.answer_index + 1}\\. ${q.choices[q.answer_index]}` : q.answer),
    h('h4', {}, '해설'),
    mdBlock(q.explanation),
    r.tutor?.length ? h('h4', {}, `더 물어본 내용 (${r.tutor.length}개)`) : '',
    ...(r.tutor ?? []).map(qaBlock),
    h(
      'div',
      { class: 'actions' },
      h('button', { type: 'button', onclick: leaveDetail(() => onContinueRecord(r)) }, '이 문제로 묻기'),
      reviewAction(r),
    ),
  ];
}

function chatDetail(c) {
  return [
    h('h2', { class: 'detail-title' }, c.title),
    h('p', { class: 'muted small' }, `${c.category || '자유 질문'} · 질문 ${c.history.length}개 · ${formatDate(c.updatedAt ?? c.at)}`),
    ...c.history.map(qaBlock),
    h('div', { class: 'actions' }, h('button', { type: 'button', onclick: leaveDetail(() => onResumeChat(c)) }, '이어서 묻기')),
  ];
}

// 열린 항목을 다시 그린다. 항목이 없어졌으면 목록으로 돌아간다.
function renderDetail() {
  const item = list(opened.kind === 'record' ? 'records' : 'chats').find((x) => x.id === opened.id);
  if (!item) {
    closeDetail();
    return;
  }
  $('#s-detail-body').replaceChildren(...(opened.kind === 'record' ? recordDetail(item) : chatDetail(item)));
}

function openDetail(target) {
  listScrollY = window.scrollY;
  opened = target;
  renderDetail();
  $('#s-lists').hidden = true;
  $('#s-detail').hidden = false;
  history.pushState({ recordsDetail: true, depth: 1 }, '');
  window.scrollTo(0, 0);
}

function closeDetail() {
  opened = null;
  $('#s-detail').hidden = true;
  $('#s-detail-body').replaceChildren();
  $('#s-lists').hidden = false;
  window.scrollTo(0, listScrollY);
}

// 상세 화면을 연 뒤 쌓인 방문 기록 (상세 화면 하나 + 질문 목록이 넣은 것) 을 한 번에 지운다.
// 지우고 나면 popstate 에서 닫힌다. 지울 기록이 없으면 false.
function popDetailHistory() {
  if (!history.state?.recordsDetail) return false;
  hideChatNavPanels();
  history.go(-(history.state.depth ?? 1));
  return true;
}

function backToList() {
  if (!popDetailHistory()) closeDetail();
}

// 상세 화면에서 다른 화면으로 넘어갈 때 쓴다. 목록 스크롤 위치로 돌아가지 않는다.
function leaveDetail(then) {
  return () => {
    opened = null;
    $('#s-detail').hidden = true;
    $('#s-lists').hidden = false;
    popDetailHistory();
    then();
  };
}

export function renderRecordsView() {
  renderLists();
  if (opened) renderDetail();
}
