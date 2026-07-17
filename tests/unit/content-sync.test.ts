import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { db } from '$lib/db/schema';
import { createChecklist, saveSettings, getSyncState } from '$lib/db/repos';
import {
  syncContent, scheduleSync, syncNow, flushSync, _resetSyncScheduling,
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
  _resetSyncScheduling();
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

// Give in-flight Dexie/fake-indexeddb work (which runs on the real
// setImmediate, unaffected by fake timers) enough event-loop turns to finish.
const flushIDB = async () => {
  for (let i = 0; i < 25; i++) await new Promise((r) => setImmediate(r));
};

// Only fake setTimeout so the debounce/retry timers are controllable while
// IndexedDB keeps running on the real event loop.
const fakeTimeouts = () => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

describe('retry after failure', () => {
  it('retries automatically after a failed sync', async () => {
    fakeTimeouts();
    vi.mocked(pullContent)
      .mockResolvedValueOnce({ status: 'error', error: 'request timed out after 20000ms' })
      .mockResolvedValue({ status: 'ok', rev: 0, bundle: null });
    vi.mocked(pushContent).mockResolvedValue({ status: 'ok', rev: 1 });

    await syncContent();
    expect(pullContent).toHaveBeenCalledTimes(1);
    expect(get(syncStatus).state).toBe('error');

    await vi.advanceTimersByTimeAsync(5_000); // first retry fires
    await flushIDB();
    expect(pullContent).toHaveBeenCalledTimes(2);
    expect(get(syncStatus).state).toBe('idle');
  });

  it('gives up after exhausting the retry schedule', async () => {
    fakeTimeouts();
    vi.mocked(pullContent).mockResolvedValue({ status: 'error', error: 'HTTP 500' });

    await syncContent();
    for (const delay of [5_000, 15_000, 45_000]) {
      await vi.advanceTimersByTimeAsync(delay);
      await flushIDB();
    }
    expect(pullContent).toHaveBeenCalledTimes(4); // initial + 3 retries

    await vi.advanceTimersByTimeAsync(600_000); // no further attempts
    await flushIDB();
    expect(pullContent).toHaveBeenCalledTimes(4);
  });
});

describe('syncNow / flushSync', () => {
  beforeEach(() => {
    vi.mocked(pullContent).mockResolvedValue({ status: 'ok', rev: 0, bundle: null });
    vi.mocked(pushContent).mockResolvedValue({ status: 'ok', rev: 1 });
  });

  it('syncNow cancels a pending debounce and syncs immediately', async () => {
    fakeTimeouts();
    scheduleSync(); // debounced sync 4s away
    syncNow();
    await flushIDB();
    expect(pullContent).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(10_000); // cancelled debounce must not fire again
    await flushIDB();
    expect(pullContent).toHaveBeenCalledTimes(1);
  });

  it('flushSync runs a pending debounced sync right away', async () => {
    fakeTimeouts();
    scheduleSync();
    flushSync();
    await flushIDB();
    expect(pullContent).toHaveBeenCalledTimes(1);
  });

  it('flushSync is a no-op when nothing is pending', async () => {
    flushSync();
    await flushIDB();
    expect(pullContent).not.toHaveBeenCalled();
  });
});
