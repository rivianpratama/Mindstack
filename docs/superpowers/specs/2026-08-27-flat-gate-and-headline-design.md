# Relaxed flat gate + model-authored report headline

Date: 2026-08-27. Approved by the user in conversation (options: 5-point gate with a
reader-facing inaccuracy warning; model-written headline).

## Problem

1. Profiles whose spread (max − min of the eight scores) is ≤ 2B (10 points at the default
   B = 5) are classed FLAT and get the deterministic honest-null text — the reader
   experiences this as "it refuses to generate". The user wants the gate relaxed.
2. The report has no title. The user wants a profile headline at the top of the report,
   worded like a front-page news (WSJ-style) headline, summarizing the whole report.

## Design

### 1. Flat gate: 2B → B, with a low-confidence zone at (B, 2B]

- `flatSpread` (the FLAT regime cutoff) becomes **B** (5 points): honest-null only when
  the whole profile fits inside one noise band. Owner: 02 §2 step 0; `types.ts`.
- The differentiation index keeps its meaning: **low ≤ 2B** (new threshold name
  `lowSpread`), moderate ≤ 4B, high above. Low-but-not-FLAT is the **NEAR-FLAT
  low-confidence zone**.
- In that zone (regime STAIRCASE or NORMAL, spread ≤ 2B):
  - `tiers.ts` pushes a NEAR-FLAT warning into `signature.warnings`, which already flows
    into the model prompt ("Measurement warnings carried from the computation"); the text
    instructs the report to state the low confidence plainly near the start.
  - The NORMAL-regime 2000-word hard minimum is waived (`minWords = 0`): forcing length on
    weak signal would manufacture content (Forer).
  - The client shows a reader-facing warn banner (`showCloseScoresNotice`): scores sit
    close together; readings rest on small differences that a retake may flip.
- Spec updates: 02 §2 step 0 (three-way regime check + near-flat rule), S5/S6 detects,
  differentiation-index line, §6 all-high note; 00-overview FLAT/STAIRCASE glossary lines.
  `npm run build:data` regenerates the prompt JSON afterwards.

### 2. Model-authored headline

- The model opens the report with exactly one line `# <headline>` (single `#`), before the
  first canonical `##` heading, in the report's language. Style: front-page news headline —
  short, declarative, specific to this profile; plain words; no numbers, codes, type
  labels, colons, or em-dashes. Instruction lives in `buildUserPrompt` (both the planned
  and no-plan variants); the planning-pass close line now names the headline as the
  report's first line.
- Prompted-reasoning splitter: `reportHeadings` stays canonical-only. The `# ` line is a
  CONDITIONAL boundary handled inside `prelude.ts`: a complete `# ` line (plus blank
  lines under it) is held and becomes content only when the first canonical heading
  follows; anything else demotes it to thinking. A headline the model wrote too early
  (before its plan) is remembered and replayed as content at the true boundary, so the
  title survives. (Revised 2026-08-27: the first cut listed `'# '` as an unconditional
  boundary prefix, so an early or stray `# ` line reclassified the whole plan as report
  content — plan on the page, empty murmur. The headline prompt is also position-bound
  now: "immediately before the first canonical heading, after the planning pass ends".)
- Client (`ReportView`):
  - `couldContinueHeading` also withholds a streaming tail that starts `# ` (or is `#`),
    so a half-arrived headline is never painted as prose.
  - New pure helper `extractHeadline(preamble)` pulls the first non-blank single-`#` line
    out of the preamble section (index 0, title null); `paint()` renders it into an
    app-owned `h2.report-headline` inserted above the section cards (entrance: existing
    `t-toast` recipe). Generated text goes in via `textContent`; `.report-body` markup is
    untouched, so the byte-pinned markup contract holds.
  - `.report-headline` is a component class in components.css (no new tokens, no new
    motion snippet).
- Honest-null (FLAT) reports have no headline. If the model omits the headline, nothing
  breaks: no headline element is created.

## Testing

- geometry.regimes: FLAT fixture (spread 4) unchanged; new near-flat NORMAL and STAIRCASE
  cases assert regime, warning, `differentiation.class === 'low'`; thresholds test pins
  `flatSpread: 5`, `lowSpread: 10`.
- prompt.assemble: reportHeadings now `['# ', ...headings]` on LLM paths; headline
  instruction present in both prompt variants; near-flat NORMAL gets `minWords = 0`.
- prelude.split: a `# headline` line starts content; partial `#` is held.
- client.markdown: `extractHeadline` cases; `couldContinueHeading('# Profil…') === true`;
  existing pinned markup untouched.
