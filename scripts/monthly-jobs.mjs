// Builds the monthly "Bonsai jobs – <Month>" checklist from a GraytTrees backup file,
// using exactly the same rules as the app (src/jobs.js → monthlyJobs).
// The app now also saves these lists after each weekly backup (graytrees-jobs-YYYY-MM-DD.json in
// Drive › GraytTrees › Backups), which is what the scheduled TickTick task reads; this script is
// kept for checking by hand.
// Usage: node scripts/monthly-jobs.mjs <graytrees-backup.json> [YYYY-MM]
// Prints JSON: { title, due, items[], notes[] }
import { readFileSync } from 'node:fs';
import { monthlyJobs } from '../src/jobs.js';

const [file, ym] = process.argv.slice(2);
if (!file) { console.error('Usage: node scripts/monthly-jobs.mjs <backup.json> [YYYY-MM]'); process.exit(1); }
const data = JSON.parse(readFileSync(file, 'utf8'));
const bne = new Date(Date.now() + 10 * 3600e3);   // Brisbane date (UTC+10, no daylight saving)
const [y, m] = ym ? ym.split('-').map(Number) : [bne.getUTCFullYear(), bne.getUTCMonth() + 1];
console.log(JSON.stringify(monthlyJobs(data, y, m), null, 1));
