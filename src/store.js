// 학습 기록. data-storage.js 로 기기에 저장하고, sync.js 가 GitHub 저장소와 합친다.
// 모든 항목은 id 로 구분하고 updatedAt 이 더 큰 쪽이 이긴다. 단 삭제 표시 (deleted: true) 는 updatedAt 과 상관없이 이긴다.
import { loadStoredData, saveStoredData } from './data-storage.js';

const COLLECTIONS = ['records', 'reviews', 'topics', 'chats', 'usage', 'stars', 'notes', 'archive'];

function emptyData() {
  return { version: 1, records: {}, reviews: {}, topics: {}, chats: {}, usage: {}, stars: {}, notes: {}, archive: {} };
}

function normalize(raw) {
  const data = emptyData();
  if (raw && typeof raw === 'object') {
    for (const c of COLLECTIONS) {
      if (raw[c] && typeof raw[c] === 'object') data[c] = raw[c];
    }
  }
  return data;
}

let data = emptyData();
const listeners = new Set();

// 기기에 저장된 기록을 읽어 온다. 부르기 전에도 store 는 메모리에서 동작한다.
export async function initStore() {
  try {
    data = normalize(await loadStoredData());
  } catch {
    data = emptyData();
  }
}

function persist(source) {
  // 저장 실패는 data-storage.js 가 알린다. 메모리의 data 는 유지된다.
  saveStoredData(data);
  for (const fn of listeners) fn(source);
}

export function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getData() {
  return data;
}

export function put(collection, item) {
  data[collection][item.id] = { ...item, updatedAt: Date.now() };
  persist('local');
  return data[collection][item.id];
}

// 삭제 표시를 단 항목은 돌려주지 않는다. getData() 에는 남아 동기화와 내보내기에 쓰인다.
export function list(collection) {
  return Object.values(data[collection]).filter((item) => !item.deleted);
}

export function get(collection, id) {
  const item = data[collection][id];
  return item?.deleted ? undefined : item;
}

// 삭제: 항목을 빼면 다른 기기와 합칠 때 되살아나므로 내용 없는 삭제 표시로 바꾼다.
export function remove(collection, id) {
  data[collection][id] = { id, deleted: true, updatedAt: Date.now() };
  persist('local');
}

export function mergeData(a, b) {
  const left = normalize(a);
  const right = normalize(b);
  const out = emptyData();
  for (const c of COLLECTIONS) {
    out[c] = { ...left[c] };
    for (const [id, item] of Object.entries(right[c])) {
      const mine = out[c][id];
      // 한쪽이라도 삭제 표시면 삭제가 이긴다. 아니면 updatedAt 이 큰 쪽.
      if (!mine || (!mine.deleted && (item.deleted || (item.updatedAt ?? 0) > (mine.updatedAt ?? 0)))) out[c][id] = item;
    }
  }
  return out;
}

// 원격 데이터와 합친 결과를 반영한다. 바뀐 것이 있으면 true.
export function replaceWithMerged(remote) {
  const merged = mergeData(data, remote);
  const changed = JSON.stringify(merged) !== JSON.stringify(data);
  data = merged;
  if (changed) persist('sync');
  return changed;
}

export function replaceAll(raw) {
  data = normalize(raw);
  persist('local');
}
