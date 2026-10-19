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

/* --- when was the photo taken? camera data first, then a date in the file name --- */
async function exifDate(file) {
  try {
    const v = new DataView(await file.slice(0, 256 * 1024).arrayBuffer());
    if (v.getUint16(0) !== 0xFFD8) return null;
    let o = 2;
    while (o < v.byteLength - 4) {
      const mk = v.getUint16(o), len = v.getUint16(o + 2);
      if (mk === 0xFFE1 && v.getUint32(o + 4) === 0x45786966) {
        const t = o + 10, le = v.getUint16(t) === 0x4949;
        const u16 = x => v.getUint16(x, le), u32 = x => v.getUint32(x, le);
        const str = (off, n) => { let r = ''; for (let i = 0; i < n - 1; i++) r += String.fromCharCode(v.getUint8(t + off + i)); return r; };
        const scan = (ifd, want) => { const n = u16(t + ifd); for (let i = 0; i < n; i++) { const e = t + ifd + 2 + i * 12; if (want.includes(u16(e))) return [u16(e), u32(e + 8), u32(e + 4)]; } return null; };
        const sub = scan(u32(t + 4), [0x8769]);
        let hit = sub && scan(sub[1], [0x9003, 0x9004]);
        if (!hit) hit = scan(u32(t + 4), [0x0132]);
        if (!hit) return null;
        const m = str(hit[1], hit[2]).match(/^(\d{4}):(\d{2}):(\d{2})/);
        return m && m[1] > '1900' && m[1] !== '0000' ? `${m[1]}-${m[2]}-${m[3]}` : null;
      }
      if ((mk & 0xFF00) !== 0xFF00) return null;
      o += 2 + len;
    }
  } catch (e) { /* not a JPEG with camera data */ }
  return null;
}
const okYear = y => y >= 1980 && y <= new Date().getFullYear();
export function nameDate(name = '') {
  const n = name.replace(/\.[a-z0-9]+$/i, '');
  let m = n.match(/(?:^|\D)((?:19|20)\d{2})[-_. ]?(0[1-9]|1[0-2])[-_. ]?(0[1-9]|[12]\d|3[01])(?!\d)/);
  if (m && okYear(+m[1])) return `${m[1]}-${m[2]}-${m[3]}`;
  m = n.match(/(?:^|\D)(0[1-9]|[12]\d|3[01])[-_. ](0[1-9]|1[0-2])[-_. ]((?:19|20)\d{2})(?!\d)/);   // 14-05-2009 (Australian order)
  if (m && okYear(+m[3])) return `${m[3]}-${m[2]}-${m[1]}`;
  m = n.match(/(?:^|\D)((?:19|20)\d{2})[-_. ](0[1-9]|1[0-2])(?!\d)/);                               // 2009-05
  if (m && okYear(+m[1])) return `${m[1]}-${m[2]}`;
  m = n.match(/(?:^|\D)((?:19|20)\d{2})(?!\d)/);                                                   // 2009
  if (m && okYear(+m[1])) return m[1];
  return null;
}
export async function photoDate(file) { return (await exifDate(file)) || nameDate(file.name); }

export const makeThumb = async blob => (await resize(blob, 420, 0.72)).dataUrl;

/* --- tiny IndexedDB queue for full-size photos waiting to upload --- */
const DB = 'gt-pending';
function idb() { return new Promise((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore('q'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function qPut(id, val) { const d = await idb(); return new Promise(r => { const t = d.transaction('q', 'readwrite'); t.objectStore('q').put(val, id); t.oncomplete = r; }); }
async function qAll() { const d = await idb(); return new Promise(r => { const out = []; const c = d.transaction('q').objectStore('q').openCursor(); c.onsuccess = e => { const cur = e.target.result; if (cur) { out.push([cur.key, cur.value]); cur.continue(); } else r(out); }; }); }
async function qDel(id) { const d = await idb(); return new Promise(r => { const t = d.transaction('q', 'readwrite'); t.objectStore('q').delete(id); t.oncomplete = r; }); }
export async function localFull(id) { try { const d = await idb(); const v = await new Promise(r => { const g = d.transaction('q').objectStore('q').get(id); g.onsuccess = () => r(g.result); g.onerror = () => r(null); }); return v?.blob ? URL.createObjectURL(v.blob) : null; } catch (e) { return null; } }
export async function pendingCount() { try { return (await qAll()).length; } catch (e) { return 0; } }

/** Add photos taken or picked on the device. Returns the new photo ids. */
export async function addPhotos(files, { trees = [], date, origin = 'Graytrees', interactive = true } = {}) {
  const ids = [];
  for (const f of files) {
    const id = newId('p');
    const th = await resize(f, 420, 0.72);
    const full = origin === 'Library' ? await resize(f, 3200, 0.9) : await resize(f, 2000, 0.85); // book pages need to stay readable
    const taken = date ? null : await photoDate(f);
    const rec = { id, thumb: th.dataUrl, w: th.w, h: th.h, ...(taken ? { taken: true } : {}), date: date || taken || (d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'))(new Date()), trees, origin, name: f.name || id + '.jpg' };
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
