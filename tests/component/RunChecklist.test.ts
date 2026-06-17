import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import RunChecklist from '$screens/RunChecklist.svelte';
import { createChecklist, addItem } from '$lib/db/repos';
import { language } from '$lib/i18n/store';
import { db } from '$lib/db/schema';

describe('RunChecklist', () => {
  beforeEach(() => {
    language.set('en');
  });

  it('shows items and toggles checked state', async () => {
    await db.open();
    const cl = await createChecklist({ name_en: 'Leaving', name_is: 'Brottför' });
    await addItem(cl.id, {
      title_en: 'Empty tank', title_is: 'Tæma tank',
      instructions_en: '', instructions_is: '', media_ids: [],
    });
    render(RunChecklist, { props: { checklistId: cl.id, user: 'A' } });
    const cb = await screen.findByRole('checkbox', { name: /Empty tank/ });
    expect((cb as HTMLInputElement).checked).toBe(false);
    await fireEvent.change(cb);
    await fireEvent.click(cb);
    // Re-query to get fresh DOM element reference
    const cbAfter = screen.getByRole('checkbox', { name: /Empty tank/ });
    expect((cbAfter as HTMLInputElement).checked).toBe(true);
  });

  it('enables submit when items exist', async () => {
    await db.open();
    const cl = await createChecklist({ name_en: 'X', name_is: 'X' });
    await addItem(cl.id, {
      title_en: 'a', title_is: 'a',
      instructions_en: '', instructions_is: '', media_ids: [],
    });
    render(RunChecklist, { props: { checklistId: cl.id, user: 'A' } });
    const btn = await screen.findByRole('button', { name: /Submit/ });
    await screen.findByRole('checkbox');
    expect(btn).not.toBeDisabled();
  });
});
