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
  language: 'is',
  endpoint_url: '',
  shared_secret: '',
  device_name: 'tablet',
  info_entries: [],
  lang_default_migrated: false,
};

export async function getSettings(): Promise<Settings> {
  const s = await db.settings.get('singleton');
  // Merge so records saved before newer fields existed get their defaults.
  return { ...DEFAULT_SETTINGS, ...s };
}

export async function saveSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<Settings> {
  const current = await getSettings();
  const merged: Settings = { ...current, ...patch, id: 'singleton' };
  await db.settings.put(merged);
  return merged;
}
