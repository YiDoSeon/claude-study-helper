// 모델이 만든 mermaid·html 그림을 sandbox iframe 에 넣는다 (srcdoc, CSP, 높이·오류 메시지 받기, 시간 초과).
// 앱 출처의 localStorage 에 API 키가 있으므로 iframe 에 allow-same-origin 을 넣지 않는다.

export const MERMAID_URL = 'https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.esm.min.mjs';
export const MERMAID_CSP = "default-src 'none'; script-src 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'unsafe-inline'; img-src data:; font-src data:";
export const HTML_CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:";
export const MERMAID_TIMEOUT_MS = 10000;
const MIN_HEIGHT = 40;

// 글자 안의 </script, <!-- 가 script 를 끝내지 못하도록 < 를 이스케이프한다.
const jsString = (text) => JSON.stringify(text).replace(/</g, '\\u003c');

const reportHeight = `
const post = (m) => parent.postMessage(m, '*');
const sendHeight = () => post({ type: 'height', value: Math.ceil(document.documentElement.getBoundingClientRect().height) });
new ResizeObserver(sendHeight).observe(document.documentElement);
`;

function mermaidDoc(code, dark) {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${MERMAID_CSP}">
<style>html,body{margin:0;background:transparent}#box{display:flex;justify-content:center}#box svg{max-width:100%;height:auto}</style>
</head><body><div id="box"></div>
<script type="module">
${reportHeight}
const code = ${jsString(code)};
const firstLine = (e) => String((e && e.message) || e).split('\\n')[0].slice(0, 200);
let mermaid;
try {
  mermaid = (await import('${MERMAID_URL}')).default;
} catch (e) {
  post({ type: 'error', message: '그림 라이브러리를 불러오지 못했어요' });
}
if (mermaid) {
  try {
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: '${dark ? 'dark' : 'default'}' });
    const { svg } = await mermaid.render('visual-mermaid', code);
    document.getElementById('box').innerHTML = svg;
    sendHeight();
  } catch (e) {
    post({ type: 'error', message: firstLine(e) });
  }
}
</script></body></html>`;
}

function htmlDoc(code, { text, bg }) {
  const colors = [text && `color:${text}`, bg && `background:${bg}`].filter(Boolean).join(';');
  return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${HTML_CSP}">
<style>html{${colors}}body{margin:0;padding:8px;font:16px/1.5 system-ui,sans-serif;color:inherit}</style>
</head><body>
<script>
${reportHeight}
</script>
${code}
</body></html>`;
}

export function buildSrcdoc(kind, code, { dark = false, text = '', bg = '' } = {}) {
  return kind === 'mermaid' ? mermaidDoc(code, dark) : htmlDoc(code, { text, bg });
}

// 부모 CSS 변수 --text, --bg 와 다크 모드 여부를 읽는다.
export function readTheme() {
  const style = getComputedStyle(document.documentElement);
  return {
    dark: !!window.matchMedia?.('(prefers-color-scheme: dark)').matches,
    text: style.getPropertyValue('--text').trim(),
    bg: style.getPropertyValue('--bg').trim(),
  };
}

// iframe 을 만들어 돌려준다. onHeight(px), onError(글자) 는 이 iframe 이 보낸 메시지만 받는다.
export function createVisualFrame(kind, code, { onHeight, onError, theme = readTheme() } = {}) {
  const iframe = document.createElement('iframe');
  iframe.className = 'visual-frame';
  iframe.setAttribute('sandbox', 'allow-scripts');
  iframe.setAttribute('referrerpolicy', 'no-referrer');
  iframe.setAttribute('title', kind === 'mermaid' ? 'mermaid 그림' : 'html 그림');
  iframe.srcdoc = buildSrcdoc(kind, code, theme);

  let timer = 0;
  const destroy = () => {
    clearTimeout(timer);
    window.removeEventListener('message', onMessage);
  };
  function onMessage(event) {
    if (!iframe.isConnected) {
      destroy();
      return;
    }
    if (event.source !== iframe.contentWindow) return;
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    clearTimeout(timer);
    if (data.type === 'height' && typeof data.value === 'number' && Number.isFinite(data.value)) {
      onHeight?.(Math.max(MIN_HEIGHT, data.value));
    } else if (data.type === 'error' && typeof data.message === 'string') {
      onError?.(data.message.split('\n')[0].slice(0, 200));
    }
  }
  window.addEventListener('message', onMessage);
  // 라이브러리를 불러오지 못하면 iframe 이 아무 메시지도 보내지 않는다.
  if (kind === 'mermaid') {
    timer = setTimeout(() => onError?.('그림 라이브러리를 불러오지 못했어요'), MERMAID_TIMEOUT_MS);
  }
  return { iframe, destroy };
}
