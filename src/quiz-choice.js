// 「풀기」 화면의 문제 출제·채점 모델·노력 칸. 고른 값은 기기마다 기억한다 (remember 'quizChoice').
// 한 번도 고르지 않았으면 설정의 모델과 노력을 따르고, 설정이 바뀌면 칸도 바뀐다.
import { remember } from './dom.js';
import { MODELS, EFFORT_LEVELS } from './api.js';
import { createChoicePicker, defaultChoice } from './chat-choice.js';
import { onModelHintUpdate } from './model-hint.js';

const KEY = 'quizChoice';

// 기억한 값에서 모델과 노력을 칸마다 따로 살린다. 알 수 없는 값이면 설정 기본값을 쓴다.
function savedChoice() {
  const saved = remember(KEY);
  if (!saved || typeof saved !== 'object') return null;
  const base = defaultChoice();
  return {
    model: MODELS[saved.model] ? saved.model : base.model,
    effort: saved.effort === 'auto' || EFFORT_LEVELS.includes(saved.effort) ? saved.effort : base.effort,
  };
}

// container 에 칸을 채우고 { get } 을 돌려준다. get() 은 generateQuestion, gradeAnswer 의 choice 로 넘긴다.
export function attachQuizChoice(container) {
  const picker = createChoicePicker(container, (choice) => remember(KEY, choice));
  picker.set(savedChoice() ?? defaultChoice());
  onModelHintUpdate(() => {
    if (!remember(KEY)) picker.set(defaultChoice());
  });
  return { get: picker.get };
}
