// Work done after each weekly backup so that Nathan's scheduled Claude tasks never have to run code:
//   • the "GraytTrees – 2 My collection" Google Doc (the Claude Project's picture of the collection)
//     is refreshed in place, using the rules in collectionDoc.js
//   • the next three months' "Bonsai jobs" checklists are saved to Drive › GraytTrees › Backups as
//     graytrees-jobs-YYYY-MM-DD.json, which the 1st-of-the-month TickTick task copies across.
//
// Access: the app keeps the narrow drive.file permission. The Doc wasn't made by the app, so Nathan
// links it once with Google's file picker (More › Settings & backups › Link collection Doc); that
// gives the app access to that one Doc and nothing else.
import { firebaseConfig } from './config.js';
import { getToken, googleApi, upload } from './drive.js';
import { saveMeta, state } from './store.js';
import { buildBlocks, contentRequests, styleRequests, checkDoc } from './collectionDoc.js';
import { monthlyJobs } from './jobs.js';

const DOCS = 'https://docs.googleapis.com/v1/documents/';
const DOC_TITLE = 'GraytTrees – 2 My collection';
const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

/* ---------- monthly jobs file ---------- */
export async function saveJobsFile(data, day, interactive = false) {
  const now = new Date(), months = {};
  for (let i = 0; i < 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    months[key] = monthlyJobs(data, d.getFullYear(), d.getMonth() + 1);
  }
  const out = { made: day, from: `graytrees-backup-${day}.json`,
    about: 'Bonsai jobs checklists worked out by GraytTrees (same rules as Season › Monthly look-ahead). Keys are YYYY-MM.', months };
  await upload(new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' }), `graytrees-jobs-${day}.json`, 'Backups', interactive);
}

/* ---------- the collection Doc ---------- */
const getDoc = id => googleApi(DOCS + encodeURIComponent(id), { label: 'Google Docs' }).then(r => r.json());
const update = (doc, requests) => googleApi(DOCS + encodeURIComponent(doc.documentId) + ':batchUpdate', {
  label: 'Google Docs', method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ requests, writeControl: { requiredRevisionId: doc.revisionId } }) });

/** Rewrites the linked Doc from `data` (a full export). Nathan's Lessons section is never touched.
 *  Returns {ok, trees} or throws with a plain-English reason. Does nothing if no Doc is linked. */
export async function refreshCollectionDoc(data, day) {
  const id = state.meta.collectionDoc?.id;
  if (!id) return { skipped: true };
  const t = new Date(), today = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  const blocks = buildBlocks(data, { today, backupDay: day });
  let step = 'reading the Doc';
  try {
    // pass 1: text. If Nathan happened to be editing at that very moment, the Doc's revision moves on
    // and Google refuses the change (nothing written) – read it again and retry once.
    for (let attempt = 0; ; attempt++) {
      const doc = await getDoc(id);
      step = 'writing the text';
      try { await update(doc, contentRequests(doc, blocks)); break; }
      catch (e) { if (attempt || e.status !== 400 || !/revision/i.test(e.message)) throw e; }
    }
    // pass 2: styling, worked out from the Doc as it now stands
    step = 'reading the Doc back'; const doc2 = await getDoc(id);
    const style = styleRequests(doc2, blocks);
    step = 'writing the styling'; if (style.length) await update(doc2, style);
    // check
    step = 'checking the result'; const problems = checkDoc(await getDoc(id), data, day);
    if (problems.length) throw new Error('Check after refresh: ' + problems.join('; '));
    const trees = (data.trees || []).filter(x => !x.deleted && x.status !== 'past').length;
    await saveMeta('collectionDoc', { lastDay: day, lastMs: Date.now(), trees, error: '' });
    return { ok: true, trees };
  } catch (e) {
    let msg = String(e.message || e);
    if (e.status === 403 && /SERVICE_DISABLED|has not been used|is disabled/i.test(msg)) msg = 'The Google Docs service is switched off for the app (Google Cloud › APIs › enable "Google Docs API").';
    else if (e.status === 404 || e.status === 403) msg = `Google refused while ${step} (${e.status}). ` + (googleSays(msg) || 'No reason given.') + (step === 'reading the Doc' ? ' Try linking the Doc again.' : '');
    else msg = `Failed while ${step}: ` + msg;
    await saveMeta('collectionDoc', { error: msg, errorMs: Date.now() }).catch(() => {});
    throw new Error(msg);
  }
}

/** Pulls Google's own explanation out of an error body like '{"error":{"message":"…"}}'. */
function googleSays(text) { const m = /"message":\s*"([^"]+)/.exec(text); return m ? m[1] : ''; }

/* ---------- linking the Doc (one-off, from a tap) ---------- */
let pickerLoading = null;
function loadPicker() {
  pickerLoading ||= new Promise((res, rej) => {
    const go = () => window.gapi.load('picker', { callback: res, onerror: () => rej(new Error('Could not load Google\'s file picker.')) });
    if (window.gapi?.load) return go();
    const s = document.createElement('script');
    s.src = 'https://apis.google.com/js/api.js'; s.async = true;
    s.onload = go; s.onerror = () => rej(new Error('Could not reach Google. Check your connection.'));
    document.head.appendChild(s);
  }).catch(e => { pickerLoading = null; throw e; });
  return pickerLoading;
}

/** Opens Google's file picker so Nathan can choose the collection Doc. Resolves to {id, name} or null if cancelled. */
export async function pickCollectionDoc() {
  const token = await getToken(true);
  await loadPicker();
  const P = window.google.picker;
  return new Promise((resolve, reject) => {
    const view = new P.DocsView(P.ViewId.DOCUMENTS).setMode(P.DocsViewMode.LIST).setQuery(DOC_TITLE);
    const picker = new P.PickerBuilder()
      .addView(view)
      .setTitle('Choose "' + DOC_TITLE + '"')
      .setOAuthToken(token)
      .setDeveloperKey(firebaseConfig.apiKey)
      .setAppId(firebaseConfig.messagingSenderId)   // the Google Cloud project number
      .setCallback(r => {
        if (r[P.Response.ACTION] === P.Action.PICKED) { const d = r[P.Response.DOCUMENTS][0]; resolve({ id: d[P.Document.ID], name: d[P.Document.NAME] }); }
        else if (r[P.Response.ACTION] === P.Action.CANCEL) resolve(null);
        else if (r[P.Response.ACTION] === 'error') reject(new Error('Google\'s file picker reported an error.'));
      })
      .build();
    picker.setVisible(true);
  });
}

export async function linkCollectionDoc() {
  const d = await pickCollectionDoc();
  if (!d) return null;
  // make sure the app can really open it before saving the link
  const doc = await getDoc(d.id).catch(e => {
    if (e.status === 403 && /SERVICE_DISABLED|has not been used|is disabled/i.test(e.message)) throw new Error('Linked, but the Google Docs service is switched off for the app. Turn on "Google Docs API" in Google Cloud, then try again.');
    throw e;
  });
  await saveMeta('collectionDoc', { id: d.id, name: doc.title || d.name, linkedMs: Date.now(), lastDay: '', lastMs: 0, error: '' });
  return { id: d.id, name: doc.title || d.name };
}

export const todayDay = () => ymd(new Date());
