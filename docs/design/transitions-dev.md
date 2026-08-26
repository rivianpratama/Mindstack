<!-- Provenance: transitions.dev (Jakub Antalik). License anchor: the 32 free snippets are
published in the npm package `transitions-pro` (MIT); the GitHub repo has no top-level LICENSE,
so cite the npm package, not the repo. Retrieved 2026-08-26. This file is a UI provenance
digest — NEVER read by scripts/build-*.mjs. -->

# transitions.dev — vendored inventory and deviation record

src/client/styles/motion.css vendors seven of the 32 free snippets. Each keeps upstream's
structure and its own `prefers-reduced-motion` guard so the file stays diffable against upstream.
This file records what "diffable" means in practice: which snippets, where they live, and every
deviation.

## Site-order → snippet-number drift map

The live site's visual ordering has drifted from the snippet numbering motion.css uses. When
comparing against the site (not the npm source), translate: site item 7 → snippet **06 modal**,
15 → **12 shake**, 21 → **15 shimmer**, 26 → **21 accordion**, 27 → **22 toast**, 38 → **29
reasoning stream**. Snippet numbers come from the npm package's directory names.

## Vendored inventory

| snippet | lives in | note |
|---|---|---|
| 04 text-states-swap | motion.css | status-line label swap (the swap half of 28 thinking-states) |
| 06 modal | motion.css | + our `--modal-close-dur` (see deviations) |
| 12 error shake | motion.css | shake targets `.form-errors`, deliberately not the input — the `.t-input.is-error` state was removed as dead (never applied; `.field.invalid`/`aria-invalid` is the real error treatment) |
| 15 shimmer text | motion.css | colours rebound to theme tokens (see deviations) |
| 21 accordion | motion.css | |
| 22 toast | motion.css | reused as the generic entrance for cards/banners/strip |
| 29 reasoning stream | SPLIT: tokens in motion.css, rules in components.css (`.murmur*`) | the murmur diverged far enough from upstream (content-driven height, bottom-anchored fixed-unit mask, word pacing/queue-jump) that the rules live with the component; the tokens stay in motion.css because `motionMs()` reads `--murmur-pace` |

## Per-snippet deviations from upstream

- **15 shimmer**: `--shimmer-base/--shimmer-highlight` bound to `var(--muted-foreground)`/
  `var(--foreground)` instead of upstream's hard-coded `#7c7c7c`/`#0d0d0d`, which would be
  invisible on a dark card.
- **06 modal**: added `--modal-close-dur: 200ms` and direction-split transitions — `dialog.close()`
  rips the element from the top layer instantly, so the caller animates first, then closes.
  Backdrop fade + 2px blur added (blur is under the 8px one-shot cap; only opacity transitions).
- **22 toast**: `--toast-open` 350ms → **250ms** (token-value deviation): `.t-toast` is the
  entrance for every report section, banner, the tier strip, and the signature card — the app's
  most-repeated consciously-watched animation — and 250ms puts it on the same clock as
  `--toast-close`/`--acc-*`/`--duration-fast` and under the 300ms budget in CLAUDE.md.
- **04 text-swap**: upstream (as part of 28) appends a SECOND text node and removes the old one
  after the swap, so old and new coexist. Mindstack reuses ONE carrier (exit → replace text →
  enter) because the status line is an `aria-live` region and two coexisting labels can be
  announced as a run-on string. Upstream's self-driving `cycle()` timer is dropped — our status
  is event-driven.
- **will-change (06 + 22)**: upstream's SKILL.md says "do not strip will-change"; ui-skills'
  baseline-ui says never hold `will-change` outside an active animation. Upstream assumes
  transient toasts; here `.t-toast` sits on ~10 session-long cards, i.e. permanently promoted
  GPU layers with a filter hint. Ruling: ui-skills wins — `.is-open` (the settled state) resets
  `will-change: auto`; the hint still pre-arms entrances and re-arms on exit. Recorded here as a
  deliberate deviation from upstream's verbatim rule.

## Upstream prose rules worth keeping (from `transitions-polish/_refine-rules.md` + SKILL.md, MIT)

- Match values by USAGE, not nearest number (a "modal close" maps to the modal-close token even
  if another token is numerically closer). If a value's usage matches no token's usage, leave it.
- Closes are faster and quieter than opens; overshoot easing belongs to entrances only.
- Symmetric by design (do NOT split open/close): accordion, tabs, icon swap, text swap.
- Stagger 40ms/item; keep total under ~300ms. Never delay a close or a hover-out.
- A translate over ~40px on anything but a full panel reads sluggish — pull toward 8px.
- Never substitute `transition: all`; snippets enumerate exact properties on purpose.
- Upstream's own tables disagree once: refine-rules says "toast close 350ms" while snippet 22
  ships 350/250. Mindstack follows the snippet (and the "closes are faster" rule).

## Considered and rejected (so they are not re-proposed)

- **30 streaming-text**: needs per-word spans; `.report-body` is test-pinned and class-free. The
  murmur already implements the idea better (animation-on-insertion survives backgrounded tabs).
- **32 banner-stacking**: one banner call site, no queue exists.
- **01 card-resize**: cannot animate `auto→0`; `retireThinking()`'s measured tween is correct.
- **24 learn-more-hover**: back button already has the 80% version; the arm-spread needs a
  two-path chevron we don't have.
- **16 tabs / 02 number-pop / 26 counter / 11 avatar-hover** for the tier strip: it is a static
  read-only display, not a control.
- **The full `_root.css` token block** (~200 tokens): most would be dead; motion.css's header is
  an explicit rejection. Shared tokens that ARE used already match upstream byte-for-byte
  (`--duration-quick` 150ms, `--duration-fast` 250ms, `--ease-smooth-out`
  cubic-bezier(0.22, 1, 0.36, 1)).
