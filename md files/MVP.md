# MVP — Flows, Acceptance, and Milestones

Companion specifications: [PRODUCT.md](PRODUCT.md), [DATA_MODEL.md](DATA_MODEL.md), [AGENTS.md](AGENTS.md). Build M0–M7 in sequence, with a demonstrable vertical slice at each stage. Do not implement the excluded features in PRODUCT.

## Interface and shared behavior

Primary views: Today, Season, Week, Practice, Players, and Team Settings. Today shows current phase, this week's priorities, next scheduled practice, recent observations, and any pending adaptation. A full chat interface is not required; structured forms plus optional free text serve the loop.

Every generated artifact has draft/accepted status, editable content, assumptions, and “Why this plan?” Save drafts across refresh. Show loading, empty, failed, and retry states. Manual editing remains available during AI outages. A visible lock protects a coach-selected objective or practice block. Browser print styling for a practice is sufficient; no PDF service is required.

Use the team's timezone for calendar display. A week begins Monday by default (changeable setting). Dates are inclusive in the UI. Do not require practices on every day: a non-practice day can show rest/no team session, a game, or an optional approved development activity.

## Flow A — Setup to first practice

1. Coach signs in and creates the team. Collect experience, desired guidance level, team type (school/rec/AAU/other), age band, approximate skill level, goals, and preferred teaching philosophy; “not sure” is valid.
2. Collect season dates, timezone, phase dates or approval of suggested dates, practice days/durations, court/hoop/equipment access, approximate player count, and known games/tournaments. Specific player names are optional; aliases suffice.
3. Coach reviews a concise assessment: strengths, gaps, constraints, open questions, and up to three proposed season goals. Every assertion is sourced or labeled an assumption.
4. Generate the roadmap, with all weeks represented, phase rationale, goals, checkpoints, and suggested weekly emphases. Distant weeks stay coarse.
5. Coach accepts/edits the roadmap, details the first week, and generates the first practice. Show objective connections and a timed plan before acceptance.

Acceptance: resume an interrupted setup without loss; reject reversed dates and nonpositive duration; permit unknown skill details without invented traits; no roster names required for a team-level plan; first practice is reachable from the accepted roadmap without a separate chat prompt.

## Flow B — Weekly and daily planning

Coach opens a week, sees available sessions and competition, chooses one to three weekly objectives, and generates or edits practice plans. Each objective has observable success criteria, such as “players can demonstrate their assigned transition responsibility in the coach's review.” Avoid unsupported numerical precision.

A practice contains its objective links, available players, space/equipment assumptions, and ordered blocks. Each block has minutes, activity, setup, teaching cues, progression/regression, and what to observe. Include warmup, transitions/water, and wrap-up within the stated total; represent simultaneous stations within one timed block rather than adding their times together.

Acceptance: a 90-minute practice totals exactly 90 integer minutes including breaks; a 45-minute shortened practice totals 45 after reviewed adjustment; a six-player half-court plan does not require ten players or two full courts; a locked block stays unchanged. If the locks consume more than the available time, show the conflict and request an edit rather than generating an invalid plan. A game-only week may have zero practices without synthetic sessions.

## Flow C — Post-practice observations and player development

Coach marks a session completed and answers: What worked? What needs work? Any player observations? What changed from the plan? Optional actual duration and availability are coach-reported. A quick check-in can consist of one short team note; player ratings are not required.

Save source notes immediately. Show extracted memory candidates separately for review. Coach may accept, edit, or reject each interpretation and create one to three active goals per player (soft guidance, not a hard schema maximum). Goals include a behavior, next teaching step, evidence to look for, and review date. Goal completion requires coach confirmation.

Acceptance: a team note can be saved without player tags; a player note resolves to an existing roster member or asks the coach to select one; repeating submission does not duplicate notes; a generated interpretation cannot masquerade as a coach quote. Player pages show dated evidence and active goals, including Unknown when evidence is insufficient.

