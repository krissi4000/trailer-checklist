<script lang="ts">
  import { language } from '$lib/i18n/store';
  import { updateSettings } from '$lib/stores/settings';

  export let title: string;
  export let pending: number = 0;
  export let online: boolean = true;
  export let onBack: (() => void) | null = null;

  function setLang(l: 'en' | 'is') {
    language.set(l);
    // Persist so navigation (loadSettings on other screens) can't revert it.
    void updateSettings({ language: l });
  }
</script>

<header>
  <div class="left">
    {#if onBack}
      <button class="back" on:click={onBack} aria-label="Back">←</button>
    {/if}
    <h1>{title}</h1>
  </div>
  <div class="right">
    {#if pending > 0}
      <span class="badge" title="Pending">{pending}</span>
    {/if}
    <span class="dot" class:online aria-label={online ? 'Online' : 'Offline'} />
    <div class="lang" role="group" aria-label="Language">
      <button class:active={$language === 'en'} on:click={() => setLang('en')}>EN</button>
      <button class:active={$language === 'is'} on:click={() => setLang('is')}>IS</button>
    </div>
  </div>
</header>

<style>
  header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 16px; background: var(--surface);
    border-bottom: 1px solid var(--border); position: sticky; top: 0; z-index: 10;
  }
  .left, .right { display: flex; align-items: center; gap: 10px; }
  h1 { margin: 0; font-size: 20px; }
  .back { background: transparent; color: var(--text); border: 0; font-size: 24px; padding: 4px 8px; }
  .badge {
    background: var(--warn); color: #000; border-radius: 999px;
    padding: 2px 8px; font-size: 13px; font-weight: 600;
  }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--err); }
  .dot.online { background: var(--ok); }
  .lang { display: flex; gap: 4px; }
  .lang button {
    background: transparent; color: var(--muted); border: 1px solid var(--border);
    border-radius: 8px; padding: 4px 10px; min-height: auto; font-size: 13px;
  }
  .lang .active { background: var(--surface-2); color: var(--text); border-color: var(--accent); }
</style>
