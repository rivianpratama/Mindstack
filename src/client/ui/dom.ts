/**
 * DOM micro-helpers, shared by every view module.
 *
 * IMPORTANT: nothing in this file may touch `document`, `window`, `matchMedia`
 * or `getComputedStyle` at module scope. ReportView imports this file, and the
 * test suite imports ReportView in a plain node environment where none of those
 * globals exist. Everything here is a function, called only from a browser.
 */

/**
 * Build an element. The overload keeps the concrete type, so `el('input')` is
 * an HTMLInputElement and callers need no casts.
 */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K];
export function el(tag: string, className?: string, text?: string): HTMLElement;
export function el(tag: string, className?: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Bulk setAttribute. Undefined values are skipped, so optionals stay inline. */
export function attrs(node: Element, map: Record<string, string | undefined>): void {
  for (const [key, value] of Object.entries(map)) {
    if (value !== undefined) node.setAttribute(key, value);
  }
}

/**
 * A shimmering label (transitions.dev 15-shimmer-text). The ::before layer
 * masks a gradient onto the same glyphs via content: attr(data-text), so the
 * attribute must carry the same string as the text node.
 */
export function shimmerText(text: string): HTMLElement {
  const node = el('span', 't-shimmer', text);
  node.setAttribute('data-text', text);
  return node;
}

/**
 * Coalesce repeated calls into one run per animation frame. Extracted from the
 * identical schedulers ReportView and ThinkingPanel each used to carry.
 */
export function createFrameScheduler(run: () => void): {
  schedule(): void;
  cancel(): void;
} {
  let frame = 0;
  const tick = () => {
    frame = 0;
    run();
  };
  return {
    schedule() {
      if (frame) return;
      frame =
        typeof requestAnimationFrame === 'function'
          ? requestAnimationFrame(tick)
          : (setTimeout(tick, 16) as unknown as number);
    },
    cancel() {
      if (!frame) return;
      if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
      else clearTimeout(frame);
      frame = 0;
    },
  };
}

/**
 * Read a duration token (e.g. `--acc-expand: 250ms`) as a number of ms. Used to
 * size the timeout that backstops a transitionend listener, so the JS and the
 * CSS cannot drift apart.
 */
export function motionMs(name: string, fallback: number): number {
  if (typeof getComputedStyle !== 'function') return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name);
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : fallback;
}

export function prefersReducedMotion(): boolean {
  return (
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
