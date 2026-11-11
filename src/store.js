// All records live in Firestore under users/{uid}/…  (one owner, one tree of data)
//   trees, logs, photos, pots, mixes, books, tools – one document each
//   meta/settings                      – jobs, shortcuts, preferences
// History is never silently lost: edits keep the previous version in `revisions`,
// deletes only set `deleted: true` (restorable from the Recycle bin).
import {
  collection, doc, onSnapshot, writeBatch, setDoc, updateDoc, arrayUnion, serverTimestamp, getDocs,
} from 'firebase/firestore';
import { db } from './firebase.js';
import { nextRevisions } from './revisions.js';

/* Saving without signal. Every save is kept on the device straight away and sent when the phone is back in
 * range, but the database's "done" signal only arrives once the server has it. Waiting for that signal would
 * freeze the app in the garden, so saves wait only briefly (to catch a refusal while online) and then carry on.
 * A save the server later refuses is reported through onSaveError. */
let saveError = () => {};
export const onSaveError = fn => { saveError = fn; };
const WAIT_MS = 1500;
function send(p, what) {
  let late = !navigator.onLine;
  const guarded = p.catch(err => { if (late) saveError(err, what); else throw err; });
  if (late) return Promise.resolve();
  return Promise.race([guarded, new Promise(r => setTimeout(() => { late = true; r(); }, WAIT_MS))]);
}

import { COLS } from './cols.js';
export { COLS };
export const state = { trees: [], logs: [], photos: {}, pots: [], mixes: [], books: [], tools: [], meta: {}, ready: {}, pending: false };

let uid = null;
const unsubs = [], pendingBy = {};
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
      // "Syncing…" stays up while any kind of record is still waiting to reach the cloud, not just the last one heard from
      pendingBy[name] = snap.metadata.hasPendingWrites;
      state.pending = Object.values(pendingBy).some(Boolean);
      state.fromCache = snap.metadata.fromCache;
      emit();
    }, err => { console.error(name, err); state.error = err.message; emit(); }));
  }
}
export function stop() { unsubs.splice(0).forEach(u => u()); for (const k of Object.keys(pendingBy)) delete pendingBy[k]; }
export const isEmpty = () => state.ready.trees && state.trees.length === 0;

const stamp = () => ({ updatedAt: serverTimestamp() });

/* ---------- logs ---------- */
export async function addLogs(entries) {
  const b = writeBatch(db);
  for (const e of entries) {
    const id = e.id || newId('L');
    b.set(ref('logs', id), { ...e, id, createdMs: Date.now(), createdAt: serverTimestamp(), ...stamp() });
  }
  await send(b.commit(), 'history entry');
}
export async function editLog(id, changes) {
  const cur = state.logs.find(l => l.id === id);
  const prev = cur ? { date: cur.date, actions: cur.actions, text: cur.text, trees: cur.trees, photos: cur.photos || [], at: Date.now() } : null;
  await send(updateDoc(ref('logs', id), { ...changes, ...(prev ? { revisions: arrayUnion(prev) } : {}), ...stamp() }), 'history entry');
}
export const deleteLog = id => send(updateDoc(ref('logs', id), { deleted: true, deletedMs: Date.now(), ...stamp() }), 'history entry');
export const restoreLog = id => send(updateDoc(ref('logs', id), { deleted: false, ...stamp() }), 'history entry');
export const setLogFlags = (id, flags) => send(updateDoc(ref('logs', id), { flags, ...stamp() }), 'history entry');

/* ---------- trees, pots, mixes ---------- */
// Edit history rules (what is kept, and how it is capped) are in revisions.js.
export async function saveRecord(name, rec) {
  const id = rec.id || newId(name[0]);
  const cur = (state[name] || []).find(x => x.id === id);
  const { revisions, ...plain } = cur || {};
  const data = { ...rec, id, ...stamp() };
  if (cur) {
    const next = nextRevisions(revisions || [], { ...plain, updatedAt: null, at: Date.now() });
    data.revisions = next.replace || arrayUnion(next.append);
  }
  await send(setDoc(ref(name, id), data, { merge: true }), name.replace(/s$/, ''));
  return id;
}

/* ---------- photos ---------- */
export const savePhoto = p => send(setDoc(ref('photos', p.id), { ...p, ...stamp() }, { merge: true }), 'photo');

/* ---------- settings ---------- */
export const saveMeta = (id, data) => send(setDoc(ref('meta', id), { ...data, ...stamp() }, { merge: true }), 'setting');

/* ---------- bulk import (first-time load) ---------- */
export async function bulkWrite(name, records, onProgress, { merge = false, mark = 'importedMs' } = {}) {
  for (let i = 0; i < records.length; i += 400) {
    const b = writeBatch(db);
    for (const r of records.slice(i, i + 400)) b.set(ref(name, r.id), { ...r, [mark]: Date.now() }, ...(merge ? [{ merge: true }] : []));
    await b.commit();
    onProgress?.(Math.min(i + 400, records.length), records.length);
  }
}

/** True if a record with this id is already in the app (used so imports and restores never overwrite by accident). */
export const has = (name, id) => name === 'photos' || name === 'meta' ? !!state[name][id] : state[name].some(x => x.id === id);

/* ---------- full export (backups) ---------- */
export async function exportAll() {
  const out = { exported: new Date().toISOString(), app: 'GraytTrees Bonsai', version: 1 };
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
export const setTreePhotos = (id, photos) => send(updateDoc(ref('trees', id), { photos: [...new Set(photos)], ...stamp() }), 'tree photos');
