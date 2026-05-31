import { mountPage } from '../shell.js';
import { el, uid, todayISO } from '../utils.js';
import { getTrip, putTrip, deleteTrip } from '../db.js';
import { navigate } from '../router.js';
import { injectEditStylesOnce, field, chipRow, coverPicker, ratingPicker } from './edit-shared.js';

const STATUS_OPTIONS = [
  { id: 'planning', label: '计划中' },
  { id: 'ongoing',  label: '进行中' },
  { id: 'done',     label: '已结束' }
];

export async function renderEditTrip({ params }) {
  injectEditStylesOnce();
  const isNew = !params.id || params.id === 'new';
  let trip = isNew
    ? newTrip()
    : (await getTrip(params.id)) || newTrip();

  const state = { ...trip };

  const titleInput = el('input', {
    type: 'text', placeholder: '比如：日本关西 · 樱花季',
    value: state.title || '',
    oninput: e => state.title = e.target.value
  });
  const startInput = el('input', {
    type: 'date', value: state.startDate || todayISO(),
    oninput: e => state.startDate = e.target.value
  });
  const endInput = el('input', {
    type: 'date', value: state.endDate || todayISO(),
    oninput: e => state.endDate = e.target.value
  });
  const countryInput = el('input', {
    type: 'text', placeholder: '中国 / 日本 / 法国 …',
    value: state.country || '中国',
    oninput: e => state.country = e.target.value
  });
  const provinceInput = el('input', {
    type: 'text', placeholder: '云南 / 大阪府（多个用 / 分隔）',
    value: (state.province || []).join(' / '),
    oninput: e => state.province = e.target.value.split('/').map(s => s.trim()).filter(Boolean)
  });
  const cityInput = el('input', {
    type: 'text', placeholder: '大理 / 丽江 / 香格里拉（多个用 / 分隔）',
    value: (state.city || []).join(' / '),
    oninput: e => state.city = e.target.value.split('/').map(s => s.trim()).filter(Boolean)
  });

  const cover = coverPicker(state, 'coverPhotoId', () => {});

  const statusRow = chipRow(STATUS_OPTIONS, () => state.status || 'planning',
    v => { state.status = v; });

  const introInput = el('textarea', {
    placeholder: '一两句话写下出发前的期待 / 这次为什么去（显示在阅读态封面）',
    rows: 3,
    oninput: e => state.intro = e.target.value
  }, state.intro || '');

  const reviewInput = el('textarea', {
    placeholder: '回过头看这次旅行，可以写一段话（显示在阅读态尾页）',
    rows: 5,
    oninput: e => state.review = e.target.value
  }, state.review || '');

  const ratingNode = ratingPicker(() => state.rating || 0, v => { state.rating = v; });

  const content = el('div', { class: 'page-content' }, [
    field('封面照片', cover, { optional: true }),
    field('标题', titleInput),
    el('div', { class: 'form-section' }, [
      el('div', { class: 'form-row' }, [
        field('开始日期', startInput),
        field('结束日期', endInput)
      ])
    ]),
    field('国家 / 地区', countryInput),
    field('省份 / 都道府县', provinceInput, { optional: true }),
    field('城市', cityInput, { optional: true }),
    field('状态', statusRow),
    field('前言（写在开始）', introInput, { optional: true }),
    field('整体评价（写在结束）', reviewInput, { optional: true }),
    field('整体评分', ratingNode, { optional: true }),

    el('div', { class: 'form-actions' }, [
      el('button', {
        class: 'btn-primary',
        onclick: async () => { await save(state, isNew); }
      }, '保存'),
      !isNew ? el('button', {
        class: 'btn-ghost',
        onclick: async () => {
          if (confirm('删除这个行程？所有相关条目都会被删除，无法撤销。')) {
            await deleteTrip(trip.id);
            navigate('#/');
          }
        }
      }, '删除') : null
    ])
  ]);

  mountPage({
    title: isNew ? '新建旅行' : '编辑旅行',
    leftBtn: { icon: '✕', onclick: () => history.back() },
    content
  });
}

function newTrip() {
  const now = new Date().toISOString();
  return {
    id: uid(), type: 'trip', title: '',
    coverPhotoId: null,
    intro: '', review: '', rating: 0,
    startDate: todayISO(), endDate: todayISO(),
    country: '中国', province: [], city: [],
    status: 'planning',
    createdAt: now, updatedAt: now
  };
}

async function save(state, isNew) {
  if (!state.title || !state.title.trim()) {
    alert('请填写标题');
    return;
  }
  state.updatedAt = new Date().toISOString();
  await putTrip(state);
  navigate(`#/trip/${state.id}`);
}
