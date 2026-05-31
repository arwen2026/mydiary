import { mountPage } from '../shell.js';
import { el, fmtDate, fmtDateRange, fmtMoney, dayDiff, fmtLocalHM } from '../utils.js';
import { getTrip, listEntriesByTrip } from '../db.js';
import { photoIdToObjectUrl } from '../photos.js';
import { navigate } from '../router.js';
import { CATEGORIES } from '../config.js';

export async function renderReader(trip, entries) {
  injectStylesOnce();
  const sortedEntries = [...entries].sort((a, b) => (a.datetime || '').localeCompare(b.datetime || ''));
  const days = groupByDay(trip, sortedEntries);
  const totalDays = dayDiff(trip.startDate, trip.endDate) || days.length;
  const totalCost = sortedEntries.reduce((s, e) => s + (Number(e.cost) || 0), 0);
  const totalPhotos = sortedEntries.reduce((s, e) => s + (e.photos?.length || 0), 0);
  const allCities = trip.city || [];

  const cover = await renderCover(trip, { totalDays, totalCost, totalPhotos });
  const dayBlocks = [];
  for (const day of days) dayBlocks.push(await renderDayBlock(day));
  const ending = renderEnding(trip, allCities, totalPhotos, sortedEntries);

  const reader = el('div', { class: 'reader' }, [
    cover,
    ...dayBlocks,
    ending
  ]);

  mountPage({
    title: trip.title,
    sub: '阅读模式',
    leftBtn: { icon: '‹', onclick: () => navigate('#/') },
    rightBtns: [
      { icon: '✎', label: '记录模式', onclick: () => navigate(`#/trip/${trip.id}`) }
    ],
    content: reader
  });
}

function groupByDay(trip, entries) {
  const map = new Map();
  for (const e of entries) {
    if (!e.datetime) continue;
    const d = new Date(e.datetime);
    const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(e);
  }
  const keys = [...map.keys()].sort();
  return keys.map((key, i) => {
    const [y, m, dd] = key.split('-').map(Number);
    return { key, date: new Date(y, m - 1, dd), index: i + 1, entries: map.get(key) };
  });
}

async function renderCover(trip, stats) {
  const coverUrl = trip.coverPhotoId ? await photoIdToObjectUrl(trip.coverPhotoId) : null;
  const intro = (trip.intro || '').trim();
  const cities = (trip.city || []).slice(0, 4).join(' · ');

  return el('section', { class: 'reader-cover' }, [
    el('div', { class: 'reader-cover-img' + (coverUrl ? ' has-img' : '') }, [
      coverUrl ? el('img', { src: coverUrl, alt: '' }) : null,
      el('div', { class: 'reader-cover-mask' }),
      el('div', { class: 'reader-cover-text' }, [
        el('div', { class: 'reader-kicker reader-kicker-light' }, 'A TRAVEL DIARY'),
        el('div', { class: 'reader-cover-title' }, trip.title || '未命名旅行'),
        el('div', { class: 'reader-cover-date' }, fmtDateRange(trip.startDate, trip.endDate))
      ])
    ]),
    el('div', { class: 'reader-cover-body' }, [
      intro ? el('div', { class: 'reader-section' }, [
        el('div', { class: 'reader-kicker' }, '前言'),
        el('p', { class: 'reader-intro' }, intro)
      ]) : null,
      el('div', { class: 'reader-stats' }, [
        statCell(stats.totalDays, '天'),
        statCell(trip.city?.length || 0, '城市'),
        statCell(stats.totalPhotos, '张照片'),
        statCell(fmtMoney(stats.totalCost), '花费', true)
      ]),
      cities ? el('div', { class: 'reader-cities' }, cities) : null
    ])
  ]);
}

function statCell(value, label, isText) {
  return el('div', { class: 'reader-stat' }, [
    el('div', { class: 'reader-stat-v' + (isText ? ' text' : '') }, String(value)),
    el('div', { class: 'reader-stat-l' }, label)
  ]);
}

async function renderDayBlock(day) {
  const block = el('section', { class: 'reader-day' });
  block.appendChild(el('div', { class: 'reader-day-header' }, [
    el('div', { class: 'reader-kicker' }, `DAY ${day.index}`),
    el('div', { class: 'reader-day-date' }, fmtDate(day.date) + ' · ' + weekday(day.date))
  ]));
  for (const entry of day.entries) {
    block.appendChild(await renderEntry(entry));
  }
  return block;
}

