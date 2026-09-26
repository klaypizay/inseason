# Roadmap review UX design

Default displayed dates to MM/DD/YYYY, with persisted account preferences for
MM/DD/YYYY, DD/MM/YYYY or YYYY-MM-DD and an optional coach display name. A global
settings dialog links to the existing coach/team profile instead of duplicating
onboarding fields. Calendar input storage stays ISO; native date pickers retain
browser locale behavior. Format local dates without timezone conversion.

Week cards open an accessible modal editor with week/phase tabs, previous/next
week navigation, focus restoration and body scroll locking. Existing draft state
stays in the parent while the overlay closes. Save/accept controls remain visible;
only existing validated server actions persist content or accept the roadmap.

Roadmap names and folder labels belong to the generating artifact, so editing,
acceptance and recovery retain the same display identity across immutable plan
versions. Flat folders, archive and recoverable Trash organize saved artifacts.
Trash is a reversible library action, not privacy erasure. Active-roadmap artifacts
cannot be trashed. Trashing an inactive pending review restores the review pointer
to the active roadmap and cancels pending generation. Historical references remain
readable; trashed artifacts cannot start another review until restored.

Rafter secure-design: retain verified server-side sessions and ownership checks
at every mutation; preferences use account RLS, library metadata uses existing
program RLS. Bound and strictly validate labels, enum settings and expected
revisions. Serialize writes and reject stale metadata updates. SQL values remain
parameterized, labels are escaped React text, and folder names never become paths.
No new provider requests, dependencies, credentials or external sends. New account
preferences cascade on account deletion; library fields inherit program deletion.

Threats: forged IDs fail ownership/RLS checks; stale saves fail version checks;
labels cannot execute HTML or control SQL; Trash cannot silently disable an active
roadmap or remove accepted history. Existing deployment/privacy/coaching launch
gates remain. Verify two-coach access, active-plan protection, modal keyboard/scroll
behavior, persistence, dates and existing acceptance before Rafter remote review.

## Settings tabs and explicit folder controls

Reuse the existing version-checked setup editor inside the global Settings
popup, with Coach profile and Team tabs sharing one draft. Separate practices
and events in both entry points. Loading uses the authenticated repository;
saving keeps the existing setup validation, stale-version and active-plan guards.
Unsaved settings require an explicit discard before closing; tab switching keeps
edits. No secondary profile data store or new authentication mechanism.

Persist named, including empty, folders per account under forced RLS. Folder
names are bounded text, never paths. Existing labels are backfilled. Creating a
folder checks a per-account limit; rename/remove uses an expected revision and
the existing account advisory lock. Rename updates all owned item labels and
revisions atomically; removal unfiles items and never deletes roadmap content.
Library cards expose Delete and Restore using the existing protected Trash flow.

Boundaries: browser -> authenticated server action -> actor-scoped repository ->
Postgres RLS. Spoofed folder IDs fail ownership; stale rename/delete fails revision;
SQL is parameterized and rendered names are escaped. Competing item moves and
folder writes serialize. Folder deletion has explicit confirmation explaining
retained roadmaps. No new secrets, dependencies, network providers, AI requests,
or logs containing submitted data. Folder records cascade with account deletion.
Residual behavior: removing a folder is not recoverable as metadata, but its
roadmaps remain intact and can be refiled. Trash remains recoverable history,
not privacy erasure. Test foreign IDs, stale edits, empty-folder persistence,
rename/remove propagation, and both settings entry points.

## Bulk organization and planning orientation

Place visible folder cards above library items. Checkboxes support multiple
selection; a Move to folder control provides keyboard/touch access. Native desktop
drag uses the same action for one card or the selected cards. Drag payload text is
never parsed or trusted: only the component's current local selection can move.
Clear selection when filters change so hidden items cannot move accidentally.

Bulk movement accepts at most 200 unique item UUIDs with their observed revisions
and an owned target folder UUID/revision (or Unfiled). Authenticate with the existing
session, acquire the existing account lock, validate every owner and revision before
any update, then move all in one transaction. A stale or foreign item or renamed/
deleted target rejects the whole batch. Only folder labels and metadata revisions
change; status, acceptance, teaching content and current-plan pointers do not.
No new dependencies, schema, paid calls or outbound services. SQL is parameterized
and displayed names stay escaped. Test rollback, foreign targets/items, stale items,
stale targets, active-roadmap moves and desktop drag plus keyboard/touch movement.

