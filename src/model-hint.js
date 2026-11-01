// 요청에 쓸 모델을 보여 주는 한 줄. `.model-hint` 요소를 모두 같은 글로 채운다.
import { MODELS, currentModel } from './api.js';
import { hasSetting } from './settings.js';

export function modelHintText() {
  const text = `${MODELS[currentModel()].label} 로 요청해요`;
  return hasSetting('model') ? text : `${text} (기본값, 설정에서 바꿀 수 있어요)`;
}

export function updateModelHint() {
  const text = modelHintText();
  for (const el of document.querySelectorAll('.model-hint')) el.textContent = text;
}
