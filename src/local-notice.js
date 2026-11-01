// 로컬 파일(file:)로 열렸을 때 상단에 저장소가 따로라는 안내를 보인다.
import { $ } from './dom.js';

export function updateLocalNotice() {
  $('#local-notice').hidden = location.protocol !== 'file:';
}
