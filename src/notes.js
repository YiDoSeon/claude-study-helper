// 메모. notes 컬렉션에 `${kind}:${id}` 를 id 로 두어 records, chats 항목은 건드리지 않는다.
// 상세 화면이 다시 그려져도 입력 중인 textarea 가 사라지지 않게, 같은 키의 편집기 요소를 다시 쓴다.
import { h } from './dom.js';
import { get, put } from './store.js';
import { starKey } from './favorites.js';

const SAVE_DELAY = 1000;

export function getNote(kind, id) {
  return get('notes', starKey(kind, id))?.text ?? '';
}

// 앞뒤 공백만 다르면 저장하지 않는다. 빈 글자는 메모가 없는 것으로 본다.
export function saveNote(kind, id, text) {
  const next = text.trim();
  if (next === getNote(kind, id).trim()) return;
  put('notes', { id: starKey(kind, id), text: next });
}

// 지금 화면에 올린 편집기 하나. { key, root, input, dirty }
let current = null;

export function noteEditor(kind, id) {
  const key = starKey(kind, id);
  if (current?.key === key) {
    // 포커스가 없고 저장 안 된 글자도 없을 때만 저장소의 글자로 바꾼다 (다른 기기에서 온 변경).
    const stored = getNote(kind, id);
    if (!current.dirty && document.activeElement !== current.input && current.input.value.trim() !== stored.trim()) {
      current.input.value = stored;
    }
    return current.root;
  }

  let timer = null;
  const state = { key, dirty: false };
  const flush = () => {
    clearTimeout(timer);
    timer = null;
    state.dirty = false;
    saveNote(kind, id, input.value);
  };
  const input = h('textarea', {
    class: 'note-input',
    rows: 3,
    placeholder: '이 항목에 남길 메모',
    'aria-label': '메모',
  });
  input.value = getNote(kind, id);
  input.addEventListener('input', () => {
    state.dirty = true;
    clearTimeout(timer);
    timer = setTimeout(flush, SAVE_DELAY);
  });
  input.addEventListener('blur', flush);
  state.input = input;
  state.root = h('div', { class: 'note-editor' }, h('h4', {}, '메모'), input);
  current = state;
  return state.root;
}

// nodes 를 container 에 넣는다. editor 가 이미 container 안에 있으면 떼지 않고 그 앞뒤만 바꾼다
// (떼면 textarea 의 포커스와 커서 위치가 사라진다).
export function mountKeepingEditor(container, nodes, editor) {
  const at = nodes.indexOf(editor);
  if (at < 0 || editor.parentNode !== container) {
    container.replaceChildren(...nodes);
    return;
  }
  for (const child of [...container.childNodes]) if (child !== editor) child.remove();
  editor.before(...nodes.slice(0, at));
  editor.after(...nodes.slice(at + 1));
}
