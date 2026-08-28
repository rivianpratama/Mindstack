/**
 * The Gemini thought unwrapper.
 *
 * Gemini cannot fully turn thinking off (see GEMINI_MIN_THINKING_LEVEL): on every path
 * the model reasons, and with `include_thoughts: true` it streams that reasoning back. But
 * unlike DeepSeek (`reasoning_content`) and OpenRouter (`reasoning`), Google's OpenAI-compat
 * layer does NOT put thoughts in a separate delta field — it inlines them in `delta.content`,
 * wrapped in a literal `<thought>...</thought>` block that precedes the answer (verified live
 * 2026-08-28 against the endpoint). So the reasoning reader in streamOneProvider never sees
 * them, and left alone the tags would leak straight into the report buffer that guards and the
 * disclaimer audit.
 *
 * This module is the seam that fixes that: it re-tags the interior of `<thought>...</thought>`
 * as `thinking` and strips the marker tags, leaving only real report text on the `content`
 * side. The content side then flows on to the prelude splitter exactly as the other providers'
 * content does, so the scripted planning pass (prompted mode) still splits normally on top.
 *
 * Streaming behaviour mirrors prelude.ts: a delta is emitted immediately except for a trailing
 * run that is still a byte-for-byte prefix of the marker being hunted (`<thought>` while in the
 * answer, `</thought>` while inside a thought), which is held until the next delta resolves it.
 * A marker split across two deltas therefore never leaks a half-tag. When no `<thought>` ever
 * appears the unwrapper is a transparent pass-through — every delta is content — so a model or
 * path that streams no inline thoughts behaves exactly as before this module existed.
 *
 * Pure and DOM-free like prelude.ts / dom.ts: no document/window, testable in plain node.
 */

import type { StreamReportItem } from './deepseek';

const OPEN = '<thought>';
const CLOSE = '</thought>';

export interface ThoughtUnwrapper {
  /** Re-tag one Gemini content delta. Returns the items to forward, in order. */
  push(delta: string): StreamReportItem[];
  /** End of stream: emit any held partial marker as the text it turned out to be. */
  flush(): StreamReportItem[];
}

/** Longest suffix of `s` that is a non-empty proper prefix of marker `m` (0 if none). */
function heldPrefixLen(s: string, m: string): number {
  const max = Math.min(s.length, m.length - 1);
  for (let k = max; k > 0; k -= 1) {
    if (s.slice(s.length - k) === m.slice(0, k)) return k;
  }
  return 0;
}

export function createThoughtUnwrapper(): ThoughtUnwrapper {
  // Which side of the `<thought>` boundary the stream is currently on.
  let inThought = false;
  // A trailing run held back only while it could still complete the marker we are hunting.
  let held = '';

  const marker = (): string => (inThought ? CLOSE : OPEN);
  const kind = (): StreamReportItem['kind'] => (inThought ? 'thinking' : 'content');

  return {
    push(delta: string): StreamReportItem[] {
      const items: StreamReportItem[] = [];
      let text = held + delta;
      held = '';

      for (;;) {
        const m = marker();
        const idx = text.indexOf(m);
        if (idx === -1) {
          // No complete marker in view. Emit everything except a tail that could still be the
          // start of one; hold that tail for the next delta.
          const hold = heldPrefixLen(text, m);
          const body = text.slice(0, text.length - hold);
          if (body !== '') items.push({ kind: kind(), text: body });
          held = text.slice(text.length - hold);
          return items;
        }
        // Emit up to the marker in the current mode, drop the marker itself, then flip sides.
        const body = text.slice(0, idx);
        if (body !== '') items.push({ kind: kind(), text: body });
        text = text.slice(idx + m.length);
        inThought = !inThought;
      }
    },

    flush(): StreamReportItem[] {
      // A held run that never completed its marker was ordinary text after all, in whatever
      // mode we ended in (an unterminated `<thought>` leaves us mid-thought → thinking).
      if (held === '') return [];
      const tail = held;
      held = '';
      return [{ kind: kind(), text: tail }];
    },
  };
}
