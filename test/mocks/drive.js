let n = 0;
export const getToken = async () => 'tok';
export const driveConnected = () => true;
export const upload = async (blob, name, sub) => { window.__uploads = (window.__uploads || []).concat(name); return 'drive' + (++n); };
export const fileUrl = async id => 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
export const listBackups = async () => [];
export const folderPath = async () => 'f';
