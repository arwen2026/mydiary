import { mountPage } from '../shell.js';
import { el } from '../utils.js';
import { APP_NAME, VERSION } from '../config.js';
import { exportJSON, shareJSON, importJSON, clearAllData } from '../export.js';

export function renderMe() {
  injectStylesOnce();
  const content = el('div', { class: 'page-content me-page' }, [
    el('div', { class: 'card' }, [
      el('div', { style: { fontSize: '15px', fontWeight: '500' } }, APP_NAME),
      el('div', { class: 'muted', style: { fontSize: '12px', marginTop: '4px' } }, `版本 ${VERSION}`),
      el('div', { style: { fontSize: '12px', marginTop: '12px', lineHeight: '1.8' }, class: 'muted' },
        '数据完全保存在本机浏览器中，不上传任何外部服务。换设备前请使用「导出 JSON」备份。')
    ]),

    el('div', { class: 'me-section' }, [
      el('div', { class: 'section-title' }, '数据'),
      menuItem('⇪ 分享 / 备份', '调出系统分享，可 AirDrop、存到「文件」、发微信或邮件', shareJSON),
      menuItem('◇ 导出 JSON 备份', '把所有旅行 / 单日行 / 条目 / 缩略图打包成一个文件', exportJSON),
      menuItem('◆ 从 JSON 导入', '从备份文件恢复数据，冲突 id 会被覆盖', importJSON),
      menuItem('⚠ 清空所有数据', '不可撤销，建议先导出备份', clearAllData, true)
    ]),

    el('div', { class: 'me-section' }, [
      el('div', { class: 'section-title' }, '应用'),
      menuItem('↻ 检查更新', '清掉浏览器缓存和 Service Worker 后重载，强制拉取最新代码（不会删除你的数据）', checkUpdate)
    ]),

    el('div', { class: 'me-section' }, [
      el('div', { class: 'section-title' }, '关于'),
      el('div', { class: 'card', style: { fontSize: '12px', lineHeight: '1.9', color: 'var(--c-text-2)' } },
        '· 数据存在浏览器 IndexedDB，不联网\n· 缩略图最大 1200px，原图请自行归档在硬盘 / NAS\n· 单页 HTML 导出在每个旅行的「更多」菜单中\n· 后续将支持 PWA 安装到桌面')
    ])
  ]);

  mountPage({
    title: '我的',
    activeTab: 'me',
    content
  });
}

async function checkUpdate() {
  if (!confirm('清缓存并强制刷新到最新版？\n\n你的旅行/照片/条目数据不会丢失（仅清掉应用代码缓存）。')) {
    return;
  }
  try {
    // 1. 注销所有 Service Worker
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const r of regs) await r.unregister();
    }
    // 2. 清掉 Cache Storage（所有命名缓存）
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    // 3. 硬刷新（带时间戳绕过 HTTP 缓存）
    const u = new URL(location.href);
    u.searchParams.set('_t', Date.now());
    location.replace(u.toString());
  } catch (err) {
    alert('更新失败：' + (err?.message || err) + '\n请尝试关闭浏览器后重新打开。');
  }
}

function menuItem(label, desc, onClick, danger) {
  return el('button', {
    class: 'menu-item' + (danger ? ' danger' : ''),
    onclick: onClick
  }, [
    el('div', { class: 'menu-label' }, label),
    el('div', { class: 'menu-desc' }, desc)
  ]);
}

function injectStylesOnce() {
  if (document.getElementById('me-styles')) return;
  const css = `
    .me-page { display: flex; flex-direction: column; gap: 18px; }
    .me-section { display: flex; flex-direction: column; gap: 6px; }
    .menu-item {
      width: 100%; text-align: left; padding: 14px 16px;
      background: var(--c-surface); border: 0.5px solid var(--c-border); border-radius: var(--r-md);
      color: var(--c-text-1); transition: background 0.15s;
    }
    .menu-item:active { background: var(--c-border-s); }
    .menu-item.danger .menu-label { color: var(--c-state-bad); }
    .menu-label { font-size: 14px; font-weight: 500; }
    .menu-desc { font-size: 11px; color: var(--c-text-2); margin-top: 4px; line-height: 1.6; }
    .me-page .card { white-space: pre-line; }
  `;
  const style = document.createElement('style');
  style.id = 'me-styles';
  style.textContent = css;
  document.head.appendChild(style);
}
