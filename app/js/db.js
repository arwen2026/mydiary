const DB_NAME = 'tripdiary';
const DB_VERSION = 2;
const STORES = ['trips', 'dayouts', 'entries', 'photos', 'meta', 'notes'];

let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('trips')) {
        const s = db.createObjectStore('trips', { keyPath: 'id' });
        s.createIndex('startDate', 'startDate');
        s.createIndex('updatedAt', 'updatedAt');
      }
      if (!db.objectStoreNames.contains('dayouts')) {
        const s = db.createObjectStore('dayouts', { keyPath: 'id' });
        s.createIndex('date', 'date');
        s.createIndex('updatedAt', 'updatedAt');
      }
      if (!db.objectStoreNames.contains('entries')) {
        const s = db.createObjectStore('entries', { keyPath: 'id' });
        s.createIndex('tripId', 'tripId');
        s.createIndex('datetime', 'datetime');
      }
      if (!db.objectStoreNames.contains('photos')) {
        db.createObjectStore('photos', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('notes')) {
        const s = db.createObjectStore('notes', { keyPath: 'id' });
        s.createIndex('date', 'date');
        s.createIndex('updatedAt', 'updatedAt');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(storeNames, mode = 'readonly') {
  return open().then(db => {
    const t = db.transaction(storeNames, mode);
    const result = { tx: t };
    const names = Array.isArray(storeNames) ? storeNames : [storeNames];
    for (const n of names) result[n] = t.objectStore(n);
    result.done = new Promise((resolve, reject) => {
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
    return result;
  });
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function putTrip(trip) {
  const t = await tx('trips', 'readwrite');
  await reqToPromise(t.trips.put(trip));
  await t.done;
  return trip;
}

export async function getTrip(id) {
  const t = await tx('trips');
  return reqToPromise(t.trips.get(id));
}

export async function deleteTrip(id) {
  const t = await tx(['trips', 'entries'], 'readwrite');
  await reqToPromise(t.trips.delete(id));
  const idx = t.entries.index('tripId');
  const cursor = idx.openCursor(IDBKeyRange.only(id));
  await new Promise((resolve, reject) => {
    cursor.onsuccess = (e) => {
      const c = e.target.result;
      if (c) { c.delete(); c.continue(); } else resolve();
    };
    cursor.onerror = () => reject(cursor.error);
  });
  await t.done;
}

export async function listTrips() {
  const t = await tx('trips');
  return reqToPromise(t.trips.getAll());
}

export async function putDayout(dayout) {
  const t = await tx('dayouts', 'readwrite');
  await reqToPromise(t.dayouts.put(dayout));
  await t.done;
  return dayout;
}

export async function getDayout(id) {
  const t = await tx('dayouts');
  return reqToPromise(t.dayouts.get(id));
}

export async function deleteDayout(id) {
  const t = await tx('dayouts', 'readwrite');
  await reqToPromise(t.dayouts.delete(id));
  await t.done;
}

export async function listDayouts() {
  const t = await tx('dayouts');
  return reqToPromise(t.dayouts.getAll());
}

export async function putNote(note) {
  const t = await tx('notes', 'readwrite');
  await reqToPromise(t.notes.put(note));
  await t.done;
  return note;
}

export async function getNote(id) {
  const t = await tx('notes');
  return reqToPromise(t.notes.get(id));
}

export async function deleteNote(id) {
  const t = await tx('notes', 'readwrite');
  await reqToPromise(t.notes.delete(id));
  await t.done;
}

export async function listNotes() {
  const t = await tx('notes');
  return reqToPromise(t.notes.getAll());
}

export async function putEntry(entry) {
  const t = await tx('entries', 'readwrite');
  await reqToPromise(t.entries.put(entry));
  await t.done;
  return entry;
}

export async function getEntry(id) {
  const t = await tx('entries');
  return reqToPromise(t.entries.get(id));
}

export async function deleteEntry(id) {
  const t = await tx('entries', 'readwrite');
  await reqToPromise(t.entries.delete(id));
  await t.done;
}

export async function listEntriesByTrip(tripId) {
  const t = await tx('entries');
  const idx = t.entries.index('tripId');
  return reqToPromise(idx.getAll(IDBKeyRange.only(tripId)));
}

export async function putPhoto(photo) {
  const t = await tx('photos', 'readwrite');
  await reqToPromise(t.photos.put(photo));
  await t.done;
  return photo;
}

export async function getPhoto(id) {
  const t = await tx('photos');
  return reqToPromise(t.photos.get(id));
}

export async function getPhotos(ids) {
  if (!ids || !ids.length) return [];
  const t = await tx('photos');
  return Promise.all(ids.map(id => reqToPromise(t.photos.get(id))));
}

export async function deletePhoto(id) {
  const t = await tx('photos', 'readwrite');
  await reqToPromise(t.photos.delete(id));
  await t.done;
}

export async function exportAll() {
  const [trips, dayouts, notes, entries] = await Promise.all([
    listTrips(), listDayouts(), listNotes(), (async () => {
      const t = await tx('entries');
      return reqToPromise(t.entries.getAll());
    })()
  ]);
  const t = await tx('photos');
  const photos = await reqToPromise(t.photos.getAll());
  const photosForExport = await Promise.all(photos.map(async p => ({
    id: p.id,
    originalName: p.originalName,
    takenAt: p.takenAt,
    addedAt: p.addedAt,
    thumbDataUrl: await blobToDataURL(p.blob)
  })));
  return {
    schema: 'tripdiary/v1',
    exportedAt: new Date().toISOString(),
    trips, dayouts, notes, entries,
    photos: photosForExport
  };
}

export async function importAll(payload) {
  if (!payload || payload.schema !== 'tripdiary/v1') throw new Error('备份格式不兼容');
  const t = await tx(['trips','dayouts','notes','entries','photos'], 'readwrite');
  for (const x of (payload.trips || []))   await reqToPromise(t.trips.put(x));
  for (const x of (payload.dayouts || [])) await reqToPromise(t.dayouts.put(x));
  for (const x of (payload.notes || []))   await reqToPromise(t.notes.put(x));
  for (const x of (payload.entries || [])) await reqToPromise(t.entries.put(x));
  for (const p of (payload.photos || [])) {
    const blob = await dataUrlToBlob(p.thumbDataUrl);
    await reqToPromise(t.photos.put({
      id: p.id, blob, originalName: p.originalName, takenAt: p.takenAt, addedAt: p.addedAt
    }));
  }
  await t.done;
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

async function dataUrlToBlob(dataUrl) {
  const res = await fetch(dataUrl);
  return res.blob();
}

export async function clearAll() {
  const t = await tx(STORES, 'readwrite');
  for (const s of STORES) await reqToPromise(t[s].clear());
  await t.done;
}

export async function getMeta(key, fallback = null) {
  const t = await tx('meta');
  const r = await reqToPromise(t.meta.get(key));
  return r ? r.value : fallback;
}

export async function setMeta(key, value) {
  const t = await tx('meta', 'readwrite');
  await reqToPromise(t.meta.put({ key, value }));
  await t.done;
}
