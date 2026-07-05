export function longpress(node: HTMLElement, duration = 1500) {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const start = () => {
    timer = setTimeout(() => {
      node.dispatchEvent(new CustomEvent('longpress'));
      timer = null;
    }, duration);
  };
  const cancel = () => {
    if (timer) { clearTimeout(timer); timer = null; }
  };
  // Without this, Android's native long-press (context menu / text selection)
  // takes over ~500ms into the hold and pointercancels the timer.
  const suppressMenu = (e: Event) => e.preventDefault();

  node.addEventListener('pointerdown', start);
  node.addEventListener('pointerup', cancel);
  node.addEventListener('pointerleave', cancel);
  node.addEventListener('pointercancel', cancel);
  node.addEventListener('contextmenu', suppressMenu);

  return {
    destroy() {
      cancel();
      node.removeEventListener('pointerdown', start);
      node.removeEventListener('pointerup', cancel);
      node.removeEventListener('pointerleave', cancel);
      node.removeEventListener('pointercancel', cancel);
      node.removeEventListener('contextmenu', suppressMenu);
    },
  };
}
