// src/ 를 묶어 한 파일로 만든다. 실행: npm run build
// dist/study.html 은 PC에서 여는 용도, docs/index.html 은 GitHub Pages 용도다.
import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const result = await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'iife',
  target: ['es2020'],
  minify: true,
  write: false,
  legalComments: 'none',
});
const script = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const style = await readFile('src/style.css', 'utf8');
const template = await readFile('src/ui.html', 'utf8');

const html = template
  .replace('/*STYLE*/', () => style)
  .replace('/*SCRIPT*/', () => script);

for (const out of ['dist/study.html', 'docs/index.html']) {
  await mkdir(out.split('/')[0], { recursive: true });
  await writeFile(out, html);
}
console.log(`dist/study.html, docs/index.html (${(html.length / 1024).toFixed(0)} KB)`);

// 시연 페이지: 그림 렌더링을 올리기 전에 로컬에서 본다. docs/ 에는 만들지 않는다.
const demo = await build({
  entryPoints: ['demo/visual-demo.js'],
  bundle: true,
  format: 'iife',
  target: ['es2020'],
  minify: true,
  write: false,
  legalComments: 'none',
});
const demoScript = demo.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const demoHtml = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>그림 렌더링 시연</title>
<style>${style}
main { padding: 12px; max-width: 760px; margin: 0 auto; }
h2 { font-size: 1rem; margin: 20px 0 6px; }</style>
</head>
<body>
<main>
  <h1>그림 렌더링 시연</h1>
  <p class="muted">다크 모드는 OS 설정을 바꿔서 확인하세요. mermaid 는 인터넷 연결이 필요해요.</p>
  <div id="demo"></div>
</main>
<script>${demoScript}</script>
</body>
</html>
`;
await writeFile('dist/visual-demo.html', demoHtml);
console.log(`dist/visual-demo.html (${(demoHtml.length / 1024).toFixed(0)} KB)`);
