import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import Header from '$lib/components/Header.svelte';
import { language } from '$lib/i18n/store';
import { get } from 'svelte/store';

describe('Header', () => {
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

  it('shows pending badge when pending > 0', () => {
    language.set('en');
    render(Header, { props: { title: 'x', pending: 3, online: true } });
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});
