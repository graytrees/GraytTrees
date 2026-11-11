// Restore from a weekly backup (the graytrees-backup-YYYY-MM-DD.json files in Drive › GraytTrees › Backups).
//   'missing' – adds back any record that is in the backup but not in the app. Nothing already here is touched.
//   'replace' – puts every record in the backup back exactly as it was then. Records made after the backup stay.
// Backups don't hold the small copies of photos (they'd make every backup huge), so those are rebuilt from the
// full-size photos in Drive afterwards.
import { bulkWrite, savePhoto, state, has } from './store.js';
import { COLS } from './cols.js';
import { planRestore, planCount } from './restorePlan.js';
export { readBackup, planRestore, planCount } from './restorePlan.js';
import { fileBlob } from './drive.js';
import { makeThumb } from './photos.js';

/** Photos with a full-size copy in Drive but no small copy on record (as after a restore). */
export const thumbless = () => Object.values(state.photos).filter(p => p.driveId && !p.thumb && !p.url);

/** Rebuilds small copies from the full-size photos in Drive. Returns {done, failed}. */
export async function rebuildThumbs(list, progress) {
  let done = 0, failed = 0;
  for (const p of list) {
    try { await savePhoto({ id: p.id, thumb: await makeThumb(await fileBlob(p.driveId)) }); done++; }
    catch (e) { failed++; console.warn('small copy', p.id, e); }
    progress?.('Rebuilding small copies of photos', done + failed, list.length);
  }
  return { done, failed };
}

export async function restoreBackup(data, mode, progress) {
  const plan = planRestore(data, mode, has);
  const counts = {};
  for (const name of COLS) {
    const list = plan[name]; counts[name] = list.length; if (!list.length) continue;
    progress?.('Restoring ' + name, 0, list.length);
    // photos are merged so a small copy already in the app is kept; everything else goes back exactly as it was
    await bulkWrite(name, list, (a, b) => progress?.('Restoring ' + name, a, b), { merge: name === 'photos', mark: 'restoredMs' });
  }
  const ids = new Set(plan.photos.map(p => p.id));
  await new Promise(r => setTimeout(r, 300));   // let the app's own picture of the photos catch up
  const need = thumbless().filter(p => ids.has(p.id));
  const thumbs = need.length ? await rebuildThumbs(need, progress) : { done: 0, failed: 0 };
  return { counts, total: planCount(plan), thumbs };
}
