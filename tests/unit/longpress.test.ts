import { describe, expect, it, vi } from 'vitest';
import { longpress } from '$lib/utils/longpress';

describe('longpress', () => {
  it('dispatches longpress event after duration', async () => {
    vi.useFakeTimers();
    const el = document.createElement('button');
    document.body.appendChild(el);
    const handler = vi.fn();
    el.addEventListener('longpress', handler);
    longpress(el, 1500);
    el.dispatchEvent(new PointerEvent('pointerdown'));
    vi.advanceTimersByTime(1499);
    expect(handler).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2);
    expect(handler).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('suppresses the native context menu so touch long-press is not cancelled', () => {
    vi.useFakeTimers();
    const el = document.createElement('button');
    const handler = vi.fn();
    el.addEventListener('longpress', handler);
    longpress(el, 1500);
    el.dispatchEvent(new PointerEvent('pointerdown'));
    // Android fires contextmenu ~500ms into a press; if not prevented, the
    // browser takes over the gesture and pointercancels our timer.
    vi.advanceTimersByTime(500);
    const menu = new MouseEvent('contextmenu', { cancelable: true });
    el.dispatchEvent(menu);
    expect(menu.defaultPrevented).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(handler).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('cancels on pointerup before duration', async () => {
    vi.useFakeTimers();
    const el = document.createElement('button');
    const handler = vi.fn();
    el.addEventListener('longpress', handler);
    longpress(el, 1500);
    el.dispatchEvent(new PointerEvent('pointerdown'));
    el.dispatchEvent(new PointerEvent('pointerup'));
    vi.advanceTimersByTime(2000);
    expect(handler).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
