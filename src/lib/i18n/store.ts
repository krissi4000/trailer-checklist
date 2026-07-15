import { derived, writable } from 'svelte/store';
import { en, type Key } from './en';
import { is } from './is';

export type Lang = 'en' | 'is';
export const language = writable<Lang>('is');

const tables: Record<Lang, Record<string, string>> = { en, is };

export const t = derived(language, ($lang) => {
  return (key: string, vars: Record<string, string | number> = {}): string => {
    const raw = tables[$lang][key] ?? tables.en[key] ?? key;
    return Object.entries(vars).reduce(
      (acc, [k, v]) => acc.replace(`{${k}}`, String(v)),
      raw,
    );
  };
});

export type TFn = (key: Key | string, vars?: Record<string, string | number>) => string;
