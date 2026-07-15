/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';

declare const self: ServiceWorkerGlobalScope;

// Activate updates immediately instead of waiting for every instance of
// the app to close first.
void self.skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);

const TAG = 'trailer-runs-sync';

self.addEventListener('sync', (event) => {
  const e = event as ExtendableEvent & { tag: string };
  if (e.tag === TAG) {
    e.waitUntil(notifyClients());
  }
});

async function notifyClients() {
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  for (const client of clients) client.postMessage({ type: 'run-sync' });
}
