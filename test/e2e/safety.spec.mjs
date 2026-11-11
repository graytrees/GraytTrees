import { test, expect } from '@playwright/test';
import { start, runImport, fillLog, home, db, rec, errors, PHOTO, more, tabbar, daysAgo } from './helpers.mjs';

const backups = page => page.evaluate(() => window.__backups || {});
async function backupNow(page) {
  await more(page, 'settings');
  await page.locator('[data-backup]').first().click();
  await expect(page.locator('.toast', { hasText: 'Backup saved' }).first()).toBeVisible({ timeout: 15000 });
}
async function openRestore(page, name) {
  await more(page, 'settings');
  await page.locator('#main [data-nav="restore"]').click();
  await page.locator('[data-rslist]').click();
  await page.locator('#rsPick').selectOption(name);
  await expect(page.locator('#rsPlan')).toBeVisible();
}

test('running the import again never overwrites edits made since', async ({ page }) => {
  await start(page);
  await page.locator('#main [data-tree="t-pine"]').first().click();
  await page.locator('[data-edittree="t-pine"]').first().click();
  await page.locator('.sheet #f_name').fill('Black Pine (my edit)');
  await page.locator('[data-fsave]').click();
  await expect(page.locator('.sheet')).toBeHidden();
  await page.locator('#main [data-log="t-pine"]').first().click();
  await fillLog(page, { jobs: ['Wired'], photo: PHOTO });
  await expect(page.locator('.sheet.log')).toBeHidden();
  const before = await rec(page, 'trees', 't-pine');
  const status = await runImport(page);
  expect(status).toMatch(/\b0 trees, 0 history entries/);
  const after = await rec(page, 'trees', 't-pine');
  expect(after.name).toBe('Black Pine (my edit)');
  expect(after.photos).toEqual(before.photos);
  expect(after.revisions).toHaveLength(before.revisions.length);
  expect((await db(page, 'logs')).filter(l => l.trees[0] === 't-pine')).toHaveLength(2);
});

test('restore "add back what\'s missing": lost records and photos come back, edits are left alone', async ({ page }) => {
  const errs = errors(page); await start(page);
  await page.locator('#main [data-tree="t-fig"]').first().click();
  await page.locator('#main [data-log="t-fig"]').first().click();
  await fillLog(page, { jobs: ['Light prune'], note: 'Before the backup', photo: PHOTO });
  await expect(page.locator('.sheet.log')).toBeHidden();
  const photoId = (await rec(page, 'trees', 't-fig')).photos[0];
  await backupNow(page);
  const name = Object.keys(await backups(page)).find(n => n.startsWith('graytrees-backup-'));
  expect(JSON.parse((await backups(page))[name]).photos[0].thumb).toBeUndefined();          // backups don't carry the small copies
  // after the backup: one edit to keep, then a tree, an entry and a photo record go missing
  await home(page); await page.locator('#main [data-tree="t-elm"]').first().click();
  await page.locator('[data-edittree="t-elm"]').first().click();
  await page.locator('.sheet #f_name').fill('Elm edited after backup'); await page.locator('[data-fsave]').click();
  await expect(page.locator('.sheet')).toBeHidden();
  await page.evaluate(id => { for (const p of ['trees/t-jun', 'logs/l1', 'photos/' + id]) window.__remove('users/u1/' + p); }, photoId);
  await openRestore(page, name);
  await expect(page.locator('#rsPlan')).toContainText('1 tree, 1 history entry, 1 photo');
  await page.locator('[data-rsrun]').click();
  await expect(page.locator('#rsStatus')).toContainText('Done: 3 records restored, 1 photo small copy rebuilt', { timeout: 15000 });
  expect((await rec(page, 'trees', 't-jun')).name).toBe('Test Juniper');
  expect((await rec(page, 'logs', 'l1')).actions).toEqual(['repot', 'root']);
  const p = await rec(page, 'photos', photoId);
  expect(p.driveId).toBeTruthy(); expect(p.thumb).toMatch(/^data:image\/jpeg/);             // rebuilt from the full-size copy in Drive
  expect((await rec(page, 'trees', 't-elm')).name).toBe('Elm edited after backup');          // untouched
  await home(page); await expect(page.locator('#main')).toContainText('Test Juniper');
  expect(errs).toEqual([]);
});

