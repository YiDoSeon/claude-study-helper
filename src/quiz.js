// 문제 출제, 채점, 튜터 대화의 프롬프트와 응답 형식.
import { z } from 'zod';
import { callJson, streamChat, FormatError } from './api.js';

const QuestionSchema = z.object({
  type: z.enum(['multiple_choice', 'short_answer', 'code_reading', 'explain']),
  concept: z.string(),
  prompt: z.string(),
  code: z.string(),
  code_language: z.string(),
  choices: z.array(z.string()),
  answer_index: z.number().int(),
  answer: z.string(),
  explanation: z.string(),
});

const GradeSchema = z.object({
  verdict: z.enum(['correct', 'partial', 'wrong']),
  feedback: z.string(),
});

const QUESTION_SYSTEM = `너는 프로그래밍과 컴퓨터 과학을 가르치는 출제자다. 학습자 한 명에게 한 번에 문제 하나를 낸다.

출제 원칙:
- 외운 정의를 되묻기보다 이해했는지 확인하는 문제를 낸다. 동작을 예측하거나, 두 방식을 비교하거나, 틀린 곳을 찾거나, 언제 무엇을 쓰는지 고르게 한다.
- 난이도는 요청한 수준에 맞춘다. 입문은 용어와 기본 동작, 기초는 대표 사용법, 중급은 원리와 트레이드오프, 심화는 경계 사례와 내부 구현을 다룬다.
- 정답이 하나로 정해지게 쓴다. 객관식 보기는 4개이고, 오답은 흔한 오해를 반영한다.
- 문제와 해설은 한국어로 쓴다. 코드와 식별자, 널리 쓰는 영어 용어는 원래 글자로 둔다.

필드 규칙:
- type: multiple_choice, short_answer, code_reading, explain 중 하나.
- concept: 이 문제가 확인하는 개념을 20자 안팎으로 적는다. 복습 목록에 쓰인다.
- prompt: 문제 본문. Markdown 을 쓸 수 있다. 코드는 넣지 않고 code 필드에 둔다. 묻는 말은 type 에 맞춘다. 「고르시오」 는 multiple_choice 에만 쓴다. 보기가 없는 형식은 답을 직접 쓰게 묻는다. code_reading 은 「출력 결과를 쓰시오」 처럼 결과를, short_answer 는 단어나 값 하나를, explain 은 이유나 과정을 쓰게 한다.
- code: 문제에 딸린 코드. 없으면 빈 문자열. code_language 는 그 언어 이름이고, 코드가 없으면 빈 문자열.
- choices: 객관식 보기 4개. 객관식이 아니면 빈 배열.
- answer_index: 객관식 정답의 0부터 센 위치. 객관식이 아니면 -1.
- answer: 모범 답안. 서술형은 채점 기준이 될 핵심 요소를 포함한다.
- explanation: Markdown 으로 쓰고, 역할마다 나눈다.
  - 첫 문단: 왜 그 답인지. 원리를 따라 읽는 설명이라 문단으로 쓴다.
  - 객관식이면 이어서 오답 보기마다 목록 항목 하나를 쓴다. 꼴은 「- **1번** (보기 요지): 왜 틀렸는지」 이고 번호는 보기 번호다. 정답 보기는 넣지 않는다.
  - 객관식이 아니면 흔한 오해가 둘 이상일 때 같은 꼴의 목록으로 쓴다.
  - 해결책이나 대안이 여럿이면 마지막에 목록으로 쓴다. 하나면 한 문장으로 쓴다.
  - 「첫 번째 보기는…, 세 번째 보기는…」 처럼 나란한 항목을 한 문단에 이어 쓰지 않는다.`;

const GRADE_SYSTEM = `너는 프로그래밍과 컴퓨터 과학 문제의 채점자다. 모범 답안과 학습자 답을 비교해 판정한다.

- correct: 핵심을 모두 맞혔다. 표현이 달라도 뜻이 같으면 맞다.
- partial: 일부는 맞지만 중요한 요소가 빠졌거나 틀린 부분이 섞였다.
- wrong: 핵심이 틀렸거나 답이 비어 있다.

feedback 에는 학습자 답에서 맞은 점과 빠지거나 틀린 점을 짧게 쓴다. 한국어, Markdown 가능. 모범 답안 전체를 되풀이하지 않는다.`;

const TUTOR_SYSTEM = `너는 프로그래밍과 컴퓨터 과학 튜터다. 학습자가 방금 푼 문제를 두고 질문한다.

- 학습자가 스스로 이해하도록 돕는다. 개념의 원리를 먼저 설명하고, 필요하면 작은 예시나 코드로 보여 준다.
- 학습자가 오해한 부분이 있으면 그 오해가 왜 생기기 쉬운지와 함께 바로잡는다.
- 답은 짧게 시작하고, 학습자가 더 물으면 깊이 들어간다.
- 한국어로 답한다. 코드와 식별자는 원래 글자로 둔다. Markdown 을 쓸 수 있다.`;

const FREE_TUTOR_SYSTEM = `너는 프로그래밍과 컴퓨터 과학 튜터다. 학습자가 궁금한 것을 자유롭게 묻는다.

- 개념의 원리를 먼저 설명하고, 필요하면 작은 예시나 코드로 보여 준다.
- 질문에 오해가 섞여 있으면 그 오해가 왜 생기기 쉬운지와 함께 바로잡는다.
- 답은 짧게 시작하고, 학습자가 더 물으면 깊이 들어간다.
- 웹 검색 도구가 주어지면 최신 버전, 공식 문서, 표준 명세처럼 확인이 필요한 내용에만 검색한다. 잘 알려진 개념은 검색 없이 설명한다.
- 한국어로 답한다. 코드와 식별자는 원래 글자로 둔다. Markdown 을 쓸 수 있다.`;

