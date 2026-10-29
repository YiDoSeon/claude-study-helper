// 「복습」 화면: 다시 풀 개념 목록. 예정일과 상관없이 풀거나 빼고, 뺀 개념은 다시 넣는다.
import { $, h, formatDate } from '../dom.js';
import { dueItems, pendingItems, offItems, removeItem, restoreItem } from '../review.js';

const STEPS = 5;
let onStartReview = () => {};

function pendingItem(item, now) {
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
  );
}

function offItem(item) {
  const reason = item.step >= STEPS && !item.removedAt ? `${STEPS}단계 완료` : '직접 뺌';
  return h(
    'li',
    {},
    h('strong', {}, item.concept),
    h('span', { class: 'muted' }, ` · ${item.topic.path.join(' › ')}`),
    h('div', { class: 'muted small' }, reason),
    h('div', { class: 'actions compact' }, h('button', { type: 'button', onclick: () => restoreItem(item.id) }, '다시 넣기')),
  );
}

export function renderReviewView() {
  const due = dueItems();
  const pending = pendingItems();
  const off = offItems();
  $('#r-summary').textContent = due.length
    ? `추천 복습 시기가 된 개념이 ${due.length}개 있어요. 다른 개념도 언제든 풀 수 있어요.`
    : pending.length
      ? '지금 추천하는 복습은 없어요. 아래 개념은 언제든 풀 수 있어요.'
      : '아직 복습할 개념이 없어요. 틀린 문제가 여기에 쌓이고, 기록에서 직접 넣을 수도 있어요.';
  $('#r-start').hidden = due.length === 0;

  const now = Date.now();
  $('#r-list').replaceChildren(...pending.map((item) => pendingItem(item, now)));
  $('#r-off-card').hidden = off.length === 0;
  $('#r-off-count').textContent = off.length;
  $('#r-off').replaceChildren(...off.map(offItem));
  return due.length;
}

export function initReviewView({ onStart }) {
  onStartReview = onStart;
  $('#r-start').addEventListener('click', () => {
    const [item] = dueItems();
    if (item) onStart(item);
  });
}
