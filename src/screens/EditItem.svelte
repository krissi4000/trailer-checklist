<script lang="ts">
  import Header from '$lib/components/Header.svelte';
  import LangField from '$lib/components/LangField.svelte';
  import MediaUploader from '$lib/components/MediaUploader.svelte';
  import { t } from '$lib/i18n/store';
  import { db } from '$lib/db/schema';
  import { updateItem } from '$lib/db/repos';
  import type { Item } from '$lib/db/schema';
  import { back } from '$lib/stores/screen';
  import { syncNow } from '$lib/sync/content-sync';

  export let checklistId: string;
  export let itemId: string;

  // Edits already persist as you type; the ✓ pushes them to the server now
  // (skipping the debounce), then returns.
  function done() {
    void syncNow();
    back();
  }

  let it: Item | undefined;
  let initialized = false;

  $: if (!initialized) {
    initialized = true;
    (async () => { it = await db.items.get(itemId); })();
  }

  async function onTitle(d: { en: string; is: string }) {
    if (!it) return;
    it.title_en = d.en; it.title_is = d.is;
    await updateItem(it.id, { title_en: d.en, title_is: d.is });
  }
  async function onInstr(d: { en: string; is: string }) {
    if (!it) return;
    it.instructions_en = d.en; it.instructions_is = d.is;
    await updateItem(it.id, { instructions_en: d.en, instructions_is: d.is });
  }
  async function onMedia(d: { mediaIds: string[] }) {
    if (!it) return;
    it.media_ids = d.mediaIds;
    await updateItem(it.id, { media_ids: d.mediaIds });
  }
  // checklistId kept for router contract
  void checklistId;
</script>

<Header title={$t('edit.title')} onBack={back} onDone={done} />

<main>
  {#if it}
    <LangField en={it.title_en} is={it.title_is}
      label={$t('editItem.title')} on:change={(e) => onTitle(e.detail)} />
    <LangField en={it.instructions_en} is={it.instructions_is}
      label={$t('editItem.instructions')} multiline
      on:change={(e) => onInstr(e.detail)} />

    <h3>{$t('editItem.media')}</h3>
    <MediaUploader mediaIds={it.media_ids} on:change={(e) => onMedia(e.detail)} />
  {/if}
</main>

<style>
  main { padding: 16px; }
  h3 { font-size: 14px; color: var(--muted); margin: 16px 0 8px; text-transform: uppercase; letter-spacing: 0.06em; }
</style>
