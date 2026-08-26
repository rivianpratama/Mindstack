/**
 * The live reasoning window.
 *
 * The model's raw private reasoning, shown while it works. It is never audited,
 * never part of the report, and deliberately styled unlike one: a drifting
 * murmur of the last few dozen words in a serif italic, fading at both edges.
 * It is a sign of life rather than something to read closely.
 *
 * The panel is always open. Its header is a slot that ReportView fills with the
 * live status line ("The model is thinking… 12s"), so the status and the stream
 * are one object instead of two that say the same thing.
 *
 * createThinkingModel below is the pure, testable half: buffering and escaping,
 * with no DOM. Escaping happens per delta, which is safe because escapeHtml has
 * no cross-character state - that is what keeps this linear rather than O(n^2).
 */

import { escapeHtml } from './ReportView';
import { createFrameScheduler, el, motionMs } from './dom';

/**
 * The mandatory label. Kept as an exported constant so a test can assert it is
 * present and says the two things that matter: not the report, not checked.
 */
/**
 * No longer rendered - the panel header says "The model is thinking..." and the
 * murmur's whole treatment marks it as scratch work. Kept as an exported
 * constant because the honesty wording is asserted by the test suite, and
 * because any future surface that shows raw reasoning should reuse it.
 */
export const THINKING_NOTICE =
  "This is the model's raw private reasoning. Unfiltered scratch work. It is NOT part of " +
  "your report and is NOT checked against the report's honesty rules.";

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

export interface ThinkingPanelApi {
  /** The panel element. Always open - there is nothing to collapse. */
  element: HTMLElement;
  /** Header slot: ReportView parks the live status line here. */
  header: HTMLElement;
  /** Append a raw reasoning delta; renders on the next animation frame. */
  push(delta: string): void;
  /** Render any buffered delta immediately (call once at end of stream). */
  flush(): void;
  /** Drop anything still queued and stop the pacing timer. */
  stop(): void;
  /** First report content arrived. Returns true the first time only. */
  noteContent(): boolean;
  readonly active: boolean;
  readonly contentStarted: boolean;
}

export function createThinkingPanel(): ThinkingPanelApi {
  const model = createThinkingModel();

  /*
   * Always open. There is nothing to collapse and no disclosure chrome: the
   * panel is a live window on the run, and hiding it would leave the reader
   * staring at nothing while the model works.
   *
   * The header is a slot rather than a label - ReportView moves the live status
   * line into it, so the elapsed clock and the panel are one thing instead of
   * two that say the same thing.
   */
  const panel = el('section', 'thinking-panel');
  const header = el('div', 'thinking-head');
  panel.appendChild(header);

  /*
   * The murmur: a short window onto the reasoning rather than a transcript of
   * it. Only the last WORD_WINDOW words are kept in the DOM; new words arrive at
   * the bottom and push older ones up and out through a mask that fades both
   * edges, so the text drifts rather than scrolls. Nothing here is meant to be
   * read closely - it is a sign of life.
   *
   * Capping the window also means the DOM stays a fixed size across a run of any
   * length, instead of growing to tens of thousands of nodes.
   */
  const murmur = el('div', 'murmur');
  murmur.setAttribute('aria-label', 'model reasoning stream');
  const flow = el('div', 'murmur-flow');
  murmur.appendChild(flow);
  panel.appendChild(murmur);

  /** Words kept on screen. Older ones are dropped from the front. */
  const WORD_WINDOW = 50;
  /**
   * The model arrives in bursts of dozens of words; releasing them all at once
   * reads as a flicker rather than as thinking, so they are metered out.
   *
   * It also talks faster than the meter, so the backlog has to be shed somehow.
   * Trimming a little on every drain is the obvious move and it is wrong: it
   * skips a handful of words between every single emit, and what comes out is
   * word salad rather than reasoning.
   *
   * Instead the backlog is allowed to build, and when it gets too far behind the
   * queue jumps - dropping everything but the newest QUEUE_KEEP words. That
   * gives long contiguous runs of real sentences with an occasional skip,
   * instead of a continuous dribble of unrelated words.
   */
  const QUEUE_BEHIND = 140;
  const QUEUE_KEEP = 24;

  /** A delta can end mid-word, so the fragment is carried to the next drain. */
  let partial = '';
  let queue: string[] = [];
  let pump = 0;

  const emit = (piece: string): void => {
    const word = el('span', 'murmur-w');
    // Already escaped by the model - this is the same trust boundary the
    // previous insertAdjacentHTML relied on.
    word.innerHTML = piece;
    flow.appendChild(word);
    while (flow.childElementCount > WORD_WINDOW) {
      flow.removeChild(flow.firstElementChild as ChildNode);
    }
  };

  const tick = (): void => {
    if (!queue.length) {
      clearInterval(pump);
      pump = 0;
      return;
    }
    /*
     * Strictly one word per tick. Catching up by emitting several at once was
     * the obvious thing to do and it defeats the whole point - the model
     * outruns the meter continuously, so it just pins the display at the fast
     * rate again. Falling behind is handled by dropping from the queue instead,
     * which costs words nobody was going to read rather than costing the pace.
     */
    emit(queue.shift() as string);
  };

  const render = () => {
    const html = model.drain();
    if (html === '') return;

    // Safe to split escaped HTML on whitespace: the entities escapeHtml can
    // produce (&lt; &gt; &amp; &quot; &#39;) contain none.
    const combined = partial + html;
    const pieces = combined.split(/\s+/);
    partial = /\s$/.test(combined) ? '' : (pieces.pop() ?? '');

    for (const piece of pieces) {
      if (piece !== '') queue.push(piece);
    }
    // Only jump when genuinely far behind, so the run between jumps is long
    // enough to read as sentences.
    if (queue.length > QUEUE_BEHIND) queue = queue.slice(-QUEUE_KEEP);
    if (!pump && queue.length) {
      pump = setInterval(tick, motionMs('--murmur-pace', 70)) as unknown as number;
    }
  };

  const { schedule } = createFrameScheduler(render);

  return {
    element: panel,
    header,

    push(delta: string): void {
      model.push(delta);
      schedule();
    },

    flush(): void {
      render();
    },

    stop(): void {
      queue = [];
      clearInterval(pump);
      pump = 0;
    },

    noteContent(): boolean {
      const first = model.noteContent();
      // Flush what has arrived so the last words are not lost. The panel stays
      // open either way - there is nothing to collapse.
      if (first) render();
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
