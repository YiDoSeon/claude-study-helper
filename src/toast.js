// 화면 아래 알림: 글자 하나와 버튼 하나. 한 번에 하나만 보이고, 새 알림이 오면 앞의 것은 바로 닫힌다.
import { h } from './dom.js';

let current = null;

// text 와 버튼 (action.label, action.onClick) 을 ms 동안 보인다.
// 닫힐 때 onClose(byAction) 를 부른다. 버튼을 눌러 닫혔으면 true.
export function showToast({ text, action, ms = 5000, onClose = () => {} }) {
  dismissToast();
  let timer = 0;
  const el = h('div', { class: 'toast', role: 'status' }, h('span', {}, text));
  const entry = { close };
  function close(byAction = false) {
    if (current !== entry) return;
    current = null;
    clearTimeout(timer);
    el.remove();
    onClose(byAction);
  }
  if (action) {
    el.append(
      h('button', { type: 'button', class: 'toast-action', onclick: () => {
        action.onClick();
        close(true);
      } }, action.label),
    );
  }
  document.body.append(el);
  current = entry;
  timer = setTimeout(() => close(false), ms);
  return entry;
}

// 보이는 알림을 닫는다 (onClose(false) 가 불린다).
export function dismissToast() {
  current?.close(false);
}
