import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import App from '../../src/App.svelte';
import { syncContent, flushSync } from '$lib/sync/content-sync';

vi.mock('$lib/sync/content-sync', () => ({
  syncContent: vi.fn().mockResolvedValue(undefined),
  scheduleSync: vi.fn(),
  flushSync: vi.fn(),
}));

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('App sync wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    setVisibility('visible');
  });

  it('kicks off a content sync on startup', async () => {
    render(App);
    await vi.waitFor(() => expect(syncContent).toHaveBeenCalled());
  });

  it('flushes a pending sync when the app is backgrounded', async () => {
    const docSpy = vi.spyOn(document, 'addEventListener');
    render(App);
    // onMount wires the listeners in its async tail — wait for registration.
    await vi.waitFor(() =>
      expect(docSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function)),
    );
    vi.clearAllMocks();
    setVisibility('hidden');
    expect(flushSync).toHaveBeenCalledTimes(1);
    expect(syncContent).not.toHaveBeenCalled();
  });

  it('syncs when the app returns to the foreground', async () => {
    const docSpy = vi.spyOn(document, 'addEventListener');
    render(App);
    await vi.waitFor(() =>
      expect(docSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function)),
    );
    setVisibility('hidden');
    vi.clearAllMocks();
    setVisibility('visible');
    expect(syncContent).toHaveBeenCalledTimes(1);
    expect(flushSync).not.toHaveBeenCalled();
  });

  it('flushes a pending sync on pagehide', async () => {
    const winSpy = vi.spyOn(window, 'addEventListener');
    render(App);
    await vi.waitFor(() =>
      expect(winSpy).toHaveBeenCalledWith('pagehide', expect.any(Function)),
    );
    vi.clearAllMocks();
    window.dispatchEvent(new Event('pagehide'));
    expect(flushSync).toHaveBeenCalledTimes(1);
  });
});
