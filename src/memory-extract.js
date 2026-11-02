// 「기억 찾기」: 대화에서 사용자에 대해 기억해 둘 만한 사실을 Claude 가 뽑는 프롬프트와 요청.
import { z } from 'zod';
import { callJson } from './api.js';

const CandidatesSchema = z.object({
  items: z.array(z.string()),
});

const EXTRACT_SYSTEM = `너는 대화를 읽고 사용자에 대해 앞으로의 대화에서도 쓸모 있는 사실을 고른다. 고른 사실은 사용자가 확인한 뒤 저장되고, 다음 대화의 맥락으로 쓰인다.

고르는 것:
- 사용자의 배경과 하는 일 (쓰는 언어, 도구, 진행 중인 프로젝트)
- 목표와 관심사, 지금 공부하거나 만들고 있는 것
- 답을 받고 싶은 방식 (길이, 말투, 예시 선호)
- 사용자가 직접 기억해 달라고 한 것

고르지 않는 것:
- 대화 주제의 일반 지식이나 튜터가 설명한 내용 자체
- 한 번만 쓰이는 일시적인 상황
- 건강, 재정, 연락처, 주소, 계정, 비밀번호 같은 민감한 개인 정보
- 이미 기억한 것과 뜻이 같은 것

규칙:
- 항목마다 한국어 한 문장으로, 「사용자는 …」 대신 「…한다」, 「…를 선호한다」 처럼 짧게 쓴다.
- 대화에 근거가 있는 것만 쓴다. 추측하지 않는다.
- 많아야 5개다. 고를 것이 없으면 빈 배열을 돌려준다.`;

const TRANSCRIPT_LIMIT = 12000;

// 요청 글. 길면 최근 대화를 남긴다.
export function extractInput({ pairs, summary = '', existing = [] }) {
  let talk = pairs.map((t) => `사용자: ${t.q}\n상대: ${t.a}`).join('\n\n');
  if (talk.length > TRANSCRIPT_LIMIT) talk = `…${talk.slice(-TRANSCRIPT_LIMIT)}`;
  const parts = [];
  if (existing.length) parts.push('## 이미 기억한 것', ...existing.map((t) => `- ${t}`), '');
  if (summary) parts.push('## 이전 대화 요약', summary, '');
  parts.push('## 대화', '<conversation>', talk, '</conversation>');
  return parts.join('\n');
}

// 후보 문장 배열을 돌려준다. choice 의 모델로 effort low 로 요청한다.
export async function extractMemories({ pairs, summary, existing, choice }) {
  const result = await callJson({
    system: EXTRACT_SYSTEM,
    user: extractInput({ pairs, summary, existing }),
    schema: CandidatesSchema,
    effort: 'low',
    maxTokens: 4000,
    choice: choice && { model: choice.model, effort: 'low' },
  });
  const seen = new Set(existing.map((t) => t.trim()));
  return result.items.map((t) => t.trim()).filter((t) => t && !seen.has(t)).slice(0, 5);
}
