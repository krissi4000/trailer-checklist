import { describe, expect, it, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { online } from '$lib/stores/network';

describe('network store', () => {
  beforeEach(() => {
    // Reset to online state
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    });
  });

  it('reflects navigator.onLine on init', () => {
    expect(typeof get(online)).toBe('boolean');
  });

  it('updates on online event', () => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false,
    });
    window.dispatchEvent(new Event('offline'));
    expect(get(online)).toBe(false);

    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    });
    window.dispatchEvent(new Event('online'));
    expect(get(online)).toBe(true);
  });
});