async function renderEntry(entry) {
  const cat = CATEGORIES.find(c => c.id === entry.category) || CATEGORIES[0];
  const time = entry.datetime ? fmtLocalHM(entry.datetime) : '';
  const photos = (entry.photos || []);
  const heroUrl = photos.length ? await photoIdToObjectUrl(photos[0].id) : null;

  return el('article', { class: 'reader-entry' }, [
    // 1. 先放大图（hero）
    heroUrl ? el('figure', { class: 'reader-entry-hero' }, [
      el('img', { src: heroUrl, alt: '' })
    ]) : null,
    // 2. 再放标题/时间/正文
    el('div', { class: 'reader-entry-meta' }, [
      el('span', { style: { color: cat.color, fontWeight: '500' } }, `${time} · ${cat.label}`)
    ]),
    el('h3', { class: 'reader-entry-title' }, entry.title || '未命名'),
    entry.location ? el('div', { class: 'reader-entry-loc' }, entry.location) : null,
    entry.note ? el('div', { class: 'reader-entry-note' }, entry.note) : null,
    entry.cost ? el('div', { class: 'reader-entry-cost' }, fmtMoney(entry.cost)) : null
    // 不再展示 otherUrls 小图网格；多余照片回记录态看
  ]);
}

function renderEnding(trip, cities, totalPhotos, entries) {
  const review = (trip.review || '').trim();
  const rating = trip.rating || 0;

  return el('section', { class: 'reader-end' }, [
    el('div', { class: 'reader-end-top' }, [
      el('div', { class: 'reader-kicker' }, 'END OF JOURNEY'),
      el('h2', { class: 'reader-end-title' }, '写在最后'),
      rating ? el('div', { class: 'reader-end-stars' }, '★'.repeat(rating) + '☆'.repeat(5 - rating)) : null
    ]),
    review ? el('div', { class: 'reader-end-review' },
      review.split(/\n+/).map(p => el('p', {}, p))
    ) : null,
    cities.length ? el('div', { class: 'reader-section' }, [
      el('div', { class: 'reader-kicker' }, 'FOOTPRINTS'),
      el('div', { class: 'reader-end-cities' }, cities.join(' · '))
    ]) : null,
    el('div', { class: 'reader-end-foot' },
      `— 旅行结束于 ${fmtDate(trip.endDate)} —`)
  ]);
  // 不再展示 PHOTO WALL 全图墙；图片在记录态可以看
}

function weekday(d) {
  return ['周日','周一','周二','周三','周四','周五','周六'][(d instanceof Date ? d : new Date(d)).getDay()];
}

