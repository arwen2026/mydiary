import { el } from './utils.js';

function injectLightboxStyles() {
  const old = document.getElementById('lightbox-styles');
  if (old) old.remove();
  const css = `
    .lb-overlay {
      position: fixed; inset: 0; z-index: 10000;
      background: rgba(0, 0, 0, 0.94);
      overflow: hidden;
      touch-action: none; -webkit-tap-highlight-color: transparent;
      user-select: none; -webkit-user-select: none;
      opacity: 0; transition: opacity 0.18s ease;
    }
    .lb-overlay.show { opacity: 1; }
    .lb-track {
      position: absolute; top: 0; bottom: 0; left: 0;
      display: flex; will-change: transform;
    }
    .lb-cell {
      height: 100%; display: flex; align-items: center; justify-content: center;
      flex: 0 0 auto;
    }
    .lb-cell img {
      max-width: 100%; max-height: 100%; object-fit: contain;
      -webkit-user-drag: none; will-change: transform;
    }
    .lb-close {
      position: absolute; top: 14px; right: 16px; z-index: 5;
      width: 38px; height: 38px; border-radius: 50%;
      background: rgba(255,255,255,0.14); color: #fff; font-size: 22px;
      display: flex; align-items: center; justify-content: center;
    }
    .lb-counter {
      position: absolute; bottom: 22px; left: 0; right: 0; z-index: 5;
      text-align: center; color: rgba(255,255,255,0.85); font-size: 13px;
      letter-spacing: 0.05em; pointer-events: none;
    }
    .lb-arrow {
      position: absolute; top: 50%; transform: translateY(-50%); z-index: 5;
      width: 42px; height: 42px; border-radius: 50%;
      background: rgba(255,255,255,0.12); color: #fff; font-size: 24px;
      display: flex; align-items: center; justify-content: center;
    }
    .lb-arrow.prev { left: 12px; }
    .lb-arrow.next { right: 12px; }
    .lb-arrow.hidden { display: none; }
    @media (hover: none) { .lb-arrow { display: none; } }
  `;
  const style = document.createElement('style');
  style.id = 'lightbox-styles';
  style.textContent = css;
  document.head.appendChild(style);
}

