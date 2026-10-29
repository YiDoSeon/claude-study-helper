// 틀린 개념을 간격을 늘려 가며 다시 묻는 복습 일정. 일정은 추천이고,
// 언제든 풀기, 목록에서 빼기, 다시 넣기, 직접 넣기를 할 수 있다.
import { put, get, list, newId } from './store.js';

const DAY = 24 * 60 * 60 * 1000;
const INTERVAL_DAYS = [1, 3, 7, 14, 30];

function sameConcept(item, concept, topic) {
  return item.concept === concept && item.topic.path.join('>') === topic.path.join('>');
}

// 같은 분야의 같은 개념 복습 항목. 목록에서 뺀 것도 찾는다.
export function findItem(concept, topic) {
  return list('reviews').find((r) => sameConcept(r, concept, topic)) ?? null;
}

export function findItemForRecord(record) {
  return (record.reviewId && get('reviews', record.reviewId)) || findItem(record.question.concept, record.topic);
}

function fromRecord(record) {
  return {
    concept: record.question.concept,
    topic: record.topic,
    difficulty: record.difficulty,
    lastPrompt: record.question.prompt.slice(0, 400),
    lastRecordId: record.id,
  };
}

// 답을 채점한 뒤 호출한다. record.reviewId 가 있으면 복습 문제였던 것이다.
export function applyResult(record) {
  if (record.reviewId) {
    const item = get('reviews', record.reviewId);
    if (!item) return;
    const wasDue = !item.done && item.due <= Date.now();
    if (record.verdict !== 'correct') {
      put('reviews', { ...item, done: false, step: 0, due: Date.now() + INTERVAL_DAYS[0] * DAY, lastRecordId: record.id });
    } else if (!wasDue) {
      // 예정일 전에 맞힌 것은 일정을 바꾸지 않는다. 일찍 맞혀 간격이 너무 빨리 벌어지는 것을 막는다.
      put('reviews', { ...item, lastRecordId: record.id });
    } else if (item.step + 1 >= INTERVAL_DAYS.length) {
      put('reviews', { ...item, step: item.step + 1, done: true, lastRecordId: record.id });
    } else {
      const step = item.step + 1;
      put('reviews', { ...item, step, due: Date.now() + INTERVAL_DAYS[step] * DAY, lastRecordId: record.id });
    }
    return;
  }

  if (record.verdict === 'correct') return;
  const existing = findItem(record.question.concept, record.topic);
  put('reviews', {
    ...(existing ?? { id: newId(), sourceRecordId: record.id }),
    ...fromRecord(record),
    step: 0,
    due: Date.now() + INTERVAL_DAYS[0] * DAY,
    done: false,
  });
}

// 푼 문제의 개념을 복습 목록에 직접 넣는다. 이미 있으면 다시 켜고, 바로 풀 수 있게 예정일을 지금으로 한다.
export function addFromRecord(record) {
  const existing = findItemForRecord(record);
  if (existing && !existing.done) return existing;
  return put('reviews', {
    ...(existing ?? { id: newId(), sourceRecordId: record.id, ...fromRecord(record) }),
    step: 0,
    due: Date.now(),
    done: false,
  });
}

export function removeItem(id) {
  const item = get('reviews', id);
  if (item) put('reviews', { ...item, done: true, removedAt: Date.now() });
}

export function restoreItem(id) {
  const item = get('reviews', id);
  if (item) put('reviews', { ...item, done: false, step: 0, due: Date.now(), removedAt: null });
}

export function dueItems(now = Date.now()) {
  return list('reviews')
    .filter((r) => !r.done && r.due <= now)
    .sort((a, b) => a.due - b.due);
}

export function pendingItems() {
  return list('reviews')
    .filter((r) => !r.done)
    .sort((a, b) => a.due - b.due);
}

// 목록에서 뺐거나 5단계를 다 맞힌 개념. 최근 것부터.
export function offItems() {
  return list('reviews')
    .filter((r) => r.done)
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}
