# M3 verification

Scope: roadmap review, manual edits, acceptance, locks, phase/week navigation, checkpoints, calendar preview and immutable version recovery. Detailed weekly objectives, practice activities and completion/check-ins remain M4–M6. No M3 paid AI calls were made.

## Verification evidence

- Ten new local PostgreSQL/domain scenarios cover atomic duplicate/concurrent acceptance, 24-slot expansion, event exceptions, manual edits, lock bypass rejection, history recovery, seven-day shifts, stable IDs/content versions, fixed game conflicts, keep-dates expansion, shortening with explicit removal/cancellation, started/past/completed/canceled protection, live completion after preview, foreign reads/parent references, immutable history permissions, stale context, active-settings guard and accepted-history deletion cascades.
- Hosted verification uses an isolated synthetic account/program, the restricted database driver, and actual migration 006. Acceptance and seven-day shift persist as JSON objects and relational rows with stable session IDs; fixtures are removed afterward.
- Desktop and phone browser scenarios save edits, refresh, accept, lock, shift seven days, refresh accepted state and recover an earlier version with current dates/locks preserved. Temporary synthetic Auth users are deleted afterward; no email is sent. Screenshot inspection confirms responsive layout without horizontal overflow.
- Saving projections in batches reduced round trips for week/session rows. Browser tests await the new version URL before refresh, preventing a test from reloading an old version while acceptance is still completing.
- All ten desktop/mobile M3 and existing sign-in/isolation browser checks passed. Existing mutating M1 browser scenarios were not rerun against the user's current synthetic season; their local/hosted regression tests passed.
- Formatter, lint, type/build and final Rafter results are recorded below after completion.

## Security review

Rafter secure-design (authorization, storage and STRIDE) and code-review (web-app) skills applied. Existing Supabase auth, revocable HttpOnly sessions, production TLS/cookies and security headers remain unchanged.

- Authorization: every roadmap action calls `withSession`. `src/server/db/roadmap.ts:36` season/version reads explicitly join authenticated ownership. Writes serialize on actor and season locks, validate both latest review and accepted base, and recheck context. Replays return an existing request result. Foreign IDs fail without exposing another coach's content.
- Integrity: migration 006 forces RLS on versions/goals/weeks/sessions and binds program/season/parent IDs. Immutable versions have select/insert grants only. Accepted pointers, projections, context and version history commit in one transaction. Program deletion cascades across history and projections. Revoked sessions cannot enter these operations.
- Input/output: strict bounded Zod schemas in `src/domain/roadmap.ts:46`; at most 120 teaching weeks, 1,500 slots, 30 events, 36 goals and 500KB serialized snapshots. The Server Action body limit is 768KB to accommodate bounded calendar reviews. SQL values are parameterized; the only dynamic table names come from hard-coded internal lists. Generated/manual text renders as escaped React text, never HTML or executable content.
- Calendar tampering: `src/domain/roadmap.ts:304` protects history using server-local team dates. Acceptance compares the current projection (including completed status) with the candidate; stale preview, lock bypass, removed historical rows, phase gaps/overlap, out-of-range content and unresolved event conflicts fail. No unrestricted JSON patch or client status mutation is accepted.
- Abuse/logging: `src/server/db/roadmap.ts:118` limits 60 saved versions/program/ten minutes, serialized quota decisions, cryptographically random request/content IDs, no body/credential logging. Version rows retain actor, request ID, reason, timestamp and parent lineage. New fixture credentials are generated in memory and never committed.
- No new app outbound endpoint, model tools, payments, uploads, dependency or cryptographic primitive. OpenAI behavior is unchanged; manual M3 actions work during AI outages. Independent coaching/privacy/retention/backup/deployment gates still apply before real youth data.

Residual scope limits: calendar slots are not practice plans; newly extended dates receive empty teaching weeks but no silently invented practice slots. Recovery may require explicit conflict resolution; obsolete unaccepted phase layouts cannot replace the active layout. History retains only authorized private content and remains subject to privacy deletion.
