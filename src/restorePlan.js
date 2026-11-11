// The decision part of a restore, kept free of the database so it can be tested on its own.
import { COLS } from './cols.js';

/** Checks that a file really is a GraytTrees backup; returns the data or throws a plain-English reason. */
export function readBackup(text) {
  let d; try { d = JSON.parse(text); } catch (e) { throw new Error("That file isn't a backup (it couldn't be read as JSON)."); }
  if (!d || !Array.isArray(d.trees) || !Array.isArray(d.logs)) throw new Error("That file isn't a GraytTrees backup (no trees or history in it).");
  return d;
}

/** Works out what a restore would write, without writing anything. `exists(name, id)` says what's in the app now.
 *   'missing' – only records that aren't in the app;  'replace' – every record in the backup. */
export function planRestore(data, mode, exists) {
  const plan = {};
  for (const name of COLS) {
    const recs = (data[name] || []).filter(r => r && r.id);
    plan[name] = mode === 'replace' ? recs : recs.filter(r => !exists(name, r.id));
  }
  return plan;
}
export const planCount = plan => Object.values(plan).reduce((n, l) => n + l.length, 0);
