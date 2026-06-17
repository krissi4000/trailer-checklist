<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let en: string = '';
  export let is: string = '';
  export let label: string = '';
  export let multiline: boolean = false;

  type Tab = 'en' | 'is';
  let tab: Tab = 'en';
  const dispatch = createEventDispatcher<{ change: { en: string; is: string } }>();

  function handle(e: Event) {
    const v = (e.target as HTMLInputElement | HTMLTextAreaElement).value;
    if (tab === 'en') en = v; else is = v;
    dispatch('change', { en, is });
  }
</script>

<label>
  {#if label}<span class="label">{label}</span>{/if}
  <div class="tabs" role="tablist">
    <button type="button" class:active={tab === 'en'} on:click={() => (tab = 'en')} role="tab" aria-label="EN">EN</button>
    <button type="button" class:active={tab === 'is'} on:click={() => (tab = 'is')} role="tab" aria-label="IS">IS</button>
  </div>
  {#if multiline}
    <textarea rows="4" value={tab === 'en' ? en : is} on:input={handle}></textarea>
  {:else}
    <input type="text" value={tab === 'en' ? en : is} on:input={handle} />
  {/if}
</label>

<style>
  label { display: block; margin-bottom: 14px; }
  .label { display: block; font-size: 13px; color: var(--muted); margin-bottom: 6px; }
  .tabs { display: flex; gap: 4px; margin-bottom: 6px; }
  .tabs button {
    background: transparent; color: var(--muted); border: 1px solid var(--border);
    border-radius: 8px; padding: 4px 10px; min-height: auto; font-size: 13px;
  }
  .tabs .active { background: var(--surface-2); color: var(--text); border-color: var(--accent); }
  input, textarea {
    width: 100%; background: var(--surface); color: var(--text);
    border: 1px solid var(--border); border-radius: 10px; padding: 12px;
    font: inherit; min-height: 48px;
  }
  textarea { resize: vertical; }
</style>
