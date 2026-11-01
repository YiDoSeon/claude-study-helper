// 학습 기록을 동기화 파일로 나누고, 파일 경로와 내용을 만든다 (DOM 과 네트워크를 쓰지 않는다).
// 파일 내용은 부분 데이터 객체 { version: 1, <컬렉션>: { id: 항목 } } 이라 mergeData 로 그대로 합칠 수 있다.

import { COLLECTIONS } from './store.js';

// 달마다 나누는 컬렉션. 나머지 컬렉션은 <폴더>/<컬렉션>.json 하나에 둔다.
const MONTHLY = ['chats', 'records', 'reviews'];

const MIN_TIME = Date.UTC(2020, 0, 1);
const MAX_AHEAD_MS = 86400000;

// 설정 githubPath 에서 끝의 .json 을 뗀 폴더 경로.
export function folderOf(githubPath) {
  return githubPath.replace(/\.json$/i, '').replace(/\/+$/, '');
}

// newId() 꼴 id (`시각(36진수)-무작위`) 의 시각으로 UTC 기준 'YYYY-MM' 을 만든다. 그럴듯한 시각이 아니면 'etc'.
export function monthOfId(id, now = Date.now()) {
  const m = /^([0-9a-z]+)-/.exec(String(id));
  if (!m) return 'etc';
  const ms = parseInt(m[1], 36);
  if (!Number.isFinite(ms) || ms < MIN_TIME || ms > now + MAX_AHEAD_MS) return 'etc';
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// 파일 하나의 내용. 항목은 id 순으로 정렬하고 항목마다 한 줄로 쓴다.
// 꼴: {"version":1,"chats":{\n"id1":{...},\n"id2":{...}\n}}
function serialize(collection, items) {
  const ids = Object.keys(items).sort();
  const lines = ids.map((id) => `${JSON.stringify(id)}:${JSON.stringify(items[id])}`);
  return `{"version":1,${JSON.stringify(collection)}:{\n${lines.join(',\n')}\n}}`;
}

// data 를 { 경로 → 내용 } 으로 나눈다. 항목이 없는 파일은 만들지 않는다.
export function partitionData(data, folder, now = Date.now()) {
  const files = new Map();
  for (const collection of COLLECTIONS) {
    const items = data[collection];
    if (!items) continue;
    const groups = new Map();
    for (const [id, item] of Object.entries(items)) {
      const path = MONTHLY.includes(collection)
        ? `${folder}/${collection}/${monthOfId(id, now)}.json`
        : `${folder}/${collection}.json`;
      if (!groups.has(path)) groups.set(path, {});
      groups.get(path)[id] = item;
    }
    for (const path of [...groups.keys()].sort()) files.set(path, serialize(collection, groups.get(path)));
  }
  return files;
}

// 폴더 안의 동기화 데이터 파일 (.json) 인지.
export function isSyncFile(path, folder) {
  return path.startsWith(`${folder}/`) && path.endsWith('.json');
}