## Flow D — Adaptive replanning

Saving a check-in or a material calendar/constraint change marks relevant plans for review. After notes are saved, the system may automatically prepare a suggestion; it does not automatically apply it. Coalesce rapid edits into one pending proposal per season. Manual “Review upcoming plan” is also available.

Show: what changed; supporting observations; confidence and assumptions; specific proposed objective/block changes; affected dates; and what the coach should observe next. Default scope is the next two weeks, including only future uncompleted content. Coach can accept the whole proposal, edit it and then accept, or reject it. Partial application is out of scope.

Acceptance: accepted changes commit atomically; rejected proposals leave the active plan untouched; completed/canceled practices, past weeks, and locked blocks are untouched. If the coach edits the underlying plan while generation is running, accepting the stale proposal fails safely and offers a fresh proposal. Repeated acceptance has no additional effect. Broad phase or season-goal changes must be clearly identified in the review.

## Flow E — Calendar changes and AAU constraints

Coach adds a tournament weekend or changes season dates. Preview changes before commit. A start-date shift offers “shift future plan dates by the same interval” or “keep existing dates.” Completed sessions never move. Coach-entered games/tournaments keep their dates unless individually edited; any resulting conflicts are shown.

If shortened dates leave objectives outside the season, list affected future items and require the coach to reassign or remove them; do not silently truncate. Calendar changes preserve coaching content IDs and accepted versions when content is unchanged. Removing a session marks it canceled; its notes remain available. New roster availability changes generate a proposal rather than retroactively changing historical attendance.

Acceptance: a 12-week season with two 90-minute practices per week yields 24 sessions unless exceptions are explicitly entered. Moving its start by seven days moves eligible future sessions by seven days when that option is selected, preserves content, and flags conflicts with fixed games. Tournament preparation works with no opponent name. Adding a tournament does not schedule a team practice on an unavailable date.

## Flow F — Season close and carry-forward

Coach reviews season goals, player goals, and evidence; records lessons; archives the season; and starts a new season. Suggest a short set of program principles and returning-player development goals to carry forward. Nothing is copied as a current fact without review. Old observations stay dated, and historical strengths remain attributed to their original season.

Acceptance: an archived season is readable; edits require explicit reopening; the new season can start with an empty roster; returning players retain identity only when the coach explicitly selects them; no automatic identity matching by name. Carry-forward references its source and creates a new review date.

## Implementation stages

### M0 — Foundation and isolation

Build the app shell, managed adult coach sign-in/sign-out, database migrations, program ownership policy, tenant-isolated repository layer, CI checks, and synthetic seed data. Add the AI adapter interface with a deterministic fixture implementation; no live model is needed yet.

Done when: two test coaches cannot read or mutate each other's team, child records, or generation status by guessing IDs; unauthenticated access fails; sign-out invalidates the app session; migrations build a fresh database; the shell has usable loading/error states. Deliver setup instructions and an environment example containing names/placeholders only.

### M1 — Coach/team onboarding and assessment inputs

Build editable/resumable profile, season setup, availability and event entry, minimal roster, and assessment form. Persist coach reports and Unknown answers with provenance. Add deletion of a synthetic program to verify the intended cascade early.

Done when: Flow A steps 1–2 pass, invalid dates and durations are rejected on the server, optional names remain optional, and editing settings survives reload. Fixture: first-year 13U coach, nine players, 12 weeks, two 90-minute sessions, one hoop.

### M2 — Assessment and season-plan generator

Implement the live provider adapter behind configuration, typed input/output contracts, bounded generation requests, evidence checks, and draft assessment/roadmap persistence. Generate phase goals and coarse weekly emphases, not every detailed practice for the year.

Done when: assessment differentiates reports/inferences/unknowns; all requested phase dates and weeks are represented without overlap; skipped phases and midseason onboarding work; unsupported evidence IDs and malformed output fail without active-plan changes; retries are bounded and visible. Record measured latency/token use on synthetic fixtures.

