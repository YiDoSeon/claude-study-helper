// 두 번 눌러야 실행되는 버튼: 첫 번째로 누르면 글자가 바뀌어 한 번 더 누르라고 알리고, 3초 안에 다시 누르면 실행한다.

const CONFIRM_MS = 3000;

// button 을 두 번 눌러야 onConfirm 이 불리게 한다.
// 확인 대기 중에는 글자가 confirmLabel 로 바뀌고 `confirming` 클래스가 붙는다.
// 3초가 지나거나, 다른 곳을 누르거나, 버튼이 숨겨지면 원래대로 돌아간다.
export function tapConfirm(button, { confirmLabel, onConfirm, timeout = CONFIRM_MS }) {
  let timer = 0;
  let original = '';

  function reset() {
    clearTimeout(timer);
    timer = 0;
    if (!button.classList.contains('confirming')) return;
    button.classList.remove('confirming');
    button.textContent = original;
  }

  button.addEventListener('click', () => {
    if (button.classList.contains('confirming')) {
      reset();
      onConfirm();
      return;
    }
    original = button.textContent;
    button.textContent = confirmLabel;
    button.classList.add('confirming');
    timer = setTimeout(reset, timeout);
  });

  // 버튼 밖을 누르면 되돌린다. 버튼 자신을 누른 click 은 위 처리가 맡는다.
  document.addEventListener('click', (event) => {
    if (!button.contains(event.target)) reset();
  });
  // 다른 화면으로 가서 숨겨져도 되돌린다.
  new MutationObserver(() => {
    if (button.hidden) reset();
  }).observe(button, { attributes: true, attributeFilter: ['hidden'] });
}
