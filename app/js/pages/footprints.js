import { mountPage } from '../shell.js';
import { el } from '../utils.js';
import { listTrips, listDayouts } from '../db.js';
import { navigate } from '../router.js';
import { CHINA_MAP } from '../data/china-map.js';

// ── 省名归一化：把用户自由文本映射到地图标准省名（CHINA_MAP 用的简称）──
// 地图标准名：北京 天津 河北 山西 内蒙古 辽宁 吉林 黑龙江 上海 江苏 浙江 安徽
// 福建 江西 山东 河南 湖北 湖南 广东 广西 海南 重庆 四川 贵州 云南 西藏
// 陕西 甘肃 青海 宁夏 新疆 台湾 香港 澳门
const PROV_ALIAS = {
  '北京市': '北京', '天津市': '天津', '上海市': '上海', '重庆市': '重庆',
  '河北省': '河北', '山西省': '山西', '辽宁省': '辽宁', '吉林省': '吉林',
  '黑龙江省': '黑龙江', '江苏省': '江苏', '浙江省': '浙江', '安徽省': '安徽',
  '福建省': '福建', '江西省': '江西', '山东省': '山东', '河南省': '河南',
  '湖北省': '湖北', '湖南省': '湖南', '广东省': '广东', '海南省': '海南',
  '四川省': '四川', '贵州省': '贵州', '云南省': '云南', '陕西省': '陕西',
  '甘肃省': '甘肃', '青海省': '青海', '台湾省': '台湾',
  '内蒙古自治区': '内蒙古', '内蒙': '内蒙古',
  '广西壮族自治区': '广西', '广西省': '广西',
  '西藏自治区': '西藏', '宁夏回族自治区': '宁夏', '宁夏省': '宁夏',
  '新疆维吾尔自治区': '新疆', '新疆省': '新疆',
  '香港特别行政区': '香港', '澳门特别行政区': '澳门',
  // 常见直辖市/省会城市误填进「省份」栏的兜底
  '广州': '广东', '深圳': '广东', '成都': '四川', '昆明': '云南',
  '杭州': '浙江', '南京': '江苏', '武汉': '湖北', '西安': '陕西',
  '厦门': '福建', '青岛': '山东', '哈尔滨': '黑龙江', '拉萨': '西藏'
};
const STD_NAMES = new Set(CHINA_MAP.provinces.map(p => p.name));

function normProvince(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (STD_NAMES.has(s)) return s;
  if (PROV_ALIAS[s]) return PROV_ALIAS[s];
  // 去掉常见后缀再试
  const stripped = s.replace(/(省|市|自治区|特别行政区|维吾尔|壮族|回族)/g, '');
  if (STD_NAMES.has(stripped)) return stripped;
  if (PROV_ALIAS[stripped]) return PROV_ALIAS[stripped];
  return null; // 匹配不上：地图不着色，但不影响清单
}

function isChina(country) {
  if (!country) return true; // 默认按中国处理
  return /中国|中华|大陆|内地/.test(country) || country === '中国';
}

let viewMode = 'cn';   // 'cn' | 'world'
let selProvince = null; // 已选中省份（地图筛选）
let selCountry = null;  // 世界视图选中国家

