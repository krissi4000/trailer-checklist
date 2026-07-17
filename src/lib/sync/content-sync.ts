import { getSettings, saveSyncState } from '$lib/db/repos';
import { loadSettings } from '$lib/stores/settings';
import { syncStatus, contentVersion } from '$lib/stores/syncStatus';
import { buildBundle, applyBundle } from './content-io';
import { mergeBundles, bundlesEqual, emptyBundle, referencedMediaIds } from './bundle';
import { pullContent, pushContent } from './content-client';
import { syncMedia } from './media-sync';

// A cold-started Apps Script times out the first request (20 s in
// content-client), so without retries a debounced edit-push silently never
// reaches the server until the next trigger. Retry at these offsets, then wait
// for the next external trigger to start a fresh sequence.
const RETRY_DELAYS = [5000, 15000, 45000];

let inFlight = false;
let queued = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryCount = 0;

export function scheduleSync(delayMs = 4000): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void syncContent();
  }, delayMs);
}

// Cancel any pending debounced or retry sync (e.g. before shutdown or when
// starting a fresh cycle). Leaves any in-flight sync alone.
export function cancelScheduledSync(): void {
  if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
  if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
  retryCount = 0;
}

// Save button (✓) on the edit screens: skip the debounce and push right now.
export function syncNow(): Promise<void> {
  if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
  return syncContent();
}

// Backgrounding the app (visibilitychange hidden / pagehide): if an edit-sync
// is still waiting out its debounce, run it now — last chance before the page
// may be frozen or killed. No-op if nothing is pending.
export function flushSync(): void {
  if (!debounceTimer) return;
  clearTimeout(debounceTimer);
  debounceTimer = null;
  void syncContent();
}

export async function syncContent(isRetry = false): Promise<void> {
  const settings = await getSettings();
  if (!settings.endpoint_url || !navigator.onLine) return;
  if (inFlight) {
    queued = true;
    return;
  }
  // A fresh, externally-triggered sync starts a new backoff sequence.
  if (!isRetry) {
    retryCount = 0;
    if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
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
    // Success clears any in-progress backoff.
    retryCount = 0;
    if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
  } catch (e) {
    const msg = String((e as Error).message ?? e);
    await saveSyncState({ last_error: msg });
    syncStatus.update((s) => ({ ...s, state: 'error', error: msg }));
    if (retryCount < RETRY_DELAYS.length) {
      const delay = RETRY_DELAYS[retryCount];
      retryCount++;
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = setTimeout(() => { retryTimer = null; void syncContent(true); }, delay);
    }
  } finally {
    inFlight = false;
    if (queued) {
      queued = false;
      scheduleSync(0);
    }
  }
}
