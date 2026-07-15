import type { SheetsPayload } from './payload';

export type SyncResult =
  | { status: 'ok' }
  | { status: 'retry'; error: string }
  | { status: 'fatal'; error: string };

export async function postRun(
  url: string,
  secret: string,
  payload: SheetsPayload,
): Promise<SyncResult> {
  if (!url) return { status: 'fatal', error: 'endpoint not configured' };
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      // text/plain keeps this a "simple" request: Apps Script web apps never
      // answer the OPTIONS preflight that application/json would trigger.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...payload, secret }),
    });
  } catch (e) {
    return { status: 'retry', error: String((e as Error).message ?? e) };
  }
  if (res.status >= 500) return { status: 'retry', error: `HTTP ${res.status}` };
  let body: { ok?: boolean; error?: string } = {};
  try { body = await res.json(); } catch { /* non-JSON */ }
  if (res.ok && body.ok) return { status: 'ok' };
  if (res.status >= 400 && res.status < 500) {
    return { status: 'fatal', error: body.error ?? `HTTP ${res.status}` };
  }
  return { status: 'retry', error: body.error ?? `HTTP ${res.status}` };
}
