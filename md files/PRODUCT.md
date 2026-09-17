# Season Coach — Product Specification

Status: proposed MVP baseline, 2026-09-15. Working name: **Season Coach** (changeable).

## Purpose

Help first-time and inexperienced basketball coaches answer: “What should I teach now, what comes next, and how should I adjust when my team struggles?” Turn the coach's team context, available time, and observations into a coherent season-long development plan.

Promise: **Coach like you've already coached a season.** The product organizes the coach's evidence and explains teaching decisions. It does not pretend to observe players independently.

Read this package in order: [PRODUCT.md](PRODUCT.md), [MVP.md](MVP.md), [DATA_MODEL.md](DATA_MODEL.md), [AGENTS.md](AGENTS.md). PRODUCT owns purpose and boundaries; MVP owns behavior and acceptance; DATA_MODEL owns persistence and invariants; AGENTS owns implementation practices. Resolve contradictions explicitly before implementing the affected feature.

## Primary users and jobs

| User | Situation | Job |
|---|---|---|
| First-time / inexperienced coach | Limited teaching experience; uncertain about sequencing and season workload | Give me a practical roadmap, explain what to teach, and prevent me from installing too much |
| AAU coach | Irregular practices, tournament clusters, changing availability, often unknown opponents | Make my team better within the practice time we actually have |

Experienced coaches may use the same workflow with less explanatory text. Do not build a separate advanced product in MVP. The account holder is an adult coach; players and parents have no accounts. Initial product scope is youth and school-age basketball, with age-appropriate recommendations driven by the coach's selected age band and level.

## The core loop

Coach Onboarding → Team + Coach Profile → Season Assessment → Season Roadmap → Weekly Objectives → Practice Plans → Coach Observations → Team/Player Memory → Adapt Season Plan → revised Weekly Objectives and Practice Plans.

The first successful session: a coach describes a team and calendar, reviews an assessment, and gets a credible roadmap, first week, and first practice in roughly ten minutes. This is a usability target, not a guaranteed generation time.

The return session: the coach records what happened, reviews what the system learned, and accepts or edits a small, explained adjustment to upcoming work.

## Product principles

1. **Sequence learning.** Connect every practice priority to a weekly objective and a season goal. Fundamentals and simple concepts precede complex installations when assessment supports that sequence.
2. **Use real constraints.** Respect time, player count, court space, equipment, coach availability, games, and tournament weekends. Explain when constraints make a request infeasible.
3. **Teach the coach.** Explain setup, teaching cues, likely mistakes, simpler progressions, and why a drill belongs today. Expand basketball abbreviations on first use.
4. **Keep the coach in control.** Generated plans and inferred memory are drafts. Accepting a proposal is the only way it changes the active plan. Manual edits and locked content survive regeneration.
5. **Remember with evidence.** Every claim about this team or a player has a source and confidence. Missing evidence stays missing; it never becomes a fabricated assessment.
6. **Prefer small adjustments.** Default to revising the next two weeks. Propose a broader roadmap change only when a calendar change or repeated evidence warrants it.
7. **Preserve history.** Completed practices describe what was planned and what occurred. Replanning never rewrites that history.

## Season scope

Support offseason, preseason, in-season, and postseason as configurable dated phases. Not every season needs every phase; allow skipped phases and seasons started midstream. A phase may contain named teaching blocks without adding another mandatory hierarchy.

- Offseason: individual skill priorities, small-group development, and optional coach-approved independent work appropriate to the age group.
- Preseason: assessment, standards, foundational team concepts, and a manageable initial system.
- In-season: maintain skills, address observations, and account for competition and limited practice time.
- Postseason: review goals and evidence; record lessons; propose next-cycle individual goals and program carry-forward notes.

These are planning intentions, not mandatory basketball prescriptions. Adapt sequencing to the team's needs. No opponent information is required.

## MVP boundary

Included: adult coach sign-in; one active team and season per coach in the initial UI; minimal roster; team/coach profile; assessment; dated phases; manual games/tournaments and practice availability; season roadmap; weekly objectives; timed practice plans; qualitative player goals; post-practice notes; evidence-backed memory; reviewed adaptation; archival and explicit next-season carry-forward. The data model supports successive seasons and more teams later without exposing a multi-team management product now.

Explicitly excluded:

- Film AI, video upload/analysis, computer vision, automated player tracking.
- Advanced quantitative analytics, efficiency metrics, predictive rankings, automated box scores, or small-sample talent judgments.
- Opponent scouting as a core requirement; no opponent database or scouting workflow.
- Recruiting, eligibility management, roster selection, and automated playing-time decisions.
- Parent/player communications, messaging, notifications, shared calendars, or external sending.
- Multi-agent organizations, Paperclip orchestration, autonomous agents, and agent-to-agent delegation.
- Billing, public sharing, assistant-coach collaboration, native mobile apps, wearable integrations, and external calendar sync.
- Large searchable drill/video libraries. A small reviewed seed set and structured drill descriptions are enough.

