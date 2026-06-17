import { readable } from 'svelte/store';

export const online = readable<boolean>(
  typeof navigator !== 'undefined' ? navigator.onLine : true,
  (set) => {
    if (typeof window === 'undefined') return;

    // Set initial value from navigator.onLine
    set(navigator.onLine);

    const on = () => set(true);
    const off = () => set(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  },
);
