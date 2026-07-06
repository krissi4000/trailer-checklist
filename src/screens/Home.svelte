<script lang="ts">
  import { tick } from 'svelte';
  import Header from '$lib/components/Header.svelte';
  import { t, language } from '$lib/i18n/store';
  import { listChecklists } from '$lib/db/repos';
  import type { Checklist } from '$lib/db/schema';
  import { navigate } from '$lib/stores/screen';
  import { pending, refreshPending } from '$lib/stores/pending';
  import { online } from '$lib/stores/network';
  import { contentVersion } from '$lib/stores/syncStatus';
  import { longpress } from '$lib/utils/longpress';

  let lists: Checklist[] = [];

  let initialized = false;

  async function refresh() {
    const checklists = await listChecklists();
    lists = checklists;
    await tick();
    await refreshPending();
  }

  $: if (!initialized) {
    initialized = true;
    refresh();
  }

  // Re-query when a background sync applied remote changes.
  let lastSeenVersion = 0;
  $: if ($contentVersion !== lastSeenVersion) {
    lastSeenVersion = $contentVersion;
    refresh();
  }

  function pickName(c: Checklist): string {
    return $language === 'is' ? (c.name_is || c.name_en) : (c.name_en || c.name_is);
  }

  // After a long-press, the pointer release still fires a click; swallow it.
  let suppressClick = false;

  function handleGearClick() {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    navigate({ name: 'settings' });
  }

  function handleGearLongpress() {
    suppressClick = true;
    navigate({ name: 'editList' });
  }
</script>

<Header title={$t('home.title')} pending={$pending} online={$online} />

<main>
  {#if lists.length === 0}
    <p class="empty">{$t('home.empty')}</p>
  {/if}

  <div class="tiles">
    {#each lists as cl (cl.id)}
      <button class="tile" on:click={() => navigate({ name: 'pickUser', checklistId: cl.id })}>
        {pickName(cl)}
      </button>
    {/each}
  </div>

  <button
    class="gear"
    aria-label="Edit"
    use:longpress={1500}
    on:longpress={handleGearLongpress}
    on:click={handleGearClick}
  >⚙️</button>
</main>

<style>
  main { padding: 16px; }
  .empty { color: var(--muted); text-align: center; padding: 32px 16px; }
  .tiles { display: grid; gap: 12px; grid-template-columns: 1fr 1fr; }
  .tile {
    background: var(--surface); color: var(--text); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 24px 12px; font-size: 18px; font-weight: 600;
    min-height: 110px;
  }
  .gear {
    position: fixed; bottom: 20px; right: 20px;
    width: 56px; height: 56px; border-radius: 50%;
    background: var(--surface-2); color: var(--text);
    border: 1px solid var(--border); font-size: 24px;
    user-select: none; -webkit-user-select: none; touch-action: manipulation;
  }
</style>
