// 목록 검색: 검색어를 단어로 나누고, 글과 맞춰 보고, 찾은 곳을 한 줄 미리보기로 만든다.
// 화면을 모르는 순수 함수만 둔다 (기록 목록과 복습 목록이 함께 쓴다).

const PREVIEW_RADIUS = 30;

// 공백으로 나눈 단어. 대소문자를 구분하지 않으므로 소문자로 둔다.
export function splitTerms(query) {
  return String(query ?? '').toLowerCase().split(/\s+/).filter(Boolean);
}

// 공백을 모두 뺀 소문자 글 s 와, s 의 i 번째 글자가 원문 몇 번째 글자인지 map[i] 로 둔다.
function compact(text) {
  let s = '';
  const map = [];
  for (let i = 0; i < text.length; i++) {
    if (/\s/.test(text[i])) continue;
    for (const ch of text[i].toLowerCase()) {
      s += ch;
      map.push(i);
    }
  }
  return { s, map };
}

// 띄어쓰기를 무시하고 term 이 text 에 들어 있는지.
export function textHas(text, term) {
  return compact(String(text ?? '')).s.includes(term);
}

function mergeRanges(ranges) {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else out.push([...r]);
  }
  return out;
}

// terms 가 text 에서 나타나는 원문 위치 [시작, 끝) 들. 띄어쓰기를 무시하고 찾아도 원문 기준이다.
export function findRanges(text, terms) {
  const { s, map } = compact(text);
  const out = [];
  for (const t of terms) {
    if (!t) continue;
    for (let from = 0; ; ) {
      const i = s.indexOf(t, from);
      if (i < 0) break;
      out.push([map[i], map[i + t.length - 1] + 1]);
      from = i + t.length;
    }
  }
  return mergeRanges(out);
}

// 미리보기 글에서 Markdown 기호를 뺀다.
export function stripMarkdown(text) {
  return String(text ?? '').replace(/[*`#]/g, '');
}

// field = { label, text }. anchor 단어가 있는 자리 앞뒤 30자 안팎을 잘라 { label, parts: [{ text, mark }] } 로 준다.
export function makePreview(field, terms, anchor) {
  const raw = String(field.text ?? '');
  let text = stripMarkdown(raw).replace(/\s+/g, ' ').trim();
  let found = findRanges(text, [anchor]);
  if (!found.length) {
    text = raw.replace(/\s+/g, ' ').trim();
    found = findRanges(text, [anchor]);
  }
  if (!found.length) return null;
  const [a, b] = found[0];
  const start = Math.max(0, a - PREVIEW_RADIUS);
  const end = Math.min(text.length, b + PREVIEW_RADIUS);
  const marks = findRanges(text, terms)
    .map(([x, y]) => [Math.max(x, start), Math.min(y, end)])
    .filter(([x, y]) => x < y);
  const parts = [];
  let at = start;
  if (start > 0) parts.push({ text: '…', mark: false });
  for (const [x, y] of marks) {
    if (x > at) parts.push({ text: text.slice(at, x), mark: false });
    parts.push({ text: text.slice(x, y), mark: true });
    at = y;
  }
  if (at < end) parts.push({ text: text.slice(at, end), mark: false });
  if (end < text.length) parts.push({ text: '…', mark: false });
  return { label: field.label, parts };
}

// 푼 문제에서 찾을 글. title 이 true 인 칸은 목록 행의 제목에 보이는 글이다.
export function recordFields(r, note) {
  const q = r.question;
  return [
    { label: '개념', text: q.concept, title: true },
    { label: '분야', text: r.topic.path.join(' › ') },
    { label: '문제', text: q.prompt },
    { label: '내 답', text: r.userAnswer },
    { label: '해설', text: q.explanation },
    { label: '메모', text: note },
  ];
}

export function chatFields(c, note) {
  return [
    { label: '제목', text: c.title, title: true },
    { label: '분야', text: c.category },
    ...c.history.flatMap((t) => [
      { label: '질문', text: t.q },
      { label: '답변', text: t.a },
    ]),
    { label: '메모', text: note },
  ];
}

// 모든 단어가 어느 칸엔가 있으면 matched. 제목에 없는 단어가 있으면 그 단어가 처음 나온 칸을 hit 미리보기로 준다.
export function searchFields(fields, terms) {
  if (!terms.length) return { matched: true, hit: null };
  const compacts = fields.map((f) => compact(String(f.text ?? '')).s);
  const where = terms.map((t) => compacts.findIndex((c) => c.includes(t)));
  if (where.some((i) => i < 0)) return { matched: false, hit: null };
  const k = terms.findIndex((_, n) => !fields[where[n]].title);
  if (k < 0) return { matched: true, hit: null };
  return { matched: true, hit: makePreview(fields[where[k]], terms, terms[k]) };
}
