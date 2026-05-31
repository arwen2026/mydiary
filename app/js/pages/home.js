import { mountPage } from '../shell.js';
import { el, fmtDate, fmtDateRange, fmtMoney, dayDiff } from '../utils.js';
import { listTrips, listDayouts, listNotes, listEntriesByTrip, deleteTrip, deleteDayout, deleteNote, getMeta, setMeta } from '../db.js';
import { photoIdToObjectUrl } from '../photos.js';
import { navigate } from '../router.js';

let activeFilter = 'all';

export async function renderHome() {
  const [trips, dayouts, notes, customTitle] = await Promise.all([
    listTrips(), listDayouts(), listNotes(), getMeta('homeTitle', '我的旅行')
  ]);
  const items = [
    ...trips.map(t => ({ ...t, _kind: 'trip',   _sortDate: t.startDate || t.createdAt })),
    ...dayouts.map(d => ({ ...d, _kind: 'dayout', _sortDate: d.date || d.createdAt })),
    ...notes.map(n => ({ ...n, _kind: 'note',   _sortDate: n.date || n.createdAt }))
  ].sort((a, b) => (b._sortDate || '').localeCompare(a._sortDate || ''));

  const filtered = activeFilter === 'all' ? items
    : items.filter(x => x._kind === activeFilter);

  const counts = await enrichCounts(filtered);

  const listEl = filtered.length === 0
    ? renderEmpty()
    : el('div', { class: 'home-list' }, await Promise.all(filtered.map(item => renderCard(item, counts[item.id]))));

  const content = el('div', { class: 'page-content home-page' }, [
    renderFilters(),
    listEl
  ]);

  mountPage({
    title: customTitle,
    sub: `${trips.length} 旅行 · ${dayouts.length} 外出 · ${notes.length} 随笔 · 点标题改名`,
    activeTab: 'home',
    content,
    fab: { icon: '+', onclick: showCreateSheet }
  });

  injectStylesOnce();
  bindTitleRename(customTitle);
}

function bindTitleRename(currentTitle) {
  const titleEl = document.querySelector('.topbar .title');
  if (!titleEl) return;
  titleEl.style.cursor = 'pointer';
  titleEl.title = '点击修改名称';
  titleEl.onclick = async () => {
    const next = prompt('为这本旅行手账起个名字', currentTitle);
    if (!next || next.trim() === currentTitle) return;
    await setMeta('homeTitle', next.trim());
    renderHome();
  };
}

function renderFilters() {
  const tabs = [
    { id: 'all',    label: '全部' },
    { id: 'trip',   label: '多日' },
    { id: 'dayout', label: '单日' },
    { id: 'note',   label: '随笔' }
  ];
  return el('div', { class: 'home-filters' },
    tabs.map(t => el('button', {
      class: 'chip' + (activeFilter === t.id ? ' active' : ''),
      onclick: () => { activeFilter = t.id; renderHome(); }
    }, t.label))
  );
}

function renderEmpty() {
  return el('div', { class: 'empty' }, [
    el('div', { class: 'icon' }, '◇'),
    el('div', { class: 'title' }, activeFilter === 'all' ? '还没有任何旅行' : '这里还是空的'),
    el('div', { class: 'desc' }, '点右下角 + 号开始记录一次新的旅行或外出')
  ]);
}

