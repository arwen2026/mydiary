import { el, clear } from './utils.js';
import { TABS } from './config.js';

export function mountPage(opts) {
  const { title, sub, leftBtn, rightBtns = [], activeTab, content, fab } = opts;
  const app = document.getElementById('app');
  clear(app);

  const page = el('div', { class: 'page' });

  const topbar = el('div', { class: 'topbar' }, [
    el('div', { class: 'left' }, [
      leftBtn
        ? el('button', { class: 'icon-btn', onclick: leftBtn.onclick, 'aria-label': leftBtn.label || '返回' }, leftBtn.icon || '‹')
        : null,
      el('div', {}, [
        el('div', { class: 'title' }, title || ''),
        sub ? el('div', { class: 'sub' }, sub) : null
      ])
    ]),
    el('div', { class: 'right' },
      rightBtns.map(b =>
        el('button', {
          class: 'icon-btn' + (b.primary ? ' primary' : ''),
          onclick: b.onclick,
          'aria-label': b.label || ''
        }, b.icon)
      )
    )
  ]);

  const tabbar = activeTab ? renderTabbar(activeTab) : null;
  const fabNode = fab ? el('button', { class: 'fab', onclick: fab.onclick, 'aria-label': fab.label || '新建' }, fab.icon || '+') : null;

  page.appendChild(topbar);
  if (content instanceof Node) page.appendChild(content);
  else if (content) page.appendChild(el('div', { class: 'page-content' }, content));
  if (tabbar) page.appendChild(tabbar);
  if (fabNode) page.appendChild(fabNode);

  app.appendChild(page);
}

function renderTabbar(activeId) {
  return el('nav', { class: 'tabbar' },
    TABS.map(t =>
      el('a', {
        class: 'tab' + (t.id === activeId ? ' active' : ''),
        href: t.route
      }, [
        el('span', { class: 'icon' }, t.icon),
        el('span', {}, t.label)
      ])
    )
  );
}
