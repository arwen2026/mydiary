import { mountPage } from '../shell.js';
import { el, fmtDateRange, fmtMoney, dayDiff, fmtDate, fmtLocalHM } from '../utils.js';
import { getTrip, listEntriesByTrip, deleteEntry, putTrip } from '../db.js';
import { photoIdToObjectUrl, ingestFile, ingestBlob } from '../photos.js';
import { navigate } from '../router.js';
import { CATEGORIES } from '../config.js';
import { renderReader } from './reader.js';
import { exportTripAsHTML } from '../export.js';
import { cropImage } from '../cropper.js';
import { openLightbox } from '../lightbox.js';

let activeDayKey = null;

export async function renderTripDetail({ params, query }) {
  const t = await getTrip(params.id);
  if (!t) {
    mountPage({
      title: '未找到',
      leftBtn: { icon: '‹', onclick: () => navigate('#/') },
      content: el('div', { class: 'empty' }, [
        el('div', { class: 'icon' }, '○'),
        el('div', { class: 'title' }, '行程不存在或已被删除')
      ])
    });
    return;
  }

  const entries = await listEntriesByTrip(t.id);
  entries.sort((a, b) => (a.datetime || '').localeCompare(b.datetime || ''));

  const isReadMode = query.mode === 'read';
  injectStylesOnce();

  if (isReadMode) {
    await renderReader(t, entries);
    return;
  }

  const coverUrl = t.coverPhotoId ? await photoIdToObjectUrl(t.coverPhotoId) : null;
  const totalDays = dayDiff(t.startDate, t.endDate);
  const totalCost = entries.reduce((s, e) => s + (Number(e.cost) || 0), 0);
  const totalPhotos = entries.reduce((s, e) => s + (e.photos?.length || 0), 0);

  const days = computeDays(t, entries);
  if (!activeDayKey || !days.find(d => d.key === activeDayKey)) {
    const todayKey = todayInRange(days);
    const firstWithEntries = days.find(d => d.entries.length > 0);
    activeDayKey = todayKey || firstWithEntries?.key || (days[0]?.key) || null;
  }

  const cover = buildCover(t, coverUrl);

  const summary = el('div', { class: 'trip-summary' }, [
    el('a', {
      class: 'trip-edit-link',
      href: `#/edit/trip/${t.id}`,
      title: '编辑行程信息'
    }, '✎ 编辑'),
    el('div', { class: 'sum-item' }, [
      el('div', { class: 'sum-label' }, '日期'),
      el('div', { class: 'sum-value' }, fmtDateRange(t.startDate, t.endDate) || '—')
    ]),
    el('div', { class: 'sum-item' }, [
      el('div', { class: 'sum-label' }, '条目'),
      el('div', { class: 'sum-value' }, String(entries.length))
    ]),
    el('div', { class: 'sum-item' }, [
      el('div', { class: 'sum-label' }, '照片'),
      el('div', { class: 'sum-value' }, String(totalPhotos))
    ]),
    el('div', { class: 'sum-item' }, [
      el('div', { class: 'sum-label' }, '花费'),
      el('div', { class: 'sum-value' }, fmtMoney(totalCost))
    ])
  ]);

  const dayTabs = renderDayTabs(days, t.id);
  const timeline = await renderTimeline(days, t.id);

  const content = el('div', { class: 'trip-page' }, [cover, summary, dayTabs, timeline]);

  mountPage({
    title: t.title,
    sub: '记录模式',
    leftBtn: { icon: '‹', onclick: () => navigate('#/') },
    rightBtns: [
      { icon: '◫', label: '阅读模式', onclick: () => navigate(`#/trip/${t.id}?mode=read`) },
      { icon: '⋯', label: '更多', onclick: () => showMore(t) }
    ],
    content,
    fab: { icon: '+', onclick: () => navigate(`#/edit/entry/${t.id}/new?day=${activeDayKey || ''}`) }
  });
}

