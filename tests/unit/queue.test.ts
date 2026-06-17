import { describe, expect, it, vi, beforeEach } from 'vitest';
import { postRun, type SyncResult } from '$lib/sync/client';

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
