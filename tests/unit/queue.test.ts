import { describe, expect, it, vi, beforeEach } from 'vitest';
import { postRun, type SyncResult } from '$lib/sync/client';
import { runQueue } from '$lib/sync/queue';
import { saveRun, saveSettings, pendingRuns, createChecklist } from '$lib/db/repos';

describe('postRun', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const payload = {
    run_id: 'r1', timestamp: 't', user: 'u',
    checklist: 'c', notes: '', items_json: '[]',
  };

  it('returns ok on 200 { ok: true }', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ ok: true, row: 7 }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )));
    const r: SyncResult = await postRun('https://example/exec', 'sek', payload);
    expect(r).toEqual({ status: 'ok' });
  });

  it('returns retry on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const r = await postRun('https://example/exec', 'sek', payload);
    expect(r.status).toBe('retry');
  });

  it('returns retry on 5xx', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('boom', { status: 503 })));
    const r = await postRun('https://example/exec', 'sek', payload);
    expect(r.status).toBe('retry');
  });

  it('returns fatal on 4xx', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ ok: false, error: 'bad secret' }),
      { status: 401, headers: { 'content-type': 'application/json' } },
    )));
    const r = await postRun('https://example/exec', 'sek', payload);
    expect(r.status).toBe('fatal');
    if (r.status === 'fatal') expect(r.error).toContain('bad secret');
  });

  it('posts as text/plain so the cross-origin request needs no CORS preflight', async () => {
    // Apps Script web apps never answer OPTIONS; application/json would be
    // preflighted and blocked by the browser.
    const f = vi.fn(async () => new Response(JSON.stringify({ ok: true, row: 1 }), {
      status: 200, headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', f);
    await postRun('https://example/exec', 'sek', payload);
    const calls = f.mock.calls as unknown as Array<[string, RequestInit]>;
    const headers = calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers['Content-Type']).toMatch(/^text\/plain/);
  });

  it('sends the shared secret in the JSON body', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ ok: true, row: 1 }), {
      status: 200, headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', f);
    await postRun('https://example/exec', 'super-secret', payload);
    const calls = f.mock.calls as unknown as Array<[string, RequestInit]>;
    const init = calls[0]?.[1];
    expect(init).toBeDefined();
    const sent = JSON.parse((init?.body as string) ?? '{}');
    expect(sent.secret).toBe('super-secret');
    expect(sent.run_id).toBe('r1');
    expect(init?.method).toBe('POST');
  });
});

describe('runQueue', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await saveSettings({ endpoint_url: 'https://example/exec', shared_secret: 'sek' });
  });

  it('marks pending runs synced when client returns ok', async () => {
    const cl = await createChecklist({ name_en: 'A', name_is: 'A' });
    await saveRun({
      checklist_id: cl.id, checklist_name_snapshot: 'A',
      user_name: 'k', started_at: 't', finished_at: 't',
      notes: '', item_results: [],
    });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ ok: true, row: 1 }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )));
    const summary = await runQueue();
    expect(summary).toEqual({ ok: 1, retry: 0, fatal: 0 });
    expect(await pendingRuns()).toHaveLength(0);
  });

  it('leaves pending runs pending on retry', async () => {
    const cl = await createChecklist({ name_en: 'A', name_is: 'A' });
    await saveRun({
      checklist_id: cl.id, checklist_name_snapshot: 'A',
      user_name: 'k', started_at: 't', finished_at: 't',
      notes: '', item_results: [],
    });
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const summary = await runQueue();
    expect(summary).toEqual({ ok: 0, retry: 1, fatal: 0 });
    expect((await pendingRuns())[0].attempt_count).toBe(1);
  });

  it('marks fatal runs as error', async () => {
    const cl = await createChecklist({ name_en: 'A', name_is: 'A' });
    await saveRun({
      checklist_id: cl.id, checklist_name_snapshot: 'A',
      user_name: 'k', started_at: 't', finished_at: 't',
      notes: '', item_results: [],
    });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ ok: false, error: 'unauthorized' }),
      { status: 401, headers: { 'content-type': 'application/json' } },
    )));
    await runQueue();
    expect(await pendingRuns()).toHaveLength(0);
  });

  it('skips when endpoint not configured', async () => {
    await saveSettings({ endpoint_url: '', shared_secret: '' });
    const cl = await createChecklist({ name_en: 'A', name_is: 'A' });
    await saveRun({
      checklist_id: cl.id, checklist_name_snapshot: 'A',
      user_name: 'k', started_at: 't', finished_at: 't',
      notes: '', item_results: [],
    });
    const summary = await runQueue();
    expect(summary.ok).toBe(0);
    expect(summary.retry).toBe(1);
  });
});
