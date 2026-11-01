// GitHub private 저장소의 폴더와 학습 기록을 맞춘다. 기록을 여러 파일로 나눠 (sync-layout.js) 바뀐 파일만 커밋 하나로 올린다.
import { getData, onChange, replaceWithMerged } from './store.js';
import { getSetting, hasGithubSync } from './settings.js';
import { folderOf, isSyncFile, partitionData } from './sync-layout.js';

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

const SHAS_KEY = 'study.sync.shas';
const FILE_MODE = '100644';
let branchCache = null; // { repo, branch }

function repoUrl(suffix = '') {
  return `${API}/repos/${getSetting('githubRepo')}${suffix}`;
}

function refUrl(branch) {
  return repoUrl(`/git/ref/heads/${branch.split('/').map(encodeURIComponent).join('/')}`);
}

function loadShas() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SHAS_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveShas(shas) {
  try {
    localStorage.setItem(SHAS_KEY, JSON.stringify(shas));
  } catch {
    // 저장하지 못하면 다음 동기화가 파일을 더 받을 뿐이다.
  }
}

function localIsEmpty() {
  const data = getData();
  return Object.entries(data).every(([key, value]) => key === 'version' || Object.keys(value).length === 0);
}

// git blob sha: SHA-1("blob <바이트 수>\0" + 내용 바이트).
async function blobSha(text) {
  const body = new TextEncoder().encode(text);
  const head = new TextEncoder().encode(`blob ${body.length}\0`);
  const all = new Uint8Array(head.length + body.length);
  all.set(head);
  all.set(body, head.length);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-1', all));
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function defaultBranch() {
  const repo = getSetting('githubRepo');
  if (branchCache?.repo !== repo) branchCache = { repo, branch: (await request(repoUrl())).default_branch };
  return branchCache.branch;
}

// 빈 저장소는 ref 가 없어 (409) contents API 로 첫 파일을 만들어야 git 데이터 API 를 쓸 수 있다.
async function createFirstFile(folder) {
  const path = `${folder}/README.md`.split('/').map(encodeURIComponent).join('/');
  await request(repoUrl(`/contents/${path}`), {
    method: 'PUT',
    body: JSON.stringify({ message: '학습 기록 폴더 만들기', content: encodeBase64('학습 기록 동기화 폴더입니다.\n') }),
  });
}

async function fetchHead(branch, folder) {
  try {
    return (await request(refUrl(branch))).object.sha;
  } catch (err) {
    if (!(err instanceof GithubError && err.status === 409)) throw err;
  }
  await createFirstFile(folder);
  return (await request(refUrl(branch))).object.sha;
}

async function fetchBlobJson(sha) {
  return JSON.parse(decodeBase64((await request(repoUrl(`/git/blobs/${sha}`))).content));
}

async function syncOnce() {
  const legacyPath = getSetting('githubPath');
  const folder = folderOf(legacyPath);
  const branch = await defaultBranch();
  const head = await fetchHead(branch, folder);
  const commit = await request(repoUrl(`/git/commits/${head}`));
  const treeSha = commit.tree.sha;
  const tree = await request(repoUrl(`/git/trees/${treeSha}?recursive=1`));
  if (tree.truncated) throw new Error('저장소 파일 목록이 너무 커서 받지 못했습니다');

  const remote = new Map(); // 폴더 안 데이터 파일: 경로 → blob sha
  let legacySha = null;
  for (const e of tree.tree) {
    if (e.type !== 'blob') continue;
    if (e.path === legacyPath) legacySha = e.sha;
    else if (isSyncFile(e.path, folder)) remote.set(e.path, e.sha);
  }

  // 받기: 마지막으로 맞춘 sha 와 다른 파일만. 로컬이 비어 있으면 전부.
  const known = localIsEmpty() ? {} : loadShas();
  const fetched = new Set();
  const receive = async (path, sha) => {
    fetched.add(path);
    replaceWithMerged(await fetchBlobJson(sha));
  };
  if (legacySha) replaceWithMerged(await fetchBlobJson(legacySha));
  for (const [path, sha] of remote) {
    if (known[path] !== sha) await receive(path, sha);
  }

  // 올릴 파일: 원격과 sha 가 다른 파일. 원격에 있는 파일은 먼저 받아 합친 뒤 내용을 다시 만든다.
  const uploads = new Map();
  const shaOf = new Map();
  for (;;) {
    uploads.clear();
    const unmerged = [];
    for (const [path, content] of partitionData(getData(), folder)) {
      const sha = await blobSha(content);
      shaOf.set(path, sha);
      if (remote.get(path) === sha) continue;
      uploads.set(path, content);
      if (remote.has(path) && !fetched.has(path)) unmerged.push(path);
    }
    if (!unmerged.length) break;
    for (const path of unmerged) await receive(path, remote.get(path));
  }

  const entries = [...uploads].map(([path, content]) => ({ path, mode: FILE_MODE, type: 'blob', content }));
  if (legacySha) entries.push({ path: legacyPath, mode: FILE_MODE, type: 'blob', sha: null });

  const next = Object.fromEntries(remote);
  if (entries.length) {
    const newTree = await request(repoUrl('/git/trees'), {
      method: 'POST',
      body: JSON.stringify({ base_tree: treeSha, tree: entries }),
    });
    const newCommit = await request(repoUrl('/git/commits'), {
      method: 'POST',
      body: JSON.stringify({
        message: `학습 기록 동기화 (${getSetting('deviceName') || navigator.platform || 'device'})`,
        tree: newTree.sha,
        parents: [head],
      }),
    });
    await request(repoUrl(`/git/refs/heads/${branch.split('/').map(encodeURIComponent).join('/')}`), {
      method: 'PATCH',
      body: JSON.stringify({ sha: newCommit.sha, force: false }),
    });
    for (const path of uploads.keys()) next[path] = shaOf.get(path);
  }
  saveShas(next);
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
        // 다른 기기가 먼저 올려 head 가 바뀌었으면 (ref 갱신 422) 처음부터 다시 받아 합친다.
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
