# Season Coach · Milestone 0

Foundation for an adult basketball coach's private workspace. Includes managed sign-in, immediate app-session revocation, a responsive Today shell, private PostgreSQL schema and tenant-scoped repository, synthetic fixtures, CI and a deterministic AI interface. No live AI, onboarding or planning workflows yet.

Original specifications remain unchanged in [`md files/`](md%20files/). See [M0 design](docs/M0-design.md) for security decisions and [verification](docs/M0-verification.md) for actual results and outstanding gates.

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

To run all 13 unit/database tests against the configured development project in PowerShell:

```powershell
$env:RUN_HOSTED_DB_TESTS = '1'
node --env-file=.env.local node_modules/vitest/vitest.mjs run
```

To run all eight browser tests with those credentials:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'msedge'
node --env-file=.env.local node_modules/@playwright/test/cli.js test --workers=1
```

The test runner normally starts its own app on port 3187. If you deliberately started this checkout's server there with `npm run dev -- --port 3187`, set `PLAYWRIGHT_REUSE_SERVER=1` in the test process to reuse it (also avoids Windows test-server teardown issues). The server needs network access to Supabase. CI runs synthetic local checks without live project credentials; hosted tests remain explicitly skipped there.

For the two-coach manual check: sign in separately as both seeded coaches; each Today page should show only its own team. Reload; sign out; the previous cookie must fail to reopen `/today`. Repository tests cover direct/nested ID and status mutations, which M0 intentionally does not expose as public editing routes.

## Boundaries and operations

- The `coach` schema must remain excluded from Supabase's exposed Data API schemas. There are no grants for `anon`/`authenticated`; browser JWTs cannot bypass application-session revocation.
- Managed Supabase authentication verifies credentials. Its temporary login session is revoked immediately, then an independent HttpOnly application session is issued for at most seven days, with 24-hour idle expiry. Sign-out deletes the app session server-side. A password reset/provider account freeze currently also requires an operator to delete that coach's `coach.sessions` rows; automated provider lifecycle integration is a pre-pilot requirement.
- Login quotas are shared through PostgreSQL (10 attempts/email and 100 total/15 minutes). Configure trusted-edge per-IP limits and provider abuse controls before public use. Expired session and old login-limit rows should be purged daily by an operator job; do not log row contents.
- Runtime credentials are intentionally least-privileged: read foundation records and update selected fields only. M1 must add new grants and policies with its migrations. Session and login-limit storage is server-only infrastructure, not tenant content accessible through the browser.
- AI fixture actions return typed Unknown drafts with no evidence or active-plan mutations. Action-specific generated plan schemas belong to M2–M7; these placeholders do not claim to be useful plans.
- No real youth data until the original privacy/vendor/retention/coaching and security launch gates are resolved. M0 does not implement privacy deletion or operational backups.

Next milestone: **M1 — coach/team onboarding and assessment inputs**.

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
