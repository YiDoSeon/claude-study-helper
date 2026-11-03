// 긴 대화에서 질문 사이를 옮겨 다니는 떠 있는 버튼과 질문 목록. 목록은 질문마다 답변의 첫 블록 글도 보여 준다.
// 「묻기」, 「더 물어보기」, 기록의 상세 화면이 같이 쓴다. 기록의 상세 화면은 addTool 로 즐겨찾기와 메모 버튼을 같은 줄에 넣는다.
// 질문으로 옮길 때 방문 기록을 하나 넣어, 뒤로 가기가 옮기기 전 위치로 돌아가게 한다 (router.js).
import { h } from './dom.js';
import { pushPosition } from './router.js';

const TITLE_LENGTH = 60;

// 공백을 정리해 TITLE_LENGTH 자로 자른다. 잘렸으면 끝에 「…」 를 붙인다.
function shorten(text) {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > TITLE_LENGTH ? `${flat.slice(0, TITLE_LENGTH)}…` : flat;
}

// 답변 안의 첫 블록 (p, h1~h6, li, pre 중 글이 있는 첫 요소) 의 글. 없으면 답변 전체의 글.
// 블록들을 이은 textContent 는 제목과 문단 글자가 붙으므로 쓰지 않는다.
function firstBlockText(answer) {
  for (const block of answer.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, pre')) {
    const text = block.textContent.trim();
    if (text) return text;
  }
  return answer.textContent.trim();
}

// 질문 요소의 질문 글. 질문 쪽 「복사」·「저장」 버튼 글자가 섞이지 않게 글 요소 (.qa-q-text, 말풍선의 .md) 에서 읽는다.
function questionText(q) {
  return (q.querySelector('.qa-q-text, .md') ?? q).textContent;
}

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
// dock 은 화면 아래에 고정된 입력 영역이다. 있으면 버튼을 그 위로 올리고, 「맨 아래」 는 문서 끝으로 간다.
export function attachChatNav(container, { questionSelector, bottom = container, dock = null }) {
  const tools = [];
  const list = h('ol', { class: 'chat-nav-list' });
  const panel = h(
    'div',
    { class: 'chat-nav-panel', hidden: true },
    h('p', { class: 'muted small' }, '질문·답변으로 이동'),
    list,
    h(
      'div',
      { class: 'actions compact' },
      h('button', { type: 'button', onclick: () => go(container, 'top') }, '맨 위'),
      h('button', { type: 'button', onclick: () => go(bottom, 'bottom') }, '맨 아래'),
    ),
  );
  const toggle = h('button', { type: 'button', class: 'chat-nav-toggle', hidden: true, onclick: togglePanel }, '질문 목록');
  const nav = h('div', { class: dock ? 'chat-nav above-dock' : 'chat-nav' }, panel, toggle);
  // 접기 손잡이 (dock-toggle.js) 가 dock 위로 나와 있으면 그 위에 둔다. attachDockToggle 이 먼저 불린다.
  if (dock?.querySelector('.dock-toggle')) nav.classList.add('above-toggle');
  container.after(nav);
  if (dock) {
    // dock 은 sticky 라 대화가 짧으면 화면 맨 아래보다 위에 있다. 그래서 높이가 아니라 실제 위쪽 경계의 위치를 잰다.
    // --dock-rise: 화면 아래 끝에서 dock 위쪽 경계까지의 거리. 화면이 숨어 있어 높이가 0 이면 재지 않는다.
    let frame = 0;
    const syncDockTop = () => {
      frame = 0;
      const rect = dock.getBoundingClientRect();
      if (!(rect.height > 0)) return;
      // dock 이 화면 위로 스크롤되어 나갔으면 버튼은 하단 탭 위로 돌아간다 (style.css 의 기본값).
      if (rect.top < 0) nav.style.removeProperty('--dock-rise');
      else nav.style.setProperty('--dock-rise', `${Math.max(0, Math.round(window.innerHeight - rect.top))}px`);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(syncDockTop);
    };
    syncDockTop();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    // jsdom 같은 환경에는 ResizeObserver 가 없다. 없으면 스크롤과 창 크기 변화 때만 잰다.
    if (typeof ResizeObserver === 'function') {
      const observer = new ResizeObserver(schedule);
      observer.observe(dock);
      observer.observe(container);
    }
  }

  function questions() {
    return [...container.querySelectorAll(questionSelector)];
  }

  function go(el, edge) {
    panel.hidden = true;
    pushPosition();
    // 고정된 입력 영역은 늘 화면 안에 있어 위치로 계산할 수 없으므로 문서 끝으로 간다.
    if (dock && el === bottom) {
      const top = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
      return;
    }
    scrollToEdge(el, edge);
  }

  function togglePanel() {
    if (panel.hidden) {
      list.replaceChildren(
        ...questions().map((q) => {
          const items = [h('button', { type: 'button', class: 'chat-nav-item', onclick: () => go(q, 'top') }, shorten(questionText(q).trim().split('\n')[0]))];
          const answer = q.nextElementSibling;
          const answerText = answer ? shorten(firstBlockText(answer)) : '';
          if (answerText) {
            items.push(h('button', { type: 'button', class: 'chat-nav-item chat-nav-answer', onclick: () => go(answer, 'top') }, `답: ${answerText}`));
          }
          return h('li', {}, ...items);
        }),
      );
    }
    panel.hidden = !panel.hidden;
    if (!panel.hidden) for (const tool of tools) tool.close();
  }

  function update() {
    toggle.hidden = questions().length === 0;
    if (toggle.hidden) panel.hidden = true;
  }

  new MutationObserver(update).observe(container, { childList: true, subtree: true });
  document.addEventListener('click', (event) => {
    if (nav.contains(event.target)) return;
    panel.hidden = true;
    for (const tool of tools) tool.close();
  });
  // 뒤로 가기·앞으로 가기로 다른 위치나 화면으로 가면 창을 닫는다.
  window.addEventListener('popstate', () => {
    panel.hidden = true;
    for (const tool of tools) tool.close();
  });
  update();

  // 다른 도구의 버튼들을 「질문 목록」 위에, 창을 질문 목록 창 아래에 넣는다.
  // 질문 목록 창이 열리면 tool.close() 를 불러 도구의 창을 닫는다. 도구는 closePanel() 로 질문 목록 창을 닫는다.
  return {
    addTool({ buttons, panel: toolPanel, close }) {
      tools.push({ close });
      panel.after(toolPanel);
      toggle.before(...buttons);
    },
    // 질문 목록 창을 닫는다. 도구가 자기 창을 열기 전에 부르므로 다른 도구의 창도 함께 닫아 창이 겹치지 않게 한다.
    closePanel() {
      panel.hidden = true;
      for (const tool of tools) tool.close();
    },
  };
}
