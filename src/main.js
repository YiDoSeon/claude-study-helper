// 시작점: 화면 전환, 상단 동기화 표시, 각 화면 초기화.
import { $ } from './dom.js';
import { importSetupFromHash, hasAnthropicKey } from './settings.js';
import { onChange } from './store.js';
import { startAutoSync, onStatus } from './sync.js';
import { initQuizView, startReview, startFromChat } from './views/quiz-view.js';
import { initAskView, resumeChat, continueFromRecord } from './views/ask-view.js';
import { initReviewView, renderReviewView } from './views/review-view.js';
import { initRecordsView, renderRecordsView } from './views/records-view.js';
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

function updateKeyNotice() {
  $('#key-notice').hidden = hasAnthropicKey();
}

function init() {
  const imported = importSetupFromHash();

  const continueInAsk = (record) => {
    showView('ask');
    continueFromRecord(record);
  };
  initQuizView({ onContinueInAsk: continueInAsk });
  initReviewView({
    onStart: (item) => {
      showView('quiz');
      startReview(item);
    },
  });
  initAskView({
    onQuiz: (chat) => {
      showView('quiz');
      startFromChat(chat);
    },
  });
  initRecordsView({
    onResume: (chat) => {
      showView('ask');
      resumeChat(chat);
    },
    onContinue: continueInAsk,
  });
  initSettingsView({ onKeyChange: updateKeyNotice });

  for (const tab of document.querySelectorAll('nav [data-view]')) {
    tab.addEventListener('click', () => showView(tab.dataset.view));
  }
  $('#key-notice-link').addEventListener('click', () => showView('settings'));

  onStatus((s) => {
    const el = $('#sync-status');
    el.textContent = s.state === 'off' ? '' : s.message;
    el.dataset.state = s.state;
  });
  onChange(() => {
    updateReviewBadge();
    if (activeView === 'review' || activeView === 'records') RENDERERS[activeView]();
  });

  updateKeyNotice();
  updateReviewBadge();
  showView(hasAnthropicKey() ? 'quiz' : 'settings');
  if (imported) $('#import-notice').hidden = false;
  startAutoSync();
}

init();
