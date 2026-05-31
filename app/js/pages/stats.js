import { mountPage } from '../shell.js';
import { el, fmtMoney, dayDiff } from '../utils.js';
import { listTrips, listDayouts, listEntriesByTrip } from '../db.js';
import { CATEGORIES } from '../config.js';
import { navigate } from '../router.js';

export async function renderStats() {
  injectStylesOnce();
  const [trips, dayouts] = await Promise.all([listTrips(), listDayouts()]);

  let totalDays = 0, totalCost = 0, totalPhotos = 0, totalEntries = 0;
  const cityCount = new Set();
  const categorySum = Object.fromEntries(CATEGORIES.map(c => [c.id, 0]));

  for (const t of trips) {
    totalDays += dayDiff(t.startDate, t.endDate) || 0;
    for (const c of (t.city || [])) cityCount.add((t.country || '') + '|' + c);
    const entries = await listEntriesByTrip(t.id);
    totalEntries += entries.length;
    for (const e of entries) {
      totalCost += Number(e.cost) || 0;
      totalPhotos += (e.photos?.length || 0);
      if (e.category && categorySum[e.category] !== undefined) {
        categorySum[e.category] += Number(e.cost) || 0;
      }
    }
  }
  for (const d of dayouts) {
    totalDays += 1;
    totalCost += Number(d.cost) || 0;
    totalPhotos += (d.photos?.length || 0);
    if (d.city) cityCount.add((d.country || '') + '|' + d.city);
  }

  const maxCat = Math.max(...Object.values(categorySum), 1);

  const ratedTrips = trips
    .filter(t => t.rating && t.review)
    .sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));

  const content = el('div', { class: 'page-content stats-page' }, [
    el('div', { class: 'stats-cards' }, [
      statCard('行程', `${trips.length} + ${dayouts.length}`, '多日 + 单日'),
      statCard('天数', String(totalDays), '已记录'),
      statCard('城市', String(cityCount.size), '到访'),
      statCard('照片', String(totalPhotos), '已添加'),
      statCard('花费', fmtMoney(totalCost), '总计', true),
      statCard('条目', String(totalEntries), '总条目')
    ]),

    Object.values(categorySum).some(v => v > 0) ? el('div', { class: 'stats-section' }, [
      el('div', { class: 'section-title' }, '花费分类（来自所有多日行）'),
      el('div', { class: 'cat-list' },
        CATEGORIES.map(c => el('div', { class: 'cat-row' }, [
          el('div', { class: 'cat-line' }, [
            el('span', { style: { color: c.color, fontWeight: '500' } }, c.label),
            el('span', { class: 'mono', style: { fontSize: '12px' } }, fmtMoney(categorySum[c.id]))
          ]),
          el('div', { class: 'cat-bar' }, [
            el('div', {
              class: 'cat-bar-fill',
              style: {
                width: Math.round(categorySum[c.id] * 100 / maxCat) + '%',
                background: c.color
              }
            })
          ])
        ]))
      )
    ]) : null,

    ratedTrips.length ? el('div', { class: 'stats-section' }, [
      el('div', { class: 'section-title' }, '已写下评价的旅行'),
      el('div', { class: 'review-list' },
        ratedTrips.slice(0, 6).map(t => el('a', {
          class: 'review-card',
          href: `#/trip/${t.id}?mode=read`
        }, [
          el('div', { class: 'review-head' }, [
            el('div', { class: 'review-title' }, t.title),
            el('div', { class: 'review-stars' }, '★'.repeat(t.rating))
          ]),
          el('div', { class: 'review-text' }, (t.review || '').trim().slice(0, 80) + ((t.review || '').length > 80 ? '...' : ''))
        ]))
      )
    ]) : null,

    el('div', { class: 'stats-section' }, [
      el('div', { class: 'section-title' }, '数据'),
      el('div', { class: 'card' }, [
        el('div', { style: { fontSize: '12px', color: 'var(--c-text-2)', lineHeight: '1.8' } },
          '数据完整保存在本地浏览器（IndexedDB）。换设备前请到「我的」页导出 JSON 备份。导出 / 导入功能即将上线。')
      ])
    ])
  ]);

  mountPage({
    title: '统计总览',
    sub: trips.length + dayouts.length === 0 ? '还没有数据' : `${trips.length + dayouts.length} 条记录`,
    activeTab: 'stats',
    content
  });
}

function statCard(label, value, hint, isText) {
  return el('div', { class: 'stat-card' }, [
    el('div', { class: 'stat-label' }, label),
    el('div', { class: 'stat-value' + (isText ? ' text' : '') }, value),
    el('div', { class: 'stat-hint' }, hint)
  ]);
}

function injectStylesOnce() {
  if (document.getElementById('stats-styles')) return;
  const css = `
    .stats-page { display: flex; flex-direction: column; gap: 18px; }
    .stats-cards {
      display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;
    }
    .stat-card {
      padding: 14px;
      background: var(--c-surface); border: 0.5px solid var(--c-border); border-radius: var(--r-md);
    }
    .stat-label { font-size: 11px; color: var(--c-text-2); }
    .stat-value { font-size: 22px; font-weight: 500; margin-top: 4px; color: var(--c-primary); }
    .stat-value.text { font-size: 16px; }
    .stat-hint { font-size: 10px; color: var(--c-text-3); margin-top: 2px; }

    .cat-list { display: flex; flex-direction: column; gap: 8px; }
    .cat-row {
      padding: 10px 12px; background: var(--c-surface);
      border: 0.5px solid var(--c-border); border-radius: var(--r-md);
    }
    .cat-line { display: flex; justify-content: space-between; font-size: 12px; }
    .cat-bar { height: 5px; background: var(--c-border-s); border-radius: 3px; margin-top: 6px; overflow: hidden; }
    .cat-bar-fill { height: 100%; border-radius: 3px; transition: width 0.3s; }

    .review-list { display: flex; flex-direction: column; gap: 8px; }
    .review-card {
      padding: 12px 14px;
      background: var(--c-surface); border: 0.5px solid var(--c-border); border-radius: var(--r-md);
      color: var(--c-text-1); display: block;
    }
    .review-head { display: flex; justify-content: space-between; align-items: baseline; }
    .review-title { font-size: 14px; font-weight: 500; }
    .review-stars { color: var(--c-warm); font-size: 12px; letter-spacing: 1px; }
    .review-text { font-size: 12px; color: var(--c-text-2); margin-top: 6px; line-height: 1.7; }
  `;
  const style = document.createElement('style');
  style.id = 'stats-styles';
  style.textContent = css;
  document.head.appendChild(style);
}
