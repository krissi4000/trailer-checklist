import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  pullContent, pushContent, mediaList, mediaUpload, mediaGet,
} from '$lib/sync/content-client';
import { emptyBundle } from '$lib/sync/bundle';

const URL_ = 'https://example.test/exec';

function stubFetch(body: unknown, status = 200) {
  const fn = vi.fn().mockResolvedValue({
    ok: status < 400, status, json: async () => body,
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('content-client request shape', () => {
  it('POSTs text/plain with secret and action', async () => {
    const fn = stubFetch({ ok: true, rev: 0, bundle: null });
    await pullContent(URL_, 's3cret');
    const [url, init] = fn.mock.calls[0];
    expect(url).toBe(URL_);
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('text/plain;charset=utf-8');
    expect(JSON.parse(init.body)).toMatchObject({ secret: 's3cret', action: 'content-pull' });
  });
});

describe('pullContent', () => {
  it('returns rev and bundle', async () => {
    stubFetch({ ok: true, rev: 4, bundle: emptyBundle() });
    const r = await pullContent(URL_, 's');
    expect(r).toMatchObject({ status: 'ok', rev: 4 });
  });

  it('maps network failure to error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const r = await pullContent(URL_, 's');
    expect(r.status).toBe('error');
  });

  it('times out a hanging request and reports a timeout error', async () => {
    vi.useFakeTimers();
    // A fetch that never resolves on its own, but honours the abort signal.
    vi.stubGlobal('fetch', (_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError')),
        );
      }),
    );
    const p = pullContent(URL_, 's', 100);
    await vi.advanceTimersByTimeAsync(101);
    const r = await p;
    expect(r.status).toBe('error');
    expect(r.status === 'error' && r.error).toMatch(/timed out/i);
    vi.useRealTimers();
  });
});

describe('pushContent', () => {
  it('returns the new rev on success', async () => {
    const fn = stubFetch({ ok: true, rev: 5 });
    const r = await pushContent(URL_, 's', 4, emptyBundle());
    expect(r).toEqual({ status: 'ok', rev: 5 });
    expect(JSON.parse(fn.mock.calls[0][1].body)).toMatchObject({ action: 'content-push', baseRev: 4 });
  });

  it('surfaces conflicts with the server state', async () => {
    stubFetch({ ok: false, error: 'conflict', rev: 7, bundle: emptyBundle() });
    const r = await pushContent(URL_, 's', 4, emptyBundle());
    expect(r.status).toBe('conflict');
    if (r.status === 'conflict') expect(r.rev).toBe(7);
  });
});

describe('media wrappers', () => {
  it('mediaList returns ids', async () => {
    stubFetch({ ok: true, ids: ['m1', 'm2'] });
    expect(await mediaList(URL_, 's')).toEqual(['m1', 'm2']);
  });

  it('mediaUpload sends id, mime and data', async () => {
    const fn = stubFetch({ ok: true });
    await mediaUpload(URL_, 's', 'm1', 'image/jpeg', 'AAAA');
    expect(JSON.parse(fn.mock.calls[0][1].body)).toMatchObject({
      action: 'media-upload', id: 'm1', mime: 'image/jpeg', data: 'AAAA',
    });
  });

  it('mediaGet returns null for not-found', async () => {
    stubFetch({ ok: false, error: 'not-found' });
    expect(await mediaGet(URL_, 's', 'nope')).toBeNull();
  });

  it('mediaGet returns mime and data when found', async () => {
    stubFetch({ ok: true, mime: 'image/jpeg', data: 'AAAA' });
    expect(await mediaGet(URL_, 's', 'm1')).toEqual({ mime: 'image/jpeg', data: 'AAAA' });
  });
});
