# M1 verification

Status: implementation and verification in progress. No M2 functionality added.

## Security review

Rafter secure-design and code-review skills applied. New browser forms are untrusted input; the server schema rejects unknown fields and bounds strings, arrays, dates, timezones and integer durations. Next Server Actions enforce same-origin mutations with a 64 KB body limit; the action adds a 48 KB input limit. SQL values are bound parameters. The only interpolated identifiers are fixed, internal table-name lists. React escapes all submitted text.

Authorization: src/server/onboarding/actions.ts calls withSession before all repository writes; src/server/db/onboarding.ts owned resolves program ownership from the authenticated actor. Nested row IDs must already belong to the authorized season. migrations/003_onboarding.sql enables and forces RLS with composite tenant foreign keys on all new tables, and explicitly revokes public/API-role grants. No privileged database credentials enter request code. Reads lock the season for a consistent setup view; saves serialize per owner and compare the context version.

Integrity: report revisions are append-only and unchanged fields retain their original source attribution; Unknown is null, not a low rating. A save is transactional; invalid or stale input rolls back. Existing roster IDs remain stable. Removing a roster entry does not erase the program player identity or claim privacy deletion. No generated inferences, plan acceptance, live models, arbitrary fetches, uploads or shell execution are introduced.

Deletion: synthetic flag is migration-only; runtime cannot assign it. Repository deletion verifies owner, exact confirmation and session freshness. Program deletion cascades through all current tenant tables and revokes app sessions. Tests cover denial for foreign, non-synthetic, incorrectly confirmed and stale-login requests. No public deletion button is exposed. Backup expiry/replay remains a pre-pilot/M7 requirement.

Abuse/configuration: per-account setup save quota (60 per ten minutes), fixed payload bounds, no new dependencies, no content logging, generic infrastructure errors that preserve the form. Authentication, provider lifecycle revocation gaps, production headers/edge limits and independent audit/backup controls retain the M0 launch restrictions. This milestone does not claim production approval.

## Checks

- Fresh PostgreSQL migrations and M0/M1 unit/integration scenarios passed locally.
- Hosted Supabase isolation regression passed after migration 003.
- Production build passed; final checks and browser acceptance are being completed.
- Remote Rafter scan pending.

Local secrets scanning with Betterleaks includes ignored files in this installed CLI configuration. It found only ignored local configuration and generated Next caches; these are not source exports. Scan the staged source snapshot separately before pushing. Do not copy ignored secrets into scan artifacts or logs.
