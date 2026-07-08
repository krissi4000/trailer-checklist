import type { ContentBundle } from './bundle';

export type PullResult =
  | { status: 'ok'; rev: number; bundle: ContentBundle | null }
  | { status: 'error'; error: string };

export type PushResult =
  | { status: 'ok'; rev: number }
  | { status: 'conflict'; rev: number; bundle: ContentBundle }
  | { status: 'error'; error: string };

// Apps Script cold-starts after idle periods; the first request can take tens
// of seconds. Without a ceiling a stalled request leaves the UI spinning
// forever, so abort and surface a retryable error instead.
const DEFAULT_TIMEOUT_MS = 20000;

async function post(
  url: string,
  secret: string,
  body: Record<string, unknown>,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      // text/plain keeps this a "simple" request: Apps Script web apps never
      // answer the OPTIONS preflight that application/json would trigger.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...body, secret }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as Record<string, unknown>;
  } catch (e) {
    if (controller.signal.aborted) throw new Error(`request timed out after ${timeoutMs}ms`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function pullContent(url: string, secret: string, timeoutMs?: number): Promise<PullResult> {
  try {
    const r = await post(url, secret, { action: 'content-pull' }, timeoutMs);
    if (!r.ok) return { status: 'error', error: String(r.error ?? 'pull failed') };
    return { status: 'ok', rev: Number(r.rev ?? 0), bundle: (r.bundle as ContentBundle | null) ?? null };
  } catch (e) {
    return { status: 'error', error: String((e as Error).message ?? e) };
  }
}

export async function pushContent(
  url: string, secret: string, baseRev: number, bundle: ContentBundle,
): Promise<PushResult> {
  try {
    const r = await post(url, secret, { action: 'content-push', baseRev, bundle });
    if (r.ok) return { status: 'ok', rev: Number(r.rev) };
    if (r.error === 'conflict') {
      return { status: 'conflict', rev: Number(r.rev), bundle: r.bundle as ContentBundle };
    }
    return { status: 'error', error: String(r.error ?? 'push failed') };
  } catch (e) {
    return { status: 'error', error: String((e as Error).message ?? e) };
  }
}

// The media wrappers throw on failure; the orchestrator catches everything.
export async function mediaList(url: string, secret: string): Promise<string[]> {
  const r = await post(url, secret, { action: 'media-list' });
  if (!r.ok) throw new Error(String(r.error ?? 'media-list failed'));
  return (r.ids as string[]) ?? [];
}

export async function mediaUpload(
  url: string, secret: string, id: string, mime: string, data: string,
): Promise<void> {
  const r = await post(url, secret, { action: 'media-upload', id, mime, data });
  if (!r.ok) throw new Error(String(r.error ?? 'media-upload failed'));
}

export async function mediaGet(
  url: string, secret: string, id: string,
): Promise<{ mime: string; data: string } | null> {
  const r = await post(url, secret, { action: 'media-get', id });
  if (!r.ok) {
    if (r.error === 'not-found') return null;
    throw new Error(String(r.error ?? 'media-get failed'));
  }
  return { mime: String(r.mime), data: String(r.data) };
}
