# Trailer Checklist PWA — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an offline-first Svelte PWA on an Android tablet for running family checklists at the trailer, with per-item photo/video instructions and submission of each completed run as a row in a Google Sheet via an Apps Script web app.

**Architecture:** Single-page Svelte + Vite app installed as a PWA. All state lives in IndexedDB (via Dexie). A service worker (vite-plugin-pwa / Workbox) caches the app shell and uses the Background Sync API to POST queued run submissions to a Google Apps Script web app, which appends a row to a Google Sheet. Bilingual EN/IS UI. State-based router (no SPA router dependency).

**Tech Stack:** Svelte 4, Vite 5, TypeScript, Dexie, vite-plugin-pwa (Workbox), Vitest, @testing-library/svelte, happy-dom, fake-indexeddb, Google Apps Script (clasp), GitHub Pages.

**Working directory:** `/home/kjb/Projects/trailer-checklist`

---

## File Structure

```
trailer-checklist/
├── package.json
├── vite.config.ts                # Vite + svelte + PWA plugin config
├── vitest.config.ts              # Test config (happy-dom, fake-indexeddb setup)
├── tsconfig.json
├── tsconfig.node.json
├── svelte.config.js
├── index.html
├── public/
│   ├── icons/icon-192.png
│   ├── icons/icon-512.png
│   └── icons/icon-maskable-512.png
├── src/
│   ├── main.ts                   # App bootstrap, PWA registration
│   ├── app.css                   # Global styles, design tokens
│   ├── App.svelte                # Root shell, screen switch
│   ├── lib/
│   │   ├── db/
│   │   │   ├── schema.ts         # Dexie DB definition + TS types
│   │   │   ├── repos.ts          # CRUD helpers per table
│   │   │   └── seed.ts           # First-run sample checklist
│   │   ├── sync/
│   │   │   ├── payload.ts        # Run → JSON payload serializer
│   │   │   ├── backoff.ts        # Pure retry/backoff state machine
│   │   │   ├── client.ts         # fetch wrapper for Apps Script POST
│   │   │   └── queue.ts          # Queue runner orchestrating client + repos
│   │   ├── i18n/
│   │   │   ├── en.ts             # English strings
│   │   │   ├── is.ts             # Icelandic strings
│   │   │   └── store.ts          # Active language store + `t()` helper
│   │   ├── stores/
│   │   │   ├── settings.ts       # Settings reactive store
│   │   │   ├── network.ts        # online/offline store
│   │   │   ├── screen.ts         # Current screen + nav helpers
│   │   │   └── pending.ts        # Pending-sync count store
│   │   ├── utils/
│   │   │   ├── uuid.ts           # UUID v4 generator
│   │   │   ├── longpress.ts      # Svelte action for long-press
│   │   │   └── media.ts          # Photo compression + thumbnail + size guard
│   │   └── components/
│   │       ├── Header.svelte
│   │       ├── LangTabs.svelte   # EN/IS tabbed input
│   │       ├── MediaUploader.svelte
│   │       └── Toast.svelte
│   └── screens/
│       ├── Home.svelte
│       ├── PickUser.svelte
│       ├── RunChecklist.svelte
│       ├── ItemDetail.svelte
│       ├── Submit.svelte
│       ├── EditList.svelte
│       ├── EditChecklist.svelte
│       ├── EditItem.svelte
│       └── Settings.svelte
├── tests/
│   ├── setup.ts                  # fake-indexeddb wiring + matchers
│   ├── unit/
│   │   ├── uuid.test.ts
│   │   ├── backoff.test.ts
│   │   ├── payload.test.ts
│   │   ├── i18n.test.ts
│   │   ├── repos.test.ts
│   │   ├── queue.test.ts
│   │   └── media.test.ts
│   └── component/
│       ├── Header.test.ts
│       ├── LangTabs.test.ts
│       ├── Home.test.ts
│       ├── RunChecklist.test.ts
│       ├── Submit.test.ts
│       └── EditItem.test.ts
├── apps-script/
│   ├── .clasp.json               # gitignored; per-developer
│   ├── appsscript.json
│   ├── Code.gs                   # doPost handler
│   └── test-payload.json         # sample payload for manual harness
├── docs/
│   ├── smoke-test.md
│   └── superpowers/
│       └── specs/2026-06-16-trailer-checklist-design.md  # already present
└── .github/
    └── workflows/
        └── deploy.yml            # GitHub Pages deploy on main push
```

---

## Task 1: Project scaffolding (Vite + Svelte + TS)

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `svelte.config.js`, `index.html`, `src/main.ts`, `src/App.svelte`, `src/app.css`, `.gitignore`

- [ ] **Step 1: Initialize npm package**

Run from `/home/kjb/Projects/trailer-checklist`:

```bash
npm init -y
```

- [ ] **Step 2: Install Vite, Svelte, TypeScript**

```bash
npm install -D vite@^5 @sveltejs/vite-plugin-svelte@^3 svelte@^4 svelte-check@^3 typescript@^5 @tsconfig/svelte@^5
```

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "extends": "@tsconfig/svelte/tsconfig.json",
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "resolveJsonModule": true,
    "allowJs": false,
    "checkJs": false,
    "isolatedModules": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": { "$lib/*": ["src/lib/*"], "$screens/*": ["src/screens/*"] }
  },
  "include": ["src/**/*.ts", "src/**/*.d.ts", "src/**/*.svelte", "tests/**/*.ts"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 4: Create `tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts", "vitest.config.ts"]
}
```

- [ ] **Step 5: Create `svelte.config.js`**

```js
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
export default { preprocess: vitePreprocess() };
```

- [ ] **Step 6: Create `vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    alias: {
      $lib: fileURLToPath(new URL('./src/lib', import.meta.url)),
      $screens: fileURLToPath(new URL('./src/screens', import.meta.url)),
    },
  },
  base: './',
});
```

- [ ] **Step 7: Create `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#1a1a2e" />
    <title>Trailer Checklist</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 8: Create `src/app.css` (design tokens)**

```css
:root {
  --bg: #0f1020;
  --surface: #1a1a2e;
  --surface-2: #232348;
  --border: #2a2a4a;
  --text: #e8e8f0;
  --muted: #8d8db0;
  --accent: #8b8bd6;
  --ok: #4ad295;
  --warn: #e4b04a;
  --err: #e36f6f;
  --tap: 56px;
  --radius: 12px;
}
* { box-sizing: border-box; }
html, body, #app { height: 100%; }
body { margin: 0; background: var(--bg); color: var(--text);
  font: 16px/1.5 system-ui, sans-serif; -webkit-tap-highlight-color: transparent; }
button { min-height: var(--tap); font: inherit; }
```

- [ ] **Step 9: Create `src/main.ts`**

```ts
import './app.css';
import App from './App.svelte';

const app = new App({ target: document.getElementById('app')! });
export default app;
```

- [ ] **Step 10: Create `src/App.svelte` (placeholder)**

```svelte
<script lang="ts">
</script>

<main>
  <h1>Trailer Checklist</h1>
  <p>Scaffold OK.</p>
</main>

<style>
  main { padding: 24px; }
</style>
```

- [ ] **Step 11: Add npm scripts to `package.json`**

Edit `package.json` so the `scripts` section reads:

```json
{
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "svelte-check --tsconfig ./tsconfig.json && vite build",
    "preview": "vite preview",
    "check": "svelte-check --tsconfig ./tsconfig.json"
  }
}
```

- [ ] **Step 12: Create `.gitignore`**

```
node_modules/
dist/
.superpowers/
apps-script/.clasp.json
```

- [ ] **Step 13: Verify dev server boots**

Run: `npm run dev`
Expected: server prints a local URL; visiting it shows "Trailer Checklist / Scaffold OK." Stop with Ctrl+C.

- [ ] **Step 14: Verify production build succeeds**

Run: `npm run build`
Expected: exit 0, `dist/index.html` exists.

- [ ] **Step 15: Commit**

```bash
git add -A
git commit -m "feat: scaffold Vite + Svelte + TS project"
```

---

## Task 2: Test harness (Vitest + fake-indexeddb + happy-dom)

**Files:**
- Create: `vitest.config.ts`, `tests/setup.ts`, `tests/unit/sanity.test.ts`

- [ ] **Step 1: Install test deps**

```bash
npm install -D vitest@^1 @testing-library/svelte@^4 @testing-library/jest-dom@^6 happy-dom@^13 fake-indexeddb@^5 @vitest/coverage-v8@^1
```

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [svelte({ hot: false })],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      $lib: fileURLToPath(new URL('./src/lib', import.meta.url)),
      $screens: fileURLToPath(new URL('./src/screens', import.meta.url)),
    },
  },
});
```

- [ ] **Step 3: Create `tests/setup.ts`**

```ts
import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';

afterEach(async () => {
  const dbs = await indexedDB.databases?.();
  if (dbs) for (const db of dbs) if (db.name) indexedDB.deleteDatabase(db.name);
});
```

- [ ] **Step 4: Write a sanity test that should fail**

Create `tests/unit/sanity.test.ts`:

```ts
import { expect, test } from 'vitest';

test('sanity: math still works', () => {
  expect(1 + 1).toBe(2);
});
```

- [ ] **Step 5: Add test scripts**

Edit `package.json` `scripts`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 6: Run tests, expect pass**

Run: `npm test`
Expected: 1 passing test.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add vitest + testing-library + fake-indexeddb harness"
```

---

## Task 3: UUID utility (TDD)

**Files:**
- Create: `src/lib/utils/uuid.ts`
- Test: `tests/unit/uuid.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { uuid } from '$lib/utils/uuid';

describe('uuid', () => {
  it('returns a v4-shaped string', () => {
    const id = uuid();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
  it('returns unique values across many calls', () => {
    const set = new Set(Array.from({ length: 1000 }, uuid));
    expect(set.size).toBe(1000);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test`
Expected: FAIL "Cannot find module '$lib/utils/uuid'".

- [ ] **Step 3: Implement**

Create `src/lib/utils/uuid.ts`:

```ts
export function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npm test`
Expected: all passing.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: uuid v4 helper"
```

---

## Task 4: Dexie schema and types

**Files:**
- Create: `src/lib/db/schema.ts`
- Test: `tests/unit/repos.test.ts` (skeleton; full tests in Task 5)

- [ ] **Step 1: Install Dexie**

```bash
npm install dexie@^4
```

- [ ] **Step 2: Write a schema-shape test**

Create `tests/unit/repos.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { db } from '$lib/db/schema';

describe('db schema', () => {
  it('exposes the expected tables', () => {
    expect(db.checklists).toBeDefined();
    expect(db.items).toBeDefined();
    expect(db.media).toBeDefined();
    expect(db.runs).toBeDefined();
    expect(db.settings).toBeDefined();
  });

  it('opens without error', async () => {
    await db.open();
    expect(db.isOpen()).toBe(true);
  });
});
```

- [ ] **Step 3: Run, verify fail**

Run: `npm test`
Expected: FAIL "Cannot find module '$lib/db/schema'".

- [ ] **Step 4: Implement schema**

Create `src/lib/db/schema.ts`:

```ts
import Dexie, { type Table } from 'dexie';

export type Lang = 'en' | 'is';

export interface Checklist {
  id: string;
  name_en: string;
  name_is: string;
  item_order: string[];
  created_at: string;
  updated_at: string;
}

export interface Item {
  id: string;
  checklist_id: string;
  title_en: string;
  title_is: string;
  instructions_en: string;
  instructions_is: string;
  media_ids: string[];
}

export interface Media {
  id: string;
  type: 'photo' | 'video';
  blob: Blob;
  thumbnail_blob: Blob | null;
  mime: string;
  size_bytes: number;
  created_at: string;
}

export type SyncStatus = 'pending' | 'synced' | 'error';

export interface ItemResult {
  item_id: string;
  title_snapshot: string;
  checked: boolean;
  note: string;
}

export interface Run {
  id: string;
  checklist_id: string;
  checklist_name_snapshot: string;
  user_name: string;
  started_at: string;
  finished_at: string;
  notes: string;
  item_results: ItemResult[];
  sync_status: SyncStatus;
  last_error: string | null;
  attempt_count: number;
}

export interface Settings {
  id: 'singleton';
  users: string[];
  language: Lang;
  endpoint_url: string;
  shared_secret: string;
  device_name: string;
}

export class TrailerDB extends Dexie {
  checklists!: Table<Checklist, string>;
  items!: Table<Item, string>;
  media!: Table<Media, string>;
  runs!: Table<Run, string>;
  settings!: Table<Settings, string>;

