// 기록 삭제 흐름: 화면에서 바로 숨기고 5초 알림을 띄운 뒤, 알림이 닫히면 store 에 삭제 표시를 저장한다.
// 저장된 삭제 표시는 합칠 때 항상 이기므로 되돌릴 수 없다. 그래서 저장을 알림이 닫힐 때까지 미룬다.
import { get, put, remove } from './store.js';
import { starKey } from './favorites.js';
import { showToast } from './toast.js';

const COLLECTION = { record: 'records', chat: 'chats' };
const UNDO_MS = 5000;

// 미뤄 둔 삭제: key(`${kind}:${id}`) → { kind, id, commit }
const pending = new Map();
const listeners = new Set();

// 삭제를 미뤄 두었거나 알림이 뜨거나 닫히면 부른다 (목록을 다시 그리는 데 쓴다).
export function onTrashChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// 삭제를 미뤄 둔 항목이면 true. 화면에서 숨길 때 쓴다.
export function isPendingDelete(kind, id) {
  return pending.has(starKey(kind, id));
}

// 그 항목의 즐겨찾기, 메모, 보관을 끈다. 켜진 것만 저장한다. usage, reviews, 연결된 대화는 건드리지 않는다.
function clearAttachments(kind, id) {
  const key = starKey(kind, id);
  if (get('stars', key)?.on) put('stars', { id: key, on: false });
  if (get('archive', key)?.on) put('archive', { id: key, on: false });
  if (get('notes', key)?.text) put('notes', { id: key, text: '' });
}

function commit(entry) {
  if (!pending.delete(starKey(entry.kind, entry.id))) return;
  clearAttachments(entry.kind, entry.id);
  remove(COLLECTION[entry.kind], entry.id);
}

// kind 는 'record' 또는 'chat'. 숨기고 알림을 띄운다. onHide 는 숨긴 직후, onUndo 는 「되돌리기」 를 누른 직후 부른다.
export function deleteItem(kind, id, { onHide = () => {}, onUndo = () => {} } = {}) {
  const key = starKey(kind, id);
  if (pending.has(key)) return;
  const entry = { kind, id };
  pending.set(key, entry);
  onHide();
  for (const fn of listeners) fn();
  showToast({
    text: '삭제했어요',
    action: {
      label: '되돌리기',
      onClick: () => {
        pending.delete(key);
        onUndo();
      },
    },
    ms: UNDO_MS,
    onClose: () => {
      commit(entry);
      for (const fn of listeners) fn();
    },
  });
}

// 페이지가 닫히거나 숨겨질 때 미뤄 둔 삭제를 바로 저장한다.
window.addEventListener('pagehide', () => {
  for (const entry of [...pending.values()]) commit(entry);
});
