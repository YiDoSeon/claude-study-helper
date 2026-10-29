// 튜터 대화 말풍선. 「풀기」 의 더 물어보기와 「묻기」 화면이 같이 쓴다.
import { h } from './dom.js';
import { renderMarkdown } from './markdown.js';

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

export function showBubbleError(body, message) {
  body.textContent = message;
  body.parentElement.classList.add('error');
}
