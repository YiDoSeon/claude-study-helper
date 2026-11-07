// 질문 속 링크에 덧붙여 모델에게만 보내는 안내. 화면의 말풍선과 저장되는 질문 글에는 넣지 않는다.
// 링크 열기 (web_fetch) 는 대화에 나온 주소만 열 수 있어서, 더 정확한 주소가 있으면 여기서 대화에 넣어 준다.

// GitHub 릴리스 목록의 위치 표시 (`/releases#release-v2.1.319`) 는 브라우저만 쓰고, 서버는 목록 페이지 전체를 받는다.
// 그 목록은 링크 열기 서버가 예전에 받아 둔 사본일 수 있으므로, 그 버전의 개별 페이지 주소를 함께 알린다.
const GITHUB_RELEASE_ANCHOR = /https?:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/releases\/?#release-([\w.+-]+)/gi;

// text 에 든 링크마다 덧붙일 안내 줄을 모아 돌려준다. 없으면 빈 문자열.
export function linkHints(text) {
  const lines = [];
  for (const [, owner, repo, tag] of text.matchAll(GITHUB_RELEASE_ANCHOR)) {
    const page = `https://github.com/${owner}/${repo}/releases/tag/${tag}`;
    lines.push(`- 위 링크의 ${tag} 릴리스는 개별 페이지 ${page} 에 있다. 목록 페이지보다 이 주소를 먼저 연다.`);
  }
  return lines.length ? `\n\n(링크 안내)\n${[...new Set(lines)].join('\n')}` : '';
}
