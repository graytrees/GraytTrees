// Edit history ("revisions") kept on each record. Pure functions, so they can be tested without the database.
// Long text and embedded pictures (a book's typed index, its cover image) are not copied into the history:
// they would be repeated on every save and could push one record past Firestore's 1 MB limit.
export const MAX_REVS = 30, MAX_REV_BYTES = 200000, LONG = 2000;
const size = x => JSON.stringify(x).length;
const fat = v => typeof v === 'string' && v.length > LONG;
export const slim = r => {
  const x = { ...r };
  for (const [k, v] of Object.entries(x)) if (fat(v)) x[k] = v.startsWith('data:') ? '(picture not kept in history)' : '(long text not kept in history)';
  return x;
};
export const isFat = r => Object.values(r || {}).some(fat);
/** What to do with a record's history when saving a new version.
 *  Returns {append: version} when the history is small and clean (the cheap path),
 *  or {replace: [...]} with a slimmed, capped history when it has grown or holds long values. */
export function nextRevisions(old = [], snap) {
  const s = slim(snap);
  if (old.length < MAX_REVS && !old.some(isFat) && size(old) <= MAX_REV_BYTES) return { append: s };
  const list = [...old.map(slim), s].slice(-MAX_REVS);
  while (list.length > 1 && size(list) > MAX_REV_BYTES) list.shift();
  return { replace: list };
}
