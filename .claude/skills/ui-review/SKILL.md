---
name: ui-review
description: Use when changing src/client/styles/* or src/client/ui/*, or when asked to audit or review the UI. Runs the Mindstack UI checklist (accessibility, foundations, the seven shipped components) against the diff or the whole surface.
---

<!-- Provenance, retrieved 2026-08-26:
  - ibelick/ui-skills (baseline-ui, fixing-accessibility, fixing-motion-performance, /playbook) — MIT, adapted with attribution; React-only rules dropped.
  - transitions.dev prose rules (_refine-rules.md + SKILL.md common mistakes) — MIT via npm `transitions-pro`.
  - designsystemchecklist.com — NO license: items below are paraphrased, never quoted.
  - Emil Kowalski, "You don't need animations" — all rights reserved: motion budget lives in CLAUDE.md (paraphrased, attributed); this file only points at it.
  - shadcn/ui conventions — MIT.
-->

# Mindstack UI review

## How to resolve an item

Every item you check ends in exactly one of:
- **PASS** — cite evidence as `file + selector/function` (never line numbers; they rot).
- **FIX** — becomes a code change in this session or a named follow-up.
- **DECLINE** — add one line to `docs/design/decisions.md` with the reason.
Check the already-pass ledger (bottom) and `docs/design/decisions.md` first; do not re-raise
settled items. Hard invariants and the motion budget live in CLAUDE.md — read it before this.

## 1. Accessibility (fixed priority order — earlier beats later)

1. **Accessible names**: every control has one (icon-only controls get `aria-label`; the back
   arrow's SVG stays `aria-hidden` beside its text label). No control is name-less or named only
   by color/position.
2. **Keyboard access**: everything clickable is reachable and operable by keyboard; Enter submits
   the score form; no positive `tabindex`; focus is rescued before a container hides or goes
   `inert`.
3. **Focus & dialogs**: visible focus ring everywhere (`--ring` is deliberately darker than
   shadcn's default — never soften); keyboard-initiated focus/state changes get 0ms motion;
   modals trap focus, close on Escape, restore focus (native `<dialog>` provides all three —
   don't reimplement).
4. **Semantics**: state is real attributes (`aria-invalid`, `aria-expanded`, `data-open`,
   `data-tier`), not bespoke classes; headings nest without skips; buttons are `<button>`.
5. **Forms & errors**: invalid fields carry `aria-invalid` AND a wrapper class (shadcn's split:
   attribute for AT, wrapper for block styling); errors are linked via `aria-describedby` and
   shown next to where the action happens; never block paste; never clamp or rewrite input.
6. **Announcements**: streaming status uses ONE `aria-live` region that is never `display: none`
   (flatten when empty); no second `role="status"`/`role="alert"` duplicating it; label swaps
   keep the region's content atomic (one label in the DOM at a time).
7. **Contrast & states**: text ≥ 4.5:1, non-text UI (borders, rings) ≥ 3:1 on the surface it
   actually sits on; record the measured ratio as a trailing comment on the token; anything that
   only reads in light mode is a bug (new tokens go in BOTH tokens.css blocks — light `:root`
   and the `[data-theme='dark']` override; the default theme is light, dark is opt-in).
8. **Media & motion**: every animation/transition has its OWN `prefers-reduced-motion` guard
   (blanket kills are forbidden — see CLAUDE.md); JS-driven motion branches on
   `prefersReducedMotion()`.
9. **Tool boundaries**: model output is escaped before any markup rule runs; nothing renders
   unescaped model text.

## 2. Foundations

- **Color**: tokens only, `var(--*)` everywhere; semantic colors ride the tier ramp (the page
  never holds two greens); one accent per view; no gradients or glow affordances.
- **Typography**: body 45–75ch on reading surfaces (`.report-body` is capped at 68ch);
  `text-wrap: pretty` on body, `balance` on headings; `tabular-nums` wherever numbers stream or
  align; no web fonts, ever.
- **Layout**: spacing reads existing tokens/literals (the shadcn paddings are deliberate — no
  4pt re-grid); `h-dvh` over `h-screen` if a full-height surface ever appears; wide content
  scrolls in its own container, the page never scrolls horizontally.
- **Elevation**: the 3-step `--shadow-xs/sm/lg` scale only — no fourth step, no renames; dark
  mode re-declares alphas; z-index stays absent (top layer covers the modal; adding any z-index
  requires a scale first).
- **Motion** (constants — violations need a justifying comment or a FIX):
  ≤300ms per CLAUDE.md's budget; blur animation ≤8px, one-shot, never continuous, never on large
  surfaces; `filter: blur()` tweens to explicit `blur(0)`, never `none`; `will-change` only
  around an active animation, never at rest; animate compositor props (transform/opacity) —
  never width/height/top/left/margin/padding (the 0fr↔1fr grid trick and measured-height tweens
  are the sanctioned exceptions); stagger 40ms/item, total <300ms; translate ≤8px on anything
  but a full panel; no CSS `d:` path morphs (Chromium-only); never `transition: all`; never
  delay a close or hover-out; match vendored values by USAGE, not nearest number.
- **Iconography**: SVG inline via `el()`/`attrs()`, `aria-hidden` when decorative,
  `stroke="currentColor"`; no icon font, no icon set dependency.

## 3. Components (the seven that exist — do not review hypotheticals)

- **Button**: press scale ≈0.97 on `:active` (never opacity — the label must not dim); hover
  shifts surface color via color-mix, not opacity; busy state must not change the button's box
  (reserve the wider label's width); disabled keeps `cursor: not-allowed` + reduced opacity
  (never `pointer-events: none`); ≥44px effective touch target under `pointer: coarse` (the
  `::after` overlay is the sanctioned escape hatch — it must state `content: ''`).
- **Text field**: `type="text"` + `inputmode="decimal"` (never `type="number"` — see InputForm
  header); focus ring = border to `--ring` + 3px halo, arriving at 0ms, leaving at 150ms;
  invalid = `aria-invalid` + `--alarm-ring` halo (25% light / 40% dark); placeholder is not a
  label.
- **Modal**: native `<dialog>` only; `margin: auto` (preflight strips it — that bug shipped
  once); animate exit BEFORE `close()` but resolve the caller's promise at click time, never
  after the tween; backdrop dims + blurs ≤2px, only opacity transitions.
- **Accordion**: three-level structure is load-bearing (track / clipping inner with NO padding /
  padded body); `inert` + `aria-expanded` + focus rescue stay synchronized through one `set()`
  path.
- **Toast/banner**: everything that animates in must be able to animate out if it is
  dismissible; dismiss control is keyboard-reachable with a name.
- **Loading indicator**: shimmer (vendored 15) with theme-bound colors; elapsed clock beside any
  phase that can run minutes; label swaps tween (vendored 04) with the aria-live region kept
  atomic.
- **Tooltip**: native `title` only, and only for redundant information (see decisions ledger);
  building a tooltip primitive requires removing that redundancy first.

## Already-pass ledger (evidence-cited; do not re-raise)

- `tabular-nums` + `'tnum'` on scores, inputs, clock — base.css `.sig-fn-score` group.
- Visible `:focus-visible` outline, contrast-fixed `--ring`/`--input` — base.css, tokens.css.
- Per-snippet reduced-motion guards on every snippet — motion.css throughout.
- 3-step shadow scale with dark re-declaration — tokens.css `--shadow-*`.
- All eight modal checklist items pass via native `<dialog>` (trap, Escape, restore,
  `aria-labelledby`, sizes, close affordances) — validation-ui.ts.
- No gradients, no glow, zero `z-index` declarations — grep-verified 2026-08-26.
- Ordinal tier ramp with per-token contrast ratios ≥4.5:1 both themes — tokens.css `--tier-*`.
- aria-live status flattened-not-hidden when empty — components.css `.report > .status:empty`.
- Escape-before-markdown injection boundary — ReportView.ts `escapeHtml` + pinning tests.
- Score inputs never clamped; out-of-range confirmed via dialog — validation-ui.ts.
- Murmur DOM capped (WORD_WINDOW) with queue-jump backlog shedding — ThinkingPanel.ts.
- Back-arrow icon `aria-hidden` beside a real text label — InputForm.ts `backArrow`.
