import { el } from './utils.js';

function injectCropperStyles() {
  const old = document.getElementById('cropper-styles');
  if (old) old.remove();
  const css = `
    .cropper-overlay {
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(20, 22, 16, 0.92);
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 20px; gap: 16px;
      -webkit-tap-highlight-color: transparent;
      user-select: none; -webkit-user-select: none;
    }
    .cropper-title { color: #fff; font-size: 15px; font-weight: 500; }
    .cropper-stage {
      position: relative; overflow: hidden;
      background: #000; border-radius: 12px;
      box-shadow: 0 0 0 1px rgba(255,255,255,0.15);
      touch-action: none; cursor: grab;
    }
    .cropper-stage:active { cursor: grabbing; }
    .cropper-stage img {
      position: absolute; left: 0; top: 0;
      max-width: none; pointer-events: none;
      -webkit-user-drag: none;
    }
    .cropper-stage::after {
      content: ''; position: absolute; inset: 0; pointer-events: none;
      box-shadow: inset 0 0 0 9999px rgba(0,0,0,0); border: 1px solid rgba(255,255,255,0.6);
      border-radius: 12px;
    }
    .cropper-grid { position: absolute; inset: 0; pointer-events: none; }
    .cropper-grid::before, .cropper-grid::after {
      content: ''; position: absolute; background: rgba(255,255,255,0.25);
    }
    .cropper-grid::before { left: 33.33%; right: 33.33%; top: 0; bottom: 0; border-left: 1px solid rgba(255,255,255,0.25); border-right: 1px solid rgba(255,255,255,0.25); }
    .cropper-grid::after  { top: 33.33%; bottom: 33.33%; left: 0; right: 0; border-top: 1px solid rgba(255,255,255,0.25); border-bottom: 1px solid rgba(255,255,255,0.25); }
    .cropper-hint { color: rgba(255,255,255,0.7); font-size: 12px; text-align: center; }
    .cropper-actions { display: flex; gap: 12px; width: 100%; max-width: 520px; }
    .cropper-actions button {
      flex: 1; padding: 12px; border-radius: 10px; font-size: 15px; font-weight: 500;
    }
    .cropper-actions .cancel { background: rgba(255,255,255,0.12); color: #fff; }
    .cropper-actions .confirm { background: #5E8F4A; color: #fff; }
    .cropper-zoom { display: flex; align-items: center; gap: 12px; width: 100%; max-width: 520px; }
    .cropper-zoom input[type="range"] { flex: 1; }
    .cropper-zoom span { color: rgba(255,255,255,0.7); font-size: 18px; width: 20px; text-align: center; }
  `;
  const style = document.createElement('style');
  style.id = 'cropper-styles';
  style.textContent = css;
  document.head.appendChild(style);
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

export function cropImage(file, aspect = 2, { outMaxW = 1200, quality = 0.85 } = {}) {
  return new Promise(async (resolve) => {
    injectCropperStyles();
    const srcUrl = URL.createObjectURL(file);
    let img;
    try {
      img = await loadImage(srcUrl);
    } catch (e) {
      URL.revokeObjectURL(srcUrl);
      resolve(null);
      return;
    }
    const natW = img.naturalWidth, natH = img.naturalHeight;

    // 取景框尺寸（受屏宽与屏高双重约束）
    const availW = Math.min(window.innerWidth - 40, 520);
    const availH = window.innerHeight - 220;
    let vw = availW, vh = vw / aspect;
    if (vh > availH) { vh = availH; vw = vh * aspect; }
    vw = Math.round(vw); vh = Math.round(vh);

    // 初始让图片刚好覆盖取景框（cover）
    const coverScale = Math.max(vw / natW, vh / natH);
    let z = 1;                 // 用户缩放倍率（>=1）
    let tx = 0, ty = 0;        // 图片中心相对取景框中心的偏移

    const imgEl = el('img', { src: srcUrl, alt: '' });
    const stage = el('div', { class: 'cropper-stage' }, [imgEl, el('div', { class: 'cropper-grid' })]);
    stage.style.width = vw + 'px';
    stage.style.height = vh + 'px';

    function dispW() { return natW * coverScale * z; }
    function dispH() { return natH * coverScale * z; }
    function clamp() {
      const maxX = Math.max(0, (dispW() - vw) / 2);
      const maxY = Math.max(0, (dispH() - vh) / 2);
      tx = Math.min(maxX, Math.max(-maxX, tx));
      ty = Math.min(maxY, Math.max(-maxY, ty));
    }
    function apply() {
      clamp();
      const w = dispW(), h = dispH();
      imgEl.style.width = w + 'px';
      imgEl.style.height = h + 'px';
      imgEl.style.left = (vw / 2 + tx - w / 2) + 'px';
      imgEl.style.top = (vh / 2 + ty - h / 2) + 'px';
    }
    apply();

    // 拖动 + 双指缩放
    const pointers = new Map();
    let startDist = 0, startZ = 1;
    stage.addEventListener('pointerdown', (e) => {
      stage.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const pts = [...pointers.values()];
        startDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        startZ = z;
      }
    });
    stage.addEventListener('pointermove', (e) => {
      if (!pointers.has(e.pointerId)) return;
      const prev = pointers.get(e.pointerId);
      if (pointers.size === 2) {
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const pts = [...pointers.values()];
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        if (startDist > 0) { z = Math.min(5, Math.max(1, startZ * dist / startDist)); syncZoom(); apply(); }
      } else {
        tx += e.clientX - prev.x;
        ty += e.clientY - prev.y;
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        apply();
      }
    });
    function endPointer(e) {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) startDist = 0;
    }
    stage.addEventListener('pointerup', endPointer);
    stage.addEventListener('pointercancel', endPointer);
    stage.addEventListener('wheel', (e) => {
      e.preventDefault();
      z = Math.min(5, Math.max(1, z * (e.deltaY < 0 ? 1.08 : 0.92)));
      syncZoom(); apply();
    }, { passive: false });

    const zoomInput = el('input', {
      type: 'range', min: '1', max: '5', step: '0.01', value: '1',
      oninput: (e) => { z = Number(e.target.value); apply(); }
    });
    function syncZoom() { zoomInput.value = String(z); }

    const overlay = el('div', { class: 'cropper-overlay' }, [
      el('div', { class: 'cropper-title' }, '调整封面'),
      stage,
      el('div', { class: 'cropper-zoom' }, [
        el('span', {}, '－'), zoomInput, el('span', {}, '＋')
      ]),
      el('div', { class: 'cropper-hint' }, '拖动照片调整位置，滑动条或双指缩放'),
      el('div', { class: 'cropper-actions' }, [
        el('button', { type: 'button', class: 'cancel', onclick: () => finish(null) }, '取消'),
        el('button', { type: 'button', class: 'confirm', onclick: () => finish(doCrop()) }, '确定')
      ])
    ]);

    function doCrop() {
      clamp();
      const s = coverScale * z;
      const cx = vw / 2 + tx - dispW() / 2;
      const cy = vh / 2 + ty - dispH() / 2;
      const sx = -cx / s, sy = -cy / s;
      const sw = vw / s, sh = vh / s;
      const outW = Math.round(Math.min(outMaxW, sw));
      const outH = Math.round(outW / aspect);
      const canvas = document.createElement('canvas');
      canvas.width = outW; canvas.height = outH;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
      return new Promise((res) => {
        canvas.toBlob(b => res(b), 'image/jpeg', quality);
      });
    }

    async function finish(blobPromise) {
      const blob = blobPromise ? await blobPromise : null;
      overlay.remove();
      URL.revokeObjectURL(srcUrl);
      resolve(blob);
    }

    document.body.appendChild(overlay);
  });
}
