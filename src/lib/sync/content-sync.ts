import { getSettings, saveSyncState } from '$lib/db/repos';
import { loadSettings } from '$lib/stores/settings';
import { syncStatus, contentVersion } from '$lib/stores/syncStatus';
import { buildBundle, applyBundle } from './content-io';
import { mergeBundles, bundlesEqual, emptyBundle, referencedMediaIds } from './bundle';
import { pullContent, pushContent } from './content-client';
import { syncMedia } from './media-sync';

let inFlight = false;
let queued = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let retryCount = 0;

// Apps Script cold-starts after idle and the first request routinely exceeds
// the client timeout, so a failed sync retries on its own instead of waiting
// for the next edit/open/reconnect trigger.
const RETRY_DELAYS_MS = [5_000, 15_000, 45_000];

export function scheduleSync(delayMs = 4000): void {
  retryCount = 0; // a fresh trigger deserves a fresh set of retries
  schedule(delayMs);
}

function schedule(delayMs: number): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void syncContent();
  }, delayMs);
}

// Cancel any pending debounce and sync immediately (explicit save button).
export function syncNow(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  retryCount = 0;
  void syncContent();
}

// If a debounced sync is pending, run it right now. Called when the app is
// backgrounded/closed — the last chance to push edits before the page dies.
export function flushSync(): void {
  if (debounceTimer) syncNow();
}

// Test hook: clear timers and retry state between tests.
export function _resetSyncScheduling(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  retryCount = 0;
  queued = false;
}

export async function syncContent(): Promise<void> {
  const settings = await getSettings();
  if (!settings.endpoint_url || !navigator.onLine) return;
  if (inFlight) {
    queued = true;
    return;
  }
  inFlight = true;
  syncStatus.update((s) => ({ ...s, state: 'syncing' }));

  try {
    const { endpoint_url: url, shared_secret: secret } = settings;
    const pulled = await pullContent(url, secret);
    if (pulled.status !== 'ok') throw new Error(pulled.error);

    const remote = pulled.bundle ?? emptyBundle();
    const local = await buildBundle();
    const now = new Date().toISOString();
    let merged = mergeBundles(local, remote, now);

    if (!bundlesEqual(merged, local)) {
      await applyBundle(merged);
      await loadSettings();
      contentVersion.update((n) => n + 1);
    }

    let rev = pulled.rev;
    if (!bundlesEqual(merged, remote)) {
      let pushed = await pushContent(url, secret, rev, merged);
      if (pushed.status === 'conflict') {
        // Someone pushed between our pull and push: fold their state in once.
        merged = mergeBundles(merged, pushed.bundle, now);
        await applyBundle(merged);
        await loadSettings();
        contentVersion.update((n) => n + 1);
        pushed = await pushContent(url, secret, pushed.rev, merged);
      }
      if (pushed.status !== 'ok') {
        throw new Error(pushed.status === 'conflict' ? 'push conflict' : pushed.error);
      }
      rev = pushed.rev;
    }

    await syncMedia(referencedMediaIds(merged), url, secret);
    await saveSyncState({ last_synced_rev: rev, last_synced_at: now, last_error: null });
    syncStatus.set({ state: 'idle', lastSyncedAt: now, error: null });
    retryCount = 0;
  } catch (e) {
    const msg = String((e as Error).message ?? e);
    await saveSyncState({ last_error: msg });
    syncStatus.update((s) => ({ ...s, state: 'error', error: msg }));
    if (retryCount < RETRY_DELAYS_MS.length) {
      schedule(RETRY_DELAYS_MS[retryCount]);
      retryCount++;
    }
  } finally {
    inFlight = false;
    if (queued) {
      queued = false;
      scheduleSync(0);
    }
  }
}
