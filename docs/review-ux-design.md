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
