import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthlyJobs, wireCheckList, wireStatus, makeJobs } from '../../src/jobs.js';

const trees = [
  { id: 'fig', name: 'Beaver Fig', group: 'fig' }, { id: 'pine', name: 'Black Pine #1', group: 'pine', every: [3, 5] },
  { id: 'elm', name: 'Birthday Elm', group: 'elm' }, { id: 'gone', name: 'Old Maple', group: 'other', status: 'past' },
];
const log = (tree, date, ...actions) => ({ id: tree + date + actions, trees: [tree], date, actions });
const data = logs => ({ trees, logs, meta: [] });

test('wire: tropicals wired in the warm months are checked after 8 weeks, everything else after 3 months', () => {
  const list = wireCheckList(data([log('fig', '2026-11-01', 'wire'), log('pine', '2026-11-01', 'wire'), log('elm', '2026-07-01', 'wire')]));
  assert.deepEqual(list.map(w => [w.tree, w.due, w.every]), [
    ['Birthday Elm', '2026-10-01', '3 months'], ['Beaver Fig', '2026-12-27', '8 weeks'], ['Black Pine #1', '2027-02-01', '3 months']]);
});

test('wire: "Wire checked" restarts the clock, "Wire removed" ends it, old history is ignored', () => {
  const list = wireCheckList(data([
    log('pine', '2026-08-01', 'wire'), log('pine', '2026-11-05', 'wirechk'),
    log('elm', '2026-08-01', 'wire'), log('elm', '2026-10-01', 'unwire'),
    log('fig', '2012-07-01', 'wire')]));
  assert.deepEqual(list.map(w => [w.tree, w.due, w.basis]), [['Black Pine #1', '2027-02-05', 'last checked 5 Nov']]);
});

test('wire: month-end dates do not skip a month', () => {
  const w = wireStatus({ id: 'x', group: 'pine' }, () => ({ date: '2026-11-30', actions: ['wire'] }));
  assert.equal(w.due.getMonth() + 1, 2); assert.equal(w.due.getDate(), 28);
});

test('repots: never scheduled outside the Brisbane window for the species', () => {
  const j = makeJobs({ trees, lastOf: (id, kinds) => kinds.includes('repot') && id === 'fig' ? { date: '2025-01-15' } : null, today: new Date(2026, 10, 11) });
  const [y, m] = j.repotMonth(trees[0]);
  assert.ok([10, 11, 12].includes(m), `fig repot fell in month ${m}`);
  assert.notEqual(m, 1, 'never January');
  assert.equal(y, 2027);
});

test('monthly list: wire checks appear in the month they fall due; wiring is not a seasonal job; past trees are left out', () => {
  const d = data([log('fig', '2026-11-01', 'wire'), log('gone', '2026-11-01', 'wire')]);
  const dec = monthlyJobs(d, 2026, 12), nov = monthlyJobs(d, 2026, 11);
  assert.ok(dec.items.some(i => i.startsWith('Check wire: Beaver Fig')));
  assert.ok(!nov.items.some(i => i.startsWith('Check wire')));
  for (const m of [nov, dec]) assert.ok(!m.items.some(i => /^Wire:/.test(i)), 'no "Wire: …" seasonal items');
  assert.ok(!dec.items.join(' ').includes('Old Maple'));
  assert.equal(dec.due, '2026-12-31');
});

test('repots: overdue only once a whole window has been missed, never while the window is open', async () => {
  const { repotMissed, repotFirstDue } = await import('../../src/jobs.js');
  const pine = { id: 'p', group: 'pine' }, fig = { id: 'f', group: 'fig' };
  assert.deepEqual(repotFirstDue(pine, '2022-08-07'), [2025, 8]);
  assert.equal(repotMissed(pine, '2022-08-07', new Date(2026, 10, 11)), true, 'pine due Aug 2025, now Nov 2026');
  assert.equal(repotMissed(pine, '2022-08-07', new Date(2026, 6, 20)), false, 'window open: due now, not "overdue"');
  assert.equal(repotMissed(pine, '2024-07-14', new Date(2026, 10, 11)), false, 'not due until Jul 2027');
  // a fig repotted in August (old habit) falls due in its own window, October: waiting for October is not overdue
  assert.deepEqual(repotFirstDue(fig, '2025-08-09'), [2027, 10]);
  assert.equal(repotMissed(fig, '2025-08-09', new Date(2027, 8, 15)), false);
  assert.equal(repotMissed(fig, '2025-08-09', new Date(2028, 1, 1)), true);
  assert.equal(repotMissed({ id: 'o', group: 'other' }, '2020-01-01', new Date(2026, 10, 11)), false, 'no window, no verdict');
});
