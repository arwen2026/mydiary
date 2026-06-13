import { putPhoto, getPhoto } from './db.js';
import { uid } from './utils.js';

const THUMB_MAX = 1200;
const THUMB_QUALITY = 0.75;

export async function fileToThumbBlob(file, maxEdge = THUMB_MAX, quality = THUMB_QUALITY) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const { width, height } = scaleFit(img.naturalWidth, img.naturalHeight, maxEdge);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);
    return await new Promise((resolve, reject) => {
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/jpeg', quality);
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function scaleFit(w, h, max) {
  if (w <= max && h <= max) return { width: w, height: h };
  if (w >= h) return { width: max, height: Math.round(h * max / w) };
  return { width: Math.round(w * max / h), height: max };
}

export async function ingestFile(file) {
  const blob = await fileToThumbBlob(file);
  const photo = {
    id: uid(),
    blob,
    originalName: file.name || 'unknown.jpg',
    takenAt: file.lastModified ? new Date(file.lastModified).toISOString() : null,
    addedAt: new Date().toISOString()
  };
  await putPhoto(photo);
  return photo;
}

export async function ingestBlob(blob, originalName = 'cover.jpg') {
  const photo = {
    id: uid(),
    blob,
    originalName,
    takenAt: null,
    addedAt: new Date().toISOString()
  };
  await putPhoto(photo);
  return photo;
}

const objectUrlCache = new Map();

export async function photoIdToObjectUrl(photoId) {
  if (!photoId) return null;
  if (objectUrlCache.has(photoId)) return objectUrlCache.get(photoId);
  const p = await getPhoto(photoId);
  if (!p) return null;
  const url = URL.createObjectURL(p.blob);
  objectUrlCache.set(photoId, url);
  return url;
}

export function revokeAllPhotoUrls() {
  for (const url of objectUrlCache.values()) URL.revokeObjectURL(url);
  objectUrlCache.clear();
}
