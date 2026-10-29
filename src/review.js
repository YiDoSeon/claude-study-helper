// 틀린 개념을 간격을 늘려 가며 다시 묻는 복습 일정.
import { put, get, list, newId } from './store.js';

const DAY = 24 * 60 * 60 * 1000;
const INTERVAL_DAYS = [1, 3, 7, 14, 30];

// 답을 채점한 뒤 호출한다. record.reviewId 가 있으면 복습 문제였던 것이다.
export function applyResult(record) {
  if (record.reviewId) {
    const item = get('reviews', record.reviewId);
    if (!item) return;
    if (record.verdict === 'correct') {
      const step = item.step + 1;
      if (step >= INTERVAL_DAYS.length) {
        put('reviews', { ...item, step, done: true, lastRecordId: record.id });
      } else {
        put('reviews', { ...item, step, due: Date.now() + INTERVAL_DAYS[step] * DAY, lastRecordId: record.id });
      }
    } else {
      put('reviews', { ...item, step: 0, due: Date.now() + INTERVAL_DAYS[0] * DAY, lastRecordId: record.id });
    }
    return;
  }

  if (record.verdict === 'correct') return;
  put('reviews', {
    id: newId(),
    concept: record.question.concept,
    topic: record.topic,
    difficulty: record.difficulty,
    lastPrompt: record.question.prompt.slice(0, 400),
    sourceRecordId: record.id,
    lastRecordId: record.id,
    step: 0,
    due: Date.now() + INTERVAL_DAYS[0] * DAY,
    done: false,
  });
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
