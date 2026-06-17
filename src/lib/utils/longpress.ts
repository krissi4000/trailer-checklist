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

  node.addEventListener('pointerdown', start);
  node.addEventListener('pointerup', cancel);
  node.addEventListener('pointerleave', cancel);
  node.addEventListener('pointercancel', cancel);

  return {
    destroy() {
      cancel();
      node.removeEventListener('pointerdown', start);
      node.removeEventListener('pointerup', cancel);
      node.removeEventListener('pointerleave', cancel);
      node.removeEventListener('pointercancel', cancel);
    },
  };
}
