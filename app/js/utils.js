export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class' || k === 'className') node.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k === 'dataset' && typeof v === 'object') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k === 'html') {
      node.innerHTML = v;
    } else {
      node.setAttribute(k, v);
    }
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    if (child instanceof Node) node.appendChild(child);
    else node.appendChild(document.createTextNode(String(child)));
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function fmtMoney(n) {
  if (n === null || n === undefined || isNaN(n)) return '¥ 0';
  return '¥ ' + Math.round(n).toLocaleString('zh-CN');
}

export function fmtDate(d, withYear = true) {
  if (!d) return '';
  const date = (d instanceof Date) ? d : new Date(d);
  if (isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return withYear ? `${y}.${m}.${day}` : `${m}.${day}`;
}

export function fmtDateRange(start, end) {
  if (!start) return '';
  const s = new Date(start);
  if (!end) return fmtDate(s);
  const e = new Date(end);
  if (isNaN(e.getTime())) return fmtDate(s);
  if (s.getFullYear() === e.getFullYear()) {
    return `${fmtDate(s, true)} – ${fmtDate(e, false)}`;
  }
  return `${fmtDate(s)} – ${fmtDate(e)}`;
}

export function dayDiff(start, end) {
  if (!start || !end) return 0;
  const s = new Date(start), e = new Date(end);
  return Math.round((e - s) / 86400000) + 1;
}

export function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// 把 ISO 时间字符串（如 "2026-05-31T08:32:00.000Z"）按本地时区格式化为 "HH:mm"
// 注意：直接用 .slice(11,16) 会切到 UTC 时段，导致东八区显示比实际早 8 小时
export function fmtLocalHM(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
