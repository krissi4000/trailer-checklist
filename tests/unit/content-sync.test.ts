import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { db } from '$lib/db/schema';
import { createChecklist, saveSettings, getSyncState } from '$lib/db/repos';
import {
  syncContent, syncNow, flushSync, scheduleSync, cancelScheduledSync,
} from '$lib/sync/content-sync';
import { pullContent, pushContent } from '$lib/sync/content-client';
import { syncMedia } from '$lib/sync/media-sync';
import { syncStatus, contentVersion } from '$lib/stores/syncStatus';
import { emptyBundle, type ContentBundle } from '$lib/sync/bundle';
import { buildBundle } from '$lib/sync/content-io';

vi.mock('$lib/sync/content-client', () => ({
  pullContent: vi.fn(),
  pushContent: vi.fn(),
}));
vi.mock('$lib/sync/media-sync', () => ({
  syncMedia: vi.fn().mockResolvedValue(undefined),
}));

const URL_ = 'https://example.test/exec';

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(syncMedia).mockResolvedValue(undefined);
  syncStatus.set({ state: 'idle', lastSyncedAt: null, error: null });
  await saveSettings({ endpoint_url: URL_, shared_secret: 's' });
});

afterEach(() => {
  // Clear any pending debounce/retry timers so they can't fire in a later test.
  cancelScheduledSync();
  vi.useRealTimers();
});

describe('syncContent', () => {
  it('does nothing without an endpoint', async () => {
    await saveSettings({ endpoint_url: '' });
    await syncContent();
    expect(pullContent).not.toHaveBeenCalled();
  });

  it('first sync against an empty server pushes local content', async () => {
    await createChecklist({ name_en: 'Mine', name_is: 'Mín' });
    vi.mocked(pullContent).mockResolvedValue({ status: 'ok', rev: 0, bundle: null });
    vi.mocked(pushContent).mockResolvedValue({ status: 'ok', rev: 1 });

    await syncContent();

    expect(pushContent).toHaveBeenCalledTimes(1);
    const [, , baseRev, pushed] = vi.mocked(pushContent).mock.calls[0];
    expect(baseRev).toBe(0);
    expect((pushed as ContentBundle).checklists.map((c) => c.name_en)).toEqual(['Mine']);
    expect((await getSyncState()).last_synced_rev).toBe(1);
    expect(get(syncStatus).state).toBe('idle');
    expect(get(syncStatus).lastSyncedAt).not.toBeNull();
  });

  it('applies newer remote content locally and bumps contentVersion', async () => {
    const remote = emptyBundle();
    remote.checklists = [{
      id: 'r1', name_en: 'Remote', name_is: 'Remote',
      item_order: [], created_at: '2026-06-01T00:00:00Z', updated_at: '2026-06-01T00:00:00Z',
      items: [],
    }];
    vi.mocked(pullContent).mockResolvedValue({ status: 'ok', rev: 3, bundle: remote });
    const before = get(contentVersion);

    await syncContent();

    expect((await db.checklists.get('r1'))?.name_en).toBe('Remote');
    expect(pushContent).not.toHaveBeenCalled(); // merged === remote, nothing to push
    expect(get(contentVersion)).toBe(before + 1);
    expect(vi.mocked(syncMedia)).toHaveBeenCalled();
  });

  it('re-merges and re-pushes once on conflict', async () => {
    await createChecklist({ name_en: 'Mine', name_is: 'Mín' });
    const serverNow = emptyBundle();
    serverNow.checklists = [{
      id: 'r1', name_en: 'Theirs', name_is: 'Theirs',
      item_order: [], created_at: '2026-06-01T00:00:00Z', updated_at: '2026-06-01T00:00:00Z',
      items: [],
    }];
    vi.mocked(pullContent).mockResolvedValue({ status: 'ok', rev: 0, bundle: null });
    vi.mocked(pushContent)
      .mockResolvedValueOnce({ status: 'conflict', rev: 2, bundle: serverNow })
      .mockResolvedValueOnce({ status: 'ok', rev: 3 });

    await syncContent();

    expect(pushContent).toHaveBeenCalledTimes(2);
    expect(vi.mocked(pushContent).mock.calls[1][2]).toBe(2); // retried with server rev
    const final = await buildBundle();
    expect(final.checklists.map((c) => c.name_en).sort()).toEqual(['Mine', 'Theirs']);
    expect((await getSyncState()).last_synced_rev).toBe(3);
  });

  it('records errors without throwing', async () => {
    vi.useFakeTimers(); // a failed sync schedules a retry timer; keep it fake so it can't leak
    vi.mocked(pullContent).mockResolvedValue({ status: 'error', error: 'HTTP 500' });
    await syncContent();
    expect(get(syncStatus).state).toBe('error');
    expect((await getSyncState()).last_error).toContain('HTTP 500');
  });

  it('runs one sync at a time and queues a follow-up', async () => {
    let release!: (v: { status: 'ok'; rev: number; bundle: null }) => void;
    vi.mocked(pullContent).mockReturnValueOnce(new Promise((r) => { release = r; }));
    vi.mocked(pullContent).mockResolvedValue({ status: 'ok', rev: 0, bundle: null });
    vi.mocked(pushContent).mockResolvedValue({ status: 'ok', rev: 1 });

    const first = syncContent();
    await syncContent(); // while first is in flight -> queued
    expect(pullContent).toHaveBeenCalledTimes(1);
    release({ status: 'ok', rev: 0, bundle: null });
    await first;
    await vi.waitFor(() => expect(pullContent).toHaveBeenCalledTimes(2));
  });
});

