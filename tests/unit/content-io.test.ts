import { describe, expect, it } from 'vitest';
import { db } from '$lib/db/schema';
import {
  createChecklist, addItem, deleteChecklist, saveSettings, getSettings,
} from '$lib/db/repos';
import { buildBundle, applyBundle } from '$lib/sync/content-io';
import { bundlesEqual } from '$lib/sync/bundle';

async function seedSample() {
  const cl = await createChecklist({ name_en: 'A', name_is: 'A-is' });
  await addItem(cl.id, {
    title_en: 't', title_is: 't-is',
    instructions_en: 'i', instructions_is: 'i-is', media_ids: ['m1'],
  });
  const dead = await createChecklist({ name_en: 'Dead', name_is: 'Dead' });
  await deleteChecklist(dead.id);
  await saveSettings({ users: ['Anna'], info_entries: [{ id: 'e1', label_en: 'l', label_is: 'l', value: 'v' }] });
  return cl;
}

describe('buildBundle', () => {
  it('captures checklists with embedded items, tombstones and the shared unit', async () => {
    const cl = await seedSample();
    const b = await buildBundle();
    expect(b.checklists.map((c) => c.id)).toEqual([cl.id]);
    expect(b.checklists[0].items.map((i) => i.media_ids)).toEqual([['m1']]);
    expect(b.tombstones.length).toBe(1);
    expect(b.shared.users).toEqual(['Anna']);
    expect(b.shared.updated_at).not.toBe('');
  });
});

describe('applyBundle', () => {
  it('roundtrips: apply(build()) leaves state identical', async () => {
    await seedSample();
    const before = await buildBundle();
    await applyBundle(before);
    const after = await buildBundle();
    expect(bundlesEqual(before, after)).toBe(true);
  });

  it('replaces content wholesale but preserves local-only settings', async () => {
    await seedSample();
    await saveSettings({ endpoint_url: 'https://example.test/exec', language: 'is' });
    const foreign = await buildBundle();
    foreign.checklists = [];
    foreign.shared = { users: ['Kári'], info_entries: [], updated_at: '2026-07-01T00:00:00Z' };
    await applyBundle(foreign);
    expect(await db.checklists.count()).toBe(0);
    expect(await db.items.count()).toBe(0);
    const s = await getSettings();
    expect(s.users).toEqual(['Kári']);
    expect(s.shared_updated_at).toBe('2026-07-01T00:00:00Z');
    expect(s.endpoint_url).toBe('https://example.test/exec'); // untouched
    expect(s.language).toBe('is'); // untouched
  });
});
