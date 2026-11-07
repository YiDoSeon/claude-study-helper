// 「묻기」 와 「대화」 화면이 같이 쓰는 대화 도우미: 저장된 글로 API 메시지 만들기, 쌍마다 붙는 버튼 줄의 conv.
import { get } from './store.js';
import { chatPreface } from './chat-fork.js';
import { forkButton } from './fork-dialog.js';

// 첫 질문 앞에 붙일 문제 맥락과 이전 대화 요약 (chatPreface). 「더 물어보기」 와 같은 모양으로 보낸다.
export function withContext(preface, question) {
  return preface ? `${preface}\n\n## 질문\n${question}` : question;
}

// 저장된 글만으로 API 에 보낼 대화를 만든다. thinking 블록과 검색 블록은 들어가지 않는다.
// linkNote 는 질문할 때 앱이 받아 붙인 GitHub 릴리스 글 (github-release.js) 이라 질문 뒤에 다시 붙인다.
export function textMessages(saved) {
  const preface = chatPreface(saved);
  return saved.history.flatMap((t, i) => [
    { role: 'user', content: i === 0 ? withContext(preface, t.q + (t.linkNote ?? '')) : t.q + (t.linkNote ?? '') },
    { role: 'assistant', content: t.a },
  ]);
}

// 쌍마다 붙는 버튼 줄의 conv. fork 버튼은 누를 때 저장된 대화를 다시 읽는다.
export const pairConv = (saved) => ({
  title: saved.title,
  context: saved.context,
  actions: (pair) => [forkButton(() => get('chats', saved.id), pair)],
});
