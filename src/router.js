// 화면 이동을 브라우저 방문 기록과 맞춘다. 뒤로 가기·앞으로 가기로 화면과 스크롤 위치가 돌아온다.
//
// 기록 하나의 상태: { view: 화면 이름, detail?: 기록 상세 화면의 { kind, id }, fromList?: 목록에서 열었는지,
//   steps?: pushPosition 으로 쌓인 수, scrollY: 마지막 스크롤 위치 }.
// 상태에 화면을 적어 두므로, 새로 고침한 뒤 남은 기록으로 돌아가도 그 화면을 다시 그릴 수 있다.

const SAVE_DELAY_MS = 200;

let apply = () => {};
let saveTimer = 0;

// 브라우저가 스크롤 위치를 따로 되돌려 섞이지 않게 끄고, 기록마다 저장한 위치로 직접 돌린다.
// apply(state) 는 상태대로 화면을 그린다. 시작할 때 쓸 상태를 돌려준다.
export function initRouter({ onApply, initial }) {
  apply = onApply;
  history.scrollRestoration = 'manual';
  // 새로 고침이면 남아 있던 상태를 이어 쓴다.
  const start = history.state?.view ? history.state : { ...initial, scrollY: 0 };
  replace(start);
  window.addEventListener('popstate', () => {
    if (!history.state?.view) return;
    apply(history.state);
    window.scrollTo(0, history.state.scrollY ?? 0);
  });
  window.addEventListener('scroll', () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveScroll, SAVE_DELAY_MS);
  });
  return start;
}

function replace(state) {
  try {
    history.replaceState(state, '');
  } catch {
    // replaceState 를 너무 자주 부르면 브라우저가 막는다. 스크롤 위치 하나를 놓칠 뿐이다.
  }
}

function saveScroll() {
  clearTimeout(saveTimer);
  if (history.state?.view) replace({ ...history.state, scrollY: window.scrollY });
}

const sameDetail = (a, b) => a?.kind === b?.kind && a?.id === b?.id;

// 새 화면으로 간다. 지금과 같은 화면이면 기록을 넣지 않는다.
export function navigate(state) {
  const current = history.state;
  if (current?.view === state.view && sameDetail(current?.detail, state.detail)) return;
  saveScroll();
  history.pushState({ ...state, scrollY: 0 }, '');
  apply(history.state);
}

// 같은 화면 안에서 위치만 옮기기 전에 부른다. 지금 위치를 저장하고 같은 화면의 기록을 하나 넣어,
// 뒤로 가기가 옮기기 전 위치로 돌아가게 한다. 옮긴 뒤의 위치는 스크롤하면서 저장된다.
// steps 는 같은 화면에서 이렇게 쌓인 기록 수다. 기록 상세 화면의 「← 목록으로」 가 한 번에 돌아갈 때 쓴다.
export function pushPosition() {
  saveScroll();
  const s = history.state ?? {};
  history.pushState({ ...s, steps: (s.steps ?? 0) + 1 }, '');
}
