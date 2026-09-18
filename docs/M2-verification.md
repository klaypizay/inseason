# M2 verification

Synthetic development only. M2 implements assessment and coarse roadmap drafts; acceptance/editing and practice generation are not implemented here.

## Automated and hosted checks

- Production build, formatter, lint and TypeScript checks passed.
- 26 local/hosted tests passed; the separate paid live test is opt-in and skipped in the ordinary suite.
- Local PostgreSQL checks cover exact date coverage, clipped boundary weeks, skipped phases, evidence/schema rejection (including valid but unrelated source IDs), retry ceilings, timeout, idempotency, owner isolation, stale inputs, logout during generation, quota/lease behavior and deletion cascades.
- Hosted Supabase checks use the restricted runtime role and verify assessment and roadmap JSON objects persist and reload. This caught a driver-specific double-encoding issue that was fixed by binding the JSON object directly. Migrations 004 and 005 applied successfully.
- Desktop and mobile draft scenarios create both drafts, show all twelve weeks, refresh and reopen history without activating plans. All twelve desktop/mobile regression scenarios passed.
- A stale generated Next.js preview cache caused a local 404; removing only generated `.next` files and restarting restored the route. The isolated browser reports no page errors.

## Live OpenAI measurements

Fixed synthetic first-year 13U, nine-player, twelve-week fixture. Pinned model `gpt-5.4-mini-2026-03-17`; one call per successful final action, no retries:

| Action     | Input tokens | Output tokens |        Elapsed | Estimated cost |
| ---------- | -----------: | ------------: | -------------: | -------------: |
| Assessment |        2,323 |           775 |  6.545 seconds |    $0.00522975 |
| Roadmap    |        1,750 |         1,522 | 10.284 seconds |    $0.00816150 |

The final pair costs approximately $0.0134. Eight test calls were reserved across development, at $0.10 each, within the user's $1 ceiling. Earlier trials exposed unsupported citations and the provider's unsupported `oneOf` schema form; subsequent changes use `anyOf`, authorized source enums and same-topic evidence validation. The final live test passed after these changes. Actual provider billing is authoritative; reservations conservatively include failed calls. Artifacts/ledger are local and ignored.

Pricing basis: [OpenAI model documentation](https://developers.openai.com/api/docs/models/gpt-5.4-mini), $0.75/million input and $4.50/million output tokens; [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

## Security review evidence

Rafter secure-design and code-review skills applied, including web-app and LLM walkthroughs. No new dependencies, tools, vector retrieval, model execution, payments, uploads or cryptography.

- Authorization: `src/server/planning/actions.ts` authenticates every action through `withSession`; `src/server/db/planning.ts:161` binds each run to its authenticated owner. Migration 004 forces draft RLS; 005 binds program, season and generation together. Existing revocable sessions and secure production cookie settings remain in force.
- Injection/output: repository SQL binds parameters; `src/domain/planning.ts:136` validates generated schemas/evidence/calendar before persistence. `src/components/draft-view.tsx` renders escaped text only, with no generated HTML, URLs, commands or executable output.
- Prompt privacy/agency: `src/server/ai/openai-season.ts:4` separates instructions from untrusted context. Repository context excludes names/account identity and aggregates participation. No model tools or active-plan mutations exist. Free text can still contain personal information; synthetic-only use remains required.
- Outbound/security configuration: `src/server/ai/openai-season.ts:56` fixes the HTTPS provider endpoint, disallows redirects, keeps credentials in headers, disables response storage and bounds input/output bytes and tokens. Safe error codes exclude raw responses, prompts and credentials.
- Resource/race protection: `src/server/db/planning.ts:83` serializes quota decisions; claim and finish recheck ownership, context and leases. `src/server/ai/generate-season.ts` releases transactions during network waits and reauthenticates before writes. `src/server/ai/season-provider.ts` caps retries/deadlines. No dependency changes or credential changes enter Git.
- React review: server-only provider configuration, direct imports, small client interaction components, cleaned polling timer, semantic headings/status/alerts and authenticated server actions. Server claim makes development Strict Mode duplicate effects idempotent.

The source-only Rafter secrets scan returned zero findings, and a separate exact-value check found no configured local secrets in staged source. Remote Rafter scan `d55466a5-2465-4b1c-8563-44679437fcfd` targets source commit `55e64e1`; completed with zero errors and two warnings for placeholder database URLs in `.env.example:4–5`. Both use deliberately nonfunctional example values, contain no real credentials, and match the already-reviewed M0/M1 warnings. No unresolved security findings were identified in this pass. GitHub Actions run [35310616347](https://github.com/klaypizay/basketballcoach.ing/actions/runs/35310616347) passed on that source commit. Independent coaching quality review, provider retention/privacy approval, real youth data handling and operational deployment remain pilot gates. Source-topic matching cannot establish that every natural-language inference is true.
