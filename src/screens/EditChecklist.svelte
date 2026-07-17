<script lang="ts">
  import { onMount } from 'svelte';
  import { flip } from 'svelte/animate';
  import { dndzone, SOURCES } from 'svelte-dnd-action';
  import Header from '$lib/components/Header.svelte';
  import LangField from '$lib/components/LangField.svelte';
  import { t, language } from '$lib/i18n/store';
  import {
    getChecklist, updateChecklist, listItems, addItem, deleteItem, reorderItems,
  } from '$lib/db/repos';
  import type { Checklist, Item } from '$lib/db/schema';
  import { navigate, back } from '$lib/stores/screen';
  import { syncNow } from '$lib/sync/content-sync';
  import { showToast } from '$lib/stores/toast';

  export let checklistId: string;

  // Edits already persist as you type; the ✓ pushes them to the server now
  // (skipping the debounce), then returns.
  function done() {
    void syncNow();
    showToast($t('edit.saved'), 'ok');
    back();
  }

  const flipDurationMs = 150;

  let cl: Checklist | undefined;
  let items: Item[] = [];
  let dragDisabled = true;

  async function refresh() {
    cl = await getChecklist(checklistId);
    items = await listItems(checklistId);
  }
  onMount(refresh);

  function pickTitle(it: Item): string {
    return $language === 'is'
      ? (it.title_is || it.title_en)
      : (it.title_en || it.title_is);
  }

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

  function startDrag(e: Event) {
    e.preventDefault();
    dragDisabled = false;
  }

  function handleConsider(e: CustomEvent<{ items: Item[] }>) {
    items = e.detail.items;
  }

  async function handleFinalize(
    e: CustomEvent<{ items: Item[]; info: { source: string } }>,
  ) {
    items = e.detail.items;
    if (e.detail.info.source === SOURCES.POINTER) dragDisabled = true;
    await reorderItems(checklistId, items.map((i) => i.id));
  }
</script>

<Header title={$t('edit.title')} onBack={back} onDone={done} />

<main>
  {#if cl}
    <LangField
      en={cl.name_en}
      is={cl.name_is}
      label={$t('edit.checklistName')}
      on:change={(e) => rename(e.detail)}
    />

    <ul
      use:dndzone={{ items, dragDisabled, flipDurationMs, dropTargetStyle: {} }}
      on:consider={handleConsider}
      on:finalize={handleFinalize}
    >
      {#each items as it, i (it.id)}
        <li animate:flip={{ duration: flipDurationMs }}>
          <button
            type="button"
            class="handle"
            aria-label="Reorder"
            on:mousedown={startDrag}
            on:touchstart={startDrag}
          >≡</button>
          <span class="num">{i + 1}.</span>
          <button class="row" on:click={() => navigate({ name: 'editItem', checklistId, itemId: it.id })}>
            {pickTitle(it) || '(no title)'}
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
  li {
    display: flex; align-items: center; gap: 8px; padding: 6px 0;
    border-bottom: 1px solid var(--border); background: var(--bg);
  }
  .handle {
    background: transparent; color: var(--muted); border: 0;
    font-size: 22px; min-height: auto; padding: 8px 10px;
    cursor: grab; touch-action: none;
    user-select: none; -webkit-user-select: none;
  }
  .num { color: var(--muted); font-size: 15px; min-width: 22px; text-align: right; }
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
