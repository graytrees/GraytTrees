// One-time import of the merged records (Bonsai Album + Care App + 2003–2010 sheet).
// Safe to run again: everything has a fixed id, and a record that is already in the app is left exactly as it
// is (so edits made since the first import are never overwritten); a second run only adds what's missing.
import JSZip from 'jszip';
import { bulkWrite, savePhoto, state, has } from './store.js';
import { upload } from './drive.js';
import { makeThumb } from './photos.js';

export async function runImport(jsonFile, zipFiles, progress) {
  const data = JSON.parse(await jsonFile.text());
  const say = (msg, a, b) => progress?.(msg, a, b);

  const newBooks = (data.books || []).filter(b => !state.books.some(x => x.id === b.id)); // never overwrite books you've since edited
  if (newBooks.length) { say('Saving your library…'); await bulkWrite('books', newBooks, (a, b) => say('Saving your library…', a, b)); }
  const newTools = (data.tools || []).filter(t => !state.tools.some(x => x.id === t.id)); // never overwrite tools you've since edited
  if (newTools.length) { say('Saving your tools…'); await bulkWrite('tools', newTools); }
  say('Saving trees, pots and mixes…');
  const fresh = name => (data[name] || []).filter(r => !has(name, r.id));   // never overwrite what's already here
  const added = {};
  for (const name of ['trees', 'pots', 'mixes', 'meta']) { const list = fresh(name); added[name] = list.length; if (list.length) await bulkWrite(name, list); }
  say('Saving history…');
  const newLogs = fresh('logs'); added.logs = newLogs.length;
  if (newLogs.length) await bulkWrite('logs', newLogs, (a, b) => say('Saving history…', a, b));

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
  return { tools: newTools.length, books: newBooks.length, trees: added.trees, logs: added.logs, photos: list.length - failed, failed };
}
