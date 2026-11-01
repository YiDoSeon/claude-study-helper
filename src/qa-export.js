// 질의응답을 Markdown 글로 만들어 복사하거나 .md 파일로 저장한다.
// 질문과 답 한 쌍마다 붙는 버튼 줄과, 대화에서 고른 질문들을 묶어 내보내는 창이 있다.
// 글은 저장된 질문·답 원문 (모델이 쓴 Markdown) 그대로 넣는다. 화면 DOM 에서 긁어 오지 않는다.
import { h } from './dom.js';
import { showToast } from './toast.js';

const TITLE_LENGTH = 60;
const FILE_TITLE_LENGTH = 40;

// ── 글 만들기 ──

// 기기 현지 날짜 'YYYY-MM-DD'.
export function dateStamp(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

// 링크 글자 안의 대괄호는 링크가 끊기지 않게 이스케이프한다.
const linkText = (title) => String(title).replace(/[[\]]/g, '\\$&');

// pair 는 { q, a, sources? } 이다. 출처가 있으면 끝에 「### 출처」 목록을 붙인다.
export function pairMarkdown(pair) {
  const parts = [`## 질문\n${pair.q}`, `## 답\n${pair.a}`];
  if (pair.sources?.length) {
    parts.push(`### 출처\n${pair.sources.map(({ url, title }) => `- [${linkText(title || url)}](${url})`).join('\n')}`);
  }
  return parts.join('\n\n');
}

// 쌍 하나: 대화 제목 줄 + 그 쌍.
export function singleMarkdown(conv, pair) {
  return `# ${conv.title}\n\n${pairMarkdown(pair)}\n`;
}

// 여러 쌍: 제목, 내보낸 날짜, (문제 맥락), 쌍들을 --- 로 나눠 차례로.
export function bundleMarkdown(conv, pairs, now = new Date()) {
  const head = [`# ${conv.title}`, `내보낸 날짜: ${dateStamp(now)}`];
  if (conv.context) head.push(`## 문제 맥락\n${conv.context}`);
  return `${head.join('\n\n')}\n\n${pairs.map(pairMarkdown).join('\n\n---\n\n')}\n`;
}

// 대화 제목에서 파일 이름에 못 쓰는 글자를 빼고 40자로 자른 뒤 -날짜.md 를 붙인다.
export function fileName(title, now = new Date()) {
  const base = String(title).replace(/[\\/:*?"<>|\r\n]/g, '').slice(0, FILE_TITLE_LENGTH).trim() || '질문과 답';
  return `${base}-${dateStamp(now)}.md`;
}

// ── 복사와 저장 ──

function copyWithTextarea(text) {
  const area = h('textarea', { 'aria-hidden': 'true', readonly: true, style: 'position:fixed;top:0;left:0;opacity:0' });
  area.value = text;
  document.body.append(area);
  area.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    area.remove();
  }
}

// 클립보드에 넣는다. navigator.clipboard 가 없거나 실패하면 숨긴 textarea 로 복사한다. 성공 여부를 돌려준다.
export async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // 권한이 없으면 아래 방법으로 다시 시도한다.
    }
  }
  return copyWithTextarea(text);
}

export async function copyWithToast(text) {
  const ok = await copyText(text);
  showToast({ text: ok ? '복사했어요' : '복사하지 못했어요', ms: 2000 });
}

