import { writable } from 'svelte/store';
import { pendingRuns } from '$lib/db/repos';

const _pending = writable<number>(0);

export const pending = { subscribe: _pending.subscribe };

export async function refreshPending(): Promise<void> {
  const list = await pendingRuns();
  _pending.set(list.length);
}
