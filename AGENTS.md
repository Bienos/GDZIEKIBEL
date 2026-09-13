# Repository working rules

## Sources of truth

- `PRODUCT.md` owns product requirements, MVP scope and non-goals.
- `BRAND.md` owns tone of voice and copy rules.
- `DESIGN.md` owns visual/interaction design rules.
- `ARCHITECTURE.md` owns system boundaries and technical architecture.
- `docs/adr/` owns accepted architectural decisions when they exist.
- `docs/contracts/` owns cross-layer/API contracts when they exist.
- `PLAN.md` owns roadmap ordering.
- `tasks/<id>.md` owns the scope and acceptance criteria of the current task.
- `PROGRESS.md` owns factual current status and verification evidence.
- `docs/CODEMAP.md` is an on-demand repository map.

Do not duplicate ownership across files.

## Before changing code

1. Read the current task file.
2. Read `PROGRESS.md`.
3. Read only the product/design/architecture sections and ADRs/contracts referenced by the task.
4. Inspect directly relevant implementation and tests.
5. Check `git status` and existing diff.
6. Perform a targeted read-only preflight before editing.

Do not perform generic repository-wide onboarding unless an actual dependency/unknown requires it.

## Scope discipline

- Implement only the current task.
- Do not start the next task.
- Preserve all passing behaviour not explicitly changed by the task.
- Do not refactor unrelated working code.
- Do not rename/reformat unrelated files.
- Do not upgrade dependencies unless the task explicitly requires it.
- Follow existing patterns before introducing new abstractions.
- Prefer the smallest complete implementation satisfying acceptance criteria.
- Do not turn unknown data into false/true values for convenience.
- Do not weaken location/privacy constraints for easier implementation.

## Product/design discipline

- The primary mobile journey is more important than decorative design.
- Use copy rules from `BRAND.md`; factual labels must remain literal/readable.
- Use design rules from `DESIGN.md`; do not copy accidental inaccuracies from visual mockups.
- Map functionality must have an accessible list/fallback path where required by the task.

## Verification

- Run the narrowest relevant tests during development.
- Add regression tests for changed behaviour.
- Use real PostGIS/integration verification when database semantics are the behaviour under test.
- Run every verification required by the current task before completion.
- Never claim success without observed command/test evidence.

## Completion

Before stopping:

1. Inspect the complete git diff.
2. Remove accidental/out-of-scope changes.
3. Update `docs/CODEMAP.md` only if stable module boundaries changed.
4. Update `PROGRESS.md` with facts only.
5. Report changed files, tests run, results and unresolved blockers.
6. Stop. Do not begin another task.

## Security/privacy

- Never commit secrets.
- Never log or persist precise user location unless a future approved requirement explicitly changes this.
- Do not send raw latitude/longitude to analytics.
- Avoid request/body logging for location endpoints.
- Validate all external/source data before persistence.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
