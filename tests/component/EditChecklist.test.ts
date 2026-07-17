import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import EditChecklist from '$screens/EditChecklist.svelte';
import { createChecklist, addItem } from '$lib/db/repos';
import { language } from '$lib/i18n/store';
import { db } from '$lib/db/schema';
import { syncNow } from '$lib/sync/content-sync';
import { reset, navigate, screenStack } from '$lib/stores/screen';

vi.mock('$lib/sync/content-sync', () => ({
  syncNow: vi.fn(),
}));

describe('EditChecklist', () => {
  beforeEach(async () => {
    await db.open();
    language.set('is');
    vi.clearAllMocks();
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

  it('checkmark saves: syncs immediately and navigates back', async () => {
    const cl = await createChecklist({ name_en: 'X', name_is: 'X' });
    reset();
    navigate({ name: 'editChecklist', checklistId: cl.id });
    render(EditChecklist, { props: { checklistId: cl.id } });

    await fireEvent.click(screen.getByLabelText('Save'));

    expect(syncNow).toHaveBeenCalled();
    expect(get(screenStack)).toHaveLength(1); // popped back off the stack
  });
});
