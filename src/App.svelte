<script lang="ts">
  import { onMount } from 'svelte';
  import { currentScreen } from '$lib/stores/screen';
  import { loadSettings } from '$lib/stores/settings';
  import { refreshPending } from '$lib/stores/pending';
  import { online } from '$lib/stores/network';
  import { runQueue } from '$lib/sync/queue';
  import Toast from '$lib/components/Toast.svelte';

  import Home from '$screens/Home.svelte';
  import PickUser from '$screens/PickUser.svelte';
  import RunChecklist from '$screens/RunChecklist.svelte';
  import ItemDetail from '$screens/ItemDetail.svelte';
  import Submit from '$screens/Submit.svelte';
  import EditList from '$screens/EditList.svelte';
  import EditChecklist from '$screens/EditChecklist.svelte';
  import EditItem from '$screens/EditItem.svelte';
  import Settings from '$screens/Settings.svelte';

  onMount(async () => {
    await loadSettings();
    await refreshPending();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (e) => {
        if (e.data?.type === 'run-sync') {
          runQueue().then(refreshPending);
        }
      });
    }
  });

  let wasOnline = false;
  $: if ($online && !wasOnline) {
    wasOnline = true;
    runQueue().then(refreshPending);
  } else if (!$online) {
    wasOnline = false;
  }
</script>

{#if $currentScreen.name === 'home'}
  <Home />
{:else if $currentScreen.name === 'pickUser'}
  <PickUser checklistId={$currentScreen.checklistId} />
{:else if $currentScreen.name === 'run'}
  <RunChecklist checklistId={$currentScreen.checklistId} user={$currentScreen.user} />
{:else if $currentScreen.name === 'item'}
  <ItemDetail checklistId={$currentScreen.checklistId} itemId={$currentScreen.itemId} />
{:else if $currentScreen.name === 'submit'}
  <Submit />
{:else if $currentScreen.name === 'editList'}
  <EditList />
{:else if $currentScreen.name === 'editChecklist'}
  <EditChecklist checklistId={$currentScreen.checklistId} />
{:else if $currentScreen.name === 'editItem'}
  <EditItem checklistId={$currentScreen.checklistId} itemId={$currentScreen.itemId} />
{:else if $currentScreen.name === 'settings'}
  <Settings />
{/if}

<Toast />
