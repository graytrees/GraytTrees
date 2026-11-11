// Weekly backup: every record exported to your Drive as an ordinary JSON file plus a
// spreadsheet-friendly CSV of the full history. Readable without the app.
// Straight after, the app saves the next months' jobs checklists and refreshes the collection
// Google Doc (docSync.js), so the scheduled Claude tasks only copy results and never run code.
import { exportAll, saveMeta, state } from './store.js';
import { upload, driveConnected, hasDriveToken } from './drive.js';
import { logProblem } from './problems.js';
import { saveJobsFile, refreshCollectionDoc } from './docSync.js';

const WEEK = 7 * 864e5;

function csv(rows) {
  const q = v => { const s = Array.isArray(v) ? v.join('; ') : String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  return rows.map(r => r.map(q).join(',')).join('\n');
}

let lastDoc = '';     // what happened to the collection Doc in the latest backup (for the toast)
export const lastDocResult = () => lastDoc;
let running = null;  // one backup at a time: the start-up check and the 'back online' check can fire together
export function backupNow(interactive = false) {
  running ||= doBackup(interactive).finally(() => { running = null; });
  return running;
}
async function doBackup(interactive) {
  const data = await exportAll();
  const day = (d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'))(new Date());
  // A second backup on the same day updates that day's files instead of piling up copies, unless it holds
  // fewer records than the first (then it's kept as a separate file, so a good backup is never written over).
  const prev = state.meta.backup;
  const shrunk = prev?.lastDay === day && (data.trees.length < (prev.trees || 0) || data.logs.length < (prev.logs || 0));
  const tag = shrunk ? day + '-' + new Date().toTimeString().slice(0, 5).replace(':', '') : day;
  const opt = { replace: !shrunk };
  await upload(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }), `graytrees-backup-${tag}.json`, 'Backups', interactive, opt);
  const names = Object.fromEntries(data.trees.map(t => [t.id, t.name]));
  const hist = [['Date', 'Trees', 'Jobs', 'Notes', 'Source', 'Deleted'],
    ...data.logs.map(l => [l.date, (l.trees || []).map(id => names[id] || id), l.actions, l.text, l.sources, l.deleted ? 'yes' : ''])];
  await upload(new Blob([csv(hist)], { type: 'text/csv' }), `graytrees-history-${tag}.csv`, 'Backups', interactive, opt);
  await saveMeta('backup', { lastMs: Date.now(), lastDay: day, trees: data.trees.length, logs: data.logs.length });
  // extras: a failure here never undoes the backup itself; it's shown in Settings & backups
  try { const wireSig = await saveJobsFile(data, day, interactive); await saveMeta('jobsFile', { lastDay: day, wireSig, error: '' }); }
  catch (e) { logProblem('Monthly jobs file', e); await saveMeta('jobsFile', { error: String(e.message || e), errorMs: Date.now() }).catch(() => {}); }
  try { const r = await refreshCollectionDoc(data, day); lastDoc = r.skipped ? 'not linked' : 'updated'; }
  catch (e) { logProblem('Collection Doc refresh', e); lastDoc = 'not updated: ' + (e.message || e); }
  return day;
}

/** Saves a copy of the records as they are right now, under its own name, before a restore changes them. */
export async function snapshotBeforeRestore() {
  const data = await exportAll(), d = new Date();
  const stamp = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + '-' + d.toTimeString().slice(0, 5).replace(':', '');
  const name = `graytrees-before-restore-${stamp}.json`;
  await upload(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }), name, 'Backups', true);
  return name;
}

export const backupDue = () => Date.now() - (state.meta.backup?.lastMs || 0) >= WEEK;

/** Called on app start: back up if the last one was over a week ago. */
export async function maybeWeeklyBackup() {
  if (!navigator.onLine || !driveConnected() || !hasDriveToken() || !backupDue()) return null;
  try { return await backupNow(false); } catch (e) { logProblem('Weekly backup', e); state.meta.backupError = String(e.message || e); return null; }
}
