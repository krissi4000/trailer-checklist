import { describe, expect, it, vi } from 'vitest';
import { onContentChanged, notifyContentChanged } from '$lib/sync/content-signal';
import { createChecklist, saveSettings } from '$lib/db/repos';

describe('content signal', () => {
  it('notifies subscribers and supports unsubscribe', () => {
    const fn = vi.fn();
    const off = onContentChanged(fn);
    notifyContentChanged();
    expect(fn).toHaveBeenCalledTimes(1);
    off();
    notifyContentChanged();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('fires on repo mutations', async () => {
    const fn = vi.fn();
    const off = onContentChanged(fn);
    await createChecklist({ name_en: 'A', name_is: 'A' });
    expect(fn).toHaveBeenCalled();
    off();
  });

  it('fires on shared settings changes but not on language changes', async () => {
    const fn = vi.fn();
    const off = onContentChanged(fn);
    await saveSettings({ language: 'en' });
    expect(fn).not.toHaveBeenCalled();
    await saveSettings({ users: ['Anna'] });
    expect(fn).toHaveBeenCalledTimes(1);
    off();
  });
});
