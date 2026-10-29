// 학습 기록. 브라우저에 저장하고, sync.js 가 GitHub 저장소와 합친다.
// 모든 항목은 id 로 구분하고 updatedAt 이 더 큰 쪽이 이긴다.
const KEY = 'study.data.v1';
const COLLECTIONS = ['records', 'reviews', 'topics', 'chats'];

function emptyData() {
  return { version: 1, records: {}, reviews: {}, topics: {}, chats: {} };
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

let data = load();
const listeners = new Set();

function load() {
  try {
    return normalize(JSON.parse(localStorage.getItem(KEY)));
  } catch {
    return emptyData();
  }
}

function persist(source) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // 저장 실패 시에도 메모리의 data 는 유지된다.
  }
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

export function list(collection) {
  return Object.values(data[collection]);
}

export function get(collection, id) {
  return data[collection][id];
}

export function mergeData(a, b) {
  const left = normalize(a);
  const right = normalize(b);
  const out = emptyData();
  for (const c of COLLECTIONS) {
    out[c] = { ...left[c] };
    for (const [id, item] of Object.entries(right[c])) {
      const mine = out[c][id];
      if (!mine || (item.updatedAt ?? 0) > (mine.updatedAt ?? 0)) out[c][id] = item;
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
