// Builds the "GraytTrees – 2 My collection" Google Doc (the Claude Project's picture of the
// collection) from a GraytTrees backup. Used by scripts/collection-doc.mjs, which a scheduled
// Claude task runs after each weekly backup. Pure functions: no browser, no network.
//
// The Doc is rewritten in place (same file id, because the Claude Project links to it):
//   • regenerated from the records: title, intro, "At a glance", the species sections, "Past trees"
//   • kept exactly as written in the Doc: everything from the "Lessons from my own records"
//     heading up to the "Past trees" heading (lessons, soil-mix history, routine)
import { GUIDE, calOf, repotWin, evMin, MONTHS, parseD, addMonths } from './jobs.js';

const KEEP_FROM = 'Lessons from my own records';
const KEEP_TO = 'Past trees';

/* sections, in order; each lists the care groups it holds */
const SECTIONS = [
  { title: 'Black pines (Exotics)', groups: ['pine'] },
  { title: 'Junipers (Exotics)', groups: ['juniper'] },
  { title: 'Elms (Exotics)', groups: ['elm'] },
  { title: 'Other exotics', groups: ['swamp', 'podo', 'azalea'] },
  { title: 'Natives', groups: ['mela'] },
  { title: 'Ficus & tropicals', groups: ['fig', 'cler', 'bougie', 'african'],
    note: 'Repot window mid-October to December (changed Oct 2026 from the old August habit, which they recovered from slowly).' },
  { title: 'Other trees', groups: ['other'] },
];
const PLURAL = { pine: ['black pine', 'black pines'], juniper: ['juniper', 'junipers'], elm: ['elm', 'elms'], cler: ['clerodendrum', 'clerodendrums'],
  fig: ['fig', 'figs'], swamp: ['swamp cypress', 'swamp cypresses'], podo: ['Buddhist pine', 'Buddhist pines'], mela: ['melaleuca', 'melaleucas'],
  azalea: ['azalea', 'azaleas'], bougie: ['bougainvillea', 'bougainvilleas'], african: ['jaboticaba', 'jaboticabas'], other: ['other tree', 'other trees'] };
const ROUTINE = ['fert', 'fung', 'insect', 'water', 'potash'];
const GENERIC = /^(repotted|repot|pruned|prune|fertili[sz]ed|fertili[sz]e|wired|unwired|root pruned|repot and root prune|repotted and root pruned|pruned to shape|prune to shape|hard prune|hard pruned|sprayed|purchased|bought|note)\.?$/i;

const mon = s => { const d = parseD(s); return d ? MONTHS[d.getMonth()] + ' ' + d.getFullYear() : ''; };
const fullDate = s => { const d = parseD(s); return d ? d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear() : ''; };
const yr = s => (s || '').slice(0, 4);

/** First meaningful sentence(s) of a log's text, generic job labels removed, max ~170 chars. */
export function snippet(text, max = 170) {
  const lines = String(text || '').replace(/([a-z])([A-Z])/g, '$1. $2').split(/\n+/).map(l => l.trim()).filter(l => l && !GENERIC.test(l));
  let s = lines.join('. ').replace(/\s+/g, ' ').replace(/[,;:]?\.+/g, '.').trim();
  if (!s) return '';
  if (s.length > max) { const cut = s.slice(0, max); const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; ')); s = (stop > 60 ? cut.slice(0, stop) : cut.replace(/\s+\S*$/, '') + '…'); }
  s = s.charAt(0).toUpperCase() + s.slice(1);
  return (/[.!?…)]$/.test(s) ? s : s + '.').replace(/[,;:]\.$/, '.');
}

