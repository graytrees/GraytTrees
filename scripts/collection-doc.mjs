// Refreshes the Google Doc "GraytTrees – 2 My collection" from a GraytTrees backup, in two passes
// (text, then styling read back from the Doc, so formatting always lines up with the real text).
// The app now does this itself after each weekly backup (src/docSync.js); this script uses the same
// rules (src/collectionDoc.js) and is kept for checking or repairing the Doc by hand.
//
//   node scripts/collection-doc.mjs content <graytrees-backup-YYYY-MM-DD.json> <doc.json> <out.json>
//   node scripts/collection-doc.mjs style   <graytrees-backup-YYYY-MM-DD.json> <doc.json> <out.json>
//   node scripts/collection-doc.mjs preview <graytrees-backup-YYYY-MM-DD.json>            (plain text to stdout)
//   node scripts/collection-doc.mjs check   <graytrees-backup-YYYY-MM-DD.json> <doc.json>   (prints OK or what's wrong)
//   node scripts/collection-doc.mjs date    <doc.json>          (prints the backup date the Doc was last built from, or 'none')
//
// doc.json = the Doc as returned by the Google Docs API (documents.get / read_doc), bare or as {content: …}.
// out.json = {documentId, writeControl:{requiredRevisionId}, requests:[…]} for documents.batchUpdate.
// The part of the Doc from "Lessons from my own records" up to "Past trees" is never touched; if that
// heading is missing the script stops with an error and writes nothing.
import { readFileSync, writeFileSync } from 'node:fs';
import { buildBlocks, contentRequests, styleRequests, builtFrom, checkDoc } from '../src/collectionDoc.js';

const [mode, bfile, dfile, out] = process.argv.slice(2);
const readDoc = f => { const d = JSON.parse(readFileSync(f, 'utf8')); return d.content || d; };
if (mode === 'date') { console.log(builtFrom(readDoc(bfile))); process.exit(0); }
if (!['content', 'style', 'preview', 'check'].includes(mode) || !bfile || (mode !== 'preview' && !dfile) || (['content', 'style'].includes(mode) && !out)) {
  console.error('Usage: node scripts/collection-doc.mjs content|style <backup.json> <doc.json> <out.json>  |  preview <backup.json>'); process.exit(1);
}
const data = JSON.parse(readFileSync(bfile, 'utf8'));
const backupDay = (bfile.match(/(\d{4}-\d{2}-\d{2})/) || [])[1] || (data.exported || '').slice(0, 10);
const bne = new Date(Date.now() + 10 * 3600e3);
const today = new Date(bne.getUTCFullYear(), bne.getUTCMonth(), bne.getUTCDate());
const blocks = buildBlocks(data, { today, backupDay });
if (mode === 'preview') {
  for (const b of [...blocks.top, { k: 'p', text: '[… Lessons, Soil mix history, Routine kept from the Doc …]' }, ...blocks.past])
    console.log((b.k === 'h1' ? '# ' : b.k === 'h2' ? '\n## ' : b.k === 'li' ? '- ' : '') + (b.bold || '') + (b.text || ''));
  process.exit(0);
}
let doc = readDoc(dfile);
if (mode === 'check') {
  const problems = checkDoc(doc, data, backupDay);
  const active = (data.trees || []).filter(x => !x.deleted && x.status !== 'past').length;
  console.log(problems.length ? 'PROBLEMS: ' + problems.join('; ') : `OK – ${active} trees, built from backup ${backupDay}`);
  process.exit(problems.length ? 2 : 0);
}
const requests = mode === 'content' ? contentRequests(doc, blocks) : styleRequests(doc, blocks);
writeFileSync(out, JSON.stringify({ documentId: doc.documentId, writeControl: { requiredRevisionId: doc.revisionId }, requests }));
console.error(`${mode}: ${requests.length} requests → ${out} (backup ${backupDay})`);