export function openLightbox(urls, startIndex = 0) {
  const list = (urls || []).filter(Boolean);
  if (!list.length) return;
  injectLightboxStyles();

  let idx = Math.max(0, Math.min(startIndex, list.length - 1));
  const GAP = 20;                     // 相邻图片间距
  let W = window.innerWidth;
  let cellW = W + GAP;

  let scale = 1, zx = 0, zy = 0;       // 当前图缩放与平移
  const track = el('div', { class: 'lb-track' });
  const counter = el('div', { class: 'lb-counter' });
  const prevBtn = el('div', { class: 'lb-arrow prev', onclick: (e) => { e.stopPropagation(); go(-1); } }, '‹');
  const nextBtn = el('div', { class: 'lb-arrow next', onclick: (e) => { e.stopPropagation(); go(1); } }, '›');
  const closeBtn = el('div', { class: 'lb-close', onclick: () => close() }, '✕');
  const overlay = el('div', { class: 'lb-overlay' }, [track, prevBtn, nextBtn, closeBtn, counter]);

  // 用 3 个槽位渲染 [上一张, 当前, 下一张]，随切换回收复用
  let cells = [];
  function buildCells() {
    track.innerHTML = '';
    cells = [];
    for (let i = idx - 1; i <= idx + 1; i++) {
      const cell = el('div', { class: 'lb-cell' });
      cell.style.width = W + 'px';
      cell.style.marginRight = GAP + 'px';
      if (i >= 0 && i < list.length) {
        cell.appendChild(el('img', { src: list[i], alt: '' }));
      }
      cell.dataset.index = i;
      track.appendChild(cell);
      cells.push(cell);
    }
  }
  function curImg() {
    const c = cells[1];
    return c ? c.querySelector('img') : null;
  }
  function baseOffset() {
    // 当前图（中间槽位）应停在屏幕中央：track 左移 (idx 在三槽中位于第1个) → -(cellW) + ...
    // 中间槽位本身就是当前图，左侧还有 1 个槽位，故基准位移为 -cellW
    return -cellW;
  }
  function applyTrack(offset, animate) {
    track.style.transition = animate ? 'transform 0.28s cubic-bezier(0.22,0.61,0.36,1)' : 'none';
    track.style.transform = `translateX(${offset}px)`;
  }
  function applyZoom(animate) {
    const img = curImg();
    if (!img) return;
    img.style.transition = animate ? 'transform 0.2s ease' : 'none';
    img.style.transform = `translate(${zx}px, ${zy}px) scale(${scale})`;
  }
  function resetZoom() { scale = 1; zx = 0; zy = 0; applyZoom(false); }

  function relayout() {
    W = window.innerWidth; cellW = W + GAP;
    cells.forEach(c => { c.style.width = W + 'px'; c.style.marginRight = GAP + 'px'; });
    applyTrack(baseOffset(), false);
    applyZoom(false);
  }

  function refreshChrome() {
    counter.textContent = list.length > 1 ? `${idx + 1} / ${list.length}` : '';
    prevBtn.classList.toggle('hidden', idx <= 0);
    nextBtn.classList.toggle('hidden', idx >= list.length - 1);
  }

  // 切换：先把 track 动画滑到目标，再在动画结束后以新 idx 重建三槽并复位
  let animating = false;
  function go(delta) {
    const next = idx + delta;
    if (next < 0 || next >= list.length || animating) {
      applyTrack(baseOffset(), true);     // 边界回弹
      return;
    }
    animating = true;
    resetZoom();
    const target = baseOffset() - delta * cellW;
    applyTrack(target, true);
    const onEnd = () => {
      track.removeEventListener('transitionend', onEnd);
      idx = next;
      buildCells();
      applyTrack(baseOffset(), false);
      applyZoom(false);
      refreshChrome();
      animating = false;
    };
    track.addEventListener('transitionend', onEnd);
  }

  function close() {
    overlay.classList.remove('show');
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', relayout);
    setTimeout(() => overlay.remove(), 180);
  }
  function onKey(e) {
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') go(-1);
    else if (e.key === 'ArrowRight') go(1);
  }
  window.addEventListener('keydown', onKey);
  window.addEventListener('resize', relayout);

  // ---- 手势 ----
  const pointers = new Map();
  let mode = null;                  // 'swipe' | 'pan' | 'pinch'
  let startX = 0, startY = 0, startZx = 0, startZy = 0;
  let startDist = 0, startScale = 1;
  let movedX = 0, movedY = 0;
  let lastTapTime = 0;

  stage_listen();
  function stage_listen() {
    overlay.addEventListener('pointerdown', onDown);
    overlay.addEventListener('pointermove', onMove);
    overlay.addEventListener('pointerup', onUp);
    overlay.addEventListener('pointercancel', onUp);
    overlay.addEventListener('wheel', (e) => {
      e.preventDefault();
      scale = Math.min(4, Math.max(1, scale * (e.deltaY < 0 ? 1.1 : 0.9)));
      if (scale <= 1.01) { zx = 0; zy = 0; }
      applyZoom(true);
    }, { passive: false });
  }

  function onDown(e) {
    if (animating) return;
    if (e.target === closeBtn || e.target === prevBtn || e.target === nextBtn) return;
    overlay.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const p = [...pointers.values()];
      startDist = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      startScale = scale;
      mode = 'pinch';
    } else {
      startX = e.clientX; startY = e.clientY;
      startZx = zx; startZy = zy;
      movedX = 0; movedY = 0;
      mode = scale > 1.01 ? 'pan' : 'swipe';
    }
  }

  function onMove(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (mode === 'pinch' && pointers.size === 2) {
      const p = [...pointers.values()];
      const dist = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      if (startDist > 0) { scale = Math.min(4, Math.max(1, startScale * dist / startDist)); applyZoom(false); }
      return;
    }
    const dx = e.clientX - startX, dy = e.clientY - startY;
    movedX = dx; movedY = dy;
    if (mode === 'pan') {
      zx = startZx + dx; zy = startZy + dy;
      applyZoom(false);
    } else if (mode === 'swipe') {
      // 跟手拖动整条 track；到边界加阻尼
      let d = dx;
      const atStart = idx <= 0, atEnd = idx >= list.length - 1;
      if ((atStart && d > 0) || (atEnd && d < 0)) d *= 0.35;
      applyTrack(baseOffset() + d, false);
    }
  }

  function onUp(e) {
    pointers.delete(e.pointerId);
    if (mode === 'pinch') {
      if (scale <= 1.01) { zx = 0; zy = 0; applyZoom(true); }
      mode = pointers.size === 1 ? 'pan' : null;
      return;
    }
    if (mode === 'swipe') {
      const ax = Math.abs(movedX), ay = Math.abs(movedY);
      if (ay > 80 && ay > ax * 1.3) { close(); return; }      // 下/上滑关闭
      const threshold = Math.min(W * 0.25, 90);
      if (movedX <= -threshold) { go(1); }
      else if (movedX >= threshold) { go(-1); }
      else { applyTrack(baseOffset(), true); }                 // 不足阈值，顺滑回弹
    } else if (mode === 'pan') {
      if (scale <= 1.01) { zx = 0; zy = 0; applyZoom(true); }
    }
    // 双击放大/复位
    if (mode === 'swipe' && Math.abs(movedX) < 6 && Math.abs(movedY) < 6) {
      const now = Date.now();
      if (now - lastTapTime < 280) {
        scale = scale > 1.01 ? 1 : 2.2; zx = 0; zy = 0; applyZoom(true);
        lastTapTime = 0;
      } else {
        lastTapTime = now;
      }
    }
    if (pointers.size === 0) mode = null;
    else if (pointers.size === 1) mode = scale > 1.01 ? 'pan' : 'swipe';
  }

  document.body.appendChild(overlay);
  buildCells();
  relayout();
  refreshChrome();
  requestAnimationFrame(() => overlay.classList.add('show'));
}
