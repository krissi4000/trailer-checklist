import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import LangTabs from '$lib/components/LangTabs.svelte';

describe('LangTabs', () => {
  it('binds EN value and switches to IS', async () => {
    render(LangTabs, {
      props: { en: 'hello', is: 'halló', label: 'Title', multiline: false },
    });
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('hello');
    await fireEvent.click(screen.getByRole('tab', { name: 'IS' }));
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('halló');
  });

  it('emits update events when typing', async () => {
    const { component } = render(LangTabs, {
      props: { en: '', is: '', label: 'L', multiline: false },
    });
    let lastEvent: { en: string; is: string } | null = null;
    component.$on('change', (e) => { lastEvent = e.detail; });
    const input = screen.getByRole('textbox') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'A' } });
    expect(lastEvent).toEqual({ en: 'A', is: '' });
  });
});
