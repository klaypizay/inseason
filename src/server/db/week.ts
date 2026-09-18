import { randomUUID } from "node:crypto";
import { z } from "zod";
import { NotFound } from "../../domain/errors";
import { localToday, PlanRuleError } from "../../domain/roadmap";
import {
  eligibleSessions,
  manualWeek,
  refreshWeek,
  validateWeek,
  weekContentSchema,
  type WeekContext,
  type WeekContent,
  type WeekVersion,
  type WeekView,
  type WeekGenerationContext,
} from "../../domain/week";
import { RoadmapRepository } from "./roadmap";
import { OnboardingRepository } from "./onboarding";
import type { Source } from "../../domain/planning";
import type { Query } from "./repository";
import type { RunMetrics } from "../ai/season-provider";
type Owner = {
  program_id: string;
  season_id: string;
  team_id: string;
  current_plan_id: string;
  context_version: number;
  status: string;
  active: boolean;
};
export class WeekRepository {
  constructor(
    private q: Query,
    private actor: string,
  ) {}
  private async owner(id: string, write = false) {
    if (write)
      await this.q("select pg_advisory_xact_lock(hashtext($1))", [this.actor]);
    const [row] = await this.q<Owner>(
      "select w.program_id,w.season_id,w.active,s.team_id,s.current_plan_id,s.context_version,s.status from coach.plan_weeks w join coach.seasons s on s.id=w.season_id and s.program_id=w.program_id join coach.programs p on p.id=w.program_id where w.id=$1 and p.owner_id=$2 " +
        (write ? "for update of s" : "for share of s"),
      [z.uuid().parse(id), this.actor],
    );
    if (!row || !row.current_plan_id) throw new NotFound();
    if (write && (row.status === "archived" || !row.active))
      throw new PlanRuleError("This week is historical and cannot be changed.");
    return row;
  }
  private async context(id: string, owner: Owner): Promise<WeekContext> {
    const view = await new RoadmapRepository(this.q, this.actor).get(
      owner.current_plan_id,
    );
    const p = view.version.plan,
      week = p.weeks.find((w) => w.id === id);
    if (!week)
      throw new PlanRuleError(
        "This week was removed from the active roadmap. Read its saved versions from history.",
      );
    const { data } = await new OnboardingRepository(
      this.q,
      this.actor,
      false,
    ).get(owner.team_id, owner.season_id);
    const sources = await this.q<Source>(
      'select distinct on(field) id,field,value,confidence,created_at::text as "reportedAt" from coach.profile_reports where season_id=$1 order by field,revision desc',
      [owner.season_id],
    );
    const participation = {
      available: 0,
      limited: 0,
      unavailable: 0,
      unknown: 0,
    };
    for (const player of data.players) participation[player.participation]++;
    const coach = {
      sources,
      participation,
      season: {
        start: p.start,
        end: p.end,
        timezone: p.timezone,
        weekStart: p.weekStart,
        playerCount: data.playerCount,
        hoops: data.hoops,
        court: data.court,
      },
    };
    return {
      roadmapId: view.version.id,
      contextVersion: view.version.contextVersion,
      timezone: p.timezone,
      today: localToday(p.timezone),
      week,
      goals: p.goals,
      sessions: eligibleSessions(p, id),
      events: p.events
        .filter((e) => e.start <= week.end && e.end >= week.start)
        .map(({ title, ...e }) => {
          void title;
          return e;
        }),
      coach: {
        sources: coach.sources,
        season: coach.season,
        participation: coach.participation,
      },
    };
  }
  private async head(id: string) {
    const [row] = await this.q<{
      current_id: string | null;
      review_id: string | null;
    }>("select current_id,review_id from coach.week_heads where week_id=$1", [
      id,
    ]);
    return row ?? { current_id: null, review_id: null };
  }
  private async version(id: string, week: string): Promise<WeekVersion> {
    const [v] = await this.q(
      "select v.*,v.created_at::text as created from coach.week_versions v join coach.programs p on p.id=v.program_id where v.id=$1 and v.week_id=$2 and p.owner_id=$3",
      [z.uuid().parse(id), week, this.actor],
    );
    if (!v) throw new NotFound();
    const snapshot = v.snapshot as { context: WeekContext; content: unknown };
    return {
      id: String(v.id),
      number: Number(v.number),
      status: v.status as WeekVersion["status"],
      roadmapId: String(v.roadmap_id),
      contextVersion: Number(v.context_version),
      context: snapshot.context,
      content: weekContentSchema.parse(snapshot.content),
      created: String(v.created),
    };
  }
  async get(id: string, versionId?: string): Promise<WeekView> {
    const owner = await this.owner(id),
      head = await this.head(id);
    const chosen = versionId ?? head.review_id;
    const version = chosen ? await this.version(chosen, id) : null;
    const context = owner.active
      ? await this.context(id, owner)
      : version?.context;
    if (!context) throw new NotFound();
    const history = await this.q<{
      id: string;
      number: number;
      status: string;
    }>(
      "select id,number,status from coach.week_versions where week_id=$1 order by number desc limit 100",
      [id],
    );
    const runs = await this.q<WeekView["runs"][number]>(
      "select g.id,case when g.status in ('queued','running') and g.lease_expires_at<now() then 'failed' else g.status end as status,case when g.status in ('queued','running') and g.lease_expires_at<now() then 'interrupted' else g.error_code end as error,g.attempts,g.provider from coach.generation_runs g join coach.week_generation_contexts c on c.id=g.id where c.week_id=$1 order by g.created_at desc limit 10",
      [id],
    );
    return {
      context,
      version,
      currentId: head.current_id,
      reviewId: head.review_id,
      editable:
        owner.active &&
        owner.status !== "archived" &&
        context.week.end >= context.today &&
        context.contextVersion === owner.context_version &&
        (!version || version.id === head.review_id),
      stale:
        !!version &&
        (version.roadmapId !== owner.current_plan_id ||
          version.contextVersion !== owner.context_version),
      history,
      runs,
    };
  }
  private async writable(
    id: string,
    expected: string | null,
    roadmapId: string,
  ) {
    z.uuid().nullable().parse(expected);
    z.uuid().parse(roadmapId);
    const owner = await this.owner(id, true),
      head = await this.head(id);
    if (head.review_id !== expected || owner.current_plan_id !== roadmapId)
      throw new PlanRuleError(
        "The week or roadmap changed. Reload the latest review before saving; nothing was overwritten.",
      );
    const context = await this.context(id, owner);
    if (context.contextVersion !== owner.context_version)
      throw new PlanRuleError(
        "Team settings changed. Accept an updated roadmap before detailing this week.",
      );
    if (context.week.end < context.today)
      throw new PlanRuleError("Past weeks are read-only.");
    return {
      owner,
      head,
      context,
      previous: expected ? await this.version(expected, id) : null,
    };
  }
  private async existing(id: string, request: string) {
    const [row] = await this.q<{ id: string }>(
      "select id from coach.week_versions where week_id=$1 and request_id=$2",
      [id, z.uuid().parse(request)],
    );
    return row?.id;
  }
  private async insert(
    owner: Owner,
    context: WeekContext,
    content: WeekContent,
    request: string,
    accept: boolean,
    generation: string | null = null,
  ) {
    const [limit] = await this.q<{ n: number }>(
      "select count(*)::int as n from coach.week_versions where program_id=$1 and created_at>now()-interval '10 minutes'",
      [owner.program_id],
    );
    if (limit.n >= 60)
      throw new PlanRuleError(
        "Too many saved versions. Keep your edits and try again in a few minutes.",
      );
    const snapshot = { schemaVersion: 1, context, content };
    if (Buffer.byteLength(JSON.stringify(snapshot)) > 55000)
      throw new PlanRuleError("This weekly plan exceeds the saved-plan limit.");
    const [count] = await this.q<{ n: number }>(
      "select coalesce(max(number),0)+1 as n from coach.week_versions where week_id=$1",
      [context.week.id],
    );
    const id = randomUUID();
    await this.q(
      "insert into coach.week_versions(id,program_id,season_id,week_id,roadmap_id,number,status,context_version,request_id,generation_id,snapshot,created_by) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12)",
      [
        id,
        owner.program_id,
        owner.season_id,
        context.week.id,
        context.roadmapId,
        count.n,
        accept ? "accepted" : "draft",
        context.contextVersion,
        request,
        generation,
        snapshot,
        this.actor,
      ],
    );
    for (const [index, o] of content.objectives.entries()) {
      await this.q(
        "insert into coach.week_objectives(id,version_id,program_id,season_id,week_id,roadmap_id,goal_id,description,success_criteria,priority,locked,created_by) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
        [
          o.id,
          id,
          owner.program_id,
          owner.season_id,
          context.week.id,
          context.roadmapId,
          o.goalId,
          o.description,
          o.successCriteria,
          index + 1,
          o.locked,
          this.actor,
        ],
      );
    }
    for (const a of content.allocations)
      for (const objective of a.objectiveIds)
        await this.q(
          "insert into coach.week_allocations(program_id,season_id,week_id,version_id,objective_id,session_id,created_by) values($1,$2,$3,$4,$5,$6,$7)",
          [
            owner.program_id,
            owner.season_id,
            context.week.id,
            id,
            objective,
            a.sessionId,
            this.actor,
          ],
        );
    await this.q(
      "insert into coach.week_heads(week_id,program_id,season_id,current_id,review_id,created_by) values($1,$2,$3,$4,$5,$6) on conflict(week_id) do update set current_id=case when $7 then excluded.current_id else coach.week_heads.current_id end,review_id=excluded.review_id,updated_at=now()",
      [
        context.week.id,
        owner.program_id,
        owner.season_id,
        accept ? id : null,
        id,
        this.actor,
        accept,
      ],
    );
    return id;
  }
  async save(
    id: string,
    expected: string | null,
    roadmap: string,
    input: unknown,
    request: string,
    accept: boolean,
  ) {
    z.boolean().parse(accept);
    await this.owner(id, true);
    const existing = await this.existing(id, request);
    if (existing) return existing;
    const { owner, context, previous } = await this.writable(
      id,
      expected,
      roadmap,
    );
    if (previous && previous.roadmapId !== context.roadmapId)
      throw new PlanRuleError(
        "Refresh this weekly draft from the accepted roadmap before editing it.",
      );
    const baseline = previous?.content ?? manualWeek(context, randomUUID);
    const content = validateWeek(input, context, baseline);
    return this.insert(owner, context, content, request, accept);
  }
  async refresh(
    id: string,
    expected: string | null,
    roadmap: string,
    request: string,
  ) {
    await this.owner(id, true);
    const existing = await this.existing(id, request);
    if (existing) return existing;
    const { owner, context, previous } = await this.writable(
      id,
      expected,
      roadmap,
    );
    const content = previous
      ? refreshWeek(previous.content, context)
      : manualWeek(context, randomUUID);
    return this.insert(owner, context, content, request, false);
  }
  async begin(
    id: string,
    expected: string | null,
    roadmap: string,
    request: string,
    provider: string,
    model: string,
    quota: number,
  ) {
    const owner = await this.owner(id, true);
    z.uuid().parse(request);
    z.number().int().min(1).max(100).parse(quota);
    const [existing] = await this.q<{ id: string; week_id: string }>(
      "select g.id,c.week_id from coach.generation_runs g join coach.week_generation_contexts c on c.id=g.id where g.program_id=$1 and g.action='draftWeek' and g.idempotency_key=$2",
      [owner.program_id, request],
    );
    if (existing) {
      if (existing.week_id !== id) throw new NotFound();
      return existing.id;
    }
    const { context, previous } = await this.writable(id, expected, roadmap);
    if (previous && previous.roadmapId !== context.roadmapId)
      throw new PlanRuleError(
        "Refresh this weekly draft from the accepted roadmap first.",
      );
    await this.q(
      "update coach.generation_runs set status='failed',error_code='interrupted',updated_at=now() where program_id=$1 and status in ('queued','running') and lease_expires_at<now()",
      [owner.program_id],
    );
    const [count] = await this.q<{ active: number; daily: number }>(
      "select count(*) filter(where status in ('queued','running') and lease_expires_at>now())::int as active,count(*) filter(where created_at>now()-interval '24 hours' and prompt_version in ('m2-v1','m4-v1'))::int as daily from coach.generation_runs where program_id=$1",
      [owner.program_id],
    );
    if (count.active >= 2 || count.daily >= quota)
      throw new PlanRuleError(
        "Generation limit reached. Saved plans and manual editing remain available.",
      );
    const run = randomUUID(),
      payload: WeekGenerationContext = {
        context,
        previous: previous?.content ?? manualWeek(context, randomUUID),
      };
    if (Buffer.byteLength(JSON.stringify(payload)) > 48000)
      throw new PlanRuleError("Weekly generation context is too large.");
    await this.q(
      "insert into coach.generation_runs(id,program_id,season_id,action,idempotency_key,context_version,model,prompt_version,provider,status,lease_expires_at,created_by) values($1,$2,$3,'draftWeek',$4,$5,$6,'m4-v1',$7,'queued',now()+interval '5 minutes',$8)",
      [
        run,
        owner.program_id,
        owner.season_id,
        request,
        context.contextVersion,
        model,
        provider,
        this.actor,
      ],
    );
    await this.q(
      "insert into coach.week_generation_contexts(id,program_id,season_id,week_id,roadmap_id,base_id,payload,created_by) values($1,$2,$3,$4,$5,$6,$7::jsonb,$8)",
      [
        run,
        owner.program_id,
        owner.season_id,
        id,
        roadmap,
        expected,
        payload,
        this.actor,
      ],
    );
    return run;
  }
  private async run(id: string) {
    const [run] = await this.q(
      "select g.*,c.week_id,c.roadmap_id,c.base_id,c.payload,coalesce(g.lease_expires_at>now(),false) as valid from coach.generation_runs g join coach.week_generation_contexts c on c.id=g.id join coach.programs p on p.id=g.program_id where g.id=$1 and p.owner_id=$2 and g.prompt_version='m4-v1'",
      [z.uuid().parse(id), this.actor],
    );
    if (!run) throw new NotFound();
    return run;
  }
  async claim(id: string, provider: string, model: string) {
    await this.q("select pg_advisory_xact_lock(hashtext($1))", [this.actor]);
    const run = await this.run(id);
    if (run.status !== "queued") return null;
    try {
      if (!run.valid || run.provider !== provider || run.model !== model)
        throw new Error();
      await this.writable(
        String(run.week_id),
        run.base_id as string | null,
        String(run.roadmap_id),
      );
    } catch {
      await this.q(
        "update coach.generation_runs set status='failed',error_code='stale_context',updated_at=now() where id=$1",
        [id],
      );
      return null;
    }
    await this.q(
      "update coach.generation_runs set status='running',updated_at=now() where id=$1",
      [id],
    );
    return run.payload as WeekGenerationContext;
  }
  async attempt(id: string, attempt: number) {
    z.number().int().min(1).max(3).parse(attempt);
    const run = await this.run(id);
    if (run.status !== "running" || !run.valid)
      throw new PlanRuleError("This attempt is no longer active.");
    await this.q(
      "update coach.generation_runs set attempts=$1,updated_at=now() where id=$2",
      [attempt, id],
    );
  }
  async finish(
    id: string,
    input: unknown,
    metrics: RunMetrics,
    failure?: string,
  ) {
    await this.q("select pg_advisory_xact_lock(hashtext($1))", [this.actor]);
    const run = await this.run(id);
    if (run.status !== "running") return;
    let error = failure,
      state: Awaited<ReturnType<WeekRepository["writable"]>> | undefined;
    try {
      if (!run.valid) throw new Error();
      state = await this.writable(
        String(run.week_id),
        run.base_id as string | null,
        String(run.roadmap_id),
      );
      if (state.context.contextVersion !== run.context_version)
        throw new Error();
    } catch {
      error = "stale_context";
    }
    if (!error && state) {
      const previous = (run.payload as WeekGenerationContext).previous;
      const content = validateWeek(input, state.context, previous);
      await this.insert(state.owner, state.context, content, id, false, id);
    }
    await this.q(
      "update coach.generation_runs set status=$1,error_code=$2,attempts=$3,input_tokens=$4,output_tokens=$5,latency_ms=$6,updated_at=now() where id=$7",
      [
        error ? "failed" : "succeeded",
        error ?? null,
        metrics.attempts,
        metrics.inputTokens,
        metrics.outputTokens,
        metrics.latencyMs,
        id,
      ],
    );
  }
}
