// 대화 화면의 「기억 찾기」 도구: 지금 대화에서 Claude 가 뽑은 후보를 보여 주고, 고른 것만 메모리에 저장한다.
// 「질문 목록」 과 같은 떠 있는 줄 (chat-nav.js 의 addTool) 에 들어간다.
import { h } from './dom.js';
import { describeError } from './api.js';
import { resolveChoice } from './chat-choice.js';
import { showToast } from './toast.js';
import { addMemory, listMemories, MEMORY_SCOPES } from './memory.js';
import { extractMemories } from './memory-extract.js';

// nav 는 attachChatNav 가 돌려준 것이고, container 는 질문들이 그려지는 곳이다.
// getChat() 은 지금 대화 ({ id, history, summary?, choice? }) 를 주고, 대화가 없으면 null 을 준다.
// 저장할 때 적용 범위는 처음에 「대화와 묻기」 로 골라 둔다.
export function attachMemoryFinder(nav, container, getChat) {
  let busy = false;
  let run = 0; // 창을 닫거나 다시 열면 늘려서 늦게 온 결과를 버린다.
  const intro = h('p', { class: 'muted small' }, '이 대화에서 기억해 둘 만한 사실을 Claude 가 찾아요. 찾을 때 API 요청이 한 번 들어가요. 고른 것만 저장해요.');
  const find = h('button', { type: 'button', 'data-memory': 'find', onclick: findCandidates }, '찾기');
  const status = h('p', { class: 'small memory-status', role: 'status', hidden: true });
  const list = h('ul', { class: 'memory-candidates' });
  const scope = h('select', { 'aria-label': '적용 범위', 'data-memory': 'scope' });
  for (const s of MEMORY_SCOPES) scope.append(h('option', { value: s.value }, s.label));
  const save = h('button', { type: 'button', class: 'primary', 'data-memory': 'save', onclick: saveChecked }, '저장');
  const saveRow = h('div', { class: 'actions compact', hidden: true }, scope, save);
  const panel = h(
    'div',
    { class: 'chat-nav-panel memory-panel', hidden: true },
    h('p', { class: 'small' }, h('strong', {}, '기억할 것 찾기')),
    intro,
    status,
    list,
    saveRow,
    h('div', { class: 'actions compact' }, find, h('button', { type: 'button', onclick: close }, '닫기')),
  );
  const toggle = h('button', { type: 'button', class: 'detail-tool memory-toggle', title: '기억할 것 찾기', hidden: true, onclick: togglePanel }, '기억 찾기');

  const rows = () => [...list.querySelectorAll('li')];
  function syncSave() {
    save.disabled = !rows().some((li) => li.querySelector('input[type=checkbox]').checked);
  }

  function reset() {
    run += 1;
    busy = false;
    find.disabled = false;
    status.hidden = true;
    status.classList.remove('error');
    list.replaceChildren();
    saveRow.hidden = true;
  }

  async function findCandidates() {
    const chat = getChat();
    if (!chat?.history.length || busy) return;
    reset();
    const mine = run;
    busy = true;
    find.disabled = true;
    status.hidden = false;
    status.textContent = '찾는 중…';
    try {
      const items = await extractMemories({
        pairs: chat.history,
        summary: chat.summary,
        existing: listMemories().map((m) => m.text),
        choice: resolveChoice(chat.choice, chat.history),
      });
      if (mine !== run) return;
      busy = false;
      find.disabled = false;
      if (!items.length) {
        status.textContent = '기억해 둘 만한 것을 찾지 못했어요.';
        return;
      }
      status.hidden = true;
      list.replaceChildren(
        ...items.map((text) => {
          const box = h('input', { type: 'checkbox', checked: true, 'aria-label': '저장' });
          box.addEventListener('change', syncSave);
          const input = h('textarea', { rows: 2, class: 'memory-text', 'aria-label': '기억할 글' });
          input.value = text;
          return h('li', {}, box, input);
        }),
      );
      saveRow.hidden = false;
      syncSave();
    } catch (err) {
      if (mine !== run) return;
      busy = false;
      find.disabled = false;
      status.textContent = describeError(err);
      status.classList.add('error');
    }
  }

  function saveChecked() {
    const chat = getChat();
    let count = 0;
    for (const li of rows()) {
      if (!li.querySelector('input[type=checkbox]').checked) continue;
      if (addMemory({ text: li.querySelector('textarea').value, scope: scope.value, source: 'claude', fromChat: chat?.id })) count += 1;
    }
    close();
    if (count) showToast({ text: `기억 ${count}개를 저장했어요`, ms: 2500 });
  }

  function close() {
    panel.hidden = true;
    reset();
  }

  function togglePanel() {
    if (!panel.hidden) {
      close();
      return;
    }
    nav.closePanel();
    reset();
    panel.hidden = false;
  }

  function refresh() {
    toggle.hidden = !(getChat()?.history.length > 0);
    if (toggle.hidden && !panel.hidden) close();
  }

  nav.addTool({ buttons: [toggle], panel, close });
  new MutationObserver(refresh).observe(container, { childList: true, subtree: true });
  refresh();
}
