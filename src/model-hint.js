// 요청에 쓸 모델과 노력을 보여 주는 한 줄. `.model-hint` 요소를 모두 같은 글로 채운다.
import { MODELS, currentModel, EFFORT_LEVELS } from './api.js';
import { getSetting, hasSetting } from './settings.js';

export function modelHintText() {
  const model = MODELS[currentModel()].label;
  const modelText = hasSetting('model') ? model : `${model} (기본값, 설정에서 바꿀 수 있어요)`;
  const effort = getSetting('effort');
  return `요청 모델: ${modelText} · 노력: ${EFFORT_LEVELS.includes(effort) ? effort : '자동'}`;
}

export function updateModelHint() {
  const text = modelHintText();
  for (const el of document.querySelectorAll('.model-hint')) el.textContent = text;
}
