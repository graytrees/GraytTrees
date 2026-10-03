// Google Drive: full-size photos and weekly backups go into a "Graytrees" folder in
// the owner's own Drive. Uses the narrow drive.file permission – the app can only see
// files it created itself, nothing else in Drive.
import { googleClientId, driveFolderName, ownerEmail } from './config.js';

const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const API = 'https://www.googleapis.com/drive/v3';
let token = null, tokenExp = 0, client = null, gisLoading = null;

function loadGis() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  gisLoading ||= new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
    s.onload = res; s.onerror = () => rej(new Error('Could not reach Google. Check your connection.'));
    document.head.appendChild(s);
  });
  return gisLoading;
}

/** Get a Drive access token. `interactive` must be true when called from a tap (first time shows Google's consent). */
export async function getToken(interactive = false) {
  if (token && Date.now() < tokenExp - 60000) return token;
  if (!navigator.onLine) throw new Error('offline');
  await loadGis();
  return new Promise((resolve, reject) => {
    client = google.accounts.oauth2.initTokenClient({
      client_id: googleClientId, scope: SCOPE, hint: ownerEmail,
      prompt: interactive ? '' : 'none',
      callback: r => {
        if (r.error) return reject(new Error(r.error));
        token = r.access_token; tokenExp = Date.now() + r.expires_in * 1000;
        try { localStorage.setItem('gt-drive-ok', '1'); } catch (e) {}
        resolve(token);
      },
      error_callback: e => reject(new Error(e.type || 'Drive permission was not granted')),
    });
    client.requestAccessToken();
  });
}
export const driveConnected = () => { try { return localStorage.getItem('gt-drive-ok') === '1'; } catch (e) { return false; } };

async function api(path, opts = {}) {
  const t = await getToken(opts.interactive);
  const r = await fetch(path.startsWith('http') ? path : API + path, { ...opts, headers: { Authorization: 'Bearer ' + t, ...(opts.headers || {}) } });
  if (!r.ok) throw new Error('Drive ' + r.status + ': ' + (await r.text()).slice(0, 200));
  return r;
}

const folderCache = {};
async function folder(name, parent) {
  const key = (parent || 'root') + '/' + name;
  if (folderCache[key]) return folderCache[key];
  const q = encodeURIComponent(`name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false and '${parent || 'root'}' in parents`);
  const found = await (await api(`/files?q=${q}&fields=files(id)`)).json();
  let id = found.files?.[0]?.id;
  if (!id) {
    const r = await api('/files?fields=id', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: parent ? [parent] : [] }) });
    id = (await r.json()).id;
  }
  return (folderCache[key] = id);
}
export async function folderPath(...parts) { let p = null; for (const n of [driveFolderName, ...parts]) p = await folder(n, p); return p; }

export async function upload(blob, name, sub, interactive = false) {
  await getToken(interactive);
  const parent = await folderPath(sub);
  const meta = { name, parents: [parent] };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
  form.append('file', blob);
  const r = await api('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', { method: 'POST', body: form });
  return (await r.json()).id;
}

const blobCache = new Map();
export async function fileUrl(id) {
  if (blobCache.has(id)) return blobCache.get(id);
  const r = await api(`/files/${id}?alt=media`);
  const url = URL.createObjectURL(await r.blob());
  blobCache.set(id, url);
  return url;
}

export async function listBackups() {
  const parent = await folderPath('Backups');
  const q = encodeURIComponent(`'${parent}' in parents and trashed=false`);
  return (await (await api(`/files?q=${q}&orderBy=createdTime desc&pageSize=20&fields=files(id,name,createdTime,size)`)).json()).files || [];
}
