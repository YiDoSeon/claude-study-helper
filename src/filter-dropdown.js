// 필터 줄의 눌러서 펼치는 칸: summary 에 고른 것을 요약해 보이고, 펼치면 체크박스 목록이 나온다.
// 분야와 결과 필터가 같이 쓴다. 무엇을 보일지는 모른다.
import { h } from './dom.js';

// 고른 이름들을 한 줄로 줄인다. 없으면 「전체」, 하나면 그 이름, 여럿이면 「A 외 N」.
export function summaryText(labels) {
  if (labels.length === 0) return '전체';
  if (labels.length === 1) return labels[0];
  return `${labels[0]} 외 ${labels.length - 1}`;
}

// 돌려주는 것: el (details), body (체크박스를 넣을 곳), setSummary(labels)
export function createDropdown(name) {
  const text = h('span', {}, '전체');
  const body = h('div', { class: 'filter-multi-body' });
  const el = h('details', { class: 'filter-multi', 'data-filter': name }, h('summary', {}, text), body);
  // 칸 밖을 누르면 접는다.
  document.addEventListener('click', (event) => {
    if (el.open && !el.contains(event.target)) el.open = false;
  });
  return {
    el,
    body,
    setSummary(labels) {
      text.textContent = summaryText(labels);
    },
  };
}

// 체크박스 한 줄. { row, input } 을 돌려준다.
export function checkRow(value, labelText, { indent = false } = {}) {
  const input = h('input', { type: 'checkbox', value });
  const row = h('label', { class: indent ? 'filter-multi-row sub' : 'filter-multi-row' }, input, labelText);
  return { row, input };
}
