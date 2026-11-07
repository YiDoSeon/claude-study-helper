// 질문 속 GitHub 릴리스 링크를 앱이 GitHub API 로 직접 받아, 모델에게만 보내는 글로 만든다.
// 링크 열기 (web_fetch) 서버는 예전에 받아 둔 사본을 주거나 개별 릴리스 페이지를 열지 못할 때가 있어서 (2026-11-07) 이 길로 받는다.
// api.github.com 은 브라우저에서 바로 부를 수 있다. 토큰 없이 부르므로 IP 마다 시간당 60회 제한이 있고, 동기화 토큰은 보내지 않는다.

// /releases/tag/<tag>, /releases#release-<tag>, /releases/latest, /releases (목록)
const RELEASE_LINK = /https?:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/releases(?:\/tag\/([^\s#?)>\]]+)|\/(latest))?(?:#release-([^\s)>\]]+))?/gi;
const MAX_LINKS = 2; // 질문 하나에서 받아 오는 링크 수
const LIST_COUNT = 5; // 목록 링크면 최근 릴리스 몇 개를 받을지
const BODY_LIMIT = 12000; // 릴리스 본문 하나의 최대 글자 수
const TIMEOUT_MS = 8000;

// text 의 GitHub 릴리스 링크를 [{ owner, repo, tag? , latest? }] 로 돌려준다. tag 도 latest 도 없으면 목록 링크다.
export function findReleaseLinks(text) {
  const seen = new Set();
  const links = [];
  for (const [, owner, repo, pathTag, latest, anchorTag] of text.matchAll(RELEASE_LINK)) {
    const tag = pathTag ?? anchorTag;
    const link = { owner, repo, ...(tag && { tag }), ...(!tag && latest && { latest: true }) };
    const key = `${owner}/${repo}/${link.tag ?? (link.latest ? 'latest' : 'list')}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    links.push(link);
  }
  return links;
}

function apiUrl({ owner, repo, tag, latest }) {
  const base = `https://api.github.com/repos/${owner}/${repo}/releases`;
  if (tag) return `${base}/tags/${tag}`;
  return latest ? `${base}/latest` : `${base}?per_page=${LIST_COUNT}`;
}

const linkLabel = ({ owner, repo, tag, latest }) => `${owner}/${repo} ${tag ?? (latest ? '최신 릴리스' : '릴리스 목록')}`;

async function getJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { Accept: 'application/vnd.github+json' }, signal: controller.signal });
    return { status: res.status, data: res.ok ? await res.json() : null };
  } finally {
    clearTimeout(timer);
  }
}

function describe(release) {
  const body = (release.body ?? '').trim();
  const cut = body.length > BODY_LIMIT ? `${body.slice(0, BODY_LIMIT)}\n…(뒷부분 생략)` : body;
  return [
    `### ${release.name || release.tag_name} (태그 ${release.tag_name})`,
    `발행: ${release.published_at ?? '알 수 없음'}${release.prerelease ? ' · 프리릴리스' : ''}`,
    `주소: ${release.html_url}`,
    '',
    cut || '(본문 없음)',
  ].join('\n');
}

// 돌려주는 것: { note: 질문 뒤에 붙여 모델에게만 보낼 글 (링크가 없으면 ''), sources: 출처 목록에 더할 [{ url, title, retrievedAt }] }
// 받지 못한 링크는 note 에 이유를 적어, 모델이 web_fetch 로 열어 보게 한다.
export async function fetchReleaseNotes(text) {
  const links = findReleaseLinks(text).slice(0, MAX_LINKS);
  if (!links.length) return { note: '', sources: [] };
  const retrievedAt = new Date().toISOString();
  const parts = [];
  const sources = [];
  for (const link of links) {
    try {
      const { status, data } = await getJson(apiUrl(link));
      if (status === 404) {
        parts.push(`- ${linkLabel(link)}: GitHub API 에 이 릴리스가 없다 (404).`);
        continue;
      }
      if (!data) {
        parts.push(`- ${linkLabel(link)}: GitHub API 오류 ${status} 로 받지 못했다. 필요하면 web_fetch 로 연다.`);
        continue;
      }
      for (const release of Array.isArray(data) ? data : [data]) {
        parts.push(describe(release));
        sources.push({ url: release.html_url, title: `Release ${release.name || release.tag_name}`, retrievedAt });
      }
    } catch {
      parts.push(`- ${linkLabel(link)}: GitHub API 에 연결하지 못했다. 필요하면 web_fetch 로 연다.`);
    }
  }
  const note = [
    '',
    '',
    `<github_releases retrieved_at="${retrievedAt}">`,
    '앱이 GitHub API 로 방금 받아 온 릴리스 정보다. web_fetch 가 주는 사본보다 새 내용이다.',
    '',
    parts.join('\n\n'),
    '</github_releases>',
  ].join('\n');
  return { note, sources };
}
