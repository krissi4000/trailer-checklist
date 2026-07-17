import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import { get } from 'svelte/store';
import EditItem from '$screens/EditItem.svelte';
import { createChecklist, addItem, listItems } from '$lib/db/repos';
import { db } from '$lib/db/schema';
import { language } from '$lib/i18n/store';
import { syncNow } from '$lib/sync/content-sync';
import { reset, navigate, screenStack } from '$lib/stores/screen';

vi.mock('$lib/sync/content-sync', () => ({
  syncNow: vi.fn(),
}));

describe('EditItem', () => {
  beforeEach(async () => {
    await db.open();
    language.set('en');
    vi.clearAllMocks();
  });

  it('persists title edits on input', async () => {
    const cl = await createChecklist({ name_en: 'A', name_is: 'A' });
    const it = await addItem(cl.id, {
      title_en: 'Old', title_is: '',
      instructions_en: '', instructions_is: '', media_ids: [],
    });

    render(EditItem, { props: { checklistId: cl.id, itemId: it.id } });

    // Wait for the component's onMount to complete and item to load
    await new Promise((r) => setTimeout(r, 100));

    // Get all text inputs
    const inputs = document.querySelectorAll('input[type="text"]');
    let titleInput: HTMLInputElement | null = null;

    // The first input should be the title in the first LangTabs
    for (const inp of inputs) {
      if ((inp as HTMLInputElement).value === 'Old') {
        titleInput = inp as HTMLInputElement;
        break;
      }
    }

    expect(titleInput).toBeTruthy();
    if (!titleInput) return;

    // Change the value and trigger input event
    await fireEvent.input(titleInput, { target: { value: 'New' } });

    // Give time for the update to persist
    await new Promise((r) => setTimeout(r, 100));

    // Verify the change was persisted
    const items = await listItems(cl.id);
    expect(items[0].title_en).toBe('New');
  });

  it('checkmark saves: syncs immediately and navigates back', async () => {
    const cl = await createChecklist({ name_en: 'A', name_is: 'A' });
    const it = await addItem(cl.id, {
      title_en: 'Old', title_is: '',
      instructions_en: '', instructions_is: '', media_ids: [],
    });
    reset();
    navigate({ name: 'editItem', checklistId: cl.id, itemId: it.id });
    render(EditItem, { props: { checklistId: cl.id, itemId: it.id } });

    await fireEvent.click(screen.getByLabelText('Save'));

    expect(syncNow).toHaveBeenCalled();
    expect(get(screenStack)).toHaveLength(1); // popped back off the stack
  });
});
