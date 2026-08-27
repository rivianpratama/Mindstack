# Prompted-plan reasoning (thinking off, plan first, same call)

Date: 2026-08-27. Status: approved in conversation.

## Problem

Native DeepSeek hybrid reasoning overthinks. `reasoning_effort` is a bias, not a cap: a
hard prompt drives any level to spend the whole `max_tokens` budget thinking and return
zero report. The current defenses (runaway-chars abort, one-shot no-thinking retry,
24k-token reasoning headroom) contain the failure but cannot steer the reasoning itself —
DeepSeek's `reasoning_content` is not promptable.

## Decision

Default to `thinking: disabled` on the wire and script the reasoning in the prompt
instead: the model writes a bounded **planning pass** in the ordinary content stream,
before the first report heading. The server splits the stream at the first canonical
heading; everything before it is re-tagged `thinking` (murmur panel), everything from the
heading on is the report. One call, no new wire events, no client changes.

Chosen over: (a) whole-output JSON envelope — rejected: fragile streaming/escaping of a
3000-word markdown report inside a JSON string, clashes with the test-pinned markdown
contract, and the murmur renders JSON punctuation as noise; (b) two-call plan-then-write
pipeline — deferred: strongest control but doubles prompt cost and latency.

## Mode selection

`DEEPSEEK_REASONING_EFFORT` gains the value `prompted`, which is also the default for
unset and for typos:

- *(unset)* / `prompted` / typo → thinking disabled + plan instructions + splitter (new default)
- `none` → thinking disabled, no plan, no splitter (fast path, unchanged)
- `low` / `high` / `max` / `default` → native thinking, exactly as today (kept as fallback)

The prompt is mode-conditional (a plan instruction alongside native thinking would double
the reasoning), so `assemble.ts` reads the resolved mode from `deepseek.ts`.

## The plan script

*(Amended 2026-08-27, second pass: expanded from a 250–400-word coverage checklist to a
six-stage thinking procedure, budget 500–900 words with a 1200 ceiling, at the user's
request — more thinking time, more guidance on how to reason.)*

A mode-conditional block in the user prompt's render instruction. Six numbered stages,
each a procedure rather than a topic: (1) evidence scan — strongest facts in salience
order, marginal detections marked for forks, and what did NOT fire; (2) per-feature
readings — gloss, mechanism, both trade-off sides, boldest defensible prediction plus its
killer observation; (3) composition hunt — generate 4–6 candidate feature combinations,
keep the 2–3 most specific, discard the generic ones and say why; (4) scenario sketches —
demand feel, sharpest if-then, workaround substitution, its bill; (5) adversarial pass —
mirror test, cost quota, falsifier quota, tie/grade/code leak check, fixed in the plan;
(6) arc and close — the through-line, the section-2 anchor, lever-to-hypothesis tracing,
limits framing. Plain text only, no `#`-prefixed lines, codes/grades allowed (private
scratch), always English, report never references the plan. The system prompt's
output-format rule carries a matching "except the planning pass" exception.

## Stream splitting

New pure module `src/server/prelude.ts` (plain-node testable): `createPreludeSplitter(headings)`
processes content deltas line-wise; a line starting with any exact canonical heading
(`headingsFor(language)`) is the boundary. Before the boundary → `thinking` items; from
the boundary on → pass-through `content`. Partial lines are held until their newline (or
emitted early once they can no longer be a heading prefix). `flush()` drains the tail as
thinking when the stream ends without a heading.

## Budgets and guards

*(Hardened after adversarial review, 2026-08-27: the guard is now derived from the
headroom so they cannot drift; the emptiness floor was raised on the prompted path; the
retry is gated on zero forwarded content; Indonesian gets a wider token factor.)*

- Reasoning headroom is mode-dependent: native 24000, prompted
  `PROMPTED_PLAN_HEADROOM_TOKENS` (3500, owned by deepseek.ts), none 0.
- Prelude runaway: `PRELUDE_RUNAWAY_CHARS` is DERIVED as headroom × the conservative
  3 chars/token (= 10500), so the guard fires before the plan can spend past its budgeted
  share; the attempt is abandoned and retried once with the no-plan prompt.
- No heading ever → all output tagged thinking → `contentChars === 0` →
  `DeepSeekEmptyReportError` → same one-shot retry with the no-plan prompt.
- Usability floor: on the prompted path a stream is empty when content is under
  `MIN_REPORT_CONTENT_CHARS` (200), so a bare heading that leaked past the splitter can
  never ship as a "finished" report with an auto-appended disclaimer. The retry is gated
  on `contentChars === 0` — content the client already rendered is never replayed, so a
  sub-floor leak surfaces as an honest error rather than a duplicated report.
- maxTokens sizing uses per-language tokens/word (en 2.2, id 2.6): Indonesian tokenizes
  denser, which the old unconditional 24k headroom used to mask.
- The no-plan prompt is assembled up front (`Assembly.userPromptNoPlan`) and travels as
  `StreamRequest.fallbackUser`.

## Untouched

SSE wire contract (meta/thinking/chunk/audit/done), the route's buffering/guard/audit
logic, the client, ThinkingPanel, the pinned markdown/heading contract, temperature
handling (0.5 now actually applies, since thinking is off).
