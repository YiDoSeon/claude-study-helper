// 모델이 쓴 Markdown 을 안전한 HTML 로 바꿔 넣는다.
import { marked } from 'marked';
import DOMPurify from 'dompurify';

// CommonMark 규칙에서는 닫는 ** 앞이 문장 부호이고 뒤에 글자가 붙으면 굵게 처리되지 않는다
// (`**전처리(Preprocessing)**는`). 한국어는 조사가 바로 붙으므로, 한 줄 안에서 앞뒤가
// 공백이 아닌 **…** 와 *…* 는 둘레 글자와 상관없이 강조로 읽는다.
const emphasis = (name, marker, tag) => ({
  name,
  level: 'inline',
  start: (src) => src.indexOf(marker[0]),
  tokenizer(src) {
    const m = marker === '**'
      ? /^\*\*(?![\s*])((?:[^\n*]|\*(?!\*))+?)(?<!\s)\*\*(?!\*)/.exec(src)
      : /^\*(?![\s*])([^\n*]+?)(?<!\s)\*(?!\*)/.exec(src);
    if (!m) return undefined;
    return { type: name, raw: m[0], tokens: this.lexer.inlineTokens(m[1]) };
  },
  renderer(token) {
    return `<${tag}>${this.parser.parseInline(token.tokens)}</${tag}>`;
  },
});

marked.setOptions({ gfm: true, breaks: true });
marked.use({ extensions: [emphasis('looseStrong', '**', 'strong'), emphasis('looseEm', '*', 'em')] });

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
