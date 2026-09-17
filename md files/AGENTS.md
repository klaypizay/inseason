# Codex Engineering Instructions — Season Coach

## Start here

Read PRODUCT.md, MVP.md, and DATA_MODEL.md before changing code. Implement the requested milestone only. If none is specified, begin M0 and report its result before moving to M1. The purpose is to help inexperienced and AAU coaches plan, observe, remember, and adapt. Do not expand scope into scouting, film, analytics, recruiting, communications, billing, or multi-agent orchestration.

These are project instructions for the future application repository. When copying this package into an existing repository, merge these instructions with its AGENTS.md; preserve existing security requirements and surface conflicts rather than overwriting them. Current explicit user instructions take precedence over this baseline.

## Working defaults (changeable with a recorded reason)

- TypeScript with strict mode, Next.js responsive web UI, PostgreSQL/Supabase, managed authentication, Zod schemas, Vitest unit/integration tests and Playwright critical-flow tests.
- Modular monolith with domain boundaries for identity, season/calendar, planning, observations/memory, and AI generation. Keep authorization and domain rules out of UI components.
- One provider-neutral coaching service. Actions are typed functions, not autonomous agents. No Paperclip, agent framework, vector database, or microservices in MVP.
- Suggested structure: `src/app`, `src/domain`, `src/server/auth`, `src/server/db`, `src/server/ai`, `src/components`, `tests`, and versioned database migrations. Adapt to an existing repository's conventions.
- Verify supported dependency versions, APIs, and provider behavior against current official documentation during implementation. Pin versions and commit the package-manager lockfile. Do not treat this spec as current vendor documentation.

## Engineering contracts

1. Validate every mutation server-side. Derive user identity from verified sessions and resource ownership from the database. Never trust client-provided actor/owner/program fields.
2. Every tenant query and relationship is scoped to a program. Test foreign IDs at direct record, nested record, generation status, and evidence-link entry points. Use database row policies and tenant-safe foreign keys as defense in depth.
3. Keep schedule arithmetic deterministic and separate from generation. The model proposes teaching content; code enforces time totals, dates, roster/resource constraints, locks, and version matching.
4. Persist sources independently from interpretations. Use exact Known/Likely/Unknown semantics from PRODUCT. Evidence links are mandatory for team/player claims and validated against the authorized context.
5. Only coach acceptance promotes a draft to active content. An observation is saved immediately as an attributed report; its interpretation and adaptation remain proposals. No model-generated database commands or arbitrary patch paths.
6. Accepted changes are transactional and idempotent. Compare plan and context versions, preserve locks/completed content, and fail stale writes with a useful conflict message.
7. Separate planned participation from actual attendance; generated goals from achieved goals; Unknown from a low skill rating; archival from deletion.
8. Treat notes, retrieved content, and model responses as untrusted. Escape text, bound payload sizes, prohibit arbitrary URL fetching, and never grant the model shell/database/network tools.
9. Use synthetic aliases in seeds/tests. No real player data, API keys, prompts containing personal data, or credentials in source control, screenshots, logs, analytics, or error messages.
10. Implement privacy deletion across sources, summaries, snapshots, pending generation, and backups. Privacy purge overrides immutable-history conventions. Do not claim deletion complete after a soft-delete alone.

## AI service contract

Actions: `assessSeason`, `draftRoadmap`, `draftWeek`, `draftPractice`, `proposeMemory`, `proposeAdaptation`. Each takes an authorized context object, schema version, and idempotency key and returns a typed draft plus generation metadata. It must not mutate active plans.

Build a deterministic fake provider before live calls. Use structured outputs where supported, but always validate on the server. Store model, prompt, and schema version alongside usage metadata so failures can be reproduced with synthetic fixtures. Reject invented source IDs, unknown players, missing required constraints, and invalid durations.

Initial operating defaults (configuration, not hard-coded product rules): 60-second provider timeout; at most one retry for transient errors; at most one schema-repair attempt within a maximum of three total provider calls per generation; maximum two active generations per program; daily generation quota configurable, default 30 for a pilot. Do not retry authorization failures or exceed quota through retries. Increase limits only after measuring actual behavior. Existing plans stay available on timeout. If hosting limits require background processing, use a bounded database-backed job with cancellation and ownership checks before adding infrastructure.

Prompt structure: role and coaching rules; allowed action and output schema; explicit constraints; delimited untrusted coach content/evidence; task. System rules never come from stored notes. Recheck authorization and source/context validity before persisting a late response, especially after deletion or edits.

