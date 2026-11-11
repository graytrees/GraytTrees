import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readBackup, planRestore, planCount } from '../../src/restorePlan.js';

const backup = { trees: [{ id: 't1', name: 'Pine' }, { id: 't2', name: 'Elm' }], logs: [{ id: 'l1' }, { id: 'l2' }], photos: [{ id: 'p1', driveId: 'd1' }], meta: [{ id: 'settings' }] };
const inApp = { trees: ['t1'], logs: ['l1', 'l2'], photos: [], meta: ['settings'] };
const exists = (name, id) => (inApp[name] || []).includes(id);

test('"add back what\'s missing" never touches a record that is already in the app', () => {
  const plan = planRestore(backup, 'missing', exists);
  assert.deepEqual(plan.trees.map(t => t.id), ['t2']);
  assert.deepEqual(plan.logs, []);
  assert.deepEqual(plan.photos.map(p => p.id), ['p1']);
  assert.deepEqual(plan.meta, []);
  assert.equal(planCount(plan), 2);
});

test('"put everything back" restores every record in the backup', () => {
  assert.equal(planCount(planRestore(backup, 'replace', exists)), 6);
});

test('files that are not GraytTrees backups are refused with a plain reason', () => {
  assert.throws(() => readBackup('not json'), /isn't a backup/);
  assert.throws(() => readBackup('{"months":{}}'), /isn't a GraytTrees backup/);
  assert.equal(readBackup(JSON.stringify(backup)).trees.length, 2);
});
