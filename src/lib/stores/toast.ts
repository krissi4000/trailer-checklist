import { writable } from 'svelte/store';

export interface ToastMsg { id: number; text: string; tone: 'info' | 'ok' | 'warn' | 'err' }

const _toasts = writable<ToastMsg[]>([]);
export const toasts = { subscribe: _toasts.subscribe };
let nextId = 1;

export function showToast(text: string, tone: ToastMsg['tone'] = 'info', ms = 3000) {
  const id = nextId++;
  _toasts.update((cur) => [...cur, { id, text, tone }]);
  setTimeout(() => _toasts.update((cur) => cur.filter((t) => t.id !== id)), ms);
}
