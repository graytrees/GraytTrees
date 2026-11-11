let n = 0;
// window.__tok = false simulates an expired Drive sign-in (as after an hour); a "tap" (interactive) renews it.
export const hasDriveToken = () => window.__tok !== false;
export const preloadGis = () => {};
export const getToken = async (interactive = false) => { if (hasDriveToken()) return 'tok'; if (!interactive) throw new Error('Drive sign-in needed'); window.__popups = (window.__popups || 0) + 1; window.__tok = true; return 'tok'; };
export const driveConnected = () => true;
export const upload = async (blob, name, sub, interactive = false, o = {}) => { await getToken(interactive); window.__uploads = (window.__uploads || []).concat(name); if (sub === 'Backups' && /\.json$/.test(name)) (window.__backups ||= {})[name] = await blob.text(); return 'drive' + (++n); };
const PX = Uint8Array.from(atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'), c => c.charCodeAt(0));
export const fileBlob = async id => { await getToken(false); window.__fetched = (window.__fetched || []).concat(id); return new Blob([PX], { type: 'image/gif' }); };
export const fileText = async id => { await getToken(false); return window.__backups[id]; };
export const fileUrl = async id => { await getToken(false); return 'data:image/gif;base64,R0lGODlhAQABAAAAACw='; };
export const listBackups = async () => Object.keys(window.__backups || {}).filter(n => /^graytrees-backup-/.test(n)).sort().reverse().map(n => ({ id: n, name: n, size: window.__backups[n].length }));
export const folderPath = async () => 'f';
// Google Docs calls: window.__docs (a fake Doc) answers reads; writes are recorded in window.__docWrites.
export const googleApi = async (url, opts = {}) => {
  if (!window.__docs) { const e = new Error('Google Docs 404: no test Doc'); e.status = 404; throw e; }
  if (opts.method === 'POST') { window.__docWrites = (window.__docWrites || []).concat(JSON.parse(opts.body)); return { json: async () => ({}) }; }
  return { json: async () => window.__docs };
};
