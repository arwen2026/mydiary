import { mountPage } from '../shell.js';
import { el, uid, todayISO } from '../utils.js';
import { getEntry, putEntry, deleteEntry, getTrip } from '../db.js';
import { navigate } from '../router.js';
import { CATEGORIES } from '../config.js';
import { injectEditStylesOnce, field, chipRow, photoGrid } from './edit-shared.js';

export async function renderEditEntry({ params, query }) {
  injectEditStylesOnce();
  const isNew = !params.id || params.id === 'new';
  const tripId = params.tripId;
  const trip = await getTrip(tripId);
  if (!trip) {
    navigate('#/');
    return;
  }

  let entry = isNew ? newEntry(tripId, trip, query?.day) : (await getEntry(params.id)) || newEntry(tripId, trip, query?.day);
  const state = { ...entry };
  state.photos = state.photos || [];

  const titleInput = el('input', {
    type: 'text', placeholder: '比如：市场寿司',
    value: state.title || '',
    oninput: e => state.title = e.target.value
  });
  const datetimeInput = el('input', {
    type: 'datetime-local',
    value: toLocalDatetime(state.datetime),
    oninput: e => state.datetime = fromLocalDatetime(e.target.value)
  });
  const costInput = el('input', {
    type: 'number', placeholder: '0',
    value: state.cost ?? '',
    oninput: e => state.cost = e.target.value ? Number(e.target.value) : 0
  });
  const locationInput = el('input', {
    type: 'text', placeholder: '比如：大阪市中央区 · 黑门市场',
    value: state.location || '',
    oninput: e => state.location = e.target.value
  });
  const noteInput = el('textarea', {
    placeholder: '写点什么吧。可以是几句话，也可以是一小段。',
    rows: 5,
    oninput: e => state.note = e.target.value
  }, state.note || '');

  const categoryRow = chipRow(CATEGORIES, () => state.category || '景点',
    v => { state.category = v; });

  const photos = photoGrid(state, 'photos', () => {});

  const content = el('div', { class: 'page-content' }, [
    field('类型', categoryRow),
    field('标题', titleInput),
    el('div', { class: 'form-section' }, [
      el('div', { class: 'form-row' }, [
        field('时间', datetimeInput),
        field('花费 ¥', costInput, { optional: true })
      ])
    ]),
    field('地点', locationInput, { optional: true }),
    field('日记', noteInput, { optional: true }),
    field('照片', photos, { optional: true }),

    el('div', { class: 'form-actions' }, [
      el('button', {
        class: 'btn-primary',
        onclick: () => save(state, tripId, isNew)
      }, '保存'),
      !isNew ? el('button', {
        class: 'btn-ghost',
        onclick: async () => {
          if (confirm('删除这条记录？')) {
            await deleteEntry(state.id);
            navigate(`#/trip/${tripId}`);
          }
        }
      }, '删除') : null
    ])
  ]);

  mountPage({
    title: isNew ? '新建条目' : '编辑条目',
    sub: trip.title,
    leftBtn: { icon: '✕', onclick: () => history.back() },
    content
  });
}

function newEntry(tripId, trip, preferredDay) {
  // 方案 A：默认时间 = 创建瞬间 now（年月日 + 时分都取本地当下）
  // 用户若手动改时间，按用户填的为准；不改则按 now 存储，
  // 可能落到游离日（非 trip 日期范围内），需用户自己拖到对应 Day
  const now = new Date();
  const yyyy = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const local = `${yyyy}-${mo}-${dd}T${hh}:${mm}`;
  return {
    id: uid(),
    tripId,
    datetime: fromLocalDatetime(local),
    category: '景点',
    title: '', location: '', note: '',
    photos: [], cost: 0,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  };
}

function toLocalDatetime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function fromLocalDatetime(local) {
  if (!local) return new Date().toISOString();
  const d = new Date(local);
  return d.toISOString();
}

async function save(state, tripId, isNew) {
  if (!state.title || !state.title.trim()) {
    alert('请填写标题');
    return;
  }
  state.updatedAt = new Date().toISOString();
  await putEntry(state);
  navigate(`#/trip/${tripId}`);
}
