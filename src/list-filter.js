// 목록 필터: 필터 줄 만들기, 기간·정렬 적용, 필터 값을 기기에 기억하기.
// 기록 목록과 복습 목록이 함께 쓰도록 목록 내용은 모른다.
import { h, remember } from './dom.js';

const SEARCH_DELAY = 150;
const DAY = 86400000;

export const PERIODS = [
  { value: 'all', label: '전체' },
  { value: 'today', label: '오늘' },
  { value: '7d', label: '최근 7일' },
  { value: '30d', label: '최근 30일' },
  { value: '90d', label: '최근 90일' },
  { value: 'custom', label: '직접 지정' },
];
const VERDICTS = [
  { value: 'all', label: '전체' },
  { value: 'correct', label: '정답' },
  { value: 'partial', label: '부분' },
  { value: 'wrong', label: '오답' },
];
const SORTS = [
  { value: 'new', label: '최신순' },
  { value: 'old', label: '오래된순' },
  { value: 'cat', label: '분야순' },
];

// 복습 목록의 상태와 정렬.
const STATUSES = [
  { value: 'all', label: '전체' },
  { value: 'due', label: '지금 추천' },
  { value: 'later', label: '나중에' },
];
export const REVIEW_SORTS = [
  { value: 'due', label: '추천일순' },
  { value: 'step', label: '단계순' },
  { value: 'cat', label: '분야순' },
];
// 화면마다 보일 칸. fields 를 주지 않으면 기록 화면의 칸이다.
export const RECORD_FIELDS = ['q', 'cat', 'period', 'verdict', 'sort', 'starred', 'noted'];
export const REVIEW_FIELDS = ['q', 'cat', 'status', 'sort'];

export const DEFAULT_FILTER = {
  q: '', cat: '', period: 'all', from: '', to: '', verdict: 'all', status: 'all', sort: 'new', starred: false, noted: false,
};

const has = (options, value) => options.some((o) => o.value === value);

// 기억해 둔 값 중 모양이 맞는 것만 쓴다.
function loadState(key, sorts, defaultSort) {
  const saved = remember(key) ?? {};
  const s = { ...DEFAULT_FILTER, sort: defaultSort };
  if (typeof saved.q === 'string') s.q = saved.q;
  if (typeof saved.cat === 'string') s.cat = saved.cat;
  if (has(PERIODS, saved.period)) s.period = saved.period;
  if (typeof saved.from === 'string') s.from = saved.from;
  if (typeof saved.to === 'string') s.to = saved.to;
  if (has(VERDICTS, saved.verdict)) s.verdict = saved.verdict;
  if (has(STATUSES, saved.status)) s.status = saved.status;
  if (has(sorts, saved.sort)) s.sort = saved.sort;
  s.starred = saved.starred === true;
  s.noted = saved.noted === true;
  return s;
}

// 정렬을 뺀 필터가 하나라도 걸려 있는지.
export function isFiltered(s) {
  return s.q.trim() !== '' || s.cat !== '' || s.period !== 'all' || s.verdict !== 'all' || s.status !== 'all' || s.starred || s.noted;
}

// 'YYYY-MM-DD' 를 기기 현지 날짜의 0시 (ms) 로. 모양이 틀리면 null.
function localDayStart(text, plusDays = 0) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text ?? '');
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + plusDays).getTime();
}

// 기간의 [start, end) (ms). 제한이 없는 쪽은 null. 전체이면 null.
// 「최근 N일」 은 오늘을 포함한 N일 (오늘 0시부터 N-1일 전 0시까지).
export function periodRange(s, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const days = { '7d': 7, '30d': 30, '90d': 90 }[s.period];
  if (s.period === 'today') return { start: today, end: null };
  if (days) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));
    return { start: d.getTime(), end: null };
  }
  if (s.period === 'custom') {
    const start = localDayStart(s.from);
    const end = localDayStart(s.to, 1); // 종료일 당일을 포함한다.
    return start === null && end === null ? null : { start, end };
  }
  return null;
}

