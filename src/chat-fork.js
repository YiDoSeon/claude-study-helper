// 대화 fork: 묻기 대화의 질의응답 하나를 기준으로 새 대화 항목을 만들고, API 에 보낼 앞머리 글을 만든다 (DOM 과 네트워크를 쓰지 않는다).
// 원래 대화 항목은 바꾸지 않는다. 새 대화는 forkOf 로 원래 대화를 가리킨다.

// pair 가 history 의 몇 번째인지. 같은 객체가 없으면 at 과 q 가 같은 쌍을 찾는다. 없으면 -1.
export function pairIndex(history, pair) {
  const same = history.indexOf(pair);
  if (same >= 0) return same;
  return history.findIndex((t) => t.at === pair.at && t.q === pair.q);
}

// 새 대화가 가져갈 질의응답. single 이면 그 쌍 하나, 아니면 처음부터 그 쌍까지.
export function forkPairs(history, index, single) {
  return single ? [history[index]] : history.slice(0, index + 1);
}

// origin 대화의 index 번째 쌍에서 새 대화 항목을 만든다. id 와 now 는 부르는 쪽이 준다.
// summary 가 있으면 쌍을 가져가지 않고 그 요약을 맥락으로 둔다 (압축).
// 문제 맥락 (context) 은 질의응답이 아니라 대화의 전제라서 single 이어도 가져간다.
// 원래 대화의 요약은 처음부터 가져갈 때만 이어 받는다.
export function buildForkChat(origin, index, { id, now = Date.now(), single = false, summary = '' }) {
  const chat = {
    id,
    at: now,
    title: origin.title,
    category: origin.category ?? '',
    history: summary ? [] : forkPairs(origin.history, index, single).map((t) => ({ ...t })),
    forkOf: { id: origin.id, title: origin.title, index, single, summarized: !!summary },
  };
  if (origin.mode) chat.mode = origin.mode;
  if (origin.topic) chat.topic = origin.topic;
  if (origin.context) chat.context = origin.context;
  if (origin.choice) chat.choice = origin.choice;
  const carried = summary || (single ? '' : origin.summary);
  if (carried) chat.summary = carried;
  return chat;
}

// 첫 질문 앞에 붙일 글: 문제 맥락과 이전 대화 요약. 둘 다 없으면 빈 문자열.
export function chatPreface(chat) {
  const parts = [];
  if (chat.context) parts.push(chat.context);
  if (chat.summary) parts.push(`## 이전 대화 요약\n앞서 나눈 대화를 요약한 것이다. 이 맥락을 이어서 답한다.\n\n${chat.summary}`);
  return parts.join('\n\n');
}

// 「질문 1~3」, 「질문 1」 처럼 가져간 범위를 적는 말.
export function rangeLabel(index) {
  return index === 0 ? '질문 1' : `질문 1~${index + 1}`;
}
