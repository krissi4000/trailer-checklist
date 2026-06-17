import { describe, expect, it } from 'vitest';
import { db } from '$lib/db/schema';
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
  deleteChecklist,
  deleteItem,
  updateItem,
  reorderItems,
} from '$lib/db/repos';

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

describe('deleteChecklist', () => {
  it('cascades delete to all items', async () => {
    const cl = await createChecklist({ name_en: 'A', name_is: 'A' });
    await addItem(cl.id, {
      title_en: 'x', title_is: 'x',
      instructions_en: '', instructions_is: '', media_ids: [],
    });
    await addItem(cl.id, {
      title_en: 'y', title_is: 'y',
      instructions_en: '', instructions_is: '', media_ids: [],
    });
    await deleteChecklist(cl.id);
    expect(await listChecklists()).toHaveLength(0);
    expect(await listItems(cl.id)).toHaveLength(0);
  });
});

describe('deleteItem', () => {
  it('removes item and updates checklist.item_order', async () => {
    const cl = await createChecklist({ name_en: 'A', name_is: 'A' });
    const a = await addItem(cl.id, {
      title_en: 'a', title_is: 'a',
      instructions_en: '', instructions_is: '', media_ids: [],
    });
    const b = await addItem(cl.id, {
      title_en: 'b', title_is: 'b',
      instructions_en: '', instructions_is: '', media_ids: [],
    });
    await deleteItem(a.id);
    const items = await listItems(cl.id);
    expect(items.map((i) => i.id)).toEqual([b.id]);
    const lists = await listChecklists();
    expect(lists[0].item_order).toEqual([b.id]);
  });
});

describe('updateItem', () => {
  it('persists title changes', async () => {
    const cl = await createChecklist({ name_en: 'A', name_is: 'A' });
    const it = await addItem(cl.id, {
      title_en: 'Old', title_is: 'Gamalt',
      instructions_en: '', instructions_is: '', media_ids: [],
    });
    await updateItem(it.id, { title_en: 'New' });
    const items = await listItems(cl.id);
    expect(items[0].title_en).toBe('New');
    expect(items[0].title_is).toBe('Gamalt');
  });
});

describe('reorderItems', () => {
  it('changes item order', async () => {
    const cl = await createChecklist({ name_en: 'A', name_is: 'A' });
    const a = await addItem(cl.id, {
      title_en: 'a', title_is: 'a',
      instructions_en: '', instructions_is: '', media_ids: [],
    });
    const b = await addItem(cl.id, {
      title_en: 'b', title_is: 'b',
      instructions_en: '', instructions_is: '', media_ids: [],
    });
    await reorderItems(cl.id, [b.id, a.id]);
    const items = await listItems(cl.id);
    expect(items.map((i) => i.id)).toEqual([b.id, a.id]);
  });
});