export function inPeriod(ms, range) {
  if (!range) return true;
  if (range.start !== null && ms < range.start) return false;
  if (range.end !== null && ms >= range.end) return false;
  return true;
}

// 기기 언어 설정과 상관없이 같은 순서가 되도록 글자 코드 순으로 비교한다 (영문이 한글보다 앞).
export const compareText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// ── 분야 경로 ──
// 필터 값 cat 은 경로를 ' › ' 로 이은 글자다 (예: '프로그래밍 언어 › C++'). 빈 글자는 전체.
export const PATH_SEP = ' › ';

export function pathText(path) {
  return (path && path.length ? path : ['기타']).join(PATH_SEP);
}

// 항목의 경로가 cat 으로 시작하는지 (마디 단위). 빈 경로는 ['기타'] 로 본다.
export function inCategory(path, cat) {
  if (!cat) return true;
  const want = cat.split(PATH_SEP);
  const have = path && path.length ? path : ['기타'];
  if (have.length < want.length) return false;
  return want.every((seg, i) => have[i] === seg);
}

// cat 글자의 마지막 마디 (버튼 글자용).
export function lastNode(cat) {
  return cat.split(PATH_SEP).pop();
}

// 경로들에서 분야 선택지를 만든다. 맨 위 분야마다 그 분야와 그 아래 세부 분야를 차례로 둔다.
export function categoryOptions(paths) {
  const set = new Map();
  for (const p of paths) {
    const path = p && p.length ? p : ['기타'];
    for (let n = 1; n <= path.length; n++) set.set(path.slice(0, n).join(PATH_SEP), path.slice(0, n));
  }
  const cmp = (a, b) => {
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      const c = compareText(a[i], b[i]);
      if (c) return c;
    }
    return a.length - b.length;
  };
  return [...set.entries()].sort((a, b) => cmp(a[1], b[1])).map(([text]) => text);
}

// 최신순, 오래된순, 분야순 (분야 이름 순, 같은 분야에서는 최신순). 새 배열을 준다.
export function sortItems(items, sort, getTime, getCat) {
  const arr = [...items];
  if (sort === 'old') return arr.sort((a, b) => getTime(a) - getTime(b));
  if (sort === 'cat') {
    return arr.sort((a, b) => compareText(getCat(a), getCat(b)) || getTime(b) - getTime(a));
  }
  return arr.sort((a, b) => getTime(b) - getTime(a));
}

function optionList(options) {
  return options.map(({ value, label }) => h('option', { value }, label));
}