describe('backoff retry', () => {
  // Dexie (fake-indexeddb) schedules via setImmediate, which fake timers also
  // freeze. Advance the clock, then pump the immediate queue so the in-catch
  // saveSyncState settles and the next retry timer actually gets scheduled.
  async function advance(ms: number) {
    await vi.advanceTimersByTimeAsync(ms);
    // Pump the setImmediate queue repeatedly so the full Dexie chain
    // (buildBundle → syncMedia → saveSyncState) settles before assertions.
    for (let i = 0; i < 30; i++) {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(0);
    }
  }

  it('retries a failed sync at 5s, 15s, 45s then gives up', async () => {
    vi.useFakeTimers();
    vi.mocked(pullContent).mockResolvedValue({ status: 'error', error: 'HTTP 500' });

    await syncContent();
    await advance(0);
    expect(pullContent).toHaveBeenCalledTimes(1);

    await advance(5000);
    expect(pullContent).toHaveBeenCalledTimes(2);

    await advance(15000);
    expect(pullContent).toHaveBeenCalledTimes(3);

    await advance(45000);
    expect(pullContent).toHaveBeenCalledTimes(4);

    // Retries exhausted — no further attempts on their own.
    await advance(120000);
    expect(pullContent).toHaveBeenCalledTimes(4);
  });

  it('stops retrying once a retry succeeds', async () => {
    vi.useFakeTimers();
    vi.mocked(pullContent)
      .mockResolvedValueOnce({ status: 'error', error: 'HTTP 500' })
      .mockResolvedValue({ status: 'ok', rev: 0, bundle: null });
    vi.mocked(pushContent).mockResolvedValue({ status: 'ok', rev: 1 });

    await syncContent();
    await advance(0);
    expect(get(syncStatus).state).toBe('error');

    await advance(5000);
    expect(get(syncStatus).state).toBe('idle');

    // Success cleared the backoff — no lingering 15s retry.
    await advance(60000);
    expect(pullContent).toHaveBeenCalledTimes(2);
  });

  it('a fresh manual trigger restarts the backoff sequence', async () => {
    vi.useFakeTimers();
    vi.mocked(pullContent).mockResolvedValue({ status: 'error', error: 'HTTP 500' });

    await syncContent(); // attempt 1, schedules retry #1 at 5s
    await advance(5000); // retry #1 fires, schedules #2 at 15s
    expect(pullContent).toHaveBeenCalledTimes(2);

    await syncContent(); // manual trigger: resets the counter, attempt again now
    await advance(0);
    expect(pullContent).toHaveBeenCalledTimes(3);
    await advance(5000); // fresh sequence -> next retry at 5s again
    expect(pullContent).toHaveBeenCalledTimes(4);
  });
});

describe('syncNow / flushSync', () => {
  it('syncNow cancels a pending debounce and syncs immediately', async () => {
    vi.useFakeTimers();
    vi.mocked(pullContent).mockResolvedValue({ status: 'ok', rev: 0, bundle: null });

    scheduleSync(4000); // a debounced edit-sync is pending
    await syncNow();
    expect(pullContent).toHaveBeenCalledTimes(1);

    // The debounce was cancelled, so it must not fire a second sync.
    await vi.advanceTimersByTimeAsync(4000);
    expect(pullContent).toHaveBeenCalledTimes(1);
  });

  it('flushSync runs a pending debounced sync immediately', async () => {
    vi.useFakeTimers();
    vi.mocked(pullContent).mockResolvedValue({ status: 'ok', rev: 0, bundle: null });

    scheduleSync(4000);
    flushSync();
    await vi.advanceTimersByTimeAsync(0);
    expect(pullContent).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(4000);
    expect(pullContent).toHaveBeenCalledTimes(1); // not fired again
  });

  it('flushSync is a no-op when no sync is pending', async () => {
    vi.useFakeTimers();
    vi.mocked(pullContent).mockResolvedValue({ status: 'ok', rev: 0, bundle: null });

    flushSync();
    await vi.advanceTimersByTimeAsync(10000);
    expect(pullContent).not.toHaveBeenCalled();
  });
});
