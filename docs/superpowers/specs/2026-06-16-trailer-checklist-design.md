# Trailer Checklist PWA — Design

**Date:** 2026-06-16
**Status:** Approved for planning

## Purpose

A simple Android-tablet web app for running checklists when arriving at and leaving the family trailer. Each checklist item is tappable for detailed instructions with photos and short videos. On submit, the run is logged to a Google Sheet so we have a dated history of every checklist completion.

The app must work fully offline — the trailer's internet is unreliable — and sync queued submissions to the Sheet when connectivity returns.

## Scope

**In scope**
- Tablet-optimized PWA (Android Chrome target)
- Multiple, user-defined checklists (no fixed types)
- Per-item instructions: bilingual text + photos + ≤30s videos
- Self-editable in-app: add/edit checklists, items, media (no separate admin tool)
- Name picker (family) — not real auth
- Offline-first with background sync to a Google Sheet
- Bilingual UI: English / Icelandic with a toggle

**Out of scope**
- Multi-device sync of checklists or media
- User authentication / accounts
- Editing past runs (append-only log)
- Photo/video stored centrally — media stays on the tablet
- Native Android app

## Users

Family members sharing one tablet at the trailer. No login — pick your name from a list at the start of each run. Names are configured in settings.

## Architecture

```
Tablet (Android, Chrome)
└── Trailer Checklist PWA  (Svelte + Vite)
    ├── UI: Run mode + Edit mode + Settings
    ├── State: IndexedDB (Dexie wrapper)
    │   ├── checklists, items, media, runs, settings
    └── Service worker (Workbox / vite-plugin-pwa)
        ├── App shell caching → offline forever after first load
        └── Background Sync API → POST queued runs when online
                │
                ▼  HTTPS POST { JSON, shared-secret header }
        ┌──────────────────────────────────────┐
        │ Google Cloud                         │
        │   Apps Script web app (doPost)       │
        │     → appends row to Google Sheet    │
        └──────────────────────────────────────┘

Hosting: GitHub Pages (or equivalent free static host)
```

All app state lives on the tablet. The Sheet is a write-only log. There is no central backend.

### Tech stack

- **Framework:** Svelte + Vite
- **PWA:** `vite-plugin-pwa` (Workbox under the hood)
- **Local DB:** Dexie (IndexedDB wrapper)
- **i18n:** Plain `{ en: {...}, is: {...} }` lookup keyed by `settings.language`
- **Sheets endpoint:** Google Apps Script web app, deployed as "anyone with link"
- **Tests:** Vitest, @testing-library/svelte, happy-dom, fake-indexeddb
- **Hosting:** GitHub Pages

## Data model (IndexedDB)

```ts
checklists: {
  id: string,                // UUID
  name_en: string,
  name_is: string,
  item_order: string[],      // ordered item IDs
}

items: {
  id: string,
  checklist_id: string,
  title_en: string,
  title_is: string,
  instructions_en: string,
  instructions_is: string,
  media_ids: string[],
}

media: {
  id: string,
  type: 'photo' | 'video',
  blob: Blob,
  thumbnail_blob: Blob | null,
  mime: string,
  size_bytes: number,
}

runs: {
  id: string,                // UUID, used for idempotency
  checklist_id: string,
  checklist_name_snapshot: string,    // captured at submit time
  user_name: string,
  started_at: ISO string,
  finished_at: ISO string,
  notes: string,
  item_results: Array<{
    item_id: string,
    title_snapshot: string,
    checked: boolean,
    note: string,
  }>,
  sync_status: 'pending' | 'synced' | 'error',
  last_error: string | null,
  attempt_count: number,
}

settings: {
  users: string[],
  language: 'en' | 'is',
  endpoint_url: string,
  shared_secret: string,
  device_name: string,
}
```

Snapshot fields on `runs` (`checklist_name_snapshot`, `title_snapshot`) preserve history: later edits to a checklist do not rewrite past runs.

## Google Sheet contract

One row per run. Item details serialized as JSON in the last column.

| Column         | Source                                    |
|----------------|-------------------------------------------|
| `timestamp`    | `finished_at`                             |
| `user`         | `user_name`                               |
| `checklist`    | `checklist_name_snapshot`                 |
| `notes`        | `notes`                                   |
| `items_json`   | `JSON.stringify(item_results)`            |
| `run_id`       | `id` (UUID, used for dedupe)              |

### Apps Script `doPost(e)`

- Validates shared `secret` field in the POST JSON body against a script property. (Apps Script `doPost(e)` does not expose request headers, so the secret travels in the body.)
- Reads `run_id`; checks the most recent ~200 rows for that UUID; if found, returns `{ ok: true, dedup: true }` without writing.
- Otherwise appends a row.
- Responds with JSON: `{ ok: true, row: <rowNum> }` or `{ ok: false, error: "..." }`.
- HTTP status: 200 on success, 401 on bad secret, 400 on bad payload, 500 on Sheet error.

## Screens & flow

