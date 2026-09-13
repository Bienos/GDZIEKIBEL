# ADR 0002 — Language lives in the URL

Status: Accepted
Date: 2026-09-13
Scope: Requested by the project owner after TASK-001, outside the task sequence

## Context

The shell shipped in Polish only. The owner asked for an English switch that
changes all text.

`docs/research/2026-09-13-warsaw-toilet-sources.md` section 3.5 records that
English complaints against the city's own app recur, that a tourist was told it
cannot be switched, and that English is cheap relative to the value it provides.
Section 3.5 also warns that English should read as direct English, not a
word-for-word translation of Polish profanity.

## Decision

The locale is a route segment: `/pl` and `/en`. The bare domain redirects to
`/pl`, temporarily rather than permanently, so locale negotiation can replace
the redirect later without a cached 301 in the way.

Copy lives in `lib/i18n/dictionaries.ts`, keyed by locale behind a
`Dictionary` interface. Components read strings from the dictionary and never
inline user-facing text.

## Why not a client-side toggle

A toggle held in component state or `localStorage` was rejected. It cannot be
linked to or shared, search engines only ever see one language, and the
document's `lang` attribute stays wrong for the language actually displayed,
which misleads screen readers and translation tools.

With the locale in the route, both pages prerender as static HTML, each carries
its own `lang`, metadata and canonical URL, and `hreflang` alternates are
generated from the locale list.

## Consequences

- Adding a locale means adding it to `LOCALES` and to `DICTIONARIES`. Both pages
  stay static via `generateStaticParams`.
- `tests/unit/i18n.test.ts` fails the build when a locale is missing a key, ships
  an empty string, or leaves Polish text in the English dictionary. A missing
  translation cannot reach a reader silently.
- An unknown segment such as `/de` returns the not-found page rather than
  falling back to Polish.
- The bare domain costs one redirect. That is the price of not guessing a
  language before there is anything to serve.

## Not decided here

Accept-Language negotiation, a remembered preference, translated slugs, and
whether the strong Polish brand voice has an English equivalent at all. The
English copy here is deliberately plain and factual.
