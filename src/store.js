// All records live in Firestore under users/{uid}/…  (one owner, one tree of data)
//   trees, logs, photos, pots, mixes   – one document each
//   meta/settings                      – jobs, shortcuts, preferences
// History is never silently lost: edits keep the previous version in `revisions`,
// deletes only set `deleted: true` (restorable from the Recycle bin).
import {
  collection, doc, onSnapshot, writeBatch, setDoc, updateDoc, arrayUnion, serverTimestamp, getDocs,
} from 'firebase/firestore';
import { db } from './firebase.js';

export const COLS = ['trees', 'logs', 'photos', 'pots', 'mixes', 'meta'];
export const state = { trees: [], logs: [], photos: {}, pots: [], mixes: [], meta: {}, ready: {}, pending: false };

let uid = null;
const unsubs = [];
const listeners = new Set();
export const onChange = fn => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = () => listeners.forEach(fn => fn(state));

export const newId = (p = '') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const col = name => collection(db, 'users', uid, name);
const ref = (name, id) => doc(db, 'users', uid, name, id);

export function start(userId) {
  stop();
  uid = userId;
  for (const name of COLS) {
    unsubs.push(onSnapshot(col(name), { includeMetadataChanges: true }, snap => {
      const docs = snap.docs.map(d => ({ ...d.data(), id: d.id }));
      if (name === 'photos') state.photos = Object.fromEntries(docs.map(d => [d.id, d]));
      else if (name === 'meta') state.meta = Object.fromEntries(docs.map(d => [d.id, d]));
      else if (name === 'logs') state.logs = docs.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdMs || 0) - (a.createdMs || 0));
      else state[name] = docs;
      state.ready[name] = true;
      state.pending = snap.metadata.hasPendingWrites;
      state.fromCache = snap.metadata.fromCache;
      emit();
    }, err => { console.error(name, err); state.error = err.message; emit(); }));
  }
}
export function stop() { unsubs.splice(0).forEach(u => u()); }
export const isEmpty = () => state.ready.trees && state.trees.length === 0;

const stamp = () => ({ updatedAt: serverTimestamp() });

/* ---------- logs ---------- */
export async function addLogs(entries) {
  const b = writeBatch(db);
  for (const e of entries) {
    const id = e.id || newId('L');
    b.set(ref('logs', id), { ...e, id, createdMs: Date.now(), createdAt: serverTimestamp(), ...stamp() });
  }
  await b.commit();
}
export async function editLog(id, changes) {
  const cur = state.logs.find(l => l.id === id);
  const prev = cur ? { date: cur.date, actions: cur.actions, text: cur.text, trees: cur.trees, photos: cur.photos || [], at: Date.now() } : null;
  await updateDoc(ref('logs', id), { ...changes, ...(prev ? { revisions: arrayUnion(prev) } : {}), ...stamp() });
}
export const deleteLog = id => updateDoc(ref('logs', id), { deleted: true, deletedMs: Date.now(), ...stamp() });
export const restoreLog = id => updateDoc(ref('logs', id), { deleted: false, ...stamp() });
export const setLogFlags = (id, flags) => updateDoc(ref('logs', id), { flags, ...stamp() });

/* ---------- trees, pots, mixes ---------- */
export async function saveRecord(name, rec) {
  const id = rec.id || newId(name[0]);
  const cur = (state[name] || []).find(x => x.id === id);
  const { revisions, ...plain } = cur || {};
  const data = { ...rec, id, ...stamp() };
  if (cur) data.revisions = arrayUnion({ ...plain, updatedAt: null, at: Date.now() });
  await setDoc(ref(name, id), data, { merge: true });
  return id;
}

/* ---------- photos ---------- */
export const savePhoto = p => setDoc(ref('photos', p.id), { ...p, ...stamp() }, { merge: true });

/* ---------- settings ---------- */
export const saveMeta = (id, data) => setDoc(ref('meta', id), { ...data, ...stamp() }, { merge: true });

/* ---------- bulk import (first-time load) ---------- */
export async function bulkWrite(name, records, onProgress) {
  for (let i = 0; i < records.length; i += 400) {
    const b = writeBatch(db);
    for (const r of records.slice(i, i + 400)) b.set(ref(name, r.id), { ...r, importedMs: Date.now() });
    await b.commit();
    onProgress?.(Math.min(i + 400, records.length), records.length);
  }
}

/* ---------- full export (backups) ---------- */
export async function exportAll() {
  const out = { exported: new Date().toISOString(), app: 'Graytrees Bonsai', version: 1 };
  for (const name of COLS) {
    const snap = await getDocs(col(name));
    out[name] = snap.docs.map(d => {
      const x = { ...d.data(), id: d.id };
      for (const k of Object.keys(x)) if (x[k] && typeof x[k].toDate === 'function') x[k] = x[k].toDate().toISOString();
      if (name === 'photos') delete x.thumb; // photos themselves are already in Drive
      return x;
    });
  }
  return out;
}

/* tree photo order (newest first); no revision kept for reordering */
export const setTreePhotos = (id, photos) => updateDoc(ref('trees', id), { photos: [...new Set(photos)], ...stamp() });
