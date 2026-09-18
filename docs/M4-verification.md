# M4 verification

## Delivered behavior

Weekly planning is reachable from Season and any selected accepted-roadmap week.
Coaches generate or manually edit one to three objectives, observable checks,
season-goal links and practice assignments; save drafts; accept immutable versions;
lock objectives; and read prior versions. Coach allocation overrides survive
regeneration. Zero-practice and tournament-heavy weeks never fabricate sessions.
M3 calendar review remains the explicit path for date/time overrides.

Each weekly revision retains its accepted roadmap ID and context version.
Stale saves and late generation fail safely; refreshing against a changed roadmap
creates a separate draft. Past/completed practice assignments and referenced
objectives stay protected. Generation failure leaves manual editing available.

## Verification evidence

- Local and hosted Supabase suite: 48 checks passed; both paid-provider tests
  skipped in that run. Fresh database migration, owner isolation, relational foreign
  keys, immutable versions, idempotent acceptance, shared quotas, expired runs,
  late-result rejection, locks, manual assignments, zero-practice weeks, tournament
  constraints, completed-session protection and program-deletion cascades covered.
- M3 desktop/mobile browser regression passed after the M4 integration.
- One separate live OpenAI synthetic tournament-week check passed with
  `gpt-5.4-mini-2026-03-17`: 5,747 ms, 1,186 input tokens, 543 output tokens,
  one attempt. One teaching objective, one authorized 45-minute slot, no invented
  sessions, and Unknown participation retained. Used the ninth reserved call in
  the existing authorized test ledger; no further paid calls were made.
- Migration 007 applied to configured development Supabase. Only temporary
  synthetic fixtures/accounts were created and removed by verification.
- Final M4 desktop/mobile browser flows both passed, including saved edits,
  acceptance, refresh, locks, regeneration and retained manual allocation overrides.
  Added a further calendar regression proving an availability override cannot
  bypass a blocking event (11 weekly domain/database tests passed). Combined
  local/hosted coverage is 49 passing checks plus the separate live-provider check.
  Final build and remote scan results are recorded below when complete.

## Manual Rafter / React review

`src/server/db/week.ts` checks session-derived ownership before reads/writes and
serializes changes on the existing actor advisory lock plus season row lock.
All values use bound SQL parameters; no dynamic user-supplied identifiers exist.
`migrations/007_weekly_planner.sql` forces RLS, denies public/provider API roles,
enforces tenant/season/version links, and grants no snapshot updates. Program
privacy deletion cascades through weekly snapshots and generation context.

`src/domain/week.ts` rejects foreign goals, invented session IDs, duplicate IDs,
unknown fields and changed protected teaching/assignments. Calendar generation is
absent from the provider contract. Only explicit coach acceptance advances the
active weekly head. Repeated requests return the saved result; optimistic version
checks reject competing edits. A generated draft never changes the active head.

`src/server/ai/week-provider.ts` separates fixed rules from untrusted coach context,
uses no tools and accepts only bounded structured output. `openai-season.ts` shares
the existing fixed HTTPS endpoint, redirect rejection, timeout/response cap and
`store:false` across season/week actions. Schema and semantic validation run before
persistence. No new dependencies, auth flows, keys, uploads, external URLs, caches,
vector stores, agent tools or public sharing were introduced.

`src/components/week-editor.tsx` renders escaped text and native labeled controls,
shows draft/accepted/stale/failure states, preserves saved drafts across refresh,
and blocks local edits while generation completes. `next.config.ts` disables
Next's development logging of Server Function arguments. Errors expose no SQL,
prompts or secrets. React uses stable objective IDs and derived state, with no
additional browser storage or new data-fetching dependencies.

Real youth-data/privacy/vendor decisions and independent basketball-coach review
remain the existing pre-pilot gates. Synthetic verification does not authorize launch.
