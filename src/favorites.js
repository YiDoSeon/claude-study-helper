// 즐겨찾기. stars 컬렉션에 `${kind}:${id}` 를 id 로 두어 records, chats 항목은 건드리지 않는다.
import { get, put } from './store.js';

export function starKey(kind, id) {
  return `${kind}:${id}`;
}

export function isStarred(kind, id) {
  return get('stars', starKey(kind, id))?.on === true;
}

// 끌 때도 지우지 않고 on: false 로 둔다 (mergeData 는 지운 것을 합칠 수 없다).
export function toggleStar(kind, id) {
  const on = !isStarred(kind, id);
  put('stars', { id: starKey(kind, id), on });
  return on;
}
