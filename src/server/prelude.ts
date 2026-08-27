/**
 * The prelude splitter for prompted-reasoning mode (spec:
 * docs/superpowers/specs/2026-08-27-prompted-reasoning-design.md).
 *
 * On that path native thinking is off and the model reasons in the ordinary content
 * stream instead: a scripted planning pass written BEFORE the report. This module finds
 * that boundary in a live stream of deltas and re-tags everything before it as
 * `thinking`, so the plan rides the same SSE event native reasoning used and never
 * reaches the report buffer that guards and the disclaimer see.
 *
 * The boundary is a line that starts with one of the canonical report headings — the
 * exact strings the client's cards already match on (language.ts headingsFor), so no new
 * sentinel has to be taught to the model. Matching is line-wise: a heading quoted
 * mid-sentence in the plan never splits, only a heading at the start of its own line.
 * The plan instructions forbid `#`-prefixed lines, so the plan cannot fake one.
 *
 * THE HEADLINE LINE (`# <headline>`) is a CONDITIONAL boundary. The report is asked to
 * open with it, but a bare `# ` prefix cannot be trusted as the report's start on its
 * own: a model that leads with the headline (before its plan) or slips a `#`-prefixed
 * scratch line into the plan would otherwise get the entire plan reclassified as report
 * content — plan on the page, murmur empty. So a complete `# ` line is HELD, along with
 * any blank lines under it, and classified by what follows: the first canonical heading
 * makes it (and the report) content; anything else demotes it to thinking. A headline
 * the model wrote too early is remembered and REPLAYED as content just before the true
 * boundary, so the report still gets its title (the one deliberate departure from
 * byte-faithful re-tagging; the replayed line also appeared in the thinking stream).
 *
 * Streaming behaviour: complete non-heading lines are emitted as thinking immediately.
 * A partial line is held back only while it is still byte-for-byte a prefix of some
 * heading, or a plausible headline still short of its newline; the moment it diverges it
 * is emitted live (and the rest of that line skips the heading check — headings only
 * count at line starts). So the murmur stays live and the held tail stays tiny, whatever
 * the delta boundaries do.
 *
 * Pure and DOM-free like dom.ts: no document/window, testable in plain node.
 */

import type { StreamReportItem } from './deepseek';

/**
 * A `# ` tail longer than this is no plausible one-line headline (the prompt caps it at
 * twelve words): it streams as thinking instead of accumulating in the hold buffer.
 */
const HEADLINE_HOLD_MAX_CHARS = 240;

export interface PreludeSplitter {
  /** Re-tag one content delta. Returns the items to forward, in order. */
  push(delta: string): StreamReportItem[];
  /**
   * End of stream: drain whatever is still held. A held heading (a report that is just a
   * bare heading) counts as content; anything else — a held headline included — is plan
   * tail, tagged thinking.
   */
  flush(): StreamReportItem[];
  /** True once the boundary has been seen; from then on push is a pass-through. */
  readonly contentStarted: boolean;
  /** Total characters tagged as thinking so far — the runaway guard's meter. */
  readonly preludeChars: number;
}

export function createPreludeSplitter(headings: readonly string[]): PreludeSplitter {
  let contentStarted = false;
  let preludeChars = 0;
  /** The current partial line, held only while it could still become a heading/headline. */
  let held = '';
  /** True when the current line was already emitted in part: no heading check applies. */
  let midLine = false;
  /** A complete `# ` line (plus trailing blank lines), held until classified. */
  let pendingHeadline = '';
  /** The first `# ` line demoted to plan text, kept for replay at the true boundary. */
  let earlyHeadline: string | null = null;

  const startsHeading = (line: string): boolean => headings.some((h) => line.startsWith(h));
  const headingPrefix = (partial: string): boolean => headings.some((h) => h.startsWith(partial));
  const isHeadlineLine = (line: string): boolean => line.startsWith('# ');
  const couldBeHeadline = (partial: string): boolean =>
    (partial === '#' || partial.startsWith('# ')) && partial.length <= HEADLINE_HOLD_MAX_CHARS;

  const thinking = (text: string): StreamReportItem => {
    preludeChars += text.length;
    return { kind: 'thinking', text };
  };

  /** The pending headline was plan text after all: emit it as thinking, remember the first. */
  const demote = (items: StreamReportItem[]): void => {
    if (pendingHeadline === '') return;
    if (earlyHeadline === null) earlyHeadline = pendingHeadline.split('\n')[0];
    items.push(thinking(pendingHeadline));
    pendingHeadline = '';
  };

  /**
   * The boundary: `text` starts the report. A held headline directly above it leads it
   * in; failing that, a remembered early headline is replayed so the title survives.
   */
  const contentFrom = (text: string): StreamReportItem => {
    contentStarted = true;
    const lead =
      pendingHeadline !== '' ? pendingHeadline : earlyHeadline !== null ? `${earlyHeadline}\n\n` : '';
    pendingHeadline = '';
    return { kind: 'content', text: lead + text };
  };

  return {
    push(delta: string): StreamReportItem[] {
      if (contentStarted) return delta === '' ? [] : [{ kind: 'content', text: delta }];
      if (delta === '') return [];

      const items: StreamReportItem[] = [];
      let text = held + delta;
      held = '';

      for (;;) {
        const nl = text.indexOf('\n');
        if (nl === -1) break;
        const line = text.slice(0, nl);
        if (!midLine && startsHeading(line)) {
          // The boundary: this heading line and everything after it is the report.
          items.push(contentFrom(text));
          return items;
        }
        if (!midLine && pendingHeadline !== '' && line.trim() === '') {
          // Blank lines stay glued to the held headline, classified along with it.
          pendingHeadline += text.slice(0, nl + 1);
          text = text.slice(nl + 1);
          continue;
        }
        if (!midLine && isHeadlineLine(line)) {
          // A newer headline supersedes a held one (the held one was plan text).
          demote(items);
          pendingHeadline = text.slice(0, nl + 1);
          text = text.slice(nl + 1);
          continue;
        }
        // A complete non-heading line: plan text, emitted with its newline — and any
        // held headline above it was plan text too.
        if (!midLine) demote(items);
        items.push(thinking(text.slice(0, nl + 1)));
        midLine = false;
        text = text.slice(nl + 1);
      }

      if (text === '') return items;
      if (midLine) {
        // The line already diverged from every heading: stream its remainder live.
        items.push(thinking(text));
        return items;
      }
      if (startsHeading(text)) {
        // The heading line has begun (its newline just hasn't arrived): report from here.
        items.push(contentFrom(text));
        return items;
      }
      if (headingPrefix(text) || couldBeHeadline(text)) {
        // Genuinely ambiguous ("## How your mi...", "# Steady Ha..."): hold for more.
        held = text;
        return items;
      }
      // This line can no longer become a heading or headline: emit live, skip checks to
      // its newline — which also settles any held headline as plan text.
      demote(items);
      midLine = true;
      items.push(thinking(text));
      return items;
    },

    flush(): StreamReportItem[] {
      if (contentStarted) return [];
      const items: StreamReportItem[] = [];
      const tail = held;
      held = '';
      if (tail !== '' && startsHeading(tail)) {
        items.push(contentFrom(tail));
        return items;
      }
      if (pendingHeadline !== '') {
        items.push(thinking(pendingHeadline));
        pendingHeadline = '';
      }
      if (tail !== '') items.push(thinking(tail));
      return items;
    },

    get contentStarted() {
      return contentStarted;
    },
    get preludeChars() {
      return preludeChars;
    },
  };
}
