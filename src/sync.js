// GitHub private 저장소의 JSON 파일 하나와 학습 기록을 맞춘다.
import { getData, onChange, replaceWithMerged } from './store.js';
import { getSetting, hasGithubSync } from './settings.js';

const API = 'https://api.github.com';
const PUSH_DELAY_MS = 4000;

let status = { state: 'off', message: '동기화 꺼짐' };
const statusListeners = new Set();
let pushTimer = null;
let running = null;

function setStatus(state, message) {
  status = { state, message, at: Date.now() };
  for (const fn of statusListeners) fn(status);
}

export function onStatus(fn) {
  statusListeners.add(fn);
  fn(status);
}

function headers() {
  return {
    Authorization: `Bearer ${getSetting('githubToken')}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

function contentsUrl() {
  const path = getSetting('githubPath').split('/').map(encodeURIComponent).join('/');
  return `${API}/repos/${getSetting('githubRepo')}/contents/${path}`;
}

function encodeBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

function decodeBase64(b64) {
  const bin = atob(b64.replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

class GithubError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function request(url, init = {}) {
  const res = await fetch(url, { ...init, headers: { ...headers(), ...init.headers }, cache: 'no-store' });
  if (!res.ok) {
    let detail = '';
    try {
      detail = (await res.json()).message ?? '';
    } catch {
      // 본문이 JSON 이 아니면 상태 코드만 쓴다.
    }
    throw new GithubError(res.status, detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// 파일이 없으면 { sha: null, data: null }.
async function fetchRemote() {
  let meta;
  try {
    meta = await request(contentsUrl());
  } catch (err) {
    if (err instanceof GithubError && err.status === 404) return { sha: null, data: null };
    throw err;
  }
  // 1MB 를 넘는 파일은 contents 응답에 본문이 비어 있어 blob API 로 받는다.
  let b64 = meta.content;
  if (!b64 || meta.encoding !== 'base64') {
    const blob = await request(`${API}/repos/${getSetting('githubRepo')}/git/blobs/${meta.sha}`);
    b64 = blob.content;
  }
  return { sha: meta.sha, data: JSON.parse(decodeBase64(b64)) };
}

async function pushRemote(sha) {
  const body = {
    message: `학습 기록 동기화 (${getSetting('deviceName') || navigator.platform || 'device'})`,
    content: encodeBase64(JSON.stringify(getData())),
  };
  if (sha) body.sha = sha;
  await request(contentsUrl(), { method: 'PUT', body: JSON.stringify(body) });
}

async function syncOnce() {
  const remote = await fetchRemote();
  if (remote.data) replaceWithMerged(remote.data);
  const same = remote.data && JSON.stringify(remote.data) === JSON.stringify(getData());
  if (!same) await pushRemote(remote.sha);
}

export function syncNow() {
  if (!hasGithubSync()) {
    setStatus('off', '동기화 꺼짐');
    return Promise.resolve();
  }
  if (running) return running;
  clearTimeout(pushTimer);
  setStatus('busy', '동기화 중…');
  running = (async () => {
    try {
      try {
        await syncOnce();
      } catch (err) {
        // 다른 기기가 먼저 올려 sha 가 바뀌었으면 다시 받아 합친다.
        if (err instanceof GithubError && (err.status === 409 || err.status === 422)) await syncOnce();
        else throw err;
      }
      setStatus('ok', '동기화됨');
    } catch (err) {
      const hint =
        err instanceof GithubError && err.status === 401 ? 'GitHub 토큰을 확인하세요'
        : err instanceof GithubError && err.status === 404 ? '저장소 이름이나 토큰 권한을 확인하세요'
        : err.message;
      setStatus('error', `동기화 실패: ${hint}`);
    } finally {
      running = null;
    }
  })();
  return running;
}

export function startAutoSync() {
  onChange((source) => {
    if (source !== 'local' || !hasGithubSync()) return;
    setStatus('pending', '올릴 기록 있음');
    clearTimeout(pushTimer);
    pushTimer = setTimeout(syncNow, PUSH_DELAY_MS);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && status.state === 'pending') syncNow();
    if (document.visibilityState === 'visible') syncNow();
  });
  syncNow();
}
