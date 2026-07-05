import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import Settings from '$screens/Settings.svelte';
import { language } from '$lib/i18n/store';
import { loadSettings } from '$lib/stores/settings';
import { getSettings, saveSettings } from '$lib/db/repos';
import { db } from '$lib/db/schema';
import { currentScreen, reset } from '$lib/stores/screen';

describe('Settings', () => {
  beforeEach(async () => {
    reset();
    await db.open();
    await loadSettings();
    language.set('en');
  });

  it('has an edit checklists button that opens the checklist editor', async () => {
    render(Settings);
    await fireEvent.click(await screen.findByText(/Edit checklists/));
    expect(get(currentScreen)).toEqual({ name: 'editList' });
  });

  it('adds an info entry from the info section', async () => {
    render(Settings);
    await fireEvent.click(await screen.findByText(/Add info/));
    await vi.waitFor(async () => {
      expect((await getSettings()).info_entries).toHaveLength(1);
    });
  });

  it('edits an info entry value and persists it', async () => {
    await saveSettings({
      info_entries: [{ id: 'i1', label_en: 'WiFi', label_is: 'WiFi', value: 'old' }],
    });
    await loadSettings();
    render(Settings);
    const value = await screen.findByDisplayValue('old');
    await fireEvent.input(value, { target: { value: 'new-pass' } });
    await vi.waitFor(async () => {
      expect((await getSettings()).info_entries[0].value).toBe('new-pass');
    });
  });
});
