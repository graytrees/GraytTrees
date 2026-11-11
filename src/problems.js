// A short on-device list of things that went wrong (a save the server refused, a failed upload or backup),
// shown under More › Settings & backups so problems can be seen and reported instead of vanishing.
const KEY = 'gt-problems', MAX = 40;
const listeners = new Set();
export const onProblem = fn => listeners.add(fn);
export function problems() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } }
export function logProblem(what, err) {
  const msg = String(err?.message || err || 'Unknown error').slice(0, 300);
  console.warn(what, err);
  try {
    const list = problems();
    if (list[0] && list[0].what === what && list[0].msg === msg) { list[0].n = (list[0].n || 1) + 1; list[0].at = Date.now(); }
    else list.unshift({ at: Date.now(), what, msg });
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch (e) { /* storage unavailable: the console line above still stands */ }
  listeners.forEach(fn => fn(what, msg));
}
export function clearProblems() { try { localStorage.removeItem(KEY); } catch (e) {} }
