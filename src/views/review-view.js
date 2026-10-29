// 「복습」 화면: 다시 풀 개념 목록과 복습 시작.
import { $, h, formatDate } from '../dom.js';
import { dueItems, pendingItems } from '../review.js';

export function renderReviewView() {
  const due = dueItems();
  const pending = pendingItems();
  $('#r-summary').textContent = due.length
    ? `오늘 복습할 개념이 ${due.length}개 있어요.`
    : pending.length
      ? '오늘 복습할 개념은 없어요. 아래는 예정된 복습이에요.'
      : '아직 복습할 개념이 없어요. 틀린 문제가 여기에 쌓여요.';
  $('#r-start').hidden = due.length === 0;

  const now = Date.now();
  $('#r-list').replaceChildren(
    ...pending.map((item) =>
      h(
        'li',
        { class: item.due <= now ? 'due' : '' },
        h('strong', {}, item.concept),
        h('span', { class: 'muted' }, ` · ${item.topic.path.join(' › ')}`),
        h('div', { class: 'muted small' }, `${item.due <= now ? '지금' : formatDate(item.due)} · ${item.step + 1}단계`),
      ),
    ),
  );
  return due.length;
}

export function initReviewView({ onStart }) {
  $('#r-start').addEventListener('click', () => {
    const [item] = dueItems();
    if (item) onStart(item);
  });
}
