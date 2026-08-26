/**
 * The "Model thinking" panel: a live, collapsible view of the model's raw
 * reasoning (the `thinking` SSE event), shown while the report is generated.
 *
 * This is scratch work, not the report. It is never run through the honesty
 * gates, so it must never be mistaken for report content - hence the loud
 * notice, the deliberately different (dim, monospace, boxed) styling, and the
 * auto-collapse the instant real report content starts arriving.
 *
 * Two halves:
 *  - createThinkingModel(): a pure state machine - accumulate deltas, escape
 *    them once each (never re-escaping the whole buffer), decide the streaming
 *    status line and the one-time auto-collapse. Fully unit-testable with no DOM.
 *  - createThinkingPanel(): the thin DOM shell that reflects the model, appending
 *    escaped deltas incrementally so a multi-thousand-token reasoning stream
 *    stays O(total), not O(n^2).
 */

import { escapeHtml } from './ReportView';

/**
 * The mandatory label. Kept as an exported constant so a test can assert it is
 * present and says the two things that matter: not the report, not checked.
 */
export const THINKING_NOTICE =
  "This is the model's raw private reasoning — unfiltered scratch work, NOT part of " +
  "your report and NOT checked against the report's honesty rules.";

export const THINKING_STATUS = 'The model is thinking…';
export const WRITING_STATUS = 'Writing your report…';

/* ------------------------------------------------------------------ *
 * Pure model
 * ------------------------------------------------------------------ */

export interface ThinkingModel {
  /** Accept a raw reasoning delta. Empty deltas are ignored. */
  push(delta: string): void;
  /**
   * The escaped HTML of everything pushed since the last drain, then clears the
   * pending buffer. Each character is escaped exactly once across the stream, so
   * draining repeatedly costs O(total length), never O(n^2).
   */
  drain(): string;
  /**
   * Record that report content has started. Returns true only the first time -
   * the caller uses that to auto-collapse the panel exactly once.
   */
  noteContent(): boolean;
  /** The status line to show while streaming, or null when it has nothing to say. */
  status(): string | null;
  /** True once any non-empty thinking delta has arrived. */
  readonly active: boolean;
  /** True once report content has begun. */
  readonly contentStarted: boolean;
  /** The full raw reasoning accumulated so far (test aid; never rendered raw). */
  readonly raw: string;
  /** The full escaped HTML accumulated so far (test aid). */
  readonly escaped: string;
  /** Total characters ever escaped. Equals raw.length iff the work stayed linear. */
  readonly charsEscaped: number;
}

export function createThinkingModel(): ThinkingModel {
  let raw = '';
  let pending = '';
  let escaped = '';
  let charsEscaped = 0;
  let active = false;
  let contentStarted = false;

  return {
    push(delta: string): void {
      if (delta === '') return;
      active = true;
      raw += delta;
      pending += delta;
    },

    drain(): string {
      if (pending === '') return '';
      // escapeHtml is a per-character substitution with no cross-character
      // state, so escaping one delta in isolation is identical to escaping the
      // whole buffer - which is exactly what keeps this incremental and safe.
      const html = escapeHtml(pending);
      escaped += html;
      charsEscaped += pending.length;
      pending = '';
      return html;
    },

    noteContent(): boolean {
      const first = !contentStarted;
      contentStarted = true;
      return first;
    },

    status(): string | null {
      if (!active) return null;
      return contentStarted ? WRITING_STATUS : THINKING_STATUS;
    },

    get active() {
      return active;
    },
    get contentStarted() {
      return contentStarted;
    },
    get raw() {
      return raw;
    },
    get escaped() {
      return escaped;
    },
    get charsEscaped() {
      return charsEscaped;
    },
  };
}

/* ------------------------------------------------------------------ *
 * DOM shell
 * ------------------------------------------------------------------ */

function el(tag: string, className?: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export interface ThinkingPanelApi {
  /** The <details> panel element. */
  element: HTMLElement;
  /** Append a raw reasoning delta; renders on the next animation frame. */
  push(delta: string): void;
  /** Render any buffered delta immediately (call once at end of stream). */
  flush(): void;
  /** First report content arrived: auto-collapse once. Returns true the first time. */
  noteContent(): boolean;
  readonly active: boolean;
  readonly contentStarted: boolean;
}

export function createThinkingPanel(): ThinkingPanelApi {
  const model = createThinkingModel();

  const panel = el('details', 'thinking-panel');
  panel.setAttribute('open', '');

  const summary = el('summary', 'thinking-summary');
  summary.appendChild(el('span', 'thinking-title', 'Model thinking'));
  const hint = el('span', 'thinking-hint', 'live');
  summary.appendChild(hint);
  panel.appendChild(summary);

  const notice = el('p', 'thinking-notice', THINKING_NOTICE);
  panel.appendChild(notice);

  // A <pre> keeps the reasoning's own whitespace and line breaks, and reads as
  // scratch work. Escaped deltas are appended to it - never innerHTML on the
  // whole buffer - so cost stays proportional to what just arrived.
  const stream = el('pre', 'thinking-stream');
  stream.setAttribute('aria-label', 'model reasoning stream');
  panel.appendChild(stream);

  let frame = 0;

  const render = () => {
    frame = 0;
    const html = model.drain();
    if (html === '') return;
    stream.insertAdjacentHTML('beforeend', html);
    // Follow the tail while expanded; leave a collapsed panel where the reader put it.
    if (panel.hasAttribute('open')) stream.scrollTop = stream.scrollHeight;
  };

  const schedule = () => {
    if (frame) return;
    frame =
      typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame(render)
        : (setTimeout(render, 16) as unknown as number);
  };

  return {
    element: panel,

    push(delta: string): void {
      model.push(delta);
      schedule();
    },

    flush(): void {
      render();
    },

    noteContent(): boolean {
      const first = model.noteContent();
      if (first) {
        // Flush what has arrived so nothing is lost, then collapse.
        render();
        panel.removeAttribute('open');
        hint.textContent = 'reasoning done · tap to expand';
      }
      return first;
    },

    get active() {
      return model.active;
    },
    get contentStarted() {
      return model.contentStarted;
    },
  };
}
