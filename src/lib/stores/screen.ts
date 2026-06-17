import { writable } from 'svelte/store';

export type Screen =
  | { name: 'home' }
  | { name: 'pickUser'; checklistId: string }
  | { name: 'run'; checklistId: string; user: string }
  | { name: 'item'; checklistId: string; itemId: string; user: string }
  | { name: 'submit'; runId: string }
  | { name: 'editList' }
  | { name: 'editChecklist'; checklistId: string }
  | { name: 'editItem'; checklistId: string; itemId: string }
  | { name: 'settings' };

const stack = writable<Screen[]>([{ name: 'home' }]);
export const screenStack = { subscribe: stack.subscribe };

export const currentScreen = {
  subscribe: (run: (value: Screen) => void) =>
    stack.subscribe((s) => run(s[s.length - 1])),
};

export function navigate(s: Screen) {
  stack.update((cur) => [...cur, s]);
}

export function back() {
  stack.update((cur) => (cur.length > 1 ? cur.slice(0, -1) : cur));
}

export function reset(s: Screen = { name: 'home' }) {
  stack.set([s]);
}
