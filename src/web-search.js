// 웹 검색을 쓴 응답에서 출처를 뽑고, 대화에 검색 블록이 있는지 확인한다.

const SEARCH_BLOCK_TYPES = new Set(['server_tool_use', 'web_search_tool_result']);

function isWebUrl(url) {
  try {
    return ['http:', 'https:'].includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

// 답에서 인용한 페이지를 먼저 쓰고, 인용이 없으면 검색 결과 페이지를 쓴다. [{ url, title }]
export function collectSources(content) {
  const cited = content
    .filter((b) => b.type === 'text')
    .flatMap((b) => b.citations ?? [])
    .filter((c) => c.type === 'web_search_result_location');
  const found = content
    .filter((b) => b.type === 'web_search_tool_result' && Array.isArray(b.content))
    .flatMap((b) => b.content);
  const seen = new Set();
  const sources = [];
  for (const { url, title } of cited.length ? cited : found) {
    if (!isWebUrl(url) || seen.has(url)) continue;
    seen.add(url);
    sources.push({ url, title: title || new URL(url).hostname });
  }
  return sources;
}

// 검색 블록이 든 대화는 도구 정의 없이 보낼 수 없다.
export function hasSearchBlocks(messages) {
  return messages.some(
    (m) => m.role === 'assistant' && Array.isArray(m.content) && m.content.some((b) => SEARCH_BLOCK_TYPES.has(b.type)),
  );
}
