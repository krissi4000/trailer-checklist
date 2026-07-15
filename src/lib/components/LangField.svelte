<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { language } from '$lib/i18n/store';

  export let en: string = '';
  export let is: string = '';
  export let label: string = '';
  export let multiline: boolean = false;

  const dispatch = createEventDispatcher<{ change: { en: string; is: string } }>();

  function handle(e: Event) {
    const v = (e.target as HTMLInputElement | HTMLTextAreaElement).value;
    if ($language === 'en') en = v; else is = v;
    dispatch('change', { en, is });
  }
</script>

<label>
  {#if label}<span class="label">{label}</span>{/if}
  {#if multiline}
    <textarea rows="4" value={$language === 'en' ? en : is} on:input={handle}></textarea>
  {:else}
    <input type="text" value={$language === 'en' ? en : is} on:input={handle} />
  {/if}
</label>

<style>
  label { display: block; margin-bottom: 14px; }
  .label { display: block; font-size: 13px; color: var(--muted); margin-bottom: 6px; }
  input, textarea {
    width: 100%; background: var(--surface); color: var(--text);
    border: 1px solid var(--border); border-radius: 10px; padding: 12px;
    font: inherit; min-height: 48px;
  }
  textarea { resize: vertical; }
</style>
