import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import RunChecklist from '$screens/RunChecklist.svelte';
import { createChecklist, addItem, saveSettings } from '$lib/db/repos';
import { loadSettings } from '$lib/stores/settings';
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

  it('shows the item description inline after a | separator', async () => {
    await db.open();
    const cl = await createChecklist({ name_en: 'X', name_is: 'X' });
    await addItem(cl.id, {
      title_en: 'Water', title_is: 'Vatn',
      instructions_en: 'Close the valve first', instructions_is: 'Lokaðu krananum', media_ids: [],
    });
    render(RunChecklist, { props: { checklistId: cl.id, user: 'A' } });
    await screen.findByText('Water');
    expect(screen.getByText(/\|\s*Close the valve first/)).toBeInTheDocument();
  });

  it('numbers the items in order', async () => {
    await db.open();
    const cl = await createChecklist({ name_en: 'X', name_is: 'X' });
    await addItem(cl.id, {
      title_en: 'First', title_is: 'Fyrsti',
      instructions_en: '', instructions_is: '', media_ids: [],
    });
    await addItem(cl.id, {
      title_en: 'Second', title_is: 'Annar',
      instructions_en: '', instructions_is: '', media_ids: [],
    });
    render(RunChecklist, { props: { checklistId: cl.id, user: 'A' } });
    await screen.findByText('First');
    expect(screen.getByText('1.')).toBeInTheDocument();
    expect(screen.getByText('2.')).toBeInTheDocument();
  });

  it('shows the info list below the checklist', async () => {
    await db.open();
    await saveSettings({
      info_entries: [
        { id: 'i1', label_en: 'WiFi password', label_is: 'WiFi lykilorð', value: 'hunter2' },
        { id: 'i2', label_en: 'Opening hours', label_is: 'Opnunartími', value: '9–17' },
      ],
    });
    await loadSettings();
    language.set('is');
    const cl = await createChecklist({ name_en: 'X', name_is: 'X' });
    await addItem(cl.id, {
      title_en: 'a', title_is: 'a',
      instructions_en: '', instructions_is: '', media_ids: [],
    });
    render(RunChecklist, { props: { checklistId: cl.id, user: 'A' } });
    await screen.findByText('WiFi lykilorð');
    expect(screen.getByText('hunter2')).toBeInTheDocument();
    expect(screen.getByText('Opnunartími')).toBeInTheDocument();
    expect(screen.getByText('9–17')).toBeInTheDocument();
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