// root 에 필터 줄을 한 번 만든다. 값이 바뀌면 onChange(state) 를 부른다 (검색칸은 입력하고 150ms 뒤).
// verdict 가 false 이면 결과 칸을 만들지 않는다.
// fields 는 보일 칸 이름 (RECORD_FIELDS, REVIEW_FIELDS). sorts 와 defaultSort 는 정렬 선택지와 기본값.
// 돌려주는 것: state (현재 값), setCategories(names), patch(값 일부), clear()
export function createFilterBar(root, { key, onChange, verdict = true, fields = RECORD_FIELDS, sorts = SORTS, defaultSort = 'new' }) {
  const state = loadState(key, sorts, defaultSort);
  const on = (name) => fields.includes(name) && (name !== 'verdict' || verdict);
  let timer = null;
  let catKey = null;

  const q = h('input', { type: 'search', name: 'q', placeholder: '검색 (띄어쓰기로 여러 단어)', 'aria-label': '검색', autocomplete: 'off' });
  const cat = h('select', { name: 'cat' }, h('option', { value: '' }, '전체'));
  const period = h('select', { name: 'period' }, ...optionList(PERIODS));
  const from = h('input', { type: 'date', name: 'from', 'aria-label': '시작일' });
  const to = h('input', { type: 'date', name: 'to', 'aria-label': '종료일' });
  const dates = h('div', { class: 'filter-dates' }, h('label', {}, '시작일', from), h('label', {}, '종료일', to));
  const verdictSel = h('select', { name: 'verdict' }, ...optionList(VERDICTS));
  const sort = h('select', { name: 'sort' }, ...optionList(sorts));
  const statusSel = h('select', { name: 'status' }, ...optionList(STATUSES));
  const starred = h('input', { type: 'checkbox', name: 'starred' });
  const noted = h('input', { type: 'checkbox', name: 'noted' });
  const clear = h('button', { type: 'button', class: 'filter-clear link' }, '필터 지우기');

  const field = (text, control) => h('label', { class: 'filter-field' }, text, control);
  const check = (text, control) => h('label', { class: 'filter-check' }, control, text);
  root.replaceChildren(
    h('label', { class: 'filter-search' }, '검색', q),
    h(
      'div',
      { class: 'filter-grid' },
      on('cat') ? field('분야', cat) : '',
      on('period') ? field('기간', period) : '',
      on('status') ? field('상태', statusSel) : '',
      on('verdict') ? field('결과 (푼 문제만)', verdictSel) : '',
      on('sort') ? field('정렬', sort) : '',
    ),
    on('period') ? dates : '',
    h('div', { class: 'filter-checks' }, on('starred') ? check('즐겨찾기만', starred) : '', on('noted') ? check('메모 있는 것만', noted) : '', clear),
  );

  function syncUi() {
    if (q.value !== state.q) q.value = state.q;
    period.value = state.period;
    from.value = state.from;
    to.value = state.to;
    verdictSel.value = state.verdict;
    statusSel.value = state.status;
    sort.value = state.sort;
    starred.checked = state.starred;
    noted.checked = state.noted;
    dates.hidden = state.period !== 'custom';
    clear.hidden = !isFiltered(state);
    cat.value = state.cat;
  }

  function save() {
    remember(key, { ...state });
  }

  function changed() {
    clearTimeout(timer);
    timer = null;
    save();
    syncUi();
    onChange(state);
  }

  // 컨트롤을 눌러 값이 바뀐 경우: 읽어서 바로 반영한다.
  const bind = (el, prop, read) => el.addEventListener('change', () => {
    state[prop] = read(el);
    changed();
  });
  bind(cat, 'cat', (el) => el.value);
  bind(period, 'period', (el) => el.value);
  bind(from, 'from', (el) => el.value);
  bind(to, 'to', (el) => el.value);
  bind(verdictSel, 'verdict', (el) => el.value);
  bind(statusSel, 'status', (el) => el.value);
  bind(sort, 'sort', (el) => el.value);
  bind(starred, 'starred', (el) => el.checked);
  bind(noted, 'noted', (el) => el.checked);
  q.addEventListener('input', () => {
    state.q = q.value;
    save();
    clear.hidden = !isFiltered(state);
    clearTimeout(timer);
    timer = setTimeout(changed, SEARCH_DELAY);
  });
  clear.addEventListener('click', () => {
    Object.assign(state, { ...DEFAULT_FILTER, sort: state.sort });
    changed();
  });

  syncUi();
  return {
    state,
    // 분야 선택지를 다시 만든다. 고른 값이 목록에 없어도 선택지에 남겨 값을 유지한다.
    setCategories(names) {
      const all = names.includes(state.cat) || state.cat === '' ? names : [...names, state.cat];
      const next = all.join('\n');
      if (next !== catKey) {
        catKey = next;
        cat.replaceChildren(h('option', { value: '' }, '전체'), ...all.map((n) => h('option', { value: n }, n)));
      }
      cat.value = state.cat;
    },
    // 값 일부를 바꾸고 onChange 를 부른다.
    patch(part) {
      Object.assign(state, part);
      changed();
    },
    clear() {
      clear.click();
    },
  };
}
