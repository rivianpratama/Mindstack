<!-- Provenance: ui.shadcn.com (shadcn-ui/ui, MIT), retrieved 2026-08-26. This file is a UI
provenance digest — it is NEVER read by scripts/build-*.mjs and must never be wired into the
prompt pipeline (docs/knowledge / docs/sources). -->

# shadcn/ui — token diff-base and deviation record

Mindstack's palette (src/client/styles/tokens.css) is shadcn/ui's neutral theme in oklch. This
file pins the upstream block as retrieved, so the next upstream paste is a `diff`, not
archaeology, and records every deliberate deviation.

## Upstream neutral block, as of 2026-08-26 (tokens Mindstack consumes)

```css
:root {
  --radius: 0.625rem;
  --background: oklch(1 0 0);          --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);                --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);             --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);         --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);        --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);            --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);           --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);          --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
}
.dark {
  --background: oklch(0.145 0 0);      --foreground: oklch(0.985 0 0);
  --card: oklch(0.205 0 0);            --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.205 0 0);         --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.922 0 0);         --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.269 0 0);       --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);           --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.269 0 0);          --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);        --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.556 0 0);
}
```

Upstream activates dark via a `.dark` class; Mindstack activates via
`@media (prefers-color-scheme: dark)` plus a `[data-theme]` override block (tokens.css explains
the duplication).

## Deviation table (token | upstream | ours | why)

| token | upstream | ours | why |
|---|---|---|---|
| `--input` (light) | 0.922 | 0.66 | 1.26:1 fails WCAG 1.4.11 (3:1 for non-text UI); field boundary must be visible — documented in tokens.css |
| `--ring` (light) | 0.708 | 0.556 | 2.59:1 fails 1.4.11; focus ring must be visible — documented in tokens.css |
| `--popover` (dark) | 0.205 | 0.269 | dialog sits ON a 0.205 card scrim; one step lighter separates the layers |
| `--accent` (dark) | 0.269 | 0.371 | hover state must be distinguishable from `--secondary`/`--muted` (both 0.269) |
| `--border` (dark) | 1 0 0 / 10% | 1 0 0 / 12% | hairlines on 0.205 cards need the extra 2% to read at all |
| `--input` (dark) | 1 0 0 / 15% | 1 0 0 / 35% | same 1.4.11 reasoning as light; 15% is invisible on 0.205 |
| `--ring` (dark) | 0.556 | 0.708 | contrast-correct direction: ours is exactly upstream's light/dark pair swapped, so the ring is always the lighter of ring/background |

## Deliberately not taken

- `--chart-1..5`: upstream re-picks hues per theme (light `--chart-1` ≈ orange
  `oklch(0.646 0.222 41.116)`, dark ≈ purple `oklch(0.488 0.243 264.376)`), which breaks
  Mindstack's ordinal lead>support>reserve>shadow tier ramp; also sized as fill, not 0.7rem text.
  Already litigated in tokens.css — see the `--tier-*` comment.
- `--sidebar-*` (8 tokens): no sidebar exists; dead CSS with a maintenance claim attached.
- Upstream's newer multiplicative radius scale (`--radius-sm: calc(var(--radius) * 0.6)` etc.):
  numerically identical to our subtractive `- 4px`/`- 2px` at `--radius: 0.625rem`; the
  divergence only surfaces if `--radius` is ever retuned. Note: `--radius-sm/md/lg` in app.css's
  `@theme inline` currently have zero utility consumers — components.css hardcodes
  `calc(var(--radius) - 2px)` instead.
- `disabled:pointer-events-none` + `cursor-not-allowed` from the input recipe: self-contradictory
  (pointer-events:none suppresses the cursor); our `.input:disabled` is the correct version.
- Skeleton (`animate-pulse`, no reduced-motion guard — vendored shimmer 15 is strictly better),
  Spinner (`role="status"` would double-announce beside the aria-live status host), Alert's
  icon-gutter grid anatomy (no icon set exists).

## Taken beyond the token block

- The `aria-invalid` field-state recipe (`aria-invalid:border-destructive
  aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40`): the same attribute
  drives pixels and the AT signal, and the ring alpha doubles in dark — ported to
  `.input[aria-invalid='true']` + `--alarm-ring` (25% light / 40% dark).
- The Field split: state on BOTH the wrapper (block styling) and the control (ARIA) — mirrored
  by `.field.invalid` + `aria-invalid`.

## Lookalike token blocks — do not paste

beui.dev and coss.com/ui ship name-compatible `--background/--border/--ring` blocks. Both are
contrast regressions against this repo's documented WCAG 1.4.11 fix (borders at 6–10% alpha ≈
1.05–1.1:1), and beui's dark block activates via a `.dark` class Mindstack never sets — a raw
paste would silently never activate. Their paste-compatibility is the only value they offer, and
it is already banked here.
