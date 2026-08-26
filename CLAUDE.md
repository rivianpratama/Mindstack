# Mindstack

Eight Sakinorva cognitive-function scores in, one streamed self-reflection report out — a set of
hypotheses with the math shown, explicitly not a 16-type label. The UI copy promises "Nothing is
stored. Everything is computed in your browser," and two invariants below derive from it.

## Commands

- Dev runs two servers: `npm run dev` (Vite, :5173, proxies /api) and `npm run dev:server`
  (Hono API, :8787). Both are configured in `.claude/launch.json`.
- `npm run build:data` regenerates `src/server/prompt/*.json` from `docs/knowledge/` — required
  after editing knowledge files.
- `npm test` (vitest, plain node — no DOM) and `npm run typecheck` must pass before any commit.

## Hard invariants (rule — owner)

- `.report-body` markup is test-pinned byte-for-byte; generated markup carries NO classes or
  data-attributes (sole exception: `blockquote.disclaimer`) — prose.css header,
  test/client.markdown.test.ts.
- Tailwind utilities only inside static string literals passed to `el()`; anything assembled at
  runtime must be a component class in components.css — app.css, components.css headers.
- Zero new runtime dependencies; `dependencies` stays server-only — package.json.
- No web fonts, self-hosted or otherwise; system stack only — app.css `--font-sans` comment.
- tokens.css is the single source of truth; every new token goes into BOTH blocks (light `:root`
  and the `[data-theme='dark']` override) or it silently stays light in dark mode — tokens.css.
- The default theme is light regardless of OS preference; dark is opt-in via
  `[data-theme='dark']` only (never a prefers-color-scheme block, never Tailwind's `dark:`
  variant) — tokens.css, app.css.
- `@theme inline` must stay `inline`; layer assignment happens only in app.css
  `@import ... layer()` — app.css.
- Every motion snippet keeps its OWN `prefers-reduced-motion` guard; a blanket
  `* { transition: none }` is forbidden (dialog gating and the accordion settle promise sequence
  on transitionend) — motion.css header.
- Duration token names are a JS API: `motionMs()` reads `--acc-*`, `--modal-close-dur`,
  `--toast-close`, `--murmur-pace`, `--text-swap-dur`; renaming breaks timing — dom.ts.
- aria-live regions are never `display: none`; flatten instead of hiding — components.css
  `.status` comment.
- Scores are never clamped, rounded, rescaled, or reordered (02 §1); inputs stay `type="text"`
  with `inputmode="decimal"` — validation-ui.ts, InputForm.ts headers.
- dom.ts and accordion.ts never touch `document`/`window`/`matchMedia`/`getComputedStyle` at
  module scope; the test suite runs in plain node — dom.ts header.
- Vendored CSS lives in its own leaf file, diffable against the upstream pinned in
  `docs/design/` — motion.css precedent.
- State is expressed as attributes; prefer a real ARIA attribute over a bespoke class when one
  exists (`aria-invalid`, `data-open`, `data-tier`) — components.css conventions.
- All model output is HTML-escaped before any markdown rule runs; new surfaces rendering model
  text inherit that boundary — ReportView.ts `escapeHtml`.

## Motion budget (paraphrased from Emil Kowalski, "You don't need animations")

- UI animation stays under 300ms unless a comment beside it justifies the excess
  (`--murmur-in: 520ms` is the documented ambient exception).
- Keyboard-initiated state changes get 0ms.
- Every new transition/animation states its purpose in a one-line comment, or it does not ship.
- Never inherit a recipe's directional/blur component without a real gesture or spatial
  relationship it reinforces.
- Closes are faster and quieter than opens; match vendored values by USAGE, not nearest number —
  detail in `.claude/skills/ui-review`.

## Browser support floor

Pinned by features in use: `oklch()`, `color-mix(in oklab)`, native `<dialog>`/`::backdrop`/top
layer, `inert`, `mask-image`, `grid-template-rows 0fr↔1fr` transitions, `text-wrap: pretty`,
`:focus-visible`. Roughly Baseline 2023+; degrade gracefully, never below.

## Pointers

- Run the `ui-review` skill (.claude/skills/ui-review) before merging changes to
  src/client/styles/ or src/client/ui/.
- Provenance and upstream diff-bases for vendored UI material live in `docs/design/`.
- `docs/knowledge/` and `docs/sources/` are the report generator's prompt pipeline — never file
  UI material there.
