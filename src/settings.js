// 기기마다 브라우저에만 저장하는 키와 설정. 동기화 대상이 아니다.
const PREFIX = 'study.settings.';

const DEFAULTS = {
  anthropicKey: '',
  model: 'claude-opus-5-5',
  githubToken: '',
  githubRepo: '',
  githubPath: 'study-data.json',
  deviceName: '',
  deviceId: '', // 사용액 기록에서 기기를 구분하는 id. usage.js 가 처음 쓸 때 만든다.
  usageCycleDay: '11', // 사용액을 새로 세기 시작하는 날 (API 크레딧이 채워지는 날)
};

function read(name) {
  try {
    return localStorage.getItem(PREFIX + name);
  } catch {
    return null;
  }
}

function write(name, value) {
  try {
    if (value === '' || value == null) localStorage.removeItem(PREFIX + name);
    else localStorage.setItem(PREFIX + name, value);
  } catch {
    // 저장소를 쓸 수 없는 환경(시크릿 창 등)에서는 이번 세션에만 유지된다.
  }
}

export function getSetting(name) {
  return read(name) ?? DEFAULTS[name];
}

export function setSetting(name, value) {
  write(name, value);
}

export function hasAnthropicKey() {
  return getSetting('anthropicKey') !== '';
}

export function hasGithubSync() {
  return getSetting('githubToken') !== '' && /^[\w.-]+\/[\w.-]+$/.test(getSetting('githubRepo'));
}

// 다른 기기로 키를 옮기는 링크. 키는 URL fragment(#)에 담아 서버로 전송되지 않게 한다.
const SETUP_FIELDS = ['anthropicKey', 'githubToken', 'githubRepo', 'githubPath', 'usageCycleDay'];

function toBase64Url(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text) {
  const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export function buildSetupLink() {
  const payload = {};
  for (const f of SETUP_FIELDS) payload[f] = getSetting(f);
  const base = location.href.split('#')[0];
  return `${base}#setup=${toBase64Url(JSON.stringify(payload))}`;
}

// 시작할 때 #setup= 이 있으면 설정에 저장하고 주소창과 방문 기록에서 지운다.
export function importSetupFromHash() {
  const match = location.hash.match(/^#setup=([\w-]+)$/);
  if (!match) return false;
  try {
    const payload = JSON.parse(fromBase64Url(match[1]));
    for (const f of SETUP_FIELDS) {
      if (typeof payload[f] === 'string') setSetting(f, payload[f]);
    }
    return true;
  } catch {
    return false;
  } finally {
    history.replaceState(null, '', location.href.split('#')[0]);
  }
}
