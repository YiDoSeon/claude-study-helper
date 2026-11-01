// 목록 필터: 필터 줄 만들기, 기간·정렬 적용, 필터 값을 기기에 기억하기.
// 기록 목록과 복습 목록이 함께 쓰도록 목록 내용은 모른다.
import { h, remember } from './dom.js';
import { createDropdown, checkRow } from './filter-dropdown.js';

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
export const RECORD_FIELDS = ['q', 'cat', 'period', 'verdict', 'sort', 'starred', 'noted', 'archived'];
export const REVIEW_FIELDS = ['q', 'cat', 'status', 'sort'];

// cats 는 고른 분야 경로 글자들, verdicts 는 고른 결과들이다. 비면 전체이고, 고른 것 중 하나라도 맞으면 보인다.
// 배열이 들어 있으므로 상태를 만들 때는 newState 로 배열을 새로 만든다.
export const DEFAULT_FILTER = {
  q: '', cats: [], period: 'all', from: '', to: '', verdicts: [], status: 'all', sort: 'new', starred: false, noted: false, archived: false,
};

const newState = (sort = DEFAULT_FILTER.sort) => ({ ...DEFAULT_FILTER, cats: [], verdicts: [], sort });

const has = (options, value) => options.some((o) => o.value === value);

// 기억해 둔 값 중 모양이 맞는 것만 쓴다.
function loadState(key, sorts, defaultSort) {
  const saved = remember(key) ?? {};
  const s = newState(defaultSort);
  if (typeof saved.q === 'string') s.q = saved.q;
  // 예전 모양 (cat 글자 하나, verdict 글자 하나) 도 읽어 배열로 옮긴다.
  if (Array.isArray(saved.cats)) s.cats = [...new Set(saved.cats.filter((c) => typeof c === 'string' && c !== ''))];
  else if (typeof saved.cat === 'string' && saved.cat !== '') s.cats = [saved.cat];
  const verdictValues = VERDICTS.map((v) => v.value);
  if (Array.isArray(saved.verdicts)) s.verdicts = verdictValues.filter((v) => saved.verdicts.includes(v));
  else if (verdictValues.includes(saved.verdict)) s.verdicts = [saved.verdict];
  if (has(PERIODS, saved.period)) s.period = saved.period;
  if (typeof saved.from === 'string') s.from = saved.from;
  if (typeof saved.to === 'string') s.to = saved.to;
  if (has(STATUSES, saved.status)) s.status = saved.status;
  if (has(sorts, saved.sort)) s.sort = saved.sort;
  s.starred = saved.starred === true;
  s.noted = saved.noted === true;
  s.archived = saved.archived === true;
  return s;
}

