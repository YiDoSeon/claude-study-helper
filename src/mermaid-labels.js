// mermaid 글자칸이 목록 표시로 시작하면 mermaid 가 마크다운 목록으로 읽어 「Unsupported markdown: list」 를 그린다.
// 표시 뒤의 띄어쓰기를 줄바꿈 없는 공백 (U+00A0) 으로 바꿔 목록이 되지 않게 한다. 보이는 글자는 같다.

// 글자칸을 여는 기호 ([ ( { | > " / \) 바로 뒤, 같은 줄에서 「1. 」, 「1) 」, 「- 」, 「* 」, 「+ 」 로 시작하는 곳. > 는 <br> 다음 줄도 잡는다.
const LIST_START = /([[({|>"/\\][ \t]*)(\d{1,9}[.)]|[-*+]) (?=\S)/g;

export function escapeLabelLists(code) {
  return code.replace(LIST_START, '$1$2 ');
}
