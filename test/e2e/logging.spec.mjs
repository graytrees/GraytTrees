import { test, expect } from '@playwright/test';
import { start, fillLog, tabbar, home, db, rec, errors, PHOTO, more } from './helpers.mjs';

test('log work from the home screen: pick trees, un-pick one, save', async ({ page }) => {
  const errs = errors(page); await start(page);
  await page.locator('.tabbar [data-log]').click();
  const sheet = page.locator('.sheet.log');
  await sheet.locator('.tree-picker [data-lgt]', { hasText: 'Test Black Pine' }).click();
  await sheet.locator('.tree-picker [data-lgt]', { hasText: 'Test Elm' }).click();
  await sheet.locator('.tree-picker [data-lgt]', { hasText: 'Test Fig' }).click();
  await expect(sheet.locator('.tree-picker [aria-pressed="true"]')).toHaveCount(3);
  await sheet.locator('.tree-picker [data-lgt]', { hasText: 'Test Fig' }).click();          // un-pick
  await expect(sheet.locator('.tree-picker [aria-pressed="true"]')).toHaveCount(2);
  await fillLog(page, { jobs: ['Light prune'], note: 'Tidy up after spring growth' });
  await expect(sheet).toBeHidden();
  const logs = (await db(page, 'logs')).filter(l => l.text?.includes('Tidy up'));
  expect(logs.map(l => l.trees[0]).sort()).toEqual(['t-elm', 't-pine']);                      // one entry per tree, not the fig
  await expect(page.locator('#main')).toContainText('Tidy up after spring growth');
  expect(errs).toEqual([]);
});

test('log work with a photo: the photo is attached to the entry and the tree, and sent to Drive', async ({ page }) => {
  await start(page);
  await page.locator('#main [data-tree="t-fig"]').first().click();
  await page.locator('#main [data-log="t-fig"]').first().click();
  await fillLog(page, { jobs: ['Defoliated'], photo: PHOTO });
  await expect(page.locator('.sheet.log')).toBeHidden();
  const tree = await rec(page, 'trees', 't-fig');
  expect(tree.photos).toHaveLength(1);
  const photo = await rec(page, 'photos', tree.photos[0]);
  expect(photo.thumb).toMatch(/^data:image\/jpeg/);
  expect(photo.driveId).toBeTruthy(); expect(photo.waiting).toBe(false);
  const entry = (await db(page, 'logs')).find(l => l.actions.includes('defol'));
  expect(entry.photos).toEqual(tree.photos);
});

test('edit an entry (earlier version kept), delete it, restore it from the Recycle bin', async ({ page }) => {
  await start(page);
  await page.locator('#main [data-tree="t-elm"]').first().click();
  await page.locator('[data-tab="history"]').click();
  await page.locator('[data-editentry="l3"]').click();
  await page.locator('.sheet textarea').first().fill('Light prune\nEdited note');
  await page.locator('[data-fsave]').click();
  await expect(page.locator('.sheet')).toBeHidden();
  let l = await rec(page, 'logs', 'l3');
  expect(l.text).toContain('Edited note'); expect(l.revisions).toHaveLength(1); expect(l.revisions[0].text).toBe('Light prune');
  await page.locator('[data-editentry="l3"]').click();
  await page.locator('[data-delentry="l3"]').click();
  await expect(page.locator('#main')).not.toContainText('Edited note');
  expect((await rec(page, 'logs', 'l3')).deleted).toBe(true);                                // hidden, not destroyed
  await more(page, 'recycle');
  await page.locator('[data-restore="l3"]').click();
  await expect.poll(async () => (await rec(page, 'logs', 'l3')).deleted).toBe(false);
});

test('seasonal card is a reminder list with nothing to tick, and wiring is not on it', async ({ page }) => {
  await start(page);
  const card = page.locator('.home-card.jobs');
  await expect(card).toContainText('Could do this month');
  await expect(card.locator('input[type=checkbox], [data-tick]')).toHaveCount(0);
  await expect(card).not.toContainText(/\bWire\b/);
});
