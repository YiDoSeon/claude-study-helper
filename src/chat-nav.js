// 긴 대화에서 질문 사이를 옮겨 다니는 떠 있는 버튼과 질문 목록.
// 「묻기」, 「더 물어보기」, 기록의 상세 화면이 같이 쓴다.
//
// 뒤로 가기는 문서 안 링크처럼 동작한다.
// - 목록 창을 열면 방문 기록을 하나 넣어, 뒤로 가기가 창만 닫는다.
// - 질문으로 옮기면 그 기록을 옮긴 기록으로 바꾸고, 바로 아래 기록에 옮기기 전 스크롤 위치를 적어 둔다.
//   그래서 뒤로 가기를 누르면 옮기기 전 위치로 돌아간다.
// 넣는 기록에는 depth (기록 상세 화면을 연 뒤 쌓인 수) 를 이어 적어, 「← 목록으로」 가 한 번에 돌아가게 한다.
import { h } from './dom.js';

const TITLE_LENGTH = 60;

// 기록 id → 그 대화가 지금 화면에 보이는지. 다른 화면의 스크롤 위치로 가지 않게 한다.
const visibleChecks = new Map();
// 창을 뒤로 가기가 아닌 방법으로 닫아 기록을 지울 때는 스크롤을 되돌리지 않는다.
let skipRestore = false;
const panels = new Set();

// 방문 기록은 건드리지 않고 모든 목록 창을 닫는다. 기록 상세 화면이 depth 만큼 한 번에
// 돌아갈 때 쓴다. 그러지 않으면 바깥을 누른 것으로 보고 창이 기록을 한 번 더 지운다.
export function hideChatNavPanels() {
  for (const panel of panels) panel.hidden = true;
}

window.addEventListener('popstate', () => {
  const s = history.state;
  if (skipRestore) {
    skipRestore = false;
    return;
  }
  if (typeof s?.scrollY === 'number' && visibleChecks.get(s.nav)?.()) window.scrollTo(0, s.scrollY);
});

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

// 지금 기록의 상태에서 이 모듈이 적은 값을 뺀 것. 기록 상세 화면의 표시 (recordsDetail) 는 남는다.
function baseState() {
  const { scrollY, nav, chatNav, ...rest } = history.state ?? {};
  return rest;
}

// container 안에서 questionSelector 에 맞는 요소를 질문으로 보고 목록을 만든다.
// bottom 은 「맨 아래」 로 갈 요소다 (보통 입력 칸). 없으면 container 의 끝으로 간다.
export function attachChatNav(container, { questionSelector, bottom = container }) {
  const navId = container.id;
  visibleChecks.set(navId, () => !container.closest('[hidden]'));

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
  panels.add(panel);
  const toggle = h('button', { type: 'button', class: 'chat-nav-toggle', hidden: true, onclick: togglePanel }, '질문 목록');
  const nav = h('div', { class: 'chat-nav' }, panel, toggle);
  container.after(nav);

  function questions() {
    return [...container.querySelectorAll(questionSelector)];
  }

  // 창을 열 때 넣은 기록을 옮긴 기록으로 바꾼다. 아래 기록에는 openPanel 이 스크롤 위치를 적어 두었다.
  function go(el, edge) {
    panel.hidden = true;
    if (history.state?.chatNav) history.replaceState(baseState(), '');
    scrollToEdge(el, edge);
  }

  function openPanel() {
    list.replaceChildren(
      ...questions().map((q) => {
        const text = q.textContent.trim().split('\n')[0];
        const title = text.length > TITLE_LENGTH ? `${text.slice(0, TITLE_LENGTH)}…` : text;
        return h('li', {}, h('button', { type: 'button', class: 'chat-nav-item', onclick: () => go(q, 'top') }, title));
      }),
    );
    panel.hidden = false;
    const base = baseState();
    history.replaceState({ ...base, scrollY: window.scrollY, nav: navId }, '');
    history.pushState({ ...base, chatNav: true, depth: (base.depth ?? 0) + 1 }, '');
  }

  // 뒤로 가기가 아닌 방법으로 닫으면 openPanel 이 넣은 기록을 지운다.
  function closePanel() {
    if (panel.hidden) return;
    panel.hidden = true;
    if (history.state?.chatNav) {
      skipRestore = true;
      history.back();
    }
  }

  function togglePanel() {
    if (panel.hidden) openPanel();
    else closePanel();
  }

  function update() {
    toggle.hidden = questions().length === 0;
    if (toggle.hidden) closePanel();
  }

  new MutationObserver(update).observe(container, { childList: true, subtree: true });
  document.addEventListener('click', (event) => {
    if (!nav.contains(event.target)) closePanel();
  });
  window.addEventListener('popstate', () => {
    if (!history.state?.chatNav) panel.hidden = true;
  });
  update();
}
