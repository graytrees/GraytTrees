# GraytTrees Bonsai – how it works

A private, installable web app (PWA) for Nathan's bonsai collection. Works on phone, tablet and laptop, and offline in the garden and shed.

## Where everything lives

| Part | Service | Account | What's in it |
|---|---|---|---|
| App code + version history | GitHub (`graytrees/GraytTrees`) | Nathan's GitHub | The program only. No records or photos. Public. |
| App web address | GitHub Pages | same GitHub | `https://graytrees.github.io/GraytTrees/` |
| Sign-in | Firebase Authentication (Google) | Nathan's Google account | Only `graytshotz@gmail.com` is allowed in. |
| Records | Cloud Firestore, Sydney region | Firebase project `graytrees` | Trees, history, pots, tools, mixes, books, settings. Free tier. |
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
- `knowledge.js` – Brisbane monthly advice and species care notes (from Nathan's calendar, Red Dragon newsletters, his own repot history and Oct 2026 research)
- Season calendars (Oct 2026): three groups – Exotics (repot mid-Jul–Aug), Natives (Aug–Sep), Ficus & tropicals (mid-Oct–Dec, never Jan) – plus an optional autumn window (Mar–May, light root work) and a per-tree autumn flag; azaleas can be set to repot before or after flowering
- `store.js` – reading/writing records (Firestore), revisions, recycle bin
- `photos.js` – thumbnails, Drive upload, offline photo queue
- `drive.js` – Google Drive access
- `backup.js` – weekly backup
- `docSync.js` – after each backup: monthly jobs file and the collection Doc refresh; linking the Doc
- `collectionDoc.js` / `jobs.js` – the rules for the collection Doc and for seasonal jobs
- `importer.js` – one-time import of the merged old records (also used for top-up photo imports)
- In the app: More › How it works shows this page as visual maps (where everything lives, making a change, getting things back)
- `config.js` – Firebase project settings and owner email

Testing without the real cloud: `npm run test:ui` runs the app against an in-memory stand-in (`test/mocks/`).

## Accounts to keep

- GitHub: two-factor on; recovery codes in Bitwarden.
- Google account: already Nathan's main account.
- Once a year: glance at Firebase console → Usage, and check Drive storage space.

## Library (More › Library)
- Your bonsai books live in the `books` collection alongside the trees, so they're in the weekly backup too. The first 100 came from Handy Library (`graytrees-library.json`, imported via More › Import; re-importing never overwrites a book you've edited).
- Each book can be starred as a key book and can carry page photos (contents, index, key chapters). Page photos go to GraytTrees/Photos on Drive like any other photo.
- "Do I own it?" scans a barcode with the phone camera (Android Chrome) or takes a typed ISBN/title. Unknown ISBNs are looked up on Open Library so you can add the book in one tap.

## Tools (More › Tools)
- Each tool is one record in the `tools` collection (in the weekly backup too): name, type, brand, model No., length / blade / weight, steel, purchase date, where from, price in yen and optionally dollars, maker's link, comments and photos.
- The steel choice brings up the matching care note (carbon steels: dry and oil with camellia oil; stainless: rustproof, harder to resharpen). The list can be filtered to the rust-prone tools.
- The first nine came from Nathan's Kaneshin (2021, 2024) and Wazakura (2025) orders via `graytrees-tools.json` (More › Import). Prices are kept out of this public code: they live only in that file and in Firestore.

## "My collection" Google Doc (for the Claude Project)
- The Google Doc "GraytTrees – 2 My collection" (Drive › GraytTrees › Claude Knowledge) is the Claude Project's picture of the collection. It is rewritten in place (same file, because the Project links to it) after each weekly backup.
- The app refreshes it itself straight after each weekly backup (and after "Back up now"), using the rules in `src/collectionDoc.js` (`src/docSync.js` does the Google Docs calls): text first, then styling read back from the Doc, then a check. The result shows in More › Settings & backups.
- Access: the app keeps the narrow `drive.file` permission, so the Doc is linked once with Google's file picker (More › Settings & backups › Link collection Doc). That lets the app open that one Doc and nothing else. Needs the "Google Docs API" and "Google Picker API" switched on in the Google Cloud project `graytrees`.
- A weekly scheduled Claude task only checks that the Doc's intro date has kept up with the newest backup and emails if not. It runs no code (scheduled tasks can't run code downloaded from GitHub).
- `scripts/collection-doc.mjs` uses the same rules and is kept for checking or repairing the Doc by hand.
- Rebuilt from the records: intro, At a glance (counts, repot windows, repots due in the next 12 months), the species sections (each tree: since when, last repot, next repot due, notable history, style, soil) and Past trees.
- Kept exactly as written in the Doc: everything from "Lessons from my own records" up to "Past trees" (lessons, soil-mix history, routine). Edit those in the Doc itself. If the "Lessons from my own records" heading is renamed or removed, the refresh stops rather than risk losing it.
- Reminder ticks (Care App same-day ticks marked "not counted" in the app) don't count as repots, the same as in the app.

## Monthly bonsai jobs (TickTick)
- Wire checks: a tree logged as **Wired** needs its wire checked every 3 months. It shows on the home screen (Check wire card, from 2 weeks before it's due), in Season › Monthly look-ahead and in that month's TickTick checklist. **Wire checked** restarts the 3 months; **Wire removed** ends it. Wiring logged before 2026 is treated as old history.
- Each backup also saves `graytrees-jobs-YYYY-MM-DD.json` in GraytTrees/Backups: the "Bonsai jobs" checklists for this month and the next two (same rules as Season › Monthly look-ahead, `monthlyJobs` in `src/jobs.js`).
- On the 1st, a scheduled Claude task reads the newest jobs file and creates the checklist task in TickTick's Bonsai list. It runs no code. If the newest file is over a fortnight old it adds a reminder to open the app.
- `scripts/monthly-jobs.mjs` gives the same list from a backup file, for checking by hand.
