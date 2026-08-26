<!-- UI design decisions and declined review items — the design-system analog of
docs/knowledge/KNOWN-ISSUES.md. Grows over time: the ui-review skill's DECLINE resolution path
writes here. NEVER read by scripts/build-*.mjs. -->

# UI decisions ledger

Format: item — raised by — ruling — reason.

- Tier-chip tooltips are bare `title` attributes on non-focusable spans — designsystemchecklist
  c-tooltip-a11y — **accepted risk** — the full function names and scores are duplicated in the
  readout below the report, so this is redundancy loss, not information loss; a tooltip
  primitive is not worth building for it.
- Accordion panel has no `role="region"`/`aria-labelledby` back-reference —
  designsystemchecklist c-accordion-a11y-relation — **declined** — ARIA APG marks region optional
  on disclosures and warns against landmark overuse; aria-controls/aria-expanded/inert/focus
  rescue are all wired.
- Modal backdrop `backdrop-filter: blur(2px)` — ui-skills playbook ("solid backdrop") —
  **accepted** — 2px is well under the 8px one-shot cap; only opacity is transitioned.
- 250ms interaction tokens vs baseline-ui's 200ms cap — ui-skills — **declined** — the values
  are verbatim transitions.dev tokens kept diffable against upstream; no perceptible gain.
- Spacing literals off the 4pt grid (5/14/15/22px) — designsystemchecklist df-layout-units —
  **declined** — they are shadcn's own control paddings; re-gridding breaks paste-compatibility,
  which tokens.css names as the palette adoption's whole payoff.
- Single ease-out curve, no accelerated exits — designsystemchecklist df-motion-easing —
  **accepted** — five of six aliases are vendored snippet tokens that must stay diffable; any
  future accelerated curve goes on the app's own `--ease-*` line, never inside a snippet block.
- `--murmur-in: 520ms` exceeds the 300ms budget — Kowalski — **accepted, documented exception** —
  deliberately de-emphasized ambient surface, seen once per session; if ever trimmed, cut
  `--murmur-in`, never `--murmur-pace` (the pace carries the effect).
- `.t-toast` entrance keeps upstream's 16px rise + 2px blur on non-dismissible report cards —
  Kowalski (directional motion should reinforce a gesture) — **open** — kept verbatim for
  diffability; the sanctioned tuning knob is the `--toast-distance`/`--toast-blur` tokens, not
  the snippet body. Revisit if the entrance ever reads as noise.
- Status-line width still shifts when the label swaps (no hidden sizer span) — transitions.dev 04
  port — **open** — the persistent elapsed element removed most of the jank; a sizer span is the
  next step if it still bothers.
- `--radius-sm/md/lg` in app.css `@theme inline` have no utility consumers; components.css
  hardcodes `calc(var(--radius) - 2px)` six times — shadcn digest — **accepted** — the bridge
  lines are the documented paste-compatibility surface; consolidating the six call sites onto a
  plain token is worthwhile only if `--radius` is ever retuned.
- `.signature-card` carries no styles — repo audit — **accepted** — it is a semantic/test hook;
  `.card` carries the chrome.
- Zero DOM tests (no jsdom/happy-dom; accordion inert/focus/aria behavior untested) — repo
  audit — **known debt** — the suite deliberately runs in plain node; revisit if a DOM
  regression actually bites.
- Focus-ring halo stays 25% in both themes (upstream doubles only the INVALID ring in dark, which
  we ported as `--alarm-ring`) — shadcn digest — **open** — revisit if the dark focus halo reads
  too faint in practice.
- No `@media print`, `forced-colors`, or `prefers-contrast` rules — repo audit — **known debt** —
  a saved/printed report is plausible; oklch + color-mix under Windows High Contrast is
  unverified.
- Report sections have no exit animation (only entrances) — Kowalski — **accepted** — they are
  never dismissed; the one dismissible element (banner) now has a real exit.
