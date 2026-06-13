import { el } from './utils.js';

function injectLightboxStyles() {
  const old = document.getElementById('lightbox-styles');
  if (old) old.remove();
  const css = `
    .lb-overlay {
      position: fixed; inset: 0; z-index: 10000;
      background: rgba(0, 0, 0, 0.94);
      display: flex; align-items: center; justify-content: center;
      touch-action: none; -webkit-tap-highlight-color: transparent;
      user-select: none; -webkit-user-select: none;
      opacity: 0; transition: opacity 0.18s ease;
    }
    .lb-overlay.show { opacity: 1; }
    .lb-stage {
      position: absolute; inset: 0; overflow: hidden;
      display: flex; align-items: center; justify-content: center;
    }
    .lb-img {
      max-width: 100%; max-height: 100%; object-fit: contain;
      -webkit-user-drag: none; will-change: transform;
      transition: transform 0.2s ease;
    }
    .lb-img.dragging { transition: none; }
    .lb-close {
      position: absolute; top: 14px; right: 16px; z-index: 3;
      width: 38px; height: 38px; border-radius: 50%;
      background: rgba(255,255,255,0.14); color: #fff; font-size: 22px;
      display: flex; align-items: center; justify-content: center;
    }
    .lb-counter {
      position: absolute; bottom: 22px; left: 0; right: 0; z-index: 3;
      text-align: center; color: rgba(255,255,255,0.85); font-size: 13px;
      letter-spacing: 0.05em; pointer-events: none;
    }
    .lb-arrow {
      position: absolute; top: 50%; transform: translateY(-50%); z-index: 3;
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
  let scale = 1, tx = 0, ty = 0;

  const imgEl = el('img', { class: 'lb-img', src: list[idx], alt: '' });
  const stage = el('div', { class: 'lb-stage' }, [imgEl]);
  const counter = el('div', { class: 'lb-counter' });
  const prevBtn = el('div', { class: 'lb-arrow prev', onclick: (e) => { e.stopPropagation(); go(-1); } }, '‹');
  const nextBtn = el('div', { class: 'lb-arrow next', onclick: (e) => { e.stopPropagation(); go(1); } }, '›');
  const closeBtn = el('div', { class: 'lb-close', onclick: () => close() }, '✕');

  const overlay = el('div', { class: 'lb-overlay' }, [stage, prevBtn, nextBtn, closeBtn, counter]);

  function applyTransform(animate) {
    imgEl.classList.toggle('dragging', !animate);
    imgEl.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  }
  function resetZoom() { scale = 1; tx = 0; ty = 0; applyTransform(true); }
  function refresh() {
    imgEl.src = list[idx];
    resetZoom();
    counter.textContent = list.length > 1 ? `${idx + 1} / ${list.length}` : '';
    prevBtn.classList.toggle('hidden', idx <= 0);
    nextBtn.classList.toggle('hidden', idx >= list.length - 1);
  }
  function go(delta) {
    const next = idx + delta;
    if (next < 0 || next >= list.length) return;
    idx = next;
    refresh();
  }
  function close() {
    overlay.classList.remove('show');
    window.removeEventListener('keydown', onKey);
    setTimeout(() => overlay.remove(), 180);
  }

  function onKey(e) {
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') go(-1);
    else if (e.key === 'ArrowRight') go(1);
  }
  window.addEventListener('keydown', onKey);

  // 手势：单指拖动（缩放时平移 / 未缩放时左右滑切换+下滑关闭）、双指捏合、双击放大
  const pointers = new Map();
  let mode = null;            // 'pan' | 'pinch'
  let startTx = 0, startTy = 0, startX = 0, startY = 0;
  let startDist = 0, startScale = 1;
  let lastTap = 0;
  let swipeCandidate = false;

  stage.addEventListener('pointerdown', (e) => {
    stage.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const p = [...pointers.values()];
      startDist = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      startScale = scale;
      mode = 'pinch';
      swipeCandidate = false;
    } else {
      startX = e.clientX; startY = e.clientY;
      startTx = tx; startTy = ty;
      mode = 'pan';
      swipeCandidate = scale <= 1.01;
    }
  });

  stage.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (mode === 'pinch' && pointers.size === 2) {
      const p = [...pointers.values()];
      const dist = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      if (startDist > 0) { scale = Math.min(4, Math.max(1, startScale * dist / startDist)); applyTransform(false); }
    } else if (mode === 'pan') {
      const dx = e.clientX - startX, dy = e.clientY - startY;
      if (scale > 1.01) {
        tx = startTx + dx; ty = startTy + dy;
        applyTransform(false);
      } else {
        // 未放大：跟随手指做轻微位移反馈
        tx = dx; ty = dy;
        applyTransform(false);
      }
    }
  });

  function endPointer(e) {
    pointers.delete(e.pointerId);
    if (mode === 'pan' && swipeCandidate && scale <= 1.01) {
      const dx = tx, dy = ty;
      const ax = Math.abs(dx), ay = Math.abs(dy);
      if (ay > 90 && ay > ax) { close(); return; }       // 下滑/上滑关闭
      if (ax > 60 && ax > ay) {                            // 左右滑切换
        if (dx < 0) go(1); else go(-1);
      }
      tx = 0; ty = 0; applyTransform(true);
    }
    if (scale <= 1.01) { tx = 0; ty = 0; applyTransform(true); }
    if (pointers.size === 0) mode = null;
    else if (pointers.size === 1) mode = 'pan';
  }
  stage.addEventListener('pointerup', endPointer);
  stage.addEventListener('pointercancel', endPointer);

  stage.addEventListener('wheel', (e) => {
    e.preventDefault();
    scale = Math.min(4, Math.max(1, scale * (e.deltaY < 0 ? 1.1 : 0.9)));
    if (scale <= 1.01) { tx = 0; ty = 0; }
    applyTransform(true);
  }, { passive: false });

  // 双击/双触放大复位
  stage.addEventListener('click', (e) => {
    const now = Date.now();
    if (now - lastTap < 280) {
      scale = scale > 1.01 ? 1 : 2.2;
      tx = 0; ty = 0;
      applyTransform(true);
      lastTap = 0;
    } else {
      lastTap = now;
      // 点空白处（图片外）关闭
      if (e.target === stage || e.target === overlay) {
        setTimeout(() => { if (Date.now() - lastTap >= 280) {} }, 0);
        if (scale <= 1.01) close();
      }
    }
  });

  document.body.appendChild(overlay);
  refresh();
  requestAnimationFrame(() => overlay.classList.add('show'));
}
