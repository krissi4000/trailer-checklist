<script lang="ts">
  import { onMount } from 'svelte';
  import Header from '$lib/components/Header.svelte';
  import { t } from '$lib/i18n/store';
  import { listChecklists, createChecklist, deleteChecklist } from '$lib/db/repos';
  import type { Checklist } from '$lib/db/schema';
  import { navigate, back } from '$lib/stores/screen';

  let lists: Checklist[] = [];

  async function refresh() { lists = await listChecklists(); }
  onMount(refresh);

  async function add() {
    const cl = await createChecklist({ name_en: 'New checklist', name_is: 'Nýr gátlisti' });
    navigate({ name: 'editChecklist', checklistId: cl.id });
  }

  async function del(id: string) {
    if (!confirm($t('edit.confirmDelete'))) return;
    await deleteChecklist(id);
    await refresh();
  }
</script>

<Header title={$t('edit.checklists')} onBack={back} />

<main>
  <ul>
    {#each lists as cl (cl.id)}
      <li>
        <button class="row" on:click={() => navigate({ name: 'editChecklist', checklistId: cl.id })}>
          {cl.name_en || cl.name_is || '(no name)'}
        </button>
        <button class="del" on:click={() => del(cl.id)} aria-label={$t('edit.delete')}>🗑</button>
      </li>
    {/each}
  </ul>

  <button class="add" on:click={add}>+ {$t('edit.addChecklist')}</button>
</main>

<style>
  main { padding: 16px; }
  ul { list-style: none; padding: 0; margin: 0 0 16px; }
  li { display: flex; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--border); }
  .row {
    flex: 1; text-align: left; background: transparent; color: var(--text);
    border: 0; padding: 12px 8px; font-size: 16px;
  }
  .del {
    background: transparent; color: var(--err); border: 0;
    font-size: 18px; min-height: auto; padding: 8px 12px;
  }
  .add {
    width: 100%; background: var(--surface-2); color: var(--text);
    border: 1px solid var(--accent); border-radius: var(--radius); padding: 14px;
    font-size: 16px;
  }
</style>
