# Data Model and Security Design

Status: implementation baseline, with vendor and numeric operating defaults changeable. Behavior is defined in [MVP.md](MVP.md); scope and confidence semantics in [PRODUCT.md](PRODUCT.md).

## Relationships

```text
CoachAccount 1 ── N Program (one owner; initial UI exposes one)
Program 1 ── N Team 1 ── N Season
Season 1 ── N Phase 1 ── N Week 1 ── N WeeklyObjective
Season 1 ── N SeasonGoal
Week 1 ── N Practice 1 ── N PracticeBlock
Program 1 ── N Player
Season N ── N Player (SeasonRoster)
Practice N ── N Player (PracticeParticipant, optional)
Season 1 ── N Observation ── optional Practice / Player
Season 1 ── N DevelopmentGoal ── optional Player
Program / Team / Player ── N MemoryItem ── N EvidenceLink
Season 1 ── N PlanRevision / AdaptationProposal / GenerationRun
```

Players are not children of practices. A stable program-scoped player identity participates in seasons through roster records. A practice may reference rostered players, goals, and observations. No identities or memory are shared between different programs.

## Common rules

Use UUID identifiers; UTC timestamps for events; local dates and IANA timezone for schedules. All tenant-owned rows include `program_id`, created/updated timestamps, and actor attribution where applicable. Verify parent and child belong to the same program through composite foreign keys or equivalent database constraints, not only application code. Never accept ownership or role fields through mass assignment.

Use relational columns for searchable identity, status, dates, evidence, and links. Use schema-versioned JSON only for bounded generation payloads and immutable plan snapshots. Money, rankings, biometrics, and statistical-performance tables are absent.

## Records

| Record | Required / notable fields | Rules |
|---|---|---|
| CoachAccount | managed-auth user ID, guidance preference, experience, display name optional | Email and credentials stay in auth provider; do not duplicate unnecessarily |
| Program | owner account ID, name, settings, lifecycle state | Ownership is the MVP authorization rule; no invitations |
| Team | program ID, name, type, age band, skill summary, philosophy, facilities/equipment | Profile statements distinguish coach reports from suggestions |
| Player | program ID, display alias, optional jersey number, archived timestamp | No date of birth, contact information, address, medical record, or photo required |
| Season | team ID, title, start/end dates, timezone, week-start, status, current revision ID, context version | Status: setup/active/archived; one active per team enforced |
| SeasonRoster | season ID, player ID, availability note, participation status | Unique season/player; participation is available/limited/unavailable/unknown, not a diagnosis |
| Assessment | season ID, coach input, strengths/gaps/unknowns, assumptions, review status, source links, generation ID | Version rather than overwriting an accepted assessment |
| Phase | season ID, type, label, start/end dates, goals | Type: offseason/preseason/in_season/postseason; may repeat types with distinct dates |
| Week | season ID, phase ID, sequence, start/end dates | Nonoverlapping; boundary weeks may be shorter so each belongs to exactly one phase |
| SeasonGoal | season ID, description, observable success criteria, priority, status | Referenced by weekly objectives; completion is coach-confirmed |
| WeeklyObjective | week ID, season goal ID, description, success criteria, priority, locked | Goal must belong to same season |
| AvailabilityRule | season ID, weekday, local start time, duration, effective date range, resources | Exceptions override recurrence; expansion produces explicit practice dates |
| CalendarEvent | season ID, type, start/end local date/time, availability impact, title | Game/tournament/unavailable; opponent name optional display text only |
| Practice | week ID, date/time, duration minutes, kind, status, resources, version, locked | Kind team/individual; status draft/scheduled/completed/canceled; no implicit daily session |
| PracticeBlock | practice ID, order, minutes, title, setup, cues, progression/regression, observation prompt, locked | Positive integer minutes; sum exactly equals practice duration; parallel stations share one block |
| BlockObjective / BlockGoal | block ID, weekly objective ID or development goal ID | Explicit junctions; no model-supplied arbitrary polymorphic IDs |
| PracticeParticipant | practice ID, season roster ID, planned availability, optional actual attendance | Do not infer attendance from roster or plan generation |
| Observation | season ID, optional practice/player ID, event date, coach text, category, revision, state | Active/corrected/retracted; text is a reported observation, not an independently verified fact |
| DevelopmentGoal | season ID, optional player ID, behavior, teaching step, success criteria, review date, status | Player null means team goal; suggested/active/achieved/paused/archived; evidence links required for evidence-based rationale |
| MemoryItem | scope type + matching scope FK, claim, confidence, review state, observed range, review-after, conflict marker | Exactly one of program/team/player; proposed/accepted/rejected/superseded/stale; Known/Likely/Unknown |
| EvidenceLink | target memory/goal/proposal ID, source observation/profile revision/assessment/goal-review ID, relation | Typed FKs/junctions; relation supports/contradicts; source must be same program |
| GoalReview | goal ID, date, coach report, status decision, source links | Historical evidence for progress; AI cannot mark achieved alone |
| PlanRevision | season ID, number, parent revision, schema version, snapshot, actor, reason, generation ID | Immutable accepted snapshot; current pointer updated transactionally |
| AdaptationProposal | season ID, base revision, base context version, scope dates, typed changes, explanation, evidence, status | pending/accepted/rejected/stale; no unrestricted JSON patch or SQL from model |
| GenerationRun | program/season ID, action, idempotency key, input context version/hash, model/prompt/schema version, status, usage, error code | queued/running/succeeded/failed; keep sensitive prompt bodies out of operational logs |
| AuditEvent | program ID, actor ID, action, resource type/ID, timestamp, request ID | Metadata only; app cannot edit existing audit events |
| DeletionJob | program ID, target type/ID, requested by/time, purge status, completion time | Needed to retry and prove deletion; no copies of deleted content |

