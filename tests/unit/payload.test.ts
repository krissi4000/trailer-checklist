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
