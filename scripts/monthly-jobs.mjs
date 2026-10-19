// Builds the monthly "Bonsai jobs – <Month>" checklist from a GraytTrees backup file,
// using exactly the same rules as the app (src/jobs.js).
// Usage: node scripts/monthly-jobs.mjs <graytrees-backup.json> [YYYY-MM]
// Prints JSON: { title, due, items[], notes[] }
import { readFileSync } from 'node:fs';
import { makeJobs } from '../src/jobs.js';

const [file, ym] = process.argv.slice(2);
if (!file) { console.error('Usage: node scripts/monthly-jobs.mjs <backup.json> [YYYY-MM]'); process.exit(1); }
const data = JSON.parse(readFileSync(file, 'utf8'));

// Brisbane date (UTC+10, no daylight saving)
const bne = new Date(Date.now() + 10 * 3600e3);
const [y, m] = ym ? ym.split('-').map(Number) : [bne.getUTCFullYear(), bne.getUTCMonth() + 1];
const today = new Date(y, m - 1, 1);

// custom job names map to a kind (e.g. a renamed "Repot" job)
const settings = (data.meta || []).find(x => x.id === 'settings');
const kindOf = a => (settings?.jobs || []).find(j => j.id === a)?.kind || a;
const logs = (data.logs || []).filter(l => !l.deleted)
  .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
const lastOf = (id, kinds) => logs.find(l => (l.trees || []).includes(id)
  && !(l.flags || []).includes('tick') && (l.actions || []).some(a => kinds.includes(kindOf(a))));

const out = makeJobs({ trees: data.trees || [], lastOf, today }).month(y, m);
const last = new Date(y, m, 0).getDate();
console.log(JSON.stringify({
  title: out.title,
  due: `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`,
  items: out.items,
  notes: out.notes,
}, null, 1));
