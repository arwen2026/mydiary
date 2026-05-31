const routes = [];

export function defineRoute(pattern, handler) {
  const keys = [];
  const re = new RegExp(
    '^' +
    pattern.replace(/:[^/]+/g, (m) => {
      keys.push(m.slice(1));
      return '([^/]+)';
    }).replace(/\//g, '\\/') +
    '$'
  );
  routes.push({ pattern, re, keys, handler });
}

function parseHash() {
  let hash = location.hash || '#/';
  if (!hash.startsWith('#')) hash = '#' + hash;
  let path = hash.slice(1);
  const qIndex = path.indexOf('?');
  let query = {};
  if (qIndex >= 0) {
    const qs = path.slice(qIndex + 1);
    path = path.slice(0, qIndex);
    for (const pair of qs.split('&')) {
      if (!pair) continue;
      const [k, v = ''] = pair.split('=');
      query[decodeURIComponent(k)] = decodeURIComponent(v);
    }
  }
  if (!path || path === '') path = '/';
  return { path, query };
}

export async function dispatch() {
  const { path, query } = parseHash();
  for (const r of routes) {
    const m = path.match(r.re);
    if (m) {
      const params = {};
      r.keys.forEach((k, i) => params[k] = decodeURIComponent(m[i + 1]));
      try {
        await r.handler({ params, query, path });
      } catch (err) {
        console.error('[router] handler error:', err);
        renderError(err);
      }
      return;
    }
  }
  renderNotFound(path);
}

function renderError(err) {
  const app = document.getElementById('app');
  app.innerHTML = '';
  const div = document.createElement('div');
  div.className = 'empty';
  div.innerHTML = `<div class="icon">⚠</div><div class="title">出错了</div><div class="desc">${err && err.message ? err.message : String(err)}</div>`;
  app.appendChild(div);
}

function renderNotFound(path) {
  const app = document.getElementById('app');
  app.innerHTML = '';
  const div = document.createElement('div');
  div.className = 'empty';
  div.innerHTML = `<div class="icon">○</div><div class="title">页面不存在</div><div class="desc">${path}</div>`;
  app.appendChild(div);
}

export function navigate(hash) {
  if (location.hash === hash) {
    dispatch();
  } else {
    location.hash = hash;
  }
}

export function initRouter() {
  window.addEventListener('hashchange', dispatch);
  if (!location.hash) location.hash = '#/';
  else dispatch();
}
