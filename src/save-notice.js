// 기기 저장 실패 알림 표시. 저장이 실패하면 #save-notice 를 보이고 다음 저장이 성공하면 숨긴다.
import { $ } from './dom.js';
import { onSaveError } from './data-storage.js';

export function initSaveNotice() {
  onSaveError((err) => {
    $('#save-notice').hidden = !err;
  });
}
