<script lang="ts">
  import { toasts } from '$lib/stores/toast';
</script>

<div class="stack">
  {#each $toasts as t (t.id)}
    <div class="toast" data-tone={t.tone}>{t.text}</div>
  {/each}
</div>

<style>
  .stack {
    position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%);
    display: flex; flex-direction: column; gap: 8px; z-index: 100; pointer-events: none;
  }
  .toast {
    background: var(--surface-2); color: var(--text);
    padding: 10px 16px; border-radius: 10px; box-shadow: 0 4px 16px rgba(0,0,0,0.4);
    font-size: 14px; border: 1px solid var(--border);
  }
  .toast[data-tone="ok"] { border-color: var(--ok); }
  .toast[data-tone="warn"] { border-color: var(--warn); }
  .toast[data-tone="err"] { border-color: var(--err); }
</style>
