# M4 design — weekly planner

## Scope

Detail an accepted roadmap week on demand with one to three teaching objectives,
observable success criteria and links to its season goals. Allocate objectives to
existing eligible practice slots. Coaches can change allocation, edit, lock,
save and explicitly accept. Zero-practice weeks retain objectives for observation
without fabricated sessions. Date/time overrides use M3 calendar review and its
explicit reason requirement; M4 never creates or moves sessions.

## Security and persistence decisions (Rafter secure-design)

Browser → verified app session → owner-scoped repository → PostgreSQL; authorized,
minimized context → fixed OpenAI endpoint → strict output validation → draft.
Existing Supabase auth and revocable opaque app cookies stay unchanged. Every
weekly operation resolves ownership server-side; UUIDs are identifiers, not proof
of access. Next server actions keep origin protection and validate all input.

Weekly versions are immutable bounded snapshots with separate accepted/review
heads per week. Relational objectives retain the roadmap version and same-season
goal links; objective joins use tenant/season/week foreign keys. Session links enforce tenant/season at the database boundary and week membership on each write; this lets M3 explicitly reassign a session while retaining historical weekly allocations. All new tables
force RLS and deny provider API roles. Runtime cannot update version snapshots.
Program deletion cascades through weekly versions, projections and generation
contexts. No player aliases, credentials or medical details are newly collected.
Stored coaching text and generated derivatives inherit the existing content
classification, deletion policy and unresolved real-data launch gates.

Serialized actor/season writes compare expected weekly head, accepted roadmap ID
and setup context version. Generation additionally compares these again on finish;
late output cannot overwrite manual edits. Persisted runs have leases, shared
per-program concurrency and daily quotas, bounded retries and metadata only errors.
Refresh resumes queued attempts or displays failure without losing saved content.

Locks preserve objective identity, goal link and teaching text through regeneration.
Unlocking requires its own saved review before editing locked text. Coach-edited session assignments carry an explicit manual flag and survive generation; coaches can release that flag for later regeneration. Past weeks are
read-only; allocations for past/completed sessions and their referenced objectives
stay protected. Changed roadmap context requires an explicit refreshed weekly draft
before acceptance; prior accepted weekly versions remain readable.

Model output cannot create dates, sessions, IDs, locks or external links. It selects
only authorized goal IDs and supplied objective slots/session IDs. React escapes all
text. Prompts label coach data untrusted, prohibit unsupported player claims, and
grant no tools. Limits: 3 objectives, 32 session allocations, 600 chars per text,
48 KB provider input and 256 KB response. No new dependencies or hosts.

STRIDE: owner checks/RLS prevent spoofed tenant access; immutable versions and
optimistic checks prevent tampering; actor/request metadata attributes acceptance;
minimized context and redacted errors limit disclosure; quotas/leases/size limits
bound denial of service; server-owned IDs and allowlisted fields prevent privilege
escalation. Synthetic tests cover foreign IDs, stale results, locks, zero-practice
and competition weeks, refresh, duplicate writes, deletion and outages.
