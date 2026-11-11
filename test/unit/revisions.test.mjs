import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextRevisions, slim, MAX_REVS, MAX_REV_BYTES } from '../../src/revisions.js';

const cover = 'data:image/jpeg;base64,' + 'A'.repeat(29000);
const book = (extra = {}) => ({ id: 'b1', title: 'The Bonsai Handbook', cover, contents: 'x'.repeat(60000), index: 'y'.repeat(50000), photos: ['p1'], ...extra });

test('long text and embedded pictures are not copied into history; short fields are', () => {
  const s = slim(book());
  assert.equal(s.cover, '(picture not kept in history)');
  assert.equal(s.contents, '(long text not kept in history)');
  assert.equal(s.title, 'The Bonsai Handbook');
  assert.deepEqual(s.photos, ['p1']);
});

test('a book with a cover and typed text saved 200 times stays far below the 1 MB record limit', () => {
  let revisions = [];
  for (let i = 0; i < 200; i++) {
    const next = nextRevisions(revisions, { ...book({ photos: Array.from({ length: i }, (_, k) => 'p' + k) }), at: i });
    revisions = next.replace || [...revisions, next.append];
    const record = JSON.stringify({ ...book(), revisions });
    assert.ok(record.length < 600000, `record is ${record.length} bytes after ${i + 1} saves`);
  }
  assert.ok(revisions.length <= MAX_REVS);
  assert.ok(JSON.stringify(revisions).length <= MAX_REV_BYTES);
  assert.equal(revisions.at(-1).at, 199, 'newest version is kept');
});

test('history written before this rule (with pictures in it) is slimmed on the next save', () => {
  const old = Array.from({ length: 14 }, (_, i) => ({ ...book(), at: i }));
  const next = nextRevisions(old, { ...book(), at: 14 });
  assert.ok(next.replace, 'rewrites the history rather than appending');
  assert.equal(next.replace.length, 15);
  assert.ok(JSON.stringify(next.replace).length < 20000);
});

test('small, clean history takes the cheap append path', () => {
  const next = nextRevisions([{ name: 'Black Pine #1', at: 1 }], { name: 'Black Pine No. 1', at: 2 });
  assert.deepEqual(next, { append: { name: 'Black Pine No. 1', at: 2 } });
});