export function downloadMarkdown(name, text) {
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ── 쌍마다 붙는 버튼 줄 ──

// conv 는 { title, context? } 이다 (답을 그릴 때의 값을 쥐고 있는다).
export function pairActions(conv, pair) {
  return h(
    'div',
    { class: 'qa-actions' },
    h('button', { type: 'button', 'data-qa': 'copy', onclick: () => copyWithToast(singleMarkdown(conv, pair)) }, '복사'),
    h('button', { type: 'button', 'data-qa': 'save', onclick: () => downloadMarkdown(fileName(conv.title), singleMarkdown(conv, pair)) }, '저장'),
  );
}

// 질문 쪽 버튼 줄. 답 쪽과 같은 글을 복사·저장한다. 질문 목록이 질문 제목을 읽을 때 섞이지 않게 클래스를 나눈다.
export function questionActions(conv, pair) {
  const row = pairActions(conv, pair);
  row.classList.add('qa-q-actions');
  return row;
}

// 질문 요소 (질문 말풍선이나 기록 상세의 .qa-q) 끝에 질문 쪽 버튼 줄을 붙인다.
export function appendQuestionActions(questionEl, conv, pair) {
  questionEl.append(questionActions(conv, pair));
}

// 답 말풍선 (body 의 부모) 끝에 버튼 줄을 붙이고, 바로 앞의 질문 말풍선에도 붙인다. 출처와 모델 한 줄 뒤에 부른다.
export function appendPairActions(body, conv, pair) {
  const bubble = body.parentElement;
  bubble.append(pairActions(conv, pair));
  const question = bubble.previousElementSibling;
  if (question?.matches('.bubble.user')) appendQuestionActions(question, conv, pair);
}

// ── 내보내기 창 ──

function firstLine(text) {
  const flat = String(text).split('\n')[0].replace(/\s+/g, ' ').trim();
  return flat.length > TITLE_LENGTH ? `${flat.slice(0, TITLE_LENGTH)}…` : flat;
}

// nav 는 attachChatNav 가 돌려준 것이고, container 는 질문들이 그려지는 곳이다.
// getConv() 는 지금 대화 { title, context?, pairs: [{ q, a, sources? }] } 를 주고, 대화가 없으면 null 을 준다.
// 질문이 없으면 내보내기 버튼을 숨긴다. 창을 열 때마다 지금의 쌍으로 목록을 다시 만든다.
export function attachExport(nav, container, getConv) {
  let conv = null;
  const list = h('ul', { class: 'export-list' });
  const copy = h('button', { type: 'button', 'data-export': 'copy', onclick: () => run('copy') }, '복사');
  const save = h('button', { type: 'button', 'data-export': 'save', onclick: () => run('save') }, '저장');
  const panel = h(
    'div',
    { class: 'chat-nav-panel export-panel', hidden: true },
    h('p', { class: 'small' }, h('strong', {}, '내보내기')),
    list,
    h(
      'div',
      { class: 'actions compact' },
      h('button', { type: 'button', 'data-export': 'all', onclick: () => setAll(true) }, '전체 선택'),
      h('button', { type: 'button', 'data-export': 'none', onclick: () => setAll(false) }, '전체 해제'),
    ),
    h('div', { class: 'actions compact' }, copy, save, h('button', { type: 'button', onclick: close }, '닫기')),
  );
  const toggle = h('button', { type: 'button', class: 'detail-tool export-toggle', hidden: true, onclick: togglePanel }, '내보내기');

  const boxes = () => [...list.querySelectorAll('input')];
  function selected() {
    return conv ? conv.pairs.filter((_, i) => boxes()[i]?.checked) : [];
  }
  function syncButtons() {
    const none = selected().length === 0;
    copy.disabled = none;
    save.disabled = none;
  }
  function setAll(on) {
    for (const box of boxes()) box.checked = on;
    syncButtons();
  }
  function run(kind) {
    const pairs = selected();
    if (!conv || pairs.length === 0) return;
    const text = bundleMarkdown(conv, pairs);
    if (kind === 'copy') copyWithToast(text);
    else downloadMarkdown(fileName(conv.title), text);
  }
  function close() {
    panel.hidden = true;
  }
  function togglePanel() {
    if (!panel.hidden) {
      close();
      return;
    }
    nav.closePanel();
    conv = getConv();
    if (!conv?.pairs.length) return;
    list.replaceChildren(
      ...conv.pairs.map((pair) => {
        const box = h('input', { type: 'checkbox', checked: true });
        box.addEventListener('change', syncButtons);
        return h('li', {}, h('label', {}, box, firstLine(pair.q)));
      }),
    );
    syncButtons();
    panel.hidden = false;
  }
  function refresh() {
    toggle.hidden = !(getConv()?.pairs.length > 0);
    if (toggle.hidden) close();
  }

  nav.addTool({ buttons: [toggle], panel, close });
  new MutationObserver(refresh).observe(container, { childList: true, subtree: true });
  refresh();
}