### M3 — Roadmap review and calendar UI

Build roadmap acceptance, manual edits, locks, checkpoints, phase/week navigation, version history, and the date-change preview. Accepted roadmap summaries explain what comes next and why.

Done when: Flow A steps 3–4 and Flow E date-shift scenario pass; refresh preserves the accepted version; past/completed sessions remain fixed; conflicts are actionable. Coach can recover an earlier plan by creating a new version from it, without erasing history.

### M4 — Weekly planner

Build weekly objectives, observable checks, event-aware session allocation, links to season goals, and manual overrides. Generate detail for a selected week on demand.

Done when: coach can accept and edit a week with one to three suggested objectives; zero-practice and tournament-heavy weeks work; no session appears outside configured availability without explicit coach action; locks survive week regeneration. Weekly objectives retain links to the accepted roadmap version used as context.

### M5 — Practice generator and player goals

Build timed blocks, drill setup/cues/progressions, resource validation, practice review/edit/lock/print, and simple player goal creation and review. Development work can be a station within a team practice or an optional, explicitly scheduled individual session using the same practice model.

Done when: Flow B passes for 45/60/90 minutes, constrained space, and small groups; durations are deterministically validated; player goal links appear in relevant blocks; infeasible requests explain the conflict. First-use flow now reaches an accepted practice end to end.

### M6 — Check-ins and source evidence

Build completion state, post-practice form, corrected/retracted observations, player evidence timeline, and memory-candidate review. Store raw reports separately from interpreted summaries; mark derived content stale when a source changes.

Done when: Flow C passes; one note from one day never becomes evidence of a recurring pattern; correction preserves the audit trail without continuing to retrieve obsolete text; check-in saving works when AI fails; completed practice history survives later replanning.

### M7 — Persistent memory and adaptation

Build deterministic context selection, program/team/player memory with evidence and freshness, adaptation proposals and transactional acceptance, season close/carry-forward, privacy deletion completion, and operational failure handling.

Done when: Flows D and F pass; one coach can complete two observation/adaptation cycles across separate sessions without restating team context; rejected/expired memory is excluded; conflicting evidence lowers confidence or surfaces a review question; stale proposals cannot overwrite newer edits. Run the full release suite and pilot rubric below.

## Release validation

Use synthetic data for automated checks. Freeze representative prompt fixtures and evaluate structured invariants separately from coaching quality.

| Scenario | Expected result |
|---|---|
| New coach, incomplete knowledge | Useful assessment with explicit Unknowns and editable assumptions |
| AAU week with tournament and one short practice | Feasible priorities; no scouting dependency or invented opponent tendencies |
| Sparse player evidence | Attributed event only; no stable ability claim or playing-time recommendation |
| Contradictory observations | Both sources shown; conflict not silently summarized away |
| Two repeated concerns on separate dates | Likely pattern permitted with evidence; future adjustment remains a proposal |
| Shortened practice with locked blocks | Preserve feasible locks; block impossible totals |
| Injection text in a note | Treated as note content; no authorization or tool behavior change |
| Foreign-team source ID in model output | Rejected before display/persistence |
| Provider timeout or invalid JSON | Saved plans remain intact; manual editing and safe retry available |
| Concurrent edit / duplicate acceptance | Conflict shown / one atomic application |
| Source/player deletion | Derived memory and active generation context no longer contain deleted material |
| New season | Only coach-approved carry-forward; historical source dates retained |

Coaching review rubric: age appropriateness, teachability, sequence, realistic setup, manageable complexity, respectful language, and faithful evidence. Before pilot, have a basketball coach review fixtures and seed drills; product staff cannot substitute schema validation for coaching review. Release blockers: tenant leakage, harmful guidance, invented evidence, invalid timed plans, data loss, and silent plan overwrites.