If a feature does not improve the core loop, defer it unless the product owner explicitly changes scope.

## AI contract

Use one coaching intelligence service with structured actions: assess season, draft roadmap, draft week, draft practice, propose memory updates, and propose adaptation. Separate prompts may serve those actions; they are not separate agents. The application, not the model, controls retrieval, authorization, validation, and persistence.

### Confidence is about evidence, not certainty

| Label | Meaning | Example | Display rule |
|---|---|---|---|
| Known | Directly recorded or reported, with provenance | “Coach reported that four players missed Tuesday's practice” | Attribute the source and date; a report is not independently verified truth |
| Likely | Supported inference from relevant observations | “Weak-side positioning may need reinforcement” | Show evidence, explanation, limitations, and any conflicting observations |
| Unknown | Missing, stale, contradictory, or insufficient evidence | “We do not yet know how this player handles pressure consistently” | Ask a focused question or suggest what to observe; avoid a definitive trait claim |

Confidence is separate from proposal status: a Known coach report can be saved immediately as a report; an AI-generated memory interpretation still requires review. Never promote Likely to Known because the same summary was repeated. Default for a recurring-pattern inference: at least two distinct dated observation events, relevant to the same context, without unresolved material contradiction. This is a product heuristic, not statistical validation. A single event may support a narrowly attributed Known event, not a stable player trait.

General drill suggestions are recommendations, not team facts. Clearly label assumptions used to generate them. If a critical input such as practice duration or available players is unknown, obtain it or show a visible editable planning assumption before generation; do not bury it in prose.

### Guardrails

- Never invent observations, attendance, scores, physical characteristics, diagnoses, or player improvement. Do not infer ability from gender, race, body type, or limited playing time.
- Use respectful, behavior-specific language. Describe teachable actions; avoid permanent labels such as “lazy,” “low IQ,” or “uncoachable.”
- Do not provide injury diagnosis, rehabilitation, return-to-play clearance, weight-loss programs, or punishment-based conditioning. Honor coach-entered participation limits without requesting medical detail. If participation is unclear, flag it for the coach and avoid assigning that player physical work pending clarification.
- Do not promise wins or claim a plan is optimal. Explain tradeoffs and avoid excessive tactical complexity.
- Treat notes and model output as untrusted content, never as instructions to change system rules, access another team, or execute tools.
- Show “Why this plan?” with objectives, source observations, assumptions, and confidence. Evidence links must resolve to authorized records; fabricated source IDs fail validation.
- An AI outage must leave existing plans readable and manually editable. An invalid generation must never replace valid content.

## Success measures and pilot

Proposed targets, to validate in a small pilot rather than market claims:

- At least 80% of 8–12 pilot coaches complete onboarding through first accepted practice without facilitator intervention; median completion time at most 10 minutes.
- At least 75% rate the first practice usable with minor edits or fewer, on a four-level rubric: unusable / major edits / minor edits / ready.
- At least 60% record two check-ins and accept or intentionally reject an adaptation within their first two active weeks.
- All release fixtures satisfy practice duration, resource constraints, evidence validity, and tenant isolation. Zero silent overwrites of completed or locked content.
- Track generation latency, failure rate, and cost per completed loop using metadata only. Proposed budget: configurable per-coach quotas and a measured cost target chosen after M2; no unverified pricing assumption.

These measure planning usefulness and trust, not player outcomes. Collect pilot feedback on confusion, unsupported claims, excessive complexity, and harmful suggestions.

## Changeable technical assumptions

Default: responsive TypeScript web app, Next.js, PostgreSQL through Supabase, managed Supabase authentication, schema validation with Zod, one server-side LLM provider adapter, and Vitest/Playwright for meaningful verification. These are proposed implementation choices, not a claim that particular versions or vendor terms have been checked. Pin supported versions and verify current official documentation at implementation time.

Prefer a modular monolith, relational evidence retrieval, and ordinary database-backed generation records. No vector database, microservices, agent framework, or job platform until an observed need justifies it. A generation worker may be added if the chosen hosting request limits require it.

Open pilot decisions: final product name, launch geography, age bands, reviewed drill content, hosting/vendor data-retention configuration, and operating budget. These do not block a synthetic-data prototype. Resolve privacy jurisdiction, coach authority to enter youth data, provider terms, and retention commitments before using real player data in a public pilot. This package is a product/security design, not a legal compliance determination.
