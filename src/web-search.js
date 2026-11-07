// 웹 검색·링크 열기를 쓴 응답에서 출처를 뽑고, 대화에 도구 블록이 있는지와 질문에 링크가 있는지 확인한다.

function isWebUrl(url) {
  try {
    return ['http:', 'https:'].includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

// 링크 열기로 읽은 페이지를 먼저 쓰고, 이어서 답에서 인용한 페이지 (인용이 없으면 검색 결과 페이지) 를 쓴다. [{ url, title, retrievedAt? }]
// retrievedAt 은 링크 열기 서버가 그 페이지를 받아 온 시각 (ISO 문자열) 이다. 서버가 예전에 받아 둔 사본을 주면 지금보다 이르다.
export function collectSources(content) {
  const fetched = content
    .filter((b) => b.type === 'web_fetch_tool_result' && b.content?.type === 'web_fetch_result')
    .map((b) => ({ url: b.content.url, title: b.content.content?.title, retrievedAt: b.content.retrieved_at }));
  const cited = content
    .filter((b) => b.type === 'text')
    .flatMap((b) => b.citations ?? [])
    .filter((c) => c.type === 'web_search_result_location');
  const found = content
    .filter((b) => b.type === 'web_search_tool_result' && Array.isArray(b.content))
    .flatMap((b) => b.content);
  const seen = new Set();
  const sources = [];
  for (const { url, title, retrievedAt } of [...fetched, ...(cited.length ? cited : found)]) {
    if (!isWebUrl(url) || seen.has(url)) continue;
    seen.add(url);
    sources.push({ url, title: title || new URL(url).hostname, ...(retrievedAt && { retrievedAt }) });
  }
  return sources;
}

// 서버 도구 블록 (server_tool_use, web_search_tool_result, web_fetch_tool_result, 동적 필터링의 코드 실행 결과 등).
const isToolBlock = (b) => b.type === 'server_tool_use' || /_tool_result$/.test(b.type ?? '');

// 도구 블록이 든 대화는 도구 정의 없이 보낼 수 없다.
export function hasSearchBlocks(messages) {
  return messages.some((m) => m.role === 'assistant' && Array.isArray(m.content) && m.content.some(isToolBlock));
}

// 질문에 http(s) 링크가 있으면 true. 웹 검색을 꺼 두었어도 이때는 링크를 열 수 있게 도구를 넣는다.
export function hasLink(text) {
  return /https?:\/\/[^\s]/i.test(text);
}
