// 「기록」 화면: 분야별 정답률과 최근에 푼 문제.
import { $, h, formatDate } from '../dom.js';
import { renderMarkdown } from '../markdown.js';
import { list } from '../store.js';

const VERDICT_LABEL = { correct: '정답', partial: '부분', wrong: '오답' };
const RECENT_LIMIT = 50;

function statsByCategory(records) {
  const byCat = new Map();
  for (const r of records) {
    const cat = r.topic.path[0] ?? '기타';
    const s = byCat.get(cat) ?? { cat, total: 0, correct: 0, partial: 0 };
    s.total += 1;
    if (r.verdict === 'correct') s.correct += 1;
    if (r.verdict === 'partial') s.partial += 1;
    byCat.set(cat, s);
  }
  return [...byCat.values()].sort((a, b) => b.total - a.total);
}

function mdBlock(text) {
  const el = h('div', { class: 'md' });
  renderMarkdown(el, text);
  return el;
}

function recordItem(r) {
  const q = r.question;
  const details = h(
    'details',
    {},
    h(
      'summary',
      {},
      h('span', { class: `pill ${r.verdict}` }, VERDICT_LABEL[r.verdict]),
      ' ',
      h('strong', {}, q.concept),
      h('span', { class: 'muted small' }, ` · ${r.topic.path.join(' › ')} · ${formatDate(r.at)}`),
    ),
  );
  // 펼칠 때만 본문을 그린다.
  details.addEventListener(
    'toggle',
    () => {
      details.append(
        mdBlock(q.prompt),
        q.code ? h('pre', {}, h('code', {}, q.code)) : '',
        q.choices.length ? h('ol', {}, q.choices.map((c) => h('li', {}, c))) : '',
        h('h4', {}, '내 답'),
        h('p', {}, r.userAnswer || '(모르겠어요)'),
        r.feedback ? mdBlock(r.feedback) : '',
        h('h4', {}, '모범 답안'),
        mdBlock(q.choices.length ? `${q.answer_index + 1}. ${q.choices[q.answer_index]}` : q.answer),
        h('h4', {}, '해설'),
        mdBlock(q.explanation),
        r.tutor?.length ? h('h4', {}, '더 물어본 내용') : '',
        ...(r.tutor ?? []).map((t) =>
          h('div', { class: 'qa' }, h('p', { class: 'qa-q' }, t.q), mdBlock(t.a)),
        ),
      );
    },
    { once: true },
  );
  return h('li', {}, details);
}

export function renderRecordsView() {
  const records = list('records').sort((a, b) => b.at - a.at);
  const stats = statsByCategory(records);
  $('#s-empty').hidden = records.length > 0;
  $('#s-table').hidden = records.length === 0;
  $('#s-table tbody').replaceChildren(
    ...stats.map((s) =>
      h(
        'tr',
        {},
        h('td', {}, s.cat),
        h('td', { class: 'num' }, s.total),
        h('td', { class: 'num' }, `${Math.round((s.correct / s.total) * 100)}%`),
        h('td', { class: 'num' }, s.partial),
      ),
    ),
  );
  $('#s-recent').replaceChildren(...records.slice(0, RECENT_LIMIT).map(recordItem));
}
