// 「풀기」 화면: 분야 고르기, 문제 풀기, 채점 결과, 튜터 대화.
import { $, h, fillSelect, remember } from '../dom.js';
import { renderMarkdown, renderCode } from '../markdown.js';
import { TOPICS, DIFFICULTIES, QUESTION_TYPES, CUSTOM_CATEGORY_ID, CUSTOM_CATEGORY_LABEL } from '../topics.js';
import { generateQuestion, gradeChoice, gradeAnswer, tutorContext, askTutor } from '../quiz.js';
import { describeError } from '../api.js';
import { getSetting } from '../settings.js';
import { put, list, newId } from '../store.js';
import { applyResult, dueItems } from '../review.js';

const VERDICT_LABEL = { correct: '정답', partial: '부분 정답', wrong: '오답' };
const ADD_TOPIC = '__add__';

let current = null; // { topic, difficulty, type, question, review, record, chosen, tutor }
let requestSeq = 0;

function customTopics() {
  return list('topics')
    .filter((t) => !t.deleted)
    .sort((a, b) => a.label.localeCompare(b.label, 'ko'));
}

function fillCategories(selected) {
  const options = TOPICS.map((t) => ({ value: t.id, label: t.label }));
  options.push({ value: CUSTOM_CATEGORY_ID, label: CUSTOM_CATEGORY_LABEL });
  fillSelect($('#q-category'), options, selected ?? TOPICS[0].id);
}

function fillSubtopics(selected) {
  const cat = $('#q-category').value;
  let options;
  if (cat === CUSTOM_CATEGORY_ID) {
    options = customTopics().map((t) => ({ value: t.label, label: t.label }));
    options.push({ value: ADD_TOPIC, label: '+ 새 주제 추가…' });
  } else {
    const children = TOPICS.find((t) => t.id === cat).children;
    options = [{ value: '', label: '(전체)' }, ...children.map((c) => ({ value: c, label: c }))];
  }
  fillSelect($('#q-sub'), options, selected ?? options[0].value);
}

function readSetup() {
  const catId = $('#q-category').value;
  const catLabel = catId === CUSTOM_CATEGORY_ID ? CUSTOM_CATEGORY_LABEL : TOPICS.find((t) => t.id === catId).label;
  const sub = $('#q-sub').value;
  return {
    topic: { path: [catLabel, sub].filter((s) => s && s !== ADD_TOPIC), detail: $('#q-detail').value.trim() },
    difficulty: $('#q-difficulty').value,
    type: $('#q-type').value,
  };
}

function recentConcepts(topic, limit = 15) {
  const key = topic.path.join('>');
  return list('records')
    .filter((r) => r.topic.path.join('>') === key)
    .sort((a, b) => b.at - a.at)
    .slice(0, limit)
    .map((r) => r.question.concept);
}

function setStatus(text, isError = false) {
  const el = $('#q-status');
  el.textContent = text;
  el.classList.toggle('error', isError);
  el.hidden = !text;
}

function showPanels({ setup, card, result, tutor }) {
  $('#quiz-setup').hidden = !setup;
  $('#q-card').hidden = !card;
  $('#q-result').hidden = !result;
  $('#tutor').hidden = !tutor;
}

async function startQuestion(opts) {
  const seq = ++requestSeq;
  current = { ...opts, question: null, record: null, chosen: null, tutor: null };
  $('#tutor-log').replaceChildren();
  showPanels({ setup: !opts.review, card: false, result: false, tutor: false });
  setStatus(opts.review ? `복습 문제를 만드는 중… (${opts.review.concept})` : '문제를 만드는 중…');
  $('#q-get').disabled = true;
  try {
    const question = await generateQuestion({
      topic: opts.topic,
      difficulty: opts.difficulty,
      type: opts.type,
      avoidConcepts: opts.review ? [] : recentConcepts(opts.topic),
      review: opts.review,
    });
    if (seq !== requestSeq) return; // 그사이 다른 문제를 요청했다.
    current.question = question;
    renderQuestion();
    setStatus('');
  } catch (err) {
    if (seq !== requestSeq) return;
    setStatus(describeError(err), true);
    showPanels({ setup: true, card: false, result: false, tutor: false });
  } finally {
    $('#q-get').disabled = false;
  }
}

