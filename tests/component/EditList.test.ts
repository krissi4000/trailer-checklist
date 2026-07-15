import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import EditList from '$screens/EditList.svelte';
import { createChecklist } from '$lib/db/repos';
import { language } from '$lib/i18n/store';
import { db } from '$lib/db/schema';

describe('EditList', () => {
  beforeEach(async () => {
    await db.open();
  });

  it('shows checklist names in the global language', async () => {
    language.set('is');
    await createChecklist({ name_en: 'Leaving', name_is: 'Brottför' });
    render(EditList);
    expect(await screen.findByText('Brottför')).toBeInTheDocument();
    expect(screen.queryByText('Leaving')).toBeNull();
  });

  it('falls back to the other language when one is empty', async () => {
    language.set('is');
    await createChecklist({ name_en: 'Only English', name_is: '' });
    render(EditList);
    expect(await screen.findByText('Only English')).toBeInTheDocument();
  });
});
