// 시작점: 화면 전환 (방문 기록은 router.js), 상단 사용액·동기화 표시, 각 화면 초기화.
import { $, formatDate } from './dom.js';
import { importSetupFromHash, hasAnthropicKey } from './settings.js';
import { usageSummary, startUsageTracking } from './usage.js';
import { onChange } from './store.js';
import { startAutoSync, onStatus } from './sync.js';
import { initQuizView, startReview, startFromChat } from './views/quiz-view.js';
import { initAskView, resumeChat, continueFromRecord } from './views/ask-view.js';
import { initReviewView, renderReviewView } from './views/review-view.js';
import { initRecordsView, renderRecordsView, showRecordsDetail } from './views/records-view.js';
import { initRouter, navigate } from './router.js';
import { initSettingsView, renderSettingsView } from './views/settings-view.js';

const RENDERERS = {
  quiz: () => {},
  ask: () => {},
  review: renderReviewView,
  records: renderRecordsView,
  settings: renderSettingsView,
};

let activeView = 'quiz';

function showView(name) {
  activeView = name;
  for (const section of document.querySelectorAll('.view')) section.hidden = section.id !== `view-${name}`;
  for (const tab of document.querySelectorAll('nav [data-view]')) {
    tab.classList.toggle('active', tab.dataset.view === name);
  }
  RENDERERS[name]();
  window.scrollTo(0, 0);
}

function updateReviewBadge() {
  const count = renderReviewView();
  const badge = $('#review-badge');
  badge.textContent = count;
  badge.hidden = count === 0;
}

// 상단의 사용액 표시. 이번 주기에 이 앱에서 쓴 추정액을 동기화된 기기끼리 합친 값이다.
function updateUsageStatus() {
  const s = usageSummary();
  const el = $('#usage-status');
  el.textContent = `사용 $${s.total.toFixed(2)}`;
  el.title = `${formatDate(s.start.getTime()).split(' ')[0]} 부터 이 앱에서 쓴 추정액`;
  el.hidden = s.total === 0;
}

function updateKeyNotice() {
  $('#key-notice').hidden = hasAnthropicKey();
}

// 방문 기록의 상태대로 화면을 그린다 (router.js 가 부른다).
function applyState(state) {
  showView(state.view);
  if (state.view === 'records') showRecordsDetail(state.detail ?? null);
}

const goTo = (view) => navigate({ view });

// 기록 상세 화면의 「← 목록으로」. 목록에서 열었으면 그 뒤에 쌓인 기록 (질문 이동) 까지 한 번에 돌아간다.
function backToRecordsList() {
  const s = history.state;
  if (s?.fromList) history.go(-(1 + (s.steps ?? 0)));
  else goTo('records');
}

function init() {
  const imported = importSetupFromHash();

  // 이어서 쓰는 화면이므로 대화를 그린 뒤 문서 맨 아래로 간다. 이 위치가 이 방문 기록에 저장된다 (router.js).
  const scrollToEnd = () => window.scrollTo(0, document.documentElement.scrollHeight);
  const continueInAsk = (record) => {
    goTo('ask');
    continueFromRecord(record);
    scrollToEnd();
  };
  initQuizView({ onContinueInAsk: continueInAsk });
  initReviewView({
    onStart: (item, opts) => {
      goTo('quiz');
      startReview(item, opts);
    },
  });
  initAskView({
    onQuiz: (chat) => {
      goTo('quiz');
      startFromChat(chat);
    },
  });
  initRecordsView({
    onResume: (chat) => {
      goTo('ask');
      resumeChat(chat);
      scrollToEnd();
    },
    onContinue: continueInAsk,
    onOpen: (detail) => navigate({ view: 'records', detail, fromList: true }),
    onBack: backToRecordsList,
  });
  initSettingsView({ onKeyChange: updateKeyNotice, onUsageChange: updateUsageStatus });

  for (const tab of document.querySelectorAll('nav [data-view]')) {
    tab.addEventListener('click', () => goTo(tab.dataset.view));
  }
  $('#key-notice-link').addEventListener('click', () => goTo('settings'));
  $('#usage-status').addEventListener('click', () => goTo('settings'));
  startUsageTracking();

  onStatus((s) => {
    const el = $('#sync-status');
    el.textContent = s.state === 'off' ? '' : s.message;
    el.dataset.state = s.state;
  });
  onChange(() => {
    updateReviewBadge();
    updateUsageStatus();
    if (activeView === 'review' || activeView === 'records') RENDERERS[activeView]();
  });

  updateKeyNotice();
  updateReviewBadge();
  // 새로 고침이면 보던 화면과 스크롤 위치로 돌아간다.
  const start = initRouter({ onApply: applyState, initial: { view: hasAnthropicKey() ? 'quiz' : 'settings' } });
  applyState(start);
  window.scrollTo(0, start.scrollY ?? 0);
  if (imported) $('#import-notice').hidden = false;
  startAutoSync();
  updateUsageStatus();
}

init();
