import { describe, expect, it } from 'vitest';
import { db } from '$lib/db/schema';

describe('db schema', () => {
  it('exposes the expected tables', () => {
    expect(db.checklists).toBeDefined();
    expect(db.items).toBeDefined();
    expect(db.media).toBeDefined();
    expect(db.runs).toBeDefined();
    expect(db.settings).toBeDefined();
  });

  it('opens without error', async () => {
    await db.open();
    expect(db.isOpen()).toBe(true);
  });
});
