import { writable } from 'svelte/store';

export interface SyncStatusState {
  state: 'idle' | 'syncing' | 'error';
  lastSyncedAt: string | null;
  error: string | null;
}

export const syncStatus = writable<SyncStatusState>({
  state: 'idle',
  lastSyncedAt: null,
  error: null,
});

// Bumped whenever a sync applied remote changes locally; screens listing
// content re-query when it changes.
export const contentVersion = writable(0);
