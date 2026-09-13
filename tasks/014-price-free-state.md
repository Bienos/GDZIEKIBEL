# TASK-014 — Price/free state

## Goal

`PLAN.md`'s outcome: "free/paid/unknown is normalised and rendered
consistently." Most of this already exists — this task's real job is
finishing what genuinely remains, not redoing what's done.

## What is already done, and what actually remains

`price_state` (`free`/`paid`/`unknown`) has been normalised since
`TASK-003`/`TASK-004` and rendered consistently since `TASK-010`/`TASK-011`
(`lib/toilets/preview-copy.ts`'s `priceLabel`). Two concrete gaps remain,
both already anticipated by name in the existing schema and its own
comments:

1. **`price_amount_minor`/`currency`** (`db/migrations/*_toilet-schema.sql`,
   also listed in `ARCHITECTURE.md` section 5.1) exist as columns but
   nothing has ever written to them. `PRODUCT.md` section 19 names a literal
   amount, `2 PLN`, as one of the "core facts [that] stay literal" — this is
   real, asked-for product behaviour, not a schema artefact to ignore.
2. **`payment_methods`** (`docs/adr/0004-schema-conventions.md`: "normalised
   by TASK-014") currently receives the *raw* `payment:*` tag dump, not a
   normalised structure — the schema comment's promise was never kept.
   `docs/research/2026-09-13-warsaw-toilet-sources.md` section 3.10 cites a
   real traveller complaint about needing coins for a paid toilet: "the
   payment mechanism matters, not only the amount." This task normalises it
   into three explicit facts — cash, card, coins accepted — the same
   `FeatureState` shape already used for wheelchair/changing-table/unisex.

`docs/adr/0010-price-and-payment-normalisation.md` records the exact
bounded grammar for parsing `charge` and the three-flag payment model.

## User-visible outcome

- When a toilet's `charge` tag parses cleanly (e.g. `2 PLN`, `4.50 PLN`),
  the price badge shows the amount (`2 PLN`) instead of the generic
  `PŁATNY`/`PAID`. When it does not parse, the existing generic badge is
  unchanged — never a guessed amount.
- The toilet detail sheet gains three more accessibility-style rows: cash,
  card, and coin payment accepted, each `yes`/`no`/`limited`/`unknown`,
  right after the existing wheelchair/changing-table/unisex rows.

## Acceptance criteria

- `lib/toilets/parse-charge.ts` parses a bounded `<amount> <currency>`
  grammar (`docs/adr/0010`) into `{ amountMinor, currency }`; anything
  outside it (a range, missing currency, extra text) is `null`, never a
  guess.
- `lib/ingest/osm/normalize.ts` derives `priceAmountMinor`/`currency` from
  `chargeRaw` and a normalised `paymentMethods` (`cash`/`cards`/`coins`,
  each a `FeatureState`) from the `payment:*` tags, the same mapping-
  function pattern already used for `accessType`/`priceState`.
- `lib/ingest/upsert.ts` writes `price_amount_minor`, `currency`, and the
  *normalised* `payment_methods` (replacing the raw dump it wrote before).
- The nearby API returns `priceAmountMinor`/`currency`/`paymentMethods`;
  never null at the top level for `paymentMethods` — an unrecorded flag is
  `'unknown'`, the same "unknown is a value" rule already applied
  everywhere else, not an absent field.
- The preview and detail sheet show the amount when parseable
  (`lib/toilets/preview-copy.ts`'s new `priceAmountLabel`), and the detail
  sheet shows the three payment-method rows.

## In scope

- `lib/toilets/parse-charge.ts`, `lib/toilets/types.ts` (`PaymentMethods`).
- `normalize.ts`, `normalized-source-record.ts`, `upsert.ts`,
  `db/queries/nearby.ts`, `nearby-response.ts` changes to carry the new
  fields through.
- `preview-copy.ts`'s `priceAmountLabel`; `detail-copy.ts`'s payment-method
  labels; the detail sheet's three new rows.
- New `Dictionary` keys for the three payment-method names.
- Unit tests for the charge parser and payment-method mapping; integration
  tests proving the new columns round-trip through a real database.
- `docs/adr/0010-price-and-payment-normalisation.md`.
- `docs/CODEMAP.md` and `PROGRESS.md` updates.

## Out of scope

Do **not**:

- add currencies beyond PLN/EUR/USD, or attempt free-text charge
  descriptions ("donation", a range);
- add more payment methods than cash/cards/coins (OSM's `payment:*`
  namespace has many more tags — `contactless`, `mobile_phone`, specific
  card networks — none of which this task's research citation asked for);
- change `price_state` itself, ranking, or the opening-status work;
- re-run ingestion against the live source from this session (no egress,
  already documented).

## Canonical context to read

- `AGENTS.md`
- `PROGRESS.md`
- `PRODUCT.md` section 19 (the `2 PLN` literal-fact example)
- `docs/adr/0004-schema-conventions.md` (assigns this task the
  `payment_methods` normalisation)
- `docs/research/2026-09-13-warsaw-toilet-sources.md` section 3.10

## Likely relevant code

- `lib/ingest/osm/normalize.ts`, `lib/toilets/normalized-source-record.ts`
- `lib/ingest/upsert.ts`, `db/queries/nearby.ts`,
  `lib/toilets/nearby-response.ts`
- `lib/toilets/preview-copy.ts`, `lib/toilets/detail-copy.ts`,
  `components/map/ToiletDetailSheet.tsx`

## Constraints

- No new dependency; no schema migration (both columns this task writes
  to already exist).

## Verification

Run and record:

- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`
- `pnpm test:unit`, including the new charge-parser and payment-method
  tests
- `pnpm test:integration`
- `pnpm build`
- `pnpm test:e2e`, extended if a real amount/payment-row assertion is easy
  to add
- inspect the complete git diff

## Definition of done

TASK-014 is complete only when:

- a parseable charge amount renders in the price badge, an unparseable one
  falls back to the existing generic badge;
- the detail sheet shows all three payment-method facts, never fabricated;
- `docs/CODEMAP.md` and `PROGRESS.md` reflect the repository;
- the complete diff contains no unrelated changes.

Then stop. Do not begin TASK-015.