async function renderCard(item, stat) {
  if (item._kind === 'note') return renderNoteCard(item);

  const isTrip = item._kind === 'trip';
  const coverUrl = item.coverPhotoId ? await photoIdToObjectUrl(item.coverPhotoId) : null;
  const route = isTrip ? `#/trip/${item.id}` : `#/dayout/${item.id}`;

  const meta = isTrip
    ? `${(item.city || []).slice(0, 3).join(' · ') || '未设地点'} · ${dayDiff(item.startDate, item.endDate) || 0} 天`
    : `${[item.date && fmtDate(item.date), item.city || ''].filter(Boolean).join(' · ')}`;

  const dateBadge = isTrip
    ? fmtDateRange(item.startDate, item.endDate)
    : (item.date ? fmtDate(item.date) : '');

  const statusBadge = isTrip && item.status === 'ongoing'
    ? el('span', { class: 'badge badge-warm card-status' }, '进行中')
    : null;

  const stats = isTrip
    ? el('div', { class: 'card-stats' }, [
        el('span', {}, `${stat?.entries || 0} 条`),
        el('span', {}, `${stat?.photos || 0} 张照片`),
        el('span', {}, fmtMoney(stat?.cost || 0))
      ])
    : el('div', { class: 'card-stats' }, [
        item.subtype ? el('span', {}, item.subtype) : null,
        el('span', {}, `${(item.photos || []).length} 张照片`),
        el('span', {}, fmtMoney(item.cost || 0))
      ]);

  const tall = isTrip;

  const delBtn = el('button', {
    type: 'button',
    class: 'card-del',
    title: '删除',
    onclick: (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleCardDelete(delBtn, item);
    }
  }, '×');

  return el('a', {
    class: 'trip-card' + (tall ? ' tall' : ' short') + (coverUrl ? ' has-cover' : ''),
    href: route
  }, [
    coverUrl ? el('img', { class: 'cover', src: coverUrl, alt: '' }) : null,
    coverUrl ? el('div', { class: 'mask' }) : null,
    el('div', { class: 'card-corner' }, [statusBadge, delBtn]),
    el('div', { class: 'card-body' }, [
      el('div', { class: 'card-title' }, item.title || '未命名'),
      el('div', { class: 'card-meta' }, meta),
      dateBadge ? el('div', { class: 'card-date' }, dateBadge) : null,
      stats
    ])
  ]);
}

function renderNoteCard(note) {
  const delBtn = el('button', {
    type: 'button',
    class: 'card-del',
    title: '删除',
    onclick: (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleCardDelete(delBtn, note);
    }
  }, '×');

  const preview = (note.note || '').replace(/\s+/g, ' ').slice(0, 80);
  return el('a', {
    class: 'note-card',
    href: `#/note/${note.id}`
  }, [
    el('div', { class: 'card-corner' }, [delBtn]),
    el('div', { class: 'note-card-meta' }, [
      note.date ? fmtDate(note.date) : '',
      weekday(note.date),
      note.mood
    ].filter(Boolean).join(' · ')),
    el('div', { class: 'note-card-title' }, note.title || '未命名随笔'),
    preview ? el('div', { class: 'note-card-preview' }, preview + (note.note?.length > 80 ? '…' : '')) : null,
    el('div', { class: 'note-card-foot' }, [
      el('span', { class: 'note-card-tag' }, '随笔'),
      note.rating ? el('span', { style: { color: 'var(--c-warm)' } }, '★'.repeat(note.rating)) : null,
      (note.photos?.length) ? el('span', {}, `${note.photos.length} 张图`) : null
    ])
  ]);
}

function weekday(d) {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '';
  return ['周日','周一','周二','周三','周四','周五','周六'][date.getDay()];
}

