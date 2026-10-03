// One-time import of the merged records (Bonsai Album + Care App + 2003–2010 sheet).
// Safe to run again: everything has a fixed id, so a second run just tops up what's missing.
import JSZip from 'jszip';
import { bulkWrite, savePhoto, state } from './store.js';
import { upload } from './drive.js';
import { makeThumb } from './photos.js';

export async function runImport(jsonFile, zipFiles, progress) {
  const data = JSON.parse(await jsonFile.text());
  const say = (msg, a, b) => progress?.(msg, a, b);

  say('Saving trees, pots and mixes…');
  await bulkWrite('trees', data.trees);
  await bulkWrite('pots', data.pots || []);
  await bulkWrite('mixes', data.mixes || []);
  if (data.meta) await bulkWrite('meta', data.meta);
  say('Saving history…');
  await bulkWrite('logs', data.logs, (a, b) => say('Saving history…', a, b));

  // Photos from the zip → thumbnail with the records + full size to Drive
  const zips = [];
  for (const z of [].concat(zipFiles || [])) zips.push(await JSZip.loadAsync(z));
  const inZip = name => zips.map(z => z.file(name)).find(Boolean);
  const list = data.photos || [];
  let done = 0, failed = 0;
  for (const p of list) {
    done++;
    if (state.photos[p.id]?.driveId || state.photos[p.id]?.url && !p.file) { say('Photos', done, list.length); continue; }
    try {
      let blob = null;
      if (p.file && inZip(p.file)) blob = await inZip(p.file).async('blob');
      else if (p.url) { try { const ac = new AbortController(); const tm = setTimeout(() => ac.abort(), 8000); const r = await fetch(p.url, { mode: 'cors', signal: ac.signal }); clearTimeout(tm); if (r.ok) blob = await r.blob(); } catch (e) { /* keep as link */ } }
      if (blob) {
        const thumb = await makeThumb(blob);
        const driveId = await upload(blob, `${p.date || 'undated'} ${p.id}.jpg`, 'Photos', done === 1);
        await savePhoto({ ...p, thumb, driveId, url: null, file: null });
      } else if (p.url) {
        await savePhoto({ ...p, thumb: null, file: null }); // shown straight from the Care App link
      }
    } catch (e) { failed++; console.warn('photo', p.id, e); }
    say('Photos', done, list.length);
  }
  return { trees: data.trees.length, logs: data.logs.length, photos: list.length - failed, failed };
}
