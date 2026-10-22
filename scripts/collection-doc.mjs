// Refreshes the Google Doc "GraytTrees – 2 My collection" from a GraytTrees backup, in two passes
// (text, then styling read back from the Doc, so formatting always lines up with the real text).
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
import { buildBlocks, contentRequests, styleRequests } from '../src/collectionDoc.js';

const [mode, bfile, dfile, out] = process.argv.slice(2);
const readDoc = f => { const d = JSON.parse(readFileSync(f, 'utf8')); return d.content || d; };
const docText = d => (d.tabs ? d.tabs[0].documentTab : d).body.content.filter(e => e.paragraph).map(e => e.paragraph.elements.map(x => x.textRun?.content || '').join('')).join('');
const M = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
const builtFrom = d => { const m = docText(d).match(/backup of (\d{1,2}) (\w{3}) (\d{4})/); return m ? `${m[3]}-${M[m[2]]}-${m[1].padStart(2, '0')}` : 'none'; };
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
  const t = docText(doc), problems = [];
  if (builtFrom(doc) !== backupDay) problems.push(`intro says backup ${builtFrom(doc)}, expected ${backupDay}`);
  for (const h of ['At a glance', 'Lessons from my own records', 'Past trees']) if (!t.includes(h)) problems.push(`missing "${h}"`);
  const active = (data.trees || []).filter(x => !x.deleted && x.status !== 'past');
  const missing = active.filter(x => !t.includes(x.name + ' – ') && !t.includes(x.name + ' (')).map(x => x.name);
  if (missing.length) problems.push('trees missing: ' + missing.join(', '));
  const tab = doc.tabs ? doc.tabs[0].documentTab : doc;
  const bullets = tab.body.content.filter(e => e.paragraph?.bullet).length;
  if (bullets < active.length) problems.push(`only ${bullets} bulleted lines (styling pass may not have run)`);
  console.log(problems.length ? 'PROBLEMS: ' + problems.join('; ') : `OK – ${active.length} trees, built from backup ${backupDay}`);
  process.exit(problems.length ? 2 : 0);
}
const requests = mode === 'content' ? contentRequests(doc, blocks) : styleRequests(doc, blocks);
writeFileSync(out, JSON.stringify({ documentId: doc.documentId, writeControl: { requiredRevisionId: doc.revisionId }, requests }));
console.error(`${mode}: ${requests.length} requests → ${out} (backup ${backupDay})`);
