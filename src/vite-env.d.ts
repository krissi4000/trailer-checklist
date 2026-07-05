/// <reference types="svelte" />
/// <reference types="vite/client" />
declare module 'virtual:pwa-register' {
  export interface RegisterSWOptions { immediate?: boolean }
  export function registerSW(opts?: RegisterSWOptions): (reload?: boolean) => Promise<void>;
}
declare namespace svelteHTML {
  interface HTMLAttributes<T> {
    'on:longpress'?: (event: CustomEvent) => void;
  }
}
