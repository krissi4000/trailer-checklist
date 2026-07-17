import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import App from '../../src/App.svelte';
import { syncContent, flushSync } from '$lib/sync/content-sync';

vi.mock('$lib/sync/content-sync', () => ({
  syncContent: vi.fn().mockResolvedValue(undefined),
  scheduleSync: vi.fn(),
  syncNow: vi.fn(),
  flushSync: vi.fn(),
}));

describe('App sync wiring', () => {
  it('kicks off a content sync on startup', async () => {
    render(App);
    await vi.waitFor(() => expect(syncContent).toHaveBeenCalled());
  });

  it('flushes a pending sync when the app is backgrounded', async () => {
    render(App);
    await vi.waitFor(() => expect(syncContent).toHaveBeenCalled());

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(flushSync).toHaveBeenCalled();

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    const before = vi.mocked(syncContent).mock.calls.length;
    document.dispatchEvent(new Event('visibilitychange'));
    expect(vi.mocked(syncContent).mock.calls.length).toBe(before + 1);
  });
});
