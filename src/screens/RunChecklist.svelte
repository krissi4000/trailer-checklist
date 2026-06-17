<script lang="ts">
  import Header from '$lib/components/Header.svelte';
  import { t, language } from '$lib/i18n/store';
  import { getChecklist, listItems } from '$lib/db/repos';
  import type { Checklist, Item } from '$lib/db/schema';
  import { navigate, back } from '$lib/stores/screen';

  export let checklistId: string;
  export let user: string;

  let checklist: Checklist | undefined;
  let items: Item[] = [];
  let checkedIds: Set<string> = new Set();
  let notes: Record<string, string> = {};
  let startedAt = new Date().toISOString();
  let initialized = false;

  async function load() {
    checklist = await getChecklist(checklistId);
    const loaded = await listItems(checklistId);
    items = loaded;
    checkedIds = new Set();
    notes = {};
  }

  $: if (!initialized && checklistId) {
    initialized = true;
    load();
  }

  function pickName(name_en: string, name_is: string): string {
    return $language === 'is' ? (name_is || name_en) : (name_en || name_is);
  }

  function toggleCheck(id: string) {
    if (checkedIds.has(id)) {
      checkedIds.delete(id);
    } else {
      checkedIds.add(id);
    }
    checkedIds = checkedIds; // Ensure reactivity
  }

  function submit() {
    const payload = {
      checklist_id: checklistId,
      checklist_name_snapshot: checklist ? pickName(checklist.name_en, checklist.name_is) : '',
      user_name: user,
      started_at: startedAt,
      item_results: items.map((i) => ({
        item_id: i.id,
        title_snapshot: pickName(i.title_en, i.title_is),
        checked: checkedIds.has(i.id),
        note: notes[i.id] ?? '',
      })),
    };
    sessionStorage.setItem('pending-run', JSON.stringify(payload));
    navigate({ name: 'submit', runId: 'pending' });
  }
</script>

<Header title={checklist ? pickName(checklist.name_en, checklist.name_is) : ''} onBack={back} />

<main>
  <ul>
    {#each items as it (it.id)}
      <li>
        <label>
          <input
            type="checkbox"
            aria-label={pickName(it.title_en, it.title_is)}
            checked={checkedIds.has(it.id)}
            on:change={() => toggleCheck(it.id)}
          />
          <span class="title">{pickName(it.title_en, it.title_is)}</span>
        </label>
        <button
          class="more"
          on:click={() => navigate({ name: 'item', checklistId, itemId: it.id, user })}
          aria-label={$t('run.openInstructions')}
        >ⓘ</button>
      </li>
    {/each}
  </ul>

  <button class="submit" on:click={submit} disabled={items.length === 0}>
    {$t('run.submit')}
  </button>
</main>

<style>
  main { padding: 16px 16px 100px; }
  ul { list-style: none; padding: 0; margin: 0; }
  li {
    display: flex; align-items: center; gap: 12px;
    padding: 14px 12px; border-bottom: 1px solid var(--border);
  }
  label { display: flex; align-items: center; gap: 12px; flex: 1; }
  input[type="checkbox"] { width: 28px; height: 28px; }
  .title { font-size: 17px; }
  .more {
    background: var(--surface-2); color: var(--text);
    border: 1px solid var(--border); border-radius: 50%;
    width: 40px; height: 40px; min-height: auto; font-size: 18px;
  }
  .submit {
    position: fixed; bottom: 16px; left: 16px; right: 16px;
    background: var(--accent); color: #fff;
    border: 0; border-radius: var(--radius); font-size: 18px; font-weight: 600;
    padding: 16px; min-height: var(--tap);
  }
  .submit:disabled { opacity: 0.5; }
</style>
