<script lang="ts">
  import { onMount } from 'svelte';
  import Header from '$lib/components/Header.svelte';
  import LangField from '$lib/components/LangField.svelte';
  import { t } from '$lib/i18n/store';
  import {
    getChecklist, updateChecklist, listItems, addItem, deleteItem,
  } from '$lib/db/repos';
  import type { Checklist, Item } from '$lib/db/schema';
  import { navigate, back } from '$lib/stores/screen';

  export let checklistId: string;

  let cl: Checklist | undefined;
  let items: Item[] = [];

  async function refresh() {
    cl = await getChecklist(checklistId);
    items = await listItems(checklistId);
  }
  onMount(refresh);

  async function rename(detail: { en: string; is: string }) {
    if (!cl) return;
    await updateChecklist(cl.id, { name_en: detail.en, name_is: detail.is });
    cl = { ...cl, name_en: detail.en, name_is: detail.is };
  }

  async function add() {
    const it = await addItem(checklistId, {
      title_en: 'New item', title_is: 'Nýr liður',
      instructions_en: '', instructions_is: '', media_ids: [],
    });
    navigate({ name: 'editItem', checklistId, itemId: it.id });
  }

  async function del(id: string) {
    if (!confirm($t('edit.confirmDelete'))) return;
    await deleteItem(id);
    await refresh();
  }
</script>

<Header title={$t('edit.title')} onBack={back} />

<main>
  {#if cl}
    <LangField
      en={cl.name_en}
      is={cl.name_is}
      label={$t('edit.checklistName')}
      on:change={(e) => rename(e.detail)}
    />

    <ul>
      {#each items as it (it.id)}
        <li>
          <button class="row" on:click={() => navigate({ name: 'editItem', checklistId, itemId: it.id })}>
            {it.title_en || it.title_is || '(no title)'}
          </button>
          <button class="del" on:click={() => del(it.id)} aria-label={$t('edit.delete')}>🗑</button>
        </li>
      {/each}
    </ul>

    <button class="add" on:click={add}>+ {$t('edit.addItem')}</button>
  {/if}
</main>

<style>
  main { padding: 16px; }
  ul { list-style: none; padding: 0; margin: 16px 0; }
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
