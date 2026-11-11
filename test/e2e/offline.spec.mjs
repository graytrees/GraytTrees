import { test, expect } from '@playwright/test';
import { start, fillLog, home, db, rec, errors, PHOTO, more } from './helpers.mjs';

// The stand-in database behaves like the real one with no signal: a save is kept on the device and shown at
// once, but its "done" signal doesn't arrive until the phone is back in range.
async function goOffline(page, context) { await context.setOffline(true); await page.evaluate(() => { window.__offline = true; window.__tok = false; }); }
async function goOnline(page, context) { await context.setOffline(false); await page.evaluate(() => window.__goOnline()); }

test('no signal: logging work with two photos saves straight away and nothing is lost', async ({ page, context }) => {
  const errs = errors(page); await start(page);
  await goOffline(page, context);
  await page.locator('#main [data-tree="t-pine"]').first().click();
  await page.locator('#main [data-log="t-pine"]').first().click();
  await fillLog(page, { jobs: ['Decandled'], note: 'Done in the shed, no signal', photo: [PHOTO, { ...PHOTO, name: 'second.png' }] });
  await expect(page.locator('.sheet.log')).toBeHidden({ timeout: 8000 });                   // used to sit on "Saving…"
  await expect(page.locator('#main')).toContainText('Done in the shed, no signal');
  const entry = (await db(page, 'logs')).find(l => l.text?.includes('no signal'));
  expect(entry.photos).toHaveLength(2);
  expect((await rec(page, 'trees', 't-pine')).photos).toEqual(entry.photos);
  for (const id of entry.photos) { const p = await rec(page, 'photos', id); expect(p.thumb).toBeTruthy(); expect(p.waiting).toBe(true); }
  // back in range and Drive reconnected: the waiting photos upload by themselves
  await goOnline(page, context);
  await page.evaluate(() => { window.__tok = true; window.dispatchEvent(new Event('online')); });
  await expect.poll(async () => (await db(page, 'photos')).filter(p => p.waiting).length, { timeout: 15000 }).toBe(0);
  expect((await db(page, 'photos')).every(p => p.driveId)).toBe(true);
  expect(errs).toEqual([]);
});

test('no signal: adding photos to a tree, editing a tree and deleting an entry all complete', async ({ page, context }) => {
  await start(page);
  await goOffline(page, context);
  await page.locator('#main [data-tree="t-elm"]').first().click();
  await page.locator('[data-tab="photos"]').click();
  await page.locator('[data-addphoto="t-elm"]').setInputFiles([PHOTO, { ...PHOTO, name: 'b.png' }, { ...PHOTO, name: 'c.png' }]);
  await expect.poll(async () => (await rec(page, 'trees', 't-elm')).photos.length, { timeout: 8000 }).toBe(3);   // used to stop after the first
  await page.locator('[data-edittree="t-elm"]').first().click();
  await page.locator('.sheet #f_name').fill('Test Elm (renamed offline)');
  await page.locator('[data-fsave]').click();
  await expect(page.locator('.sheet')).toBeHidden({ timeout: 5000 });                       // used to stay open with Save greyed out
  await expect(page.locator('#main')).toContainText('Test Elm (renamed offline)');
  await page.locator('[data-tab="history"]').click();
  await page.locator('[data-editentry="l3"]').click();
  await page.locator('[data-delentry="l3"]').click();
  await expect(page.locator('.sheet')).toBeHidden({ timeout: 5000 });
  expect((await rec(page, 'logs', 'l3')).deleted).toBe(true);
});

test('a save the server refuses is shown and noted under Settings', async ({ page }) => {
  await start(page);
  await page.evaluate(() => { window.__refuse = 1900; });                                    // refusal arrives after the app has moved on
  await page.locator('.tabbar [data-log]').click();
  await fillLog(page, { trees: ['Test Fig'], jobs: ['Fertilised'] });
  await expect(page.locator('.toast', { hasText: 'could not be saved' }).first()).toBeVisible({ timeout: 8000 });
  await page.evaluate(() => { window.__refuse = false; });
  await more(page, 'settings');
  await page.locator('.problems summary').click();
  await expect(page.locator('.problems')).toContainText('refused by the server');
});
