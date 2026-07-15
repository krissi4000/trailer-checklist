import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import Header from '$lib/components/Header.svelte';
import { language } from '$lib/i18n/store';
import { loadSettings } from '$lib/stores/settings';
import { getSettings, saveSettings } from '$lib/db/repos';
import { db } from '$lib/db/schema';
import { get } from 'svelte/store';

describe('Header', () => {
  beforeEach(async () => {
    await db.open();
  });

  it('renders the title', () => {
    language.set('en');
    render(Header, { props: { title: 'Trailer Checklist', pending: 0, online: true } });
    expect(screen.getByText('Trailer Checklist')).toBeInTheDocument();
  });

  it('toggles language when clicking IS button', async () => {
    language.set('en');
    render(Header, { props: { title: 'x', pending: 0, online: true } });
    await fireEvent.click(screen.getByRole('button', { name: 'IS' }));
    expect(get(language)).toBe('is');
  });

  it('persists the language choice globally', async () => {
    await saveSettings({ language: 'is' });
    await loadSettings();
    render(Header, { props: { title: 'x', pending: 0, online: true } });
    await fireEvent.click(screen.getByRole('button', { name: 'EN' }));
    await vi.waitFor(async () => {
      expect((await getSettings()).language).toBe('en');
    });
  });

  it('keeps the chosen language across loadSettings (no revert on back)', async () => {
    await saveSettings({ language: 'is' });
    await loadSettings();
    render(Header, { props: { title: 'x', pending: 0, online: true } });
    await fireEvent.click(screen.getByRole('button', { name: 'EN' }));
    await vi.waitFor(async () => {
      expect((await getSettings()).language).toBe('en');
    });
    await loadSettings();
    expect(get(language)).toBe('en');
  });

  it('shows pending badge when pending > 0', () => {
    language.set('en');
    render(Header, { props: { title: 'x', pending: 3, online: true } });
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders a done button that calls onDone when provided', async () => {
    language.set('en');
    const onDone = vi.fn();
    render(Header, { props: { title: 'x', onDone } });
    const btn = screen.getByRole('button', { name: 'Save' });
    await fireEvent.click(btn);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('has no done button when onDone is not provided', () => {
    language.set('en');
    render(Header, { props: { title: 'x' } });
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
  });
});
