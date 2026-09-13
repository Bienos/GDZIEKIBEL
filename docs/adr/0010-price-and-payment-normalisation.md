# ADR 0010 — Price amount and payment-method normalisation

Status: Accepted
Date: 2026-09-13
Scope: TASK-014 — Price/free state

## Context

Two schema fields have sat unused since `TASK-003`: `price_amount_minor`/
`currency` on `toilets`, and `payment_methods` (`docs/adr/0004-schema-conventions.md`
explicitly assigns its normalisation to this task; until now it held the
*raw* `payment:*` tag dump instead). Implementing both requires a bounded
grammar decision, mirroring `docs/adr/0009-opening-hours-status.md`'s
approach to `opening_hours`.

## Decisions

### A bounded `<amount> <currency>` grammar for `charge`

`lib/toilets/parse-charge.ts` accepts exactly one amount and one currency
token: a number with an optional 1-2 digit decimal part (`.` or `,` as the
separator), then whitespace, then a currency token from a small fixed set
(`PLN`, `zł`/`zl` — both mapped to `PLN` — `EUR`, `USD`). Anything else —
a range (`2-4 PLN`), missing currency, free text ("donation", "ask
staff") — fails to parse as a whole, returning `null`. The amount is
stored in minor units (`amountMinor = round(amount × 100)`), matching the
column name and avoiding floating-point currency values in the database.

Only three currencies are recognised. Warsaw is the only market this
product serves; `EUR`/`USD` are included because OSM data occasionally
uses them for cross-border operators, not because the product expects
non-PLN pricing to be common. A charge in another currency, or a currency
this grammar cannot recognise, is `null` — the existing generic `PŁATNY`/
`PAID` badge is what a user then sees, not a fabricated or mislabelled
amount.

### Three payment-method flags, not the full `payment:*` namespace

OSM's `payment:*` namespace covers many methods (contactless, mobile
wallets, specific card networks, vouchers). `docs/research/2026-09-13-warsaw-toilet-sources.md`
section 3.10 cites one concrete, real user problem: needing coins for a
coin-operated turnstile, and not knowing in advance whether cash or card
works at all. This task normalises exactly the three facts that problem
calls for — `cash`, `cards`, `coins` — each a `FeatureState`
(`yes`/`no`/`limited`/`unknown`), the same shape already used for
wheelchair/changing-table/unisex. Every other `payment:*` tag OSM might
carry is not read by this task; nothing here claims to represent them.

`payment_methods` is never `null` at the API boundary: an unrecorded flag
is `'unknown'`, matching the "never collapse unknown into no" rule
(`PRODUCT.md` section 9) already applied to every other feature field. A
row with no `payment:*` tags at all still gets a full `{cash: 'unknown',
cards: 'unknown', coins: 'unknown'}` object, not an absent field a
consumer would have to null-check separately from every other feature.

### Mapping lives in the OSM adapter, not a shared module

Interpreting `payment:cash=yes`/`payment:cards=yes`/`payment:coins=yes` is
OSM's own tagging convention, the same reasoning already applied to
`accessType()`/`priceState()`/`featureState()` in
`lib/ingest/osm/normalize.ts`: the mapping *function* is source-specific,
even though the *output shape* (`PaymentMethods` in `lib/toilets/types.ts`)
is canonical and source-agnostic. `parse-charge.ts`, by contrast, parses a
generic amount-plus-currency string any source might produce, so it lives
in `lib/toilets/` as a shared, reusable parser — the same distinction
`docs/adr/0009-opening-hours-status.md` draws between the OSM-specific
`opening_hours` tag reader and the reusable grammar parser underneath it.

## Consequences

- A future source (`TASK-022`) with its own `charge`-like field reuses
  `parse-charge.ts` unchanged if its format matches; one with a different
  format needs its own parser feeding the same `{ amountMinor, currency }`
  shape.
- A future source with a different payment-tagging convention needs its
  own mapping function, feeding the same canonical `PaymentMethods` shape;
  `db/queries/nearby.ts` and the API do not need to know which source
  produced it.
- Extending recognised currencies or payment flags later is additive: a
  new case in `parse-charge.ts`'s currency lookup, or a new field on
  `PaymentMethods`, not a rewrite.

## Not decided here

Whether payment-method data is common or rare in Warsaw's real OSM toilet
tags is unknown until a live ingestion run happens; this session cannot
run one (no egress to Overpass, an existing, already-documented
limitation).
