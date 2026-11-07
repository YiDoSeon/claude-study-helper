// marked 문법 조정: 한국어 조사 앞의 강조, 물결표 하나 (`1~3`) 를 취소선으로 읽지 않기, 모델이 쓴 HTML 태그를 글자로 두기.
// markdown.js 가 marked.use 로 붙인다.

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

// GFM 의 marked 는 `~값~` 도 취소선으로 읽는다. 한국어 글의 범위 표기 (`1~3개`, `10~20%`) 가 지워진 글자처럼 보이므로
// 취소선은 `~~값~~` 만 쓴다. undefined 를 돌려주면 기본 규칙을 부르지 않고, false 면 기본 규칙에 맡긴다.
function del(src) {
  return src.startsWith('~~') ? false : undefined;
}

// 그대로 둘 HTML 태그. 나머지 태그 (`List<String>` 의 `<String>`, `<T>`, `<div>`) 는 글자로 보이게 `<` 를 바꾼다.
// 바꾸지 않으면 DOMPurify 가 모르는 태그를 지워 글이 빠진 것처럼 보인다.
const KEEP_TAGS = 'br|sub|sup|kbd|mark|b|i|u|s|em|strong|del|ins|small|details|summary';
const OTHER_TAG_START = new RegExp(`<(?!/?(?:${KEEP_TAGS})(?![\\w-]))`, 'gi');

export function escapeOtherTags(text) {
  return text.replace(OTHER_TAG_START, '&lt;');
}

// 줄 첫머리의 HTML 덩어리 (block) 는 그대로 넣으면 줄바꿈이 사라지므로, 바꾼 것이 있으면 문단으로 감싼다.
function html({ text, block }) {
  const out = escapeOtherTags(text);
  if (!block || out === text) return out;
  return `<p>${out.trim().replace(/\n/g, '<br>')}</p>\n`;
}

export const markdownSyntax = {
  extensions: [emphasis('looseStrong', '**', 'strong'), emphasis('looseEm', '*', 'em')],
  tokenizer: { del },
  renderer: { html },
};
