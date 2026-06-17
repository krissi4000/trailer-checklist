import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Home from '$screens/Home.svelte';
import { language } from '$lib/i18n/store';
import { createChecklist } from '$lib/db/repos';
import { loadSettings } from '$lib/stores/settings';
import { db } from '$lib/db/schema';

describe('Home', () => {
  beforeEach(async () => {
    language.set('en');
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
});
