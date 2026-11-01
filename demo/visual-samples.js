// 시연 페이지에 보일 예시 답변 Markdown 문자열들.
const F = '```';

export const SAMPLES = [
  {
    title: '1. mermaid 흐름도: C++ 빌드 과정',
    text: `C++ 소스가 실행 파일이 되기까지는 네 단계를 거쳐요.

${F}mermaid
flowchart LR
  A[소스 .cpp] --> B[전처리]
  B --> C[컴파일]
  C --> D[어셈블]
  D --> E[링크]
  E --> F[실행 파일]
${F}`,
  },
  {
    title: '2. mermaid 시퀀스 다이어그램: TCP 3-way handshake',
    text: `연결을 열 때 양쪽이 서로의 순서 번호를 확인하는 과정이에요.

${F}mermaid
sequenceDiagram
  participant C as 클라이언트
  participant S as 서버
  C->>S: SYN (seq=x)
  S->>C: SYN+ACK (seq=y, ack=x+1)
  C->>S: ACK (ack=y+1)
  Note over C,S: 연결 수립
${F}`,
  },
  {
    title: '3. svg: 연결 리스트 메모리 배치',
    text: `노드마다 값과 다음 노드를 가리키는 포인터가 있어요. 글자와 선은 currentColor 라 다크 모드에서도 보여요.

${F}svg
<svg viewBox="0 0 420 120" width="420" height="120" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2">
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0 0L10 5L0 10z" fill="currentColor" stroke="none"/>
    </marker>
  </defs>
  <g font-family="monospace" font-size="14" fill="currentColor" stroke="none">
    <text x="10" y="18">0x1000</text><text x="150" y="18">0x2040</text><text x="290" y="18">0x3080</text>
    <text x="22" y="66">10</text><text x="162" y="66">20</text><text x="302" y="66">30</text>
    <text x="372" y="66">NULL</text>
  </g>
  <rect x="10" y="30" width="100" height="50"/><line x1="50" y1="30" x2="50" y2="80"/>
  <rect x="150" y="30" width="100" height="50"/><line x1="190" y1="30" x2="190" y2="80"/>
  <rect x="290" y="30" width="100" height="50"/><line x1="330" y1="30" x2="330" y2="80"/>
  <line x1="80" y1="55" x2="148" y2="55" marker-end="url(#arrow)"/>
  <line x1="220" y1="55" x2="288" y2="55" marker-end="url(#arrow)"/>
  <line x1="360" y1="55" x2="368" y2="55"/>
</svg>
${F}`,
  },
  {
    title: '4. html: 버블 정렬 애니메이션',
    text: `인접한 두 막대를 비교해 큰 쪽을 뒤로 보내요. 버튼으로 재생하거나 다시 시작해 보세요.

${F}html
<div id="bars" style="display:flex;align-items:flex-end;gap:6px;height:140px"></div>
<p id="msg" style="margin:6px 0">준비됨</p>
<button id="play">재생</button> <button id="reset">다시</button>
<script>
  const start = [5, 3, 8, 1, 9, 2, 7];
  let data, timer, i, j;
  const box = document.getElementById('bars');
  const msg = document.getElementById('msg');
  function draw(a, b) {
    box.innerHTML = '';
    data.forEach((v, k) => {
      const d = document.createElement('div');
      d.style.cssText = 'flex:1;background:currentColor;opacity:' + (k === a || k === b ? 1 : 0.45) +
        ';height:' + v * 14 + 'px;' + (k === a || k === b ? 'outline:3px solid #f2994a;' : '');
      box.append(d);
    });
  }
  function reset() {
    clearInterval(timer);
    data = start.slice(); i = 0; j = 0;
    draw(-1, -1); msg.textContent = '준비됨';
  }
  function step() {
    if (i >= data.length - 1) { clearInterval(timer); draw(-1, -1); msg.textContent = '정렬 끝'; return; }
    if (j >= data.length - 1 - i) { i++; j = 0; return; }
    const swap = data[j] > data[j + 1];
    if (swap) [data[j], data[j + 1]] = [data[j + 1], data[j]];
    draw(j, j + 1);
    msg.textContent = (swap ? '바꿈: ' : '그대로: ') + j + '번과 ' + (j + 1) + '번';
    j++;
  }
  document.getElementById('play').onclick = () => { clearInterval(timer); timer = setInterval(step, 500); };
  document.getElementById('reset').onclick = reset;
  reset();
</script>
${F}`,
  },
  {
    title: '5. 일부러 틀린 mermaid 블록 (오류 표시 확인)',
    text: `문법이 틀린 mermaid 는 「그림을 그리지 못했어요」 줄과 원래 코드가 보여야 해요.

${F}mermaid
flowchart LR
  A --> --> B [
  ???
${F}`,
  },
  {
    title: '6. 스크립트·onload 가 섞인 svg (걸러짐 확인용)',
    text: `이 svg 에는 script, onload, javascript: 링크가 들어 있어요. 실행되지 않고 걸러져서, 경고 창이 뜨지 않고 원과 글자만 보여야 해요.

${F}svg
<svg viewBox="0 0 240 90" width="240" height="90" xmlns="http://www.w3.org/2000/svg" onload="alert('onload 실행됨')">
  <script>alert('script 실행됨')</script>
  <a href="javascript:alert('링크 실행됨')"><circle cx="45" cy="45" r="30" fill="none" stroke="currentColor" stroke-width="3" onclick="alert('onclick 실행됨')"/></a>
  <text x="95" y="50" fill="currentColor" font-size="14">걸러진 svg</text>
</svg>
${F}`,
  },
];
