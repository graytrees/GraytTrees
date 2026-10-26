// Weekly backup: every record exported to your Drive as an ordinary JSON file plus a
// spreadsheet-friendly CSV of the full history. Readable without the app.
// Straight after, the app saves the next months' jobs checklists and refreshes the collection
// Google Doc (docSync.js), so the scheduled Claude tasks only copy results and never run code.
import { exportAll, saveMeta, state } from './store.js';
import { upload, driveConnected, hasDriveToken } from './drive.js';
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
  await upload(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }), `graytrees-backup-${day}.json`, 'Backups', interactive);
  const names = Object.fromEntries(data.trees.map(t => [t.id, t.name]));
  const hist = [['Date', 'Trees', 'Jobs', 'Notes', 'Source', 'Deleted'],
    ...data.logs.map(l => [l.date, (l.trees || []).map(id => names[id] || id), l.actions, l.text, l.sources, l.deleted ? 'yes' : ''])];
  await upload(new Blob([csv(hist)], { type: 'text/csv' }), `graytrees-history-${day}.csv`, 'Backups', interactive);
  await saveMeta('backup', { lastMs: Date.now(), lastDay: day, trees: data.trees.length, logs: data.logs.length });
  // extras: a failure here never undoes the backup itself; it's shown in Settings & backups
  try { await saveJobsFile(data, day, interactive); await saveMeta('jobsFile', { lastDay: day, error: '' }); }
  catch (e) { console.warn('jobs file', e); await saveMeta('jobsFile', { error: String(e.message || e), errorMs: Date.now() }).catch(() => {}); }
  try { const r = await refreshCollectionDoc(data, day); lastDoc = r.skipped ? 'not linked' : 'updated'; }
  catch (e) { console.warn('collection Doc', e); lastDoc = 'not updated: ' + (e.message || e); }
  return day;
}

export const backupDue = () => Date.now() - (state.meta.backup?.lastMs || 0) >= WEEK;

/** Called on app start: back up if the last one was over a week ago. */
export async function maybeWeeklyBackup() {
  if (!navigator.onLine || !driveConnected() || !hasDriveToken() || !backupDue()) return null;
  try { return await backupNow(false); } catch (e) { console.warn('backup deferred', e); state.meta.backupError = String(e.message || e); return null; }
}
