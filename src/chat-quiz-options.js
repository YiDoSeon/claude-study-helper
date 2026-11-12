// 「묻기」 대화로 문제를 풀기 전에 난이도와 형식을 고르는 칸. 「이 내용으로 문제 풀기」 를 누르면 입력 영역 안에 열린다.
import { h, fillSelect, remember } from './dom.js';
import { DIFFICULTIES, QUESTION_TYPES } from './topics.js';

// 마지막으로 고른 값은 기기마다 chatQuizSetup 에 둔다. 처음에는 풀기 화면에 고른 값 (quizSetup) 을 따른다.
function lastSetup() {
  const own = remember('chatQuizSetup') ?? {};
  const quiz = remember('quizSetup') ?? {};
  return {
    difficulty: own.difficulty ?? quiz.difficulty ?? '기초',
    type: own.type ?? quiz.type ?? 'auto',
  };
}

// button 을 누르면 panel 을 열고 닫는다. 「문제 받기」 를 누르면 onStart({ difficulty, type }) 를 부른다.
// 돌려주는 close() 는 대화가 바뀔 때 화면 코드가 부른다.
export function attachChatQuizOptions(button, panel, onStart) {
  const difficulty = h('select', { id: 'a-quiz-difficulty' });
  const type = h('select', { id: 'a-quiz-type' });
  const start = h('button', { type: 'button', class: 'primary', onclick: () => {
    const setup = { difficulty: difficulty.value, type: type.value };
    remember('chatQuizSetup', setup);
    close();
    onStart(setup);
  } }, '문제 받기');
  const cancel = h('button', { type: 'button', onclick: () => close() }, '닫기');
  panel.replaceChildren(
    h('label', {}, '난이도 ', difficulty),
    h('label', {}, '형식 ', type),
    h('div', { class: 'quiz-options-buttons' }, start, cancel),
  );
  panel.hidden = true;

  function open() {
    const setup = lastSetup();
    fillSelect(difficulty, DIFFICULTIES.map((d) => ({ value: d, label: d })), setup.difficulty);
    fillSelect(type, QUESTION_TYPES.map((t) => ({ value: t.id, label: t.label })), setup.type);
    panel.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    type.focus();
  }

  function close() {
    panel.hidden = true;
    button.setAttribute('aria-expanded', 'false');
  }

  button.setAttribute('aria-expanded', 'false');
  button.addEventListener('click', () => (panel.hidden ? open() : close()));
  return { close };
}
