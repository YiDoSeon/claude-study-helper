// fork 의 「압축」: 대화를 요약하는 프롬프트와 요청. 요약 글은 새 대화의 맥락으로 저장된다.
import { streamChat, FormatError } from './api.js';

const SUMMARY_SYSTEM = `너는 학습자와 튜터의 대화를 요약한다. 요약은 새 대화의 맥락으로 쓰인다. 새 대화의 튜터는 원래 대화를 보지 못하고 이 요약만 본다.

- 학습자가 무엇을 물었고 튜터가 무엇을 설명했는지 차례로 정리한다.
- 핵심 개념, 정의, 결론, 예시 코드의 요점, 식별자와 값은 원래 글자로 남긴다. 긴 코드는 핵심 줄만 남긴다.
- 학습자가 오해했다가 바로잡은 것과, 아직 이해하지 못했거나 답을 받지 못한 질문은 따로 적는다.
- 마지막에 다루던 내용을 적어 새 대화가 거기서 이어지게 한다.
- 그림 블록 (mermaid, svg, html) 은 넣지 않고 무엇을 보여 줬는지 한 문장으로 적는다.
- 원문보다 훨씬 짧게 쓴다. 한국어 Markdown 으로 쓰고, 인사나 「요약입니다」 같은 머리말 없이 바로 시작한다.`;

// 요약할 대화 글. context 는 문제 맥락, summary 는 원래 대화가 이미 가진 요약이다.
export function summaryTranscript({ context = '', summary = '', pairs }) {
  const parts = [];
  if (context) parts.push(`## 문제 맥락\n${context}`);
  if (summary) parts.push(`## 이전 요약\n${summary}`);
  pairs.forEach((t, i) => parts.push(`## 질문 ${i + 1}\n${t.q}`, `## 답 ${i + 1}\n${t.a}`));
  return `아래 대화를 요약해라.\n\n<conversation>\n${parts.join('\n\n')}\n</conversation>`;
}

// 요약 글과 사용량 (meta) 을 돌려준다. choice 의 모델로 effort low 로 요청한다.
export async function summarizeChat({ context, summary, pairs, choice }) {
  const message = await streamChat({
    system: SUMMARY_SYSTEM,
    messages: [{ role: 'user', content: summaryTranscript({ context, summary, pairs }) }],
    effort: 'low',
    choice: choice && { model: choice.model, effort: 'low' },
    onText: () => {},
  });
  const text = message.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
  if (!text) throw new FormatError('요약이 비어 있어요.');
  return { text, meta: message.meta };
}
