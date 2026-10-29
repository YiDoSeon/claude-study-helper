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
