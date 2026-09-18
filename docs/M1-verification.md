# M1 verification

Status: **M1 complete for the configured synthetic development project**. Functional acceptance, GitHub CI and Rafter review/scan passed for source commit e2120f1, with the two placeholder-only warnings dispositioned below. No M2 functionality added.

## Security review

Rafter secure-design and code-review skills applied. New browser forms are untrusted input; the server schema rejects unknown fields and bounds strings, arrays, dates, timezones and integer durations. Next Server Actions enforce same-origin mutations with a 64 KB body limit; the action adds a 48 KB input limit. SQL values are bound parameters. The only interpolated identifiers are fixed, internal table-name lists. React escapes all submitted text.

Authorization: src/server/onboarding/actions.ts calls withSession before all repository writes; src/server/db/onboarding.ts owned resolves program ownership from the authenticated actor. Nested row IDs must already belong to the authorized season. migrations/003_onboarding.sql enables and forces RLS with composite tenant foreign keys on all new tables, and explicitly revokes public/API-role grants. No privileged database credentials enter request code. Reads lock the season for a consistent setup view; saves serialize per owner and compare the context version.

Integrity: report revisions are append-only and unchanged fields retain their original source attribution; Unknown is null, not a low rating. A save is transactional; invalid or stale input rolls back. Existing roster IDs remain stable. Removing a roster entry does not erase the program player identity or claim privacy deletion. No generated inferences, plan acceptance, live models, arbitrary fetches, uploads or shell execution are introduced.

Deletion: synthetic flag is migration-only; runtime cannot assign it. Repository deletion verifies owner, exact confirmation and session freshness. Program deletion cascades through all current tenant tables and revokes app sessions. Tests cover denial for foreign, non-synthetic, incorrectly confirmed and stale-login requests. No public deletion button is exposed. Backup expiry/replay remains a pre-pilot/M7 requirement.

Abuse/configuration: per-account setup save quota (60 per ten minutes), fixed payload bounds, no new dependencies, no content logging, generic infrastructure errors that preserve the form. Authentication, provider lifecycle revocation gaps, production headers/edge limits and independent audit/backup controls retain the M0 launch restrictions. This milestone does not claim production approval.

## Checks

- **18 unit/database tests passed, zero skips** with hosted tests enabled: fresh migrations, owner isolation, server-invalid dates/durations, partial drafts, Unknown provenance, stable IDs, stale writes and synthetic cascades.
- Migration 003 applied to the configured synthetic Supabase project. Existing managed login and tenant isolation remain verified.
- **10 Playwright tests passed, zero skips** in 1.9 minutes across desktop/mobile Edge. The live M1 scenario saves the first-year 13U/nine-player/twelve-week/two-90-minute/one-hoop fixture, resumes after reload, rejects zero duration, persists the unnamed roster, finishes setup and rejects a stale second tab. Existing login/logout/foreign-team scenarios pass.
- Formatting, ESLint, typechecking and production build passed. No dependencies added.
- Desktop and mobile setup screenshots inspected: readable labels and controls, no horizontal overflow; isolated browser preview has no page errors. Synthetic screenshots are ignored test artifacts.
- Rafter source-only local secrets scan: **zero findings**. Staged files also checked against configured secret values, with no matches.
- Remote Rafter fast scan **completed**: f07c22af-0f9a-42d3-a821-a4016de3c197, rafter-fast@0.10. **0 errors, 2 warnings**; both are cleartext-credential-in-url at .env.example:4–5. They contain literal password/HOST placeholders, not real credentials, and describe server-only PostgreSQL connection templates rather than browser URLs. Same reviewed false-positive disposition as M0; no new security findings. This is a reviewed scan with warnings, not a zero-warning scan. Paid Plus was not run.
- GitHub CI: [run 35306424689](https://github.com/klaypizay/basketballcoach.ing/actions/runs/35306424689), **passed**, including formatting, lint, typecheck, tests, production build, Chromium checks and dependency audit.

The first browser attempts uncovered ambiguous label associations and test selectors; labels are now explicitly linked to controls, assertions target the form rather than Next's route announcer, and remote save assertions allow network latency. Batched report/roster writes reduce round trips. Repeated test logins reached the intended login quota; only the two synthetic test-coach counters were reset before the successful run. Runtime rate-limit policies were not changed.

Local secrets scanning with Betterleaks includes ignored files in this installed CLI configuration. It found only ignored local configuration and generated Next caches; these are not source exports. Scan the staged source snapshot separately before pushing. Do not copy ignored secrets into scan artifacts or logs.

## Review evidence

- Access control: src/server/onboarding/actions.ts:23; src/server/db/onboarding.ts:33,108; migrations/003_onboarding.sql:76. Session-derived actor, owner lookup, nested-ID checks and forced RLS.
- Injection/input: src/domain/onboarding.ts:70,100; src/server/db/onboarding.ts:194. Strict bounded schemas, real calendar validation, fixed SQL identifiers and parameterized arrays; no arbitrary URL or shell sink.
- Integrity/deletion: src/server/db/onboarding.ts:298; migrations/003_onboarding.sql:16,91. Fresh login, synthetic-only restrictive policy, hard FK cascades; source reports have insert/select-only runtime permissions.
- Authentication/crypto: existing managed auth and opaque-session primitives unchanged; freshness now comes from the session creation timestamp, not last activity. No new cryptography or credentials.
- Configuration/supply chain: next.config.ts:3 caps request bodies; package manifest/lockfile unchanged. No dependency install scripts added. Remote SCA is part of the required scan.
- Logging/monitoring: server action returns bounded validation or generic infrastructure errors without request-body logging. Independent audit export and provider lifecycle revocation remain M0 pre-pilot gates.
- AI/SSRF/deserialization: no live AI, tools, user-URL fetching, custom executable parser, or untrusted HTML is added. JSON.parse feeds a strict schema and explicit field mapping.