function injectStylesOnce() {
  const old = document.getElementById('reader-styles');
  if (old) old.remove();
  const css = `
    .reader { background: var(--c-bg); padding-bottom: 60px; }

    .reader-cover { background: var(--c-bg); }
    .reader-cover-img {
      position: relative; height: 320px;
      background: linear-gradient(135deg, #C0DD97, #97C459, #639922);
      overflow: hidden;
    }
    .reader-cover-img.has-img img {
      width: 100%; height: 100%; object-fit: cover; position: absolute; inset: 0;
    }
    .reader-cover-mask {
      position: absolute; inset: 0;
      background: linear-gradient(to bottom, rgba(0,0,0,0) 30%, rgba(0,0,0,0.6) 100%);
    }
    .reader-cover-text {
      position: absolute; left: 24px; right: 24px; bottom: 24px;
      color: #fff; z-index: 2;
    }
    .reader-cover-title {
      font-size: 28px; font-weight: 500; line-height: 1.25; margin-top: 10px; color: #fff;
    }
    .reader-cover-date { font-size: 12px; margin-top: 10px; opacity: 0.9; }
    .reader-kicker {
      font-size: 11px; letter-spacing: 0.2em; color: var(--c-primary);
      font-weight: 500; text-transform: uppercase;
    }
    .reader-kicker-light { color: rgba(255,255,255,0.85); }

    .reader-cover-body { padding: 24px 24px 32px; }
    .reader-section { margin-top: 24px; }
    .reader-intro {
      font-size: 15px; line-height: 1.95; color: var(--c-text-1); margin-top: 12px;
    }

    .reader-stats {
      display: flex; gap: 18px; margin-top: 24px;
      padding-top: 18px; border-top: 0.5px solid var(--c-border);
    }
    .reader-stat-v { font-size: 20px; font-weight: 500; color: var(--c-primary); }
    .reader-stat-v.text { font-size: 15px; }
    .reader-stat-l { font-size: 11px; color: var(--c-text-2); margin-top: 2px; }

    .reader-cities {
      margin-top: 18px; font-size: 13px; color: var(--c-text-2);
      padding-top: 18px; border-top: 0.5px solid var(--c-border);
    }

    .reader-day {
      background: var(--c-surface);
      margin: 0;
      padding: 28px 24px 24px;
      border-top: 6px solid var(--c-bg);
    }
    .reader-day-header {
      padding-bottom: 14px; margin-bottom: 20px;
      border-bottom: 0.5px solid var(--c-border);
      display: flex; justify-content: space-between; align-items: baseline;
    }
    .reader-day-date { font-size: 12px; color: var(--c-text-2); }

    .reader-entry { margin-bottom: 28px; }
    .reader-entry:last-child { margin-bottom: 0; }
    .reader-entry-meta { font-size: 11px; letter-spacing: 0.1em; margin-top: 18px; }
    .reader-entry-title {
      font-size: 20px; font-weight: 500; color: var(--c-text-1);
      margin-top: 6px; line-height: 1.3;
    }
    .reader-entry-loc {
      font-size: 11px; color: var(--c-text-2); margin-top: 4px;
    }
    .reader-entry-hero {
      margin: 0 -24px;
      background: var(--c-border-s);
    }
    .reader-entry-hero img {
      width: 100%; height: auto; max-height: 420px; object-fit: cover; display: block;
    }
    /* 当 entry 以 hero 开头时，第一条 meta 就不再加 18px top */
    .reader-entry > .reader-entry-hero + .reader-entry-meta { margin-top: 18px; }
    .reader-entry > .reader-entry-meta:first-child { margin-top: 0; }
    .reader-entry-note {
      font-size: 14px; line-height: 1.95; color: var(--c-text-1);
      margin-top: 12px; white-space: pre-wrap;
    }
    .reader-entry-grid {
      display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; margin-top: 14px;
    }
    .reader-entry-grid .epic {
      aspect-ratio: 4/3; border-radius: var(--r-md); overflow: hidden; background: var(--c-border-s);
    }
    .reader-entry-grid .epic img { width: 100%; height: 100%; object-fit: cover; }
    .reader-entry-cost {
      margin-top: 12px; font-size: 12px; color: var(--c-primary); font-weight: 500;
    }

    .reader-end {
      background: var(--c-surface);
      padding: 36px 24px;
      border-top: 6px solid var(--c-bg);
    }
    .reader-end-top { text-align: center; padding-bottom: 18px; }
    .reader-end-title { font-size: 22px; font-weight: 500; margin-top: 12px; }
    .reader-end-stars {
      margin-top: 12px; color: var(--c-warm); font-size: 16px; letter-spacing: 4px;
    }
    .reader-end-review p {
      font-size: 15px; line-height: 2; color: var(--c-text-1); margin-top: 14px;
    }
    .reader-end-review p:first-child { margin-top: 0; }
    .reader-end-cities { margin-top: 10px; font-size: 14px; color: var(--c-text-1); }

    .reader-photo-wall {
      margin-top: 12px;
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 3px;
    }
    .wall-tile { aspect-ratio: 1; overflow: hidden; background: var(--c-border-s); }
    .wall-tile img { width: 100%; height: 100%; object-fit: cover; }

    .reader-end-foot {
      text-align: center; font-size: 11px; color: var(--c-text-3);
      margin-top: 36px; padding-top: 18px; border-top: 0.5px dashed var(--c-border);
      letter-spacing: 0.1em;
    }
  `;
  const style = document.createElement('style');
  style.id = 'reader-styles';
  style.textContent = css;
  document.head.appendChild(style);
}
