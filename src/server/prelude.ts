/**
 * The prelude splitter for prompted-reasoning mode (spec:
 * docs/superpowers/specs/2026-08-27-prompted-reasoning-design.md).
 *
 * On that path native thinking is off and the model reasons in the ordinary content
 * stream instead: a scripted planning pass written BEFORE the first report heading. This
 * module finds that boundary in a live stream of deltas and re-tags everything before it
 * as `thinking`, so the plan rides the same SSE event native reasoning used and never
 * reaches the report buffer that guards and the disclaimer see.
 *
 * The boundary is a line that starts with one of the canonical report headings — the
 * exact strings the client's cards already match on (language.ts headingsFor), so no new
 * sentinel has to be taught to the model. Matching is line-wise: a heading quoted
 * mid-sentence in the plan never splits, only a heading at the start of its own line.
 * The plan instructions forbid `#`-prefixed lines, so the plan cannot fake one.
 *
 * Streaming behaviour: complete non-heading lines are emitted as thinking immediately.
 * A partial line is held back only while it is still byte-for-byte a prefix of some
 * heading; the moment it diverges it is emitted live (and the rest of that line skips
 * the heading check — headings only count at line starts). So the murmur stays live and
 * the held tail stays tiny, whatever the delta boundaries do.
 *
 * Pure and DOM-free like dom.ts: no document/window, testable in plain node.
 */

import type { StreamReportItem } from './deepseek';

export interface PreludeSplitter {
  /** Re-tag one content delta. Returns the items to forward, in order. */
  push(delta: string): StreamReportItem[];
  /**
   * End of stream: drain whatever is still held. A held heading (a report that is just a
   * bare heading) counts as content; anything else is plan tail, tagged thinking.
   */
  flush(): StreamReportItem[];
  /** True once the boundary heading has been seen; from then on push is a pass-through. */
  readonly contentStarted: boolean;
  /** Total characters tagged as thinking so far — the runaway guard's meter. */
  readonly preludeChars: number;
}

export function createPreludeSplitter(headings: readonly string[]): PreludeSplitter {
  let contentStarted = false;
  let preludeChars = 0;
  /** The current partial line, held only while it could still become a heading. */
  let held = '';
  /** True when the current line was already emitted in part: no heading check applies. */
  let midLine = false;

  const startsHeading = (line: string): boolean => headings.some((h) => line.startsWith(h));
  const headingPrefix = (partial: string): boolean => headings.some((h) => h.startsWith(partial));

  const thinking = (text: string): StreamReportItem => {
    preludeChars += text.length;
    return { kind: 'thinking', text };
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
        if (!midLine && startsHeading(text.slice(0, nl))) {
          // The boundary: this heading line and everything after it is the report.
          contentStarted = true;
          items.push({ kind: 'content', text });
          return items;
        }
        // A complete non-heading line: plan text, emitted with its newline.
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
        contentStarted = true;
        items.push({ kind: 'content', text });
        return items;
      }
      if (headingPrefix(text)) {
        // Genuinely ambiguous ("## How your mi..."): hold until more arrives.
        held = text;
        return items;
      }
      // This line can no longer become a heading: emit live, skip checks to its newline.
      midLine = true;
      items.push(thinking(text));
      return items;
    },

    flush(): StreamReportItem[] {
      if (contentStarted || held === '') return [];
      const text = held;
      held = '';
      if (startsHeading(text)) {
        contentStarted = true;
        return [{ kind: 'content', text }];
      }
      return [thinking(text)];
    },

    get contentStarted() {
      return contentStarted;
    },
    get preludeChars() {
      return preludeChars;
    },
  };
}
