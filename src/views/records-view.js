// 「기록」 화면: 분야별 정답률, 최근에 푼 문제, 「묻기」 대화. 항목을 누르면 목록 대신 상세 화면을 보여 준다.
import { $, h, formatDate } from '../dom.js';
import { renderMarkdown } from '../markdown.js';
import { sourcesBlock, metaLine } from '../chat-ui.js';
import { attachChatNav } from '../chat-nav.js';
import { list } from '../store.js';
import { findItemForRecord, addFromRecord } from '../review.js';

const VERDICT_LABEL = { correct: '정답', partial: '부분', wrong: '오답' };
const RECENT_LIMIT = 50;
const CHAT_LIMIT = 30;

let onResumeChat = () => {};
let onContinueRecord = () => {};
let onOpenDetail = () => {};
// 상세 화면에 연 항목. { kind: 'record' | 'chat', id } 이고, 목록을 보고 있으면 null.
let opened = null;

// 상세 화면을 여닫는 것은 방문 기록에 남도록 main.js 가 router 로 처리한다.
// onOpen(target) 은 항목을 눌렀을 때, onBack() 은 「← 목록으로」 를 눌렀을 때 부른다.
export function initRecordsView({ onResume, onContinue, onOpen, onBack }) {
  onResumeChat = onResume;
  onContinueRecord = onContinue;
  onOpenDetail = onOpen;
  $('#s-back').addEventListener('click', onBack);
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
      { type: 'button', class: 'record-row', 'data-key': `record:${r.id}`, onclick: () => onOpenDetail({ kind: 'record', id: r.id }) },
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
      { type: 'button', class: 'record-row', 'data-key': `chat:${c.id}`, onclick: () => onOpenDetail({ kind: 'chat', id: c.id }) },
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
      h('button', { type: 'button', onclick: () => onContinueRecord(r) }, '이 문제로 묻기'),
      reviewAction(r),
    ),
  ];
}

function chatDetail(c) {
  return [
    h('h2', { class: 'detail-title' }, c.title),
    h('p', { class: 'muted small' }, `${c.category || '자유 질문'} · 질문 ${c.history.length}개 · ${formatDate(c.updatedAt ?? c.at)}`),
    ...c.history.map(qaBlock),
    h('div', { class: 'actions' }, h('button', { type: 'button', onclick: () => onResumeChat(c) }, '이어서 묻기')),
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

function closeDetail() {
  opened = null;
  $('#s-detail').hidden = true;
  $('#s-detail-body').replaceChildren();
  $('#s-lists').hidden = false;
}

// 방문 기록의 상태대로 상세 화면을 열거나 닫는다. target 이 null 이면 목록을 보여 준다.
// 스크롤 위치는 router.js 가 맞춘다.
export function showRecordsDetail(target) {
  if (!target) {
    closeDetail();
    return;
  }
  opened = target;
  renderDetail();
  if (!opened) return; // 지워진 항목이면 renderDetail 이 목록으로 돌려놓았다.
  $('#s-lists').hidden = true;
  $('#s-detail').hidden = false;
}

export function renderRecordsView() {
  renderLists();
  if (opened) renderDetail();
}
