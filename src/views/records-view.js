// 「기록」 화면: 분야별 정답률, 최근에 푼 문제, 「묻기」 대화. 항목을 누르면 목록 대신 상세 화면을 보여 준다.
import { $, h, formatDate } from '../dom.js';
import { renderMarkdown } from '../markdown.js';
import { sourcesBlock, metaLine } from '../chat-ui.js';
import { attachChatNav } from '../chat-nav.js';
import { decoratePre } from '../code-block.js';
import { list } from '../store.js';
import { findItemForRecord, addFromRecord } from '../review.js';
import { isStarred } from '../favorites.js';
import { getNote } from '../notes.js';
import { initDetailTools } from '../detail-tools.js';
import { splitTerms, recordFields, chatFields, searchFields, markParts } from '../list-search.js';
import { createFilterBar, periodRange, inPeriod, sortItems, isFiltered, inCategory, categoryOptions, pathText, PATH_SEP } from '../list-filter.js';

const VERDICT_LABEL = { correct: '정답', partial: '부분', wrong: '오답' };
const PAGE = 30;
// 목록마다 보이는 개수. 상세에서 뒤로 가기로 돌아와도 같은 길이로 그리려고 모듈 상태로 둔다.
const shown = { record: PAGE, chat: PAGE };
let filterBar = null;

let onResumeChat = () => {};
let onContinueRecord = () => {};
let onOpenDetail = () => {};
// 상세 화면에 연 항목. { kind: 'record' | 'chat', id } 이고, 목록을 보고 있으면 null.
let opened = null;
// 상세 화면 옆의 즐겨찾기·메모 도구 (detail-tools.js). initRecordsView 가 만든다.
let detailTools = null;

// 상세 화면을 여닫는 것은 방문 기록에 남도록 main.js 가 router 로 처리한다.
// onOpen(target) 은 항목을 눌렀을 때, onBack() 은 「← 목록으로」 를 눌렀을 때 부른다.
export function initRecordsView({ onResume, onContinue, onOpen, onBack }) {
  onResumeChat = onResume;
  onContinueRecord = onContinue;
  onOpenDetail = onOpen;
  $('#s-back').addEventListener('click', onBack);
  detailTools = initDetailTools(attachChatNav($('#s-detail-body'), { questionSelector: '.qa-q' }));
  // 필터 줄은 여기서 한 번만 만든다. 다시 그리면 검색칸의 포커스와 글자가 사라진다.
  filterBar = createFilterBar($('#s-filter'), {
    key: 'records.filter',
    onChange: () => {
      shown.record = PAGE;
      shown.chat = PAGE;
      renderRecordsView();
    },
  });
  for (const kind of ['record', 'chat']) {
    $(`#s-${kind === 'record' ? 'recent' : 'chats'}-more`).addEventListener('click', () => {
      shown[kind] += PAGE;
      renderLists();
    });
  }
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

// 행 안에는 버튼을 넣을 수 없으므로 표시만 한다.
function starMark(kind, id) {
  return isStarred(kind, id) ? h('span', { class: 'row-star', title: '즐겨찾기' }, '★ ') : '';
}

function noteMark(kind, id) {
  return getNote(kind, id) ? h('span', { class: 'row-note' }, '메모') : '';
}

// 찾은 곳 한 줄. 찾은 단어는 mark 로 강조한다.
function hitLine(hit) {
  if (!hit) return '';
  return h('span', { class: 'row-hit muted small' }, `${hit.label}: `, hit.parts.map((p) => (p.mark ? h('mark', {}, p.text) : p.text)));
}

// 제목 글 안의 검색어를 mark 로 감싼 노드들.
function titleNodes(text, terms) {
  return markParts(text, terms).map((p) => (p.mark ? h('mark', {}, p.text) : p.text));
}

function recordRow(r, hit, terms) {
  return h(
    'li',
    {},
    h(
      'button',
      { type: 'button', class: 'record-row', 'data-key': `record:${r.id}`, onclick: () => onOpenDetail({ kind: 'record', id: r.id }) },
      starMark('record', r.id),
      h('span', { class: `pill ${r.verdict}` }, VERDICT_LABEL[r.verdict]),
      ' ',
      h('strong', {}, ...titleNodes(r.question.concept, terms)),
      h('span', { class: 'muted small' }, ` · ${r.topic.path.join(' › ')} · ${formatDate(r.at)}`),
      noteMark('record', r.id),
      hitLine(hit),
    ),
  );
}

function chatRow(c, hit, terms) {
  return h(
    'li',
    {},
    h(
      'button',
      { type: 'button', class: 'record-row', 'data-key': `chat:${c.id}`, onclick: () => onOpenDetail({ kind: 'chat', id: c.id }) },
      starMark('chat', c.id),
      h('strong', {}, ...titleNodes(c.title, terms)),
      h('span', { class: 'muted small' }, ` · ${c.category || '자유 질문'} · 질문 ${c.history.length}개 · ${formatDate(c.updatedAt ?? c.at)}`),
      noteMark('chat', c.id),
      hitLine(hit),
    ),
  );
}

// 항목의 분야 경로. 대화는 세부 분야 (chat.topic) 가 있으면 그 경로, 없으면 맨 위 분야 하나.
const recordPath = (r) => (r.topic.path.length ? r.topic.path : ['기타']);
const chatPath = (c) => (c.topic?.path?.length ? c.topic.path : [c.category || '자유 질문']);
const recordCat = (r) => pathText(recordPath(r));
const chatCat = (c) => pathText(chatPath(c));
const chatTime = (c) => c.updatedAt ?? c.at;

// 분야·결과를 뺀 필터 (기간, 즐겨찾기, 메모, 검색) 를 통과한 항목을 { item, hit } 로 준다.
function baseFilter(items, kind, f) {
  const range = periodRange(f);
  const terms = splitTerms(f.q);
  const out = [];
  for (const item of items) {
    if (!inPeriod(kind === 'record' ? item.at : chatTime(item), range)) continue;
    if (f.starred && !isStarred(kind, item.id)) continue;
    const note = getNote(kind, item.id);
    if (f.noted && note.trim() === '') continue;
    const found = searchFields(kind === 'record' ? recordFields(item, note) : chatFields(item, note), terms);
    if (found.matched) out.push({ item, hit: found.hit });
  }
  return out;
}

function countTitle(base, total, matched) {
  return isFiltered(filterBar.state) ? `${base} · ${total}개 중 ${matched}개` : `${base} · ${total}개`;
}

// 더 보기 버튼: 남은 개수를 적고, 다 보였으면 숨긴다.
function moreButton(el, kind, total) {
  el.hidden = shown[kind] >= total;
  el.textContent = `더 보기 (남은 ${Math.max(0, total - shown[kind])}개)`;
}

const topOf = (cat) => cat.split(PATH_SEP)[0];

function renderStatsTable(rows, totalRecords, f) {
  const stats = statsByCategory(rows.map((x) => x.item));
  $('#s-empty').hidden = stats.length > 0;
  $('#s-empty').textContent = totalRecords === 0 ? '아직 푼 문제가 없어요.' : '조건에 맞는 푼 문제가 없어요.';
  $('#s-table').hidden = stats.length === 0;
  const toggle = (cat) => filterBar.patch({ cat: filterBar.state.cat === cat ? '' : cat });
  $('#s-table tbody').replaceChildren(
    ...stats.map((s) =>
      h(
        'tr',
        {
          'data-cat': s.cat,
          class: topOf(f.cat) === s.cat ? 'selected' : '',
          tabindex: 0,
          'aria-pressed': topOf(f.cat) === s.cat ? 'true' : 'false',
          onclick: () => toggle(s.cat),
          onkeydown: (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggle(s.cat);
            }
          },
        },
        h('td', {}, s.cat),
        h('td', { class: 'num' }, s.total),
        h('td', { class: 'num' }, `${Math.round((s.correct / s.total) * 100)}%`),
        h('td', { class: 'num' }, s.partial),
      ),
    ),
  );
}

