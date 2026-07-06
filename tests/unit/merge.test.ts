import { describe, expect, it } from 'vitest';
import { mergeBundles, emptyBundle } from '$lib/sync/bundle';
import { mkChecklist, mkBundle } from './bundle-fixtures';

const NOW = '2026-07-06T12:00:00.000Z';

describe('mergeBundles: checklist LWW', () => {
  it('keeps checklists that exist on only one side', () => {
    const local = mkBundle([mkChecklist('a', 'A', '2026-02-01T00:00:00Z')]);
    const remote = mkBundle([mkChecklist('b', 'B', '2026-02-01T00:00:00Z')]);
    const m = mergeBundles(local, remote, NOW);
    expect(m.checklists.map((c) => c.id).sort()).toEqual(['a', 'b']);
  });

  it('newer side wins wholesale, items included', () => {
    const older = mkChecklist('a', 'Old', '2026-02-01T00:00:00Z', {
      items: [{ id: 'i1', checklist_id: 'a', title_en: 'old', title_is: '', instructions_en: '', instructions_is: '', media_ids: [] }],
    });
    const newer = mkChecklist('a', 'New', '2026-03-01T00:00:00Z', {
      items: [{ id: 'i2', checklist_id: 'a', title_en: 'new', title_is: '', instructions_en: '', instructions_is: '', media_ids: [] }],
    });
    const m1 = mergeBundles(mkBundle([older]), mkBundle([newer]), NOW);
    expect(m1.checklists[0].name_en).toBe('New');
    expect(m1.checklists[0].items.map((i) => i.id)).toEqual(['i2']);
    const m2 = mergeBundles(mkBundle([newer]), mkBundle([older]), NOW);
    expect(m2.checklists[0].name_en).toBe('New');
  });
});

describe('mergeBundles: tombstones', () => {
  it('a deletion beats an older edit', () => {
    // Both stamps must be within the 90-day tombstone TTL of NOW.
    const local = mkBundle([mkChecklist('a', 'A', '2026-05-01T00:00:00Z')]);
    const remote = mkBundle([], { tombstones: [{ id: 'a', deleted_at: '2026-06-01T00:00:00Z' }] });
    const m = mergeBundles(local, remote, NOW);
    expect(m.checklists).toEqual([]);
    expect(m.tombstones.map((t) => t.id)).toEqual(['a']);
  });

  it('a newer edit resurrects: beats an older deletion and drops the tombstone', () => {
    const local = mkBundle([mkChecklist('a', 'A', '2026-06-01T00:00:00Z')]);
    const remote = mkBundle([], { tombstones: [{ id: 'a', deleted_at: '2026-05-01T00:00:00Z' }] });
    const m = mergeBundles(local, remote, NOW);
    expect(m.checklists.map((c) => c.id)).toEqual(['a']);
    expect(m.tombstones).toEqual([]);
  });

  it('prunes tombstones older than 90 days, keeps newer ones', () => {
    const local = mkBundle([], {
      tombstones: [
        { id: 'ancient', deleted_at: '2026-01-01T00:00:00Z' }, // > 90 days before NOW
        { id: 'recent', deleted_at: '2026-06-01T00:00:00Z' },
      ],
    });
    const m = mergeBundles(local, emptyBundle(), NOW);
    expect(m.tombstones.map((t) => t.id)).toEqual(['recent']);
  });
});

describe('mergeBundles: shared unit', () => {
  it('newer shared stamp wins wholesale', () => {
    const local = mkBundle([], { shared: { users: ['Anna'], info_entries: [], updated_at: '2026-02-01T00:00:00Z' } });
    const remote = mkBundle([], { shared: { users: ['Kári'], info_entries: [], updated_at: '2026-03-01T00:00:00Z' } });
    expect(mergeBundles(local, remote, NOW).shared.users).toEqual(['Kári']);
    expect(mergeBundles(remote, local, NOW).shared.users).toEqual(['Kári']);
  });

  it('local wins ties (fresh empty remote never clobbers local)', () => {
    const local = mkBundle([], { shared: { users: ['Anna'], info_entries: [], updated_at: '' } });
    expect(mergeBundles(local, emptyBundle(), NOW).shared.users).toEqual(['Anna']);
  });
});