  constructor() {
    super('trailer-checklist');
    this.version(1).stores({
      checklists: 'id, updated_at',
      items: 'id, checklist_id',
      media: 'id',
      runs: 'id, sync_status, finished_at',
      settings: 'id',
    });
  }
}

export const db = new TrailerDB();
```

- [ ] **Step 5: Run, verify pass**

Run: `npm test`
Expected: all passing.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: dexie schema + types"
```

---

## Task 5: Repository helpers (CRUD wrappers)

**Files:**
- Create: `src/lib/db/repos.ts`
- Modify: `tests/unit/repos.test.ts`

- [ ] **Step 1: Extend `tests/unit/repos.test.ts`** with repo tests

Append to `tests/unit/repos.test.ts`:

```ts
import {
  createChecklist,
  listChecklists,
  addItem,
  listItems,
  saveRun,
  pendingRuns,
  updateRunStatus,
  getSettings,
  saveSettings,
} from '$lib/db/repos';

describe('checklists repo', () => {
  it('creates and lists checklists', async () => {
    await createChecklist({ name_en: 'Leaving', name_is: 'Brottför' });
    const list = await listChecklists();
    expect(list).toHaveLength(1);
    expect(list[0].name_en).toBe('Leaving');
    expect(list[0].item_order).toEqual([]);
    expect(list[0].id).toBeTruthy();
  });
});

describe('items repo', () => {
  it('adds an item and updates checklist order', async () => {
    const cl = await createChecklist({ name_en: 'A', name_is: 'A' });
    const it = await addItem(cl.id, {
      title_en: 'Empty tank', title_is: 'Tæma tank',
      instructions_en: '', instructions_is: '', media_ids: [],
    });
    const items = await listItems(cl.id);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe(it.id);
    const after = await listChecklists();
    expect(after[0].item_order).toEqual([it.id]);
  });
});

describe('runs repo', () => {
  it('saves a run as pending and lists it', async () => {
    const cl = await createChecklist({ name_en: 'X', name_is: 'X' });
    const run = await saveRun({
      checklist_id: cl.id,
      checklist_name_snapshot: 'X',
      user_name: 'Kári',
      started_at: '2026-06-16T10:00:00Z',
      finished_at: '2026-06-16T10:05:00Z',
      notes: '',
      item_results: [],
    });
    expect(run.sync_status).toBe('pending');
    const pending = await pendingRuns();
    expect(pending.map((r) => r.id)).toContain(run.id);
  });

  it('updates run status', async () => {
    const cl = await createChecklist({ name_en: 'X', name_is: 'X' });
    const run = await saveRun({
      checklist_id: cl.id, checklist_name_snapshot: 'X', user_name: 'A',
      started_at: 't', finished_at: 't', notes: '', item_results: [],
    });
    await updateRunStatus(run.id, { sync_status: 'synced' });
    const pending = await pendingRuns();
    expect(pending.map((r) => r.id)).not.toContain(run.id);
  });
});

describe('settings repo', () => {
  it('returns defaults when no settings exist', async () => {
    const s = await getSettings();
    expect(s.id).toBe('singleton');
    expect(s.language).toBe('en');
    expect(s.users).toEqual([]);
  });

  it('persists updates', async () => {
    await saveSettings({ language: 'is', users: ['Anna', 'Kári'] });
    const s = await getSettings();
    expect(s.language).toBe('is');
    expect(s.users).toEqual(['Anna', 'Kári']);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test`
Expected: FAIL on imports from `$lib/db/repos`.

- [ ] **Step 3: Implement repos**

Create `src/lib/db/repos.ts`:

```ts
import { db, type Checklist, type Item, type Run, type Settings } from './schema';
import { uuid } from '$lib/utils/uuid';

const now = () => new Date().toISOString();

export async function createChecklist(input: { name_en: string; name_is: string }): Promise<Checklist> {
  const cl: Checklist = {
    id: uuid(),
    name_en: input.name_en,
    name_is: input.name_is,
    item_order: [],
    created_at: now(),
    updated_at: now(),
  };
  await db.checklists.add(cl);
  return cl;
}

export async function listChecklists(): Promise<Checklist[]> {
  return db.checklists.toArray();
}

export async function getChecklist(id: string): Promise<Checklist | undefined> {
  return db.checklists.get(id);
}

export async function updateChecklist(id: string, patch: Partial<Checklist>): Promise<void> {
  await db.checklists.update(id, { ...patch, updated_at: now() });
}

export async function deleteChecklist(id: string): Promise<void> {
  await db.transaction('rw', db.checklists, db.items, async () => {
    await db.items.where('checklist_id').equals(id).delete();
    await db.checklists.delete(id);
  });
}

export async function addItem(
  checklist_id: string,
  input: Omit<Item, 'id' | 'checklist_id'>,
): Promise<Item> {
  const it: Item = { id: uuid(), checklist_id, ...input };
  await db.transaction('rw', db.items, db.checklists, async () => {
    await db.items.add(it);
    const cl = await db.checklists.get(checklist_id);
    if (cl) {
      cl.item_order = [...cl.item_order, it.id];
      cl.updated_at = now();
      await db.checklists.put(cl);
    }
  });
  return it;
}

export async function listItems(checklist_id: string): Promise<Item[]> {
  const cl = await db.checklists.get(checklist_id);
  if (!cl) return [];
  const items = await db.items.where('checklist_id').equals(checklist_id).toArray();
  const byId = new Map(items.map((i) => [i.id, i]));
  return cl.item_order.map((id) => byId.get(id)).filter((i): i is Item => Boolean(i));
}

export async function updateItem(id: string, patch: Partial<Item>): Promise<void> {
  await db.items.update(id, patch);
}

export async function deleteItem(id: string): Promise<void> {
  const it = await db.items.get(id);
  if (!it) return;
  await db.transaction('rw', db.items, db.checklists, async () => {
    await db.items.delete(id);
    const cl = await db.checklists.get(it.checklist_id);
    if (cl) {
      cl.item_order = cl.item_order.filter((x) => x !== id);
      cl.updated_at = now();
      await db.checklists.put(cl);
    }
  });
}

export async function reorderItems(checklist_id: string, order: string[]): Promise<void> {
  await db.checklists.update(checklist_id, { item_order: order, updated_at: now() });
}

export async function saveRun(input: Omit<Run, 'id' | 'sync_status' | 'last_error' | 'attempt_count'>): Promise<Run> {
  const r: Run = {
    id: uuid(),
    sync_status: 'pending',
    last_error: null,
    attempt_count: 0,
    ...input,
  };
  await db.runs.add(r);
  return r;
}

export async function pendingRuns(): Promise<Run[]> {
  return db.runs.where('sync_status').equals('pending').toArray();
}

export async function updateRunStatus(id: string, patch: Partial<Pick<Run, 'sync_status' | 'last_error' | 'attempt_count'>>): Promise<void> {
  await db.runs.update(id, patch);
}

export async function listRuns(): Promise<Run[]> {
  return db.runs.orderBy('finished_at').reverse().toArray();
}

const DEFAULT_SETTINGS: Settings = {
  id: 'singleton',
  users: [],
  language: 'en',
  endpoint_url: '',
  shared_secret: '',
  device_name: 'tablet',
};

export async function getSettings(): Promise<Settings> {
  const s = await db.settings.get('singleton');
  return s ?? DEFAULT_SETTINGS;
}

export async function saveSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<Settings> {
  const current = await getSettings();
  const merged: Settings = { ...current, ...patch, id: 'singleton' };
  await db.settings.put(merged);
  return merged;
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npm test`
Expected: all repo tests passing.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: db repos for checklists, items, runs, settings"
```

---

## Task 6: i18n module

**Files:**
- Create: `src/lib/i18n/en.ts`, `src/lib/i18n/is.ts`, `src/lib/i18n/store.ts`
- Test: `tests/unit/i18n.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/unit/i18n.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { language, t } from '$lib/i18n/store';

