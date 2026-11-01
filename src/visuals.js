// 렌더된 답에서 mermaid·svg·html 코드 블록을 찾아 figure.visual 로 바꾼다. 「코드 보기」 전환과 오류 표시도 맡는다.
import DOMPurify from 'dompurify';
import { createVisualFrame } from './visual-frame.js';
import { openZoom } from './visual-zoom.js';

const KINDS = ['mermaid', 'svg', 'html'];
const INLINE_HTML_MAX = 0.8; // 화면 높이에 대한 html 그림 최대 높이 비율
const SAFE_HREF = /^(#|data:image\/)/i;

// svg 문자열을 걸러 <svg> 요소 하나로 만든다. 없으면 null.
export function sanitizeSvg(code) {
  const clean = DOMPurify.sanitize(code, { USE_PROFILES: { svg: true, svgFilters: true } });
  const tpl = document.createElement('template');
  tpl.innerHTML = clean;
  const svg = tpl.content.querySelector('svg');
  if (!svg) return null;
  // 바깥 파일을 부르는 참조는 지운다 (요청으로 정보가 새지 않게).
  for (const el of svg.querySelectorAll('use, image, feImage')) {
    for (const name of ['href', 'xlink:href']) {
      const value = el.getAttribute(name);
      if (value != null && !SAFE_HREF.test(value.trim())) el.removeAttribute(name);
    }
  }
  for (const style of svg.querySelectorAll('style')) {
    if (/@import|url\(\s*['"]?\s*(?!#|data:)/i.test(style.textContent)) style.remove();
  }
  if (!svg.hasAttribute('viewBox')) {
    const w = parseFloat(svg.getAttribute('width'));
    const hgt = parseFloat(svg.getAttribute('height'));
    if (w > 0 && hgt > 0) svg.setAttribute('viewBox', `0 0 ${w} ${hgt}`);
  }
  svg.style.maxWidth = '100%';
  svg.style.height = 'auto';
  return svg;
}

function languageOf(pre) {
  const code = pre.querySelector('code');
  for (const c of code?.classList ?? []) {
    if (c.startsWith('language-') && KINDS.includes(c.slice(9))) return c.slice(9);
  }
  return null;
}

function button(label, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

// kind 에 맞는 그림 요소를 만든다. 오류는 onError, iframe 높이는 onHeight 로 알린다.
function makeContent(kind, code, { onError, onHeight }) {
  if (kind === 'svg') {
    const svg = sanitizeSvg(code);
    if (!svg) {
      onError('svg 요소가 없어요');
      return { node: null };
    }
    return { node: svg, svg };
  }
  const { iframe, destroy } = createVisualFrame(kind, code, { onError, onHeight });
  return { node: iframe, destroy };
}

function showError(figure, stage, bar, box, message) {
  stage.remove();
  bar.remove();
  const note = document.createElement('p');
  note.className = 'visual-error';
  note.textContent = `그림을 그리지 못했어요: ${message}`;
  figure.classList.add('is-error');
  box.hidden = false;
  figure.prepend(note);
}

function toVisual(box, kind, code) {
  const figure = document.createElement('figure');
  figure.className = 'visual';
  figure.dataset.kind = kind;
  const stage = document.createElement('div');
  stage.className = 'visual-stage';
  const bar = document.createElement('div');
  bar.className = 'visual-bar';
  let failed = false;
  let frame = null;

  const fail = (message) => {
    if (failed) return;
    failed = true;
    frame?.destroy?.();
    showError(figure, stage, bar, box, message);
  };
  box.replaceWith(figure);
  figure.append(stage, bar, box);

  const maxHeight = () => Math.floor(window.innerHeight * INLINE_HTML_MAX);
  const content = makeContent(kind, code, {
    onError: fail,
    onHeight: (px) => {
      const iframe = frame?.node;
      if (!iframe) return;
      iframe.style.height = `${kind === 'html' ? Math.min(px, maxHeight()) : px}px`;
    },
  });
  frame = content;
  // svg 요소가 없으면 makeContent 가 fail 을 불렀다.
  if (failed) return figure;
  stage.append(content.node);
  box.hidden = true;

  const toggle = button('코드 보기', () => {
    const showCode = box.hidden;
    box.hidden = !showCode;
    stage.hidden = showCode;
    toggle.textContent = showCode ? '그림 보기' : '코드 보기';
  });
  const zoom = button('크게 보기', () => openZoom({ kind, code, svg: content.svg }));
  bar.append(toggle, zoom);
  return figure;
}

// 말풍선 안의 mermaid·svg·html 블록을 그림으로 바꾼다. decorateCodeBlocks 를 거친 뒤에 부른다.
export function renderVisuals(el) {
  for (const box of el.querySelectorAll('.code-block')) {
    const pre = box.querySelector('pre');
    const kind = pre && languageOf(pre);
    if (!kind) continue;
    toVisual(box, kind, (pre.querySelector('code') ?? pre).textContent);
  }
}
