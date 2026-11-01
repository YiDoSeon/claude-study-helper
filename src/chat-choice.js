// 대화 입력 영역의 모델·노력 선택 칸과, 저장된 대화에서 그 값을 정하는 규칙.
import { h, fillSelect } from './dom.js';
import { MODELS, EFFORT_LEVELS, currentModel } from './api.js';
import { getSetting } from './settings.js';

// 새 대화의 기본값. 설정의 모델과 노력이다.
export function defaultChoice() {
  const effort = getSetting('effort');
  return { model: currentModel(), effort: EFFORT_LEVELS.includes(effort) ? effort : 'auto' };
}

// 저장된 대화의 선택: 저장된 choice, 없으면 마지막 답의 meta, 그래도 없으면 설정 기본값.
// 모델과 노력은 칸마다 따로 정한다. meta.model 은 거절 대체로 다른 모델이 답했을 수 있어 MODELS 에 없으면 버린다.
export function resolveChoice(choice, items = []) {
  const base = defaultChoice();
  const source = choice ?? items.at(-1)?.meta ?? {};
  return {
    model: MODELS[source.model] ? source.model : base.model,
    effort: source.effort === 'auto' || EFFORT_LEVELS.includes(source.effort) ? source.effort : base.effort,
  };
}

// container 에 모델 칸과 노력 칸을 채운다. onChange(choice) 는 사용자가 칸을 바꿀 때 부른다.
export function createChoicePicker(container, onChange = () => {}) {
  const model = h('select', { 'aria-label': '모델' });
  const effort = h('select', { 'aria-label': '노력' });
  fillSelect(model, Object.entries(MODELS).map(([id, m]) => ({ value: id, label: m.label })), currentModel());
  fillSelect(effort, [{ value: 'auto', label: '노력: 자동' }, ...EFFORT_LEVELS.map((e) => ({ value: e, label: `노력: ${e}` }))], 'auto');
  container.replaceChildren(model, effort);
  const get = () => ({ model: model.value, effort: effort.value });
  const set = (choice) => {
    model.value = choice.model;
    effort.value = choice.effort;
  };
  for (const el of [model, effort]) el.addEventListener('change', () => onChange(get()));
  return { get, set };
}