describe('i18n', () => {
  it('returns english string by default', () => {
    language.set('en');
    expect(get(t)('home.title')).toBe('Trailer Checklist');
  });

  it('returns icelandic when language is is', () => {
    language.set('is');
    expect(get(t)('home.title')).toBe('Gátlisti');
  });

  it('falls back to key when missing', () => {
    language.set('en');
    expect(get(t)('does.not.exist')).toBe('does.not.exist');
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test`
Expected: FAIL on imports from `$lib/i18n/store`.

- [ ] **Step 3: Implement English strings**

Create `src/lib/i18n/en.ts`:

```ts
export const en = {
  'home.title': 'Trailer Checklist',
  'home.empty': 'No checklists yet. Tap the gear to add one.',
  'home.pending': '{n} pending',
  'home.offline': 'Offline',
  'home.online': 'Online',
  'pickUser.title': 'Who are you?',
  'pickUser.empty': 'No users configured. Add them in Settings.',
  'run.openInstructions': 'Open instructions',
  'run.submit': 'Submit',
  'item.note': 'Note for this item',
  'item.done': 'Done',
  'submit.title': 'Submit checklist',
  'submit.runNotes': 'Notes (optional)',
  'submit.confirm': 'Submit',
  'submit.queued': 'Saved. Will sync when online.',
  'submit.synced': 'Submitted ✓',
  'edit.title': 'Edit',
  'edit.checklists': 'Checklists',
  'edit.addChecklist': 'Add checklist',
  'edit.addItem': 'Add item',
  'edit.delete': 'Delete',
  'edit.confirmDelete': 'Delete this?',
  'editItem.title.en': 'Title (English)',
  'editItem.title.is': 'Title (Icelandic)',
  'editItem.instructions.en': 'Instructions (English)',
  'editItem.instructions.is': 'Instructions (Icelandic)',
  'editItem.media': 'Photos & videos',
  'editItem.addPhoto': 'Add photo',
  'editItem.addVideo': 'Add video',
  'settings.title': 'Settings',
  'settings.users': 'Users',
  'settings.addUser': 'Add user',
  'settings.language': 'Language',
  'settings.endpoint': 'Sheets endpoint URL',
  'settings.secret': 'Shared secret',
  'settings.forceSync': 'Force sync now',
  'settings.queue': 'Pending submissions',
  'settings.storage': 'Storage used',
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.back': 'Back',
  'common.yes': 'Yes',
  'common.no': 'No',
} as const;

export type Key = keyof typeof en;
```

- [ ] **Step 4: Implement Icelandic strings**

Create `src/lib/i18n/is.ts`:

```ts
import type { Key } from './en';

export const is: Record<Key, string> = {
  'home.title': 'Gátlisti',
  'home.empty': 'Engir gátlistar ennþá. Smelltu á tannhjólið til að bæta við.',
  'home.pending': '{n} bíða',
  'home.offline': 'Án nets',
  'home.online': 'Tengt',
  'pickUser.title': 'Hver ert þú?',
  'pickUser.empty': 'Engir notendur skráðir. Bættu þeim við í Stillingum.',
  'run.openInstructions': 'Opna leiðbeiningar',
  'run.submit': 'Senda',
  'item.note': 'Athugasemd',
  'item.done': 'Lokið',
  'submit.title': 'Senda gátlista',
  'submit.runNotes': 'Athugasemdir (valfrjálst)',
  'submit.confirm': 'Senda',
  'submit.queued': 'Vistað. Sendist þegar net næst.',
  'submit.synced': 'Sent ✓',
  'edit.title': 'Breyta',
  'edit.checklists': 'Gátlistar',
  'edit.addChecklist': 'Nýr gátlisti',
  'edit.addItem': 'Bæta við lið',
  'edit.delete': 'Eyða',
  'edit.confirmDelete': 'Eyða þessu?',
  'editItem.title.en': 'Titill (Enska)',
  'editItem.title.is': 'Titill (Íslenska)',
  'editItem.instructions.en': 'Leiðbeiningar (Enska)',
  'editItem.instructions.is': 'Leiðbeiningar (Íslenska)',
  'editItem.media': 'Myndir og myndbönd',
  'editItem.addPhoto': 'Bæta við mynd',
  'editItem.addVideo': 'Bæta við myndbandi',
  'settings.title': 'Stillingar',
  'settings.users': 'Notendur',
  'settings.addUser': 'Bæta við notanda',
  'settings.language': 'Tungumál',
  'settings.endpoint': 'Slóð á Sheets',
  'settings.secret': 'Sameiginlegt leyniorð',
  'settings.forceSync': 'Samstilla núna',
  'settings.queue': 'Bíða sendingar',
  'settings.storage': 'Notað geymslupláss',
  'common.save': 'Vista',
  'common.cancel': 'Hætta við',
  'common.back': 'Til baka',
  'common.yes': 'Já',
  'common.no': 'Nei',
};
```

- [ ] **Step 5: Implement store**

Create `src/lib/i18n/store.ts`:

```ts
import { derived, writable } from 'svelte/store';
import { en, type Key } from './en';
import { is } from './is';

export type Lang = 'en' | 'is';
export const language = writable<Lang>('en');

const tables: Record<Lang, Record<string, string>> = { en, is };

export const t = derived(language, ($lang) => {
  return (key: string, vars: Record<string, string | number> = {}): string => {
    const raw = tables[$lang][key] ?? tables.en[key] ?? key;
    return Object.entries(vars).reduce(
      (acc, [k, v]) => acc.replace(`{${k}}`, String(v)),
      raw,
    );
  };
});

export type TFn = (key: Key | string, vars?: Record<string, string | number>) => string;
```

- [ ] **Step 6: Run, verify pass**

Run: `npm test`
Expected: i18n tests passing.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: i18n module with EN/IS strings"
```

---

## Task 7: Payload serializer

**Files:**
- Create: `src/lib/sync/payload.ts`
- Test: `tests/unit/payload.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/unit/payload.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { toPayload } from '$lib/sync/payload';
import type { Run } from '$lib/db/schema';

const run: Run = {
  id: 'run-1',
  checklist_id: 'cl-1',
  checklist_name_snapshot: 'Leaving',
  user_name: 'Kári',
  started_at: '2026-06-16T09:00:00Z',
  finished_at: '2026-06-16T09:12:00Z',
  notes: 'Topped up gas',
  item_results: [
    { item_id: 'i1', title_snapshot: 'Empty tank', checked: true, note: '' },
    { item_id: 'i2', title_snapshot: 'Lock door', checked: false, note: 'broken' },
  ],
  sync_status: 'pending',
  last_error: null,
  attempt_count: 0,
};

describe('toPayload', () => {
  it('flattens run to the Sheets row shape', () => {
    const p = toPayload(run);
    expect(p).toEqual({
      run_id: 'run-1',
      timestamp: '2026-06-16T09:12:00Z',
      user: 'Kári',
      checklist: 'Leaving',
      notes: 'Topped up gas',
      items_json: JSON.stringify([
        { t: 'Empty tank', c: true, n: '' },
        { t: 'Lock door', c: false, n: 'broken' },
      ]),
    });
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test`
Expected: FAIL "Cannot find module '$lib/sync/payload'".

- [ ] **Step 3: Implement**

Create `src/lib/sync/payload.ts`:

```ts
import type { Run } from '$lib/db/schema';

export interface SheetsPayload {
  run_id: string;
  timestamp: string;
  user: string;
  checklist: string;
  notes: string;
  items_json: string;
}

export function toPayload(run: Run): SheetsPayload {
  return {
    run_id: run.id,
    timestamp: run.finished_at,
    user: run.user_name,
    checklist: run.checklist_name_snapshot,
    notes: run.notes,
    items_json: JSON.stringify(
      run.item_results.map((r) => ({ t: r.title_snapshot, c: r.checked, n: r.note })),
    ),
  };
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: run-to-sheets-payload serializer"
```

---

## Task 8: Retry/backoff state machine

**Files:**
- Create: `src/lib/sync/backoff.ts`
- Test: `tests/unit/backoff.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/backoff.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { nextDelayMs, MAX_ATTEMPTS, isTerminal } from '$lib/sync/backoff';

describe('backoff', () => {
  it('produces increasing delays capped at 5 minutes', () => {
    expect(nextDelayMs(0)).toBe(1_000);
    expect(nextDelayMs(1)).toBe(2_000);
    expect(nextDelayMs(2)).toBe(4_000);
    expect(nextDelayMs(8)).toBe(256_000);
    expect(nextDelayMs(20)).toBe(300_000);
  });

  it('isTerminal after MAX_ATTEMPTS attempts', () => {
    expect(MAX_ATTEMPTS).toBe(10);
    expect(isTerminal(MAX_ATTEMPTS - 1)).toBe(false);
    expect(isTerminal(MAX_ATTEMPTS)).toBe(true);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test`
Expected: FAIL on imports.

- [ ] **Step 3: Implement**

Create `src/lib/sync/backoff.ts`:

```ts
export const MAX_ATTEMPTS = 10;
const BASE_MS = 1_000;
const CAP_MS = 5 * 60 * 1_000;

export function nextDelayMs(attempt: number): number {
  return Math.min(BASE_MS * 2 ** attempt, CAP_MS);
}

export function isTerminal(attempt: number): boolean {
  return attempt >= MAX_ATTEMPTS;
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: retry/backoff state machine"
```

---

## Task 9: Sync client (Apps Script POST)

**Files:**
- Create: `src/lib/sync/client.ts`
- Test: `tests/unit/queue.test.ts` (just client tests for now)

- [ ] **Step 1: Write failing tests**

Create `tests/unit/queue.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { postRun, SyncResult } from '$lib/sync/client';

describe('postRun', () => {
  beforeEach(() => vi.restoreAllMocks());

  const payload = {
    run_id: 'r1', timestamp: 't', user: 'u',
    checklist: 'c', notes: '', items_json: '[]',
  };

  it('returns ok on 200 { ok: true }', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ ok: true, row: 7 }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )));
    const r: SyncResult = await postRun('https://example/exec', 'sek', payload);
    expect(r).toEqual({ status: 'ok' });
  });

  it('returns retry on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const r = await postRun('https://example/exec', 'sek', payload);
    expect(r.status).toBe('retry');
  });

  it('returns retry on 5xx', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('boom', { status: 503 })));
    const r = await postRun('https://example/exec', 'sek', payload);
    expect(r.status).toBe('retry');
  });

  it('returns fatal on 4xx', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ ok: false, error: 'bad secret' }),
      { status: 401, headers: { 'content-type': 'application/json' } },
    )));
    const r = await postRun('https://example/exec', 'sek', payload);
    expect(r.status).toBe('fatal');
    if (r.status === 'fatal') expect(r.error).toContain('bad secret');
  });

  it('sends the shared secret in the JSON body', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ ok: true, row: 1 }), {
      status: 200, headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', f);
    await postRun('https://example/exec', 'super-secret', payload);
    const init = f.mock.calls[0][1];
    const sent = JSON.parse(init.body);
    expect(sent.secret).toBe('super-secret');
    expect(sent.run_id).toBe('r1');
    expect(init.method).toBe('POST');
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test`
Expected: FAIL on imports from `$lib/sync/client`.

- [ ] **Step 3: Implement**

Create `src/lib/sync/client.ts`:

```ts
import type { SheetsPayload } from './payload';

export type SyncResult =
  | { status: 'ok' }
  | { status: 'retry'; error: string }
  | { status: 'fatal'; error: string };

export async function postRun(
  url: string,
  secret: string,
  payload: SheetsPayload,
): Promise<SyncResult> {
  if (!url) return { status: 'fatal', error: 'endpoint not configured' };
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, secret }),
    });
  } catch (e) {
    return { status: 'retry', error: String((e as Error).message ?? e) };
  }
  if (res.status >= 500) return { status: 'retry', error: `HTTP ${res.status}` };
  let body: { ok?: boolean; error?: string } = {};
  try { body = await res.json(); } catch { /* non-JSON */ }
  if (res.ok && body.ok) return { status: 'ok' };
  if (res.status >= 400 && res.status < 500) {
    return { status: 'fatal', error: body.error ?? `HTTP ${res.status}` };
  }
  return { status: 'retry', error: body.error ?? `HTTP ${res.status}` };
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: sync client with status classification"
```

---

## Task 10: Queue runner

**Files:**
- Create: `src/lib/sync/queue.ts`
- Modify: `tests/unit/queue.test.ts`

- [ ] **Step 1: Append queue tests to `tests/unit/queue.test.ts`**

```ts
import { runQueue } from '$lib/sync/queue';
import { saveRun, saveSettings, pendingRuns } from '$lib/db/repos';
import { createChecklist } from '$lib/db/repos';

describe('runQueue', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await saveSettings({ endpoint_url: 'https://example/exec', shared_secret: 'sek' });
  });

  it('marks pending runs synced when client returns ok', async () => {
    const cl = await createChecklist({ name_en: 'A', name_is: 'A' });
    await saveRun({
      checklist_id: cl.id, checklist_name_snapshot: 'A',
      user_name: 'k', started_at: 't', finished_at: 't',
      notes: '', item_results: [],
    });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ ok: true, row: 1 }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )));
    const summary = await runQueue();
    expect(summary).toEqual({ ok: 1, retry: 0, fatal: 0 });
    expect(await pendingRuns()).toHaveLength(0);
  });

  it('leaves pending runs pending on retry', async () => {
    const cl = await createChecklist({ name_en: 'A', name_is: 'A' });
    await saveRun({
      checklist_id: cl.id, checklist_name_snapshot: 'A',
      user_name: 'k', started_at: 't', finished_at: 't',
      notes: '', item_results: [],
    });
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const summary = await runQueue();
    expect(summary).toEqual({ ok: 0, retry: 1, fatal: 0 });
    expect((await pendingRuns())[0].attempt_count).toBe(1);
  });

  it('marks fatal runs as error', async () => {
    const cl = await createChecklist({ name_en: 'A', name_is: 'A' });
    await saveRun({
      checklist_id: cl.id, checklist_name_snapshot: 'A',
      user_name: 'k', started_at: 't', finished_at: 't',
      notes: '', item_results: [],
    });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ ok: false, error: 'unauthorized' }),
      { status: 401, headers: { 'content-type': 'application/json' } },
    )));
    await runQueue();
    expect(await pendingRuns()).toHaveLength(0);
  });

  it('skips when endpoint not configured', async () => {
    await saveSettings({ endpoint_url: '', shared_secret: '' });
    const cl = await createChecklist({ name_en: 'A', name_is: 'A' });
    await saveRun({
      checklist_id: cl.id, checklist_name_snapshot: 'A',
      user_name: 'k', started_at: 't', finished_at: 't',
      notes: '', item_results: [],
    });
    const summary = await runQueue();
    expect(summary.ok).toBe(0);
    expect(summary.retry).toBe(1);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test`
Expected: FAIL on imports from `$lib/sync/queue`.

- [ ] **Step 3: Implement**

Create `src/lib/sync/queue.ts`:

```ts
import { pendingRuns, updateRunStatus, getSettings } from '$lib/db/repos';
import { postRun } from './client';
import { toPayload } from './payload';
import { isTerminal } from './backoff';

export interface QueueSummary {
  ok: number;
  retry: number;
  fatal: number;
}

export async function runQueue(): Promise<QueueSummary> {
  const settings = await getSettings();
  const runs = await pendingRuns();
  const summary: QueueSummary = { ok: 0, retry: 0, fatal: 0 };

  for (const run of runs) {
    if (!settings.endpoint_url) {
      await updateRunStatus(run.id, {
        attempt_count: run.attempt_count + 1,
        last_error: 'endpoint not configured',
      });
      summary.retry++;
      continue;
    }

    const result = await postRun(settings.endpoint_url, settings.shared_secret, toPayload(run));
    if (result.status === 'ok') {
      await updateRunStatus(run.id, { sync_status: 'synced', last_error: null });
      summary.ok++;
    } else if (result.status === 'fatal') {
      await updateRunStatus(run.id, { sync_status: 'error', last_error: result.error });
      summary.fatal++;
    } else {
      const attempts = run.attempt_count + 1;
      const terminal = isTerminal(attempts);
      await updateRunStatus(run.id, {
        attempt_count: attempts,
        last_error: result.error,
        sync_status: terminal ? 'error' : 'pending',
      });
      if (terminal) summary.fatal++;
      else summary.retry++;
    }
  }

  return summary;
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npm test`
Expected: PASS for queue tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: queue runner with retry classification"
```

---

## Task 11: Network and pending stores

**Files:**
- Create: `src/lib/stores/network.ts`, `src/lib/stores/pending.ts`
- Test: `tests/unit/queue.test.ts` (extend), `tests/unit/network.test.ts`

- [ ] **Step 1: Write network test**

Create `tests/unit/network.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { online } from '$lib/stores/network';

describe('network store', () => {
  it('reflects navigator.onLine on init', () => {
    expect(typeof get(online)).toBe('boolean');
  });

  it('updates on online event', () => {
    window.dispatchEvent(new Event('offline'));
    expect(get(online)).toBe(false);
    window.dispatchEvent(new Event('online'));
    expect(get(online)).toBe(true);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test`
Expected: FAIL on import.

- [ ] **Step 3: Implement network store**

Create `src/lib/stores/network.ts`:

```ts
import { readable } from 'svelte/store';

export const online = readable<boolean>(
  typeof navigator !== 'undefined' ? navigator.onLine : true,
  (set) => {
    if (typeof window === 'undefined') return;
    const on = () => set(true);
    const off = () => set(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  },
);
```

- [ ] **Step 4: Implement pending store**

Create `src/lib/stores/pending.ts`:

```ts
import { writable } from 'svelte/store';
import { pendingRuns } from '$lib/db/repos';

const _pending = writable<number>(0);

export const pending = { subscribe: _pending.subscribe };

export async function refreshPending(): Promise<void> {
  const list = await pendingRuns();
  _pending.set(list.length);
}
```

- [ ] **Step 5: Run, verify pass**

Run: `npm test`
Expected: PASS network tests.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: network and pending-count stores"
```

---

## Task 12: Settings + screen stores

**Files:**
- Create: `src/lib/stores/settings.ts`, `src/lib/stores/screen.ts`

- [ ] **Step 1: Implement settings store**

Create `src/lib/stores/settings.ts`:

```ts
import { writable } from 'svelte/store';
import { getSettings, saveSettings } from '$lib/db/repos';
import { language } from '$lib/i18n/store';
import type { Settings } from '$lib/db/schema';

const _settings = writable<Settings | null>(null);
export const settings = { subscribe: _settings.subscribe };

export async function loadSettings(): Promise<void> {
  const s = await getSettings();
  _settings.set(s);
  language.set(s.language);
}

export async function updateSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<void> {
  const updated = await saveSettings(patch);
  _settings.set(updated);
  if (patch.language) language.set(patch.language);
}
```

- [ ] **Step 2: Implement screen store**

Create `src/lib/stores/screen.ts`:

```ts
import { writable } from 'svelte/store';

export type Screen =
  | { name: 'home' }
  | { name: 'pickUser'; checklistId: string }
  | { name: 'run'; checklistId: string; user: string }
  | { name: 'item'; checklistId: string; itemId: string; user: string }
  | { name: 'submit'; runId: string }
  | { name: 'editList' }
  | { name: 'editChecklist'; checklistId: string }
  | { name: 'editItem'; checklistId: string; itemId: string }
  | { name: 'settings' };

const stack = writable<Screen[]>([{ name: 'home' }]);
export const screenStack = { subscribe: stack.subscribe };

export const currentScreen = {
  subscribe: (run: (value: Screen) => void) =>
    stack.subscribe((s) => run(s[s.length - 1])),
};

export function navigate(s: Screen) {
  stack.update((cur) => [...cur, s]);
}

export function back() {
  stack.update((cur) => (cur.length > 1 ? cur.slice(0, -1) : cur));
}

export function reset(s: Screen = { name: 'home' }) {
  stack.set([s]);
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: settings and screen stack stores"
```

---

## Task 13: Long-press Svelte action

**Files:**
- Create: `src/lib/utils/longpress.ts`
- Test: `tests/unit/longpress.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/unit/longpress.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { longpress } from '$lib/utils/longpress';

describe('longpress', () => {
  it('dispatches longpress event after duration', async () => {
    vi.useFakeTimers();
    const el = document.createElement('button');
    document.body.appendChild(el);
    const handler = vi.fn();
    el.addEventListener('longpress', handler);
    longpress(el, 1500);
    el.dispatchEvent(new PointerEvent('pointerdown'));
    vi.advanceTimersByTime(1499);
    expect(handler).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2);
    expect(handler).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('cancels on pointerup before duration', async () => {
    vi.useFakeTimers();
    const el = document.createElement('button');
    const handler = vi.fn();
    el.addEventListener('longpress', handler);
    longpress(el, 1500);
    el.dispatchEvent(new PointerEvent('pointerdown'));
    el.dispatchEvent(new PointerEvent('pointerup'));
    vi.advanceTimersByTime(2000);
    expect(handler).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test`
Expected: FAIL on import.

- [ ] **Step 3: Implement**

Create `src/lib/utils/longpress.ts`:

```ts
export function longpress(node: HTMLElement, duration = 1500) {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const start = () => {
    timer = setTimeout(() => {
      node.dispatchEvent(new CustomEvent('longpress'));
      timer = null;
    }, duration);
  };
  const cancel = () => {
    if (timer) { clearTimeout(timer); timer = null; }
  };

  node.addEventListener('pointerdown', start);
  node.addEventListener('pointerup', cancel);
  node.addEventListener('pointerleave', cancel);
  node.addEventListener('pointercancel', cancel);

  return {
    destroy() {
      cancel();
      node.removeEventListener('pointerdown', start);
      node.removeEventListener('pointerup', cancel);
      node.removeEventListener('pointerleave', cancel);
      node.removeEventListener('pointercancel', cancel);
    },
  };
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: longpress svelte action"
```

---

## Task 14: Media utilities (compression + size guard)

**Files:**
- Create: `src/lib/utils/media.ts`
- Test: `tests/unit/media.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/unit/media.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { validateVideo, photoMimeOK } from '$lib/utils/media';

describe('media validation', () => {
  it('photoMimeOK accepts common image types', () => {
    expect(photoMimeOK('image/jpeg')).toBe(true);
    expect(photoMimeOK('image/png')).toBe(true);
    expect(photoMimeOK('image/webp')).toBe(true);
    expect(photoMimeOK('video/mp4')).toBe(false);
  });

  it('validateVideo warns when too large', () => {
    const sixMB = 6 * 1024 * 1024;
    const result = validateVideo({ size: sixMB, type: 'video/mp4' } as File);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/size/i);
  });

  it('validateVideo accepts small mp4', () => {
    const r = validateVideo({ size: 2 * 1024 * 1024, type: 'video/mp4' } as File);
    expect(r.ok).toBe(true);
  });

  it('validateVideo rejects non-video mime', () => {
    const r = validateVideo({ size: 100, type: 'application/pdf' } as File);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/mime/i);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test`
Expected: FAIL on import.

- [ ] **Step 3: Implement**

Create `src/lib/utils/media.ts`:

```ts
export const MAX_PHOTO_DIM = 1600;
export const PHOTO_QUALITY = 0.82;
export const MAX_VIDEO_BYTES = 5 * 1024 * 1024;
export const VIDEO_MIME_PREFIX = 'video/';

export function photoMimeOK(mime: string): boolean {
  return mime === 'image/jpeg' || mime === 'image/png' || mime === 'image/webp';
}

export interface ValidationResult {
  ok: boolean;
  reason?: string;
}

export function validateVideo(file: File): ValidationResult {
  if (!file.type.startsWith(VIDEO_MIME_PREFIX)) {
    return { ok: false, reason: `Unsupported mime: ${file.type}` };
  }
  if (file.size > MAX_VIDEO_BYTES) {
    return { ok: false, reason: `Video size ${(file.size / 1024 / 1024).toFixed(1)}MB exceeds 5MB limit` };
  }
  return { ok: true };
}

export async function compressPhoto(file: File): Promise<{ blob: Blob; mime: string; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, MAX_PHOTO_DIM / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * ratio);
  const height = Math.round(bitmap.height * ratio);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, width, height);

  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
      'image/jpeg',
      PHOTO_QUALITY,
    ),
  );
  return { blob, mime: 'image/jpeg', width, height };
}

export async function videoThumbnail(file: File): Promise<Blob | null> {
  if (!file.type.startsWith('video/')) return null;
  const video = document.createElement('video');
  video.src = URL.createObjectURL(file);
  video.muted = true;
  await video.play().catch(() => undefined);
  await new Promise((r) => setTimeout(r, 250));
  video.pause();
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth || 320;
  canvas.height = video.videoHeight || 240;
  canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(video.src);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.75));
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: media validation + compression utilities"
```

---

## Task 15: Header component

**Files:**
- Create: `src/lib/components/Header.svelte`
- Test: `tests/component/Header.test.ts`

- [ ] **Step 1: Write component test**

Create `tests/component/Header.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import Header from '$lib/components/Header.svelte';
import { language } from '$lib/i18n/store';
import { get } from 'svelte/store';

describe('Header', () => {
  it('renders the title key', () => {
    language.set('en');
    render(Header, { props: { title: 'Trailer Checklist', pending: 0, online: true } });
    expect(screen.getByText('Trailer Checklist')).toBeInTheDocument();
  });

  it('toggles language when clicking IS button', async () => {
    language.set('en');
    render(Header, { props: { title: 'x', pending: 0, online: true } });
    await fireEvent.click(screen.getByRole('button', { name: 'IS' }));
    expect(get(language)).toBe('is');
  });

  it('shows pending badge when pending > 0', () => {
    render(Header, { props: { title: 'x', pending: 3, online: true } });
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test`
Expected: FAIL — Header doesn't exist.

- [ ] **Step 3: Implement**

Create `src/lib/components/Header.svelte`:

```svelte
<script lang="ts">
  import { language } from '$lib/i18n/store';

  export let title: string;
  export let pending: number = 0;
  export let online: boolean = true;
  export let onBack: (() => void) | null = null;

  function setLang(l: 'en' | 'is') { language.set(l); }
</script>

<header>
  <div class="left">
    {#if onBack}
      <button class="back" on:click={onBack} aria-label="Back">←</button>
    {/if}
    <h1>{title}</h1>
  </div>
  <div class="right">
    {#if pending > 0}
      <span class="badge" title="Pending">{pending}</span>
    {/if}
    <span class="dot" class:online aria-label={online ? 'Online' : 'Offline'} />
    <div class="lang" role="group" aria-label="Language">
      <button class:active={$language === 'en'} on:click={() => setLang('en')}>EN</button>
      <button class:active={$language === 'is'} on:click={() => setLang('is')}>IS</button>
    </div>
  </div>
</header>

<style>
  header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 16px; background: var(--surface);
    border-bottom: 1px solid var(--border); position: sticky; top: 0; z-index: 10;
  }
  .left, .right { display: flex; align-items: center; gap: 10px; }
  h1 { margin: 0; font-size: 20px; }
  .back { background: transparent; color: var(--text); border: 0; font-size: 24px; padding: 4px 8px; }
  .badge {
    background: var(--warn); color: #000; border-radius: 999px;
    padding: 2px 8px; font-size: 13px; font-weight: 600;
  }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--err); }
  .dot.online { background: var(--ok); }
  .lang { display: flex; gap: 4px; }
  .lang button {
    background: transparent; color: var(--muted); border: 1px solid var(--border);
    border-radius: 8px; padding: 4px 10px; min-height: auto; font-size: 13px;
  }
  .lang .active { background: var(--surface-2); color: var(--text); border-color: var(--accent); }
</style>
```

- [ ] **Step 4: Run, verify pass**

Run: `npm test`
Expected: Header tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: Header component with lang toggle and pending badge"
```

---

## Task 16: LangTabs component (EN/IS tabbed input)

**Files:**
- Create: `src/lib/components/LangTabs.svelte`
- Test: `tests/component/LangTabs.test.ts`

- [ ] **Step 1: Write component test**

Create `tests/component/LangTabs.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import LangTabs from '$lib/components/LangTabs.svelte';

describe('LangTabs', () => {
  it('binds EN value and switches to IS', async () => {
    const { component } = render(LangTabs, {
      props: { en: 'hello', is: 'halló', label: 'Title', multiline: false },
    });
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('hello');
    await fireEvent.click(screen.getByRole('button', { name: 'IS' }));
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('halló');
  });

  it('emits update events when typing', async () => {
    const { component } = render(LangTabs, {
      props: { en: '', is: '', label: 'L', multiline: false },
    });
    let lastEvent: { en: string; is: string } | null = null;
    component.$on('change', (e) => { lastEvent = e.detail; });
    const input = screen.getByRole('textbox') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'A' } });
    expect(lastEvent).toEqual({ en: 'A', is: '' });
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test`
Expected: FAIL — component missing.

- [ ] **Step 3: Implement**

Create `src/lib/components/LangTabs.svelte`:

```svelte
<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let en: string = '';
  export let is: string = '';
  export let label: string = '';
  export let multiline: boolean = false;

  type Tab = 'en' | 'is';
  let tab: Tab = 'en';
  const dispatch = createEventDispatcher<{ change: { en: string; is: string } }>();

  function handle(e: Event) {
    const v = (e.target as HTMLInputElement | HTMLTextAreaElement).value;
    if (tab === 'en') en = v; else is = v;
    dispatch('change', { en, is });
  }
</script>

<label>
  {#if label}<span class="label">{label}</span>{/if}
  <div class="tabs">
    <button type="button" class:active={tab === 'en'} on:click={() => (tab = 'en')}>EN</button>
    <button type="button" class:active={tab === 'is'} on:click={() => (tab = 'is')}>IS</button>
  </div>
  {#if multiline}
    <textarea rows="4" value={tab === 'en' ? en : is} on:input={handle}></textarea>
  {:else}
    <input type="text" value={tab === 'en' ? en : is} on:input={handle} />
  {/if}
</label>

<style>
  label { display: block; margin-bottom: 14px; }
  .label { display: block; font-size: 13px; color: var(--muted); margin-bottom: 6px; }
  .tabs { display: flex; gap: 4px; margin-bottom: 6px; }
  .tabs button {
    background: transparent; color: var(--muted); border: 1px solid var(--border);
    border-radius: 8px; padding: 4px 10px; min-height: auto; font-size: 13px;
  }
  .tabs .active { background: var(--surface-2); color: var(--text); border-color: var(--accent); }
  input, textarea {
    width: 100%; background: var(--surface); color: var(--text);
    border: 1px solid var(--border); border-radius: 10px; padding: 12px;
    font: inherit; min-height: 48px;
  }
  textarea { resize: vertical; }
</style>
```

- [ ] **Step 4: Run, verify pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: LangTabs EN/IS tabbed input component"
```

---

## Task 17: Toast component

**Files:**
- Create: `src/lib/components/Toast.svelte`, `src/lib/stores/toast.ts`

- [ ] **Step 1: Create toast store**

Create `src/lib/stores/toast.ts`:

```ts
import { writable } from 'svelte/store';

export interface ToastMsg { id: number; text: string; tone: 'info' | 'ok' | 'warn' | 'err' }

const _toasts = writable<ToastMsg[]>([]);
export const toasts = { subscribe: _toasts.subscribe };
let nextId = 1;

export function showToast(text: string, tone: ToastMsg['tone'] = 'info', ms = 3000) {
  const id = nextId++;
  _toasts.update((cur) => [...cur, { id, text, tone }]);
  setTimeout(() => _toasts.update((cur) => cur.filter((t) => t.id !== id)), ms);
}
```

- [ ] **Step 2: Create Toast component**

Create `src/lib/components/Toast.svelte`:

```svelte
<script lang="ts">
  import { toasts } from '$lib/stores/toast';
</script>

<div class="stack">
  {#each $toasts as t (t.id)}
    <div class="toast" data-tone={t.tone}>{t.text}</div>
  {/each}
</div>

<style>
  .stack {
    position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%);
    display: flex; flex-direction: column; gap: 8px; z-index: 100; pointer-events: none;
  }
  .toast {
    background: var(--surface-2); color: var(--text);
    padding: 10px 16px; border-radius: 10px; box-shadow: 0 4px 16px rgba(0,0,0,0.4);
    font-size: 14px; border: 1px solid var(--border);
  }
  .toast[data-tone="ok"] { border-color: var(--ok); }
  .toast[data-tone="warn"] { border-color: var(--warn); }
  .toast[data-tone="err"] { border-color: var(--err); }
</style>
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: toast notification store + component"
```

---

## Task 18: Home screen

**Files:**
- Create: `src/screens/Home.svelte`
- Test: `tests/component/Home.test.ts`

- [ ] **Step 1: Write component test**

Create `tests/component/Home.test.ts`:

```ts
import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import Home from '$screens/Home.svelte';
import { language } from '$lib/i18n/store';
import { createChecklist } from '$lib/db/repos';
import { loadSettings } from '$lib/stores/settings';

describe('Home', () => {
  beforeEach(async () => {
    language.set('en');
    await loadSettings();
  });

  it('shows empty state when no checklists', async () => {
    render(Home);
    expect(await screen.findByText(/No checklists yet/i)).toBeInTheDocument();
  });

  it('lists checklists with EN name', async () => {
    await createChecklist({ name_en: 'Leaving', name_is: 'Brottför' });
    render(Home);
    expect(await screen.findByText('Leaving')).toBeInTheDocument();
  });

  it('renders icelandic name when language is IS', async () => {
    await createChecklist({ name_en: 'Leaving', name_is: 'Brottför' });
    language.set('is');
    render(Home);
    expect(await screen.findByText('Brottför')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/screens/Home.svelte`:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import Header from '$lib/components/Header.svelte';
  import { t, language } from '$lib/i18n/store';
  import { listChecklists } from '$lib/db/repos';
  import type { Checklist } from '$lib/db/schema';
  import { navigate } from '$lib/stores/screen';
  import { pending, refreshPending } from '$lib/stores/pending';
  import { online } from '$lib/stores/network';
  import { longpress } from '$lib/utils/longpress';

  let lists: Checklist[] = [];

  async function refresh() {
    lists = await listChecklists();
    await refreshPending();
  }

  onMount(refresh);

  function pickName(c: Checklist): string {
    return $language === 'is' ? (c.name_is || c.name_en) : (c.name_en || c.name_is);
  }
</script>

<Header title={$t('home.title')} pending={$pending} online={$online} />

<main>
  {#if lists.length === 0}
    <p class="empty">{$t('home.empty')}</p>
  {/if}

  <div class="tiles">
    {#each lists as cl (cl.id)}
      <button class="tile" on:click={() => navigate({ name: 'pickUser', checklistId: cl.id })}>
        {pickName(cl)}
      </button>
    {/each}
  </div>

  <button
    class="gear"
    aria-label="Edit"
    use:longpress={1500}
    on:longpress={() => navigate({ name: 'editList' })}
    on:click={() => navigate({ name: 'settings' })}
  >⚙️</button>
</main>

<style>
  main { padding: 16px; }
  .empty { color: var(--muted); text-align: center; padding: 32px 16px; }
  .tiles { display: grid; gap: 12px; grid-template-columns: 1fr 1fr; }
  .tile {
    background: var(--surface); color: var(--text); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 24px 12px; font-size: 18px; font-weight: 600;
    min-height: 110px;
  }
  .gear {
    position: fixed; bottom: 20px; right: 20px;
    width: 56px; height: 56px; border-radius: 50%;
    background: var(--surface-2); color: var(--text);
    border: 1px solid var(--border); font-size: 24px;
  }
</style>
```

- [ ] **Step 4: Run, verify pass**

Run: `npm test`
Expected: Home tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: Home screen with checklist tiles + edit/settings entry"
```

---

## Task 19: User picker screen

**Files:**
- Create: `src/screens/PickUser.svelte`

- [ ] **Step 1: Implement**

Create `src/screens/PickUser.svelte`:

```svelte
<script lang="ts">
  import Header from '$lib/components/Header.svelte';
  import { t } from '$lib/i18n/store';
  import { settings } from '$lib/stores/settings';
  import { navigate, back } from '$lib/stores/screen';

  export let checklistId: string;

  function pick(name: string) {
    navigate({ name: 'run', checklistId, user: name });
  }
</script>

<Header title={$t('pickUser.title')} onBack={back} />

<main>
  {#if !$settings || $settings.users.length === 0}
    <p class="empty">{$t('pickUser.empty')}</p>
  {:else}
    <div class="tiles">
      {#each $settings.users as u (u)}
        <button class="tile" on:click={() => pick(u)}>{u}</button>
      {/each}
    </div>
  {/if}
</main>

<style>
  main { padding: 16px; }
  .empty { color: var(--muted); text-align: center; padding: 32px 16px; }
  .tiles { display: grid; gap: 12px; grid-template-columns: 1fr 1fr; }
  .tile {
    background: var(--surface); color: var(--text); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 22px 12px; font-size: 17px;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: PickUser screen"
```

---

## Task 20: Run checklist screen

**Files:**
- Create: `src/screens/RunChecklist.svelte`
- Test: `tests/component/RunChecklist.test.ts`

- [ ] **Step 1: Write component test**

Create `tests/component/RunChecklist.test.ts`:

```ts
import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import RunChecklist from '$screens/RunChecklist.svelte';
import { createChecklist, addItem } from '$lib/db/repos';
import { language } from '$lib/i18n/store';

describe('RunChecklist', () => {
  beforeEach(() => language.set('en'));

  it('shows items and toggles checked state', async () => {
    const cl = await createChecklist({ name_en: 'Leaving', name_is: 'Brottför' });
    await addItem(cl.id, {
      title_en: 'Empty tank', title_is: 'Tæma tank',
      instructions_en: '', instructions_is: '', media_ids: [],
    });
    render(RunChecklist, { props: { checklistId: cl.id, user: 'A' } });
    const cb = await screen.findByRole('checkbox', { name: /Empty tank/ });
    expect((cb as HTMLInputElement).checked).toBe(false);
    await fireEvent.click(cb);
    expect((cb as HTMLInputElement).checked).toBe(true);
  });

  it('enables submit only when at least one item is present', async () => {
    const cl = await createChecklist({ name_en: 'X', name_is: 'X' });
    await addItem(cl.id, {
      title_en: 'a', title_is: 'a',
      instructions_en: '', instructions_is: '', media_ids: [],
    });
    render(RunChecklist, { props: { checklistId: cl.id, user: 'A' } });
    const btn = await screen.findByRole('button', { name: /Submit/ });
    expect(btn).not.toBeDisabled();
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/screens/RunChecklist.svelte`:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import Header from '$lib/components/Header.svelte';
  import { t, language } from '$lib/i18n/store';
  import { getChecklist, listItems } from '$lib/db/repos';
  import type { Checklist, Item } from '$lib/db/schema';
  import { navigate, back } from '$lib/stores/screen';

  export let checklistId: string;
  export let user: string;

  let checklist: Checklist | undefined;
  let items: Item[] = [];
  const checks: Record<string, { checked: boolean; note: string }> = {};
  let startedAt = new Date().toISOString();

  onMount(async () => {
    checklist = await getChecklist(checklistId);
    items = await listItems(checklistId);
    for (const it of items) checks[it.id] = { checked: false, note: '' };
  });

  function pickName(name_en: string, name_is: string): string {
    return $language === 'is' ? (name_is || name_en) : (name_en || name_is);
  }

  function submit() {
    const payload = {
      checklist_id: checklistId,
      checklist_name_snapshot: checklist ? pickName(checklist.name_en, checklist.name_is) : '',
      user_name: user,
      started_at: startedAt,
      item_results: items.map((i) => ({
        item_id: i.id,
        title_snapshot: pickName(i.title_en, i.title_is),
        checked: checks[i.id]?.checked ?? false,
        note: checks[i.id]?.note ?? '',
      })),
    };
    sessionStorage.setItem('pending-run', JSON.stringify(payload));
    navigate({ name: 'submit', runId: 'pending' });
  }
</script>

<Header title={checklist ? pickName(checklist.name_en, checklist.name_is) : ''} onBack={back} />

<main>
  <ul>
    {#each items as it (it.id)}
      <li>
        <label>
          <input
            type="checkbox"
            aria-label={pickName(it.title_en, it.title_is)}
            bind:checked={checks[it.id].checked}
          />
          <span class="title">{pickName(it.title_en, it.title_is)}</span>
        </label>
        <button
          class="more"
          on:click={() => navigate({ name: 'item', checklistId, itemId: it.id, user })}
          aria-label={$t('run.openInstructions')}
        >ⓘ</button>
      </li>
    {/each}
  </ul>

  <button class="submit" on:click={submit} disabled={items.length === 0}>
    {$t('run.submit')}
  </button>
</main>

<style>
  main { padding: 16px 16px 100px; }
  ul { list-style: none; padding: 0; margin: 0; }
  li {
    display: flex; align-items: center; gap: 12px;
    padding: 14px 12px; border-bottom: 1px solid var(--border);
  }
  label { display: flex; align-items: center; gap: 12px; flex: 1; }
  input[type="checkbox"] { width: 28px; height: 28px; }
  .title { font-size: 17px; }
  .more {
    background: var(--surface-2); color: var(--text);
    border: 1px solid var(--border); border-radius: 50%;
    width: 40px; height: 40px; min-height: auto; font-size: 18px;
  }
  .submit {
    position: fixed; bottom: 16px; left: 16px; right: 16px;
    background: var(--accent); color: #fff;
    border: 0; border-radius: var(--radius); font-size: 18px; font-weight: 600;
    padding: 16px; min-height: var(--tap);
  }
  .submit:disabled { opacity: 0.5; }
</style>
```

- [ ] **Step 4: Run, verify pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: RunChecklist screen with item toggles"
```

---

## Task 21: Item detail screen

**Files:**
- Create: `src/screens/ItemDetail.svelte`

- [ ] **Step 1: Implement**

Create `src/screens/ItemDetail.svelte`:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import Header from '$lib/components/Header.svelte';
  import { t, language } from '$lib/i18n/store';
  import { db } from '$lib/db/schema';
  import type { Item, Media } from '$lib/db/schema';
  import { back } from '$lib/stores/screen';

  export let checklistId: string;
  export let itemId: string;

  let item: Item | undefined;
  let media: Media[] = [];
  let urls: Record<string, string> = {};

  onMount(async () => {
    item = await db.items.get(itemId);
    if (item) {
      media = (await db.media.bulkGet(item.media_ids)).filter(Boolean) as Media[];
      for (const m of media) urls[m.id] = URL.createObjectURL(m.blob);
    }
    return () => Object.values(urls).forEach((u) => URL.revokeObjectURL(u));
  });

  function pick(en: string, is: string): string {
    return $language === 'is' ? (is || en) : (en || is);
  }
</script>

<Header title={item ? pick(item.title_en, item.title_is) : ''} onBack={back} />

<main>
  {#if item}
    <p class="instructions">{pick(item.instructions_en, item.instructions_is)}</p>

    <div class="gallery">
      {#each media as m (m.id)}
        {#if m.type === 'photo'}
          <img src={urls[m.id]} alt="" />
        {:else}
          <video src={urls[m.id]} controls playsinline></video>
        {/if}
      {/each}
    </div>

    <button class="done" on:click={back}>{$t('item.done')}</button>
  {/if}
</main>

<style>
  main { padding: 16px 16px 100px; }
  .instructions { white-space: pre-wrap; line-height: 1.6; margin: 0 0 18px; }
  .gallery { display: grid; gap: 10px; }
  img, video { width: 100%; border-radius: var(--radius); background: #000; }
  .done {
    position: fixed; bottom: 16px; left: 16px; right: 16px;
    background: var(--accent); color: #fff;
    border: 0; border-radius: var(--radius); font-size: 18px; font-weight: 600;
    padding: 16px;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: ItemDetail screen with media gallery"
```

---

## Task 22: Submit screen

**Files:**
- Create: `src/screens/Submit.svelte`
- Test: `tests/component/Submit.test.ts`

- [ ] **Step 1: Write component test**

Create `tests/component/Submit.test.ts`:

```ts
import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import Submit from '$screens/Submit.svelte';
import { language } from '$lib/i18n/store';
import { pendingRuns } from '$lib/db/repos';

describe('Submit', () => {
  beforeEach(() => {
    language.set('en');
    sessionStorage.setItem('pending-run', JSON.stringify({
      checklist_id: 'cl-1',
      checklist_name_snapshot: 'X',
      user_name: 'K',
      started_at: '2026-06-16T09:00:00Z',
      item_results: [],
    }));
  });

  it('saves a pending run when submit pressed', async () => {
    render(Submit);
    await fireEvent.click(screen.getByRole('button', { name: /Submit/ }));
    const pending = await pendingRuns();
    expect(pending).toHaveLength(1);
    expect(pending[0].user_name).toBe('K');
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/screens/Submit.svelte`:

```svelte
<script lang="ts">
  import Header from '$lib/components/Header.svelte';
  import { t } from '$lib/i18n/store';
  import { saveRun } from '$lib/db/repos';
  import { reset } from '$lib/stores/screen';
  import { refreshPending } from '$lib/stores/pending';
  import { runQueue } from '$lib/sync/queue';
  import { showToast } from '$lib/stores/toast';
  import { online } from '$lib/stores/network';
  import { back } from '$lib/stores/screen';

  let notes = '';
  let submitting = false;

  async function submit() {
    if (submitting) return;
    submitting = true;
    const raw = sessionStorage.getItem('pending-run');
    if (!raw) { submitting = false; return; }
    const data = JSON.parse(raw);
    const finished_at = new Date().toISOString();
    await saveRun({
      checklist_id: data.checklist_id,
      checklist_name_snapshot: data.checklist_name_snapshot,
      user_name: data.user_name,
      started_at: data.started_at,
      finished_at,
      notes,
      item_results: data.item_results,
    });
    sessionStorage.removeItem('pending-run');
    await refreshPending();

    if ($online) {
      const summary = await runQueue();
      await refreshPending();
      if (summary.ok > 0) showToast($t('submit.synced'), 'ok');
      else showToast($t('submit.queued'), 'info');
    } else {
      showToast($t('submit.queued'), 'info');
    }
    reset({ name: 'home' });
  }
</script>

<Header title={$t('submit.title')} onBack={back} />

<main>
  <label class="notes">
    <span>{$t('submit.runNotes')}</span>
    <textarea rows="4" bind:value={notes}></textarea>
  </label>

  <button class="confirm" on:click={submit} disabled={submitting}>{$t('submit.confirm')}</button>
</main>

<style>
  main { padding: 16px; }
  .notes span { display: block; color: var(--muted); margin-bottom: 6px; }
  textarea {
    width: 100%; background: var(--surface); color: var(--text);
    border: 1px solid var(--border); border-radius: 10px; padding: 12px; font: inherit;
  }
  .confirm {
    margin-top: 16px; width: 100%;
    background: var(--accent); color: #fff;
    border: 0; border-radius: var(--radius); font-size: 18px; font-weight: 600;
    padding: 16px;
  }
</style>
```

- [ ] **Step 4: Run, verify pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: Submit screen — saves run, triggers sync, toasts"
```

---

## Task 23: MediaUploader component

**Files:**
- Create: `src/lib/components/MediaUploader.svelte`

- [ ] **Step 1: Implement**

Create `src/lib/components/MediaUploader.svelte`:

```svelte
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { db, type Media } from '$lib/db/schema';
  import { uuid } from '$lib/utils/uuid';
  import { compressPhoto, validateVideo, videoThumbnail, photoMimeOK } from '$lib/utils/media';
  import { showToast } from '$lib/stores/toast';

  export let mediaIds: string[] = [];

  const dispatch = createEventDispatcher<{ change: { mediaIds: string[] } }>();
  let media: Media[] = [];
  let urls: Record<string, string> = {};

  $: refreshMedia(mediaIds);

  async function refreshMedia(ids: string[]) {
    media = ((await db.media.bulkGet(ids)).filter(Boolean) as Media[]);
    Object.values(urls).forEach((u) => URL.revokeObjectURL(u));
    urls = {};
    for (const m of media) urls[m.id] = URL.createObjectURL(m.blob);
  }

  async function addPhoto(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (!photoMimeOK(file.type)) { showToast(`Unsupported: ${file.type}`, 'warn'); return; }
    const { blob, mime } = await compressPhoto(file);
    const id = uuid();
    await db.media.add({
      id, type: 'photo', blob, thumbnail_blob: null, mime,
      size_bytes: blob.size, created_at: new Date().toISOString(),
    });
    mediaIds = [...mediaIds, id];
    dispatch('change', { mediaIds });
    (e.target as HTMLInputElement).value = '';
  }

  async function addVideo(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const v = validateVideo(file);
    if (!v.ok) { showToast(v.reason!, 'warn'); return; }
    const thumb = await videoThumbnail(file);
    const id = uuid();
    await db.media.add({
      id, type: 'video', blob: file, thumbnail_blob: thumb,
      mime: file.type, size_bytes: file.size,
      created_at: new Date().toISOString(),
    });
    mediaIds = [...mediaIds, id];
    dispatch('change', { mediaIds });
    (e.target as HTMLInputElement).value = '';
  }

  async function remove(id: string) {
    await db.media.delete(id);
    mediaIds = mediaIds.filter((x) => x !== id);
    dispatch('change', { mediaIds });
  }
</script>

<div class="grid">
  {#each media as m (m.id)}
    <div class="cell">
      {#if m.type === 'photo'}
        <img src={urls[m.id]} alt="" />
      {:else}
        <video src={urls[m.id]} muted></video>
      {/if}
      <button class="x" on:click={() => remove(m.id)}>✕</button>
    </div>
  {/each}
</div>

<div class="actions">
  <label class="btn">
    📷 Add photo
    <input type="file" accept="image/*" capture="environment" on:change={addPhoto} hidden />
  </label>
  <label class="btn">
    🎥 Add video
    <input type="file" accept="video/*" capture="environment" on:change={addVideo} hidden />
  </label>
</div>

<style>
  .grid { display: grid; gap: 8px; grid-template-columns: repeat(3, 1fr); margin-bottom: 10px; }
  .cell { position: relative; aspect-ratio: 1; border-radius: 10px; overflow: hidden; background: #000; }
  .cell img, .cell video { width: 100%; height: 100%; object-fit: cover; }
  .x {
    position: absolute; top: 4px; right: 4px;
    background: rgba(0,0,0,0.7); color: #fff; border: 0;
    width: 28px; height: 28px; min-height: auto; border-radius: 50%; font-size: 12px;
  }
  .actions { display: flex; gap: 10px; }
  .btn {
    flex: 1; text-align: center; padding: 12px;
    background: var(--surface-2); color: var(--text);
    border: 1px solid var(--border); border-radius: 10px; font-size: 14px;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: MediaUploader with photo compression + video size guard"
```

---

## Task 24: Edit list and edit checklist screens

**Files:**
- Create: `src/screens/EditList.svelte`, `src/screens/EditChecklist.svelte`

- [ ] **Step 1: Implement EditList**

Create `src/screens/EditList.svelte`:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import Header from '$lib/components/Header.svelte';
  import { t } from '$lib/i18n/store';
  import { listChecklists, createChecklist, deleteChecklist } from '$lib/db/repos';
  import type { Checklist } from '$lib/db/schema';
  import { navigate, back } from '$lib/stores/screen';

  let lists: Checklist[] = [];

  async function refresh() { lists = await listChecklists(); }
  onMount(refresh);

  async function add() {
    const cl = await createChecklist({ name_en: 'New checklist', name_is: 'Nýr gátlisti' });
    navigate({ name: 'editChecklist', checklistId: cl.id });
  }

  async function del(id: string) {
    if (!confirm($t('edit.confirmDelete'))) return;
    await deleteChecklist(id);
    await refresh();
  }
</script>

<Header title={$t('edit.checklists')} onBack={back} />

<main>
  <ul>
    {#each lists as cl (cl.id)}
      <li>
        <button class="row" on:click={() => navigate({ name: 'editChecklist', checklistId: cl.id })}>
          {cl.name_en || cl.name_is || '(no name)'}
        </button>
        <button class="del" on:click={() => del(cl.id)} aria-label={$t('edit.delete')}>🗑</button>
      </li>
    {/each}
  </ul>

  <button class="add" on:click={add}>+ {$t('edit.addChecklist')}</button>
</main>

<style>
  main { padding: 16px; }
  ul { list-style: none; padding: 0; margin: 0 0 16px; }
  li { display: flex; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--border); }
  .row {
    flex: 1; text-align: left; background: transparent; color: var(--text);
    border: 0; padding: 12px 8px; font-size: 16px;
  }
  .del {
    background: transparent; color: var(--err); border: 0;
    font-size: 18px; min-height: auto; padding: 8px 12px;
  }
  .add {
    width: 100%; background: var(--surface-2); color: var(--text);
    border: 1px solid var(--accent); border-radius: var(--radius); padding: 14px;
    font-size: 16px;
  }
</style>
```

- [ ] **Step 2: Implement EditChecklist**

Create `src/screens/EditChecklist.svelte`:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import Header from '$lib/components/Header.svelte';
  import LangTabs from '$lib/components/LangTabs.svelte';
  import { t } from '$lib/i18n/store';
  import {
    getChecklist, updateChecklist, listItems, addItem, deleteItem,
  } from '$lib/db/repos';
  import type { Checklist, Item } from '$lib/db/schema';
  import { navigate, back } from '$lib/stores/screen';

  export let checklistId: string;

  let cl: Checklist | undefined;
  let items: Item[] = [];

  async function refresh() {
    cl = await getChecklist(checklistId);
    items = await listItems(checklistId);
  }
  onMount(refresh);

  async function rename(detail: { en: string; is: string }) {
    if (!cl) return;
    await updateChecklist(cl.id, { name_en: detail.en, name_is: detail.is });
    cl = { ...cl, name_en: detail.en, name_is: detail.is };
  }

  async function add() {
    const it = await addItem(checklistId, {
      title_en: 'New item', title_is: 'Nýr liður',
      instructions_en: '', instructions_is: '', media_ids: [],
    });
    navigate({ name: 'editItem', checklistId, itemId: it.id });
  }

  async function del(id: string) {
    if (!confirm($t('edit.confirmDelete'))) return;
    await deleteItem(id);
    await refresh();
  }
</script>

<Header title={$t('edit.title')} onBack={back} />

<main>
  {#if cl}
    <LangTabs
      en={cl.name_en}
      is={cl.name_is}
      label="Checklist name"
      on:change={(e) => rename(e.detail)}
    />

    <ul>
      {#each items as it (it.id)}
        <li>
          <button class="row" on:click={() => navigate({ name: 'editItem', checklistId, itemId: it.id })}>
            {it.title_en || it.title_is || '(no title)'}
          </button>
          <button class="del" on:click={() => del(it.id)} aria-label={$t('edit.delete')}>🗑</button>
        </li>
      {/each}
    </ul>

    <button class="add" on:click={add}>+ {$t('edit.addItem')}</button>
  {/if}
</main>

<style>
  main { padding: 16px; }
  ul { list-style: none; padding: 0; margin: 16px 0; }
  li { display: flex; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--border); }
  .row {
    flex: 1; text-align: left; background: transparent; color: var(--text);
    border: 0; padding: 12px 8px; font-size: 16px;
  }
  .del {
    background: transparent; color: var(--err); border: 0;
    font-size: 18px; min-height: auto; padding: 8px 12px;
  }
  .add {
    width: 100%; background: var(--surface-2); color: var(--text);
    border: 1px solid var(--accent); border-radius: var(--radius); padding: 14px;
    font-size: 16px;
  }
</style>
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: EditList and EditChecklist screens"
```

---

## Task 25: EditItem screen

**Files:**
- Create: `src/screens/EditItem.svelte`
- Test: `tests/component/EditItem.test.ts`

- [ ] **Step 1: Write component test**

Create `tests/component/EditItem.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import EditItem from '$screens/EditItem.svelte';
import { createChecklist, addItem, listItems } from '$lib/db/repos';

describe('EditItem', () => {
  it('persists title edits on input', async () => {
    const cl = await createChecklist({ name_en: 'A', name_is: 'A' });
    const it = await addItem(cl.id, {
      title_en: 'Old', title_is: '',
      instructions_en: '', instructions_is: '', media_ids: [],
    });
    render(EditItem, { props: { checklistId: cl.id, itemId: it.id } });
    const input = await screen.findByDisplayValue('Old');
    await fireEvent.input(input, { target: { value: 'New' } });
    await new Promise((r) => setTimeout(r, 50));
    const items = await listItems(cl.id);
    expect(items[0].title_en).toBe('New');
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/screens/EditItem.svelte`:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import Header from '$lib/components/Header.svelte';
  import LangTabs from '$lib/components/LangTabs.svelte';
  import MediaUploader from '$lib/components/MediaUploader.svelte';
  import { t } from '$lib/i18n/store';
  import { db } from '$lib/db/schema';
  import { updateItem } from '$lib/db/repos';
  import type { Item } from '$lib/db/schema';
  import { back } from '$lib/stores/screen';

  export let checklistId: string;
  export let itemId: string;

  let it: Item | undefined;

  onMount(async () => { it = await db.items.get(itemId); });

  async function onTitle(d: { en: string; is: string }) {
    if (!it) return;
    it.title_en = d.en; it.title_is = d.is;
    await updateItem(it.id, { title_en: d.en, title_is: d.is });
  }
  async function onInstr(d: { en: string; is: string }) {
    if (!it) return;
    it.instructions_en = d.en; it.instructions_is = d.is;
    await updateItem(it.id, { instructions_en: d.en, instructions_is: d.is });
  }
  async function onMedia(d: { mediaIds: string[] }) {
    if (!it) return;
    it.media_ids = d.mediaIds;
    await updateItem(it.id, { media_ids: d.mediaIds });
  }
</script>

<Header title={$t('edit.title')} onBack={back} />

<main>
  {#if it}
    <LangTabs en={it.title_en} is={it.title_is}
      label={$t('editItem.title.en')} on:change={(e) => onTitle(e.detail)} />
    <LangTabs en={it.instructions_en} is={it.instructions_is}
      label={$t('editItem.instructions.en')} multiline
      on:change={(e) => onInstr(e.detail)} />

    <h3>{$t('editItem.media')}</h3>
    <MediaUploader mediaIds={it.media_ids} on:change={(e) => onMedia(e.detail)} />
  {/if}
</main>

<style>
  main { padding: 16px; }
  h3 { font-size: 14px; color: var(--muted); margin: 16px 0 8px; text-transform: uppercase; letter-spacing: 0.06em; }
</style>
```

- [ ] **Step 4: Run, verify pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: EditItem screen with title/instructions/media"
```

---

## Task 26: Settings screen

**Files:**
- Create: `src/screens/Settings.svelte`

- [ ] **Step 1: Implement**

Create `src/screens/Settings.svelte`:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import Header from '$lib/components/Header.svelte';
  import { t } from '$lib/i18n/store';
  import { settings, updateSettings, loadSettings } from '$lib/stores/settings';
  import { pendingRuns, listRuns } from '$lib/db/repos';
  import { runQueue } from '$lib/sync/queue';
  import { refreshPending } from '$lib/stores/pending';
  import { showToast } from '$lib/stores/toast';
  import { back } from '$lib/stores/screen';
  import type { Run } from '$lib/db/schema';

  let newUser = '';
  let endpoint = '';
  let secret = '';
  let pending: Run[] = [];
  let storageMB = 0;

  onMount(async () => {
    await loadSettings();
    const s = $settings;
    endpoint = s?.endpoint_url ?? '';
    secret = s?.shared_secret ?? '';
    pending = await pendingRuns();
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      storageMB = Math.round(((est.usage ?? 0) / 1024 / 1024) * 10) / 10;
    }
  });

  async function addUser() {
    if (!newUser.trim() || !$settings) return;
    await updateSettings({ users: [...$settings.users, newUser.trim()] });
    newUser = '';
  }
  async function removeUser(u: string) {
    if (!$settings) return;
    await updateSettings({ users: $settings.users.filter((x) => x !== u) });
  }
  async function setLang(l: 'en' | 'is') {
    await updateSettings({ language: l });
  }
  async function saveEndpoint() {
    await updateSettings({ endpoint_url: endpoint, shared_secret: secret });
    showToast('Saved', 'ok');
  }
  async function forceSync() {
    const s = await runQueue();
    await refreshPending();
    pending = await pendingRuns();
    showToast(`Synced: ${s.ok}, retry: ${s.retry}, errors: ${s.fatal}`, s.fatal ? 'warn' : 'ok');
  }
</script>

<Header title={$t('settings.title')} onBack={back} />

<main>
  <section>
    <h3>{$t('settings.users')}</h3>
    <ul>
      {#each $settings?.users ?? [] as u (u)}
        <li>
          <span>{u}</span>
          <button on:click={() => removeUser(u)} aria-label="Remove">🗑</button>
        </li>
      {/each}
    </ul>
    <div class="row">
      <input bind:value={newUser} placeholder={$t('settings.addUser')} />
      <button on:click={addUser}>+</button>
    </div>
  </section>

  <section>
    <h3>{$t('settings.language')}</h3>
    <div class="lang">
      <button class:active={$settings?.language === 'en'} on:click={() => setLang('en')}>English</button>
      <button class:active={$settings?.language === 'is'} on:click={() => setLang('is')}>Íslenska</button>
    </div>
  </section>

  <section>
    <h3>{$t('settings.endpoint')}</h3>
    <input bind:value={endpoint} placeholder="https://script.google.com/macros/s/.../exec" />
    <h3>{$t('settings.secret')}</h3>
    <input bind:value={secret} type="password" />
    <button class="save" on:click={saveEndpoint}>{$t('common.save')}</button>
  </section>

  <section>
    <h3>{$t('settings.queue')}</h3>
    <p class="muted">{pending.length} pending</p>
    <button on:click={forceSync}>{$t('settings.forceSync')}</button>
  </section>

  <section>
    <h3>{$t('settings.storage')}</h3>
    <p class="muted">{storageMB} MB used</p>
  </section>
</main>

<style>
  main { padding: 16px; }
  section { margin-bottom: 24px; }
  h3 { font-size: 13px; color: var(--muted); margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.08em; }
  ul { list-style: none; padding: 0; margin: 0 0 8px; }
  li { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--border); }
  li button { background: transparent; color: var(--err); border: 0; min-height: auto; padding: 4px 8px; }
  .row { display: flex; gap: 8px; }
  input {
    flex: 1; background: var(--surface); color: var(--text);
    border: 1px solid var(--border); border-radius: 10px; padding: 12px; font: inherit;
  }
  .row button {
    background: var(--accent); color: #fff; border: 0; border-radius: 10px;
    width: 48px; font-size: 22px;
  }
  .save {
    margin-top: 10px; background: var(--accent); color: #fff;
    border: 0; border-radius: 10px; padding: 12px 20px;
  }
  .lang { display: flex; gap: 8px; }
  .lang button {
    flex: 1; background: var(--surface); color: var(--muted);
    border: 1px solid var(--border); border-radius: 10px; padding: 12px;
  }
  .lang .active { background: var(--surface-2); color: var(--text); border-color: var(--accent); }
  .muted { color: var(--muted); }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: Settings screen — users, lang, endpoint, sync, storage"
```

---

## Task 27: Wire App.svelte router

**Files:**
- Modify: `src/App.svelte`

- [ ] **Step 1: Replace App.svelte with the screen-switch root**

Overwrite `src/App.svelte`:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { currentScreen } from '$lib/stores/screen';
  import { loadSettings } from '$lib/stores/settings';
  import { refreshPending } from '$lib/stores/pending';
  import { online } from '$lib/stores/network';
  import { runQueue } from '$lib/sync/queue';
  import Toast from '$lib/components/Toast.svelte';

  import Home from '$screens/Home.svelte';
  import PickUser from '$screens/PickUser.svelte';
  import RunChecklist from '$screens/RunChecklist.svelte';
  import ItemDetail from '$screens/ItemDetail.svelte';
  import Submit from '$screens/Submit.svelte';
  import EditList from '$screens/EditList.svelte';
  import EditChecklist from '$screens/EditChecklist.svelte';
  import EditItem from '$screens/EditItem.svelte';
  import Settings from '$screens/Settings.svelte';

  onMount(async () => {
    await loadSettings();
    await refreshPending();
  });

  let wasOnline = false;
  $: if ($online && !wasOnline) {
    wasOnline = true;
    runQueue().then(refreshPending);
  } else if (!$online) {
    wasOnline = false;
  }
</script>

{#if $currentScreen.name === 'home'}
  <Home />
{:else if $currentScreen.name === 'pickUser'}
  <PickUser checklistId={$currentScreen.checklistId} />
{:else if $currentScreen.name === 'run'}
  <RunChecklist checklistId={$currentScreen.checklistId} user={$currentScreen.user} />
{:else if $currentScreen.name === 'item'}
  <ItemDetail checklistId={$currentScreen.checklistId} itemId={$currentScreen.itemId} />
{:else if $currentScreen.name === 'submit'}
  <Submit />
{:else if $currentScreen.name === 'editList'}
  <EditList />
{:else if $currentScreen.name === 'editChecklist'}
  <EditChecklist checklistId={$currentScreen.checklistId} />
{:else if $currentScreen.name === 'editItem'}
  <EditItem checklistId={$currentScreen.checklistId} itemId={$currentScreen.itemId} />
{:else if $currentScreen.name === 'settings'}
  <Settings />
{/if}

<Toast />
```

- [ ] **Step 2: Verify build still passes type check**

Run: `npm run check`
Expected: 0 errors.

- [ ] **Step 3: Verify dev server runs end-to-end**

Run: `npm run dev`, open URL, confirm Home renders. Stop with Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: wire App.svelte router + initial load"
```

---

## Task 28: PWA manifest, icons, and service worker

**Files:**
- Create: `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/icon-maskable-512.png` (placeholders generated)
- Modify: `vite.config.ts`, `src/main.ts`

- [ ] **Step 1: Install PWA plugin**

```bash
npm install -D vite-plugin-pwa@^0.20 workbox-window@^7
```

- [ ] **Step 2: Generate placeholder icons**

Run:

```bash
mkdir -p public/icons
node -e "const fs=require('fs');const sizes=[192,512];for(const s of sizes){const pngHeader=Buffer.from('89504e470d0a1a0a0000000d49484452','hex');console.log('placeholder size',s);}" >/dev/null
```

Then create three trivial PNGs using ImageMagick (or any tool); a 256×256 solid color is fine for now:

```bash
# Requires `convert` (ImageMagick). If not installed:
# sudo pacman -S imagemagick
convert -size 192x192 xc:#1a1a2e -gravity center -pointsize 110 -fill "#8b8bd6" -annotate +0+0 "✓" public/icons/icon-192.png
convert -size 512x512 xc:#1a1a2e -gravity center -pointsize 280 -fill "#8b8bd6" -annotate +0+0 "✓" public/icons/icon-512.png
convert -size 512x512 xc:#1a1a2e -gravity center -pointsize 200 -fill "#8b8bd6" -annotate +0+0 "✓" public/icons/icon-maskable-512.png
```

If ImageMagick isn't available, drop in any 192/512 PNGs by hand — the contents don't matter for development.

- [ ] **Step 3: Update `vite.config.ts`**

Replace `vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'Trailer Checklist',
        short_name: 'Trailer',
        description: 'Offline-first checklist for the trailer',
        theme_color: '#1a1a2e',
        background_color: '#0f1020',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === self.location.origin,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'app-shell' },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      $lib: fileURLToPath(new URL('./src/lib', import.meta.url)),
      $screens: fileURLToPath(new URL('./src/screens', import.meta.url)),
    },
  },
  base: './',
});
```

- [ ] **Step 4: Register the service worker in `src/main.ts`**

Replace `src/main.ts`:

```ts
import './app.css';
import App from './App.svelte';
import { registerSW } from 'virtual:pwa-register';

const app = new App({ target: document.getElementById('app')! });

registerSW({ immediate: true });

export default app;
```

- [ ] **Step 5: Add the `virtual:pwa-register` types**

Create `src/vite-env.d.ts`:

```ts
/// <reference types="svelte" />
/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/svelte" />
declare module 'virtual:pwa-register' {
  export interface RegisterSWOptions { immediate?: boolean }
  export function registerSW(opts?: RegisterSWOptions): (reload?: boolean) => Promise<void>;
}
```

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: 0 errors. `dist/sw.js` and `dist/manifest.webmanifest` exist.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: PWA manifest, icons, service worker registration"
```

---

## Task 29: Background Sync registration

**Files:**
- Create: `src/lib/sync/background.ts`
- Modify: `src/screens/Submit.svelte`, `src/App.svelte`

- [ ] **Step 1: Create background sync helper**

Create `src/lib/sync/background.ts`:

```ts
const TAG = 'trailer-runs-sync';

export async function requestBackgroundSync(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('SyncManager' in self)) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    // @ts-expect-error SyncManager typing isn't in lib.dom yet
    await reg.sync.register(TAG);
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: Add sync event listener via Workbox custom SW**

Since the default `vite-plugin-pwa` strategy uses GenerateSW, switch to injectManifest for custom SW logic.

Update `vite.config.ts` PWA block:

```ts
VitePWA({
  strategies: 'injectManifest',
  srcDir: 'src',
  filename: 'sw.ts',
  registerType: 'autoUpdate',
  injectRegister: false,
  manifest: { /* unchanged */ },
}),
```

(Keep the same `manifest` block as before.)

- [ ] **Step 3: Create custom SW**

Create `src/sw.ts`:

```ts
/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope;
precacheAndRoute(self.__WB_MANIFEST);

const TAG = 'trailer-runs-sync';

self.addEventListener('sync', (event) => {
  const e = event as ExtendableEvent & { tag: string };
  if (e.tag === TAG) {
    e.waitUntil(notifyClients());
  }
});

async function notifyClients() {
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  for (const client of clients) client.postMessage({ type: 'run-sync' });
}
```

- [ ] **Step 4: Install workbox-precaching**

```bash
npm install -D workbox-precaching@^7
```

- [ ] **Step 5: Wire client-side message handler**

In `src/App.svelte`, inside the existing `onMount`, after `await refreshPending();` add:

```ts
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data?.type === 'run-sync') {
      runQueue().then(refreshPending);
    }
  });
}
```

- [ ] **Step 6: Register sync on submit**

In `src/screens/Submit.svelte`, in the `submit()` function, after `await refreshPending();` and before the `if ($online)` block, add:

```ts
import { requestBackgroundSync } from '$lib/sync/background';
// ...
await requestBackgroundSync();
```

(Add the `import` at the top of the script block.)

- [ ] **Step 7: Verify build**

Run: `npm run build`
Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: background sync — custom SW + sync event → runQueue"
```

---

## Task 30: First-run seed

**Files:**
- Create: `src/lib/db/seed.ts`
- Modify: `src/App.svelte`

- [ ] **Step 1: Implement seed**

Create `src/lib/db/seed.ts`:

```ts
import { db } from './schema';
import { createChecklist, addItem, saveSettings } from './repos';

export async function seedIfEmpty(): Promise<void> {
  const count = await db.checklists.count();
  if (count > 0) return;

  await saveSettings({ users: ['Family member'], language: 'en' });

  const leaving = await createChecklist({ name_en: 'Leaving', name_is: 'Brottför' });
  await addItem(leaving.id, {
    title_en: 'Empty toilet tank', title_is: 'Tæma klósettank',
    instructions_en: 'Open the valve at the rear, wait until empty.',
    instructions_is: 'Opnaðu lokann að aftan, bíddu þar til tankur er tómur.',
    media_ids: [],
  });
  await addItem(leaving.id, {
    title_en: 'Turn off the lights', title_is: 'Slökkva ljósin',
    instructions_en: '', instructions_is: '', media_ids: [],
  });
  await addItem(leaving.id, {
    title_en: 'Lock the door', title_is: 'Læsa hurðinni',
    instructions_en: '', instructions_is: '', media_ids: [],
  });

  const arriving = await createChecklist({ name_en: 'Arriving', name_is: 'Koma' });
  await addItem(arriving.id, {
    title_en: 'Turn on the water', title_is: 'Opna fyrir vatnið',
    instructions_en: '', instructions_is: '', media_ids: [],
  });
  await addItem(arriving.id, {
    title_en: 'Check gas level', title_is: 'Athuga gasstöðu',
    instructions_en: '', instructions_is: '', media_ids: [],
  });
}
```

- [ ] **Step 2: Call seed on app start**

In `src/App.svelte` script block, add at the top of imports:

```ts
import { seedIfEmpty } from '$lib/db/seed';
```

And in `onMount`, before `await loadSettings();`:

```ts
await seedIfEmpty();
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: first-run seed with sample checklists"
```

---

## Task 31: Apps Script web app

**Files:**
- Create: `apps-script/appsscript.json`, `apps-script/Code.gs`, `apps-script/test-payload.json`, `apps-script/README.md`

- [ ] **Step 1: Create the script manifest**

Create `apps-script/appsscript.json`:

```json
{
  "timeZone": "Atlantic/Reykjavik",
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "webapp": { "access": "ANYONE_ANONYMOUS", "executeAs": "USER_DEPLOYING" }
}
```

- [ ] **Step 2: Create `Code.gs`**

Create `apps-script/Code.gs`:

```js
const SHEET_NAME = 'Runs';
const HEADERS = ['timestamp', 'user', 'checklist', 'notes', 'items_json', 'run_id'];
const DEDUP_WINDOW = 200;

function getSecret_() {
  return PropertiesService.getScriptProperties().getProperty('TRAILER_SECRET') || '';
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
  }
  return sheet;
}

function json_(obj, status) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    if (!payload.secret || payload.secret !== getSecret_()) {
      return json_({ ok: false, error: 'unauthorized' });
    }
    if (!payload.run_id || !payload.timestamp || !payload.checklist) {
      return json_({ ok: false, error: 'invalid payload' });
    }

    const sheet = getSheet_();
    const last = sheet.getLastRow();
    if (last > 1) {
      const start = Math.max(2, last - DEDUP_WINDOW + 1);
      const ids = sheet.getRange(start, 6, last - start + 1, 1).getValues().flat();
      if (ids.indexOf(payload.run_id) !== -1) {
        return json_({ ok: true, dedup: true });
      }
    }

    sheet.appendRow([
      payload.timestamp,
      payload.user || '',
      payload.checklist,
      payload.notes || '',
      payload.items_json || '[]',
      payload.run_id,
    ]);
    return json_({ ok: true, row: sheet.getLastRow() });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doGet() {
  return json_({ ok: true, hint: 'POST runs here' });
}
```

- [ ] **Step 3: Create a sample payload for the test harness**

Create `apps-script/test-payload.json`:

```json
{
  "secret": "REPLACE_WITH_YOUR_SECRET",
  "run_id": "test-uuid-1",
  "timestamp": "2026-06-16T14:00:00Z",
  "user": "TestUser",
  "checklist": "Test Checklist",
  "notes": "smoke test",
  "items_json": "[{\"t\":\"item1\",\"c\":true,\"n\":\"\"}]"
}
```

- [ ] **Step 4: Create deployment README**

Create `apps-script/README.md`:

```markdown
# Apps Script deployment

## One-time setup

1. Install clasp globally: `npm install -g @google/clasp`
2. `clasp login`
3. From the project root: `cd apps-script && clasp create --type sheets --title "Trailer Checklist Log"`
4. `clasp push`
5. Open the Sheet (via `clasp open`) → Extensions → Apps Script → Project Settings → Script properties
   - Add `TRAILER_SECRET` = (paste a long random string, save it; you'll also paste it into the tablet Settings)
6. Deploy → New deployment → Web app → Execute as: yourself → Who has access: Anyone
7. Copy the `/exec` URL. Paste into the tablet's Settings → Sheets endpoint URL.

## Manual smoke test

```bash
# Edit test-payload.json first and replace the "secret" field.
curl -X POST \
  -H "Content-Type: application/json" \
  --data @test-payload.json \
  "<your /exec URL>"
```

Expected: `{"ok":true,"row":2}` (or `{"ok":true,"dedup":true}` on the second call).

Then open the Sheet and confirm the row landed in the `Runs` tab.
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: Apps Script web app + deployment guide"
```

---

## Task 32: GitHub Pages deploy workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Create the workflow**

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Adjust `vite.config.ts` base path for Pages**

If hosting at `https://<user>.github.io/<repo>/`, the `base: './'` setting we already have works for relative asset paths. Verify by running:

Run: `npm run build`
Expected: `dist/index.html` references `./assets/...`.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "ci: GitHub Pages deploy on push to main"
```

---

## Task 33: README and smoke test doc

**Files:**
- Create: `README.md`, `docs/smoke-test.md`

- [ ] **Step 1: Create `README.md`**

Create `README.md`:

```markdown
# Trailer Checklist

Offline-first PWA for running family checklists at the trailer. Bilingual EN/IS. Submits each run as a row in a Google Sheet.

## Develop

```bash
npm install
npm run dev      # local server
npm test         # unit + component tests
npm run build    # production build (writes dist/)
```

## Deploy

- App: push to `main` — GitHub Action publishes to GitHub Pages.
- Sheets endpoint: see `apps-script/README.md`.

## First-time tablet setup

1. Open the deployed URL in Android Chrome.
2. Menu → "Install app" / "Add to Home screen".
3. Open the app once online, then Settings → paste the Apps Script `/exec` URL and the shared secret, add user names.
4. Done. The app works fully offline; submissions sync when the tablet sees the internet again.

## Smoke test

See `docs/smoke-test.md`.
```

- [ ] **Step 2: Create `docs/smoke-test.md`**

Create `docs/smoke-test.md`:

```markdown
# Smoke test

Run after each deploy.

## On the tablet

1. Open the app. Confirm Home screen loads.
2. Settings → confirm endpoint URL + secret are present.
3. Go offline (airplane mode).
4. Run a checklist end-to-end: pick user → check at least one item → tap an item to see instructions → Submit.
5. Confirm toast "Saved. Will sync when online." and pending badge shows 1.
6. Restore Wi-Fi. Within ~30 seconds, the pending badge should clear (or use Settings → Force sync now).
7. Open the Google Sheet → confirm a new row appeared with today's timestamp, the user picked, and the checklist name.

## Edit mode

1. Long-press the gear icon. Confirm Edit Checklists screen opens.
2. Add a new checklist, add an item with a photo from the camera.
3. Run the new checklist, submit.
4. Confirm the row lands in the Sheet.
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "docs: README and smoke test"
```

---

## Task 34: Final type check + full test sweep

- [ ] **Step 1: Run full type check**

Run: `npm run check`
Expected: 0 errors, 0 warnings (or only warnings about unused imports — fix them).

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 3: Build the production bundle**

Run: `npm run build`
Expected: 0 errors. `dist/` contains `index.html`, `sw.js`, `manifest.webmanifest`, `assets/*`, `icons/*`.

- [ ] **Step 4: Tag the milestone**

```bash
git tag v0.1.0
git log --oneline -1
```

- [ ] **Step 5: Commit anything left over (should be a no-op)**

```bash
git status
```
Expected: working tree clean.

---

## Done

What's built: a fully offline-capable PWA on the tablet that can manage any number of bilingual checklists with photo/video instructions, queue submissions, and sync them to a Google Sheet via an Apps Script web app.

Next steps the engineer can hand to the user:
1. Push the repo to GitHub, enable Pages.
2. Follow `apps-script/README.md` to deploy the endpoint and copy URL + secret.
3. Install on the tablet, paste config in Settings, run the smoke test.
