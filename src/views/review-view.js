// 「복습」 화면: 다시 풀 개념 목록. 예정일과 상관없이 풀거나 빼고, 뺀 개념은 다시 넣는다.
import { $, h, formatDate } from '../dom.js';
import { splitTerms, searchFields } from '../list-search.js';
import { createFilterBar, isFiltered, compareText, REVIEW_FIELDS, REVIEW_SORTS } from '../list-filter.js';
import { dueItems, pendingItems, offItems, removeItem, restoreItem } from '../review.js';

const STEPS = 5;
let onStartReview = () => {};
let filterBar = null;

function hitLine(hit) {
  if (!hit) return '';
  return h('div', { class: 'row-hit muted small' }, `${hit.label}: `, hit.parts.map((p) => (p.mark ? h('mark', {}, p.text) : p.text)));
}

function pendingItem(item, now, hit) {
  const isDue = item.due <= now;
  return h(
    'li',
    { class: isDue ? 'due' : '' },
    h('strong', {}, item.concept),
    h('span', { class: 'muted' }, ` · ${item.topic.path.join(' › ')}`),
    h('div', { class: 'muted small' }, `${isDue ? '지금' : `다음 추천 ${formatDate(item.due)}`} · ${item.step + 1}단계`),
    h(
      'div',
      { class: 'actions compact' },
      h('button', { type: 'button', class: isDue ? 'primary' : '', onclick: () => onStartReview(item) }, '지금 풀기'),
      h('button', { type: 'button', onclick: () => removeItem(item.id) }, '빼기'),
    ),
    hitLine(hit),
  );
}

function offItem(item, hit) {
  const reason = item.step >= STEPS && !item.removedAt ? `${STEPS}단계 완료` : '직접 뺌';
  return h(
    'li',
    {},
    h('strong', {}, item.concept),
    h('span', { class: 'muted' }, ` · ${item.topic.path.join(' › ')}`),
    h('div', { class: 'muted small' }, reason),
    hitLine(hit),
    h('div', { class: 'actions compact' }, h('button', { type: 'button', onclick: () => restoreItem(item.id) }, '다시 넣기')),
  );
}

const itemCat = (item) => item.topic.path[0] ?? '기타';
const itemFields = (item) => [
  { label: '개념', text: item.concept, title: true },
  { label: '분야', text: item.topic.path.join(' › ') },
];

// 검색과 분야를 통과한 항목을 { item, hit } 로 준다.
function searchAndCat(items, f) {
  const terms = splitTerms(f.q);
  const out = [];
  for (const item of items) {
    if (f.cat !== '' && itemCat(item) !== f.cat) continue;
    const found = searchFields(itemFields(item), terms);
    if (found.matched) out.push({ item, hit: found.hit });
  }
  return out;
}

function sortPending(rows, sort) {
  const byDue = (a, b) => a.item.due - b.item.due;
  if (sort === 'step') return rows.sort((a, b) => a.item.step - b.item.step || byDue(a, b));
  if (sort === 'cat') return rows.sort((a, b) => compareText(itemCat(a.item), itemCat(b.item)) || byDue(a, b));
  return rows.sort(byDue);
}

const countText = (base, total, matched, filtered) => (filtered ? `${base} · ${total}개 중 ${matched}개` : `${base} · ${total}개`);

// 분야 (빈 값이면 전체) 의 추천 복습 개념.
function reviewStartItems(cat) {
  return dueItems().filter((item) => cat === '' || itemCat(item) === cat);
}

export function renderReviewView() {
  const due = dueItems();
  const pending = pendingItems();
  const off = offItems();
  const f = filterBar.state;
  const filtered = isFiltered(f);
  const now = Date.now();
  $('#r-summary').textContent = due.length
    ? `추천 복습 시기가 된 개념이 ${due.length}개 있어요. 다른 개념도 언제든 풀 수 있어요.`
    : pending.length
      ? '지금 추천하는 복습은 없어요. 아래 개념은 언제든 풀 수 있어요.'
      : '아직 복습할 개념이 없어요. 틀린 문제가 여기에 쌓이고, 기록에서 직접 넣을 수도 있어요.';

  // 분야 필터가 걸리면 「차례로 풀기」 는 그 분야의 추천 개념만 다룬다.
  $('#r-start').hidden = reviewStartItems(f.cat).length === 0;
  $('#r-start').textContent = f.cat ? `${f.cat} 추천 복습 차례로 풀기` : '추천 복습 차례로 풀기';

  filterBar.setCategories([...new Set([...pending, ...off].map(itemCat))].sort(compareText));
  $('#r-filter').hidden = pending.length === 0 && off.length === 0;

  const pendingRows = sortPending(
    searchAndCat(pending, f).filter(({ item }) => f.status === 'all' || (f.status === 'due') === (item.due <= now)),
    f.sort,
  );
  $('#r-count').textContent = countText('복습할 개념', pending.length, pendingRows.length, filtered);
  $('#r-count').hidden = pending.length === 0;
  $('#r-list').replaceChildren(...pendingRows.map((x) => pendingItem(x.item, now, x.hit)));

  const offRows = searchAndCat(off, f);
  $('#r-off-card').hidden = off.length === 0;
  $('#r-off-count').textContent = filtered ? `${off.length}개 중 ${offRows.length}개` : `${off.length}개`;
  $('#r-off').replaceChildren(...offRows.map((x) => offItem(x.item, x.hit)));
  return due.length;
}

// onStart(item, { category }) : 분야 필터가 걸렸으면 그 분야만 차례로 풀게 범위를 넘긴다.
export function initReviewView({ onStart }) {
  onStartReview = (item) => onStart(item);
  // 필터 줄은 한 번만 만든다. 다시 그리면 검색칸의 포커스와 글자가 사라진다.
  filterBar = createFilterBar($('#r-filter'), {
    key: 'review.filter',
    onChange: () => renderReviewView(),
    fields: REVIEW_FIELDS,
    sorts: REVIEW_SORTS,
    defaultSort: 'due',
  });
  $('#r-start').addEventListener('click', () => {
    const cat = filterBar.state.cat;
    const [item] = reviewStartItems(cat);
    if (item) onStart(item, cat ? { category: cat } : undefined);
  });
}
