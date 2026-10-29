// 화면 코드에서 쓰는 작은 DOM 도우미.
export const $ = (selector, root = document) => root.querySelector(selector);

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'class') el.className = value;
    else if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
    else if (value != null && value !== false) el.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : String(child));
  }
  return el;
}

export function fillSelect(select, options, selected) {
  select.replaceChildren(
    ...options.map(({ value, label }) => h('option', { value, selected: value === selected }, label)),
  );
}

export function formatDate(ms) {
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// 기기마다 기억해 두면 편한 화면 상태(마지막으로 고른 분야 등).
export function remember(key, value) {
  try {
    if (value === undefined) return JSON.parse(localStorage.getItem(`study.ui.${key}`));
    localStorage.setItem(`study.ui.${key}`, JSON.stringify(value));
  } catch {
    return null;
  }
  return value;
}
