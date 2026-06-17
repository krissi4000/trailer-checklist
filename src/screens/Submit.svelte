<script lang="ts">
  import Header from '$lib/components/Header.svelte';
  import { t } from '$lib/i18n/store';
  import { saveRun } from '$lib/db/repos';
  import { reset, back } from '$lib/stores/screen';
  import { refreshPending } from '$lib/stores/pending';
  import { runQueue } from '$lib/sync/queue';
  import { showToast } from '$lib/stores/toast';
  import { online } from '$lib/stores/network';
  import { requestBackgroundSync } from '$lib/sync/background';

  let notes = '';
  let submitting = false;

  async function submit() {
    if (submitting) return;
    submitting = true;
    const raw = sessionStorage.getItem('pending-run');
    if (!raw) { submitting = false; return; }
    const data = JSON.parse(raw);
    const finished_at = new Date().toISOString();
    await saveRun({
      checklist_id: data.checklist_id,
      checklist_name_snapshot: data.checklist_name_snapshot,
      user_name: data.user_name,
      started_at: data.started_at,
      finished_at,
      notes,
      item_results: data.item_results,
    });
    sessionStorage.removeItem('pending-run');
    await refreshPending();
    await requestBackgroundSync();

    if ($online) {
      const summary = await runQueue();
      await refreshPending();
      if (summary.ok > 0) showToast($t('submit.synced'), 'ok');
      else showToast($t('submit.queued'), 'info');
    } else {
      showToast($t('submit.queued'), 'info');
    }
    reset({ name: 'home' });
  }
</script>

<Header title={$t('submit.title')} onBack={back} />

<main>
  <label class="notes">
    <span>{$t('submit.runNotes')}</span>
    <textarea rows="4" bind:value={notes}></textarea>
  </label>

  <button class="confirm" on:click={submit} disabled={submitting}>{$t('submit.confirm')}</button>
</main>

<style>
  main { padding: 16px; }
  .notes span { display: block; color: var(--muted); margin-bottom: 6px; }
  textarea {
    width: 100%; background: var(--surface); color: var(--text);
    border: 1px solid var(--border); border-radius: 10px; padding: 12px; font: inherit;
  }
  .confirm {
    margin-top: 16px; width: 100%;
    background: var(--accent); color: #fff;
    border: 0; border-radius: var(--radius); font-size: 18px; font-weight: 600;
    padding: 16px;
  }
</style>
