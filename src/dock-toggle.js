// 입력 영역 (.chat-dock) 접기·펴기. 접힘 상태는 하나라, 한 곳에서 접으면 등록한 dock 이 함께 접힌다.
import { h } from './dom.js';
import { getSetting, setSetting } from './settings.js';

const docks = [];
let collapsed = getSetting('dockCollapsed') === '1';

function render() {
  for (const { dock, button } of docks) {
    dock.classList.toggle('collapsed', collapsed);
    // 버튼에는 화살표만 보인다 (style.css 의 .dock-toggle::before). 이름은 aria-label 과 title 로 둔다.
    const label = collapsed ? '입력 펴기' : '입력 접기';
    button.setAttribute('aria-label', label);
    button.title = label;
    button.setAttribute('aria-expanded', String(!collapsed));
  }
}

function setCollapsed(value) {
  collapsed = value;
  setSetting('dockCollapsed', collapsed ? '1' : '');
  render();
}

// dock 안에 손잡이 버튼을 넣고 등록한다.
export function attachDockToggle(dock) {
  const button = h('button', { type: 'button', class: 'dock-toggle', onclick: () => setCollapsed(!collapsed) });
  dock.append(button);
  docks.push({ dock, button });
  render();
}

// 접혀 있으면 편다. 입력 칸에 focus() 를 주기 전에 부른다.
export function expandDock() {
  if (collapsed) setCollapsed(false);
}