function buildCover(trip, coverUrl) {
  const totalDays = dayDiff(trip.startDate, trip.endDate);
  const wrap = el('div', { class: 'trip-cover' + (coverUrl ? ' has-cover' : '') });

  const renderInner = (url) => {
    wrap.innerHTML = '';
    wrap.classList.toggle('has-cover', !!url);
    if (url) {
      wrap.appendChild(el('img', { src: url, alt: '' }));
      wrap.appendChild(el('div', { class: 'mask' }));
    }
    wrap.appendChild(el('div', { class: 'cover-body' }, [
      el('div', { class: 'cover-title' }, trip.title || '未命名'),
      el('div', { class: 'cover-meta' },
        [(trip.city || []).join(' · '), totalDays ? `${totalDays} 天` : ''].filter(Boolean).join(' · '))
    ]));
    wrap.appendChild(el('div', { class: 'cover-edit-hint' }, url ? '点击更换封面' : '+ 添加封面'));
  };

  renderInner(coverUrl);

  wrap.addEventListener('click', async (e) => {
    e.preventDefault();
    if (wrap.dataset.busy === '1') return;
    let f;
    try {
      f = await pickImage();
    } catch (err) {
      console.error('[cover] pickImage failed', err);
      alert('选择文件失败：' + (err?.message || err));
      return;
    }
    if (!f) return;
    console.log('[cover] picked file', f.name, f.type, f.size);
    wrap.dataset.busy = '1';
    try {
      const cropped = await cropImage(f, 2);
      if (!cropped) { wrap.dataset.busy = '0'; return; }
      const photo = await ingestBlob(cropped, f.name || 'cover.jpg');
      console.log('[cover] photo ingested', photo.id, 'blob size=', photo.blob?.size);
      trip.coverPhotoId = photo.id;
      trip.updatedAt = new Date().toISOString();
      await putTrip(trip);
      console.log('[cover] trip saved with coverPhotoId=', photo.id);
      const url = await photoIdToObjectUrl(photo.id);
      console.log('[cover] objectURL=', url);
      if (!url) throw new Error('无法生成图片预览 URL');
      renderInner(url);
    } catch (err) {
      console.error('[cover] save failed', err);
      alert('封面保存失败：' + (err?.message || err));
    } finally {
      wrap.dataset.busy = '0';
    }
  });

  return wrap;
}

function pickImage() {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => resolve(input.files?.[0] || null);
    input.click();
  });
}

function computeDays(trip, entries) {
  const days = [];
  if (trip.startDate && trip.endDate) {
    const startKey = trip.startDate;
    const endKey = trip.endDate;
    let key = startKey;
    let i = 0;
    while (key <= endKey) {
      i++;
      days.push({ key, date: parseDateKey(key), index: i, entries: [] });
      key = nextDayKey(key);
      if (i > 365) break;
    }
  }
  for (const entry of entries) {
    if (!entry.datetime) continue;
    const key = entryKeyLocal(entry.datetime);
    let day = days.find(d => d.key === key);
    if (!day) {
      day = { key, date: parseDateKey(key), index: 0, entries: [], outOfRange: true };
      days.push(day);
    }
    day.entries.push(entry);
  }
  days.sort((a, b) => a.key.localeCompare(b.key));
  days.forEach((d, i) => d.index = i + 1);
  return days;
}

function parseDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function nextDayKey(key) {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function entryKeyLocal(iso) {
  const d = new Date(iso);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function todayInRange(days) {
  const now = new Date();
  const today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  return days.find(d => d.key === today)?.key;
}

function renderDayTabs(days, tripId) {
  if (!days.length) return el('div');
  const row = el('div', { class: 'day-tabs' });
  for (const d of days) {
    const cls = 'day-tab' + (d.key === activeDayKey ? ' active' : '') + (d.outOfRange ? ' out' : '');
    const btn = el('button', {
      class: cls,
      onclick: () => {
        activeDayKey = d.key;
        renderTripDetail({ params: { id: tripId }, query: {} });
      }
    }, [
      el('div', { class: 'day-num' }, d.outOfRange ? '游离' : `D${d.index}`),
      el('div', { class: 'day-date' }, fmtDate(d.date, false)),
      d.entries.length ? el('div', { class: 'day-count' }, `${d.entries.length} 条`) : null
    ]);
    row.appendChild(btn);
  }
  return row;
}

async function renderTimeline(days, tripId) {
  const day = days.find(d => d.key === activeDayKey);
  if (!day) {
    return el('div', { class: 'empty' }, [
      el('div', { class: 'icon' }, '◌'),
      el('div', { class: 'title' }, '还没有任何记录'),
      el('div', { class: 'desc' }, '点右下角 + 添加第一条')
    ]);
  }
  if (!day.entries.length) {
    return el('div', { class: 'timeline-day' }, [
      el('div', { class: 'day-banner' }, [
        el('div', { class: 'day-banner-num' }, `Day ${day.index}`),
        el('div', { class: 'day-banner-date' }, fmtDate(day.date) + ' · ' + weekday(day.date))
      ]),
      el('div', { class: 'empty', style: { padding: '40px 0' } }, [
        el('div', { class: 'icon' }, '＋'),
        el('div', { class: 'desc' }, '当天还没有记录，点右下角加一条')
      ])
    ]);
  }

  const lane = el('div', { class: 'timeline-lane' });
  for (let i = 0; i < day.entries.length; i++) {
    const e = day.entries[i];
    const isLast = i === day.entries.length - 1;
    lane.appendChild(await renderEntry(e, tripId, isLast));
  }

  return el('div', { class: 'timeline-day' }, [
    el('div', { class: 'day-banner' }, [
      el('div', { class: 'day-banner-num' }, `Day ${day.index}`),
      el('div', { class: 'day-banner-date' }, fmtDate(day.date) + ' · ' + weekday(day.date))
    ]),
    lane
  ]);
}

async function renderEntry(entry, tripId, isLast) {
  const cat = CATEGORIES.find(c => c.id === entry.category) || CATEGORIES[0];
  const time = entry.datetime ? fmtLocalHM(entry.datetime) : '--:--';
  const allPhotos = entry.photos || [];
  const allUrls = await Promise.all(allPhotos.map(p => photoIdToObjectUrl(p.id)));
  const shownUrls = allUrls.slice(0, 3);
  const extra = allUrls.length - 3;

  const delBtn = el('button', {
    type: 'button',
    class: 'entry-del',
    title: '删除',
    onclick: (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleEntryDelete(delBtn, entry, tripId);
    }
  }, '×');

  const photoTiles = shownUrls.filter(Boolean).map((url, i) => {
    const tile = el('div', { class: 'epic' }, el('img', { src: url, alt: '' }));
    if (i === 2 && extra > 0) {
      tile.appendChild(el('div', { class: 'epic-more' }, `+${extra}`));
    }
    tile.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openLightbox(allUrls, i);
    });
    return tile;
  });

  return el('a', {
    class: 'entry-row',
    href: `#/edit/entry/${tripId}/${entry.id}`
  }, [
    el('div', { class: 'entry-rail' }, [
      el('div', { class: 'entry-time' }, time),
      el('div', { class: 'entry-dot', style: { background: cat.color } }),
      isLast ? null : el('div', { class: 'entry-line' })
    ]),
    el('div', { class: 'entry-body' }, [
      delBtn,
      el('div', { class: 'entry-cat', style: { color: cat.color } }, cat.label),
      el('div', { class: 'entry-title' }, entry.title || '未命名'),
      entry.note ? el('div', { class: 'entry-note' }, entry.note) : null,
      photoTiles.length ? el('div', { class: 'entry-photos' }, photoTiles) : null,
      el('div', { class: 'entry-foot' }, [
        entry.location ? el('span', {}, entry.location) : null,
        entry.cost ? el('span', { class: 'cost' }, fmtMoney(entry.cost)) : null
      ])
    ])
  ]);
}

async function handleEntryDelete(btn, entry, tripId) {
  if (btn.classList.contains('confirm')) {
    await deleteEntry(entry.id);
    renderTripDetail({ params: { id: tripId }, query: {} });
    return;
  }
  btn.classList.add('confirm');
  btn.textContent = '确定删除？';
  const reset = () => {
    btn.classList.remove('confirm');
    btn.textContent = '×';
    btn.removeEventListener('blur', reset);
  };
  btn.focus();
  btn.addEventListener('blur', reset);
  setTimeout(() => {
    if (btn.classList.contains('confirm')) reset();
  }, 3000);
}

function weekday(d) {
  const w = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return w[(d instanceof Date ? d : new Date(d)).getDay()];
}

function showMore(trip) {
  const sheet = el('div', { class: 'sheet-overlay', onclick: e => { if (e.target === sheet) sheet.remove(); } });
  let useChapterDivider = false;

  const dividerToggle = el('label', { class: 'sheet-toggle' }, [
    el('input', {
      type: 'checkbox',
      onchange: e => { useChapterDivider = e.target.checked; }
    }),
    el('span', {}, '导出 HTML 时启用 Day 章节扉页（更隆重，适合分享）')
  ]);

  const panel = el('div', { class: 'sheet-panel' }, [
    el('div', { class: 'sheet-title' }, '更多操作'),
    el('button', {
      class: 'sheet-btn',
      onclick: () => { sheet.remove(); navigate(`#/edit/trip/${trip.id}`); }
    }, [
      el('div', { class: 'sheet-btn-icon' }, '✎'),
      el('div', { class: 'sheet-btn-text' }, [
        el('div', { class: 'sheet-btn-title' }, '编辑行程信息'),
        el('div', { class: 'sheet-btn-desc' }, '标题 / 日期 / 城市 / 状态 / 封面 / 前言 / 评价')
      ])
    ]),
    el('button', {
      class: 'sheet-btn',
      onclick: async () => { sheet.remove(); await exportTripAsHTML(trip.id, { useChapterDivider }); }
    }, [
      el('div', { class: 'sheet-btn-icon' }, '◫'),
      el('div', { class: 'sheet-btn-text' }, [
        el('div', { class: 'sheet-btn-title' }, '导出单页 HTML'),
        el('div', { class: 'sheet-btn-desc' }, '阅读态游记打包成离线 HTML，发给朋友直接打开就能看')
      ])
    ]),
    dividerToggle,
    el('button', { class: 'sheet-cancel', onclick: () => sheet.remove() }, '取消')
  ]);
  sheet.appendChild(panel);
  document.body.appendChild(sheet);
}