Profile revisions and calendar/settings changes increment the season context version when they affect planning. Source text corrections retain a restricted revision history for recovery during normal use, but privacy deletion purges all revisions. Store field-level source attribution for structured assessments; do not treat an entire generated paragraph as Known merely because one sentence was supplied by the coach.

## Scheduling and plan integrity

- Phases cover the selected season range without overlap; skipped phases have no row. Weeks subdivide phases. The UI explains short boundary weeks.
- Recurrence expansion is deterministic and idempotent. Explicit event exceptions prevent duplicate sessions. Every practice belongs to a season through its week.
- Stable content IDs survive date moves. Moving a practice across phase/week boundaries updates its week after preview and validation.
- Accepted snapshots contain phase/week/objective/practice/block content and IDs. Mutable tables are the working projection; every accepted batch creates a revision and updates the projection in the same transaction.
- Completed practice versions and their actual check-in data remain immutable except explicit coach correction with audit history. A proposed future revision may reference them but cannot edit them.
- Accept a proposal only if both base revision and context version still match. Transaction: authorize → verify versions → validate typed changes/locks/dates/durations → write projection and revision → set proposal accepted → audit. An already accepted proposal returns its existing result.
- Reverting creates a new revision; never delete intervening history. Calendar events and observations are independently versioned source data, not restored when a plan is reverted.

## Context and memory pipeline

1. Resolve authenticated ownership and season; select only that program's records.
2. Load current profile, accepted roadmap/weekly objectives, requested practice constraints, active goals, relevant recent observations, accepted current memory, and nearby events.
3. Bound context deterministically: prioritize explicit constraints, current goals and recent relevant evidence; cap tokens and show omitted context counts internally. Do not silently omit required constraints to fit a prompt.
4. Include older supporting and contradictory evidence for any selected memory item, even when it falls outside the default recent window (proposed: 30 days).
5. Pass player aliases instead of full names and only fields needed for the action. The model returns structured drafts with allowed record IDs and source links.
6. Validate identity, evidence, confidence policy, dates, feasibility, and output shape. Persist a proposal, never an autonomous active-plan mutation.

Default review-after for inferred player/team patterns: 30 days; configurable after pilot. Freshness is not an automatic claim that a fact became false. Stale memory is excluded from asserted current context and may be shown as a historical question. Correcting/retracting/deleting a source invalidates dependent summaries and pending proposals. Recompute from remaining evidence; do not merely remove a citation while retaining the same claim. Rejected suggestions do not feed subsequent generations as accepted knowledge.

Program memory stores coach-approved philosophy, terminology, and season lessons. Player memory stays scoped to its program and dated season evidence. At rollover, coach selects returning players and explicitly approves carry-forward candidates; copies reference original evidence and receive a fresh review date. No vector store is needed in MVP.

## Security design decisions — Rafter secure-design review

This is a design-stage review using authentication, data-storage, and threat-modeling guidance. No application code or dependencies are delivered in this package; implementation still requires its own security review and scan.

### Identity, authorization, and boundaries

Proposed primitive: managed Supabase authentication, provider-supported server-side session handling, and owner-based authorization. Do not build password storage or token verification. Use verified identities, secure HttpOnly SameSite cookies where supported by the selected integration, origin/CSRF protection for mutations, and no credentials in client logs. If OAuth is enabled, use the provider-supported authorization-code/PKCE flow. Pin and verify the current supported integration in M0.

App policy: a verified coach can access a resource only when its program owner equals that coach's account ID. Resolve ownership from trusted session plus database, never a submitted program ID alone. Enforce in domain services and PostgreSQL row-level policies; run ordinary app queries with the caller's scoped identity. Keep privileged migration/service credentials out of request paths. The AI has no independent identity or direct database tools; generation is attributed to the invoking coach and run ID.

