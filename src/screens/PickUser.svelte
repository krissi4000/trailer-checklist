<script lang="ts">
  import Header from '$lib/components/Header.svelte';
  import { t } from '$lib/i18n/store';
  import { settings, updateSettings } from '$lib/stores/settings';
  import { navigate, back } from '$lib/stores/screen';

  export let checklistId: string;

  let adding = false;
  let guestName = '';

  function pick(name: string) {
    navigate({ name: 'run', checklistId, user: name });
  }

  async function addGuest() {
    const name = guestName.trim();
    if (!name) return;
    if (!($settings?.users ?? []).includes(name)) {
      await updateSettings({ users: [...($settings?.users ?? []), name] });
    }
    guestName = '';
    adding = false;
    pick(name);
  }
</script>

<Header title={$t('pickUser.title')} onBack={back} />

<main>
  {#if !$settings || $settings.users.length === 0}
    <p class="empty">{$t('pickUser.empty')}</p>
  {/if}

  <div class="tiles">
    {#each $settings?.users ?? [] as u (u)}
      <button class="tile" on:click={() => pick(u)}>{u}</button>
    {/each}
    <button class="tile new" on:click={() => (adding = !adding)}>
      + {$t('pickUser.newGuest')}
    </button>
  </div>

  {#if adding}
    <form class="row" on:submit|preventDefault={addGuest}>
      <!-- svelte-ignore a11y-autofocus -->
      <input
        bind:value={guestName}
        placeholder={$t('pickUser.guestName')}
        autofocus
      />
      <button type="button" aria-label="OK" on:click={addGuest}>✓</button>
    </form>
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
  .tile.new { border-style: dashed; color: var(--muted); }
  .row { display: flex; gap: 8px; margin-top: 16px; }
  .row input {
    flex: 1; background: var(--surface); color: var(--text);
    border: 1px solid var(--border); border-radius: 10px; padding: 12px; font: inherit;
  }
  .row button {
    background: var(--accent); color: #fff; border: 0; border-radius: 10px;
    width: 56px; font-size: 20px;
  }
</style>
