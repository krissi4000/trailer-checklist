import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';

afterEach(async () => {
  const dbs = await indexedDB.databases?.();
  if (dbs) for (const db of dbs) if (db.name) indexedDB.deleteDatabase(db.name);
});
