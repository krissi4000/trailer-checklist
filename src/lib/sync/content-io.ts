import { db, type Item } from '$lib/db/schema';
import { DEFAULT_SETTINGS } from '$lib/db/repos';
import type { ContentBundle } from './bundle';

export async function buildBundle(): Promise<ContentBundle> {
  const [checklists, items, tombstones, storedSettings] = await Promise.all([
    db.checklists.toArray(),
    db.items.toArray(),
    db.tombstones.toArray(),
    db.settings.get('singleton'),
  ]);
  const settings = { ...DEFAULT_SETTINGS, ...storedSettings };

  const byChecklist = new Map<string, Item[]>();
  for (const it of items) {
    byChecklist.set(it.checklist_id, [...(byChecklist.get(it.checklist_id) ?? []), it]);
  }

  return {
    schema: 1,
    checklists: checklists.map((c) => ({ ...c, items: byChecklist.get(c.id) ?? [] })),
    tombstones,
    shared: {
      users: settings.users,
      info_entries: settings.info_entries,
      updated_at: settings.shared_updated_at,
    },
  };
}

// Writes go straight to Dexie (not through repos) on purpose: applying a sync
// result must not fire the content-changed signal, or every pull would
// schedule another push.
export async function applyBundle(bundle: ContentBundle): Promise<void> {
  await db.transaction('rw', db.checklists, db.items, db.tombstones, db.settings, async () => {
    await db.checklists.clear();
    await db.items.clear();
    await db.tombstones.clear();
    await db.checklists.bulkAdd(bundle.checklists.map(({ items: _items, ...c }) => c));
    await db.items.bulkAdd(bundle.checklists.flatMap((c) => c.items));
    await db.tombstones.bulkAdd(bundle.tombstones);

    const current = { ...DEFAULT_SETTINGS, ...(await db.settings.get('singleton')) };
    await db.settings.put({
      ...current,
      users: bundle.shared.users,
      info_entries: bundle.shared.info_entries,
      shared_updated_at: bundle.shared.updated_at,
    });
  });
}
