// Pure bundle logic: no Dexie, no fetch. Everything here is unit-testable
// with plain objects.
import type { InfoEntry } from '$lib/db/schema';

export interface BundleItem {
  id: string;
  checklist_id: string;
  title_en: string;
  title_is: string;
  instructions_en: string;
  instructions_is: string;
  media_ids: string[];
}

export interface BundleChecklist {
  id: string;
  name_en: string;
  name_is: string;
  item_order: string[];
  created_at: string;
  updated_at: string;
  items: BundleItem[];
}

export interface BundleTombstone {
  id: string;
  deleted_at: string;
}

export interface SharedUnit {
  users: string[];
  info_entries: InfoEntry[];
  updated_at: string;
}

export interface ContentBundle {
  schema: 1;
  checklists: BundleChecklist[];
  tombstones: BundleTombstone[];
  shared: SharedUnit;
}

export function emptyBundle(): ContentBundle {
  return {
    schema: 1,
    checklists: [],
    tombstones: [],
    shared: { users: [], info_entries: [], updated_at: '' },
  };
}

export function referencedMediaIds(bundle: ContentBundle): string[] {
  const ids = new Set<string>();
  for (const cl of bundle.checklists)
    for (const it of cl.items)
      for (const m of it.media_ids) ids.add(m);
  return [...ids];
}

const TOMBSTONE_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export function mergeBundles(local: ContentBundle, remote: ContentBundle, now: string): ContentBundle {
  // Tombstones: union by id keeping the newest deletion, pruned after 90 days.
  const tombs = new Map<string, BundleTombstone>();
  for (const t of [...local.tombstones, ...remote.tombstones]) {
    const prev = tombs.get(t.id);
    if (!prev || t.deleted_at > prev.deleted_at) tombs.set(t.id, t);
  }
  const cutoff = new Date(new Date(now).getTime() - TOMBSTONE_TTL_MS).toISOString();
  for (const [id, t] of [...tombs]) if (t.deleted_at < cutoff) tombs.delete(id);

  const localById = new Map(local.checklists.map((c) => [c.id, c]));
  const remoteById = new Map(remote.checklists.map((c) => [c.id, c]));

  const merged: BundleChecklist[] = [];
  for (const id of new Set([...localById.keys(), ...remoteById.keys()])) {
    const l = localById.get(id);
    const r = remoteById.get(id);
    const winner = !l ? r! : !r ? l : l.updated_at >= r.updated_at ? l : r;
    const tomb = tombs.get(id);
    if (tomb && tomb.deleted_at > winner.updated_at) continue; // deletion wins over older edits
    if (tomb) tombs.delete(id); // edit is newer than the deletion: resurrect
    merged.push(winner);
  }

  const shared = local.shared.updated_at >= remote.shared.updated_at ? local.shared : remote.shared;

  return { schema: 1, checklists: merged, tombstones: [...tombs.values()], shared };
}

export function bundlesEqual(a: ContentBundle, b: ContentBundle): boolean {
  return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
}

// Rebuild with sorted arrays and a fixed key order so JSON comparison is
// deterministic regardless of how the bundle was assembled.
function normalize(b: ContentBundle): ContentBundle {
  const byId = <T extends { id: string }>(x: T, y: T) => (x.id < y.id ? -1 : 1);
  return {
    schema: 1,
    checklists: [...b.checklists].sort(byId).map((c) => ({
      id: c.id, name_en: c.name_en, name_is: c.name_is,
      item_order: c.item_order, created_at: c.created_at, updated_at: c.updated_at,
      items: [...c.items].sort(byId).map((i) => ({
        id: i.id, checklist_id: i.checklist_id,
        title_en: i.title_en, title_is: i.title_is,
        instructions_en: i.instructions_en, instructions_is: i.instructions_is,
        media_ids: i.media_ids,
      })),
    })),
    tombstones: [...b.tombstones].sort(byId).map((t) => ({ id: t.id, deleted_at: t.deleted_at })),
    shared: {
      users: b.shared.users,
      info_entries: b.shared.info_entries.map((e) => ({
        id: e.id, label_en: e.label_en, label_is: e.label_is, value: e.value,
      })),
      updated_at: b.shared.updated_at,
    },
  };
}