/** Turns a backup ({trees, logs, meta}) into a list of blocks: {k:'h1'|'h2'|'p'|'li', text, bold?, italic?} */
export function buildBlocks(data, { today = new Date(), backupDay } = {}) {
  const settings = (data.meta || []).find(x => x.id === 'settings');
  const kindOf = a => (settings?.jobs || []).find(j => j.id === a)?.kind || a;
  const logs = (data.logs || []).filter(l => !l.deleted && !(l.flags || []).includes('tick'))
    .map(l => ({ ...l, kinds: (l.actions || []).map(kindOf) }))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const logsOf = id => logs.filter(l => (l.trees || []).includes(id));
  const lastOf = (id, kinds) => logsOf(id).find(l => l.kinds.some(k => kinds.includes(k)));
  const trees = (data.trees || []).filter(t => !t.deleted);
  const active = trees.filter(t => t.status !== 'past');
  const past = trees.filter(t => t.status === 'past' && !/^other early/i.test(t.name));

  const nowY = today.getFullYear(), nowM = today.getMonth() + 1;
  const nextRepot = t => {
    const win = repotWin(t); if (!win.length) return null;
    const last = lastOf(t.id, ['repot']);
    let [y, m] = last ? (() => { const d = parseD(last.date); return [d.getFullYear() + evMin(t), d.getMonth() + 1]; })() : [nowY, nowM];
    if (y < nowY || (y === nowY && m < nowM)) { y = nowY; m = nowM; }
    for (let i = 0; i < 24; i++) { const [yy, mm] = addMonths(y, m, i); if (win.includes(mm)) return MONTHS[mm - 1] + ' ' + yy; }
    return null;
  };

  function treeLine(t) {
    const L = logsOf(t.id);
    const first = L.length ? L[L.length - 1].date : null;
    const since = [t.acquired, first].filter(Boolean).sort()[0];
    const bits = [];
    if (since) bits.push(`in the collection since ${t.acquired && t.acquired <= (first || '9') ? yr(t.acquired) : 'at least ' + yr(since)}`);
    const lr = lastOf(t.id, ['repot']);
    if (lr) { const s = snippet(lr.text); bits.push(`last repot ${mon(lr.date)}${s ? ': ' + s.replace(/\.$/, '') : ''}`); }
    else bits.push('no repot on record');
    const nr = nextRepot(t); if (nr) bits.push(`next repot due ${nr}`);
    if (t.group === 'azalea') bits.push(t.azTiming === 'after' ? 'repotted after flowering (Oct–Nov)' : 'repotted before flowering (Jul–Aug, flowers pinched off)');
    if (t.autumn === 'yes') bits.push('flagged for the autumn repot window (Mar–May)');
    // notable history: up to 3 recent entries with real content, other than the last repot already quoted
    const notable = L.filter(l => l !== lr && !l.kinds.every(k => ROUTINE.includes(k)) && snippet(l.text).length >= 25).slice(0, 3)
      .map(l => `${mon(l.date)}: ${snippet(l.text, 150)}`);
    const extra = [];
    if (t.style) extra.push(`Style: ${t.style}.`);
    if (t.substrate) extra.push(`Soil: ${snippet(t.substrate, 120)}`);
    let text = ' – ' + bits.map(b => b.charAt(0).toUpperCase() + b.slice(1)).join('. ') + '.';
    if (notable.length) text += ' ' + notable.join(' ');
    if (extra.length) text += ' ' + extra.join(' ');
    const words = String(t.common || '').toLowerCase().split(/[^a-z]+/).filter(w => w.length > 3);
    const aka = t.common && !words.some(w => t.name.toLowerCase().includes(w)) ? ` (${t.common})` : '';
    return { k: 'li', bold: t.name + aka, text: text.replace(/[,;:]?\.\.?/g, '.').replace(/\s+/g, ' ') };
  }

  const B = [];
  B.push({ k: 'h1', text: 'GraytTrees – My collection' });
  B.push({ k: 'p', italic: true, text: `Rebuilt automatically from the GraytTrees backup of ${fullDate(backupDay) || fullDate(today.toISOString().slice(0, 10))} (${active.length} trees, ${logs.length} history entries going back to ${yr(logs[logs.length - 1]?.date) || '2003'}). The tree sections and "Past trees" are rewritten after every weekly backup, so make changes in the app, not here. "Lessons from my own records", "Soil mix history" and "Routine" are kept exactly as written in this Doc.` });

  B.push({ k: 'h2', text: 'At a glance' });
  B.push({ k: 'li', text: `${active.length} trees, kept in Brisbane.` });
  const counts = Object.entries(active.reduce((m, t) => (m[t.group || 'other'] = (m[t.group || 'other'] || 0) + 1, m), {})).sort((a, b) => b[1] - a[1]);
  const many = counts.filter(([, n]) => n > 1).map(([g, n]) => `${n} ${(PLURAL[g] || PLURAL.other)[1]}`);
  const ones = counts.filter(([, n]) => n === 1).map(([g]) => (PLURAL[g] || PLURAL.other)[0]);
  B.push({ k: 'li', text: `Groups: ${many.join(', ')}${ones.length ? ', plus ' + ones.slice(0, -1).join(', ') + (ones.length > 1 ? ' and ' : '') + ones.slice(-1) : ''}.` });
  B.push({ k: 'li', text: 'Repot windows (Brisbane): Exotics mid-July to August; Natives August to September; Ficus & tropicals mid-October to December. Autumn (March–May) is an option for urgent repots and black pines, flagged per tree.' });
  const dueSoon = active.map(t => { const r = nextRepot(t); if (!r) return null; const [m, y] = r.split(' '); return { t, r, k: +y * 12 + MONTHS.indexOf(m) }; }).filter(Boolean)
    .filter(x => x.k <= nowY * 12 + nowM - 1 + 12).sort((a, b) => a.k - b.k);
  if (dueSoon.length) {
    const byMonth = dueSoon.reduce((m, x) => ((m[x.r] = m[x.r] || []).push(x.t.name), m), {});
    B.push({ k: 'li', text: 'Repots due in the next 12 months: ' + Object.entries(byMonth).map(([r, ns]) => `${r} – ${ns.join(', ')}`).join('; ') + '.' });
  }

  for (const sec of SECTIONS) {
    const ts = active.filter(t => sec.groups.includes(t.group || 'other')).sort((a, b) => sec.groups.indexOf(a.group) - sec.groups.indexOf(b.group) || a.name.localeCompare(b.name, 'en', { numeric: true }));
    if (!ts.length) continue;
    B.push({ k: 'h2', text: sec.title });
    if (sec.note) B.push({ k: 'p', italic: true, text: sec.note });
    ts.forEach(t => B.push(treeLine(t)));
  }
  return { top: B, past: pastBlocks(past, logs) };
}

