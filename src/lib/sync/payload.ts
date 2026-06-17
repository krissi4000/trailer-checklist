import type { Run } from '$lib/db/schema';

export interface SheetsPayload {
  run_id: string;
  timestamp: string;
  user: string;
  checklist: string;
  notes: string;
  items_json: string;
}

export function toPayload(run: Run): SheetsPayload {
  return {
    run_id: run.id,
    timestamp: run.finished_at,
    user: run.user_name,
    checklist: run.checklist_name_snapshot,
    notes: run.notes,
    items_json: JSON.stringify(
      run.item_results.map((r) => ({ t: r.title_snapshot, c: r.checked, n: r.note })),
    ),
  };
}
