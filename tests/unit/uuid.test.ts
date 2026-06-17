import { describe, expect, it } from 'vitest';
import { uuid } from '$lib/utils/uuid';

describe('uuid', () => {
  it('returns a v4-shaped string', () => {
    const id = uuid();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
  it('returns unique values across many calls', () => {
    const set = new Set(Array.from({ length: 1000 }, uuid));
    expect(set.size).toBe(1000);
  });
});
