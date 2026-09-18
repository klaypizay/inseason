# Season Coach · Milestone 3

Foundation for an adult basketball coach's private workspace. Includes managed sign-in, immediate app-session revocation, a responsive Today shell, private PostgreSQL schema and tenant-scoped repository, synthetic fixtures, CI and a deterministic AI interface. M1 adds resumable team/coach setup, season phases, practice availability, events, optional roster aliases and attributed assessment inputs. M2 adds live OpenAI assessment and coarse season roadmap drafts with evidence checks, saved history and bounded retries. M3 adds manual roadmap review, acceptance, locks, calendar previews and immutable version history.

Original specifications remain unchanged in [`md files/`](md%20files/). See [M0 design](docs/M0-design.md) for security decisions and [verification](docs/M0-verification.md) for actual results and outstanding gates.

## Using team setup

Sign in, choose **Team settings**, and work through the five setup steps. **Save progress** saves the current draft; **Save & continue** saves before moving on. You can switch steps without losing edits in the open tab. Save before leaving; reloading with unsaved changes prompts a browser warning. Failed saves preserve the form. A stale tab must reload before it can overwrite newer settings.

Blank report answers remain **Unknown**. Saved statements are dated coach reports, not generated assessments. Approve a single in-season phase or enter your own phases covering the season; unused phases may be skipped. Dates are inclusive and practice times use the selected IANA timezone. Zero regular practice slots is valid. No practices are generated in M1.

The synthetic acceptance fixture is a first-year 13U coach, nine players, twelve weeks (2027-01-04 through 2027-03-28), Monday/Wednesday 90-minute slots and one hoop. The browser scenario saves this fixture to Demo Cedar, retaining the existing player identity and adding optional aliases. Tests may update this synthetic team's setup. Do not use real player data.

See [M1 design](docs/M1-design.md) and [M1 verification](docs/M1-verification.md). Synthetic program deletion is exercised through the repository tests, restricted to migration-marked synthetic programs, exact name confirmation and a login within ten minutes. It verifies live database cascades, not production backup erasure.

## Local setup

