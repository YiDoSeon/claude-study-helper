// 모델이 쓴 Markdown 을 안전한 HTML 로 바꿔 넣는다.
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { decorateCodeBlocks, decoratePre } from './code-block.js';
import { renderVisuals } from './visuals.js';
import { markdownSyntax } from './markdown-syntax.js';

marked.setOptions({ gfm: true, breaks: true });
marked.use(markdownSyntax);

// visuals 가 true 면 mermaid·svg·html 코드 블록을 그림으로 바꾼다. 스트리밍 중에는 false 로 둔다.
export function renderMarkdown(el, text, { visuals = false } = {}) {
  el.innerHTML = DOMPurify.sanitize(marked.parse(text ?? ''));
  decorateCodeBlocks(el);
  if (visuals) renderVisuals(el);
}

export function renderCode(pre, code, language) {
  const codeEl = document.createElement('code');
  codeEl.textContent = code;
  if (language) pre.dataset.lang = language;
  pre.replaceChildren(codeEl);
  pre.hidden = !code;
  // pre 는 ui.html 에 고정이라 처음 한 번만 감싸고, 숨김은 감싼 div 에도 맞춘다.
  decoratePre(pre).hidden = pre.hidden;
}