Explain setup -> optional assessment -> roadmap draft -> review/accept -> weekly
planning. Assessment is advice, not an active plan or required prerequisite.
Acceptance means the coach chooses the plan for weekly planning, not AI validation.
Demo/synthetic is a data label, not a plan stage. Do not rename user-authored titles
or imply that sample data is real. Use separate artifact type, use status and demo
badges; a retained old accepted version is history, not the current active plan.

## Library ordering and views — September 18

User requested local iterations: defer GitHub pushes and remote Rafter scans until an explicit checkpoint. Continue local validation and manual security review.

Design: browser selections cross an authenticated Server Action into the existing session transaction and RLS repository. Strict UUID/revision arrays contain at most 200 unique records. Reordering validates the complete currently loaded season library and every revision under the existing account advisory lock before a parameterized atomic update. Foreign, omitted, duplicate, and stale records fail without writes. Only position/revision change; folders, content, acceptance, and history remain intact. New items appear first. No new secrets, dependencies, outbound fetches, or deletion. Browser drag payloads are ignored; only the internal selection is used. Edge scrolling ends on drop, drag end, blur, Escape, or unmount. View choice is local presentation state. STRIDE: session-derived identity and ownership/RLS prevent spoofing/elevation/disclosure; strict limits bound work; revision checks prevent tampering through stale requests; existing timestamps record writes. Residual: no additional audit history for presentation ordering; remote scan deliberately deferred by user.

Local review: `src/server/preferences/actions.ts:86` authenticates ordering through `withSession`; `src/server/db/preferences.ts:164` validates ownership, complete membership, and revisions before an atomic parameterized write; `src/domain/preferences.ts:107` reuses bounded strict unique-selection validation. Reading one item beyond the 200-item UI limit prevents partial-library reshuffling. `src/components/roadmap-library.tsx:197` cleans up drag scrolling listeners/animation and never parses external drag payloads. React escapes names; table roles/cells and labeled keyboard controls preserve access. Authentication/cookie/crypto/network/dependency configuration is unchanged; no new logging, secrets, deletion, or SSRF surface. No manual security findings remain. Automated remote scan deferred per user instruction.

## Reorderable folder sidebar — September 18

Extend the existing library design: folder ordering crosses the same authenticated action/session/RLS boundary. Strict input accepts 1–100 unique folder UUIDs with positive revisions; the complete owned folder set and every revision must match under the account advisory lock. One parameterized transaction updates only positions/revisions. Foreign, duplicate, missing, or stale folders cause no writes. Drag sources are internal refs, never external payloads. Folder drag and roadmap drag remain distinct, so reordering cannot accidentally move content. All items and Unfiled stay pinned; custom folders can be dragged or moved by labeled arrow buttons. Desktop uses a sticky scrollable sidebar with drag edge scrolling; smaller screens keep cards above the library. No new dependencies, secrets, external services, or data deletion. Abuse case: a forged folder ID cannot reorder another coach's library; tests cover isolation and atomic rejection. Remote scans and pushes remain deferred by user request.

Folder-order local review: `src/server/preferences/actions.ts:98` uses the existing session boundary; `src/server/db/preferences.ts:80` validates the full owned folder set and revisions under the account lock, then binds UUIDs and actor in SQL. `src/domain/preferences.ts:112` bounds and validates input. Migration 011 inherits existing folder RLS/grants. `src/components/roadmap-library.tsx` keeps folder and item drags separate, cleans up listeners, and exposes labeled arrow controls. Desktop layout uses a constrained scrollable sidebar; mobile uses normal document flow. No authentication, secrets, crypto, logging, dependency, outbound network, or deletion behavior changed. No manual findings; remote scan deferred at the user's request.

## Site-wide desktop navigation — September 18

Added a desktop-only navigation rail in the signed-in layout, reusing the existing Settings control. Static destinations are Today, Season & library, and Team setup; week and roadmap/draft detail routes highlight their parent section. Guest and mobile layouts retain their header. This iteration changes presentation and fixed links only: no new input handling, database mutation, authorization behavior, dependencies, or outbound requests. Local security surface check: no new security surface; no additional remote scan. Desktop library cards adapt to the space remaining beside both sidebars.

## Compact library presentation — September 18

