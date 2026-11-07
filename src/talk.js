// 「대화」 화면의 범용 대화: 프롬프트와 요청, 저장된 대화가 범용 대화인지 가리는 규칙.
// 범용 대화도 chats 컬렉션에 두고 mode: 'general' 로 묻기 대화와 구분한다.
import { streamChat } from './api.js';
import { VISUAL_RULES, LINK_RULES } from './quiz.js';
import { memoryPrompt } from './memory.js';

export const TALK_MODE = 'general';

export const isTalk = (chat) => chat?.mode === TALK_MODE;

const GENERAL_SYSTEM = `너는 사용자의 질문과 작업을 돕는 조수다. 주제는 정해져 있지 않다.

- 답의 첫 문단은 이 답이 다루는 내용을 담은 한 문장으로 쓴다. 사용자가 나중에 질문 목록에서 이 문장만 보고 어떤 답이었는지 떠올릴 수 있어야 한다. 인사나 「좋은 질문이에요」 같은 말로 시작하지 않는다. 첫 문단에는 코드 블록이나 그림을 두지 않는다.
- 웹 검색 도구가 주어지면 최신 소식, 가격, 일정, 공식 문서처럼 확인이 필요한 내용에만 검색한다.
${LINK_RULES}
${VISUAL_RULES}
- 한국어로 답한다. 코드와 고유한 이름은 원래 글자로 둔다. Markdown 을 쓸 수 있다.`;

// 메모리 (memory.js) 중 「대화」 에 넣는 항목을 프롬프트 끝에 붙인다.
export function askGeneral({ messages, webSearch, choice, onText }) {
  return streamChat({ system: GENERAL_SYSTEM + memoryPrompt('talk'), messages, effort: 'medium', webSearch, choice, onText });
}
