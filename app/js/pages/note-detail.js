import { mountPage } from '../shell.js';
import { el, fmtDate } from '../utils.js';
import { getNote } from '../db.js';
import { photoIdToObjectUrl } from '../photos.js';
import { navigate } from '../router.js';

export async function renderNoteDetail({ params }) {
  const n = await getNote(params.id);
  if (!n) {
    mountPage({
      title: '未找到',
      leftBtn: { icon: '‹', onclick: () => navigate('#/') },
      content: el('div', { class: 'empty' }, [
        el('div', { class: 'icon' }, '○'),
        el('div', { class: 'title' }, '随笔不存在或已被删除')
      ])
    });
    return;
  }

  injectStylesOnce();
  const photoUrls = await Promise.all((n.photos || []).map(p => photoIdToObjectUrl(p.id)));

  const content = el('div', { class: 'note-page' }, [
    el('div', { class: 'note-head' }, [
      el('div', { class: 'note-meta' }, [
        n.date ? fmtDate(n.date) : '',
        weekday(n.date),
        n.mood
      ].filter(Boolean).join(' · ')),
      el('h1', { class: 'note-title' }, n.title || '未命名'),
      n.rating ? el('div', { class: 'note-stars' }, '★'.repeat(n.rating) + '☆'.repeat(5 - n.rating)) : null
    ]),
    el('div', { class: 'note-body' }, n.note || ''),
    photoUrls.length ? el('div', { class: 'note-photos' },
      photoUrls.filter(Boolean).map(url => el('div', { class: 'note-photo' }, el('img', { src: url, alt: '' })))
    ) : null
  ]);

  mountPage({
    title: '生活随笔',
    leftBtn: { icon: '‹', onclick: () => navigate('#/') },
    rightBtns: [{ icon: '✎', label: '编辑', onclick: () => navigate(`#/edit/note/${n.id}`) }],
    content
  });
}

function weekday(d) {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '';
  return ['周日','周一','周二','周三','周四','周五','周六'][date.getDay()];
}

function injectStylesOnce() {
  if (document.getElementById('note-detail-styles')) return;
  const css = `
    .note-page { background: var(--c-surface); min-height: calc(100vh - var(--topbar-h) - var(--tabbar-h)); padding: 32px 24px 60px; }
    .note-head { padding-bottom: 18px; margin-bottom: 18px; border-bottom: 0.5px solid var(--c-border); }
    .note-meta { font-size: 11px; color: var(--c-text-2); letter-spacing: 0.05em; }
    .note-title { font-size: 22px; font-weight: 500; margin-top: 8px; line-height: 1.4; color: var(--c-text-1); }
    .note-stars { color: var(--c-warm); font-size: 14px; letter-spacing: 2px; margin-top: 10px; }
    .note-body {
      font-size: 15px; line-height: 1.95; color: var(--c-text-1);
      white-space: pre-wrap;
    }
    .note-photos {
      display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; margin-top: 24px;
    }
    .note-photo { aspect-ratio: 4/3; border-radius: var(--r-md); overflow: hidden; background: var(--c-border-s); }
    .note-photo img { width: 100%; height: 100%; object-fit: cover; }
  `;
  const style = document.createElement('style');
  style.id = 'note-detail-styles';
  style.textContent = css;
  document.head.appendChild(style);
}
