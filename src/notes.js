// 메모 저장소. notes 컬렉션에 `${kind}:${id}` 를 id 로 두어 records, chats 항목은 건드리지 않는다.
// 입력 창은 detail-tools.js 에 있다.
import { get, put } from './store.js';
import { starKey } from './favorites.js';

export function getNote(kind, id) {
  return get('notes', starKey(kind, id))?.text ?? '';
}

// 앞뒤 공백만 다르면 저장하지 않는다. 빈 글자는 메모가 없는 것으로 본다.
export function saveNote(kind, id, text) {
  const next = text.trim();
  if (next === getNote(kind, id).trim()) return;
  put('notes', { id: starKey(kind, id), text: next });
}