function pastBlocks(past, logs) {
  const names = past.sort((a, b) => a.name.localeCompare(b.name)).map(t => {
    const end = logs.find(l => (l.trees || []).includes(t.id) && l.kinds.some(k => ['died', 'gone'].includes(k)));
    const why = t.fate || (end ? (end.kinds.includes('died') ? 'died ' : 'gone ') + yr(end.date) : '');
    return t.name + (why ? ` (${why.replace(/^(\w)/, c => c.toLowerCase())})` : '');
  });
  return [{ k: 'h2', text: 'Past trees (no longer in the collection)' }, { k: 'p', text: names.join(', ') + '.' }];
}

/* ---------- Google Docs batchUpdate requests ---------- */
function paraText(p) { return (p.elements || []).map(e => e.textRun?.content || '').join(''); }

/** Finds the kept section and the doc end. Throws if the Doc no longer has the expected headings. */
export function locate(doc) {
  const tab = doc.tabs ? doc.tabs[0].documentTab : doc;
  const body = tab.body.content;
  let keepStart = null, pastStart = null;
  for (const el of body) {
    if (!el.paragraph) continue;
    const t = paraText(el.paragraph).trim();   // matched on text, not style, so a lost heading style can't break it
    if (keepStart == null && t.startsWith(KEEP_FROM)) keepStart = el.startIndex;
    if (keepStart != null && pastStart == null && t.startsWith(KEEP_TO)) pastStart = el.startIndex;
  }
  if (keepStart == null) throw new Error(`Heading "${KEEP_FROM}" not found — not rewriting, so your lessons are never lost.`);
  const end = body[body.length - 1].endIndex;
  return { keepStart, pastStart: pastStart ?? end - 1, end };
}

