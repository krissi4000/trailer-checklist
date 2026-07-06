import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { Blob as NodeBlob } from 'node:buffer';

// fake-indexeddb clones stored values with Node's structuredClone, which
// doesn't recognize happy-dom's Blob class — stored blobs come back as bare
// { type } objects with the payload lost. Node's own Blob survives the clone,
// so use it as the global Blob in tests.
globalThis.Blob = NodeBlob as unknown as typeof Blob;

afterEach(async () => {
  const dbs = await indexedDB.databases?.();
  if (!dbs) return;
  await Promise.all(
    dbs.map((info) => {
      if (!info.name) return Promise.resolve();
      const name = info.name;
      return new Promise<void>((resolve, reject) => {
        const req = indexedDB.deleteDatabase(name);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
        req.onblocked = () => resolve();
      });
    }),
  );
});