async function handleCardDelete(btn, item) {
  if (btn.classList.contains('confirm')) {
    if (item._kind === 'trip') await deleteTrip(item.id);
    else if (item._kind === 'dayout') await deleteDayout(item.id);
    else if (item._kind === 'note') await deleteNote(item.id);
    renderHome();
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
  setTimeout(() => { if (btn.classList.contains('confirm')) reset(); }, 3000);
}

async function enrichCounts(items) {
  const counts = {};
  for (const item of items) {
    if (item._kind === 'trip') {
      const entries = await listEntriesByTrip(item.id);
      counts[item.id] = {
        entries: entries.length,
        photos: entries.reduce((s, e) => s + (e.photos?.length || 0), 0),
        cost: entries.reduce((s, e) => s + (Number(e.cost) || 0), 0)
      };
    }
  }
  return counts;
}

function showCreateSheet() {
  const sheet = el('div', { class: 'sheet-overlay', onclick: (e) => { if (e.target === sheet) sheet.remove(); } });
  const panel = el('div', { class: 'sheet-panel' }, [
    el('div', { class: 'sheet-title' }, '新建记录'),
    el('button', {
      class: 'sheet-btn',
      onclick: () => { sheet.remove(); navigate('#/edit/trip/new'); }
    }, [
      el('div', { class: 'sheet-btn-icon' }, '◉'),
      el('div', { class: 'sheet-btn-text' }, [
        el('div', { class: 'sheet-btn-title' }, '新建旅行'),
        el('div', { class: 'sheet-btn-desc' }, '一次完整的多日行程，含时间轴 + 阅读态游记')
      ])
    ]),
    el('button', {
      class: 'sheet-btn',
      onclick: () => { sheet.remove(); navigate('#/edit/dayout/new'); }
    }, [
      el('div', { class: 'sheet-btn-icon' }, '◆'),
      el('div', { class: 'sheet-btn-text' }, [
        el('div', { class: 'sheet-btn-title' }, '记一次外出'),
        el('div', { class: 'sheet-btn-desc' }, '周末爬山 / 骑行 / 逛展，一页式简单记录')
      ])
    ]),
    el('button', {
      class: 'sheet-btn',
      onclick: () => { sheet.remove(); navigate('#/edit/note/new'); }
    }, [
      el('div', { class: 'sheet-btn-icon' }, '✎'),
      el('div', { class: 'sheet-btn-text' }, [
        el('div', { class: 'sheet-btn-title' }, '生活随笔'),
        el('div', { class: 'sheet-btn-desc' }, '记录心情 / 思考 / 一段文字 / 一本书的感想')
      ])
    ]),
    el('button', { class: 'sheet-cancel', onclick: () => sheet.remove() }, '取消')
  ]);
  sheet.appendChild(panel);
  document.body.appendChild(sheet);
}

let stylesInjected = false;
function injectStylesOnce() {
  if (stylesInjected) return;
  stylesInjected = true;
  const css = `
    .home-filters { display: flex; gap: 8px; margin-bottom: 14px; }
    .home-list { display: flex; flex-direction: column; gap: 12px; }
    .trip-card {
      position: relative;
      display: block;
      border-radius: var(--r-lg);
      overflow: hidden;
      background: var(--c-surface);
      border: 0.5px solid var(--c-border);
      color: var(--c-text-1);
      transition: transform 0.15s;
    }
    .trip-card:active { transform: scale(0.98); }
    .trip-card.tall   { min-height: 140px; }
    .trip-card.short  { min-height: 96px; }
    .trip-card .cover { width: 100%; height: 100%; object-fit: cover; position: absolute; inset: 0; }
    .trip-card .mask  { position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.55), rgba(0,0,0,0) 60%); }
    .trip-card.has-cover .card-body { color: #fff; position: relative; }
    .trip-card.has-cover .card-meta,
    .trip-card.has-cover .card-date,
    .trip-card.has-cover .card-stats { color: rgba(255,255,255,0.92); }
    .trip-card .card-body {
      position: relative;
      padding: 14px;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      gap: 4px;
      z-index: 2;
    }
    .trip-card.tall .card-body  { padding: 16px; min-height: 140px; }
    .trip-card.short .card-body { padding: 14px; min-height: 96px; }
    .trip-card .card-title { font-size: 15px; font-weight: 500; }
    .trip-card .card-meta  { font-size: 12px; color: var(--c-text-2); }
    .trip-card .card-date  { font-size: 11px; color: var(--c-text-3); margin-top: 2px; }
    .trip-card .card-stats { display: flex; gap: 12px; font-size: 11px; color: var(--c-text-2); margin-top: 6px; }
    .trip-card .card-corner {
      position: absolute; top: 8px; right: 8px; z-index: 3;
      display: flex; gap: 6px; align-items: center;
    }
    .card-status {
      background: var(--c-warm); color: var(--c-warm-d);
    }
    .trip-card:not(.has-cover) .card-status { background: var(--c-warm); color: var(--c-warm-d); }

    .trip-card .card-del {
      width: 26px; height: 26px; border-radius: 50%;
      background: rgba(255,255,255,0.85); color: var(--c-text-2);
      display: flex; align-items: center; justify-content: center;
      font-size: 16px; line-height: 1; padding: 0;
      transition: all 0.15s; opacity: 0.85;
    }
    .trip-card:not(.has-cover) .card-del { background: var(--c-border-s); }
    .trip-card .card-del:hover, .trip-card .card-del:focus { opacity: 1; outline: none; }
    .trip-card .card-del.confirm {
      width: auto; padding: 0 12px; height: 26px; border-radius: 13px;
      background: var(--c-state-bad); color: #fff; font-size: 12px; font-weight: 500;
      opacity: 1;
    }

    .note-card {
      position: relative; display: block;
      background: linear-gradient(180deg, #FFFCF0, var(--c-surface));
      border: 0.5px solid var(--c-border); border-left: 3px solid var(--c-accent);
      border-radius: var(--r-lg); padding: 14px 16px;
      color: var(--c-text-1);
    }
    .note-card .card-corner {
      position: absolute; top: 8px; right: 8px; z-index: 3;
    }
    .note-card .card-del {
      width: 26px; height: 26px; border-radius: 50%;
      background: var(--c-border-s); color: var(--c-text-2);
      display: flex; align-items: center; justify-content: center;
      font-size: 16px; line-height: 1; padding: 0;
      transition: all 0.15s; opacity: 0.85;
    }
    .note-card .card-del:hover, .note-card .card-del:focus { opacity: 1; outline: none; }
    .note-card .card-del.confirm {
      width: auto; padding: 0 12px; height: 26px; border-radius: 13px;
      background: var(--c-state-bad); color: #fff; font-size: 12px; font-weight: 500; opacity: 1;
    }
    .note-card-meta { font-size: 11px; color: var(--c-text-2); padding-right: 36px; }
    .note-card-title { font-size: 15px; font-weight: 500; margin-top: 4px; }
    .note-card-preview {
      font-size: 12px; color: var(--c-text-2); line-height: 1.7;
      margin-top: 8px;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
    }
    .note-card-foot {
      display: flex; gap: 12px; margin-top: 8px; font-size: 11px; color: var(--c-text-2);
    }
    .note-card-tag {
      background: var(--c-accent); color: var(--c-accent-d);
      padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: 500;
    }

    .sheet-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.45);
      display: flex; align-items: flex-end; justify-content: center;
      z-index: 100;
      animation: fadeIn 0.18s ease;
    }
    .sheet-panel {
      width: 100%; max-width: var(--max-w);
      background: var(--c-bg);
      border-radius: 16px 16px 0 0;
      padding: 18px 16px calc(24px + env(safe-area-inset-bottom, 0));
      display: flex; flex-direction: column; gap: 10px;
      animation: slideUp 0.22s ease;
    }
    .sheet-title { font-size: 14px; color: var(--c-text-2); text-align: center; padding-bottom: 8px; }
    .sheet-btn {
      display: flex; gap: 14px; align-items: center;
      background: var(--c-surface); border: 0.5px solid var(--c-border);
      border-radius: var(--r-lg); padding: 14px 16px; width: 100%;
      text-align: left; transition: background 0.15s;
    }
    .sheet-btn:active { background: var(--c-border-s); }
    .sheet-btn-icon {
      width: 40px; height: 40px; border-radius: 50%;
      background: var(--c-accent); color: var(--c-accent-d);
      display: flex; align-items: center; justify-content: center; font-size: 18px;
      flex-shrink: 0;
    }
    .sheet-btn-text { flex: 1; }
    .sheet-btn-title { font-size: 14px; font-weight: 500; color: var(--c-text-1); }
    .sheet-btn-desc  { font-size: 11px; color: var(--c-text-2); margin-top: 2px; line-height: 1.5; }
    .sheet-cancel {
      padding: 14px; background: transparent; color: var(--c-text-2);
      font-size: 14px; margin-top: 4px;
    }

    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
  `;
  const style = document.createElement('style');
  style.id = 'home-styles';
  style.textContent = css;
  document.head.appendChild(style);
}
