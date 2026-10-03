// Weekly backup: every record exported to your Drive as an ordinary JSON file plus a
// spreadsheet-friendly CSV of the full history. Readable without the app.
import { exportAll, saveMeta, state } from './store.js';
import { upload, driveConnected } from './drive.js';

const WEEK = 7 * 864e5;

function csv(rows) {
  const q = v => { const s = Array.isArray(v) ? v.join('; ') : String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  return rows.map(r => r.map(q).join(',')).join('\n');
}

export async function backupNow(interactive = false) {
  const data = await exportAll();
  const day = (d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'))(new Date());
  await upload(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }), `graytrees-backup-${day}.json`, 'Backups', interactive);
  const names = Object.fromEntries(data.trees.map(t => [t.id, t.name]));
  const hist = [['Date', 'Trees', 'Jobs', 'Notes', 'Source', 'Deleted'],
    ...data.logs.map(l => [l.date, (l.trees || []).map(id => names[id] || id), l.actions, l.text, l.sources, l.deleted ? 'yes' : ''])];
  await upload(new Blob([csv(hist)], { type: 'text/csv' }), `graytrees-history-${day}.csv`, 'Backups', interactive);
  await saveMeta('backup', { lastMs: Date.now(), lastDay: day, trees: data.trees.length, logs: data.logs.length });
  return day;
}

/** Called on app start: back up if the last one was over a week ago. */
export async function maybeWeeklyBackup() {
  if (!navigator.onLine || !driveConnected()) return null;
  const last = state.meta.backup?.lastMs || 0;
  if (Date.now() - last < WEEK) return null;
  try { return await backupNow(false); } catch (e) { console.warn('backup deferred', e); return null; }
}
