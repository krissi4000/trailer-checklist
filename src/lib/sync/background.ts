const TAG = 'trailer-runs-sync';

export async function requestBackgroundSync(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('SyncManager' in globalThis)) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    // @ts-expect-error SyncManager typing not in lib.dom
    await reg.sync.register(TAG);
    return true;
  } catch {
    return false;
  }
}
