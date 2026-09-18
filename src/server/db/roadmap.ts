import { randomUUID } from "node:crypto";
import { z } from "zod";
import { day, setupSchema } from "../../domain/onboarding";
import { NotFound } from "../../domain/errors";
import {
  applyCalendar,
  applyEdits,
  conflicts,
  fromGeneration,
  localToday,
  planSchema,
  PlanRuleError,
  protect,
  shiftDay,
  type Plan,
  type PlanVersion,
  type RoadmapView,
} from "../../domain/roadmap";
import { OnboardingRepository } from "./onboarding";
import { PlanningRepository } from "./planning";
import type { Query } from "./repository";
type SeasonRow = {
  id: string;
  program_id: string;
  team_id: string;
  context_version: number;
  current_plan_id: string | null;
  review_plan_id: string | null;
  status: string;
};
export class RoadmapRepository {
  constructor(
    private q: Query,
    private actor: string,
  ) {}
  private async season(id: string, write = false) {
    if (write)
      await this.q("select pg_advisory_xact_lock(hashtext($1))", [this.actor]);
    const [s] = await this.q<SeasonRow>(
      "select s.* from coach.seasons s join coach.programs p on p.id=s.program_id where s.id=$1 and p.owner_id=$2 " +
        (write ? "for update of s" : "for share of s"),
      [z.uuid().parse(id), this.actor],
    );
    if (!s) throw new NotFound();
    if (write && s.status === "archived")
      throw new PlanRuleError("Reopen the season before changing its plan.");
    return s;
  }
  private async version(id: string): Promise<PlanVersion> {
    const [v] = await this.q(
      "select v.* from coach.plan_versions v join coach.programs p on p.id=v.program_id where v.id=$1 and p.owner_id=$2",
      [z.uuid().parse(id), this.actor],
    );
    if (!v) throw new NotFound();
    return {
      id: String(v.id),
      seasonId: String(v.season_id),
      number: Number(v.number),
      status: v.status as PlanVersion["status"],
      reason: String(v.reason),
      createdAt: String(v.created_at),
      parentId: v.parent_id as string | null,
      baseId: v.base_id as string | null,
      contextVersion: Number(v.context_version),
      generationId: v.generation_id as string | null,
      plan: planSchema.parse(v.snapshot),
    };
  }
  private async livePlan(s: SeasonRow) {
    if (!s.current_plan_id) return null;
    const p = (await this.version(s.current_plan_id)).plan;
    const rows = await this.q(
      "select id,status from coach.plan_sessions where season_id=$1",
      [s.id],
    );
    p.sessions = p.sessions.map((x) => ({
      ...x,
      status: (rows.find((r) => r.id === x.id)?.status ??
        x.status) as typeof x.status,
    }));
    return p;
  }
  async summary(seasonId: string) {
    const s = await this.season(seasonId);
    const plan = s.current_plan_id
      ? (await this.version(s.current_plan_id)).plan
      : null;
    return {
      currentId: s.current_plan_id,
      reviewId: s.review_plan_id,
      nextWeekId:
        plan?.weeks.find((w) => w.end >= localToday(plan.timezone))?.id ?? null,
    };
  }
  async get(id: string): Promise<RoadmapView> {
    const version = await this.version(id),
      s = await this.season(version.seasonId);
    if (id === s.current_plan_id) version.plan = (await this.livePlan(s))!;
    const history = await this.q<{
      id: string;
      number: number;
      status: string;
      reason: string;
      created: string;
    }>(
      "select id,number,status,reason,created_at::text as created from coach.plan_versions where season_id=$1 order by number desc limit 100",
      [s.id],
    );
    return {
      version,
      currentId: s.current_plan_id,
      reviewId: s.review_plan_id,
      contextVersion: s.context_version,
      today: localToday(version.plan.timezone),
      history,
      conflicts: conflicts(version.plan, version.plan.availability),
    };
  }
  private async existing(s: SeasonRow, request: string) {
    const [v] = await this.q<{ id: string }>(
      "select id from coach.plan_versions where season_id=$1 and request_id=$2",
      [s.id, z.uuid().parse(request)],
    );
    return v?.id;
  }
  private async insert(
    s: SeasonRow,
    plan: Plan,
    status: "draft" | "accepted",
    parent: string | null,
    generation: string | null,
    request: string,
    reason: string,
    context = s.context_version,
  ) {
    z.string().trim().min(1).max(200).parse(reason);
    planSchema.parse(plan);
    if (Buffer.byteLength(JSON.stringify(plan)) > 500000)
      throw new PlanRuleError("This roadmap exceeds the saved-plan limit.");
    const [limit] = await this.q<{ n: number }>(
      "select count(*)::int as n from coach.plan_versions where program_id=$1 and created_at>now()-interval '10 minutes'",
      [s.program_id],
    );
    if (limit.n >= 60)
      throw new PlanRuleError(
        "Too many saved versions. Wait a few minutes; keep this tab open to preserve edits.",
      );
    const [count] = await this.q<{ n: number }>(
      "select coalesce(max(number),0)+1 as n from coach.plan_versions where season_id=$1",
      [s.id],
    );
    const id = randomUUID();
    await this.q(
      "insert into coach.plan_versions(id,program_id,season_id,number,status,parent_id,base_id,context_version,generation_id,request_id,reason,snapshot,created_by) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13)",
      [
        id,
        s.program_id,
        s.id,
        count.n,
        status,
        parent,
        s.current_plan_id,
        context,
        generation,
        request,
        reason,
        plan,
        this.actor,
      ],
    );
    await this.q(
      "update coach.seasons set review_plan_id=$1,updated_at=now() where id=$2",
      [id, s.id],
    );
    return id;
  }
  private assertLatest(s: SeasonRow, v: PlanVersion) {
    if (
      s.review_plan_id !== v.id ||
      v.contextVersion !== s.context_version ||
      (v.status === "draft"
        ? v.baseId !== s.current_plan_id
        : v.id !== s.current_plan_id)
    )
      throw new PlanRuleError(
        "This review is out of date. Open the latest version or recover it as a new draft; your edits have not overwritten anything.",
      );
  }
  async open(generationId: string, request: string) {
    const g = await new PlanningRepository(this.q, this.actor).get(
        generationId,
      ),
      s = await this.season(g.seasonId, true);
    const existing = await this.existing(s, request);
    if (existing) return existing;
    if (g.contextVersion !== s.context_version)
      throw new PlanRuleError(
        "Team settings changed. Generate a fresh roadmap first.",
      );
    if (s.review_plan_id && s.review_plan_id !== s.current_plan_id) {
      const review = await this.version(s.review_plan_id);
      if (
        review.generationId === generationId &&
        review.contextVersion === s.context_version
      )
        return review.id;
      throw new PlanRuleError(
        "A review is already open. Finish it before opening another generated draft.",
      );
    }
    const setup = await new OnboardingRepository(this.q, this.actor, false).get(
      s.team_id,
      s.id,
    );
    const plan = fromGeneration(g, setup.data, randomUUID);
    const current = await this.livePlan(s),
      today = localToday(plan.timezone);
    if (current) {
      if (
        current.weeks.length !== plan.weeks.length ||
        current.weeks.some(
          (w) =>
            !plan.weeks.some(
              (n) =>
                n.start === w.start &&
                n.end === w.end &&
                n.phaseId === w.phaseId,
            ),
        )
      )
        throw new PlanRuleError(
          "Use calendar review to reconcile dates before replacing this roadmap.",
        );
      plan.weeks = current.weeks.map((w) => {
        const n = plan.weeks.find(
          (n) => n.start === w.start && n.end === w.end,
        )!;
        return w.locked || w.start < today
          ? w
          : {
              ...w,
              emphasis: n.emphasis,
              checkpoint: n.checkpoint,
              contentVersion: w.contentVersion + 1,
            };
      });
      plan.goals = current.goals.map((g, i) =>
        g.locked
          ? g
          : {
              ...g,
              description: plan.goals[i]?.description ?? g.description,
              successCriteria:
                plan.goals[i]?.successCriteria ?? g.successCriteria,
              contentVersion: g.contentVersion + 1,
            },
      );
      plan.sessions = current.sessions;
      plan.events = current.events;
      plan.availability = current.availability;
      protect(current, plan, today);
    }
    return this.insert(
      s,
      plan,
      "draft",
      s.current_plan_id,
      generationId,
      request,
      "Review generated roadmap",
    );
  }
  async save(id: string, input: unknown, request: string, accept = false) {
    const v = await this.version(id),
      s = await this.season(v.seasonId, true),
      existing = await this.existing(s, request);
    if (existing) return existing;
    this.assertLatest(s, v);
    const plan = applyEdits(v.plan, input, localToday(v.plan.timezone));
    if (accept)
      return this.acceptPlan(s, v, plan, request, "Coach accepted roadmap");
    return this.insert(
      s,
      plan,
      "draft",
      v.id,
      v.generationId,
      request,
      "Coach edited roadmap",
    );
  }
  async calendar(id: string, input: unknown, request: string) {
    const v = await this.version(id),
      s = await this.season(v.seasonId, true),
      existing = await this.existing(s, request);
    if (existing) return existing;
    this.assertLatest(s, v);

    const current = await this.livePlan(s);
    const plan = applyCalendar(
      v.plan,
      input,
      localToday(v.plan.timezone),
      randomUUID,
    );
    if (current) protect(current, plan, localToday(plan.timezone));
    return this.insert(
      s,
      plan,
      "draft",
      v.id,
      v.generationId,
      request,
      "Calendar change preview",
    );
  }
  async recover(
    id: string,
    expectedCurrent: string | null,
    expectedReview: string | null,
    request: string,
  ) {
    const old = await this.version(id),
      s = await this.season(old.seasonId, true),
      existing = await this.existing(s, request);
    if (existing) return existing;
    if (
      s.current_plan_id !== expectedCurrent ||
      s.review_plan_id !== expectedReview
    )
      throw new PlanRuleError(
        "The plan changed. Reload before recovering a version.",
      );
    const setup = await new OnboardingRepository(this.q, this.actor, false).get(
        s.team_id,
        s.id,
      ),
      current = await this.livePlan(s);
    let plan: Plan;
    if (!current) {
      if (old.contextVersion !== s.context_version)
        throw new PlanRuleError(
          "Generate a fresh roadmap for the current settings.",
        );
      plan = old.plan;
    } else {
      if (
        old.plan.phases.some((p) => !current.phases.some((x) => x.id === p.id))
      )
        throw new PlanRuleError(
          "This pre-acceptance draft belongs to an obsolete phase layout. Recover an accepted version, or copy its teaching text into the current phases.",
        );
      plan = structuredClone(current);
      plan.rationale = old.plan.rationale;
      plan.assumptions = old.plan.assumptions;
      const today = localToday(plan.timezone);
      const storedWeeks = await this.q<{ id: string; content_version: number }>(
        "select id,content_version from coach.plan_weeks where season_id=$1",
        [s.id],
      );
      plan.weeks = old.plan.weeks.map((x) => {
        const w = current.weeks.find((w) => w.id === x.id);
        if (w && (w.locked || w.start < today)) return w;
        const delta = day(current.start) - day(old.plan.start);
        return {
          ...x,
          start: w?.start ?? shiftDay(x.start, delta),
          end: w?.end ?? shiftDay(x.end, delta),
          locked: w?.locked ?? false,
          contentVersion: w
            ? w.contentVersion +
              (w.emphasis !== x.emphasis || w.checkpoint !== x.checkpoint
                ? 1
                : 0)
            : Math.max(
                x.contentVersion,
                storedWeeks.find((r) => r.id === x.id)?.content_version ?? 0,
              ) + 1,
        };
      });
      for (const w of current.weeks)
        if (!plan.weeks.some((x) => x.id === w.id)) plan.weeks.push(w);
      plan.weeks.sort((a, b) => a.start.localeCompare(b.start));
      plan.goals = plan.goals.map((g) => {
        const x = old.plan.goals.find((x) => x.id === g.id);
        return !x || g.locked
          ? g
          : {
              ...g,
              description: x.description,
              successCriteria: x.successCriteria,
              contentVersion:
                g.contentVersion +
                (g.description !== x.description ||
                g.successCriteria !== x.successCriteria
                  ? 1
                  : 0),
            };
      });
      plan.phases = plan.phases.map((p) => ({
        ...p,
        rationale:
          old.plan.phases.find((x) => x.id === p.id)?.rationale ?? p.rationale,
      }));
      protect(current, plan, today);
    }
    plan.availability = setup.data.availability;
    plan.events = setup.data.events.map((e) => ({ ...e, id: e.id! }));
    return this.insert(
      s,
      plan,
      "draft",
      old.id,
      old.generationId,
      request,
      "Recovered teaching content from version " + old.number,
    );
  }
  private async acceptPlan(
    s: SeasonRow,
    v: PlanVersion,
    plan: Plan,
    request: string,
    reason: string,
  ) {
    const setup = await new OnboardingRepository(this.q, this.actor, false).get(
        s.team_id,
        s.id,
      ),
      current = await this.livePlan(s),
      today = localToday(plan.timezone);
    if (current) protect(current, plan, today);
    setupSchema.parse({
      ...setup.data,
      start: plan.start,
      end: plan.end,
      phases: plan.phases.map(({ id, type, start, end }) => ({
        id,
        type,
        start,
        end,
      })),
      events: plan.events,
      availability: plan.availability,
    });
    const errors = conflicts(plan, plan.availability);
    if (errors.length) throw new PlanRuleError(errors.slice(0, 3).join(" "));
    // Existing IDs must stay within their season; ON CONFLICT never relocates a foreign row.
    for (const [table, rows] of [
      ["plan_goals", plan.goals],
      ["plan_weeks", plan.weeks],
      ["plan_sessions", plan.sessions],
      ["calendar_events", plan.events],
    ] as const) {
      const found = await this.q<{ id: string; season_id: string }>(
        "select id,season_id from coach." + table + " where id=any($1::uuid[])",
        [rows.map((x) => x.id)],
      );
      if (found.some((x) => x.season_id !== s.id)) throw new NotFound();
    }
    const oldPhases = setup.data.phases.map((p) => p.id);
    if (
      plan.phases.length !== oldPhases.length ||
      plan.phases.some((p) => !oldPhases.includes(p.id))
    )
      throw new PlanRuleError("Phase identities must match team setup.");
    const context = s.context_version + 1;
    const accepted = await this.insert(
      s,
      plan,
      "accepted",
      v.id,
      v.generationId,
      request,
      reason,
      context,
    );
    for (const p of plan.phases)
      await this.q(
        "update coach.phases set start_date=$1,end_date=$2,updated_at=now() where id=$3 and season_id=$4",
        [p.start, p.end, p.id, s.id],
      );
    await this.q(
      "delete from coach.calendar_events where season_id=$1 and not(id=any($2::uuid[]))",
      [s.id, plan.events.map((e) => e.id)],
    );
    for (const e of plan.events)
      await this.q(
        "insert into coach.calendar_events(id,program_id,season_id,type,title,start_date,end_date,local_time,end_time,blocks_practice,created_by) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) on conflict(id) do update set type=excluded.type,title=excluded.title,start_date=excluded.start_date,end_date=excluded.end_date,local_time=excluded.local_time,end_time=excluded.end_time,blocks_practice=excluded.blocks_practice,updated_at=now() where coach.calendar_events.season_id=excluded.season_id",
        [
          e.id,
          s.program_id,
          s.id,
          e.type,
          e.title,
          e.start,
          e.end,
          e.time || null,
          e.endTime || null,
          e.blocksPractice,
          this.actor,
        ],
      );
    for (const r of plan.availability) {
      if (!r.id || !setup.data.availability.some((a) => a.id === r.id))
        throw new PlanRuleError("Availability rules must match team settings.");
      await this.q(
        "update coach.availability_rules set weekday=$1,local_time=$2,minutes=$3,start_date=$4,end_date=$5,updated_at=now() where id=$6 and season_id=$7",
        [r.weekday, r.time, r.minutes, r.start, r.end, r.id, s.id],
      );
    }
    if (plan.availability.length !== setup.data.availability.length)
      throw new PlanRuleError("Availability rules must match team settings.");
    for (const table of ["plan_goals", "plan_weeks"])
      await this.q(
        "update coach." + table + " set active=false where season_id=$1",
        [s.id],
      );
    for (const g of plan.goals)
      await this.q(
        "insert into coach.plan_goals(id,program_id,season_id,phase_id,description,success_criteria,locked,content_version,created_by) values($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict(id) do update set description=excluded.description,success_criteria=excluded.success_criteria,locked=excluded.locked,content_version=excluded.content_version,active=true,updated_at=now() where coach.plan_goals.season_id=excluded.season_id",
        [
          g.id,
          s.program_id,
          s.id,
          g.phaseId,
          g.description,
          g.successCriteria,
          g.locked,
          g.contentVersion,
          this.actor,
        ],
      );
    // Canceled slots retain a historical parent even when its teaching week was removed.
    const missingWeeks = [
      ...new Set(
        plan.sessions
          .filter(
            (x) =>
              x.status === "canceled" &&
              !plan.weeks.some((w) => w.id === x.weekId),
          )
          .map((x) => x.weekId),
      ),
    ];
    for (const weekId of missingWeeks) {
      const exists = await this.q(
        "select id from coach.plan_weeks where id=$1 and season_id=$2",
        [weekId, s.id],
      );
      if (exists.length) continue;
      const [row] = await this.q<{ week: unknown }>(
        "select w as week from coach.plan_versions v cross join lateral jsonb_array_elements(v.snapshot->'weeks') w where v.season_id=$1 and w->>'id'=$2 order by v.number desc limit 1",
        [s.id, weekId],
      );
      if (!row)
        throw new PlanRuleError(
          "A canceled session is missing its historical week.",
        );
      const w = planSchema.shape.weeks.element.parse(row.week);
      await this.q(
        "insert into coach.plan_weeks(id,program_id,season_id,phase_id,start_date,end_date,emphasis,checkpoint,locked,content_version,active,created_by) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,false,$11)",
        [
          w.id,
          s.program_id,
          s.id,
          w.phaseId,
          w.start,
          w.end,
          w.emphasis,
          w.checkpoint,
          w.locked,
          w.contentVersion,
          this.actor,
        ],
      );
    }
    await this.q(
      `insert into coach.plan_weeks(id,program_id,season_id,phase_id,start_date,end_date,emphasis,checkpoint,locked,content_version,created_by)
       select id,$2,$3,"phaseId",start,"end",emphasis,checkpoint,locked,"contentVersion",$4
       from jsonb_to_recordset($1::jsonb->'rows') as w(id uuid,"phaseId" uuid,start date,"end" date,emphasis text,checkpoint text,locked boolean,"contentVersion" integer)
       on conflict(id) do update set start_date=excluded.start_date,end_date=excluded.end_date,emphasis=excluded.emphasis,checkpoint=excluded.checkpoint,locked=excluded.locked,content_version=excluded.content_version,active=true,updated_at=now() where coach.plan_weeks.season_id=excluded.season_id`,
      [{ rows: plan.weeks }, s.program_id, s.id, this.actor],
    );
    await this.q(
      `insert into coach.plan_sessions(id,program_id,season_id,week_id,local_date,local_time,minutes,status,override_reason,content_version,created_by)
       select id,$2,$3,"weekId",date,time,minutes,status,override,"contentVersion",$4
       from jsonb_to_recordset($1::jsonb->'rows') as x(id uuid,"weekId" uuid,date date,time time,minutes integer,status text,override text,"contentVersion" integer)
       on conflict(id) do update set week_id=excluded.week_id,local_date=excluded.local_date,local_time=excluded.local_time,status=excluded.status,override_reason=excluded.override_reason,updated_at=now() where coach.plan_sessions.season_id=excluded.season_id`,
      [{ rows: plan.sessions }, s.program_id, s.id, this.actor],
    );
    await this.q(
      "update coach.seasons set current_plan_id=$1,review_plan_id=$1,status='active',start_date=$2,end_date=$3,context_version=$4,updated_at=now() where id=$5",
      [accepted, plan.start, plan.end, context, s.id],
    );
    return accepted;
  }
}