**Run mode**
1. **Home** — tiles, one per checklist. Pending-sync badge on header. Header has language toggle + online dot.
2. **Pick user** — tap your name. Remembers last-picked per checklist.
3. **Run view** — list of items, each row has a checkbox and a tap-to-open instruction button. Checking an item is independent of viewing instructions.
4. **Item detail** — title, instructions, photo gallery (swipe), inline videos, optional per-item note field.
5. **Submit** — review summary, optional final notes box, big Submit button. Returns to home with toast confirming queued or submitted.

**Edit mode** (entered via long-press on gear icon — guards against accidental edits)
- **Checklist list** — add / rename / reorder / delete checklists
- **Item editor** — title (EN/IS tabs), instructions (EN/IS tabs), media list with drag-reorder, add photo (camera or file), add video (recording or file). Warn when video >30s or media >5 MB.
- **Settings** — manage users, paste endpoint URL + secret, language toggle, "Force sync now", queue inspector (pending / error rows with retry & delete actions).

**Global**
- Header: language toggle, online/offline dot, pending-count badge.
- All long-form text inputs have EN/IS tabs to ensure both translations get filled.

## Sync & error handling

- Submit writes a `runs` row with `sync_status: 'pending'` and confirms to the user immediately. The tablet is the source of truth.
- Service worker registers a Background Sync tag. When the network returns, the SW POSTs each pending row, marks it `synced`. Fallback: foreground sync loop on app focus + visible "Force sync now" button (in case Background Sync isn't available on the device).
- Retry policy on network / 5xx: exponential backoff (1s, 2s, 4s, 8s, ... cap 5 min), up to ~10 attempts, then mark `error`. 4xx marks `error` immediately and surfaces in the queue inspector — typically a config issue (bad secret, wrong URL).
- Idempotency: every run carries a UUID `id`. The Apps Script dedups against recent rows so retries never produce duplicates.
- Append-only model: no editing past runs, no conflicts to resolve. Submitting the same checklist twice in a day produces two rows by design.
- Media stays on the tablet. The Sheet log never carries photos/videos.
- Storage pressure: when `navigator.storage.estimate()` shows low free quota, show a warning in settings with a "clear runs older than X days" button. Never auto-delete.

## Edit-mode gating

A long-press on the gear icon (1500 ms) opens edit mode. This is deliberately friction-rich so users running checklists don't accidentally rename items mid-task. It is *not* a security control — anyone with the tablet can edit.

## i18n

- `settings.language` ∈ `{'en','is'}`, persisted in localStorage for instant load.
- Strings table: `src/i18n/{en,is}.ts` — flat key/value, no nesting beyond one level.
- All user-authored content (checklist names, item titles, instructions) is stored in both languages; the UI renders the active language and falls back to the other if a field is empty.

## Testing strategy

Proportional to scope — a single-tablet family app.

- **Unit (Vitest)** — i18n lookup with fallback, run-to-payload serializer, idempotency UUID generator, retry/backoff state machine.
- **Component (Vitest + @testing-library/svelte + happy-dom)** — run flow (check items, add notes, submit), edit flow (add item, attach mock blob, drag-reorder), user picker, language toggle, edit-mode long-press gate.
- **IndexedDB (fake-indexeddb)** — Dexie schemas, CRUD, schema-version migration if/when bumped.
- **Sync (mocked fetch)** — happy path, 401 config error, 5xx with retry/backoff, idempotency on duplicate POST.
- **Apps Script (clasp + tiny harness)** — script POSTs sample payloads to a *test* Sheet and asserts row shape. Run manually before deploying production endpoint.
- **No e2e browser tests.** Instead, a "smoke checklist" lives in `docs/smoke-test.md`: install on tablet, run a checklist offline, go online, verify the Sheet row.

## Hosting & deploy

- App: GitHub Pages. Repo with GitHub Action that builds Vite output on push to `main`.
- Apps Script: Hand-deployed via `clasp` to a Google Sheet owned by the family Google account. Endpoint URL + shared secret pasted into the tablet's Settings on first install.
- First-time tablet install: open the public URL once over Wi-Fi, "Add to Home Screen". App is offline forever after that.

## Risks and open questions

- **Background Sync API availability** — Android Chrome supports it; if the tablet's Chrome version doesn't, foreground sync covers the case.
- **IndexedDB storage cap** — Android Chrome typically allows hundreds of MB to several GB. Photos + 30s videos for a couple of checklists should fit comfortably; the queue inspector exposes usage and a cleanup action.
- **Apps Script quotas** — 20k URL fetches/day, way above our needs. Latency can spike to a few seconds; UX hides this behind background sync.
- **Single-tablet assumption** — if the family later wants the same checklists on two tablets, we need to add export/import (JSON dump) as a future feature. Out of scope here.

## Future work (not in this build)

- Export / import checklists as JSON (multi-device parity without a backend)
- Per-checklist scheduling reminders ("you usually leave on Sunday — submit a leaving checklist?")
- Photos in the Sheet log (would require Drive upload + URL)
- Real auth and per-user history view
