# ADR 0021 — Accessible dialog names, and a contrast-safe muted token

Status: Accepted
Date: 2026-09-14
Scope: TASK-026 — Accessibility pass

## Context

`PLAN.md`'s outcome: "map/list/sheets/core flow pass defined keyboard,
screen-reader, contrast and touch-target checks." `PRODUCT.md` section 15
and `DESIGN.md` section 14 both name the concrete checks. `TASK-025`'s own
Lighthouse run (against the fallback path, the only one this session's
environment can exercise) already scored `accessibility: 92`, with two
real, automated findings on record: `aria-dialog-name` (score 0) and
`color-contrast` (score 0).

## Decisions

### Every `role="dialog"` gets `aria-labelledby`, not just the one Lighthouse saw

Lighthouse only audits whatever is on the DOM when it loads — the
location-ask sheet on initial load, not the toilet detail sheet, filters
sheet, or report sheet, none of which are open at that moment. Checking
those directly found the identical gap in every one of them: a
`role="dialog"` container with a real heading, but no `aria-labelledby`
connecting the two, so a screen reader announces only "dialog," never
which one. `ReportSheet.tsx` had already given its heading an `id`
(reused by its own fieldset), making the missing wire on the dialog
itself the more visible case of the same systemic gap.

Fixed the same way everywhere: give each sheet's heading a stable `id`
and point the dialog's `aria-labelledby` at it. `MapShell.tsx`'s three
location screens (`asking`, `denied`, `outside`), `ToiletDetailSheet.tsx`,
`FiltersSheet.tsx`, and `ReportSheet.tsx` — six dialogs in four files, all
fixed the same way, all already using the `tabIndex={-1}` +
programmatic-focus pattern established since `TASK-006`, so no new focus
management was needed, only the missing name.

### `--color-muted-500` darkened from a real, computed ratio

`tokens.css`'s own doc comment already anticipated this: "Raw palette
values are v1 implementation targets... adjust only after contrast
checks." `#767676` against `--color-paper-50` (`#f5f2ea`) measures
4.06:1; WCAG AA requires 4.5:1 for normal text. Computed the exact WCAG
relative-luminance formula rather than guessing: `#6b6b6b` measures
4.76:1, a small margin above the minimum to absorb real-world rendering
variance, while remaining visually close to the original (11 points
darker per channel, still reads as the same muted grey). One token
change fixes every one of its five existing usages
(`page.module.css`'s tagline, `MapShell.module.css`'s privacy hint and
three other muted-text instances) — the design-token architecture's own
point, per `tokens.css`'s "components read semantic aliases, never raw
hex values."

### A manual review recorded honestly, not just the two automated findings

Lighthouse's accessibility category cannot check most of `PRODUCT.md`
section 15 and `DESIGN.md` section 14: real keyboard-only navigation,
whether a status ever relies on colour alone, marker screen-reader
labels, reduced-motion behaviour. Read the actual code for each instead
of asserting a blanket pass:

- **Touch targets** (≥44×44 CSS px): already true throughout
  `MapShell.module.css` (44/48/52/88 px `min-height`/`min-width` on every
  interactive element checked) and `page.module.css`'s language switch.
- **Colour alone for status**: `openingStatusLabel` always returns real
  text; `openingStatusVariant` separately drives colour — never colour
  without text, confirmed by reading `lib/toilets/preview-copy.ts`
  directly, not assumed.
- **Screen-reader labels for markers**: `createToiletMarkerElement`
  already builds a real `<button>` (not a styled `<div>`) with
  `aria-label` from `buildMarkerLabel` and `aria-pressed` for selection
  state — genuinely keyboard-focusable and activatable by default, no
  fix needed.
- **Reduced motion**: `app/` and `components/` CSS contain zero
  `transition`/`animation` rules (confirmed by a direct search, excluding
  `maplibre-gl`'s own bundled CSS, outside this project's control) — there
  is nothing to gate behind `prefers-reduced-motion` because nothing
  animates. Adding a no-op media query would be speculative code for a
  problem that does not exist.
- **Visible focus state**: broadly present (`:focus-visible` outlines on
  every real interactive element checked). The one `outline: none` found
  (`.sheetHeadline:focus-visible`) is a deliberate, correct exception: that
  heading is `tabIndex={-1}` (programmatically focused for screen readers
  on sheet-open, never `Tab`-reachable), so a visible outline there would
  be a distracting ring around a non-interactive element, not a lost
  indicator on one a keyboard user would actually navigate to.
- **Map/list equivalents**: already built (`TASK-015`).

## Not verified — named honestly, not silently assumed

Real screen-reader output, real keyboard-only navigation end to end
through each sheet, and whether markers are reachable in DOM/tab order
inside a real MapLibre canvas cannot be checked from this session: no
`NEXT_PUBLIC_MAPTILER_KEY`/egress exists here (the same recorded
constraint as every prior task), so no real map has ever rendered from
this session, and no screen reader is available to drive directly. The
code-level review above is real evidence, not a substitute for that.

## Measured result

Same real Lighthouse mobile run, before/after, fallback path:

| Metric                | Before | After |
| ---------------------- | ------ | ----- |
| Accessibility score      | 92     | 100   |
| `aria-dialog-name`        | 0      | 1     |
| `color-contrast`          | 0      | 1     |

## Consequences

- Any future sheet/dialog added to this project should follow the same
  rule: give its heading an `id`, point the dialog's `aria-labelledby` at
  it, from the start — not left for a later audit to catch.
- `--color-muted-500` is now the contrast-checked value; any future raw
  palette change must re-run the same computation before shipping, per
  `tokens.css`'s own standing instruction.

## Not decided here

A real device/screen-reader pass, and any accessibility check that
depends on real map tiles, are both left for whichever future session has
the credentials/hardware this one does not.