User requested folders in normal flow above the library, compact List rows and spreadsheet-style Table cells, icon-only Edit/Delete controls, and grips without visible arrow buttons or Drag text. Existing edit/delete dialogs and server actions remain unchanged. Grips retain accessible names and arrow-key ordering. The global desktop navigation remains. Presentation-only security surface check: no new server inputs or authorization behavior; remote scans/pushes stay deferred.

## Fast planning flow and first practice — September 19

Goal: reduce the default path to roadmap review → next practice → ready-to-coach plan. The ten-minute target is an unverified usability goal. Keep advanced week forms, assessments, source explanations and history available behind disclosure controls. Navigation uses session-owned data to link to the current roadmap, next practice and saved library; GET requests never generate or accept plans.

Secure design (Rafter): practice detail is additive optional data inside existing immutable weekly snapshots. A strict bounded practice schema validates session ownership, exact total minutes, player/hoop planning limits, unique block IDs and preserved locked/past content. Generation intent contains only an owned session UUID and a 600-character revision brief. It uses the existing authenticated, quota-limited, idempotent generation pipeline, validates stale heads before publishing, and cannot activate a draft. Only coach acceptance does that. Stored practice outputs link to the accepted roadmap through the weekly version. Old snapshots without practice detail remain readable. Prompt text and previous content stay untrusted in the model's user context; no tools, arbitrary URLs, new dependencies, secrets or communication surfaces. Model resource claims are checked server-side, and unknown attendance remains a visible planning assumption. Existing account/RLS ownership and transaction locks apply. Print uses the browser's local print dialog. STRIDE: foreign session IDs, stale drafts, modified locked blocks, false duration totals, extra resources and malicious prompts cannot bypass application validation. Residual: teaching quality still requires coach review; no new paid calls are authorized for verification, so use synthetic provider tests and identify live verification as outstanding. This slice adds practice planning, not M5's separate player-goal workflow. Remote Rafter scans and GitHub pushes remain deferred per user direction.

Fast-planning local security review: `src/server/week/actions.ts` authenticates practice generation and run-status reads through the existing opaque session; `src/server/db/week.ts` binds input values, checks the selected session against the owned current week, enforces existing quotas/idempotency/stale-head checks, and limits snapshot/context size. Status reads expose only the owned run's state. `src/domain/practice.ts` checks exact duration, resource limits, unique IDs and protected content; schema normalization avoids JSONB key-order false positives. Generated revisions cannot unlock protected blocks. `src/domain/week.ts` keeps unrelated weekly objectives, assignments and other practices intact during a targeted revision. `src/server/ai/week-provider.ts` keeps the bounded brief in untrusted user context and uses the existing fixed OpenAI endpoint without tools. Strict output is validated before storage. Navigation and library reads remain owner-scoped; React escapes generated text and labels. No new credentials, dependencies, uploads, external destinations or deletion actions. A sequential status check replaces overlapping full-page refreshes. Source context stays accessible behind an explicit disclosure; opening a generated roadmap never accepts it. No unresolved local security findings. Remote scan and push deferred as requested.

The sidebar uses a minimal owner-scoped navigation query instead of loading full onboarding data on every page. The OpenAI wire schema requires an explicit nullable practice field without the local legacy default, consistent with [OpenAI SDK schema normalization](https://github.com/openai/openai-python/blob/main/src/openai/lib/_pydantic.py). An offline provider-contract test verifies all nested object fields are required, extra properties are rejected, defaults are absent, and the revision brief stays outside system instructions.

Verification: the full local suite passed 53 tests (7 opt-in live/integration tests skipped); the 19 weekly/practice/repository tests passed again after final contract and navigation changes. Type checking, lint and the production build passed. Desktop and phone browser flows passed roadmap review → direct practice shortcut → second scheduled practice → generation → popup edit/lock → acceptance → print → revision preserving the lock → library reopen. Print-media checks include setup instructions and hide navigation; a desktop PDF and desktop/mobile screenshots are under ignored `test-results/fast-planning-release/`. Existing roadmap edit/lock/date-preview/recovery and advanced weekly edit/accept/regenerate flows also passed on desktop and phone. Hosted fixtures and temporary Auth users were cleaned up. All AI verification used the free fixture provider or a mocked OpenAI response; no paid generation was run. The normal OpenAI development configuration was restored. Human usability timing and live generated-practice quality remain unverified.
