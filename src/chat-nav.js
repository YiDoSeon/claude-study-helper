// 긴 대화에서 질문 사이를 옮겨 다니는 떠 있는 버튼과 질문 목록.
// 「묻기」, 「더 물어보기」, 기록의 상세 화면이 같이 쓴다.
// 질문으로 옮길 때 방문 기록을 하나 넣어, 뒤로 가기가 옮기기 전 위치로 돌아가게 한다 (router.js).
import { h } from './dom.js';
import { pushPosition } from './router.js';

const TITLE_LENGTH = 60;

// 상단바와 하단 탭에 가리지 않게 el 의 위쪽이나 아래쪽으로 스크롤한다.
function scrollToEdge(el, edge) {
  const rect = el.getBoundingClientRect();
  const headerHeight = document.querySelector('.top')?.offsetHeight ?? 0;
  const tabsHeight = document.querySelector('.tabs')?.offsetHeight ?? 0;
  const top = edge === 'top'
    ? window.scrollY + rect.top - headerHeight - 8
    : window.scrollY + rect.bottom - window.innerHeight + tabsHeight + 8;
  window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
}

// container 안에서 questionSelector 에 맞는 요소를 질문으로 보고 목록을 만든다.
// bottom 은 「맨 아래」 로 갈 요소다 (보통 입력 칸). 없으면 container 의 끝으로 간다.
export function attachChatNav(container, { questionSelector, bottom = container }) {
  const list = h('ol', { class: 'chat-nav-list' });
  const panel = h(
    'div',
    { class: 'chat-nav-panel', hidden: true },
    h('p', { class: 'muted small' }, '질문으로 이동'),
    list,
    h(
      'div',
      { class: 'actions compact' },
      h('button', { type: 'button', onclick: () => go(container, 'top') }, '맨 위'),
      h('button', { type: 'button', onclick: () => go(bottom, 'bottom') }, '맨 아래'),
    ),
  );
  const toggle = h('button', { type: 'button', class: 'chat-nav-toggle', hidden: true, onclick: togglePanel }, '질문 목록');
  const nav = h('div', { class: 'chat-nav' }, panel, toggle);
  container.after(nav);

  function questions() {
    return [...container.querySelectorAll(questionSelector)];
  }

  function go(el, edge) {
    panel.hidden = true;
    pushPosition();
    scrollToEdge(el, edge);
  }

  function togglePanel() {
    if (panel.hidden) {
      list.replaceChildren(
        ...questions().map((q) => {
          const text = q.textContent.trim().split('\n')[0];
          const title = text.length > TITLE_LENGTH ? `${text.slice(0, TITLE_LENGTH)}…` : text;
          return h('li', {}, h('button', { type: 'button', class: 'chat-nav-item', onclick: () => go(q, 'top') }, title));
        }),
      );
    }
    panel.hidden = !panel.hidden;
  }

  function update() {
    toggle.hidden = questions().length === 0;
    if (toggle.hidden) panel.hidden = true;
  }

  new MutationObserver(update).observe(container, { childList: true, subtree: true });
  document.addEventListener('click', (event) => {
    if (!nav.contains(event.target)) panel.hidden = true;
  });
  // 뒤로 가기·앞으로 가기로 다른 위치나 화면으로 가면 창을 닫는다.
  window.addEventListener('popstate', () => {
    panel.hidden = true;
  });
  update();
}
