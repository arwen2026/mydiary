import { mountPage } from '../shell.js';
import { el, fmtDate, fmtMoney } from '../utils.js';
import { getDayout } from '../db.js';
import { photoIdToObjectUrl } from '../photos.js';
import { navigate } from '../router.js';

export async function renderDayoutDetail({ params }) {
  const d = await getDayout(params.id);
  if (!d) {
    mountPage({
      title: '未找到',
      leftBtn: { icon: '‹', onclick: () => navigate('#/') },
      content: el('div', { class: 'empty' }, [
        el('div', { class: 'icon' }, '○'),
        el('div', { class: 'title' }, '记录不存在或已被删除')
      ])
    });
    return;
  }

  injectStylesOnce();
  const coverUrl = d.coverPhotoId ? await photoIdToObjectUrl(d.coverPhotoId) : null;
  const photoUrls = await Promise.all((d.photos || []).map(p => photoIdToObjectUrl(p.id)));

  const cover = el('div', { class: 'dayout-cover' + (coverUrl ? ' has-cover' : '') }, [
    coverUrl ? el('img', { src: coverUrl, alt: '' }) : null,
    coverUrl ? el('div', { class: 'mask' }) : null,
    el('div', { class: 'cover-body' }, [
      el('div', { class: 'cover-badge' }, `单日 · ${d.subtype || '其他'}`),
      el('div', { class: 'cover-title' }, d.title || '未命名'),
      el('div', { class: 'cover-meta' }, [
        d.date ? fmtDate(d.date) : '',
        [d.province, d.city].filter(Boolean).join(' · ')
      ].filter(Boolean).join(' · '))
    ])
  ]);

  const body = el('div', { class: 'dayout-body' }, [
    d.rating ? el('div', { class: 'rating-line' }, [
      el('span', { class: 'muted' }, '心情'),
      el('span', { class: 'stars' }, '★'.repeat(d.rating) + '☆'.repeat(5 - d.rating))
    ]) : null,
    d.note ? el('div', { class: 'note' }, d.note) : null,
    photoUrls.length ? el('div', { class: 'photos' },
      photoUrls.filter(Boolean).map(url => el('div', { class: 'photo' }, el('img', { src: url, alt: '' })))
    ) : null,
    el('div', { class: 'meta-cards' }, [
      el('div', { class: 'meta-card' }, [
        el('div', { class: 'meta-label' }, '花费'),
        el('div', { class: 'meta-value' }, fmtMoney(d.cost || 0))
      ]),
      el('div', { class: 'meta-card' }, [
        el('div', { class: 'meta-label' }, '照片'),
        el('div', { class: 'meta-value' }, String((d.photos || []).length))
      ])
    ])
  ]);

  mountPage({
    title: '单日行',
    leftBtn: { icon: '‹', onclick: () => navigate('#/') },
    rightBtns: [{ icon: '✎', label: '编辑', onclick: () => navigate(`#/edit/dayout/${d.id}`) }],
    content: el('div', { class: 'dayout-page' }, [cover, body])
  });
}

function injectStylesOnce() {
  const old = document.getElementById('dayout-styles');
  if (old) old.remove();
  const css = `
    .dayout-page { padding-bottom: 24px; }
    .dayout-cover {
      position: relative; height: 200px;
      margin-left: 16px; margin-right: 16px; margin-top: 16px;
      border-radius: 16px;
      background: linear-gradient(135deg, #C0DD97, #97C459);
      overflow: hidden;
      border: 0.5px solid var(--c-border);
      box-shadow: 0 2px 8px rgba(42, 46, 31, 0.06);
    }
    .dayout-cover img { width: 100%; height: 100%; object-fit: cover; position: absolute; inset: 0; }
    .dayout-cover .mask { position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.55), rgba(0,0,0,0) 60%); }
    .dayout-cover .cover-body { position: absolute; left: 16px; right: 16px; bottom: 14px; color: #fff; z-index: 2; }
    .dayout-cover .cover-badge {
      display: inline-block; background: rgba(255,255,255,0.95); color: var(--c-primary);
      padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 500;
    }
    .dayout-cover .cover-title { font-size: 20px; font-weight: 500; margin-top: 8px; }
    .dayout-cover .cover-meta { font-size: 12px; opacity: 0.92; margin-top: 2px; }

    .dayout-body { padding: 12px 16px 18px; display: flex; flex-direction: column; gap: 16px; }
    .rating-line { display: flex; justify-content: space-between; align-items: center; }
    .rating-line .stars { color: var(--c-warm); font-size: 16px; letter-spacing: 2px; }
    .note {
      font-size: 14px; line-height: 1.85; color: var(--c-text-1);
      white-space: pre-wrap; background: var(--c-surface);
      padding: 14px 16px; border-radius: var(--r-lg); border: 0.5px solid var(--c-border);
    }
    .photos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
    .photos .photo { aspect-ratio: 1; border-radius: var(--r-md); overflow: hidden; background: var(--c-border-s); }
    .photos .photo img { width: 100%; height: 100%; object-fit: cover; }

    .meta-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .meta-card { background: var(--c-surface); border: 0.5px solid var(--c-border); border-radius: var(--r-md); padding: 12px; }
    .meta-label { font-size: 11px; color: var(--c-text-2); }
    .meta-value { font-size: 16px; font-weight: 500; margin-top: 4px; }
  `;
  const style = document.createElement('style');
  style.id = 'dayout-styles';
  style.textContent = css;
  document.head.appendChild(style);
}
