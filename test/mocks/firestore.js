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
// window.__refuse = true (or a delay in ms) makes the server refuse saves.
// window.__offline = true behaves like the real database with no signal: the change is kept and shown at once,
// but the "done" promise stays pending until window.__goOnline(). window.__refuse makes the server refuse saves.
const held = [];
const done = () => window.__refuse ? new Promise((_, rej) => setTimeout(() => rej(new Error('refused by the server')), window.__refuse === true ? 50 : window.__refuse))
  : window.__offline ? new Promise(r => held.push(r)) : Promise.resolve();
window.__goOnline = () => { window.__offline = false; held.splice(0).forEach(r => r()); };
function put(ref, data, o) { const k = key(ref.p); db[k] = o?.merge ? apply(db[k], data) : apply({}, data); notify(colOf(ref.p)); }
export function setDoc(ref, data, o) { put(ref, data, o); return done(); }
export function updateDoc(ref, data) { const k = key(ref.p); if (!db[k]) return Promise.reject(new Error('no doc ' + k)); db[k] = apply(db[k], data); notify(colOf(ref.p)); return done(); }
export const writeBatch = () => { const ops = []; return { set: (r, d, o) => ops.push([r, d, o]), commit: () => { for (const [r, d, o] of ops) put(r, d, o); return done(); } }; };
export async function getDocs(ref) { return snap(key(ref.p)); }
window.__mockdb = db;
// test helper: a record vanishes (as if lost or deleted outside the app)
window.__remove = path => { delete db[path]; notify(path.split('/').slice(0, -1).join('/')); };
