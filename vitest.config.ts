import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [svelte({ hot: false })],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    // Without this, svelte resolves to its server build in tests and
    // onMount never fires.
    conditions: ['browser'],
    alias: {
      $lib: fileURLToPath(new URL('./src/lib', import.meta.url)),
      $screens: fileURLToPath(new URL('./src/screens', import.meta.url)),
    },
  },
});
