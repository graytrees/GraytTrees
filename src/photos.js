// Photos: a small thumbnail is kept with the records (so it shows offline, instantly),
// the full-size copy (max 2000 px) goes to Google Drive. If there's no signal, the full-size
// copy waits on the device and uploads automatically next time the app is online.
import { upload, driveConnected } from './drive.js';
import { savePhoto, newId, state } from './store.js';

function loadImg(blob) {
  return new Promise((res, rej) => { const u = URL.createObjectURL(blob); const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = u; });
}
async function resize(blob, max, q) {
  const img = await loadImg(blob);
  const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const out = await new Promise(r => c.toBlob(r, 'image/jpeg', q));
  return { blob: out, w: img.naturalWidth, h: img.naturalHeight, dataUrl: max <= 600 ? c.toDataURL('image/jpeg', q) : null };
}
export const makeThumb = async blob => (await resize(blob, 420, 0.72)).dataUrl;

/* --- tiny IndexedDB queue for full-size photos waiting to upload --- */
const DB = 'gt-pending';
function idb() { return new Promise((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore('q'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function qPut(id, val) { const d = await idb(); return new Promise(r => { const t = d.transaction('q', 'readwrite'); t.objectStore('q').put(val, id); t.oncomplete = r; }); }
async function qAll() { const d = await idb(); return new Promise(r => { const out = []; const c = d.transaction('q').objectStore('q').openCursor(); c.onsuccess = e => { const cur = e.target.result; if (cur) { out.push([cur.key, cur.value]); cur.continue(); } else r(out); }; }); }
async function qDel(id) { const d = await idb(); return new Promise(r => { const t = d.transaction('q', 'readwrite'); t.objectStore('q').delete(id); t.oncomplete = r; }); }
export async function pendingCount() { try { return (await qAll()).length; } catch (e) { return 0; } }

/** Add photos taken or picked on the device. Returns the new photo ids. */
export async function addPhotos(files, { trees = [], date, origin = 'Graytrees', interactive = true } = {}) {
  const ids = [];
  for (const f of files) {
    const id = newId('p');
    const th = await resize(f, 420, 0.72);
    const full = await resize(f, 2000, 0.85);
    const rec = { id, thumb: th.dataUrl, w: th.w, h: th.h, date: date || (d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'))(new Date()), trees, origin, name: f.name || id + '.jpg' };
    let driveId = null;
    try { if (navigator.onLine) driveId = await upload(full.blob, `${rec.date} ${id}.jpg`, 'Photos', interactive); } catch (e) { console.warn('upload later', e); }
    if (!driveId) await qPut(id, { blob: full.blob, name: `${rec.date} ${id}.jpg` });
    await savePhoto({ ...rec, driveId, waiting: !driveId });
    ids.push(id);
  }
  return ids;
}

/** Retry anything that was saved while offline. */
export async function flushPending() {
  if (!navigator.onLine || !driveConnected()) return 0;
  let n = 0;
  for (const [id, v] of await qAll()) {
    try {
      const driveId = await upload(v.blob, v.name, 'Photos', false);
      await savePhoto({ id, driveId, waiting: false });
      await qDel(id); n++;
    } catch (e) { console.warn('still waiting', id, e); break; }
  }
  return n;
}

export const photoSrc = id => state.photos[id]?.thumb || state.photos[id]?.url || null;
