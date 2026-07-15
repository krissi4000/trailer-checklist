import { db } from './schema';
import { DEFAULT_SETTINGS } from './repos';

// Fixed ids: every fresh install seeds the same records, so seeds collide by
// id when devices sync instead of duplicating. Fixed past timestamp: a fresh
// install's seed must always lose last-write-wins against a list the user has
// actually edited on another device.
export const SEED_TIME = '2026-01-01T00:00:00.000Z';

export async function seedIfEmpty(): Promise<void> {
  const count = await db.checklists.count();
  if (count > 0) return;

  const existing = await db.settings.get('singleton');
  if (!existing) {
    // Direct put, not saveSettings: seeding must not stamp shared_updated_at,
    // or a fresh device would win the shared merge unit and wipe real data.
    await db.settings.put({ ...DEFAULT_SETTINGS, users: ['Family member'] });
  }

  await db.checklists.bulkAdd([
    {
      id: 'seed-leaving', name_en: 'Leaving', name_is: 'Brottför',
      item_order: ['seed-leaving-1', 'seed-leaving-2', 'seed-leaving-3'],
      created_at: SEED_TIME, updated_at: SEED_TIME,
    },
    {
      id: 'seed-arriving', name_en: 'Arriving', name_is: 'Koma',
      item_order: ['seed-arriving-1', 'seed-arriving-2'],
      created_at: SEED_TIME, updated_at: SEED_TIME,
    },
  ]);

  await db.items.bulkAdd([
    {
      id: 'seed-leaving-1', checklist_id: 'seed-leaving',
      title_en: 'Empty toilet tank', title_is: 'Tæma klósettank',
      instructions_en: 'Open the valve at the rear, wait until empty.',
      instructions_is: 'Opnaðu lokann að aftan, bíddu þar til tankur er tómur.',
      media_ids: [],
    },
    {
      id: 'seed-leaving-2', checklist_id: 'seed-leaving',
      title_en: 'Turn off the lights', title_is: 'Slökkva ljósin',
      instructions_en: '', instructions_is: '', media_ids: [],
    },
    {
      id: 'seed-leaving-3', checklist_id: 'seed-leaving',
      title_en: 'Lock the door', title_is: 'Læsa hurðinni',
      instructions_en: '', instructions_is: '', media_ids: [],
    },
    {
      id: 'seed-arriving-1', checklist_id: 'seed-arriving',
      title_en: 'Turn on the water', title_is: 'Opna fyrir vatnið',
      instructions_en: '', instructions_is: '', media_ids: [],
    },
    {
      id: 'seed-arriving-2', checklist_id: 'seed-arriving',
      title_en: 'Check gas level', title_is: 'Athuga gasstöðu',
      instructions_en: '', instructions_is: '', media_ids: [],
    },
  ]);
}
