// 「기록」 화면: 분야별 정답률, 최근에 푼 문제, 「묻기」 대화.
import { $, h, formatDate } from '../dom.js';
import { renderMarkdown } from '../markdown.js';
import { sourcesBlock } from '../chat-ui.js';
import { list } from '../store.js';
import { findItemForRecord, addFromRecord } from '../review.js';

const VERDICT_LABEL = { correct: '정답', partial: '부분', wrong: '오답' };
const RECENT_LIMIT = 50;
const CHAT_LIMIT = 30;

let onResumeChat = () => {};

export function initRecordsView({ onResume }) {
  onResumeChat = onResume;
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

function recordItem(r) {
  const q = r.question;
  const details = h(
    'details',
    { 'data-key': `record:${r.id}` },
    h(
      'summary',
      {},
      h('span', { class: `pill ${r.verdict}` }, VERDICT_LABEL[r.verdict]),
      ' ',
      h('strong', {}, q.concept),
      h('span', { class: 'muted small' }, ` · ${r.topic.path.join(' › ')} · ${formatDate(r.at)}`),
    ),
  );
  // 펼칠 때만 본문을 그린다.
  details.addEventListener(
    'toggle',
    () => {
      details.append(
        mdBlock(q.prompt),
        q.code ? h('pre', {}, h('code', {}, q.code)) : '',
        q.choices.length ? h('ol', {}, q.choices.map((c) => h('li', {}, c))) : '',
        h('h4', {}, '내 답'),
        h('p', {}, r.userAnswer || '(모르겠어요)'),
        r.feedback ? mdBlock(r.feedback) : '',
        h('h4', {}, '모범 답안'),
        mdBlock(q.choices.length ? `${q.answer_index + 1}. ${q.choices[q.answer_index]}` : q.answer),
        h('h4', {}, '해설'),
        mdBlock(q.explanation),
        r.tutor?.length ? h('h4', {}, '더 물어본 내용') : '',
        ...(r.tutor ?? []).map(qaBlock),
        h('div', { class: 'actions' }, reviewAction(r)),
      );
    },
    { once: true },
  );
  return h('li', {}, details);
}

function qaBlock(t) {
  return h('div', { class: 'qa' }, h('p', { class: 'qa-q' }, t.q), mdBlock(t.a), sourcesBlock(t.sources));
}

function chatItem(c) {
  const details = h(
    'details',
    { 'data-key': `chat:${c.id}` },
    h(
      'summary',
      {},
      h('strong', {}, c.title),
      h('span', { class: 'muted small' }, ` · ${c.category || '자유 질문'} · 질문 ${c.history.length}개 · ${formatDate(c.updatedAt ?? c.at)}`),
    ),
  );
  details.addEventListener(
    'toggle',
    () => {
      details.append(
        ...c.history.map(qaBlock),
        h('div', { class: 'actions' }, h('button', { type: 'button', onclick: () => onResumeChat(c) }, '이어서 묻기')),
      );
    },
    { once: true },
  );
  return h('li', {}, details);
}

export function renderRecordsView() {
  // 기록이 바뀌어 다시 그릴 때 펼쳐 둔 항목을 다시 펼친다.
  const openKeys = new Set([...document.querySelectorAll('#view-records details[open]')].map((d) => d.dataset.key));
  renderLists();
  for (const details of document.querySelectorAll('#view-records details[data-key]')) {
    if (openKeys.has(details.dataset.key)) {
      details.open = true;
      details.dispatchEvent(new Event('toggle'));
    }
  }
}

function renderLists() {
  const chats = list('chats').sort((a, b) => (b.updatedAt ?? b.at) - (a.updatedAt ?? a.at));
  $('#s-chats-card').hidden = chats.length === 0;
  $('#s-chats').replaceChildren(...chats.slice(0, CHAT_LIMIT).map(chatItem));

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
  $('#s-recent').replaceChildren(...records.slice(0, RECENT_LIMIT).map(recordItem));
}
