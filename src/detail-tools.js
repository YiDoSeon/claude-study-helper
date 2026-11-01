// 기록 상세 화면 옆 도구: 즐겨찾기 토글, 「메모」 버튼과 메모 창.
// 「질문 목록」 과 같은 떠 있는 줄 (chat-nav.js 의 addTool) 에 들어가며, 메모 창은 상세 본문 밖에 있어 상세를 다시 그려도 그대로다.
import { h } from './dom.js';
import { isStarred, toggleStar, starKey } from './favorites.js';
import { getNote, saveNote } from './notes.js';

const SAVE_DELAY = 1000;

// nav 는 attachChatNav 가 돌려준 것이다. 돌려주는 setTarget({ kind, id } | null) 은 상세를 그리거나 다시 그릴 때마다 부른다.
export function initDetailTools(nav) {
  let target = null;
  let timer = null;
  let dirty = false;

  const star = h('button', {
    type: 'button',
    class: 'detail-tool detail-star',
    title: '즐겨찾기',
    'aria-pressed': 'false',
    onclick: () => {
      if (!target) return;
      toggleStar(target.kind, target.id);
      refresh();
    },
  }, '☆');
  const memo = h('button', { type: 'button', class: 'detail-tool detail-memo', onclick: toggleMemo }, '메모');
  const input = h('textarea', {
    class: 'note-input',
    rows: 5,
    placeholder: '이 항목에 남길 메모',
    'aria-label': '메모',
  });
  const panel = h(
    'div',
    { class: 'chat-nav-panel detail-memo-panel', hidden: true },
    h('p', { class: 'small' }, h('strong', {}, '메모')),
    input,
    h('div', { class: 'actions compact' }, h('button', { type: 'button', onclick: closeMemo }, '닫기')),
  );

  // 저장 안 된 글자가 있으면 지금 target 의 메모로 저장한다.
  function flush() {
    clearTimeout(timer);
    timer = null;
    if (!dirty) return;
    dirty = false;
    if (target) saveNote(target.kind, target.id, input.value);
  }

  input.addEventListener('input', () => {
    dirty = true;
    clearTimeout(timer);
    timer = setTimeout(flush, SAVE_DELAY);
  });
  input.addEventListener('blur', flush);

  function closeMemo() {
    flush();
    panel.hidden = true;
  }

  function toggleMemo() {
    if (!panel.hidden) {
      closeMemo();
      return;
    }
    nav.closePanel();
    if (!dirty) input.value = getNote(target.kind, target.id);
    panel.hidden = false;
    input.focus();
  }

  // 표시를 저장소 값에 맞춘다. 메모 글자는 포커스가 없고 저장 안 된 입력이 없을 때만 바꾼다 (다른 기기에서 온 변경).
  function refresh() {
    const on = isStarred(target.kind, target.id);
    star.textContent = on ? '★' : '☆';
    star.setAttribute('aria-pressed', on ? 'true' : 'false');
    const stored = getNote(target.kind, target.id);
    memo.textContent = stored ? '메모 ●' : '메모';
    memo.classList.toggle('has-note', stored !== '');
    if (!dirty && document.activeElement !== input && input.value.trim() !== stored.trim()) input.value = stored;
  }

  function setTarget(next) {
    if (next && target && starKey(next.kind, next.id) === starKey(target.kind, target.id)) {
      target = next;
      refresh();
      return;
    }
    // 다른 항목이나 목록으로 가면 이전 항목의 메모를 저장하고 창을 닫는다.
    flush();
    panel.hidden = true;
    target = next;
    star.hidden = memo.hidden = !next;
    if (!next) {
      input.value = '';
      return;
    }
    input.value = getNote(next.kind, next.id);
    refresh();
  }

  nav.addTool({ buttons: [star, memo], panel, close: closeMemo });
  star.hidden = memo.hidden = true;
  return { setTarget };
}