const CHAT_CONTEXT_LIMIT = 6000;

function describeTopic(topic) {
  return [...topic.path, topic.detail].filter(Boolean).join(' > ');
}

export async function generateQuestion({ topic, difficulty, type, avoidConcepts = [], review = null, chatContext = null }) {
  const lines = [`분야: ${describeTopic(topic)}`, `난이도: ${difficulty}`];
  lines.push(type === 'auto' ? '문제 형식: 주제에 가장 잘 맞는 형식을 골라라.' : `문제 형식: ${type}`);
  if (review) {
    lines.push(
      '',
      '복습 문제다. 학습자가 예전에 이 개념을 틀렸다.',
      `개념: ${review.concept}`,
      `예전 문제: ${review.lastPrompt}`,
      '같은 개념을 다른 각도나 다른 예시로 묻는 새 문제를 내라. 예전 문제를 그대로 되풀이하지 마라.',
    );
  }
  if (chatContext) {
    lines.push(
      '',
      '학습자가 튜터와 아래 대화를 나눴다. 이 대화에서 다룬 개념을 제대로 이해했는지 확인하는 문제를 내라.',
      '<conversation>',
      chatContext,
      '</conversation>',
    );
  }
  if (!review && avoidConcepts.length) {
    lines.push('', '최근에 이미 낸 개념이다. 겹치지 않게 다른 개념을 골라라:', ...avoidConcepts.map((c) => `- ${c}`));
  }
  const user = lines.join('\n');
  const question = await callJson({ system: QUESTION_SYSTEM, user, schema: QuestionSchema, effort: 'medium' });
  const problem = formatProblem(question);
  if (!problem) return question;
  // 어긋난 점을 알려 주고 한 번만 다시 낸다.
  const retry = await callJson({
    system: QUESTION_SYSTEM,
    user: `${user}\n\n앞서 낸 문제는 형식이 어긋났다: ${problem}\n필드 규칙대로 새로 내라.`,
    schema: QuestionSchema,
    effort: 'medium',
  });
  const retryProblem = formatProblem(retry);
  if (retryProblem) throw new FormatError(retryProblem);
  return retry;
}

// type 과 choices, prompt 가 어긋난 점을 문장으로 돌려준다. 맞으면 null.
function formatProblem(q) {
  if (q.type === 'multiple_choice') {
    if (q.choices.length !== 4) return `multiple_choice 인데 보기가 ${q.choices.length}개다. 보기를 4개 넣어라.`;
    if (q.answer_index < 0 || q.answer_index >= q.choices.length) return 'answer_index 가 보기 범위를 벗어났다.';
    return null;
  }
  if (q.choices.length) return `${q.type} 인데 보기가 있다. 객관식이 아니면 choices 는 빈 배열이다.`;
  if (/고르(시오|세요|십시오|라)|골라/.test(q.prompt)) {
    return `${q.type} 이라 보기가 없는데 prompt 가 「고르시오」 로 묻는다. 답을 직접 쓰게 묻는 문장으로 바꿔라.`;
  }
  return null;
}

export function gradeChoice(question, index) {
  return index === question.answer_index
    ? { verdict: 'correct', feedback: '' }
    : { verdict: 'wrong', feedback: `고른 답: ${question.choices[index] ?? '(없음)'}` };
}

export async function gradeAnswer(question, userAnswer) {
  if (!userAnswer.trim()) return { verdict: 'wrong', feedback: '답을 적지 않았어요.' };
  const user = [
    '## 문제',
    question.prompt,
    question.code ? `\n\`\`\`${question.code_language}\n${question.code}\n\`\`\`` : '',
    '## 모범 답안',
    question.answer,
    '## 학습자 답',
    userAnswer,
  ].join('\n');
  return callJson({ system: GRADE_SYSTEM, user, schema: GradeSchema, effort: 'low' });
}

// 튜터 대화의 첫 메시지. 문제와 채점 결과를 맥락으로 넣는다.
export function tutorContext(record) {
  const q = record.question;
  return [
    '방금 푼 문제와 결과다.',
    '## 문제',
    q.prompt,
    q.code ? `\`\`\`${q.code_language}\n${q.code}\n\`\`\`` : '',
    q.choices.length ? q.choices.map((c, i) => `${i + 1}. ${c}`).join('\n') : '',
    '## 모범 답안',
    q.answer,
    '## 해설',
    q.explanation,
    '## 내 답',
    record.userAnswer || '(모르겠다고 함)',
    `## 채점: ${record.verdict}`,
    record.feedback,
  ]
    .filter(Boolean)
    .join('\n');
}

export function askTutor({ messages, onText }) {
  return streamChat({ system: TUTOR_SYSTEM, messages, effort: 'medium', onText });
}

export function askFree({ messages, webSearch, onText }) {
  return streamChat({ system: FREE_TUTOR_SYSTEM, messages, effort: 'medium', webSearch, onText });
}

// 「묻기」 대화를 출제용 맥락 글로 바꾼다. 길면 최근 대화를 남긴다.
export function chatToContext(history) {
  const text = history.map((t) => `학습자: ${t.q}\n튜터: ${t.a}`).join('\n\n');
  return text.length > CHAT_CONTEXT_LIMIT ? `…${text.slice(-CHAT_CONTEXT_LIMIT)}` : text;
}
