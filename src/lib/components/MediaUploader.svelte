<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { db, type Media } from '$lib/db/schema';
  import { uuid } from '$lib/utils/uuid';
  import { compressPhoto, validateVideo, videoThumbnail, photoMimeOK } from '$lib/utils/media';
  import { showToast } from '$lib/stores/toast';

  export let mediaIds: string[] = [];

  const dispatch = createEventDispatcher<{ change: { mediaIds: string[] } }>();
  let media: Media[] = [];
  let urls: Record<string, string> = {};

  $: refreshMedia(mediaIds);

  async function refreshMedia(ids: string[]) {
    media = ((await db.media.bulkGet(ids)).filter(Boolean) as Media[]);
    Object.values(urls).forEach((u) => URL.revokeObjectURL(u));
    const next: Record<string, string> = {};
    for (const m of media) next[m.id] = URL.createObjectURL(m.blob);
    urls = next;
  }

  async function addPhoto(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (!photoMimeOK(file.type)) { showToast(`Unsupported: ${file.type}`, 'warn'); return; }
    const { blob, mime } = await compressPhoto(file);
    const id = uuid();
    await db.media.add({
      id, type: 'photo', blob, thumbnail_blob: null, mime,
      size_bytes: blob.size, created_at: new Date().toISOString(),
    });
    mediaIds = [...mediaIds, id];
    dispatch('change', { mediaIds });
    (e.target as HTMLInputElement).value = '';
  }

  async function addVideo(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const v = validateVideo(file);
    if (!v.ok) { showToast(v.reason!, 'warn'); return; }
    const thumb = await videoThumbnail(file);
    const id = uuid();
    await db.media.add({
      id, type: 'video', blob: file, thumbnail_blob: thumb,
      mime: file.type, size_bytes: file.size,
      created_at: new Date().toISOString(),
    });
    mediaIds = [...mediaIds, id];
    dispatch('change', { mediaIds });
    (e.target as HTMLInputElement).value = '';
  }

  async function remove(id: string) {
    await db.media.delete(id);
    mediaIds = mediaIds.filter((x) => x !== id);
    dispatch('change', { mediaIds });
  }
</script>

<div class="grid">
  {#each media as m (m.id)}
    <div class="cell">
      {#if m.type === 'photo'}
        <img src={urls[m.id]} alt="" />
      {:else}
        <video src={urls[m.id]} muted></video>
      {/if}
      <button class="x" on:click={() => remove(m.id)}>✕</button>
    </div>
  {/each}
</div>

<div class="actions">
  <label class="btn">
    📷 Add photo
    <input type="file" accept="image/*" capture="environment" on:change={addPhoto} hidden />
  </label>
  <label class="btn">
    🎥 Add video
    <input type="file" accept="video/*" capture="environment" on:change={addVideo} hidden />
  </label>
</div>

<style>
  .grid { display: grid; gap: 8px; grid-template-columns: repeat(3, 1fr); margin-bottom: 10px; }
  .cell { position: relative; aspect-ratio: 1; border-radius: 10px; overflow: hidden; background: #000; }
  .cell img, .cell video { width: 100%; height: 100%; object-fit: cover; }
  .x {
    position: absolute; top: 4px; right: 4px;
    background: rgba(0,0,0,0.7); color: #fff; border: 0;
    width: 28px; height: 28px; min-height: auto; border-radius: 50%; font-size: 12px;
  }
  .actions { display: flex; gap: 10px; }
  .btn {
    flex: 1; text-align: center; padding: 12px;
    background: var(--surface-2); color: var(--text);
    border: 1px solid var(--border); border-radius: 10px; font-size: 14px;
  }
</style>
