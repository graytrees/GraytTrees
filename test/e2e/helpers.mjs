import { expect } from '@playwright/test';
import { fileURLToPath } from 'url';
export const SAMPLE = fileURLToPath(new URL('../fixtures/sample.json', import.meta.url));
// a real (tiny) picture, so the app's resizing and small-copy code runs for real
export const PHOTO = { name: '2026-11-01 test tree.png', mimeType: 'image/png',
  buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFklEQVR4nGNkaPjPgA0wYRUdtBIAO4QBkAyy1NIAAAAASUVORK5CYII=', 'base64') };

export const errors = page => { const list = []; page.on('pageerror', e => list.push(String(e))); return list; };
export const tabbar = (page, name) => page.locator(`.tabbar [data-nav="${name}"]`);
export const more = async (page, name) => { await tabbar(page, 'more').click(); await page.locator(`#main [data-nav="${name}"]`).first().click(); };
export const home = page => tabbar(page, 'trees').click();
export const db = (page, col) => page.evaluate(c => Object.entries(window.__mockdb).filter(([k]) => k.split('/')[2] === c).map(([, v]) => v), col);
export const rec = (page, col, id) => page.evaluate(([c, i]) => window.__mockdb[`users/u1/${c}/${i}`], [col, id]);

/** Opens the app and loads the sample collection through the real Import screen. */
export async function start(page) {
  await page.goto('/');
  await expect(tabbar(page, 'trees')).toBeVisible();
  await runImport(page);
  await home(page);
  await expect(page.locator('#main')).toContainText('Test Black Pine');
}
export async function runImport(page) {
  await more(page, 'settings');
  await page.locator('#main [data-nav="import"]').click();
  await page.setInputFiles('#impJson', SAMPLE);
  await page.click('[data-runimport]');
  await expect(page.locator('#impStatus')).toContainText('Done', { timeout: 20000 });
  return page.locator('#impStatus').innerText();
}
/** Fills in the Log work sheet (already open) and saves. */
export async function fillLog(page, { trees = [], jobs = [], note, date, photo } = {}) {
  const sheet = page.locator('.sheet.log');
  await expect(sheet).toBeVisible();
  for (const t of trees) await sheet.locator('.tree-picker [data-lgt]', { hasText: t }).click();
  for (const j of jobs) await sheet.locator('[data-lga]', { hasText: new RegExp('^\\s*' + j + '\\s*$') }).click();
  if (date) { await sheet.locator('#lgdate').fill(date); }
  if (note) await sheet.locator('#lgnote').fill(note);
  if (photo) await sheet.locator('#lgfiles').setInputFiles(photo);
  await sheet.locator('[data-lgsave]').click();
}
export const daysAgo = n => { const d = new Date(Date.now() - n * 864e5); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
