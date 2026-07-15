import { describe, expect, it, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { db } from '$lib/db/schema';
import { getSettings, saveSettings } from '$lib/db/repos';
import { loadSettings, updateSettings } from '$lib/stores/settings';
import { language } from '$lib/i18n/store';

describe('settings store language migration', () => {
  beforeEach(async () => {
    await db.open();
  });

  it('migrates a legacy english-default record to Icelandic once', async () => {
    // Records saved before Icelandic became the default carry language 'en'
    // without the migration flag.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.settings.put({
      id: 'singleton', users: ['Embla'], language: 'en',
      endpoint_url: 'x', shared_secret: 'y', device_name: 'tablet',
    } as any);
    await loadSettings();
    expect(get(language)).toBe('is');
    expect((await getSettings()).language).toBe('is');
    expect((await getSettings()).users).toEqual(['Embla']);
  });

  it('respects an explicit English choice after migration', async () => {
    await loadSettings();
    await updateSettings({ language: 'en' });
    await loadSettings();
    expect(get(language)).toBe('en');
    expect((await getSettings()).language).toBe('en');
  });

  it('does not override a fresh install already on Icelandic', async () => {
    await saveSettings({ language: 'is' });
    await loadSettings();
    expect(get(language)).toBe('is');
  });
});
