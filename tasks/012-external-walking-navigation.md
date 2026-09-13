# TASK-012 — External walking navigation

## Goal

Give the detail sheet's primary action a real destination: tapping
`PROWADŹ MNIE` opens a walking route to the toilet in an external maps
service. `ARCHITECTURE.md` section 12, `PRODUCT.md` section 12 and FR-07,
`DESIGN.md` section 9.4.

This is the CTA `TASK-010` and `TASK-011` both deliberately left out,
because it had no real destination yet. It does now. Per `PLAN.md`, this
completes Milestone 1: "the first core journey should work end to end."

## Provider decision

`docs/adr/0008-external-navigation-url.md` records it. Summary:
`ARCHITECTURE.md` section 12 requires "at least a Google Maps web
fallback" and allows Apple Maps "when tested." This task builds only the
Google Maps web URL — a plain, standard `https://www.google.com/maps/dir/`
link that works from any browser on any platform without app-specific
deep-link logic. Apple Maps support is not added: this sandboxed session
cannot test real app-opening behaviour on a device, and `ARCHITECTURE.md`
conditions it on being tested.

## Privacy constraint this task must not violate

`ARCHITECTURE.md` section 12: "Do not embed private user coordinates into
shareable URLs unnecessarily; destination-only external links are
sufficient when the map app can use current location." The URL-building
function takes only the toilet's own coordinates as input — there is no
parameter through which the user's granted location could even be passed
in, let alone appear in the generated URL. Google Maps supplies the
starting point itself from the device's own location once the link opens,
exactly as `ARCHITECTURE.md` anticipates.

## User-visible outcome

The toilet detail sheet (`TASK-011`) now shows a `PROWADŹ MNIE` button
between the status/price badges and the accessibility features, with the
supporting punchline `ZANIM BĘDZIE ZA PÓŹNO.` beneath it
(`DESIGN.md` 9.4's own example). Tapping it opens a new tab to a Google
Maps walking-directions URL for that toilet's coordinates.

## Acceptance criteria

- `lib/external-navigation/build-navigation-url.ts` exports a pure function
  taking only `{ lat, lng }` and returning the Google Maps URL
  (`api=1&destination=<lat>,<lng>&travelmode=walking`); no origin/current-
  location parameter is ever set.
- The detail sheet renders this as a real `<a>` element (`target="_blank"`,
  `rel="noopener noreferrer"`, the safe-external-link pattern), not a
  `<button>` with imperative `window.open`, so the destination is
  inspectable, keyboard-operable, and works the same as any other link
  (open-in-new-tab, copy-link, etc.) without extra script.
- The CTA sits in `DESIGN.md` 9.4's information order: after status/price,
  before accessibility features.

## Out of scope

Do **not**:

- add Apple Maps or any other provider;
- add server-side URL generation; the toilet's coordinates are already in
  the client via the nearby API response, so there is nothing a server
  round-trip would add;
- change the report control or hours, still absent per `TASK-011`'s own
  reasoning;
- change ranking, the preview, or the API response shape.

## Canonical context to read

- `AGENTS.md`
- `PROGRESS.md`
- `ARCHITECTURE.md` section 12
- `PRODUCT.md` section 12, FR-07
- `DESIGN.md` section 9.4
- `BRAND.md` "Navigation" copy

## Likely relevant code

- `components/map/ToiletDetailSheet.tsx`, extended by this task
- `lib/toilets/nearby-response.ts`, the `lat`/`lng` fields this reads

## Constraints

- No new dependency; a plain URL, no maps SDK.
- No egress to `google.com` exists in this session (confirmed: a direct
  `curl` to the generated URL returns a proxy `403`, the same pattern
  already documented for MapTiler/Overpass/Warsaw hosts). The URL's
  correctness is verified by unit test and by asserting the real rendered
  `href` attribute in Playwright; actually following the link to a working
  Google Maps route is not verifiable from this environment and is not
  claimed.

## Verification

Run and record:

- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`
- `pnpm test:unit`, including the new URL-builder tests
- `pnpm build`
- `pnpm test:e2e`, extended to assert the real `href`/`target`/`rel` on the
  rendered CTA
- inspect the complete git diff

## Definition of done

TASK-012 is complete only when:

- the CTA opens a correct, destination-only Google Maps walking URL;
- no Apple Maps or other provider code exists that this task did not have
  to create;
- `docs/CODEMAP.md` and `PROGRESS.md` reflect the repository, including the
  explicit note that the link's real destination was not reachable from
  this session;
- the complete diff contains no unrelated changes.

Then stop. Milestone 1 — the first core journey working end to end — is
complete after this task, but do not begin Milestone 2 work.
