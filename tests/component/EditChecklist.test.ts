import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import EditChecklist from '$screens/EditChecklist.svelte';
import { createChecklist, addItem } from '$lib/db/repos';
import { language } from '$lib/i18n/store';
import { db } from '$lib/db/schema';

describe('EditChecklist', () => {
  beforeEach(async () => {
    await db.open();
    language.set('is');
  });

  it('numbers items and shows a drag handle per row', async () => {
    const cl = await createChecklist({ name_en: 'X', name_is: 'X' });
    await addItem(cl.id, {
      title_en: 'First', title_is: 'Fyrsti',
      instructions_en: '', instructions_is: '', media_ids: [],
    });
    await addItem(cl.id, {
      title_en: 'Second', title_is: 'Annar',
      instructions_en: '', instructions_is: '', media_ids: [],
    });
    render(EditChecklist, { props: { checklistId: cl.id } });
    await screen.findByText(/Fyrsti/);
    expect(screen.getByText('1.')).toBeInTheDocument();
    expect(screen.getByText('2.')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Reorder')).toHaveLength(2);
  });

  it('shows item titles in the global language', async () => {
    const cl = await createChecklist({ name_en: 'X', name_is: 'X' });
    await addItem(cl.id, {
      title_en: 'First', title_is: 'Fyrsti',
      instructions_en: '', instructions_is: '', media_ids: [],
    });
    render(EditChecklist, { props: { checklistId: cl.id } });
    expect(await screen.findByText(/Fyrsti/)).toBeInTheDocument();
  });
});
