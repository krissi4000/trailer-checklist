import { describe, expect, it } from 'vitest';
import { db } from '$lib/db/schema';
import { getSettings, getSyncState, saveSyncState } from '$lib/db/repos';

describe('schema v2', () => {
  it('exposes the tombstones and sync_state tables', () => {
    expect(db.tombstones).toBeDefined();
    expect(db.sync_state).toBeDefined();
  });

  it('defaults shared_updated_at to the empty string (oldest possible stamp)', async () => {
    const s = await getSettings();
    expect(s.shared_updated_at).toBe('');
  });
});

describe('sync_state repo', () => {
  it('returns defaults when nothing is stored', async () => {
    const st = await getSyncState();
    expect(st).toEqual({
      id: 'singleton',
      last_synced_rev: 0,
      last_synced_at: null,
      last_error: null,
    });
  });

  it('persists partial updates', async () => {
    await saveSyncState({ last_synced_rev: 3, last_synced_at: '2026-07-06T10:00:00Z' });
    await saveSyncState({ last_error: 'boom' });
    const st = await getSyncState();
    expect(st.last_synced_rev).toBe(3);
    expect(st.last_error).toBe('boom');
  });
});
