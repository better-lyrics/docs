const resetTimers = new WeakMap<Element, number>();

export function morphTo(container: Element, state: string): void {
  window.clearTimeout(resetTimers.get(container));
  container.querySelectorAll<HTMLElement>(':scope > [data-morph]').forEach((child) => {
    const active = child.dataset.morph === state;
    child.dataset.active = String(active);
    child.setAttribute('aria-hidden', String(!active));
  });
}

export function morphFor(container: Element, state: string, resetTo: string, ms = 2000): void {
  morphTo(container, state);
  resetTimers.set(container, window.setTimeout(() => morphTo(container, resetTo), ms));
}
