// In-memory stand-in for Firestore, for UI testing only.
const db = {}; const subs = [];
const key = p => p.join('/');
const colOf = p => p.slice(0, -1).join('/');
export const initializeFirestore = () => ({});
export const persistentLocalCache = () => ({}); export const persistentMultipleTabManager = () => ({});
export const collection = (_db, ...p) => ({ p });
export const doc = (_db, ...p) => ({ p });
export const serverTimestamp = () => ({ __ts: Date.now() });
export const arrayUnion = (...v) => ({ __union: v });
function apply(cur, data) {
  const out = { ...(cur || {}) };
  for (const [k, v] of Object.entries(data)) out[k] = v && v.__union ? [...(out[k] || []), ...v.__union] : v;
  return out;
}
function notify(c) { subs.filter(s => s.c === c).forEach(s => s.cb(snap(c))); }
function snap(c) { const docs = Object.entries(db).filter(([k]) => colOf(k.split('/')) === c).map(([k, v]) => ({ id: k.split('/').pop(), data: () => v })); return { docs, metadata: { hasPendingWrites: false, fromCache: false } }; }
export function onSnapshot(ref, opts, cb) { if (typeof opts === 'function') cb = opts; const c = key(ref.p); subs.push({ c, cb }); setTimeout(() => cb(snap(c)), 0); return () => {}; }
export async function setDoc(ref, data, o) { const k = key(ref.p); db[k] = o?.merge ? apply(db[k], data) : apply({}, data); notify(colOf(ref.p)); }
export async function updateDoc(ref, data) { const k = key(ref.p); if (!db[k]) throw new Error('no doc ' + k); db[k] = apply(db[k], data); notify(colOf(ref.p)); }
export const writeBatch = () => { const ops = []; return { set: (r, d) => ops.push([r, d]), commit: async () => { for (const [r, d] of ops) await setDoc(r, d); } }; };
export async function getDocs(ref) { return snap(key(ref.p)); }
window.__mockdb = db;