function renderReadModePlaceholder(trip) {
  mountPage({
    title: trip.title,
    sub: '阅读模式',
    leftBtn: { icon: '‹', onclick: () => navigate('#/') },
    rightBtns: [{ icon: '✎', label: '记录模式', onclick: () => navigate(`#/trip/${trip.id}`) }],
    content: el('div', { class: 'empty', style: { padding: '60px 24px' } }, [
      el('div', { class: 'icon' }, '◫'),
      el('div', { class: 'title' }, '阅读态游记'),
      el('div', { class: 'desc' }, '已迁移到 reader.js')
    ])
  });
}

function injectStylesOnce() {
  const old = document.getElementById('trip-styles');
  if (old) old.remove();
  const css = `
    .trip-page { padding-bottom: 32px; }
    .trip-cover {
      position: relative; height: 180px;
      margin: 16px 16px 0;
      border-radius: 16px;
      background: linear-gradient(135deg, #C0DD97, #97C459);
      overflow: hidden;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      border: 0.5px solid var(--c-border);
      box-shadow: 0 2px 8px rgba(42, 46, 31, 0.06);
    }
    .trip-cover img { width: 100%; height: 100%; object-fit: cover; position: absolute; inset: 0; }
    .trip-cover .mask { position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.55), rgba(0,0,0,0) 60%); }
    .trip-cover .cover-body { position: absolute; left: 16px; right: 16px; bottom: 14px; color: #fff; z-index: 2; }
    .trip-cover .cover-title { font-size: 22px; font-weight: 500; }
    .trip-cover .cover-meta { font-size: 12px; opacity: 0.92; margin-top: 4px; }
    .trip-cover .cover-edit-hint {
      position: absolute; right: 10px; top: 10px; z-index: 3;
      background: rgba(0,0,0,0.5); color: #fff;
      padding: 5px 10px; border-radius: 999px; font-size: 11px;
      backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
      pointer-events: none;
    }
    .trip-cover:not(.has-cover) .cover-edit-hint {
      top: 50%; right: 50%; transform: translate(50%, -50%);
      background: rgba(255,255,255,0.92); color: var(--c-primary-d);
      font-weight: 500; padding: 8px 16px; font-size: 13px;
    }
    .trip-cover:not(.has-cover) .cover-body { display: none; }
    .trip-cover[data-busy="1"]::after {
      content: ''; position: absolute; inset: 0;
      background: rgba(0,0,0,0.35); z-index: 4;
    }

    .trip-summary {
      position: relative;
      margin: 12px 16px 16px; padding: 14px;
      background: var(--c-surface); border: 0.5px solid var(--c-border); border-radius: var(--r-lg);
      display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;
    }
    .trip-edit-link {
      position: absolute; top: 10px; right: 12px;
      font-size: 11px; color: var(--c-primary);
      padding: 4px 10px; border-radius: 999px;
      background: var(--c-accent);
      line-height: 1; text-decoration: none;
      transition: background 0.15s;
    }
    .trip-edit-link:hover, .trip-edit-link:active {
      background: var(--c-accent-d, var(--c-accent)); color: #fff;
    }
    .sum-label { font-size: 11px; color: var(--c-text-2); }
    .sum-value { font-size: 14px; font-weight: 500; margin-top: 2px; color: var(--c-text-1); }

    .day-tabs {
      display: flex; gap: 8px; padding: 0 16px 12px; overflow-x: auto;
      -ms-overflow-style: none; scrollbar-width: none;
    }
    .day-tabs::-webkit-scrollbar { display: none; }
    .day-tab {
      flex-shrink: 0; padding: 8px 12px; min-width: 56px;
      border-radius: var(--r-md); background: var(--c-surface);
      border: 0.5px solid var(--c-border);
      display: flex; flex-direction: column; align-items: center; gap: 2px;
      cursor: pointer; transition: all 0.15s;
    }
    .day-tab.active {
      background: var(--c-accent); color: var(--c-accent-d);
      border-color: var(--c-accent);
    }
    .day-tab.out {
      border-color: var(--c-warm); border-style: dashed;
    }
    .day-tab.out.active {
      background: var(--c-warm); color: var(--c-warm-d); border-color: var(--c-warm); border-style: solid;
    }
    .day-num { font-size: 12px; font-weight: 500; }
    .day-date { font-size: 10px; color: var(--c-text-2); }
    .day-tab.active .day-date { color: var(--c-accent-d); }
    .day-tab.out.active .day-date { color: var(--c-warm-d); }
    .day-count { font-size: 9px; color: var(--c-primary); margin-top: 1px; }
    .day-tab.active .day-count { color: var(--c-accent-d); }

    .timeline-day { padding: 0 16px; }
    .day-banner {
      padding: 14px 0 16px; border-bottom: 0.5px solid var(--c-border); margin-bottom: 16px;
      display: flex; justify-content: space-between; align-items: baseline;
    }
    .day-banner-num { font-size: 13px; font-weight: 500; color: var(--c-primary); letter-spacing: 0.05em; }
    .day-banner-date { font-size: 12px; color: var(--c-text-2); }

    .timeline-lane { display: flex; flex-direction: column; }

    .entry-row {
      display: flex; gap: 12px;
      padding-bottom: 16px;
      color: var(--c-text-1);
    }
    .entry-rail {
      width: 50px; flex-shrink: 0;
      display: flex; flex-direction: column; align-items: center;
      position: relative;
    }
    .entry-time { font-size: 11px; color: var(--c-text-2); margin-bottom: 4px; }
    .entry-dot {
      width: 10px; height: 10px; border-radius: 50%;
      background: var(--c-primary);
    }
    .entry-line {
      flex: 1; width: 1px; background: var(--c-border); margin-top: 4px;
    }
    .entry-body {
      flex: 1; padding-bottom: 4px;
      background: var(--c-surface); border: 0.5px solid var(--c-border); border-radius: var(--r-lg);
      padding: 12px 14px;
      transition: background 0.15s;
      position: relative;
    }
    .entry-row:active .entry-body { background: var(--c-border-s); }
    .entry-del {
      position: absolute; top: 8px; right: 8px;
      width: 26px; height: 26px; border-radius: 50%;
      background: var(--c-border-s); color: var(--c-text-2);
      display: flex; align-items: center; justify-content: center;
      font-size: 16px; line-height: 1; padding: 0;
      transition: all 0.15s; z-index: 2;
    }
    .entry-del:hover, .entry-del:focus { background: var(--c-border); color: var(--c-text-1); outline: none; }
    .entry-del.confirm {
      width: auto; padding: 0 12px; height: 26px; border-radius: 13px;
      background: var(--c-state-bad); color: #fff; font-size: 12px; font-weight: 500;
    }
    .entry-cat { font-size: 10px; letter-spacing: 0.1em; font-weight: 500; }
    .entry-title { font-size: 14px; font-weight: 500; margin-top: 4px; color: var(--c-text-1); }
    .entry-note {
      font-size: 12px; line-height: 1.7; color: var(--c-text-2);
      margin-top: 6px; white-space: pre-wrap;
      display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
    }
    .entry-photos {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; margin-top: 10px;
    }
    .epic { position: relative; aspect-ratio: 1; border-radius: var(--r-sm); overflow: hidden; background: var(--c-border-s); cursor: pointer; }
    .epic img { width: 100%; height: 100%; object-fit: cover; }
    .epic .epic-more {
      position: absolute; inset: 0; background: rgba(0,0,0,0.45);
      display: flex; align-items: center; justify-content: center;
      color: #fff; font-size: 18px; font-weight: 500;
    }
    .entry-foot {
      display: flex; gap: 12px; flex-wrap: wrap;
      margin-top: 8px; font-size: 11px; color: var(--c-text-2);
    }
    .entry-foot .cost { color: var(--c-primary); font-weight: 500; }

    .sheet-toggle {
      display: flex; gap: 10px; align-items: flex-start;
      background: var(--c-surface); border: 0.5px solid var(--c-border);
      border-radius: var(--r-md); padding: 12px 16px; font-size: 12px;
      color: var(--c-text-2); cursor: pointer; line-height: 1.5;
    }
    .sheet-toggle input[type="checkbox"] { margin-top: 2px; flex-shrink: 0; accent-color: var(--c-primary); }
  `;
  const style = document.createElement('style');
  style.id = 'trip-styles';
  style.textContent = css;
  document.head.appendChild(style);
}