function renderLists() {
  const f = filterBar.state;
  const allChats = list('chats');
  const allRecords = list('records');
  filterBar.setCategories(categoryOptions([...allRecords.map(recordPath), ...allChats.map(chatPath)]));
  const terms = splitTerms(f.q);

  // 푼 문제. 정답률 표는 분야·결과 필터를 뺀 나머지 필터로 계산한다.
  const recordBase = baseFilter(allRecords, 'record', f);
  renderStatsTable(recordBase, allRecords.length, f);
  const recordRows = sortItems(
    recordBase.filter(({ item }) => inCategory(recordPath(item), f.cat) && (f.verdict === 'all' || item.verdict === f.verdict)),
    f.sort,
    (x) => x.item.at,
    (x) => recordCat(x.item),
  );
  $('#s-recent-title').textContent = countTitle('최근에 푼 문제', allRecords.length, recordRows.length);
  $('#s-recent').replaceChildren(...recordRows.slice(0, shown.record).map((x) => recordRow(x.item, x.hit, terms)));
  moreButton($('#s-recent-more'), 'record', recordRows.length);

  // 대화. 결과 필터는 적용하지 않는다.
  const chatRows = sortItems(
    baseFilter(allChats, 'chat', f).filter(({ item }) => inCategory(chatPath(item), f.cat)),
    f.sort,
    (x) => chatTime(x.item),
    (x) => chatCat(x.item),
  );
  $('#s-chats-card').hidden = allChats.length === 0;
  $('#s-chats-title').textContent = countTitle('묻기 대화', allChats.length, chatRows.length);
  $('#s-chats').replaceChildren(...chatRows.slice(0, shown.chat).map((x) => chatRow(x.item, x.hit, terms)));
  moreButton($('#s-chats-more'), 'chat', chatRows.length);
}

// ── 상세 화면 ─────────────────────────────────────────

function recordDetail(r) {
  const q = r.question;
  return [
    h('h2', { class: 'detail-title' }, h('span', { class: `pill ${r.verdict}` }, VERDICT_LABEL[r.verdict]), ' ', q.concept),
    h('p', { class: 'muted small' }, `${r.topic.path.join(' › ')} · ${formatDate(r.at)}`),
    h('h4', {}, '문제'),
    mdBlock(q.prompt),
    q.code ? decoratePre(h('pre', {}, h('code', {}, q.code))) : '',
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
  const body = $('#s-detail-body');
  const nodes = opened.kind === 'record' ? recordDetail(item) : chatDetail(item);
  // 이미 열려 있는 상세를 다시 그릴 때는 스크롤 위치를 되돌린다.
  const y = $('#s-detail').hidden ? null : window.scrollY;
  body.replaceChildren(...nodes);
  detailTools.setTarget(opened);
  if (y !== null && window.scrollY !== y) window.scrollTo(0, y);
}

function closeDetail() {
  opened = null;
  detailTools.setTarget(null);
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
