import { describe, expect, it } from 'vitest';
import { db } from '$lib/db/schema';
import { seedIfEmpty, SEED_TIME } from '$lib/db/seed';
import { getSettings, createChecklist } from '$lib/db/repos';

describe('seedIfEmpty', () => {
  it('creates checklists with fixed ids and the fixed seed timestamp', async () => {
    await seedIfEmpty();
    const leaving = await db.checklists.get('seed-leaving');
    const arriving = await db.checklists.get('seed-arriving');
    expect(leaving?.name_is).toBe('Brottför');
    expect(arriving?.name_is).toBe('Koma');
    expect(leaving?.updated_at).toBe(SEED_TIME);
    const items = await db.items.where('checklist_id').equals('seed-leaving').toArray();
    expect(items.length).toBe(3);
  });

  it('does not stamp shared_updated_at', async () => {
    await seedIfEmpty();
    expect((await getSettings()).shared_updated_at).toBe('');
  });

  it('is a no-op when checklists already exist', async () => {
    await createChecklist({ name_en: 'X', name_is: 'X' });
    await seedIfEmpty();
    expect(await db.checklists.get('seed-leaving')).toBeUndefined();
  });
});
