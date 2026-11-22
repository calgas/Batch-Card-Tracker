# Batch Card Tracker

The CALGAS capacitor batch card as a web app. It replaces the AppSheet "Batch Card Tracker".

**Live:** https://calgas.github.io/Batch-Card-Tracker/ · **Version:** 1.0.0

## What it does

Every batch (CMPL0001, CMPL0002, …) moves through eight stages:

1. Winding
2. Spray
3. Heat Stabilizing
4. Short Clearing
5. Welding & Soldering
6. Pouring & Seaming
7. Testing & Packing (also carries BDV, ESR and the box count; the AppSheet app had a separate "BDV & Final Testing" stage)
8. Final Audit

Each stage is one card with its readings, photos, the operator and the Production Supervisor's signature. Then PQA signs it off. The next stage opens only once PQA has signed and the batch isn't on PQA hold. A batch that passes Final Audit is posted into Stock Management as FG Production, once.

### Screens

- **Overview:** open batches, PQA waiting, holds, batches not moving for 48 h, completions per week, yield, rejects by stage and reason, recent activity
- **Batches:** a board by stage, or a list, with filters, search and Excel export
- **Batch page:** progress stepper, every stage card with photos and signatures, PQA sign-off, hold and release, batch card PDF, QR label, FG posting, full history
- **PQA queue:** cards waiting for sign-off (oldest first) and batches on hold
- **Stages:** for each stage, batches ready to record, waiting for PQA, and every recorded card with its readings
- **Dropdowns:** lists, films and products (with the Stock Management FG code when it differs)
- **More:** apps, feedback and bug reports, about

### Speed

- One request loads everything at sign-in. The data is kept on the device, so the app opens at once next time and refreshes in the background.
- Photos are shrunk on the phone (about 1600 px) and uploaded while the operator fills in the rest of the form.
- Photos and signatures are shown through Google's image servers (`lh3.googleusercontent.com/d/<id>=w<size>`), which resize and cache them. The service worker keeps what has been seen on the device.

## How it is built

- **Frontend:** this repo: `index.html` (one file), `sw.js`, `manifest.json`, on GitHub Pages.
- **Backend:** Apps Script bound to the spreadsheet "Batch Card Tracker (web app)". Its code and tests are in the private repo `calgas/apps-backend` (`batch-card-tracker/`), together with the handover notes. No backend code or secrets are kept here.
- **Sign-in:** Stock Management's (`login` with `app: "bct"`). Access is Stock Management's Team & Access (bct.* permissions).

## Releasing

Bump `APP_VERSION` in `index.html` and commit. Then bump `CACHE_VERSION` in `sw.js` in a second commit.
