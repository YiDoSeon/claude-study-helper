// 문제 출제와 채점에 쓰는 설정의 모델과 노력을 보여 주는 한 줄. `.model-hint` 요소를 모두 같은 글로 채운다.
import { MODELS, currentModel, EFFORT_LEVELS } from './api.js';
import { getSetting, hasSetting } from './settings.js';

const listeners = [];

// 한 줄을 다시 채울 때마다 fn 을 부른다 (설정이 바뀌었을 수 있는 때다).
export function onModelHintUpdate(fn) {
  listeners.push(fn);
}

export function modelHintText() {
  const model = MODELS[currentModel()].label;
  const modelText = hasSetting('model') ? model : `${model} (기본값, 설정에서 바꿀 수 있어요)`;
  const effort = getSetting('effort');
  return `문제 출제·채점: ${modelText} · 노력 ${EFFORT_LEVELS.includes(effort) ? effort : '자동'}`;
}

export function updateModelHint() {
  const text = modelHintText();
  for (const el of document.querySelectorAll('.model-hint')) el.textContent = text;
  for (const fn of listeners) fn();
}
