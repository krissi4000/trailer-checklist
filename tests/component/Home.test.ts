import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import Home from '$screens/Home.svelte';
import { language } from '$lib/i18n/store';
import { createChecklist } from '$lib/db/repos';
import { loadSettings } from '$lib/stores/settings';
import { db } from '$lib/db/schema';
import { currentScreen, screenStack, reset } from '$lib/stores/screen';

describe('Home', () => {
  beforeEach(async () => {
    language.set('en');
    reset();
    await db.open();
    await loadSettings();
  });

  it('shows empty state when no checklists', async () => {
    render(Home);
    expect(await screen.findByText(/No checklists yet/i)).toBeInTheDocument();
  });

  it('lists checklists with EN name', async () => {
    await createChecklist({ name_en: 'Leaving', name_is: 'Brottför' });
    render(Home);
    expect(await screen.findByText('Leaving')).toBeInTheDocument();
  });

  it('renders icelandic name when language is IS', async () => {
    await createChecklist({ name_en: 'Leaving', name_is: 'Brottför' });
    language.set('is');
    render(Home);
    expect(await screen.findByText('Brottför')).toBeInTheDocument();
  });

  it('tapping the gear opens settings', async () => {
    render(Home);
    await fireEvent.click(screen.getByLabelText('Edit'));
    expect(get(currentScreen)).toEqual({ name: 'settings' });
  });

  it('long-pressing the gear opens the checklist editor', async () => {
    vi.useFakeTimers();
    render(Home);
    const gear = screen.getByLabelText('Edit');
    gear.dispatchEvent(new PointerEvent('pointerdown'));
    vi.advanceTimersByTime(1500);
    expect(get(currentScreen)).toEqual({ name: 'editList' });
    vi.useRealTimers();
  });

  it('ignores the click fired on release after a long-press', async () => {
    vi.useFakeTimers();
    render(Home);
    const gear = screen.getByLabelText('Edit');
    gear.dispatchEvent(new PointerEvent('pointerdown'));
    vi.advanceTimersByTime(1500);
    gear.dispatchEvent(new PointerEvent('pointerup'));
    gear.click();
    expect(get(screenStack)).toEqual([{ name: 'home' }, { name: 'editList' }]);
    vi.useRealTimers();
  });
});
