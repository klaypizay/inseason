# Review UX security review

Scope: account preferences, roadmap metadata and recoverable Trash, and client
review dialogs. Rafter secure-design was applied before implementation; the
Rafter web-app checklist was applied to the completed surface.

- A01 access control: `src/server/preferences/actions.ts:20,31,42` resolves the
  session for every operation. `src/server/db/preferences.ts:50` scopes library
  lookup to the owning account; migration 008 forces account RLS on preferences.
  Existing generation RLS continues to apply. Foreign read/write tests pass.
- A02 crypto: no new cryptography or credential handling. Preferences include no
  credentials. Existing opaque authenticated sessions and transport remain.
  Source-only secret scan and remote result recorded after verification.
- A03 injection: strict bounded schemas precede writes (`preferences.ts:25,67`);
  every value is a bound SQL parameter. Names/folders render as React text, never
  raw HTML. No new shell, deserialization, or file-path surface.
- A04 design: advisory account locks plus expected revisions prevent lost writes.
  Active-roadmap removal is rejected (`preferences.ts:74`). Trash resets a pending
  review and cancels queued/running generation; generation completion already
  checks running status under the same account lock. Historical recovery and
  acceptance require restoration first (`roadmap.ts:178,338,480`).
- A05 configuration: no new public API, debug output, or security-header change.
  Safe action errors omit database details and submitted content.
- A06 dependencies: no dependencies changed; remote SCA remains required.
- A07 authentication: existing session validation is reused; no new login flow.
- A08 integrity: strict field allowlists and immutable plan versions remain;
  organization metadata belongs to the generation across its versions.
- A09 logging: no user content, secrets, or request body logging added.
- A10 SSRF: no outbound endpoint or URL accepted by this feature.

Trash deliberately retains history; it is not a permanent-data-deletion feature.
No paid AI calls are needed for this change.

## Verification results

- Migration 008 applied to the development database.
- 47 local tests passed; 7 credentialed/live tests skipped in the ordinary suite.
  New checks cover account isolation, stale writes, invalid date preferences,
  date-only formatting, foreign roadmap access, active-roadmap protection,
  Trash review-pointer reset, recovery rejection and restoration.
- Typecheck, lint, formatting and production build passed. GitHub CI also passed
  for implementation commit 616c46c; final scroll change is ae14e18.
- Desktop and mobile settings/library browser flows passed: date preference and
  display name survive reload, names and folders persist, folder filtering works,
  drafts move to Trash and restore successfully.
- Desktop and mobile roadmap browser flows passed after explicit scroll
  restoration: popup editing, previous/next navigation, Escape/focus return,
  unchanged board scroll, retained unsaved text, save/reload, accept, locks,
  calendar shift and historical recovery.
- Screenshots visually reviewed on desktop and mobile. Restarted dev server
  verified with agent-browser; login loaded with no browser errors.
- Source-only Rafter secret scan: no findings. Existing local environment files
  were excluded. No new dependencies or paid AI calls.
- Final source commit ae14e18 passed GitHub CI run 35398971197.
- Rafter standard scan `96c801f2-daee-43f9-ba16-a382ddf44e7c` completed:
  **0 errors, 2 warnings**. Both warnings are the existing placeholder credential
  URL patterns in `.env.example:4–5`, not real credentials or new feature findings.
  The manual review found no additional security issue in the changed surface.

## Settings tabs and folder manager follow-up

Rafter web-app review of the follow-up surface:

- A01/A07: both new actions resolve the authenticated session
  (`src/server/preferences/actions.ts:51,62`). Folder reads and writes explicitly
  scope `account_id` and migration 009 forces account RLS. Foreign folder IDs are
  rejected; no caller-supplied account identity is accepted.
- A02/A05: no new credentials, cryptography, debug logging, transport or security
  configuration. Native folder IDs use the database UUID generator.
- A03: strict discriminated schemas bound folder labels and revisions; repository
  SQL binds all values. Labels stay escaped React text and never become paths.
- A04/A08: account advisory locks serialize item moves and folder changes;
  revisions reject stale destructive metadata operations. Folder removal unfiles
  owned items and increments their metadata revisions without deleting plans.
  Empty folders persist and a 100-folder cap bounds new storage. Existing setup
  saves retain their context-version guard in both UI entry points.
- A06/A09/A10: no dependency, logging or outbound network surface added.

Migration 009 backfills existing labels. Folder and settings tests use isolated
synthetic accounts. Existing application secrets and real roadmap data are not
used as browser test inputs. Final verification results follow below.

Follow-up verification:

- Migration 009 applied successfully; existing folder labels preserved.
- 48 local tests passed, with 7 credentialed/live checks skipped in the ordinary
  suite. New tests exercise empty-folder persistence, duplicate creation,
  cross-account rejection, stale revisions, duplicate rename rejection,
  item revision propagation and lossless folder removal.
- Typecheck, lint, formatting and production build passed.
- Desktop and mobile browser flows passed after the final layout update:
  Coach/Team tabs retain unsaved edits, closing warns before discard, saving is
  visible on the original setup page, practice/events are separate in both entry
  points, empty folders survive reload, rename updates item placement, explicit
  Delete/Restore works, and removing a folder leaves its roadmap visible.
- Coach/Team dialogs and library screenshots inspected; no horizontal dialog
  overflow on either tested viewport. Restarted app checked with agent-browser.
- Source-only secrets scan returned no findings. No paid AI calls were made.
- Source commit 554073c passed GitHub CI run 35400256905.
- Rafter standard scan `b1c8a78c-abdf-4013-a852-cc1c00cc9fca` completed with
  **0 errors and 2 existing warnings**, both placeholder database URLs in
  `.env.example:4–5`. No new security findings were reported.
