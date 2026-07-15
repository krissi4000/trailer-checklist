import { describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { language, t } from '$lib/i18n/store';

describe('i18n', () => {
  it('defaults to Icelandic', async () => {
    vi.resetModules();
    const fresh = await import('$lib/i18n/store');
    expect(get(fresh.language)).toBe('is');
  });

  it('returns english string by default', () => {
    language.set('en');
    expect(get(t)('home.title')).toBe('Trailer Checklist');
  });

  it('returns icelandic when language is is', () => {
    language.set('is');
    expect(get(t)('home.title')).toBe('Gátlisti');
  });

  it('falls back to key when missing', () => {
    language.set('en');
    expect(get(t)('does.not.exist')).toBe('does.not.exist');
  });
});
