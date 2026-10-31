// 「설정」 화면: API 키와 모델, 이번 주기 사용액, GitHub 동기화, 다른 기기로 옮기기, 백업.
import QRCode from 'qrcode';
import { $, h, fillSelect, formatDate } from '../dom.js';
import { getSetting, setSetting, buildSetupLink, hasGithubSync } from '../settings.js';
import { usageSummary } from '../usage.js';
import { MODELS, getCostTotal, resetCostTotal } from '../api.js';
import { getData, replaceWithMerged, onChange } from '../store.js';
import { syncNow, onStatus } from '../sync.js';

const FIELDS = [
  ['#set-key', 'anthropicKey'],
  ['#set-repo', 'githubRepo'],
  ['#set-token', 'githubToken'],
  ['#set-path', 'githubPath'],
  ['#set-device', 'deviceName'],
  ['#set-cycle-day', 'usageCycleDay'],
];
const SYNC_FIELDS = new Set(['githubRepo', 'githubToken', 'githubPath']);

export function renderSettingsView() {
  for (const [sel, name] of FIELDS) $(sel).value = getSetting(name);
  $('#set-model').value = getSetting('model');
  $('#set-cost').textContent = `$${getCostTotal().toFixed(3)}`;
  renderUsageLines();
}

const usd = (v) => `$${v.toFixed(2)}`;

function renderUsageLines() {
  const s = usageSummary();
  const lines = [
    `${formatDate(s.start.getTime()).split(' ')[0]} 부터 합계: ${usd(s.total)}`,
    ...s.devices.map((d) => `${d.label}${d.mine ? ' (이 기기)' : ''}: ${usd(d.usd)}`),
  ];
  if (!hasGithubSync()) lines.push('GitHub 동기화가 꺼져 있어서 이 기기에서 쓴 금액만 보여요.');
  $('#set-usage-lines').replaceChildren(...lines.map((t) => h('li', {}, t)));
}

function showQr() {
  if (!location.protocol.startsWith('http')) {
    $('#set-qr-note').textContent = '지금은 PC의 파일로 열려 있어서 폰에서 이 주소를 열 수 없어요. 올린 주소(https://…)로 열었을 때 QR 코드를 쓰세요.';
    $('#set-qr').hidden = false;
    $('#set-qr-canvas').hidden = true;
    return;
  }
  QRCode.toCanvas($('#set-qr-canvas'), buildSetupLink(), { width: 260, margin: 2 }, (err) => {
    $('#set-qr-note').textContent = err
      ? `QR 코드를 만들지 못했어요: ${err.message}`
      : '폰 카메라로 찍으면 이 기기의 API 키와 GitHub 설정이 그 폰에 저장돼요. 다른 사람에게 보이지 않게 하고, 다 쓰면 숨기세요.';
    $('#set-qr-canvas').hidden = !!err;
    $('#set-qr').hidden = false;
  });
}

function exportData() {
  const blob = new Blob([JSON.stringify(getData(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `study-data-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function importData(file) {
  try {
    const changed = replaceWithMerged(JSON.parse(await file.text()));
    alert(changed ? '기록을 합쳤어요.' : '새로 들어온 기록이 없어요.');
    syncNow();
  } catch (err) {
    alert(`불러오지 못했어요: ${err.message}`);
  }
}

export function initSettingsView({ onKeyChange, onUsageChange }) {
  fillSelect(
    $('#set-model'),
    Object.entries(MODELS).map(([id, m]) => ({ value: id, label: `${m.label} (입력 $${m.input} / 출력 $${m.output} per 1M)` })),
    getSetting('model'),
  );
  for (const [sel, name] of FIELDS) {
    $(sel).addEventListener('change', () => {
      setSetting(name, $(sel).value.trim());
      if (SYNC_FIELDS.has(name)) syncNow();
      if (name === 'usageCycleDay') {
        renderUsageLines();
        onUsageChange();
      }
      if (name === 'anthropicKey') onKeyChange();
    });
  }
  // 이 기기나 다른 기기의 사용액이 기록에 들어오면 다시 그린다.
  onChange(renderUsageLines);
  $('#set-model').addEventListener('change', () => setSetting('model', $('#set-model').value));
  $('#set-cost-reset').addEventListener('click', () => {
    resetCostTotal();
    renderSettingsView();
  });
  $('#set-sync').addEventListener('click', () => syncNow());
  onStatus((s) => {
    $('#set-sync-status').textContent = s.message;
  });
  $('#set-qr-show').addEventListener('click', showQr);
  $('#set-qr-hide').addEventListener('click', () => {
    $('#set-qr').hidden = true;
  });
  $('#set-export').addEventListener('click', exportData);
  $('#set-import').addEventListener('change', (event) => {
    const [file] = event.target.files;
    if (file) importData(file);
    event.target.value = '';
  });
}