const lineOf = b => (b.bold || '') + (b.text || '');

/** Pass 1 – text only: replace the generated parts, keep the Lessons → Routine part untouched. */
export function contentRequests(doc, blocks) {
  const { keepStart, pastStart, end } = locate(doc);
  const req = [];
  if (end - 1 > pastStart) req.push({ deleteContentRange: { range: { startIndex: pastStart, endIndex: end - 1 } } });
  req.push({ insertText: { location: { index: pastStart }, text: blocks.past.map(lineOf).join('\n') } });
  if (keepStart > 1) req.push({ deleteContentRange: { range: { startIndex: 1, endIndex: keepStart } } });
  req.push({ insertText: { location: { index: 1 }, text: blocks.top.map(lineOf).join('\n') + '\n' } });
  return req;
}

/** Pass 2 – styling, worked out from the Doc as it now stands (so it is always aligned with the real text). */
export function styleRequests(doc, blocks) {
  const { keepStart, pastStart, end } = locate(doc);
  const tab = doc.tabs ? doc.tabs[0].documentTab : doc;
  const paras = tab.body.content.filter(el => el.paragraph).map(el => ({ s: el.startIndex, e: el.endIndex, t: paraText(el.paragraph) }));
  const req = [];
  const region = (from, to, bl) => {
    const ps = paras.filter(p => p.s >= from && p.s < to);
    if (!ps.length) return;
    const all = { startIndex: ps[0].s, endIndex: ps[ps.length - 1].e };
    req.push({ updateParagraphStyle: { range: all, paragraphStyle: { namedStyleType: 'NORMAL_TEXT' }, fields: 'namedStyleType' } });
    req.push({ deleteParagraphBullets: { range: all } });
    req.push({ updateTextStyle: { range: { startIndex: all.startIndex, endIndex: all.endIndex - 1 }, textStyle: { bold: false, italic: false }, fields: 'bold,italic' } });
    const lis = [];
    ps.forEach((p, i) => {
      const b = bl[i] || { k: 'p' };
      const r = { startIndex: p.s, endIndex: p.e };
      if (b.k === 'h1' || b.k === 'h2') req.push({ updateParagraphStyle: { range: r, paragraphStyle: { namedStyleType: b.k === 'h1' ? 'HEADING_1' : 'HEADING_2' }, fields: 'namedStyleType' } });
      const textEnd = p.e - (p.t.endsWith('\n') ? 1 : 0);
      if (b.italic && textEnd > p.s) req.push({ updateTextStyle: { range: { startIndex: p.s, endIndex: textEnd }, textStyle: { italic: true }, fields: 'italic' } });
      if (b.k === 'li') { lis.push(i); const dash = p.t.indexOf(' – '); if (b.bold && dash > 0) req.push({ updateTextStyle: { range: { startIndex: p.s, endIndex: p.s + dash }, textStyle: { bold: true }, fields: 'bold' } }); }
    });
    for (let i = 0; i < lis.length; i++) { let j = i; while (j + 1 < lis.length && lis[j + 1] === lis[j] + 1) j++;
      req.push({ createParagraphBullets: { range: { startIndex: ps[lis[i]].s, endIndex: ps[lis[j]].e - 1 }, bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE' } }); i = j; }
  };
  region(pastStart, end, blocks.past);   // bottom first (styling doesn't move indexes, but keep the habit)
  region(1, keepStart, blocks.top);
  return req;
}
