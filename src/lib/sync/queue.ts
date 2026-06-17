import { pendingRuns, updateRunStatus, getSettings } from '$lib/db/repos';
import { postRun } from './client';
import { toPayload } from './payload';
import { isTerminal } from './backoff';

export interface QueueSummary {
  ok: number;
  retry: number;
  fatal: number;
}

export async function runQueue(): Promise<QueueSummary> {
  const settings = await getSettings();
  const runs = await pendingRuns();
  const summary: QueueSummary = { ok: 0, retry: 0, fatal: 0 };

  for (const run of runs) {
    if (!settings.endpoint_url) {
      await updateRunStatus(run.id, {
        attempt_count: run.attempt_count + 1,
        last_error: 'endpoint not configured',
      });
      summary.retry++;
      continue;
    }

    const result = await postRun(settings.endpoint_url, settings.shared_secret, toPayload(run));
    if (result.status === 'ok') {
      await updateRunStatus(run.id, { sync_status: 'synced', last_error: null });
      summary.ok++;
    } else if (result.status === 'fatal') {
      await updateRunStatus(run.id, { sync_status: 'error', last_error: result.error });
      summary.fatal++;
    } else {
      const attempts = run.attempt_count + 1;
      const terminal = isTerminal(attempts);
      await updateRunStatus(run.id, {
        attempt_count: attempts,
        last_error: result.error,
        sync_status: terminal ? 'error' : 'pending',
      });
      if (terminal) summary.fatal++;
      else summary.retry++;
    }
  }

  return summary;
}