// 정렬을 뺀 필터가 하나라도 걸려 있는지.
export function isFiltered(s) {
  return s.q.trim() !== '' || s.cats.length > 0 || s.period !== 'all' || s.verdicts.length > 0 || s.status !== 'all' || s.starred || s.noted || s.archived;
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
// 분야 값 cat 은 경로를 ' › ' 로 이은 글자다 (예: '프로그래밍 언어 › C++'). 필터 상태의 cats 는 이런 글자들의 배열이다.
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

// 항목의 경로가 cats 중 하나라도 속하는지. cats 가 비면 전체다.
export function inCategories(path, cats) {
  return cats.length === 0 || cats.some((cat) => inCategory(path, cat));
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

// 분야 선택지(categoryOptions 의 글자들)와 고른 cats 로 체크박스 트리를 만든다.
// 돌려주는 것: [{ top, subs: [{ value, label }] }]. top 은 맨 위 분야, subs 는 그 아래 세부 분야다.
// 깊이 3 이상이거나 데이터에 없는 cats 도 선택지에 남겨 값을 말없이 풀지 않는다.
export function categoryTree(names, cats) {
  const tops = new Map();
  const entry = (top) => {
    if (!tops.has(top)) tops.set(top, { top, subs: [] });
    return tops.get(top);
  };
  const addSub = (top, value, label) => {
    const node = entry(top);
    if (!node.subs.some((o) => o.value === value)) node.subs.push({ value, label });
  };
  for (const name of names) {
    const [first, second] = name.split(PATH_SEP);
    entry(first);
    if (second !== undefined) addSub(first, first + PATH_SEP + second, second);
  }
  for (const cat of cats) {
    const [first, ...rest] = cat.split(PATH_SEP);
    entry(first);
    if (rest.length > 0) addSub(first, cat, rest.join(PATH_SEP));
  }
  return [...tops.values()];
}

const underTop = (cat, top) => cat === top || cat.startsWith(top + PATH_SEP);

// 맨 위 분야 체크박스를 눌렀을 때의 cats. 켜면 그 분야 전체를 넣고 그 아래 세부 분야는 뺀다 (겹친 선택을 만들지 않는다).
export function setTopChecked(cats, top, on) {
  const rest = cats.filter((c) => !underTop(c, top));
  return on ? [...rest, top] : rest;
}

// 세부 분야 체크박스를 눌렀을 때의 cats.
export function setSubChecked(cats, value, on) {
  const rest = cats.filter((c) => c !== value);
  return on ? [...rest, value] : rest;
}

// 분야 표의 줄을 눌렀을 때의 cats. 그 분야에서 고른 것이 있으면 모두 빼고, 없으면 그 분야 전체를 넣는다.
export function toggleTopCategory(cats, top) {
  const selected = cats.some((c) => underTop(c, top));
  return selected ? cats.filter((c) => !underTop(c, top)) : [...cats, top];
}

// cats 중 맨 위 분야가 top 인 것이 있는지.
export const hasTopSelected = (cats, top) => cats.some((c) => underTop(c, top));

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

// 결과 칸의 요약에 쓰는 이름. VERDICTS 순서로 정렬한다.
const verdictLabels = (verdicts) => VERDICTS.filter((v) => verdicts.includes(v.value)).map((v) => v.label);

// root 에 필터 줄을 한 번 만든다. 값이 바뀌면 onChange(state) 를 부른다 (검색칸은 입력하고 150ms 뒤).
// 분야 칸과 결과 칸은 체크박스를 펼쳐 여러 개를 고른다 (state.cats, state.verdicts).
// verdict 가 false 이면 결과 칸을 만들지 않는다.
// fields 는 보일 칸 이름 (RECORD_FIELDS, REVIEW_FIELDS). sorts 와 defaultSort 는 정렬 선택지와 기본값.
// 돌려주는 것: state (현재 값), setCategories(names), patch(값 일부), clear()
export function createFilterBar(root, { key, onChange, verdict = true, fields = RECORD_FIELDS, sorts = SORTS, defaultSort = 'new' }) {
  const state = loadState(key, sorts, defaultSort);
  const on = (name) => fields.includes(name) && (name !== 'verdict' || verdict);
  let timer = null;
  let catNames = [];
  let catKey = null;
  const catInputs = new Map(); // 체크박스 value -> { input, top } (분야 칸)

  const q = h('input', { type: 'search', name: 'q', placeholder: '검색 (띄어쓰기로 여러 단어)', 'aria-label': '검색', autocomplete: 'off' });
  const cat = createDropdown('cat');
  const period = h('select', { name: 'period' }, ...optionList(PERIODS));
  const from = h('input', { type: 'date', name: 'from', 'aria-label': '시작일' });
  const to = h('input', { type: 'date', name: 'to', 'aria-label': '종료일' });
  const dates = h('div', { class: 'filter-dates' }, h('label', {}, '시작일', from), h('label', {}, '종료일', to));
  const verdictDrop = createDropdown('verdict');
  const verdictInputs = VERDICTS.map((v) => ({ ...checkRow(v.value, v.label), value: v.value }));
  verdictDrop.body.append(...verdictInputs.map((x) => x.row));
  const sort = h('select', { name: 'sort' }, ...optionList(sorts));
  const statusSel = h('select', { name: 'status' }, ...optionList(STATUSES));
  const starred = h('input', { type: 'checkbox', name: 'starred' });
  const noted = h('input', { type: 'checkbox', name: 'noted' });
  const archived = h('input', { type: 'checkbox', name: 'archived' });
  const clear = h('button', { type: 'button', class: 'filter-clear link' }, '필터 지우기');

  const field = (text, control) => h('label', { class: 'filter-field' }, text, control);
  const check = (text, control) => h('label', { class: 'filter-check' }, control, text);
  root.replaceChildren(
    h('label', { class: 'filter-search' }, '검색', q),
    h(
      'div',
      { class: 'filter-grid' },
      on('cat') ? h('div', { class: 'filter-field' }, '분야', cat.el) : '',
      on('period') ? field('기간', period) : '',
      on('status') ? field('상태', statusSel) : '',
      on('verdict') ? h('div', { class: 'filter-field' }, '결과 (푼 문제만)', verdictDrop.el) : '',
      on('sort') ? field('정렬', sort) : '',
    ),
    on('period') ? dates : '',
    h('div', { class: 'filter-checks' }, on('starred') ? check('즐겨찾기만', starred) : '', on('noted') ? check('메모 있는 것만', noted) : '', on('archived') ? check('보관함', archived) : '', clear),
  );

  function syncUi() {
    if (q.value !== state.q) q.value = state.q;
    period.value = state.period;
    from.value = state.from;
    to.value = state.to;
    for (const x of verdictInputs) x.input.checked = state.verdicts.includes(x.value);
    verdictDrop.setSummary(verdictLabels(state.verdicts));
    statusSel.value = state.status;
    sort.value = state.sort;
    starred.checked = state.starred;
    noted.checked = state.noted;
    archived.checked = state.archived;
    dates.hidden = state.period !== 'custom';
    clear.hidden = !isFiltered(state);
    renderCats();
  }

  // 분야 칸의 체크박스를 state.cats 에 맞춰 다시 만든다. 선택지가 같으면 체크 상태만 맞춘다.
  function renderCats() {
    const tree = categoryTree(catNames, state.cats);
    const nextKey = JSON.stringify(tree);
    if (nextKey !== catKey) {
      catKey = nextKey;
      catInputs.clear();
      cat.body.replaceChildren(
        ...tree.map(({ top, subs }) => {
          const topRow = checkRow(top, top);
          catInputs.set(top, { input: topRow.input, top });
          const subRows = subs.map((o) => {
            const subRow = checkRow(o.value, o.label, { indent: true });
            catInputs.set(o.value, { input: subRow.input, top });
            return subRow.row;
          });
          return h('div', { class: 'filter-multi-group' }, topRow.row, ...subRows);
        }),
      );
    }
    for (const [value, { input, top }] of catInputs) {
      const isTop = value === top;
      // 맨 위 분야가 체크되어 있으면 그 아래 세부 분야는 체크된 채 꺼 둔다.
      const topOn = state.cats.includes(top);
      input.checked = isTop ? topOn : topOn || state.cats.includes(value);
      input.disabled = !isTop && topOn;
    }
    cat.setSummary(state.cats.map(lastNode));
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
  cat.body.addEventListener('change', (event) => {
    const entry = catInputs.get(event.target.value);
    if (!entry) return;
    const { input, top } = entry;
    state.cats = input.value === top ? setTopChecked(state.cats, top, input.checked) : setSubChecked(state.cats, input.value, input.checked);
    changed();
  });
  verdictDrop.body.addEventListener('change', () => {
    state.verdicts = verdictInputs.filter((x) => x.input.checked).map((x) => x.value);
    changed();
  });
  bind(period, 'period', (el) => el.value);
  bind(from, 'from', (el) => el.value);
  bind(to, 'to', (el) => el.value);
  bind(statusSel, 'status', (el) => el.value);
  bind(sort, 'sort', (el) => el.value);
  bind(starred, 'starred', (el) => el.checked);
  bind(noted, 'noted', (el) => el.checked);
  bind(archived, 'archived', (el) => el.checked);
  q.addEventListener('input', () => {
    state.q = q.value;
    save();
    clear.hidden = !isFiltered(state);
    clearTimeout(timer);
    timer = setTimeout(changed, SEARCH_DELAY);
  });
  clear.addEventListener('click', () => {
    Object.assign(state, newState(state.sort));
    changed();
  });

  syncUi();
  return {
    state,
    // 분야 선택지(경로 글자들)를 받아 두 칸을 다시 만든다. 고른 값이 목록에 없어도 선택지에 남겨 값을 유지한다.
    setCategories(names) {
      catNames = names;
      renderCats();
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
