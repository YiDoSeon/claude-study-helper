// 학습 기록을 기기에 읽고 쓰기. IndexedDB 에 두고, 열 수 없으면 localStorage 에 JSON 으로 둔다.
const DB_NAME = 'study';
const STORE = 'data';
const RECORD_KEY = 'v1';
const LEGACY_KEY = 'study.data.v1';

const errorListeners = new Set();
let dbPromise = null;
// 연 결과. 아직 모르면 undefined, 열 수 없으면 null.
let dbState;
let persistRequested = false;

// 쓰기 결과를 알린다. 실패면 오류 객체, 성공이면 null.
export function onSaveError(fn) {
  errorListeners.add(fn);
  return () => errorListeners.delete(fn);
}

function report(err) {
  for (const fn of errorListeners) fn(err);
}

// 브라우저가 저장소를 지우지 않게 한 번 요청한다. 결과는 쓰지 않는다.
function requestPersistOnce() {
  if (persistRequested) return;
  persistRequested = true;
  try {
    Promise.resolve(navigator.storage?.persist?.()).catch(() => {});
  } catch {
    // 지원하지 않으면 넘어간다.
  }
}

// 열 수 없으면 null. 한 번 연 연결을 계속 쓴다.
function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((done) => {
      const resolve = (db) => {
        dbState = db;
        done(db);
      };
      try {
        if (typeof indexedDB === 'undefined' || !indexedDB) return resolve(null);
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
          if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
        };
        req.onsuccess = () => {
          const db = req.result;
          db.onversionchange = () => {
            db.close();
            dbPromise = null;
            dbState = undefined;
          };
          resolve(db);
        };
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }
  return dbPromise;
}

function idbGet(db) {
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(RECORD_KEY);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// 트랜잭션이 끝나야 저장된 것으로 본다.
function idbPut(db, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('저장이 취소됐어요'));
    tx.objectStore(STORE).put(value, RECORD_KEY);
  });
}

function readLegacy() {
  try {
    const text = localStorage.getItem(LEGACY_KEY);
    return text ? JSON.parse(text) : undefined;
  } catch {
    return undefined;
  }
}

// 저장된 기록을 돌려준다. 없으면 undefined.
export async function loadStoredData() {
  requestPersistOnce();
  const db = await openDb();
  if (!db) return readLegacy();
  let stored;
  try {
    stored = await idbGet(db);
  } catch {
    return readLegacy();
  }
  if (stored !== undefined) return stored;
  // IndexedDB 가 비어 있고 localStorage 에 이전 기록이 있으면 옮긴다. 쓰기가 성공한 뒤에만 지운다.
  const legacy = readLegacy();
  if (legacy === undefined) return undefined;
  try {
    await idbPut(db, legacy);
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // 옮기지 못했으면 localStorage 의 기록을 남겨 다음 시작에 다시 옮긴다.
  }
  return legacy;
}

async function writeOnce(data) {
  const db = await openDb();
  if (db) await idbPut(db, data);
  else localStorage.setItem(LEGACY_KEY, JSON.stringify(data));
}

function writeLegacy(data) {
  try {
    localStorage.setItem(LEGACY_KEY, JSON.stringify(data));
    report(null);
  } catch (err) {
    report(err);
  }
}

let pending = null;
let writing = false;

// 쓰는 중에 요청이 오면 끝난 뒤 가장 최근 data 로 한 번만 더 쓴다.
async function flush() {
  if (writing) return;
  writing = true;
  while (pending) {
    const next = pending;
    pending = null;
    try {
      await writeOnce(next.data);
      report(null);
    } catch (err) {
      report(err);
    }
  }
  writing = false;
}

export function saveStoredData(data) {
  // IndexedDB 를 쓸 수 없다고 이미 알면 기다리지 않고 바로 쓴다.
  if (dbState === null) {
    writeLegacy(data);
    return Promise.resolve();
  }
  pending = { data };
  return flush();
}
