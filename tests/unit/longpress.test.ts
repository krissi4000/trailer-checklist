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
