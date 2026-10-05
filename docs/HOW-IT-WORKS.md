# GraytTrees Bonsai – how it works

A private, installable web app (PWA) for Nathan's bonsai collection. Works on phone, tablet and laptop, and offline in the garden and shed.

## Where everything lives

| Part | Service | Account | What's in it |
|---|---|---|---|
| App code + version history | GitHub (`graytrees/GraytTrees`) | Nathan's GitHub | The program only. No records or photos. Public. |
| App web address | GitHub Pages | same GitHub | `https://graytrees.github.io/GraytTrees/` |
| Sign-in | Firebase Authentication (Google) | Nathan's Google account | Only `graytshotz@gmail.com` is allowed in. |
| Records | Cloud Firestore, Sydney region | Firebase project `graytrees` | Trees, history, pots, mixes, settings. Free tier. |
| Photos (full size) + backups | Google Drive → `GraytTrees/` folder | Nathan's Google account | `Photos/` and `Backups/` (weekly JSON + history CSV). |

## Safety rules built in

- History is never silently lost: editing an entry keeps the earlier version; deleting moves it to the **Recycle bin** (restorable).
- Offline: everything is cached on each device. Logged work and photos taken with no signal are saved on the device and sync/upload automatically when back in range.
- Weekly backup to Drive, readable without the app. Copy the `GraytTrees/Backups` folder into the IDrive backup set for a second copy.
- Firestore security rules (`firestore.rules`) allow only Nathan's verified Google account, only under his own user folder.
- Drive permission is the narrow `drive.file` scope: the app can only see files it created.

## Making a change

1. Describe the change to Claude (a screenshot helps).
2. Claude edits the code in the `graytrees` repo and pushes to `main`.
3. GitHub Actions (`.github/workflows/publish.yml`) builds and publishes in ~2 minutes.
4. Devices show "Update available – tap to refresh" next time the app is opened.

Rolling back = re-publishing an earlier commit from GitHub's history.

Changes that alter how records are stored: take a backup first (More → Settings & backups → Back up now).

## Code map (`src/`)

- `main.js` – start-up, sign-in gate, update banner
- `app.js` – all screens (collection, tree page, season, history, log sheet, pots, mixes, forms)
- `knowledge.js` – Brisbane monthly advice and species care notes (from Nathan's calendar + Red Dragon newsletters)
- `store.js` – reading/writing records (Firestore), revisions, recycle bin
- `photos.js` – thumbnails, Drive upload, offline photo queue
- `drive.js` – Google Drive access
- `backup.js` – weekly backup
- `importer.js` – one-time import of the merged old records
- `config.js` – Firebase project settings and owner email

Testing without the real cloud: `npm run test:ui` runs the app against an in-memory stand-in (`test/mocks/`).

## Accounts to keep

- GitHub: two-factor on; recovery codes in Bitwarden.
- Google account: already Nathan's main account.
- Once a year: glance at Firebase console → Usage, and check Drive storage space.
