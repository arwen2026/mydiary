import { mountPage } from '../shell.js';
import { el, uid, todayISO } from '../utils.js';
import { getNote, putNote, deleteNote } from '../db.js';
import { navigate } from '../router.js';
import { injectEditStylesOnce, field, ratingPicker, photoGrid } from './edit-shared.js';

export async function renderEditNote({ params }) {
  injectEditStylesOnce();
  const isNew = !params.id || params.id === 'new';
  let note = isNew ? newNote() : (await getNote(params.id)) || newNote();
  const state = { ...note };
  state.photos = state.photos || [];

  const titleInput = el('input', {
    type: 'text', placeholder: '一个简短的标题，比如：周末读了一本书',
    value: state.title || '',
    oninput: e => state.title = e.target.value
  });
  const dateInput = el('input', {
    type: 'date', value: state.date || todayISO(),
    oninput: e => state.date = e.target.value
  });
  const moodInput = el('input', {
    type: 'text', placeholder: '可选：开心 / 平静 / 焦虑 / 思考 …',
    value: state.mood || '',
    oninput: e => state.mood = e.target.value
  });
  const noteInput = el('textarea', {
    placeholder: '今天在想什么？心情如何？想到什么写什么。',
    rows: 12,
    oninput: e => state.note = e.target.value
  }, state.note || '');

  const ratingNode = ratingPicker(() => state.rating || 0, v => { state.rating = v; });
  const photos = photoGrid(state, 'photos', () => {});

  const content = el('div', { class: 'page-content' }, [
    field('标题', titleInput),
    el('div', { class: 'form-section' }, [
      el('div', { class: 'form-row' }, [
        field('日期', dateInput),
        field('心情', moodInput, { optional: true })
      ])
    ]),
    field('正文', noteInput),
    field('评分', ratingNode, { optional: true }),
    field('配图', photos, { optional: true }),

    el('div', { class: 'form-actions' }, [
      el('button', {
        class: 'btn-primary',
        onclick: () => save(state)
      }, '保存'),
      !isNew ? el('button', {
        class: 'btn-ghost',
        onclick: async () => {
          if (confirm('删除这篇随笔？')) {
            await deleteNote(state.id);
            navigate('#/');
          }
        }
      }, '删除') : null
    ])
  ]);

  mountPage({
    title: isNew ? '新建随笔' : '编辑随笔',
    leftBtn: { icon: '✕', onclick: () => history.back() },
    content
  });
}

function newNote() {
  const now = new Date().toISOString();
  return {
    id: uid(),
    type: 'note',
    title: '',
    date: todayISO(),
    mood: '',
    note: '',
    rating: 0,
    photos: [],
    createdAt: now,
    updatedAt: now
  };
}

async function save(state) {
  if (!state.note || !state.note.trim()) {
    alert('正文不能为空');
    return;
  }
  if (!state.title || !state.title.trim()) {
    state.title = state.note.trim().slice(0, 16);
  }
  state.updatedAt = new Date().toISOString();
  await putNote(state);
  navigate(`#/note/${state.id}`);
}
