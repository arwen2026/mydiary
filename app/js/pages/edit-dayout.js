import { mountPage } from '../shell.js';
import { el, uid, todayISO } from '../utils.js';
import { getDayout, putDayout, deleteDayout } from '../db.js';
import { navigate } from '../router.js';
import { DAYOUT_SUBTYPES } from '../config.js';
import { injectEditStylesOnce, field, chipRow, coverPicker, photoGrid, ratingPicker } from './edit-shared.js';

export async function renderEditDayout({ params }) {
  injectEditStylesOnce();
  const isNew = !params.id || params.id === 'new';
  let dayout = isNew ? newDayout() : (await getDayout(params.id)) || newDayout();
  const state = { ...dayout };
  state.photos = state.photos || [];

  const titleInput = el('input', {
    type: 'text', placeholder: '比如：爬香山',
    value: state.title || '',
    oninput: e => state.title = e.target.value
  });
  const dateInput = el('input', {
    type: 'date', value: state.date || todayISO(),
    oninput: e => state.date = e.target.value
  });
  const costInput = el('input', {
    type: 'number', placeholder: '0',
    value: state.cost ?? '',
    oninput: e => state.cost = e.target.value ? Number(e.target.value) : 0
  });
  const countryInput = el('input', {
    type: 'text', placeholder: '中国',
    value: state.country || '中国',
    oninput: e => state.country = e.target.value
  });
  const provinceInput = el('input', {
    type: 'text', placeholder: '北京 / 浙江',
    value: state.province || '',
    oninput: e => state.province = e.target.value
  });
  const cityInput = el('input', {
    type: 'text', placeholder: '海淀 / 杭州',
    value: state.city || '',
    oninput: e => state.city = e.target.value
  });
  const noteInput = el('textarea', {
    placeholder: '写点什么吧。可以是几句话，也可以是一小段。',
    rows: 6,
    oninput: e => state.note = e.target.value
  }, state.note || '');

  const cover = coverPicker(state, 'coverPhotoId', () => {});

  const subtypeRow = chipRow(DAYOUT_SUBTYPES, () => state.subtype || '其他',
    v => { state.subtype = v; });

  const ratingNode = ratingPicker(() => state.rating || 0,
    v => { state.rating = v; });

  const photos = photoGrid(state, 'photos', () => {});

  const content = el('div', { class: 'page-content' }, [
    field('封面照片', cover, { optional: true }),
    field('标题', titleInput),
    field('类型', subtypeRow),
    el('div', { class: 'form-section' }, [
      el('div', { class: 'form-row' }, [
        field('日期', dateInput),
        field('花费 ¥', costInput, { optional: true })
      ])
    ]),
    el('div', { class: 'form-section' }, [
      el('div', { class: 'form-row' }, [
        field('国家', countryInput),
        field('省份', provinceInput, { optional: true })
      ])
    ]),
    field('城市 / 区域', cityInput, { optional: true }),
    field('心情', ratingNode, { optional: true }),
    field('这次感受', noteInput, { optional: true }),
    field('照片', photos, { optional: true }),

    el('div', { class: 'form-actions' }, [
      el('button', {
        class: 'btn-primary',
        onclick: async () => save(state, isNew)
      }, '保存'),
      !isNew ? el('button', {
        class: 'btn-ghost',
        onclick: async () => {
          if (confirm('删除这次外出记录？')) {
            await deleteDayout(dayout.id);
            navigate('#/');
          }
        }
      }, '删除') : null
    ])
  ]);

  mountPage({
    title: isNew ? '记一次外出' : '编辑外出',
    leftBtn: { icon: '✕', onclick: () => history.back() },
    content
  });
}

function newDayout() {
  const now = new Date().toISOString();
  return {
    id: uid(), type: 'dayout',
    title: '', coverPhotoId: null,
    date: todayISO(),
    country: '中国', province: '', city: '',
    subtype: '其他',
    rating: 0, note: '',
    photos: [], cost: 0,
    createdAt: now, updatedAt: now
  };
}

async function save(state, isNew) {
  if (!state.title || !state.title.trim()) {
    alert('请填写标题');
    return;
  }
  state.updatedAt = new Date().toISOString();
  await putDayout(state);
  navigate(`#/dayout/${state.id}`);
}