export async function renderFootprints() {
  injectStylesOnce();
  const [trips, dayouts] = await Promise.all([listTrips(), listDayouts()]);

  // ── 汇总：记录条目（含跳转信息）按 省/国家/城市 聚合 ──
  // record: { kind:'trip'|'dayout', id, title, date, country, provinceStd, city }
  const records = [];
  for (const t of trips) {
    const cities = t.city && t.city.length ? t.city : [''];
    const provs = t.province && t.province.length ? t.province : [''];
    records.push({
      kind: 'trip', id: t.id, title: t.title || '未命名旅行',
      date: t.startDate || t.createdAt || '',
      country: t.country || '中国',
      provinceStd: normProvince(provs[0]),
      provinceRaw: provs[0] || '',
      city: cities[0] || ''
    });
  }
  for (const d of dayouts) {
    records.push({
      kind: 'dayout', id: d.id, title: d.title || '未命名外出',
      date: d.date || d.createdAt || '',
      country: d.country || '中国',
      provinceStd: normProvince(d.province),
      provinceRaw: d.province || '',
      city: d.city || ''
    });
  }

  // 省份次数（标准名 → count），用于地图着色与数字
  const provCount = new Map();
  for (const r of records) {
    if (!isChina(r.country)) continue;
    if (!r.provinceStd) continue;
    provCount.set(r.provinceStd, (provCount.get(r.provinceStd) || 0) + 1);
  }

  // 国家次数（世界视图）
  const countryCount = new Map();
  for (const r of records) {
    const c = r.country || '中国';
    countryCount.set(c, (countryCount.get(c) || 0) + 1);
  }

  // 城市集合（去重统计次数 + 关联记录）
  const cityMap = new Map(); // key=country|city → {city,country,provinceStd,count,recs[],lastDate}
  for (const r of records) {
    if (!r.city) continue;
    const key = (r.country || '') + '|' + r.city;
    if (!cityMap.has(key)) cityMap.set(key, {
      city: r.city, country: r.country, provinceStd: r.provinceStd,
      count: 0, recs: [], lastDate: ''
    });
    const c = cityMap.get(key);
    c.count++;
    c.recs.push(r);
    if ((r.date || '') > (c.lastDate || '')) c.lastDate = r.date;
  }
  const allCities = [...cityMap.values()];

  const provCountN = provCount.size;
  const countryN = countryCount.size;
  const cityN = allCities.length;
  const sub = `${cityN} 城 · ${provCountN} 省 · ${countryN} 国`;

  const content = el('div', { class: 'page-content footprints' });

  // 视图切换
  const seg = el('div', { class: 'fp-seg' }, [
    el('button', {
      class: 'fp-seg-btn' + (viewMode === 'cn' ? ' active' : ''),
      onclick: () => { viewMode = 'cn'; selProvince = null; selCountry = null; renderFootprints(); }
    }, '中国'),
    el('button', {
      class: 'fp-seg-btn' + (viewMode === 'world' ? ' active' : ''),
      onclick: () => { viewMode = 'world'; selProvince = null; selCountry = null; renderFootprints(); }
    }, '世界')
  ]);
  content.appendChild(seg);

  if (viewMode === 'cn') {
    content.appendChild(buildChinaMap(provCount));
    content.appendChild(buildFilterBar());
    content.appendChild(buildCityList(allCities, provCount));
  } else {
    content.appendChild(buildWorldView(countryCount, allCities));
  }

  mountPage({ title: '我的足迹', sub, activeTab: 'footprints', content });
}

// ── 中国省级 SVG 热力地图 ──
function buildChinaMap(provCount) {
  const max = Math.max(1, ...provCount.values());
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', CHINA_MAP.viewBox);
  svg.setAttribute('class', 'fp-svg');
  svg.setAttribute('role', 'img');

  for (const p of CHINA_MAP.provinces) {
    const n = provCount.get(p.name) || 0;
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', p.path);
    path.setAttribute('fill', rampColor(n, max));
    path.setAttribute('stroke', selProvince === p.name ? '#27500A' : '#FFFFFF');
    path.setAttribute('stroke-width', selProvince === p.name ? '2.2' : '0.8');
    path.setAttribute('stroke-linejoin', 'round');
    path.style.cursor = n ? 'pointer' : 'default';
    if (n) {
      path.addEventListener('click', () => {
        selProvince = (selProvince === p.name) ? null : p.name;
        renderFootprints();
      });
    }
    svg.appendChild(path);

    // 叠加次数数字（省总次数，方案A），只标有记录的省
    if (n) {
      const txt = document.createElementNS(NS, 'text');
      txt.setAttribute('x', p.cx);
      txt.setAttribute('y', p.cy + 5);
      txt.setAttribute('text-anchor', 'middle');
      txt.setAttribute('class', 'fp-svg-num');
      txt.setAttribute('fill', n >= max * 0.55 ? '#FFFFFF' : '#2A2E1F');
      txt.setAttribute('pointer-events', 'none');
      txt.textContent = String(n);
      svg.appendChild(txt);
    }
  }

  const card = el('div', { class: 'fp-mapwrap' }, [
    svg,
    el('div', { class: 'fp-legend' }, [
      el('span', { class: 'fp-legend-label' }, '少'),
      ...['#EFEDE3', '#C7DDA8', '#9FC772', '#74A346', '#5E8F4A', '#3E6630'].map(c =>
        el('span', { class: 'fp-legend-chip', style: { background: c } })),
      el('span', { class: 'fp-legend-label' }, '多'),
      el('span', { class: 'fp-legend-hint' }, '· 数字＝到访次数')
    ])
  ]);
  return card;
}

