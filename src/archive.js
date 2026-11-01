// 보관 표시. archive 컬렉션에 `${kind}:${id}` 를 id 로 두어 records, chats 항목은 건드리지 않는다.
// 보관은 기록 목록에서만 숨긴다. 정답률 표와 출제할 때 피할 개념에는 계속 쓰인다.
import { get, put } from './store.js';
import { starKey } from './favorites.js';

export function isArchived(kind, id) {
  return get('archive', starKey(kind, id))?.on === true;
}

// 끌 때도 지우지 않고 on: false 로 둔다 (mergeData 는 지운 것을 합칠 수 없다).
export function toggleArchive(kind, id) {
  const on = !isArchived(kind, id);
  put('archive', { id: starKey(kind, id), on });
  return on;
}
