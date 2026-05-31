import { mountPage } from '../shell.js';
import { el } from '../utils.js';
import { ingestFile, photoIdToObjectUrl } from '../photos.js';
import { putPhoto } from '../db.js';

export function injectEditStylesOnce() {
  if (document.getElementById('edit-styles')) return;
  const css = `
    .form-section { margin-bottom: 18px; }
    .form-label { font-size: 12px; color: var(--c-text-2); margin-bottom: 6px; display: block; }
    .form-label .opt { color: var(--c-text-3); font-weight: 400; margin-left: 4px; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .form-section input[type="date"],
    .form-section input[type="datetime-local"] { font-family: var(--font-sans); }
    .form-section textarea { min-height: 80px; }

    .chip-row { display: flex; flex-wrap: wrap; gap: 8px; }
    .chip-row .chip {
      padding: 6px 12px;
      border: 0.5px solid var(--c-border);
      background: var(--c-surface);
      font-size: 12px;
      color: var(--c-text-2);
      cursor: pointer;
    }
    .chip-row .chip.active {
      background: var(--c-accent);
      color: var(--c-accent-d);
      border-color: var(--c-accent);
      font-weight: 500;
    }

    .cover-picker {
      position: relative; height: 180px; border-radius: var(--r-lg); overflow: hidden;
      background: linear-gradient(135deg, #C0DD97, #97C459);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer;
    }
    .cover-picker .cover { width: 100%; height: 100%; object-fit: cover; position: absolute; inset: 0; }
    .cover-picker .placeholder {
      position: relative; color: rgba(255,255,255,0.95); font-size: 13px; z-index: 2;
      background: rgba(0,0,0,0.25); padding: 6px 12px; border-radius: 999px;
    }
    .cover-picker .change-hint {
      position: absolute; right: 10px; top: 10px; z-index: 2;
      background: rgba(0,0,0,0.5); color: #fff; padding: 4px 8px; border-radius: 999px; font-size: 11px;
    }

    .photo-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
    .photo-grid .tile {
      aspect-ratio: 1; border-radius: var(--r-md); overflow: hidden; position: relative;
      background: var(--c-border-s);
    }
    .photo-grid .tile img { width: 100%; height: 100%; object-fit: cover; }
    .photo-grid .tile .del {
      position: absolute; top: 4px; right: 4px;
      width: 20px; height: 20px; border-radius: 50%; background: rgba(0,0,0,0.55); color: #fff;
      display: flex; align-items: center; justify-content: center; font-size: 12px;
    }
    .photo-grid .add {
      aspect-ratio: 1; border: 0.5px dashed var(--c-border);
      border-radius: var(--r-md); display: flex; align-items: center; justify-content: center;
      font-size: 24px; color: var(--c-text-3);
      background: transparent;
    }

    .rating-row { display: flex; gap: 4px; font-size: 22px; }
    .rating-row .star { cursor: pointer; color: var(--c-border); transition: color 0.1s; }
    .rating-row .star.on { color: var(--c-warm); }

    .form-actions { display: flex; gap: 10px; margin: 24px 0; }
    .form-actions .btn-primary { flex: 1; }
    .form-actions .btn-ghost { flex: 1; }
  `;
  const style = document.createElement('style');
  style.id = 'edit-styles';
  style.textContent = css;
  document.head.appendChild(style);
}

export function field(label, control, opts = {}) {
  return el('div', { class: 'form-section' }, [
    el('label', { class: 'form-label' }, [
      label,
      opts.optional ? el('span', { class: 'opt' }, '（选填）') : null
    ]),
    control
  ]);
}

export function chipRow(options, getCurrent, onChange) {
  const row = el('div', { class: 'chip-row' });
  const buttons = [];
  for (const opt of options) {
    const value = typeof opt === 'string' ? opt : opt.id;
    const label = typeof opt === 'string' ? opt : opt.label;
    const btn = el('button', {
      type: 'button',
      class: 'chip',
      onclick: (e) => {
        e.preventDefault();
        onChange(value);
        for (const b of buttons) b.classList.toggle('active', b.dataset.value === value);
      }
    }, label);
    btn.dataset.value = value;
    if ((typeof getCurrent === 'function' ? getCurrent() : getCurrent) === value) btn.classList.add('active');
    buttons.push(btn);
    row.appendChild(btn);
  }
  return row;
}

export function ratingPicker(getValue, onChange) {
  const row = el('div', { class: 'rating-row' });
  const stars = [];
  function repaint() {
    const v = typeof getValue === 'function' ? getValue() : getValue;
    stars.forEach((s, i) => s.classList.toggle('on', i < v));
  }
  for (let i = 1; i <= 5; i++) {
    const star = el('span', {
      class: 'star',
      onclick: (e) => {
        e.preventDefault();
        const v = typeof getValue === 'function' ? getValue() : getValue;
        const next = v === i ? 0 : i;
        onChange(next);
        const v2 = typeof getValue === 'function' ? getValue() : next;
        stars.forEach((s, j) => s.classList.toggle('on', j < v2));
      }
    }, '★');
    stars.push(star);
    row.appendChild(star);
  }
  repaint();
  return row;
}

export function coverPicker(state, key, onChange) {
  const picker = el('div', { class: 'cover-picker' });
  refreshCover();
  picker.onclick = async () => {
    const f = await pickFile({ accept: 'image/*' });
    if (!f) return;
    const photo = await ingestFile(f);
    state[key] = photo.id;
    onChange?.();
    refreshCover();
  };
  async function refreshCover() {
    picker.innerHTML = '';
    const id = state[key];
    if (id) {
      const url = await photoIdToObjectUrl(id);
      if (url) picker.appendChild(el('img', { class: 'cover', src: url, alt: '' }));
      picker.appendChild(el('div', { class: 'change-hint' }, '点击更换'));
    } else {
      picker.appendChild(el('div', { class: 'placeholder' }, '+ 添加封面照片'));
    }
  }
  return picker;
}

export function photoGrid(state, key, onChange) {
  const grid = el('div', { class: 'photo-grid' });
  refresh();
  async function refresh() {
    grid.innerHTML = '';
    const photos = state[key] || [];
    for (const p of photos) {
      const url = await photoIdToObjectUrl(p.id);
      const tile = el('div', { class: 'tile' }, [
        url ? el('img', { src: url, alt: '' }) : null,
        el('button', {
          type: 'button',
          class: 'del',
          onclick: (e) => {
            e.preventDefault();
            e.stopPropagation();
            state[key] = (state[key] || []).filter(x => x.id !== p.id);
            onChange?.();
            refresh();
          }
        }, '×')
      ]);
      grid.appendChild(tile);
    }
    const add = el('button', {
      type: 'button',
      class: 'add',
      onclick: async () => {
        const files = await pickFiles({ accept: 'image/*', multiple: true });
        if (!files || !files.length) return;
        for (const f of files) {
          const photo = await ingestFile(f);
          state[key] = state[key] || [];
          state[key].push({ id: photo.id, name: photo.originalName });
        }
        onChange?.();
        refresh();
      }
    }, '+');
    grid.appendChild(add);
  }
  return grid;
}

function pickFile({ accept = '' } = {}) {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] || null);
    input.click();
  });
}

function pickFiles({ accept = '', multiple = false } = {}) {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    if (multiple) input.multiple = true;
    input.onchange = () => resolve(Array.from(input.files || []));
    input.click();
  });
}