// ── 世界视图（按国家着色的简易方块 + 国家清单）──
function buildWorldView(countryCount, allCities) {
  const entries = [...countryCount.entries()].sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...countryCount.values());

  const grid = el('div', { class: 'fp-world-grid' },
    entries.map(([name, n]) => {
      const tile = el('button', {
        class: 'fp-world-tile' + (selCountry === name ? ' active' : ''),
        style: { background: rampColor(n, max), color: n >= max * 0.55 ? '#fff' : '#2A2E1F' },
        onclick: () => { selCountry = (selCountry === name ? null : name); renderFootprints(); }
      }, [
        el('div', { class: 'fp-world-name' }, name),
        el('div', { class: 'fp-world-num' }, `${n} 次`)
      ]);
      return tile;
    })
  );

  const wrap = el('div', {}, [
    el('div', { class: 'fp-world-note' }, '按国家 / 地区到访次数着色，点击查看该地城市'),
    grid
  ]);

  // 下方清单：按选中国家筛选城市
  const cities = selCountry ? allCities.filter(c => (c.country || '中国') === selCountry) : allCities;
  wrap.appendChild(buildFilterBar());
  wrap.appendChild(buildCityList(cities, null));
  return wrap;
}

// ── 筛选标签条 ──
function buildFilterBar() {
  const bar = el('div', { class: 'fp-filterbar' });
  if (viewMode === 'cn' && selProvince) {
    bar.appendChild(el('span', { class: 'fp-filter-tag' }, [
      selProvince,
      el('button', { class: 'fp-filter-x', onclick: () => { selProvince = null; renderFootprints(); } }, '×')
    ]));
  }
  if (viewMode === 'world' && selCountry) {
    bar.appendChild(el('span', { class: 'fp-filter-tag' }, [
      selCountry,
      el('button', { class: 'fp-filter-x', onclick: () => { selCountry = null; renderFootprints(); } }, '×')
    ]));
  }
  return bar;
}

// ── 城市清单 ──
function buildCityList(allCities, provCount) {
  let cities = allCities;
  if (viewMode === 'cn' && selProvince) {
    cities = allCities.filter(c => c.provinceStd === selProvince);
  }
  cities = cities.slice().sort((a, b) =>
    b.count - a.count || (b.lastDate || '').localeCompare(a.lastDate || ''));

  if (!cities.length) {
    if (selProvince || selCountry) {
      return el('div', { class: 'fp-citylist' }, [
        el('div', { class: 'fp-empty-sm' }, '该地区暂无带城市的记录')
      ]);
    }
    return el('div', { class: 'empty' }, [
      el('div', { class: 'icon' }, '◑'),
      el('div', { class: 'title' }, '足迹还是空的'),
      el('div', { class: 'desc' }, '在新建旅行 / 单日行时填写城市，这里会自动汇总')
    ]);
  }

  const title = el('div', { class: 'section-title' },
    selProvince ? `${selProvince} · ${cities.length} 城` :
    selCountry ? `${selCountry} · ${cities.length} 城` :
    '城市清单（按到访次数）');

  const list = el('div', { class: 'fp-citylist' },
    cities.map(c => el('div', {
      class: 'fp-city-row',
      onclick: () => openCity(c)
    }, [
      el('div', { class: 'fp-city-main' }, [
        el('div', { class: 'fp-city-name' }, c.city),
        el('div', { class: 'fp-city-meta' },
          [c.country, c.provinceStd || c.recs[0]?.provinceRaw].filter(Boolean).join(' · ') + ` · ${c.count} 次`)
      ]),
      el('div', { class: 'fp-city-right' }, [
        el('span', { class: 'fp-city-date' }, c.lastDate ? c.lastDate.slice(0, 10) : ''),
        el('span', { class: 'fp-city-arrow' }, '›')
      ])
    ]))
  );

  return el('div', { class: 'fp-section' }, [title, list]);
}

