// 기록 화면의 하위 탭: 「문제」, 「묻기」, 「대화」 중 하나의 목록만 보인다. 고른 탭은 기기마다 기억한다.
import { $, remember } from './dom.js';

const TABS = ['record', 'chat', 'talk'];

let current = TABS.includes(remember('recordsTab')) ? remember('recordsTab') : 'record';

function render() {
  for (const button of document.querySelectorAll('#s-tabs [data-tab]')) {
    button.setAttribute('aria-selected', String(button.dataset.tab === current));
  }
  for (const pane of document.querySelectorAll('#s-lists [data-pane]')) pane.hidden = pane.dataset.pane !== current;
}

// 지금 고른 탭. 'record' | 'chat' | 'talk'.
export const currentRecordsTab = () => current;

// 탭을 고른다. 모르는 값이면 무시한다.
export function selectRecordsTab(tab) {
  if (!TABS.includes(tab)) return;
  current = tab;
  remember('recordsTab', tab);
  render();
}

export function initRecordsTabs() {
  for (const button of document.querySelectorAll('#s-tabs [data-tab]')) {
    button.addEventListener('click', () => selectRecordsTab(button.dataset.tab));
  }
  $('#s-tabs').hidden = false;
  render();
}
