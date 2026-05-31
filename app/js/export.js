import { exportAll, importAll, clearAll, getTrip, listEntriesByTrip } from './db.js';
import { photoIdToObjectUrl } from './photos.js';
import { CATEGORIES } from './config.js';
import { fmtDate, fmtDateRange, fmtMoney, dayDiff, fmtLocalHM } from './utils.js';

export async function exportJSON() {
  const data = await exportAll();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `tripdiary-backup-${stamp}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function importJSON() {
  const file = await pickFile({ accept: '.json,application/json' });
  if (!file) return;
  const text = await file.text();
  const data = JSON.parse(text);
  if (!confirm(`即将导入 ${data.trips?.length || 0} 个旅行 + ${data.dayouts?.length || 0} 次外出 + ${data.entries?.length || 0} 条记录 + ${data.photos?.length || 0} 张缩略图。冲突 id 会被覆盖。继续吗？`)) return;
  await importAll(data);
  alert('导入完成');
  location.hash = '#/';
  location.reload();
}

export async function clearAllData() {
  if (!confirm('确定要清空所有数据吗？此操作不可撤销。\n建议先导出 JSON 备份。')) return;
  if (!confirm('再次确认：所有旅行、单日行、条目、照片缩略图都会被删除。继续？')) return;
  await clearAll();
  alert('已清空所有数据');
  location.hash = '#/';
  location.reload();
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

export async function exportTripAsHTML(tripId, options = {}) {
  const trip = await getTrip(tripId);
  if (!trip) return;
  const entries = (await listEntriesByTrip(tripId))
    .sort((a, b) => (a.datetime || '').localeCompare(b.datetime || ''));

  const photoIds = new Set();
  if (trip.coverPhotoId) photoIds.add(trip.coverPhotoId);
  for (const e of entries) for (const p of (e.photos || [])) photoIds.add(p.id);

  const photoMap = {};
  for (const id of photoIds) {
    const url = await photoIdToObjectUrl(id);
    if (!url) continue;
    photoMap[id] = await urlToDataURL(url);
  }

  const html = await buildHTML(trip, entries, photoMap, options);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(trip.title || 'trip').replace(/[\\/:*?"<>|]/g, '_')}.html`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function urlToDataURL(blobUrl) {
  const res = await fetch(blobUrl);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

async function buildHTML(trip, entries, photoMap, opts) {
  const totalDays = dayDiff(trip.startDate, trip.endDate);
  const totalCost = entries.reduce((s, e) => s + (Number(e.cost) || 0), 0);
  const totalPhotos = entries.reduce((s, e) => s + (e.photos?.length || 0), 0);
  const cities = (trip.city || []).join(' · ');

  const groups = groupByDay(entries);
  const allPhotoIds = entries.flatMap(e => (e.photos || []).map(p => p.id)).filter(id => photoMap[id]);

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHTML(trip.title || '旅行游记')}</title>
<style>
:root {
  --c-bg: #FAF8F1; --c-surface: #fff; --c-primary: #5E8F4A; --c-warm: #E8C285;
  --c-text-1: #2A2E1F; --c-text-2: #8B897D; --c-border: #E5E2D5;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
  font-size: 15px; line-height: 1.6; color: var(--c-text-1); background: var(--c-bg);
}
.page { max-width: 720px; margin: 0 auto; padding-bottom: 60px; background: var(--c-bg); }
.cover { position: relative; height: 360px; overflow: hidden; background: linear-gradient(135deg, #C0DD97, #97C459, #639922); }
.cover img { width: 100%; height: 100%; object-fit: cover; position: absolute; inset: 0; }
.cover .mask { position: absolute; inset: 0; background: linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.6) 100%); }
.cover .text { position: absolute; left: 24px; right: 24px; bottom: 28px; color: #fff; }
.cover .kicker-light { font-size: 11px; letter-spacing: 0.2em; opacity: 0.85; }
.cover h1 { font-size: 30px; font-weight: 500; line-height: 1.25; margin-top: 12px; }
.cover .date { font-size: 13px; opacity: 0.9; margin-top: 12px; }
.body { padding: 24px; }
.kicker { font-size: 11px; letter-spacing: 0.2em; color: var(--c-primary); font-weight: 500; text-transform: uppercase; }
.intro { font-size: 16px; line-height: 1.95; margin-top: 14px; }
.stats { display: flex; gap: 22px; margin-top: 26px; padding-top: 18px; border-top: 0.5px solid var(--c-border); }
.stat-v { font-size: 22px; font-weight: 500; color: var(--c-primary); }
.stat-v.text { font-size: 16px; }
.stat-l { font-size: 12px; color: var(--c-text-2); margin-top: 2px; }
.day { background: var(--c-surface); padding: 32px 24px 24px; border-top: 6px solid var(--c-bg); }
${opts.useChapterDivider ? `
.day-divider { background: linear-gradient(135deg, #5DCAA5, #1D9E75); height: 240px; position: relative; color: #fff; display: flex; align-items: center; justify-content: center; text-align: center; }
.day-divider .dn { font-size: 11px; letter-spacing: 0.3em; opacity: 0.85; }
.day-divider .dd { font-size: 32px; font-weight: 500; margin-top: 8px; }
.day-divider .ds { font-size: 13px; margin-top: 8px; opacity: 0.92; }
` : ''}
.day-header { padding-bottom: 14px; margin-bottom: 22px; border-bottom: 0.5px solid var(--c-border); display: flex; justify-content: space-between; align-items: baseline; }
.day-date { font-size: 13px; color: var(--c-text-2); }
.entry { margin-bottom: 32px; }
.entry-meta { font-size: 11px; letter-spacing: 0.1em; }
.entry-title { font-size: 22px; font-weight: 500; margin-top: 6px; line-height: 1.3; }
.entry-loc { font-size: 12px; color: var(--c-text-2); margin-top: 4px; }
.entry-hero { margin: 18px -24px; }
.entry-hero img { width: 100%; height: auto; max-height: 420px; object-fit: cover; display: block; }
.entry-note { font-size: 15px; line-height: 1.95; margin-top: 14px; white-space: pre-wrap; }
.entry-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; margin-top: 16px; }
.entry-grid img { width: 100%; aspect-ratio: 4/3; object-fit: cover; border-radius: 6px; display: block; }
.entry-cost { margin-top: 14px; font-size: 13px; color: var(--c-primary); font-weight: 500; }
.end { background: var(--c-surface); padding: 40px 24px; border-top: 6px solid var(--c-bg); }
.end-top { text-align: center; padding-bottom: 18px; }
.end-title { font-size: 24px; font-weight: 500; margin-top: 14px; }
.end-stars { margin-top: 14px; color: var(--c-warm); font-size: 16px; letter-spacing: 4px; }
.end-review p { font-size: 16px; line-height: 2; margin-top: 14px; }
.end-review p:first-child { margin-top: 0; }
.end-cities { font-size: 14px; margin-top: 10px; }
.wall { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3px; margin-top: 12px; }
.wall img { width: 100%; aspect-ratio: 1; object-fit: cover; display: block; }
.foot { text-align: center; font-size: 12px; color: var(--c-text-2); margin-top: 40px; padding-top: 18px; border-top: 0.5px dashed var(--c-border); letter-spacing: 0.1em; }
.section { margin-top: 28px; }
</style>
</head>
<body>
<div class="page">

  <section class="cover">
    ${trip.coverPhotoId && photoMap[trip.coverPhotoId] ? `<img src="${photoMap[trip.coverPhotoId]}" alt="">` : ''}
    <div class="mask"></div>
    <div class="text">
      <div class="kicker-light">A TRAVEL DIARY</div>
      <h1>${escapeHTML(trip.title || '未命名')}</h1>
      <div class="date">${escapeHTML(fmtDateRange(trip.startDate, trip.endDate))}</div>
    </div>
  </section>

  <div class="body">
    ${trip.intro ? `
    <div class="section">
      <div class="kicker">前言</div>
      <p class="intro">${escapeHTML(trip.intro)}</p>
    </div>` : ''}
    <div class="stats">
      <div><div class="stat-v">${totalDays || 0}</div><div class="stat-l">天</div></div>
      <div><div class="stat-v">${(trip.city || []).length}</div><div class="stat-l">城市</div></div>
      <div><div class="stat-v">${totalPhotos}</div><div class="stat-l">张照片</div></div>
      <div><div class="stat-v text">${escapeHTML(fmtMoney(totalCost))}</div><div class="stat-l">花费</div></div>
    </div>
    ${cities ? `<div class="section" style="font-size:13px;color:var(--c-text-2);">${escapeHTML(cities)}</div>` : ''}
  </div>

  ${groups.map((g, idx) => renderDay(g, idx + 1, photoMap, opts)).join('')}

  <section class="end">
    <div class="end-top">
      <div class="kicker">END OF JOURNEY</div>
      <h2 class="end-title">写在最后</h2>
      ${trip.rating ? `<div class="end-stars">${'★'.repeat(trip.rating)}${'☆'.repeat(5 - trip.rating)}</div>` : ''}
    </div>
    ${trip.review ? `<div class="end-review">${trip.review.split(/\n+/).map(p => `<p>${escapeHTML(p)}</p>`).join('')}</div>` : ''}
    ${cities ? `<div class="section"><div class="kicker">FOOTPRINTS</div><div class="end-cities">${escapeHTML(cities)}</div></div>` : ''}
    <div class="foot">— 旅行结束于 ${escapeHTML(fmtDate(trip.endDate))} —</div>
  </section>

</div>
</body>
</html>`;
}

function renderDay(g, dayIdx, photoMap, opts) {
  const dateStr = fmtDate(g.date) + ' · ' + weekday(g.date);
  const divider = opts.useChapterDivider ? `
    <section class="day-divider">
      <div>
        <div class="dn">DAY ${dayIdx}</div>
        <div class="dd">${escapeHTML(fmtDate(g.date, false))}</div>
        <div class="ds">${escapeHTML(weekday(g.date))}</div>
      </div>
    </section>` : '';
  return divider + `
    <section class="day">
      <div class="day-header">
        <div class="kicker">DAY ${dayIdx}</div>
        <div class="day-date">${escapeHTML(dateStr)}</div>
      </div>
      ${g.entries.map(e => renderEntry(e, photoMap)).join('')}
    </section>`;
}

function renderEntry(entry, photoMap) {
  const cat = CATEGORIES.find(c => c.id === entry.category) || CATEGORIES[0];
  const time = entry.datetime ? fmtLocalHM(entry.datetime) : '';
  const photos = (entry.photos || []).map(p => photoMap[p.id]).filter(Boolean);
  const hero = photos[0];
  // 阅读态/导出 HTML 风格：先大图，再文字；不再展示多余图集
  return `
    <article class="entry">
      ${hero ? `<figure class="entry-hero"><img src="${hero}" alt=""></figure>` : ''}
      <div class="entry-meta" style="color:${cat.color};font-weight:500">${escapeHTML(time + ' · ' + cat.label)}</div>
      <h3 class="entry-title">${escapeHTML(entry.title || '未命名')}</h3>
      ${entry.location ? `<div class="entry-loc">${escapeHTML(entry.location)}</div>` : ''}
      ${entry.note ? `<div class="entry-note">${escapeHTML(entry.note)}</div>` : ''}
      ${entry.cost ? `<div class="entry-cost">${escapeHTML(fmtMoney(entry.cost))}</div>` : ''}
    </article>`;
}

function groupByDay(entries) {
  const map = new Map();
  for (const e of entries) {
    if (!e.datetime) continue;
    const d = new Date(e.datetime);
    const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    if (!map.has(k)) {
      const [y, m, dd] = k.split('-').map(Number);
      map.set(k, { key: k, date: new Date(y, m - 1, dd), entries: [] });
    }
    map.get(k).entries.push(e);
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}

function weekday(d) {
  return ['周日','周一','周二','周三','周四','周五','周六'][(d instanceof Date ? d : new Date(d)).getDay()];
}

function escapeHTML(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
