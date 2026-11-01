// 시연 페이지 연결: 예시 답변을 앱과 같은 renderMarkdown 으로 그린다. API 와 저장소는 쓰지 않는다.
import { renderMarkdown } from '../src/markdown.js';
import { SAMPLES } from './visual-samples.js';

const root = document.getElementById('demo');
for (const { title, text } of SAMPLES) {
  const heading = document.createElement('h2');
  heading.textContent = title;
  const body = document.createElement('div');
  body.className = 'md';
  const bubble = document.createElement('div');
  bubble.className = 'bubble assistant';
  bubble.append(body);
  root.append(heading, bubble);
  renderMarkdown(body, text, { visuals: true });
}
