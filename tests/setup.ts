import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';

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