function renderQuestion() {
  const q = current.question;
  $('#q-badge').textContent = current.review ? '복습' : current.difficulty;
  $('#q-concept').textContent = q.concept;
  $('#q-topic').textContent = [...current.topic.path, current.topic.detail].filter(Boolean).join(' › ');
  renderMarkdown($('#q-prompt'), q.prompt);
  renderCode($('#q-code'), q.code, q.code_language);

  const isChoice = q.type === 'multiple_choice' && q.choices.length > 0;
  $('#q-choices').replaceChildren(
    ...(isChoice
      ? q.choices.map((c, i) =>
          h('button', { type: 'button', class: 'choice', 'data-index': i, onclick: () => choose(i) }, `${i + 1}. ${c}`),
        )
      : []),
  );
  $('#q-answer').hidden = isChoice;
  $('#q-answer').value = '';
  $('#q-submit').disabled = isChoice;
  $('#q-submit').textContent = '제출';
  showPanels({ setup: false, card: true, result: false, tutor: false });
  $('#q-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function choose(index) {
  current.chosen = index;
  for (const btn of $('#q-choices').children) btn.classList.toggle('selected', Number(btn.dataset.index) === index);
  $('#q-submit').disabled = false;
}

async function submit(giveUp = false) {
  const q = current.question;
  const isChoice = q.type === 'multiple_choice' && q.choices.length > 0;
  let userAnswer = '';
  let grade;
  $('#q-submit').disabled = true;
  $('#q-giveup').disabled = true;
  try {
    if (giveUp) {
      grade = { verdict: 'wrong', feedback: '' };
    } else if (isChoice) {
      userAnswer = q.choices[current.chosen];
      grade = gradeChoice(q, current.chosen);
    } else {
      userAnswer = $('#q-answer').value;
      $('#q-submit').textContent = '채점 중…';
      grade = await gradeAnswer(q, userAnswer);
    }
  } catch (err) {
    setStatus(describeError(err), true);
    $('#q-submit').disabled = false;
    $('#q-submit').textContent = '제출';
    return;
  } finally {
    $('#q-giveup').disabled = false;
  }

  const record = put('records', {
    id: newId(),
    at: Date.now(),
    topic: current.topic,
    difficulty: current.difficulty,
    question: q,
    userAnswer,
    verdict: grade.verdict,
    feedback: grade.feedback,
    model: getSetting('model'),
    reviewId: current.review?.id ?? null,
  });
  applyResult(record);
  current.record = record;
  renderResult(isChoice);
}

function renderResult(isChoice) {
  const { question: q, record } = current;
  const verdict = $('#q-verdict');
  verdict.textContent = VERDICT_LABEL[record.verdict];
  verdict.className = `verdict ${record.verdict}`;
  renderMarkdown($('#q-feedback'), record.feedback);
  renderMarkdown($('#q-reference'), isChoice ? `${q.answer_index + 1}. ${q.choices[q.answer_index]}` : q.answer);
  renderMarkdown($('#q-explanation'), q.explanation);
  if (isChoice) {
    for (const btn of $('#q-choices').children) {
      const i = Number(btn.dataset.index);
      btn.disabled = true;
      btn.classList.toggle('right', i === q.answer_index);
      btn.classList.toggle('wrong', i === current.chosen && i !== q.answer_index);
    }
  }
  $('#q-submit').hidden = true;
  $('#q-giveup').hidden = true;
  $('#q-answer').readOnly = true;
  showPanels({ setup: false, card: true, result: true, tutor: false });
  $('#q-result').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetCardButtons() {
  $('#q-submit').hidden = false;
  $('#q-giveup').hidden = false;
  $('#q-answer').readOnly = false;
}

function next() {
  resetCardButtons();
  if (current.review) {
    const [item] = dueItems();
    if (item) {
      startReview(item);
    } else {
      current = null;
      showPanels({ setup: true, card: false, result: false, tutor: false });
      setStatus('오늘 복습할 문제를 다 풀었어요.');
    }
    return;
  }
  startQuestion({ topic: current.topic, difficulty: current.difficulty, type: current.type, review: null });
}

export function startReview(item) {
  resetCardButtons();
  startQuestion({ topic: item.topic, difficulty: item.difficulty, type: 'auto', review: item });
}

// ── 튜터 ──────────────────────────────────────────────

function openTutor() {
  current.tutor ??= { messages: [] };
  $('#tutor').hidden = false;
  $('#tutor-input').focus();
  $('#tutor').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function appendBubble(role, text) {
  const body = h('div', { class: 'md' });
  if (role === 'user') body.textContent = text;
  else renderMarkdown(body, text);
  const bubble = h('div', { class: `bubble ${role}` }, body);
  $('#tutor-log').append(bubble);
  return body;
}

async function sendTutor(event) {
  event.preventDefault();
  const input = $('#tutor-input');
  const text = input.value.trim();
  if (!text || !current?.record) return;
  const tutor = current.tutor;
  const content = tutor.messages.length === 0 ? `${tutorContext(current.record)}\n\n## 질문\n${text}` : text;
  tutor.messages.push({ role: 'user', content });
  input.value = '';
  appendBubble('user', text);
  const body = appendBubble('assistant', '…');
  const button = $('#tutor-form button');
  button.disabled = true;

  let acc = '';
  let frame = 0;
  try {
    const message = await askTutor({
      messages: tutor.messages,
      onText: (delta) => {
        acc += delta;
        if (!frame) {
          frame = requestAnimationFrame(() => {
            frame = 0;
            renderMarkdown(body, acc);
          });
        }
      },
    });
    cancelAnimationFrame(frame);
    renderMarkdown(body, acc);
    // thinking 블록까지 포함한 content 전체를 그대로 이어 붙인다.
    tutor.messages.push({ role: 'assistant', content: message.content });
    // 기록에는 화면에 보인 질문과 답 글만 남긴다.
    current.record = put('records', {
      ...current.record,
      tutor: [...(current.record.tutor ?? []), { q: text, a: acc, at: Date.now() }],
    });
  } catch (err) {
    cancelAnimationFrame(frame);
    tutor.messages.pop();
    body.textContent = describeError(err);
    body.parentElement.classList.add('error');
  } finally {
    button.disabled = false;
  }
}

// ── 초기화 ────────────────────────────────────────────

export function initQuizView() {
  const saved = remember('quizSetup') ?? {};
  fillCategories(saved.category);
  fillSubtopics(saved.sub);
  $('#q-detail').value = saved.detail ?? '';
  fillSelect($('#q-difficulty'), DIFFICULTIES.map((d) => ({ value: d, label: d })), saved.difficulty ?? '기초');
  fillSelect($('#q-type'), QUESTION_TYPES.map((t) => ({ value: t.id, label: t.label })), saved.type ?? 'auto');

  $('#q-category').addEventListener('change', () => fillSubtopics());
  $('#q-sub').addEventListener('change', () => {
    if ($('#q-sub').value !== ADD_TOPIC) return;
    const label = (prompt('새 주제 이름') ?? '').trim();
    if (label && !customTopics().some((t) => t.label === label)) put('topics', { id: newId(), label });
    fillSubtopics(label || undefined);
  });

  $('#quiz-setup').addEventListener('submit', (event) => {
    event.preventDefault();
    remember('quizSetup', {
      category: $('#q-category').value,
      sub: $('#q-sub').value,
      detail: $('#q-detail').value,
      difficulty: $('#q-difficulty').value,
      type: $('#q-type').value,
    });
    resetCardButtons();
    startQuestion({ ...readSetup(), review: null });
  });
  $('#q-submit').addEventListener('click', () => submit(false));
  $('#q-giveup').addEventListener('click', () => submit(true));
  $('#q-next').addEventListener('click', next);
  $('#q-change').addEventListener('click', () => {
    requestSeq++;
    current = null;
    resetCardButtons();
    setStatus('');
    showPanels({ setup: true, card: false, result: false, tutor: false });
  });
  $('#q-ask').addEventListener('click', openTutor);
  $('#tutor-form').addEventListener('submit', sendTutor);
  $('#tutor-input').addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) $('#tutor-form').requestSubmit();
  });
}
