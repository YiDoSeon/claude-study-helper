// 이 앱에서 쓴 추정 금액. 기기마다 하루 한 항목으로 기록에 남겨 동기화하고,
// 동기화된 기기를 합쳐 이번 주기 사용액을 계산한다. 다른 앱에서 쓴 금액은 들어가지 않는다.
// 각 기기는 자기 항목만 고치므로 동기화로 합쳐도 서로 덮어쓰지 않는다.
import { getSetting, setSetting } from './settings.js';
import { put, get, list, newId } from './store.js';
import { onCost } from './api.js';

// usage 항목: { id: '기기 id:날짜', device, label: 기기 이름, day: 'YYYY-MM-DD' (그 기기의 현지 날짜), usd }

const pad = (n) => String(n).padStart(2, '0');
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function deviceId() {
  let id = getSetting('deviceId');
  if (!id) {
    id = newId();
    setSetting('deviceId', id);
  }
  return id;
}

function addCost(cost) {
  if (!(cost > 0)) return;
  const device = deviceId();
  const day = dayKey(new Date());
  const id = `${device}:${day}`;
  const label = getSetting('deviceName') || navigator.platform || '이름 없는 기기';
  put('usage', { id, device, label, day, usd: (get('usage', id)?.usd ?? 0) + cost });
}

// 이번 주기가 시작한 날 0시 (현지 시각). 기준일이 그달에 없으면 (31일 등) 그달 마지막 날로 한다.
export function cycleStart(now = new Date()) {
  const day = Math.min(Math.max(Number(getSetting('usageCycleDay')) || 1, 1), 31);
  const startOf = (y, m) => new Date(y, m, Math.min(day, new Date(y, m + 1, 0).getDate()));
  const thisMonth = startOf(now.getFullYear(), now.getMonth());
  return thisMonth <= now ? thisMonth : startOf(now.getFullYear(), now.getMonth() - 1);
}

// { start, total, devices: [{ label, usd, mine }] }. devices 는 금액이 큰 순서다.
export function usageSummary(now = new Date()) {
  const start = cycleStart(now);
  const startKey = dayKey(start);
  const mine = getSetting('deviceId');
  const byDevice = new Map();
  for (const u of list('usage')) {
    if (u.day < startKey) continue;
    const d = byDevice.get(u.device) ?? { label: u.label, day: u.day, usd: 0, mine: u.device === mine };
    d.usd += u.usd;
    // 기기 이름을 바꿨으면 가장 최근 항목의 이름을 쓴다.
    if (u.day >= d.day) Object.assign(d, { label: u.label, day: u.day });
    byDevice.set(u.device, d);
  }
  const devices = [...byDevice.values()].sort((a, b) => b.usd - a.usd);
  return { start, total: devices.reduce((sum, d) => sum + d.usd, 0), devices };
}

export function startUsageTracking() {
  onCost(addCost);
}
