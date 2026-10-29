// 모델이 쓴 Markdown 을 안전한 HTML 로 바꿔 넣는다.
import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({ gfm: true, breaks: true });

export function renderMarkdown(el, text) {
  el.innerHTML = DOMPurify.sanitize(marked.parse(text ?? ''));
}

export function renderCode(pre, code, language) {
  const codeEl = document.createElement('code');
  codeEl.textContent = code;
  if (language) pre.dataset.lang = language;
  pre.replaceChildren(codeEl);
  pre.hidden = !code;
}
