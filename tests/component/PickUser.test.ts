import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import PickUser from '$screens/PickUser.svelte';
import { language } from '$lib/i18n/store';
import { loadSettings } from '$lib/stores/settings';
import { getSettings, saveSettings, createChecklist } from '$lib/db/repos';
import { db } from '$lib/db/schema';
import { currentScreen, reset } from '$lib/stores/screen';

describe('PickUser', () => {
  beforeEach(async () => {
    reset();
    await db.open();
    await saveSettings({ users: ['Embla'] });
    await loadSettings();
    language.set('is');
  });

  it('lists existing users', async () => {
    const cl = await createChecklist({ name_en: 'X', name_is: 'X' });
    render(PickUser, { props: { checklistId: cl.id } });
    expect(await screen.findByText('Embla')).toBeInTheDocument();
  });

  it('creates a new guest and starts the run as them', async () => {
    const cl = await createChecklist({ name_en: 'X', name_is: 'X' });
    render(PickUser, { props: { checklistId: cl.id } });
    await fireEvent.click(await screen.findByText(/Nýr gestur/));
    const input = screen.getByRole('textbox');
    await fireEvent.input(input, { target: { value: 'Kári' } });
    await fireEvent.click(screen.getByLabelText('OK'));
    await vi.waitFor(async () => {
      expect((await getSettings()).users).toContain('Kári');
    });
    expect(get(currentScreen)).toEqual({ name: 'run', checklistId: cl.id, user: 'Kári' });
  });
});
