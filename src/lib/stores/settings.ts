import { writable } from 'svelte/store';
import { getSettings, saveSettings } from '$lib/db/repos';
import { language } from '$lib/i18n/store';
import type { Settings } from '$lib/db/schema';

const _settings = writable<Settings | null>(null);
export const settings = { subscribe: _settings.subscribe };

export async function loadSettings(): Promise<void> {
  let s = await getSettings();
  if (!s.lang_default_migrated) {
    // One-time flip to Icelandic: records saved before it became the
    // default carry an implicit 'en' the user never actually chose.
    s = await saveSettings({ language: 'is', lang_default_migrated: true });
  }
  _settings.set(s);
  language.set(s.language);
}

export async function updateSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<void> {
  const updated = await saveSettings(patch);
  _settings.set(updated);
  if (patch.language) language.set(patch.language);
}
