# TASK-029 — Security/privacy review

## Goal

`PLAN.md`'s outcome: "release candidate is reviewed for location privacy,
write abuse, input validation, secrets, headers and data handling."
`ARCHITECTURE.md` section 16 names the MVP threat priorities (report
endpoint spam, oversized/malformed input, injection attempts, source
ingestion poisoning, exposed database credentials, accidental location
logging) and the controls expected against them (schema validation,
parameterised queries, server-controlled limits, rate limiting, CSRF
considerations "where applicable," least-privilege credentials, secrets
in env/secret stores only, dependency scanning in CI, security headers).
`PRODUCT.md` section 14 names the privacy requirements specifically:
no account for core use, no precise live location in the product
database, no precise coordinates in analytics or request URLs, no
unnecessary third-party trackers, and external services that receive
IP/location-derived data documented.

## Design decision: audit against the actual checklist, fix only real findings

This is a review task, not a new-feature task. The right shape of work is
systematically checking each named control against what the code
actually does — not assuming compliance because earlier tasks intended
it, and not inventing new hardening the checklist does not ask for.
Every prior task this session already built toward several of these
controls individually (TASK-021's rate limiter, TASK-023's
location-free analytics, TASK-024's leak-proof error logging); this task
is the first to check them all together, as a release gate, and to look
for what no single earlier task's own scope would have caught.

## User-visible outcome

None directly. Any fix here closes a real gap without changing product
behaviour for a legitimate user.

## Acceptance criteria

- Every ARCHITECTURE.md section 16 control and PRODUCT.md section 14
  privacy requirement is checked against the actual code, not assumed.
- Every real, confirmed gap is either fixed (if in scope and low-risk) or
  named explicitly as a recorded, deliberate gap — never silently
  skipped.
- No existing test regresses; any fix ships with its own regression
  test.

## In scope

- A systematic read-only audit of routes, queries, ingestion, logging,
  and config against the checklist above.
- Fixing real, low-risk, clearly-scoped gaps the audit finds.
- Documenting anything found that is a real gap but out of this task's
  safe scope to fix blind (e.g., a least-privilege database role, which
  needs real infrastructure access this session may not have).

## Out of scope

Do **not**:

- add an authentication subsystem (`ARCHITECTURE.md` section 16: "No
  authentication subsystem is needed for public MVP user flows");
- add new infrastructure (a WAF, a secrets manager, a SAST service)
  without evidence, per `ARCHITECTURE.md` section 21;
- change any route's success-path behaviour or response shape;
- attempt the parts of `PLAN.md`'s later tasks that overlap in spirit
  (TASK-030's independent review, TASK-031's staging verification) —
  this task's own scope is the code/config audit only.

## Canonical context to read

- `AGENTS.md`
- `PROGRESS.md`
- `ARCHITECTURE.md` sections 8, 16, 17
- `PRODUCT.md` section 14

## Likely relevant code

- Every `app/api/**/route.ts` handler
- Every `db/queries/*.ts` file
- `lib/observability/`, `lib/reports/rate-limit.ts`
- `.github/workflows/ci.yml`, `vercel.json`, `.gitignore`, `.env.example`

## Constraints

- No new dependency without evidence of a real, checked-for gap it
  closes.
- No change to any route's response shape for its legitimate use.

## Verification

Run and record:

- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`
- `pnpm test:unit`, `pnpm test:integration`
- `pnpm build`
- `pnpm test:e2e`
- For any fix: a regression test proving the specific gap is closed.

## Definition of done

TASK-029 is complete only when:

- every named control/requirement has a recorded, evidence-based
  finding (pass, fixed, or named gap);
- every fix has its own test and does not regress any existing one;
- `docs/CODEMAP.md` and `PROGRESS.md` reflect the real findings,
  including gaps that remain open;
- the complete diff contains no unrelated changes.

Then stop. Do not begin TASK-030.