1. Use Node.js 22 or newer. Run `npm ci --ignore-scripts`.
2. Copy `.env.example` to `.env.local`. Never commit populated settings. Use a **synthetic development Supabase project** with email/password authentication. Disable public signups in the provider's settings, and provision two confirmed adult test-coach accounts in the Supabase dashboard. Put their auth UUIDs in `SEED_COACH_A_ID` and `SEED_COACH_B_ID`. Keep passwords in the provider/password manager.
3. Configure `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`. These are used server-side; no service-role API key is needed. Configure `MIGRATION_DATABASE_URL` using the project's migration/admin PostgreSQL connection. Use a direct/session connection for migrations.
4. Run `npm run db:migrate`. This builds a fresh private `coach` schema and creates a non-login runtime role. Migrations are atomic, tracked and checksum-verified; reruns skip applied files. Use a dedicated database: the role/schema must not already exist before the first migration.
5. In the database administrator console, enable login for `season_coach_app` and set a unique runtime password using the provider's secure role-management process. For a local `psql` session: run `ALTER ROLE season_coach_app LOGIN;` then `\password season_coach_app` to enter the password without a SQL literal/history entry. Do **not** grant schema ownership, superuser, BYPASSRLS or membership in privileged roles.
6. Set `DATABASE_URL` to that runtime role. The application refuses any other role or a privileged role. Remote PostgreSQL connections require TLS certificate verification. Download the server root CA from your project's Database Settings and set `DATABASE_CA_CERT_FILE` to its local path. `DATABASE_SSL=false` works only with loopback hosts for local development. Never use an admin connection for application queries. Supabase pooler usernames require the project's documented username suffix; PostgreSQL `current_user` must still resolve to `season_coach_app`. After a password rotation, the pooler may briefly cache old credentials. This development environment uses the verified direct connection for the app role and the session pooler for migrations.
7. Run `npm run db:seed` with migration credentials. It creates separate Demo Cedar / Demo Willow programs, teams, seasons, aliases and generation records. It is repeatable and refuses to reassign an existing fixture to a different account. Seeds never create auth users or passwords.
8. Run `npm run dev`, open [localhost:3000](http://localhost:3000), and sign in using a provisioned test coach. For a production build: `npm run build` then `npm start`. Deployment is not part of M0.

Without configuration the login page still renders; submitting the form reports a recoverable connection error. There is no fake login or production auth bypass.

## Verification

```text
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
rafter secrets .
rafter run
```

SQL tests use PGlite's real embedded PostgreSQL engine and apply the actual migration to an empty database. They switch to the runtime role, exercise ownership/RLS independently of repository filters, reject cross-program foreign keys and verify cookie replay fails after revocation. They do not replace verification against your configured Supabase project.

Browser tests require Chromium (`npx playwright install chromium`) or set `PLAYWRIGHT_CHANNEL=msedge` to use installed Edge. The real managed-auth browser test requires `E2E_COACH_EMAIL` and `E2E_COACH_PASSWORD` in the test process environment, plus application configuration in `.env.local`. Use only synthetic accounts. Without these credentials that test is explicitly skipped. Never upload traces from credentialed tests: they may contain form values. Disable tracing for live tests.

The configured local environment also contains `E2E_COACH_A_EMAIL` / `E2E_COACH_A_PASSWORD` and equivalent `B` settings for the two-coach browser test. These generated test credentials and their real Auth UUIDs remain in `.env.local` only. No invitation or confirmation emails were sent. The optional `SUPABASE_SECRET_KEY` is operator-only for Auth provisioning; the app does not use it.

To run all unit/database tests against the configured development project in PowerShell:

```powershell
$env:RUN_HOSTED_DB_TESTS = '1'
node --env-file=.env.local node_modules/vitest/vitest.mjs run
```

To run all browser tests with those credentials:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'msedge'
node --env-file=.env.local node_modules/@playwright/test/cli.js test --workers=1
```

The test runner normally starts its own app on port 3187. If you deliberately started this checkout's server there with `npm run dev -- --port 3187`, set `PLAYWRIGHT_REUSE_SERVER=1` in the test process to reuse it (also avoids Windows test-server teardown issues). To reuse this checkout on port 3000, also set PLAYWRIGHT_BASE_URL=http://localhost:3000. The server needs network access to Supabase. CI runs synthetic local checks without live project credentials; hosted tests remain explicitly skipped there.

For the two-coach manual check: sign in separately as both seeded coaches; each Today page should show only its own team. Reload; sign out; the previous cookie must fail to reopen `/today`. Repository tests cover direct/nested ID and status mutations, which M0 intentionally does not expose as public editing routes.

## Boundaries and operations

- The `coach` schema must remain excluded from Supabase's exposed Data API schemas. There are no grants for `anon`/`authenticated`; browser JWTs cannot bypass application-session revocation.
- Managed Supabase authentication verifies credentials. Its temporary login session is revoked immediately, then an independent HttpOnly application session is issued for at most seven days, with 24-hour idle expiry. Sign-out deletes the app session server-side. A password reset/provider account freeze currently also requires an operator to delete that coach's `coach.sessions` rows; automated provider lifecycle integration is a pre-pilot requirement.
- Login quotas are shared through PostgreSQL (10 attempts/email and 100 total/15 minutes). Configure trusted-edge per-IP limits and provider abuse controls before public use. Expired session and old login-limit rows should be purged daily by an operator job; do not log row contents.
- Runtime credentials are intentionally least-privileged: M1 grants bounded setup writes under owner policies, immutable report inserts and synthetic-only program deletion. The runtime cannot label a program synthetic. Setup saves are limited to 60 per account per ten minutes. Session and login-limit storage is server-only infrastructure, not tenant content accessible through the browser.
- AI fixture actions return typed Unknown drafts with no evidence or active-plan mutations. M2 implements assessment and roadmap schemas; later action placeholders remain unavailable to users.
- No real youth data until the original privacy/vendor/retention/coaching and security launch gates are resolved. M1 verifies synthetic live-data cascades; production privacy deletion and operational backups remain future launch gates.

Next milestone: **M5 — Practice generator and player goals**.

## Syncing with GitHub

This folder is connected to the private repository [klaypizay/basketballcoach.ing](https://github.com/klaypizay/basketballcoach.ing), with local `main` tracking `origin/main`.

After making changes, run these commands from this project folder:

```sh
git status
git add .
git diff --cached --stat
git commit -m "Describe your changes"
git push
```

`commit` saves a local version; `push` uploads committed changes to GitHub. Saving a file alone does not sync it. To download changes from GitHub when your working tree is clean, use `git pull --ff-only`.

`.env.local`, installed dependencies, build output and test artifacts are ignored. `.env.example` contains placeholders and is tracked. Check `git status` before committing; never force-add secrets. GitHub Actions runs the foundation checks on each push.

## Assessment and season drafts (M2)

Open **Season** from Today after completing setup. Draft an assessment or season roadmap; open saved attempts from history. Every draft has a private URL and survives refresh. Reports remain attributed coach statements; generated inferences are Likely with same-topic evidence, and missing information remains Unknown. All configured phases and inclusive weeks appear in the roadmap. No draft activates a plan or schedules practices. Edit team inputs and generate again; prior drafts remain history and display a stale-settings notice.

In `.env.local`, set `COACH_AI_PROVIDER=openai`, `OPENAI_API_KEY` and optionally `OPENAI_MODEL` (default `gpt-5.4-mini-2026-03-17`). Restart the server after changing provider configuration. `COACH_AI_PROVIDER=fixture` provides free deterministic examples and is the tracked default. Keys remain server-side. OpenAI receives bounded team reports, calendar/resources and aggregate participation, without account identity, team name or player aliases; avoid personal details in free-text reports. Requests use `store:false`, which does not replace provider retention/privacy approval before real youth data.

Each run permits at most three provider calls: one transient retry and one schema repair, with a sixty-second deadline per call and 12,000 maximum output tokens. Unsupported evidence/calendar responses are rejected without automatic retry. Two simultaneous runs per program and a rolling daily limit of thirty apply (`COACH_AI_DAILY_LIMIT`, 1–100). Interrupted runs expire after five minutes. Refresh checks an existing run rather than starting another. Token totals reflect usage returned by the provider; failed connections/refusals may have unreported billable usage, so provider billing is authoritative.

Migrations 004 and 005 add private draft storage and run metadata. Apply them with `npm run db:migrate` before using these screens. See [M2 design](docs/M2-design.md) and [M2 verification](docs/M2-verification.md).

Live-provider tests are deliberately opt-in and use only a fixed synthetic fixture:

```powershell
$env:RUN_LIVE_AI_TESTS = '1'
node --env-file=.env.local node_modules/vitest/vitest.mjs run tests/live-ai.test.ts
```

The ignored `.env.m2-test-budget` reserves $0.10 per attempted call, at most nine calls across reruns for this authorized test budget. Do not reset it to bypass authorization. Synthetic outputs and measured usage are saved under ignored `.local-artifacts/live-ai/`. Browser generation tests require fixture mode and skip in live mode to avoid accidental charges.

## Roadmap review and calendar (M3)

From a saved roadmap draft, choose **Review & edit roadmap**. Edit the explanation, assumptions, phase goals, observable checks, weekly emphases and checkpoints. **Save draft edits** preserves a review without changing the active plan. **Accept roadmap** atomically activates the reviewed content and calendar. Season links to the accepted version and any unfinished review. No AI connection is needed for editing or acceptance.

Choose a phase or teaching week to navigate its goals and sessions. A week with no sessions explicitly shows no team practice. Locks protect goal text/checks or a week's teaching content. Save and accept an unlock before changing protected active content. Started/past teaching weeks and past/completed/canceled sessions remain fixed. Completion and detailed practice activities are later milestones; M3's sessions are scheduled calendar slots.

**Review calendar changes** offers shift-future-dates and keep-existing-dates choices. Review phase boundaries, teaching-week dates, session moves and fixed events, then **Save calendar preview**. This creates a draft; acceptance is a separate step. Games/tournaments stay fixed unless individually edited. Blocking events cannot be overridden: reschedule or cancel conflicting sessions, or explicitly edit the event. An outside-availability session needs a coach override reason. Cancellation retains history. Effective availability ranges can be adjusted in the preview; new slots are not automatically added when extending an already accepted calendar (session allocation/overrides continue in M4).

Shortening does not silently drop teaching content. Reassign dates or explicitly remove affected unlocked future weeks, then resolve affected sessions. New uncovered dates receive clearly labeled weeks for coach planning. All phase/week coverage and conflicts are validated again on acceptance. IDs and content versions remain stable during date-only moves.

**Version history** links to the most recent 100 versions; older saved URLs remain readable. **Recover version … as a new draft** retains the current calendar, fixed events, locks and historical sessions while bringing earlier teaching content back for review. Restored out-of-range weeks produce conflicts rather than disappearing. A pre-acceptance draft with an obsolete phase layout cannot replace an accepted layout. Recovery always adds history; it never deletes intervening versions. Concurrent or stale saves fail without overwriting newer work.

Once a roadmap is active, Team settings still accepts profile/roster/resource edits; calendar changes must use roadmap review. A settings change makes prior reviews stale. Recover the current accepted version against the new context or generate a fresh roadmap before accepting again.

Apply migration 006 with `npm run db:migrate`. The new history tables are immutable to the runtime role, and calendar projections use forced ownership policies and tenant/season foreign keys. See [M3 design](docs/M3-design.md) and [M3 verification](docs/M3-verification.md).

M3 hosted/browser tests provision isolated synthetic fixtures; the browser test creates and deletes a temporary confirmed adult test-coach login through `SUPABASE_SECRET_KEY`, without sending email. It uses fixture generation directly and makes no paid AI calls. Ordinary CI skips credentialed tests. Traces stay disabled. Existing M1 browser tests still mutate Demo Cedar; avoid running those against a season you are actively reviewing.

## Weekly planner (M4)

From **Season**, choose **Plan the next teaching week**, or open the accepted
roadmap, select a week card and choose **Plan this week**. Start manually from the
accepted emphasis or generate a weekly draft on demand. Choose one to three
objectives, observable checks and season-goal links. Save a weekly draft to resume
later; **Accept weekly plan** activates a new immutable weekly version. Detailed
timed drills and practice blocks arrive in M5.

Assign objectives to the accepted calendar slots. Editing an assignment marks it
as a coach override; **Keep these assignments when regenerating** preserves it.
Clear that option if you want a later generation to allocate priorities again.
A week with no practices stays empty. Competition appears alongside sessions;
no opponent name is needed. Use the calendar-review link to move a slot or record
an explicit outside-availability override. Blocking events still require a date
or event change in M3. Weekly generation never creates or moves practice dates.

Lock an objective to preserve its identity, goal link, teaching text and observable
check through regeneration. Save an unlock before editing that text. Past weeks
are read-only; past/completed session assignments and their objectives stay fixed.
Manual editing remains available without AI. While a generation is in progress,
the editor pauses local changes; another tab's edits invalidate late results.

Each weekly version links to the accepted roadmap used as its context. Roadmap or
settings changes cannot silently overwrite a week. Accept an up-to-date roadmap,
then choose **Refresh from accepted roadmap** and review the reconciled weekly
draft before accepting it. Earlier versions remain readable through Weekly history;
removed calendar slots never erase their historical assignments.

Apply migration 007 with `npm run db:migrate`. New tables use forced ownership
policies and tenant-safe foreign keys; versions are immutable to the runtime.
Generation shares the existing two-active-run and daily quotas with season drafts.
Refresh resumes a queued attempt; expired attempts report failure after five minutes.
Development action-argument logging is disabled to keep coaching text out of logs.

M4 tests use temporary synthetic fixtures. Run `tests/e2e/week.spec.ts` with a
fixture-mode server and `COACH_AI_PROVIDER=fixture` in the test environment;
the test skips otherwise to avoid accidental paid generation. The optional
`RUN_LIVE_WEEK_TEST=1` test uses the existing `.env.m2-test-budget` ledger and permits
one call with no paid retries. The original authorized ledger is now fully reserved;
never reset it to bypass a budget. See [M4 design](docs/M4-design.md) and
[M4 verification](docs/M4-verification.md).

## Review preferences and roadmap library

Dates default to **MM/DD/YYYY**. Open **Settings** in the header to save a date
format and coach display name, or follow **Edit coach & team profile** for the
existing profile and season fields. Native calendar pickers follow the browser's
locale; all displayed calendar dates use the saved preference.

Open **Season** to organize saved roadmaps and assessments. **Name & organize**
renames an item, assigns a folder (type to create one), or moves it to Archive or
Trash. Use the Show and Folder filters to find it later. Trash is recoverable:
choose Library in its details to restore it. It retains historical records and
is not permanent privacy deletion. Accept a replacement before moving the active
roadmap out of the library.

On a roadmap, review the phase and week cards before accepting. A week opens in
a dialog with Previous/Next week navigation and a Phase priorities tab. Closing
it or pressing Escape keeps edits and returns to the same place on the board.
The sticky Save/Accept bar saves those edits; closing a dialog alone does not
save them. Apply migration 008 before running this version.
