import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import App from '../../src/App.svelte';
import { syncContent } from '$lib/sync/content-sync';

vi.mock('$lib/sync/content-sync', () => ({
  syncContent: vi.fn().mockResolvedValue(undefined),
  scheduleSync: vi.fn(),
}));

describe('App sync wiring', () => {
  it('kicks off a content sync on startup', async () => {
    render(App);
    await vi.waitFor(() => expect(syncContent).toHaveBeenCalled());
  });
});
