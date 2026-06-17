import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import Submit from '$screens/Submit.svelte';
import { language } from '$lib/i18n/store';
import { pendingRuns } from '$lib/db/repos';

describe('Submit', () => {
  beforeEach(() => {
    language.set('en');
    sessionStorage.setItem('pending-run', JSON.stringify({
      checklist_id: 'cl-1',
      checklist_name_snapshot: 'X',
      user_name: 'K',
      started_at: '2026-06-16T09:00:00Z',
      item_results: [],
    }));
  });

  it('saves a pending run when submit pressed', async () => {
    render(Submit);
    await fireEvent.click(screen.getByRole('button', { name: /Submit/ }));
    const pending = await pendingRuns();
    expect(pending).toHaveLength(1);
    expect(pending[0].user_name).toBe('K');
  });
});
