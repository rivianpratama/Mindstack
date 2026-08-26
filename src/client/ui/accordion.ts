/**
 * The disclosure primitive, shared by the score form and the thinking panel.
 *
 * Height animates via grid-template-rows 0fr <-> 1fr (transitions.dev 21), so
 * there is no JS height measurement and content of any size animates cleanly.
 * Three things the raw snippet does not cover, and which live here so the two
 * call sites cannot drift apart:
 *
 *   1. `inert` on the panel while shut. A 0fr track with overflow: hidden still
 *      leaves its children tabbable and in the accessibility tree.
 *   2. Rescuing focus before that, or focus falls to <body> and a screen reader
 *      loses its place. `preventScroll` keeps the rescue from racing a caller's
 *      own scrollIntoView.
 *   3. A promise that resolves when the height has settled, so a caller can
 *      schedule a scroll that will not be computed against a stale layout.
 *
 * As with dom.ts, nothing here touches the DOM at module scope.
 */

import { el, motionMs, prefersReducedMotion } from './dom';

export interface Accordion {
  /** The .t-acc root; carries data-open. */
  root: HTMLElement;
  /** The clickable header button. */
  head: HTMLButtonElement;
  /** The header row - callers may append their own collapsed-state summary. */
  headRow: HTMLElement;
  /** Where callers put panel content. Padding belongs here, never on the track. */
  content: HTMLElement;
  readonly open: boolean;
  /** Idempotent. Resolves once the height transition has settled. */
  set(open: boolean, options?: { moveFocusIfInside?: boolean }): Promise<void>;
  toggle(): Promise<void>;
}

export interface AccordionOptions {
  /** Id for the panel, referenced by the header's aria-controls. */
  id: string;
  label: string;
  /** The header sits inside a heading so screen-reader heading nav still lands on it. */
  headingTag?: 'h2' | 'h3';
  /** Extra classes for the root, e.g. 'card input-card'. */
  className?: string;
  open?: boolean;
  /** Builds the head's icon. */
  icon: () => HTMLElement;
  /** Put the icon before the label rather than after it. */
  iconFirst?: boolean;
}

export function createAccordion(options: AccordionOptions): Accordion {
  const { id, label, headingTag = 'h2', className, open = true, icon, iconFirst = false } = options;

  const root = el('div', className ? `t-acc ${className}` : 't-acc');

  const headRow = el('div', 'acc-head-row');
  const heading = el(headingTag, 'card-title');
  const head = el('button', 't-acc-head');
  head.type = 'button';
  head.setAttribute('aria-controls', id);
  const glyph = icon();
  const text = el('span', 'acc-head-label', label);
  head.append(...(iconFirst ? [glyph, text] : [text, glyph]));
  heading.appendChild(head);
  headRow.appendChild(heading);

  /*
   * Three levels, and all three are load-bearing:
   *   .t-acc-panel       the 0fr <-> 1fr grid track
   *   .t-acc-panel-inner overflow: hidden, and NO padding of its own
   *   .t-acc-panel-body  where the padding lives
   *
   * The middle element must stay padding-free. overflow: hidden clips content,
   * but an element's own padding still floors its border-box height, so padding
   * there leaves a residual strip exactly that tall when the track is collapsed.
   * Pushing it one level down makes the padding part of the clipped content.
   */
  const panel = el('div', 't-acc-panel');
  panel.id = id;
  const inner = el('div', 't-acc-panel-inner');
  const content = el('div', 't-acc-panel-body');
  inner.appendChild(content);
  panel.appendChild(inner);

  root.append(headRow, panel);

  /**
   * Wait for the height tween to finish. Under prefers-reduced-motion the
   * transition is `none` and transitionend never fires, so the timeout is the
   * real path there, not a safety net.
   */
  const settle = (isOpen: boolean): Promise<void> => {
    if (prefersReducedMotion()) {
      return new Promise((resolve) => requestAnimationFrame(() => resolve()));
    }
    const ms = motionMs(isOpen ? '--acc-expand' : '--acc-collapse', 250);
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        panel.removeEventListener('transitionend', onEnd);
        clearTimeout(timer);
        resolve();
      };
      const onEnd = (event: TransitionEvent) => {
        if (event.target === panel && event.propertyName === 'grid-template-rows') finish();
      };
      panel.addEventListener('transitionend', onEnd);
      const timer = setTimeout(finish, ms + 30);
    });
  };

  const api: Accordion = {
    root,
    head,
    headRow,
    content,

    get open(): boolean {
      // The DOM attribute is the single source of truth: no parallel boolean to
      // drift out of step with what CSS is actually rendering.
      return root.dataset.open === 'true';
    },

    set(next: boolean, setOptions?: { moveFocusIfInside?: boolean }): Promise<void> {
      const moveFocus = setOptions?.moveFocusIfInside !== false;
      if (!next && moveFocus && root.contains(document.activeElement)) {
        head.focus({ preventScroll: true });
      }
      root.dataset.open = String(next);
      head.setAttribute('aria-expanded', String(next));
      // Synchronous, so a caller may focus a field immediately after expanding.
      content.inert = !next;
      return settle(next);
    },

    toggle(): Promise<void> {
      return api.set(!api.open);
    },
  };

  head.addEventListener('click', () => {
    void api.toggle();
  });

  // Establish the initial state through the same path, so inert and
  // aria-expanded are never out of step with data-open.
  root.dataset.open = String(open);
  head.setAttribute('aria-expanded', String(open));
  content.inert = !open;

  return api;
}
