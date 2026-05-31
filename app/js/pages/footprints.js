import { mountPage } from '../shell.js';
import { el, fmtMoney, dayDiff } from '../utils.js';
import { listTrips, listDayouts } from '../db.js';
import { navigate } from '../router.js';

export async function renderFootprints() {
  injectStylesOnce();
  const [trips, dayouts] = await Promise.all([listTrips(), listDayouts()]);

  const cityMap = new Map();
  const countryMap = new Map();
  const provinceMap = new Map();

  for (const t of trips) {
    addToCountry(countryMap, t.country, t);
    for (const p of (t.province || [])) addToProvince(provinceMap, t.country, p, t);
    for (const c of (t.city || [])) addToCity(cityMap, t.country, (t.province || [])[0] || '', c, t.startDate);
  }
  for (const d of dayouts) {
    addToCountry(countryMap, d.country, d);
    if (d.province) addToProvince(provinceMap, d.country, d.province, d);
    if (d.city) addToCity(cityMap, d.country, d.province || '', d.city, d.date);
  }

  const cities = [...cityMap.values()].sort((a, b) => b.count - a.count || (b.lastDate || '').localeCompare(a.lastDate || ''));
  const countries = [...countryMap.values()].sort((a, b) => b.count - a.count);
  const provinces = [...provinceMap.values()].sort((a, b) => b.count - a.count);

  const sub = `共 ${cities.length} 个城市 · ${provinces.length} 个省 · ${countries.length} 个国家`;

  const content = el('div', { class: 'page-content footprints' }, [
    el('div', { class: 'fp-mapcard' }, [
      el('div', { class: 'fp-map-icon' }, '◐'),
      el('div', { class: 'fp-map-title' }, '世界地图视图'),
      el('div', { class: 'fp-map-desc' }, 'v1.5 中国省份热力图 · v2.x 世界地图按国家+时段标记。数据已就位，地图可视化等待后续版本。')
    ]),

    countries.length ? el('div', { class: 'fp-section' }, [
      el('div', { class: 'section-title' }, '按国家'),
      el('div', { class: 'fp-list' },
        countries.map(c => el('div', { class: 'fp-row' }, [
          el('div', {}, [
            el('span', { class: 'fp-name' }, c.name),
            el('span', { class: 'fp-meta' }, `${c.count} 次`)
          ]),
          el('div', { class: 'fp-bar' }, [
            el('div', { class: 'fp-bar-fill', style: { width: pct(c.count, countries[0].count) + '%' } })
          ])
        ]))
      )
    ]) : null,

    cities.length ? el('div', { class: 'fp-section' }, [
      el('div', { class: 'section-title' }, '城市清单（按到访次数）'),
      el('div', { class: 'fp-list' },
        cities.map(c => el('div', { class: 'fp-city-row' }, [
          el('div', {}, [
            el('div', { class: 'fp-name' }, c.name),
            el('div', { class: 'fp-meta-line' },
              [c.country, c.province].filter(Boolean).join(' · ') + ` · ${c.count} 次`)
          ]),
          el('div', { class: 'fp-date' }, c.lastDate ? c.lastDate.slice(0, 10) : '')
        ]))
      )
    ]) : el('div', { class: 'empty' }, [
      el('div', { class: 'icon' }, '◑'),
      el('div', { class: 'title' }, '足迹还是空的'),
      el('div', { class: 'desc' }, '在新建旅行 / 单日行时填写城市，这里会自动汇总')
    ])
  ]);

  mountPage({
    title: '我的足迹',
    sub: sub,
    activeTab: 'footprints',
    content
  });
}

function addToCountry(map, name, src) {
  if (!name) return;
  if (!map.has(name)) map.set(name, { name, count: 0 });
  map.get(name).count++;
}
function addToProvince(map, country, name, src) {
  if (!name) return;
  const key = (country || '') + '|' + name;
  if (!map.has(key)) map.set(key, { country, name, count: 0 });
  map.get(key).count++;
}
function addToCity(map, country, province, name, date) {
  if (!name) return;
  const key = (country || '') + '|' + name;
  if (!map.has(key)) map.set(key, { country, province, name, count: 0, lastDate: '' });
  const c = map.get(key);
  c.count++;
  if ((date || '') > (c.lastDate || '')) c.lastDate = date;
}

function pct(v, max) {
  if (!max) return 0;
  return Math.max(8, Math.round(v * 100 / max));
}

function injectStylesOnce() {
  if (document.getElementById('fp-styles')) return;
  const css = `
    .footprints { display: flex; flex-direction: column; gap: 18px; }
    .fp-mapcard {
      padding: 24px 18px;
      background: linear-gradient(135deg, #E1F5EE, #FAF8F1);
      border: 0.5px solid var(--c-border); border-radius: var(--r-lg);
      text-align: center;
    }
    .fp-map-icon { font-size: 32px; color: var(--c-primary); margin-bottom: 6px; }
    .fp-map-title { font-size: 14px; font-weight: 500; }
    .fp-map-desc { font-size: 12px; color: var(--c-text-2); margin-top: 6px; line-height: 1.7; }
    .fp-section .fp-list { display: flex; flex-direction: column; gap: 6px; }
    .fp-row {
      padding: 10px 12px;
      background: var(--c-surface); border: 0.5px solid var(--c-border); border-radius: var(--r-md);
      display: flex; flex-direction: column; gap: 6px;
    }
    .fp-name { font-size: 13px; font-weight: 500; }
    .fp-meta { font-size: 11px; color: var(--c-text-2); margin-left: 8px; }
    .fp-meta-line { font-size: 11px; color: var(--c-text-2); margin-top: 2px; }
    .fp-bar { height: 6px; background: var(--c-border-s); border-radius: 3px; overflow: hidden; }
    .fp-bar-fill { height: 100%; background: var(--c-primary); border-radius: 3px; transition: width 0.3s; }
    .fp-city-row {
      padding: 10px 12px;
      background: var(--c-surface); border: 0.5px solid var(--c-border); border-radius: var(--r-md);
      display: flex; justify-content: space-between; align-items: center; gap: 12px;
    }
    .fp-date { font-size: 11px; color: var(--c-text-3); flex-shrink: 0; }
  `;
  const style = document.createElement('style');
  style.id = 'fp-styles';
  style.textContent = css;
  document.head.appendChild(style);
}
