let n = 0;
// window.__tok = false simulates an expired Drive sign-in (as after an hour); a "tap" (interactive) renews it.
export const hasDriveToken = () => window.__tok !== false;
export const preloadGis = () => {};
export const getToken = async (interactive = false) => { if (hasDriveToken()) return 'tok'; if (!interactive) throw new Error('Drive sign-in needed'); window.__popups = (window.__popups || 0) + 1; window.__tok = true; return 'tok'; };
export const driveConnected = () => true;
export const upload = async (blob, name, sub, interactive = false) => { await getToken(interactive); window.__uploads = (window.__uploads || []).concat(name); return 'drive' + (++n); };
export const fileUrl = async id => { await getToken(false); return 'data:image/gif;base64,R0lGODlhAQABAAAAACw='; };
export const listBackups = async () => [];
export const folderPath = async () => 'f';