## UI and accessibility

Optimize for a coach on a phone in a gym: clear next action, short labels, large touch targets, readable practice timelines, and fast check-ins. Use plain language; explain basketball jargon. Keyboard navigation, visible focus, accessible labels, contrast, and error announcements are required. Confidence uses text as well as color. Do not expose model/provider/prompt implementation details in ordinary coaching flows.

Every flow needs loading, empty, error, retry, and saved states. Show assumptions and explanation near the plan, with detail expandable. Never render a failed generation as a successful blank plan. Manual edits must survive navigation and refresh once saved. Print styling must keep block text readable without clipped content.

## Milestone workflow

1. Inspect the repository and applicable instructions; identify the requested M0–M7 stage and its dependencies.
2. State the concrete deliverable and any material assumption. Implement the smallest complete vertical slice satisfying that stage; do not ask about routine reversible choices already covered here.
3. Before security-sensitive implementation, follow the Rafter gate below. Record changed architectural decisions and remaining launch gates in the relevant spec or PR.
4. Make scoped changes, migrations, and meaningful tests. Preserve unrelated user changes. Do not add dependencies merely to shorten a small helper.
5. Run the stage's acceptance scenarios and relevant regression checks. Explain failures; do not claim a check ran when unavailable.
6. Report what works, how it was verified, remaining risks/blockers, and the next milestone. Keep completion claims scoped to the delivered stage.

## Verification strategy

- Unit tests: schedule expansion/date shifts, phase boundaries, minute totals, feasibility and lock conflicts, confidence/pattern rules, stale-memory selection, and typed adaptation validation.
- Database integration tests: ownership/row policies, tenant-safe joins, duplicate request handling, concurrent acceptance, source invalidation, and deletion cascades across derived content.
- End-to-end tests: setup → accepted roadmap → week → practice; check-in → reviewed memory → accepted adaptation; rejection/stale proposal; archive → reviewed carry-forward.
- AI evaluations: fixed synthetic scenarios from MVP.md; measure schema/evidence fidelity automatically and coaching quality through a human rubric. Avoid brittle exact-prose snapshots and assertions that merely mirror implementation.
- Run formatter/linter, type check, relevant tests, and production build before milestone completion. M7 runs the whole suite. If checks are unavailable, document that limitation and do not label the milestone fully verified.

## Security: Rafter (surface-driven review gate)

Judge actual change surface, not task label. Auth, credentials, player data, model endpoints, database access, deletion, and dependencies make most application milestones security-sensitive.

- Before code involving auth, payments, credentials, tokens, sessions, uploads, user/untrusted data, deserialization, network endpoints, or deletion: invoke `rafter-secure-design` and record its decisions. DATA_MODEL contains a starting design review, not a substitute for reviewing changes to it.
- Before declaring a security-sensitive diff complete, handing it off, or opening a PR: invoke `rafter-code-review` and run `rafter run` on that diff. Relevant surfaces include user input, SQL, shell/exec, auth, credentials, file paths, serialization, crypto, network/outbound fetches, deletion, and dependencies.
- Before installing or forwarding a third-party skill, MCP manifest, Cursor rule, or agent configuration: invoke `rafter-skill-review`. If missing, locate it or report the blocked step; do not silently bypass it.
- If the security angle is unclear, invoke the `rafter` router skill.
- `rafter run` is remote SAST/SCA/secrets analysis and needs `RAFTER_API_KEY`. `rafter secrets .` is local secrets-only analysis and is not a replacement for the code scan.
- `rafter run --mode plus` consumes paid credits; ask the user before running it. Do not assume ordinary scan authorization includes Plus.
- If credentials/tools are unavailable, finish independent work and report the unpassed gate. Never invent a successful scan or claim the security-sensitive implementation is complete.
- For pure trusted local computation or first-party specification prose without an implementation diff, a documented surface check is enough. This exception does not apply merely because code is described as experimental.

Do not run paid services, deploy, send external messages, perform destructive production migrations, or copy real youth data into an LLM without the corresponding task authorization and resolved launch requirements. Ordinary local implementation and synthetic verification within an authorized milestone should proceed without repeated permission requests.

## Definition of done

The requested milestone's behavior and acceptance criteria work; relevant checks pass; security gates have actual results where applicable; migrations are reproducible; errors preserve data; docs match the implementation; and no excluded feature was added. Completion of M0 is not completion of the product. Completion of M7 with synthetic data is not permission to launch with real player data before the stated launch gates are resolved.
