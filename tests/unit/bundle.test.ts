import { describe, expect, it } from 'vitest';
import { emptyBundle, referencedMediaIds, bundlesEqual } from '$lib/sync/bundle';
import { mkChecklist, mkBundle } from './bundle-fixtures';

describe('bundle helpers', () => {
  it('emptyBundle has no content and the oldest possible shared stamp', () => {
    const b = emptyBundle();
    expect(b).toEqual({
      schema: 1, checklists: [], tombstones: [],
      shared: { users: [], info_entries: [], updated_at: '' },
    });
  });

  it('referencedMediaIds collects media ids across all items', () => {
    const b = mkBundle([
      mkChecklist('a', 'A', '2026-02-01T00:00:00Z', {
        items: [
          { id: 'i1', checklist_id: 'a', title_en: '', title_is: '', instructions_en: '', instructions_is: '', media_ids: ['m1', 'm2'] },
          { id: 'i2', checklist_id: 'a', title_en: '', title_is: '', instructions_en: '', instructions_is: '', media_ids: ['m2', 'm3'] },
        ],
      }),
    ]);
    expect(referencedMediaIds(b).sort()).toEqual(['m1', 'm2', 'm3']);
  });

  it('bundlesEqual ignores array ordering of checklists, items and tombstones', () => {
    const c1 = mkChecklist('a', 'A', '2026-02-01T00:00:00Z');
    const c2 = mkChecklist('b', 'B', '2026-02-01T00:00:00Z');
    const x = mkBundle([c1, c2], { tombstones: [{ id: 't1', deleted_at: '2026-01-05T00:00:00Z' }, { id: 't2', deleted_at: '2026-01-06T00:00:00Z' }] });
    const y = mkBundle([c2, c1], { tombstones: [{ id: 't2', deleted_at: '2026-01-06T00:00:00Z' }, { id: 't1', deleted_at: '2026-01-05T00:00:00Z' }] });
    expect(bundlesEqual(x, y)).toBe(true);
  });

  it('bundlesEqual detects real differences', () => {
    const x = mkBundle([mkChecklist('a', 'A', '2026-02-01T00:00:00Z')]);
    const y = mkBundle([mkChecklist('a', 'A-changed', '2026-02-01T00:00:00Z')]);
    expect(bundlesEqual(x, y)).toBe(false);
  });
});