// ── 方式2：点城市行 → 单条直达详情，多条弹层选择 ──
function openCity(cityObj) {
  const recs = cityObj.recs.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  if (recs.length === 1) {
    gotoRecord(recs[0]);
    return;
  }
  showRecordPicker(cityObj.city, recs);
}

function gotoRecord(r) {
  if (r.kind === 'trip') navigate('#/trip/' + r.id);
  else if (r.kind === 'dayout') navigate('#/dayout/' + r.id);
}

function showRecordPicker(cityName, recs) {
  const sheet = el('div', {
    class: 'fp-sheet-overlay',
    onclick: (e) => { if (e.target === sheet) sheet.remove(); }
  });
  const panel = el('div', { class: 'fp-sheet-panel' }, [
    el('div', { class: 'fp-sheet-title' }, `${cityName} · ${recs.length} 条记录`),
    el('div', { class: 'fp-sheet-list' },
      recs.map(r => el('button', {
        class: 'fp-sheet-item',
        onclick: () => { sheet.remove(); gotoRecord(r); }
      }, [
        el('span', { class: 'fp-sheet-kind ' + (r.kind === 'trip' ? 'k-trip' : 'k-dayout') },
          r.kind === 'trip' ? '多日' : '单日'),
        el('div', { class: 'fp-sheet-item-main' }, [
          el('div', { class: 'fp-sheet-item-title' }, r.title),
          el('div', { class: 'fp-sheet-item-date' }, r.date ? r.date.slice(0, 10) : '')
        ]),
        el('span', { class: 'fp-city-arrow' }, '›')
      ]))
    ),
    el('button', { class: 'fp-sheet-cancel', onclick: () => sheet.remove() }, '取消')
  ]);
  sheet.appendChild(panel);
  document.body.appendChild(sheet);
}

// 颜色阶梯：0=浅灰底，1-5 由浅绿到深绿（与 App 主绿同系）
function rampColor(n, max) {
  if (!n) return '#EFEDE3';
  const ramp = ['#C7DDA8', '#9FC772', '#74A346', '#5E8F4A', '#3E6630'];
  const idx = Math.min(ramp.length - 1, Math.floor((n / max) * (ramp.length - 0.001)));
  return ramp[idx];
}

