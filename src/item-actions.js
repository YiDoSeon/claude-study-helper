// 「풀기」, 「묻기」, 「대화」 화면에서 지금 보고 있는 기록에 바로 쓰는 즐겨찾기, 보관, 삭제 버튼.
// 기록 화면과 같은 저장소 (favorites.js, archive.js) 와 삭제 흐름 (trash.js) 을 쓴다.
import { h } from './dom.js';
import { isStarred, toggleStar } from './favorites.js';
import { isArchived, toggleArchive } from './archive.js';
import { deleteItem } from './trash.js';
import { tapConfirm } from './tap-confirm.js';
import { onChange } from './store.js';

// slot 은 버튼을 넣을 빈 요소 (ui.html 의 .item-actions) 다.
// getTarget() 은 지금 기록 { kind: 'record' | 'chat', id } 를 주고, 아직 저장하지 않았으면 null 을 준다. null 이면 버튼을 숨긴다.
// onDeleted(target) 는 삭제를 눌러 화면에서 치울 때, onRestored(target) 는 알림의 「되돌리기」 를 눌렀을 때 부른다.
// 돌려주는 refresh() 는 화면이 다른 기록으로 바뀔 때마다 부른다.
export function attachItemActions(slot, { getTarget, onDeleted, onRestored }) {
  const star = h('button', {
    type: 'button',
    class: 'item-star',
    title: '즐겨찾기',
    'aria-label': '즐겨찾기',
    'aria-pressed': 'false',
    onclick: () => {
      const target = getTarget();
      if (!target) return;
      toggleStar(target.kind, target.id);
      refresh();
    },
  }, '☆');
  const archive = h('button', {
    type: 'button',
    class: 'item-archive',
    onclick: () => {
      const target = getTarget();
      if (!target) return;
      toggleArchive(target.kind, target.id);
      refresh();
    },
  }, '보관');
  const del = h('button', { type: 'button', class: 'item-delete' }, '삭제');
  tapConfirm(del, {
    confirmLabel: '한 번 더 누르면 삭제',
    onConfirm: () => {
      const target = getTarget();
      if (!target) return;
      deleteItem(target.kind, target.id, { onHide: () => onDeleted(target), onUndo: () => onRestored(target) });
    },
  });
  slot.replaceChildren(star, archive, del);

  // 표시를 저장소 값에 맞춘다. 다른 기기에서 바꾼 값이 동기화로 들어와도 맞춘다.
  function refresh() {
    const target = getTarget();
    slot.hidden = !target;
    if (!target) return;
    const on = isStarred(target.kind, target.id);
    star.textContent = on ? '★' : '☆';
    star.setAttribute('aria-pressed', String(on));
    archive.textContent = isArchived(target.kind, target.id) ? '보관 해제' : '보관';
  }

  onChange(refresh);
  refresh();
  return { refresh };
}
