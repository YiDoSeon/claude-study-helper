// 코드 블록에 붙이는 도구: 복사 버튼과 글 블록 줄바꿈.

const TEXT_LANGS = new Set(['language-text', 'language-txt', 'language-plaintext']);

async function writeClipboard(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // 거절되면 아래 execCommand 로 넘어간다.
    }
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
  document.body.append(area);
  area.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    area.remove();
  }
}

// pre 를 div.code-block 으로 감싸고 복사 버튼을 단다. 이미 감싼 pre 는 건너뛴다.
export function decoratePre(pre, { wrap = false } = {}) {
  if (pre.parentElement?.classList.contains('code-block')) return pre.parentElement;
  const box = document.createElement('div');
  box.className = 'code-block';
  pre.replaceWith(box);
  box.append(pre);

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'copy-btn';
  button.textContent = '복사';
  let timer = null;
  button.addEventListener('click', async () => {
    const text = (pre.querySelector('code') ?? pre).textContent;
    button.textContent = (await writeClipboard(text)) ? '복사됨' : '복사 실패';
    clearTimeout(timer);
    timer = setTimeout(() => { button.textContent = '복사'; }, 1500);
  });
  box.append(button);

  if (wrap) {
    const classes = [...(pre.querySelector('code')?.classList ?? [])].filter((c) => c.startsWith('language-'));
    if (classes.length === 0 || classes.some((c) => TEXT_LANGS.has(c))) pre.classList.add('wrap');
  }
  return box;
}

export function decorateCodeBlocks(el) {
  for (const pre of el.querySelectorAll('pre')) decoratePre(pre, { wrap: true });
}
