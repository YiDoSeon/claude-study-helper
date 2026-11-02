// 메모리: 사용자에 대해 기억해 둔 사실의 저장과, 대화 프롬프트에 붙일 글.
// memories 컬렉션의 항목은 { id, text, scope: 'all' | 'talk', source: 'user' | 'claude', at, fromChat? } 이다.
// scope 'all' 은 「대화」 와 「묻기」, 'talk' 는 「대화」 에만 넣는다.
import { put, list, remove, newId } from './store.js';

export const MEMORY_SCOPES = [
  { value: 'all', label: '대화와 묻기' },
  { value: 'talk', label: '대화에만' },
];

// 프롬프트에 넣는 글의 최대 길이. 넘으면 오래된 항목부터 뺀다.
export const MEMORY_PROMPT_LIMIT = 4000;

// 오래된 것부터.
export function listMemories() {
  return list('memories').sort((a, b) => a.at - b.at);
}

export function addMemory({ text, scope = 'all', source = 'user', fromChat }) {
  const clean = text.trim();
  if (!clean) return null;
  return put('memories', { id: newId(), text: clean, scope, source, at: Date.now(), ...(fromChat && { fromChat }) });
}

// 글이나 적용 범위를 바꾼다. 글이 비면 지운다.
export function updateMemory(item, changes) {
  const next = { ...item, ...changes };
  if (!next.text.trim()) {
    remove('memories', item.id);
    return null;
  }
  return put('memories', { ...next, text: next.text.trim() });
}

export function deleteMemory(id) {
  remove('memories', id);
}

// where 는 'talk' (「대화」) 또는 'ask' (「묻기」). 넣을 항목이 없으면 빈 문자열.
export function memoryPrompt(where, items = listMemories()) {
  const picked = items.filter((m) => m.scope === 'all' || (where === 'talk' && m.scope === 'talk'));
  // 최근 것을 남기고, 넣을 때는 다시 오래된 순으로 둔다.
  const kept = [];
  let size = 0;
  for (const m of [...picked].reverse()) {
    size += m.text.length + 3;
    if (size > MEMORY_PROMPT_LIMIT) break;
    kept.unshift(m);
  }
  if (!kept.length) return '';
  return [
    '',
    '',
    '## 사용자에 대해 기억해 둔 것',
    '사용자가 저장해 둔 사실이다. 답에 도움이 될 때만 반영하고, 기억하고 있다는 말을 굳이 하지 않는다.',
    ...kept.map((m) => `- ${m.text}`),
  ].join('\n');
}
