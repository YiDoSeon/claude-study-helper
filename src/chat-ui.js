// 튜터 대화 말풍선. 「풀기」 의 더 물어보기와 「묻기」 화면이 같이 쓴다.
import { h } from './dom.js';
import { renderMarkdown } from './markdown.js';
import { MODELS } from './api.js';

export function appendBubble(log, role, text) {
  const body = h('div', { class: 'md' });
  if (role === 'user') body.textContent = text;
  else renderMarkdown(body, text);
  log.append(h('div', { class: `bubble ${role}` }, body));
  return body;
}

// run(onText) 은 스트리밍 요청을 보내고 최종 message 를 돌려준다.
// 받은 글을 화면 갱신 주기에 맞춰 body 에 그리고, { message, text } 를 돌려준다.
export async function streamInto(body, run) {
  let text = '';
  let frame = 0;
  try {
    const message = await run((delta) => {
      text += delta;
      if (!frame) {
        frame = requestAnimationFrame(() => {
          frame = 0;
          renderMarkdown(body, text);
        });
      }
    });
    cancelAnimationFrame(frame);
    renderMarkdown(body, text);
    return { message, text };
  } catch (err) {
    cancelAnimationFrame(frame);
    throw err;
  }
}

// 웹 검색 출처 링크 목록. sources 는 [{ url, title }] 이고, 없으면 null.
export function sourcesBlock(sources) {
  if (!sources?.length) return null;
  const links = sources.map(({ url, title }) =>
    h('li', {}, h('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, title)),
  );
  return h('div', { class: 'sources' }, h('p', { class: 'muted small' }, '출처'), h('ol', {}, links));
}

// 출처 목록을 말풍선 아래에 붙인다.
export function appendSources(body, sources) {
  const block = sourcesBlock(sources);
  if (block) body.parentElement.append(block);
}

// 답 하나의 모델, effort, 토큰, 추정 금액 한 줄. meta 는 streamChat 이 돌려준 것이고, 없으면 null.
// 입력은 캐시에서 읽은 토큰까지 더한 값이다. 출력에는 thinking 토큰이 들어 있다.
export function metaLine(meta) {
  if (!meta) return null;
  const n = (v) => v.toLocaleString('en-US');
  const input = meta.input + meta.cacheRead + meta.cacheWrite;
  const parts = [
    MODELS[meta.model]?.label ?? meta.model,
    `effort ${meta.effort}`,
    `입력 ${n(input)}${meta.cacheRead ? ` (캐시 ${n(meta.cacheRead)})` : ''}`,
    `출력 ${n(meta.output)}`,
    meta.searches ? `검색 ${meta.searches}회` : '',
    `약 $${meta.cost.toFixed(3)}`,
  ];
  return h('p', { class: 'answer-meta' }, parts.filter(Boolean).join(' · '));
}

export function appendMeta(body, meta) {
  const line = metaLine(meta);
  if (line) body.parentElement.append(line);
}

export function showBubbleError(body, message) {
  body.textContent = message;
  body.parentElement.classList.add('error');
}