test('restore "put everything back": needs RESTORE typed, saves a copy first, undoes changes, keeps newer records', async ({ page }) => {
  await start(page);
  await backupNow(page);
  const name = Object.keys(await backups(page)).find(n => n.startsWith('graytrees-backup-'));
  await home(page); await page.locator('#main [data-tree="t-elm"]').first().click();
  await page.locator('[data-edittree="t-elm"]').first().click();
  await page.locator('.sheet #f_name').fill('Wrongly renamed'); await page.locator('[data-fsave]').click();
  await expect(page.locator('.sheet')).toBeHidden();
  await page.locator('.tabbar [data-log]').click();
  await fillLog(page, { trees: ['Test Fig'], jobs: ['Fertilised'], note: 'Made after the backup' });
  await openRestore(page, name);
  await page.locator('[data-rsmode="replace"]').click();
  await page.locator('[data-rsrun]').click();
  await expect(page.locator('#rsStatus')).toContainText('Type RESTORE');                     // nothing happens without the confirmation
  expect((await rec(page, 'trees', 't-elm')).name).toBe('Wrongly renamed');
  await page.locator('#rsConfirm').fill('restore');
  await page.locator('[data-rsrun]').click();
  await expect(page.locator('#rsStatus')).toContainText('Done:', { timeout: 15000 });
  expect((await rec(page, 'trees', 't-elm')).name).toBe('Test Elm');
  expect((await db(page, 'logs')).some(l => l.text?.includes('Made after the backup'))).toBe(true);
  const safety = Object.entries(await backups(page)).find(([n]) => n.startsWith('graytrees-before-restore-'));
  expect(JSON.parse(safety[1]).trees.find(t => t.id === 't-elm').name).toBe('Wrongly renamed');   // the pre-restore state is recoverable too
});

test('a file that is not a backup is refused', async ({ page }) => {
  await start(page);
  await more(page, 'settings'); await page.locator('#main [data-nav="restore"]').click();
  await page.locator('#rsFile').setInputFiles({ name: 'notes.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') });
  await expect(page.locator('#rsStatus')).toContainText("isn't a GraytTrees backup");
  await expect(page.locator('[data-rsrun]')).toHaveCount(0);
});

test('same-day backups update one file; a backup with fewer records never writes over a fuller one', async ({ page }) => {
  await start(page);
  await backupNow(page); await backupNow(page);
  let names = Object.keys(await backups(page)).filter(n => n.startsWith('graytrees-backup-'));
  expect(names).toHaveLength(1);
  await page.evaluate(() => window.__remove('users/u1/trees/t-jun'));
  await backupNow(page);
  names = Object.keys(await backups(page)).filter(n => n.startsWith('graytrees-backup-'));
  expect(names).toHaveLength(2);
  const full = JSON.parse((await backups(page))[names.sort((a, b) => a.length - b.length)[0]]);
  expect(full.trees.some(t => t.id === 't-jun')).toBe(true);
});

test('wire check: due after 3 months, cleared by "Checked", and its date is saved for the on-the-day reminder', async ({ page }) => {
  await start(page);
  await page.locator('.tabbar [data-log]').click();
  await fillLog(page, { trees: ['Test Black Pine'], jobs: ['Wired'], date: daysAgo(95) });
  await page.locator('.tabbar [data-log]').click();
  await fillLog(page, { trees: ['Test Elm'], jobs: ['Wired'], date: daysAgo(10) });
  await home(page);
  const card = page.locator('.home-card.wirechk');
  await expect(card).toContainText('Test Black Pine'); await expect(card).toContainText('Overdue');
  await expect(card).not.toContainText('Test Elm');                                          // not shown before its due date
  await backupNow(page);
  const jobs = name => backups(page).then(b => JSON.parse(b[Object.keys(b).filter(n => n.startsWith('graytrees-jobs-')).sort().pop()]));
  expect((await jobs()).wireChecks.map(w => w.tree)).toEqual(['Test Black Pine', 'Test Elm']);
  await home(page);
  await card.locator('[data-logkinds="wirechk"]').click();
  await fillLog(page, {});
  await expect(card).toHaveCount(0);
  // the saved dates follow without waiting for the next weekly backup
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(async () => (await jobs()).wireChecks.find(w => w.tree === 'Test Black Pine').basis, { timeout: 10000 }).toMatch(/^last checked/);
});

test('the phone\'s Back gesture goes back a screen, and closes an open pop-up first', async ({ page }) => {
  await start(page);
  await page.locator('#main [data-tree="t-fig"]').first().click();
  await expect(page.locator('#main h1, #main h2').first()).toContainText('Test Fig');
  await page.locator('#main [data-log="t-fig"]').first().click();
  await expect(page.locator('.sheet.log')).toBeVisible();
  await page.goBack();
  await expect(page.locator('.sheet.log')).toBeHidden();
  await expect(page.locator('#main')).toContainText('Test Fig');                             // still on the tree
  await page.goBack();
  await expect(page.locator('#main')).toContainText('Test Black Pine');                      // back to the collection
  await expect(tabbar(page, 'trees')).toHaveAttribute('aria-current', 'page');
});

test('Settings shows the app version', async ({ page }) => {
  await start(page);
  await more(page, 'settings');
  await expect(page.locator('#buildLabel')).toHaveText('test build');
});