function injectStylesOnce() {
  const old = document.getElementById('fp-styles');
  if (old) old.remove();
  const css = `
    .footprints { display: flex; flex-direction: column; gap: 16px; }
    .fp-seg {
      display: flex; gap: 4px; background: var(--c-border-s);
      padding: 4px; border-radius: var(--r-md);
    }
    .fp-seg-btn {
      flex: 1; padding: 8px; border: 0; background: transparent;
      color: var(--c-text-2); font-size: 13px; border-radius: 7px;
      transition: all 0.15s;
    }
    .fp-seg-btn.active { background: var(--c-surface); color: var(--c-text-1); font-weight: 500; }

    .fp-mapwrap {
      background: var(--c-surface); border: 0.5px solid var(--c-border);
      border-radius: var(--r-lg); padding: 10px;
    }
    .fp-svg { width: 100%; height: auto; display: block; }
    .fp-svg-num { font-size: 13px; font-weight: 500; }
    .fp-legend {
      display: flex; align-items: center; gap: 4px; flex-wrap: wrap;
      margin-top: 8px; padding: 0 4px; font-size: 11px; color: var(--c-text-3);
    }
    .fp-legend-chip { width: 16px; height: 9px; border-radius: 2px; }
    .fp-legend-label { font-size: 11px; color: var(--c-text-3); }
    .fp-legend-hint { margin-left: 4px; }

    .fp-filterbar { min-height: 0; }
    .fp-filterbar:empty { display: none; }
    .fp-filter-tag {
      display: inline-flex; align-items: center; gap: 6px;
      background: var(--c-accent); color: var(--c-accent-d);
      font-size: 12px; font-weight: 500; padding: 5px 6px 5px 12px; border-radius: 16px;
    }
    .fp-filter-x {
      width: 18px; height: 18px; border-radius: 50%; border: 0;
      background: rgba(0,0,0,0.12); color: var(--c-accent-d);
      font-size: 13px; line-height: 1; padding: 0;
    }

    .fp-section { display: flex; flex-direction: column; gap: 8px; }
    .fp-citylist { display: flex; flex-direction: column; gap: 6px; }
    .fp-city-row {
      display: flex; justify-content: space-between; align-items: center; gap: 12px;
      padding: 11px 12px; background: var(--c-surface);
      border: 0.5px solid var(--c-border); border-radius: var(--r-md);
      cursor: pointer; transition: background 0.15s;
    }
    .fp-city-row:active { background: var(--c-border-s); }
    .fp-city-name { font-size: 13px; font-weight: 500; }
    .fp-city-meta { font-size: 11px; color: var(--c-text-2); margin-top: 2px; }
    .fp-city-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
    .fp-city-date { font-size: 11px; color: var(--c-text-3); }
    .fp-city-arrow { font-size: 18px; color: var(--c-text-3); }
    .fp-empty-sm { font-size: 12px; color: var(--c-text-3); padding: 14px 2px; text-align: center; }

    .fp-world-note { font-size: 12px; color: var(--c-text-2); margin-bottom: 10px; }
    .fp-world-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
      gap: 8px; margin-bottom: 16px;
    }
    .fp-world-tile {
      border: 0.5px solid var(--c-border); border-radius: var(--r-md);
      padding: 14px 8px; text-align: center; min-width: 0;
    }
    .fp-world-tile.active { outline: 2px solid var(--c-primary); }
    .fp-world-name { font-size: 13px; font-weight: 500; }
    .fp-world-num { font-size: 11px; margin-top: 2px; opacity: 0.85; }

    .fp-sheet-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.45);
      display: flex; align-items: flex-end; justify-content: center; z-index: 200;
      animation: fpFade 0.18s ease;
    }
    .fp-sheet-panel {
      width: 100%; max-width: var(--max-w); background: var(--c-bg);
      border-radius: 16px 16px 0 0;
      padding: 18px 16px calc(20px + env(safe-area-inset-bottom, 0));
      animation: fpSlide 0.22s ease;
    }
    .fp-sheet-title { font-size: 13px; color: var(--c-text-2); text-align: center; padding-bottom: 12px; }
    .fp-sheet-list { display: flex; flex-direction: column; gap: 8px; }
    .fp-sheet-item {
      display: flex; align-items: center; gap: 12px; width: 100%; text-align: left;
      background: var(--c-surface); border: 0.5px solid var(--c-border);
      border-radius: var(--r-md); padding: 12px;
    }
    .fp-sheet-item:active { background: var(--c-border-s); }
    .fp-sheet-kind {
      font-size: 10px; font-weight: 500; padding: 2px 7px; border-radius: 4px; flex-shrink: 0;
    }
    .fp-sheet-kind.k-trip { background: var(--c-primary); color: #fff; }
    .fp-sheet-kind.k-dayout { background: var(--c-accent); color: var(--c-accent-d); }
    .fp-sheet-item-main { flex: 1; min-width: 0; }
    .fp-sheet-item-title { font-size: 13px; font-weight: 500; }
    .fp-sheet-item-date { font-size: 11px; color: var(--c-text-3); margin-top: 2px; }
    .fp-sheet-cancel {
      width: 100%; padding: 14px; background: transparent; color: var(--c-text-2);
      font-size: 14px; margin-top: 8px;
    }
    @keyframes fpFade { from { opacity: 0; } to { opacity: 1; } }
    @keyframes fpSlide { from { transform: translateY(100%); } to { transform: translateY(0); } }
  `;
  const style = document.createElement('style');
  style.id = 'fp-styles';
  style.textContent = css;
  document.head.appendChild(style);
}
