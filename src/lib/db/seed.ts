import { db } from './schema';
import { createChecklist, addItem, saveSettings } from './repos';

export async function seedIfEmpty(): Promise<void> {
  const count = await db.checklists.count();
  if (count > 0) return;

  await saveSettings({ users: ['Family member'], language: 'en' });

  const leaving = await createChecklist({ name_en: 'Leaving', name_is: 'Brottför' });
  await addItem(leaving.id, {
    title_en: 'Empty toilet tank', title_is: 'Tæma klósettank',
    instructions_en: 'Open the valve at the rear, wait until empty.',
    instructions_is: 'Opnaðu lokann að aftan, bíddu þar til tankur er tómur.',
    media_ids: [],
  });
  await addItem(leaving.id, {
    title_en: 'Turn off the lights', title_is: 'Slökkva ljósin',
    instructions_en: '', instructions_is: '', media_ids: [],
  });
  await addItem(leaving.id, {
    title_en: 'Lock the door', title_is: 'Læsa hurðinni',
    instructions_en: '', instructions_is: '', media_ids: [],
  });

  const arriving = await createChecklist({ name_en: 'Arriving', name_is: 'Koma' });
  await addItem(arriving.id, {
    title_en: 'Turn on the water', title_is: 'Opna fyrir vatnið',
    instructions_en: '', instructions_is: '', media_ids: [],
  });
  await addItem(arriving.id, {
    title_en: 'Check gas level', title_is: 'Athuga gasstöðu',
    instructions_en: '', instructions_is: '', media_ids: [],
  });
}
