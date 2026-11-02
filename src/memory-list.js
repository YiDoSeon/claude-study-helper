// 설정 화면의 「메모리」 칸: 기억한 사실 목록 (글 고치기, 적용 범위, 지우기) 과 직접 추가하기.
import { $, h } from './dom.js';
import { onChange } from './store.js';
import { tapConfirm } from './tap-confirm.js';
import { listMemories, addMemory, updateMemory, deleteMemory, MEMORY_SCOPES, MEMORY_PROMPT_LIMIT } from './memory.js';

const SOURCE_LABEL = { user: '직접 적음', claude: 'Claude 가 찾음' };

function scopeSelect(value) {
  const select = h('select', { 'aria-label': '적용 범위' });
  for (const s of MEMORY_SCOPES) select.append(h('option', { value: s.value, selected: s.value === value }, s.label));
  return select;
}

function memoryRow(item) {
  const text = h('textarea', { rows: 2, class: 'memory-text', 'aria-label': '기억한 글' });
  text.value = item.text;
  // 글은 칸을 떠날 때 저장한다. 비우면 지운다.
  text.addEventListener('change', () => updateMemory(item, { text: text.value }));
  const scope = scopeSelect(item.scope);
  scope.addEventListener('change', () => updateMemory(item, { scope: scope.value }));
  const del = h('button', { type: 'button', 'data-memory': 'delete' }, '삭제');
  tapConfirm(del, { confirmLabel: '한 번 더 누르면 삭제', onConfirm: () => deleteMemory(item.id) });
  return h(
    'li',
    { class: 'memory-row', 'data-id': item.id },
    text,
    h('div', { class: 'memory-row-bar' }, scope, h('span', { class: 'muted small' }, SOURCE_LABEL[item.source] ?? ''), del),
  );
}

export function renderMemoryList() {
  const items = listMemories();
  // 글을 고치는 중이면 다시 그리지 않는다 (다른 기기에서 온 변경은 칸을 떠난 뒤 반영된다).
  if ($('#memory-list').contains(document.activeElement)) return;
  $('#memory-list').replaceChildren(...items.map(memoryRow));
  $('#memory-empty').hidden = items.length > 0;
  const size = items.reduce((n, m) => n + m.text.length, 0);
  $('#memory-size').textContent = items.length ? `${items.length}개 · ${size.toLocaleString('en-US')}자${size > MEMORY_PROMPT_LIMIT ? ` (프롬프트에는 최근 것부터 약 ${MEMORY_PROMPT_LIMIT.toLocaleString('en-US')}자까지만 넣어요)` : ''}` : '';
}

export function initMemoryList() {
  $('#memory-add').addEventListener('submit', (event) => {
    event.preventDefault();
    if (addMemory({ text: $('#memory-input').value, scope: $('#memory-scope').value, source: 'user' })) $('#memory-input').value = '';
  });
  const scope = $('#memory-scope');
  for (const s of MEMORY_SCOPES) scope.append(h('option', { value: s.value }, s.label));
  onChange(renderMemoryList);
  renderMemoryList();
}
