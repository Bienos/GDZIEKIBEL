# TASK-026 — Accessibility pass

## Goal

`PLAN.md`'s outcome: "map/list/sheets/core flow pass defined keyboard,
screen-reader, contrast and touch-target checks." `PRODUCT.md` section 15
names the concrete checks: core flows keyboard accessible, touch targets
at least 44×44 CSS px where practical, sufficient contrast, no reliance on
colour alone for status, map interactions with list equivalents,
screen-reader labels for icons and markers, respect for
`prefers-reduced-motion`. `DESIGN.md` section 14 restates the same list
plus two specifics worth auditing directly: visible focus state, and
bottom sheets maintaining logical focus order.

## Design decision: read the existing evidence first, then audit what it can't check

`TASK-025`'s own Lighthouse run already scored `accessibility: 92` on the
fallback path, with the full JSON report still on disk. Re-running
Lighthouse blind before reading that report's own findings would repeat
work for no reason — this task starts by reading it. Lighthouse's
automated checks only cover part of `PRODUCT.md` section 15 (contrast,
some ARIA structure); real keyboard-only navigation, screen-reader label
correctness, and reduced-motion behaviour need a direct, manual check
against this project's actual sheets and controls, since Lighthouse only
audits whatever is on the DOM at the moment it loads — the location-ask
sheet on the fallback path, not the toilet detail sheet, filters sheet, or
report sheet, none of which are open on initial load.

## What the evidence found

Two real, automated findings from the TASK-025 Lighthouse report:

1. **`aria-dialog-name`** (score 0): the location-ask `role="dialog"` has
   no accessible name — no `aria-label`/`aria-labelledby`/`title`, even
   though it already has a heading (`h2`, already receiving programmatic
   focus via `askHeadingRef`). Checking the other sheet components
   (`ToiletDetailSheet.tsx`, `FiltersSheet.tsx`, `ReportSheet.tsx`, and
   the `denied`/`outside` location screens in `MapShell.tsx`) found the
   identical gap in every one of them — a systemic pattern bug, not one
   isolated case Lighthouse happened to catch. `ReportSheet.tsx` already
   gives its heading an `id` (reused by its own fieldset's
   `aria-labelledby`) but never wires it to the dialog `div` itself.
2. **`color-contrast`** (score 0): `--text-muted` (`--color-muted-500:
   #767676`) against `--bg-primary` (`--color-paper-50: #f5f2ea`) measures
   4.06:1, short of WCAG AA's 4.5:1 for normal text. `tokens.css`'s own
   doc comment already anticipates this exact situation: "Raw palette
   values are v1 implementation targets, not immutable brand law; adjust
   only after contrast checks." `--text-muted` is the single semantic
   token every affected instance reads (`page.module.css`'s tagline,
   `MapShell.module.css`'s privacy hint and three other muted-text uses),
   so one token change fixes every instance color-contrast could flag.

## User-visible outcome

A screen reader announces each sheet by its real heading instead of
"dialog" alone. Muted/secondary text (the tagline, privacy hints, meta
text) is a shade darker — a small, deliberate change, not a redesign.

## Acceptance criteria

- Every `role="dialog"` element in the app has a real accessible name via
  `aria-labelledby` pointing to its own heading's `id`.
- `--color-muted-500` measures at least 4.5:1 against
  `--color-paper-50`, verified by computing the real WCAG contrast ratio,
  not eyeballing it.
- A real Lighthouse re-run against the fixed build shows both
  `aria-dialog-name` and `color-contrast` scoring 1.0 (previously 0).
- Manual checks recorded for what automated tooling cannot verify:
  keyboard-only navigation through each sheet, marker screen-reader
  labels, `prefers-reduced-motion` behaviour, existing focus-management
  refs.
- No existing test regresses.

## In scope

- `aria-labelledby` added to every dialog sheet (`MapShell.tsx`'s three
  location screens, `ToiletDetailSheet.tsx`, `FiltersSheet.tsx`,
  `ReportSheet.tsx`).
- The `--color-muted-500` token darkened to a real, computed passing
  value.
- A real Lighthouse re-run confirming both fixes, recorded with numbers.
- A manual review of keyboard/screen-reader/reduced-motion behaviour
  against `PRODUCT.md` section 15's remaining checks, recording what
  already passes and what (if anything) needs a follow-up task.

## Out of scope

Do **not**:

- redesign the colour palette beyond the one token contrast requires;
- add a live-tile accessibility check (still blocked — no
  `NEXT_PUBLIC_MAPTILER_KEY`/egress in this session);
- change any component's behaviour, only its accessible-name/contrast
  properties;
- invent a WCAG conformance claim beyond what was actually checked.

## Canonical context to read

- `AGENTS.md`
- `PROGRESS.md` (TASK-025's own Lighthouse findings)
- `PRODUCT.md` section 15
- `DESIGN.md` section 14

## Likely relevant code

- `components/map/MapShell.tsx`, `ToiletDetailSheet.tsx`,
  `FiltersSheet.tsx`, `ReportSheet.tsx`
- `app/tokens.css`

## Constraints

- No new dependency; no new required environment variable.
- No change to any component's behaviour or response shape.

## Verification

Run and record:

- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`
- `pnpm test:unit`, `pnpm test:integration`
- `pnpm build`
- `pnpm test:e2e`
- A real Lighthouse mobile run against the fixed build, before/after
  numbers quoted for the two specific findings.

## Definition of done

TASK-026 is complete only when:

- both real, evidence-backed findings are fixed and re-verified with real
  numbers, not just described;
- the systemic dialog-naming gap is fixed everywhere it appears, not just
  the one instance Lighthouse's single-page snapshot caught;
- the manual checks this session can perform are recorded honestly,
  including anything that could not be checked (real screen reader, real
  device, live tiles);
- every existing test still passes unmodified;
- the complete diff contains no unrelated changes.

Then stop. Do not begin TASK-027.
