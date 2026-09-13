# GDZIEKIBEL.PL — Build Plan v1

Status: Ordered roadmap. Detailed task files are created only when each item becomes actionable.

## Operating model

Design the system horizontally, implement it vertically.

Each implementation task should produce one observable user or operational outcome and should normally be completed in a fresh agent session.

Do not create detailed task specifications for the whole roadmap upfront. Exact files/contracts will change as earlier slices land.

## Milestone 0 — Product foundation

### TASK-001 — Project foundation

Outcome: a minimal deployable/testable Next.js + TypeScript application connected to the chosen development database baseline, with CI and no toilet features.

Detailed file already exists: `tasks/001-project-foundation.md`.

### TASK-002 — Data-source research and source decision

Outcome: validated Warsaw source inventory with licences, fields, update cadence and chosen first source(s).

No production feature code except small exploratory scripts if explicitly needed and discarded/isolated.

### TASK-003 — Canonical toilet schema + first source contract

Outcome: database migrations and source adapter contract sufficient for the first selected data source.

### TASK-004 — Ingest first Warsaw toilet dataset

Outcome: reproducible ingestion populates canonical/source tables in development/staging with verification counts.

## Milestone 1 — First useful map

### TASK-005 — Render Warsaw map shell

Outcome: user can open the site and see the branded Warsaw map shell on mobile.

No geolocation or toilet markers yet.

### TASK-006 — Request and display user location

Outcome: user can grant geolocation and see their position; denied/unavailable states work.

### TASK-007 — Nearby toilet API

Outcome: given coordinates, server returns bounded nearby canonical toilets using PostGIS.

No map markers yet.

### TASK-008 — Display nearby toilets on map

Outcome: nearby API results render as toilet markers and remain synced with selection.

### TASK-009 — Recommendation ranking

Outcome: results expose deterministic recommended ordering that accounts for distance + usability/confidence rules.

### TASK-010 — Nearest toilet preview

Outcome: bottom preview shows recommended toilet, distance, approximate ETA, status and price.

### TASK-011 — Toilet detail sheet

Outcome: selected toilet opens a usable detail sheet with known metadata and explicit unknown states.

### TASK-012 — External walking navigation

Outcome: `Prowadź mnie` launches a tested walking-navigation destination flow.

At this point the first core journey should work end to end.

## Milestone 2 — Real utility

### TASK-013 — Opening-hours normalisation/status

Outcome: source-supported hours produce `OPEN/CLOSED/LIKELY/UNKNOWN` states in Warsaw timezone.

### TASK-014 — Price/free state

Outcome: free/paid/unknown is normalised and rendered consistently.

### TASK-015 — List view

Outcome: same result set can be used without relying on map interaction.

### TASK-016 — Core filters

Outcome: open-now, free, wheelchair, baby-changing and 24h filters work with correct unknown semantics.

### TASK-017 — No-results and radius expansion

Outcome: empty state offers a useful fallback and can search farther.

### TASK-018 — Outside-Warsaw behaviour

Outcome: users outside supported geography receive a clear supported-area message/manual Warsaw map path.

## Milestone 3 — Trust layer

### TASK-019 — Data confidence display

Outcome: low/medium/high confidence can be surfaced where it improves user decisions without clutter.

### TASK-020 — Report incorrect toilet data

Outcome: anonymous validated report can be submitted.

### TASK-021 — Report abuse protection

Outcome: report endpoint has measured rate/abuse controls without storing unnecessary personal data.

### TASK-022 — Second data source + deduplication

Outcome: a second validated source can be ingested without creating obvious duplicate toilets; ambiguous matches are surfaced for review.

## Milestone 4 — Product quality

### TASK-023 — Analytics instrumentation

Outcome: core funnel events are captured without precise location.

### TASK-024 — Error tracking / privacy scrubbing

Outcome: runtime errors are observable and location/request-body leakage is prevented.

### TASK-025 — Performance pass

Outcome: measured mobile performance meets agreed budgets or has documented remaining constraints.

### TASK-026 — Accessibility pass

Outcome: map/list/sheets/core flow pass defined keyboard, screen-reader, contrast and touch-target checks.

### TASK-027 — SEO/share baseline

Outcome: metadata, social card, canonical basics and crawler-safe landing content are correct.

## Milestone 5 — Release hardening

### TASK-028 — Milestone integration verification

Outcome: full core journey is run against real staging stack; integration defects only are fixed.

### TASK-029 — Security/privacy review

Outcome: release candidate is reviewed for location privacy, write abuse, input validation, secrets, headers and data handling.

### TASK-030 — Independent release review

Outcome: a fresh reviewer checks the release candidate against `PRODUCT.md`, `ARCHITECTURE.md` and completed task criteria without modifying code.

### TASK-031 — Staging release verification

Outcome: migrations, deployment, smoke tests, observability and rollback path verified.

### TASK-032 — Production release

Outcome: approved artefact is deployed and critical production journey verified.

## Future backlog — not MVP commitments

Only promote these to tasks based on evidence:

- stable shareable pages for individual toilets,
- user-submitted new toilet locations,
- photos,
- moderation panel,
- richer routing/ETA service,
- district/24h SEO pages,
- installable PWA polish,
- native app wrapper,
- expansion outside Warsaw,
- partner/commercial data,
- crowdsourced verification.

## Task creation rule

Before implementing the next roadmap item, create exactly one `tasks/NNN-*.md` containing:

- goal,
- acceptance criteria,
- in scope,
- out of scope,
- referenced canonical docs/contracts,
- likely relevant code,
- constraints,
- verification,
- definition of done.

Do not create the next task until the current task is accepted/committed unless planning dependencies require it.
