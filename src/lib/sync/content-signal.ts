// Repos announce content edits here; the sync engine subscribes. This module
// has no imports so repos can use it without creating an import cycle.
type Listener = () => void;

const listeners = new Set<Listener>();

export function onContentChanged(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function notifyContentChanged(): void {
  for (const fn of listeners) fn();
}
