// 그림 「크게 보기」 창: 화면 전체를 덮고, +/− 확대와 가로·세로 스크롤, 닫기 버튼, Esc 를 지원한다.
import { createVisualFrame } from './visual-frame.js';

const STEPS = [0.5, 0.75, 1, 1.5, 2, 3, 4];

export function openZoom({ kind, code, svg }) {
  const overlay = document.createElement('div');
  overlay.className = 'zoom-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', '그림 크게 보기');

  const body = document.createElement('div');
  body.className = 'zoom-body';
  const sizer = document.createElement('div');
  sizer.className = 'zoom-sizer';
  const inner = document.createElement('div');
  inner.className = 'zoom-inner';
  const baseWidth = Math.max(320, Math.min(window.innerWidth - 32, 900));
  inner.style.width = `${baseWidth}px`;
  sizer.append(inner);
  body.append(sizer);

  let level = STEPS.indexOf(1);
  const label = document.createElement('span');
  label.className = 'zoom-level';
  const fit = () => {
    const scale = STEPS[level];
    inner.style.transform = `scale(${scale})`;
    sizer.style.width = `${baseWidth * scale}px`;
    sizer.style.height = `${inner.offsetHeight * scale}px`;
    label.textContent = `${Math.round(scale * 100)}%`;
    minus.disabled = level === 0;
    plus.disabled = level === STEPS.length - 1;
  };
  const step = (delta) => {
    level = Math.min(STEPS.length - 1, Math.max(0, level + delta));
    fit();
  };
  const mk = (text, onClick, aria) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    if (aria) b.setAttribute('aria-label', aria);
    b.addEventListener('click', onClick);
    return b;
  };
  const minus = mk('−', () => step(-1), '축소');
  const plus = mk('+', () => step(1), '확대');

  let destroy = () => {};
  const close = () => {
    destroy();
    document.removeEventListener('keydown', onKey, true);
    overlay.remove();
  };
  function onKey(e) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    }
  }
  const closeBtn = mk('닫기', close);
  const bar = document.createElement('div');
  bar.className = 'zoom-bar';
  bar.append(minus, label, plus, closeBtn);
  overlay.append(bar, body);

  if (kind === 'svg') {
    inner.append(svg.cloneNode(true));
  } else {
    const frame = createVisualFrame(kind, code, {
      onHeight: (px) => {
        frame.iframe.style.height = `${px}px`;
        fit();
      },
      // 오류는 본문 그림에서 이미 보였으므로 여기서는 창 안에 글자만 남긴다.
      onError: (message) => {
        const p = document.createElement('p');
        p.className = 'visual-error';
        p.textContent = `그림을 그리지 못했어요: ${message}`;
        frame.iframe.replaceWith(p);
        fit();
      },
    });
    destroy = frame.destroy;
    inner.append(frame.iframe);
  }
  document.body.append(overlay);
  document.addEventListener('keydown', onKey, true);
  fit();
  closeBtn.focus();
  return { close, overlay };
}
