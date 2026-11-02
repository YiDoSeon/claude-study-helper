// fork 로 만든 대화의 표시: 원래 대화로 가는 줄과 접힌 「이전 대화 요약」 블록. 묻기 화면과 기록 상세가 같이 쓴다.
import { h } from './dom.js';
import { renderMarkdown } from './markdown.js';
import { get } from './store.js';
import { rangeLabel } from './chat-fork.js';

// 가져간 것을 적는 말: 「질문 2만」, 「질문 1~3 요약」, 「질문 1~3」.
function forkWhat(f) {
  if (f.single) return `질문 ${f.index + 1}만`;
  return f.summarized ? `${rangeLabel(f.index)} 요약` : rangeLabel(f.index);
}

// saved.forkOf 가 없으면 null. onOpen(id) 는 「원래 대화 보기」 를 누르면 부른다.
// 원래 대화가 지워졌으면 버튼 대신 안내 글을 둔다.
export function forkOriginLine(saved, onOpen) {
  const f = saved.forkOf;
  if (!f) return null;
  const open = get('chats', f.id)
    ? h('button', { type: 'button', class: 'fork-origin-open', 'data-fork': 'origin', onclick: () => onOpen(f.id) }, '원래 대화 보기')
    : h('span', {}, '(원래 대화는 지워졌어요)');
  return h('p', { class: 'fork-origin muted small' }, `「${f.title}」 에서 fork · ${forkWhat(f)} `, open);
}

// saved.summary 가 없으면 null.
export function summaryBlock(saved) {
  if (!saved.summary) return null;
  const body = h('div', { class: 'md' });
  renderMarkdown(body, saved.summary);
  return h('details', { class: 'chat-context chat-summary' }, h('summary', {}, '이전 대화 요약'), body);
}
