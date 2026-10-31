// 시작점: 화면 전환, 상단 사용액·동기화 표시, 각 화면 초기화.
import { $, formatDate } from './dom.js';
import { importSetupFromHash, hasAnthropicKey } from './settings.js';
import { usageSummary, startUsageTracking } from './usage.js';
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

function init() {
  const imported = importSetupFromHash();
  // 기록 상세 화면과 질문 목록이 넣은 방문 기록으로 뒤로 갈 때의 스크롤 위치는 각자 되돌린다
  // (records-view.js, chat-nav.js). 브라우저가 따로 되돌려 섞이지 않게 끈다.
  history.scrollRestoration = 'manual';

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
  initSettingsView({ onKeyChange: updateKeyNotice, onUsageChange: updateUsageStatus });

  for (const tab of document.querySelectorAll('nav [data-view]')) {
    tab.addEventListener('click', () => showView(tab.dataset.view));
  }
  $('#key-notice-link').addEventListener('click', () => showView('settings'));
  $('#usage-status').addEventListener('click', () => showView('settings'));
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
  showView(hasAnthropicKey() ? 'quiz' : 'settings');
  if (imported) $('#import-notice').hidden = false;
  startAutoSync();
  updateUsageStatus();
}

init();