Proposed app-session limits: 24-hour idle, 7-day absolute; require fresh authentication within 10 minutes for account/program deletion. Enforce app-session revocation immediately through a server-side session record checked on each request; also revoke provider refresh sessions at logout/deletion. Provider access-token revocation can lag until expiry, so direct client database access must not bypass the app-session check. Provider MFA for operators; coach MFA may follow after pilot. There is no support impersonation or public sharing.

Data flow: browser sends bounded forms to application over TLS; app verifies session and ownership; app accesses tenant-scoped PostgreSQL; app sends minimized context to an approved LLM endpoint; returned data is validated and saved as a draft; explicit coach acceptance commits it. The browser, database credentials, provider, and deployment control plane are separate trust boundaries. No arbitrary outbound URLs, file uploads, or externally fetched note links in MVP.

### Classification, retention, and operations

| Class | Examples | Proposed policy |
|---|---|---|
| Identifiers / personal data | Coach auth ID/email, player alias, roster | Keep while account/program is active; purge on deletion |
| User content | Profiles, observations, goals, plans | Persist across seasons until deletion; annual review prompt; no indefinite hidden archive |
| Derived sensitive content | Memory, snapshots, generated drafts | Same protection/deletion scope as sources; rejected drafts purge after 30 days |
| Credentials / secrets | Provider keys, DB credentials, session tokens | Managed auth / deployment secret store only; revoke/rotate after incident or ownership changes |
| Operational metadata | Run status, token counts, redacted errors | 30 days; exclude prompts, note bodies, aliases, and tokens |
| Audit metadata | Actor/action/resource/time | 90 days; remove direct identity links on account purge where feasible |
| Backups | Encrypted database recovery copies | Maximum 30-day expiry; delete from live use immediately and prevent deleted data returning after restore |

Deletion: disable access immediately, cancel running generations, purge live target records and dependent text/snapshots/memory within 7 days, and record completion metadata. Program deletion removes all tenant content. Player/source deletion invalidates or purges any derived payload containing that material, including old plan snapshots; privacy deletion takes precedence over immutable history. Backup restoration must replay a restricted deletion ledger before serving traffic; ledger expires after all affected backups expire. Archive is not deletion.

Require TLS with certificate validation; use managed disk encryption, not custom cryptography. Vendor-managed encryption keys are acceptable for synthetic development. Before a real-data pilot, document the actual host, key owner, automated rotation policy, secret distribution, independently controlled encrypted backups, and provider retention settings; the prototype is not authorized to assume these controls exist. Prefer a deployment secret manager; local untracked development secrets use placeholders in examples. Test emergency rotation, generation disablement, account/session freeze, and restore/deletion replay before launch. No secondary search cache or external session replay in MVP.

### Threat-model findings and required controls

| Boundary/store | Threats and consequences | Controls / verification |
|---|---|---|
| Browser → app | Spoofed session, ID swapping, CSRF, stored script, flooding | Verified/revocable sessions; owner checks; origin checks; escaped text; bounded strings/arrays; per-account/IP limits; negative two-tenant tests |
| App → database | Cross-tenant joins, tampered content, repudiation, bulk leak | Row policies plus composite tenant FKs; parameterized queries; least privilege; transactional revisions; append-only audit permissions; restore test |
| App → LLM | Prompt injection, context disclosure, invented evidence, cost exhaustion | Fixed provider allowlist; minimized authorized context; model has no tools; strict output validation; coach review; quotas/timeouts; injection/source-ID tests |
| Stored plans/memory | Poisoned inference, stale claims, deleted content surviving in summaries | Provenance; confidence policy; source invalidation; conflict visibility; reviewed carry-forward; deletion dependency traversal |
| Deployment/backups/logs | Stolen secrets, operator escalation, undetected edits, restore leakage | Separate operator access with MFA; secret manager; redacted logs; independently controlled backups; audit export for production; deletion replay |

Abuse twins: onboarding can mass-create accounts (rate limits); generating a plan can exhaust paid API budget (per-program quotas); guessing a player ID can expose another roster (ownership and FK checks); check-in text can try to override model instructions (data-only input and no model tools); adaptation acceptance can replay an old write (idempotency and version checks); deletion can target another program (fresh auth and ownership); rollover can launder old evidence into current fact (explicit review and preserved source dates).

Residual risks: an authorized coach can enter false information; alias-based player content can still identify a child; model advice can be unsuitable despite validation; a fully compromised application runtime may expose content it is authorized to process. Mitigate through attribution, minimization, coaching review, isolated credentials, and incident controls. These are proposed pilot risks for product-owner review, not a declaration of acceptance. Launch gates: vendor/privacy decisions above, operational runbooks, independent coaching review, negative authorization tests, and implementation Rafter review/scan.
