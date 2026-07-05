import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import Settings from '$screens/Settings.svelte';
import { language } from '$lib/i18n/store';
import { loadSettings } from '$lib/stores/settings';
import { db } from '$lib/db/schema';
import { currentScreen, reset } from '$lib/stores/screen';

describe('Settings', () => {
  beforeEach(async () => {
    language.set('en');
    reset();
    await db.open();
    await loadSettings();
  });

  it('has an edit checklists button that opens the checklist editor', async () => {
    render(Settings);
    await fireEvent.click(await screen.findByText(/Edit checklists/));
    expect(get(currentScreen)).toEqual({ name: 'editList' });
  });
});
