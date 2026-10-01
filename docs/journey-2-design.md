# Journey 2 — quick start to two practices

The primary path is four short decisions: sport/team, age and experience, main goal, and first-practice logistics. The final action explicitly creates and uses a starter roadmap, then prepares Practice 1 as a coach-reviewable draft. Detailed setup, the full roadmap, assessment, calendar exceptions, roster, and saved versions remain available as optional refinement.

Data flow: authenticated browser → bounded quick-start Server Action → existing tenant-scoped setup repository → existing quota-limited season generator → immutable roadmap draft → explicit starter-plan acceptance initiated by the `Create starter plan` button → existing quota-limited practice generator → immutable practice draft. Practice 1 is never marked ready until the coach chooses `Use this practice`. A failure preserves the last successfully persisted stage and routes the coach to a recoverable review screen.

Security design: all inputs use a strict schema with bounded text, dates, numbers, enums, and a validated IANA time zone. Actor, program, team, season, roadmap, week, and session identities come from the authenticated repository rather than browser input. Existing advisory locks, idempotency keys, generation quotas, output validation, RLS, TLS, immutable histories, and protected-content rules remain authoritative. The quick-start action has no arbitrary URL, HTML, file, shell, or tool surface. AI receives only the existing bounded coaching context; text remains untrusted data and renders through React escaping. No request body, generated content, player name, credential, or token is logged.

Threat model: a forged account or resource ID cannot cross the session/RLS boundary because none is accepted from the client. Replays create at most the repository's idempotent versions; rate limits and generation quotas bound resource use. Tampered dates, resource counts, generated IDs, schedule coverage, duration totals, and cross-season references fail existing schemas and relational constraints. A generation outage leaves setup or the accepted roadmap usable and provides a manual retry path. The intentional tradeoff is that the starter roadmap is accepted without a separate roadmap-review screen; the initiating button and adjacent copy state that behavior, the roadmap remains visible and editable, and Practice 1 remains a draft until coach acceptance. A compromised application runtime remains an existing residual risk.

The dashboard follows `design.md`: persistent navigation, personalized top bar, one orange primary action, compact context cards, explicit draft/ready states, and mobile-first stacking. Decorative travel/social patterns are excluded.

## Review evidence

- Strict quick-start parsing rejects extra fields and bounds every text, date, count, enum, and time-zone value.
- The browser never supplies actor, team, season, roadmap, week, or generation-provider identity.
- Roadmap and practice generation retain the existing tenant isolation, quotas, idempotency, immutable drafts, and output validation.
- User and model text renders through React text nodes; the new flow adds no HTML injection, arbitrary URL, file, shell, or logging surface.
- Recovery paths were checked at the setup, roadmap, and practice stages so partial success remains visible and usable.
- Local verification passed TypeScript, ESLint, the production build, and 92 tests. The sign-in page also passed a headless Chrome render check with its Google OAuth action visible.
