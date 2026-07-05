<script lang="ts">
  import { onMount } from 'svelte';
  import Header from '$lib/components/Header.svelte';
  import { t } from '$lib/i18n/store';
  import { settings, updateSettings, loadSettings } from '$lib/stores/settings';
  import { pendingRuns } from '$lib/db/repos';
  import { runQueue } from '$lib/sync/queue';
  import { refreshPending } from '$lib/stores/pending';
  import { showToast } from '$lib/stores/toast';
  import { back, navigate } from '$lib/stores/screen';
  import type { Run } from '$lib/db/schema';

  let newUser = '';
  let endpoint = '';
  let secret = '';
  let pending: Run[] = [];
  let storageMB = 0;

  onMount(async () => {
    await loadSettings();
    const s = $settings;
    endpoint = s?.endpoint_url ?? '';
    secret = s?.shared_secret ?? '';
    pending = await pendingRuns();
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      storageMB = Math.round(((est.usage ?? 0) / 1024 / 1024) * 10) / 10;
    }
  });

  async function addUser() {
    if (!newUser.trim() || !$settings) return;
    await updateSettings({ users: [...$settings.users, newUser.trim()] });
    newUser = '';
  }
  async function removeUser(u: string) {
    if (!$settings) return;
    await updateSettings({ users: $settings.users.filter((x) => x !== u) });
  }
  async function setLang(l: 'en' | 'is') {
    await updateSettings({ language: l });
  }
  async function saveEndpoint() {
    await updateSettings({ endpoint_url: endpoint, shared_secret: secret });
    showToast('Saved', 'ok');
  }
  async function forceSync() {
    const s = await runQueue();
    await refreshPending();
    pending = await pendingRuns();
    showToast(`Synced: ${s.ok}, retry: ${s.retry}, errors: ${s.fatal}`, s.fatal ? 'warn' : 'ok');
  }
</script>

<Header title={$t('settings.title')} onBack={back} />

<main>
  <section>
    <h3>{$t('edit.checklists')}</h3>
    <button class="edit-lists" on:click={() => navigate({ name: 'editList' })}>
      ✏️ {$t('settings.editChecklists')}
    </button>
  </section>

  <section>
    <h3>{$t('settings.users')}</h3>
    <ul>
      {#each $settings?.users ?? [] as u (u)}
        <li>
          <span>{u}</span>
          <button on:click={() => removeUser(u)} aria-label="Remove">🗑</button>
        </li>
      {/each}
    </ul>
    <div class="row">
      <input bind:value={newUser} placeholder={$t('settings.addUser')} />
      <button on:click={addUser}>+</button>
    </div>
  </section>

  <section>
    <h3>{$t('settings.language')}</h3>
    <div class="lang">
      <button class:active={$settings?.language === 'en'} on:click={() => setLang('en')}>English</button>
      <button class:active={$settings?.language === 'is'} on:click={() => setLang('is')}>Íslenska</button>
    </div>
  </section>

  <section>
    <h3>{$t('settings.endpoint')}</h3>
    <input bind:value={endpoint} placeholder="https://script.google.com/macros/s/.../exec" />
    <h3>{$t('settings.secret')}</h3>
    <input bind:value={secret} type="password" />
    <button class="save" on:click={saveEndpoint}>{$t('common.save')}</button>
  </section>

  <section>
    <h3>{$t('settings.queue')}</h3>
    <p class="muted">{pending.length} pending</p>
    <button on:click={forceSync}>{$t('settings.forceSync')}</button>
  </section>

  <section>
    <h3>{$t('settings.storage')}</h3>
    <p class="muted">{storageMB} MB used</p>
  </section>
</main>

<style>
  main { padding: 16px; }
  section { margin-bottom: 24px; }
  h3 { font-size: 13px; color: var(--muted); margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.08em; }
  ul { list-style: none; padding: 0; margin: 0 0 8px; }
  li { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--border); }
  li button { background: transparent; color: var(--err); border: 0; min-height: auto; padding: 4px 8px; }
  .row { display: flex; gap: 8px; }
  input {
    flex: 1; background: var(--surface); color: var(--text);
    border: 1px solid var(--border); border-radius: 10px; padding: 12px; font: inherit;
  }
  .row button {
    background: var(--accent); color: #fff; border: 0; border-radius: 10px;
    width: 48px; font-size: 22px;
  }
  .save {
    margin-top: 10px; background: var(--accent); color: #fff;
    border: 0; border-radius: 10px; padding: 12px 20px;
  }
  .edit-lists {
    width: 100%; background: var(--surface); color: var(--text);
    border: 1px solid var(--border); border-radius: 10px; padding: 12px;
    text-align: left;
  }
  .lang { display: flex; gap: 8px; }
  .lang button {
    flex: 1; background: var(--surface); color: var(--muted);
    border: 1px solid var(--border); border-radius: 10px; padding: 12px;
  }
  .lang .active { background: var(--surface-2); color: var(--text); border-color: var(--accent); }
  .muted { color: var(--muted); }
</style>
