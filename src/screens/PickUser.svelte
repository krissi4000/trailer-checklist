<script lang="ts">
  import Header from '$lib/components/Header.svelte';
  import { t } from '$lib/i18n/store';
  import { settings } from '$lib/stores/settings';
  import { navigate, back } from '$lib/stores/screen';

  export let checklistId: string;

  function pick(name: string) {
    navigate({ name: 'run', checklistId, user: name });
  }
</script>

<Header title={$t('pickUser.title')} onBack={back} />

<main>
  {#if !$settings || $settings.users.length === 0}
    <p class="empty">{$t('pickUser.empty')}</p>
  {:else}
    <div class="tiles">
      {#each $settings.users as u (u)}
        <button class="tile" on:click={() => pick(u)}>{u}</button>
      {/each}
    </div>
  {/if}
</main>

<style>
  main { padding: 16px; }
  .empty { color: var(--muted); text-align: center; padding: 32px 16px; }
  .tiles { display: grid; gap: 12px; grid-template-columns: 1fr 1fr; }
  .tile {
    background: var(--surface); color: var(--text); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 22px 12px; font-size: 17px;
  }
</style>
