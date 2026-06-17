<script lang="ts">
  import { onMount } from 'svelte';
  import Header from '$lib/components/Header.svelte';
  import { t, language } from '$lib/i18n/store';
  import { db } from '$lib/db/schema';
  import type { Item, Media } from '$lib/db/schema';
  import { back } from '$lib/stores/screen';

  // Kept for router contract, currently unused
  // eslint-disable-next-line svelte/no-unused-svelte-ignore
  export let checklistId: string;
  export let itemId: string;

  let item: Item | undefined;
  let media: Media[] = [];
  let urls: Record<string, string> = {};

  async function load() {
    item = await db.items.get(itemId);
    if (item) {
      media = (await db.media.bulkGet(item.media_ids)).filter(Boolean) as Media[];
      const u: Record<string, string> = {};
      for (const m of media) u[m.id] = URL.createObjectURL(m.blob);
      urls = u;
    }
  }

  onMount(() => {
    load();
    return () => Object.values(urls).forEach((u) => URL.revokeObjectURL(u));
  });

  function pick(en: string, is: string): string {
    return $language === 'is' ? (is || en) : (en || is);
  }
</script>

<Header title={item ? pick(item.title_en, item.title_is) : ''} onBack={back} />

<main>
  {#if item}
    <p class="instructions">{pick(item.instructions_en, item.instructions_is)}</p>

    <div class="gallery">
      {#each media as m (m.id)}
        {#if m.type === 'photo'}
          <img src={urls[m.id]} alt="" />
        {:else}
          <video src={urls[m.id]} controls playsinline>
            <track kind="captions" />
          </video>
        {/if}
      {/each}
    </div>

    <button class="done" on:click={back}>{$t('item.done')}</button>
  {/if}
</main>

<style>
  main { padding: 16px 16px 100px; }
  .instructions { white-space: pre-wrap; line-height: 1.6; margin: 0 0 18px; }
  .gallery { display: grid; gap: 10px; }
  img, video { width: 100%; border-radius: var(--radius); background: #000; }
  .done {
    position: fixed; bottom: 16px; left: 16px; right: 16px;
    background: var(--accent); color: #fff;
    border: 0; border-radius: var(--radius); font-size: 18px; font-weight: 600;
    padding: 16px;
  }
</style>
