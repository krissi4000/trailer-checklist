import { describe, expect, it } from 'vitest';
import { nextDelayMs, MAX_ATTEMPTS, isTerminal } from '$lib/sync/backoff';

describe('backoff', () => {
  it('produces increasing delays capped at 5 minutes', () => {
    expect(nextDelayMs(0)).toBe(1_000);
    expect(nextDelayMs(1)).toBe(2_000);
    expect(nextDelayMs(2)).toBe(4_000);
    expect(nextDelayMs(8)).toBe(256_000);
    expect(nextDelayMs(20)).toBe(300_000);
  });

  it('isTerminal after MAX_ATTEMPTS attempts', () => {
    expect(MAX_ATTEMPTS).toBe(10);
    expect(isTerminal(MAX_ATTEMPTS - 1)).toBe(false);
    expect(isTerminal(MAX_ATTEMPTS)).toBe(true);
  });
});
