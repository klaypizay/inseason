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
