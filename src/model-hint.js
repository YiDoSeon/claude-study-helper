// 설정의 모델이나 노력이 바뀌었음을 알린다. 아직 고르지 않은 모델·노력 칸이 새 기본값을 따르게 한다.
const listeners = [];

// updateModelHint 가 불릴 때마다 fn 을 부른다 (설정이 바뀌었을 수 있는 때다).
export function onModelHintUpdate(fn) {
  listeners.push(fn);
}

export function updateModelHint() {
  for (const fn of listeners) fn();
}
