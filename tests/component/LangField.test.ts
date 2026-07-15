import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import LangField from '$lib/components/LangField.svelte';
import { language } from '$lib/i18n/store';

describe('LangField', () => {
  it('shows the value for the global language with no per-field tabs', () => {
    language.set('is');
    render(LangField, {
      props: { en: 'hello', is: 'halló', label: 'Title', multiline: false },
    });
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('halló');
    expect(screen.queryByRole('tab')).toBeNull();
  });

  it('follows the global language when it changes', async () => {
    language.set('is');
    render(LangField, {
      props: { en: 'hello', is: 'halló', label: 'Title', multiline: false },
    });
    language.set('en');
    await new Promise((r) => setTimeout(r, 0));
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('hello');
  });

  it('edits only the current language and emits both values', async () => {
    language.set('is');
    const { component } = render(LangField, {
      props: { en: 'hello', is: '', label: 'L', multiline: false },
    });
    let lastEvent: { en: string; is: string } | null = null;
    component.$on('change', (e) => { lastEvent = e.detail; });
    const input = screen.getByRole('textbox') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'Halló' } });
    expect(lastEvent).toEqual({ en: 'hello', is: 'Halló' });
  });
});
