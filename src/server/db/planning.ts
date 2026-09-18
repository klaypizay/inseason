import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  calendarWeeks,
  generationRequest,
  validateGenerated,
  type PlanningContext,
  type Source,
  type GenerationRequest,
  type GenerationView,
} from "../../domain/planning";
import { NotFound } from "../../domain/errors";
import { OnboardingRepository, SetupRuleError } from "./onboarding";
import type { Query } from "./repository";
import type { RunMetrics } from "../ai/season-provider";
export class PlanningRepository {
  constructor(
    private q: Query,
    private actor: string,
  ) {}
  async context(teamId: string, seasonId: string): Promise<PlanningContext> {
    const { data } = await new OnboardingRepository(
      this.q,
      this.actor,
      false,
    ).get(teamId, seasonId);
    if (
      !data.complete ||
      !data.start ||
      !data.end ||
      data.playerCount === null ||
      data.hoops === null
    )
      throw new SetupRuleError("Finish team setup before generating a draft.");
    const sources = await this.q<Source>(
      'select distinct on(field) id,field,value,confidence,created_at::text as "reportedAt" from coach.profile_reports where season_id=$1 order by field,revision desc',
      [seasonId],
    );
    const phases = data.phases.map((p) => ({
      id: p.id!,
      type: p.type,
      start: p.start,
      end: p.end,
    }));
    const participation = {
      available: 0,
      limited: 0,
      unavailable: 0,
      unknown: 0,
    };
    for (const p of data.players) participation[p.participation]++;
    return {
      seasonId,
      contextVersion: data.version,
      sources,
      phases,
      weeks: calendarWeeks(phases, data.weekStart),
      season: {
        start: data.start,
        end: data.end,
        timezone: data.timezone,
        weekStart: data.weekStart,
        playerCount: data.playerCount,
        hoops: data.hoops,
        court: data.court,
      },
      availability: data.availability,
      events: data.events.map(({ title, ...event }) => {
        void title;
        return event;
      }),
      participation,
    };
  }
  async begin(
    input: GenerationRequest,
    provider: string,
    model: string,
    dailyQuota = 30,
  ) {
    const request = generationRequest.parse(input);
    z.number().int().min(1).max(100).parse(dailyQuota);
    await this.q("select pg_advisory_xact_lock(hashtext($1))", [this.actor]);
    const context = await this.context(request.teamId, request.seasonId);
    const [season] = await this.q<{ program_id: string }>(
      "select program_id from coach.seasons where id=$1",
      [request.seasonId],
    );
    const existing = await this.q<{
      id: string;
      season_id: string;
      context_version: number;
    }>(
      "select id,season_id,context_version from coach.generation_runs where program_id=$1 and action=$2 and idempotency_key=$3",
      [season.program_id, request.action, request.idempotencyKey],
    );
    if (existing[0]) {
      if (existing[0].season_id !== request.seasonId) throw new NotFound();
      return { id: existing[0].id, context, created: false };
    }
    await this.q(
      "update coach.generation_runs set status='failed',error_code='interrupted',updated_at=now() where program_id=$1 and status in ('queued','running') and lease_expires_at<now()",
      [season.program_id],
    );
    const [counts] = await this.q<{ active: number; daily: number }>(
      "select count(*) filter(where status in ('queued','running') and lease_expires_at>now())::int as active,count(*) filter(where created_at>now()-interval '24 hours' and prompt_version in ('m2-v1','m4-v1'))::int as daily from coach.generation_runs where program_id=$1",
      [season.program_id],
    );
    if (counts.active >= 2)
      throw new SetupRuleError(
        "Two drafts are already being prepared. Open a draft to check its progress.",
      );
    if (counts.daily >= dailyQuota)
      throw new SetupRuleError(
        "Daily generation limit reached. Saved drafts and team settings are still available.",
      );
    const id = randomUUID();
    await this.q(
      "insert into coach.generation_runs(id,program_id,season_id,action,idempotency_key,context_version,model,prompt_version,provider,status,lease_expires_at,created_by) values($1,$2,$3,$4,$5,$6,$7,'m2-v1',$8,'queued',now()+interval '5 minutes',$9)",
      [
        id,
        season.program_id,
        request.seasonId,
        request.action,
        request.idempotencyKey,
        context.contextVersion,
        model,
        provider,
        this.actor,
      ],
    );
    return { id, context, created: true };
  }
  async claim(id: string, provider: string, model: string) {
    await this.q("select pg_advisory_xact_lock(hashtext($1))", [this.actor]);
    const run = await this.ownedRun(id);
    if (run.status !== "queued") return null;
    const context = await this.context(
      String(run.team_id),
      String(run.season_id),
    );
    if (
      context.contextVersion !== run.context_version ||
      run.provider !== provider ||
      run.model !== model
    ) {
      await this.q(
        "update coach.generation_runs set status='failed',error_code='stale_context',updated_at=now() where id=$1",
        [id],
      );
      return null;
    }
    const claimed = await this.q(
      "update coach.generation_runs set status='running',updated_at=now() where id=$1 and status='queued' and lease_expires_at>now() returning id",
      [id],
    );
    return claimed.length
      ? { context, action: generationRequest.shape.action.parse(run.action) }
      : null;
  }
  private async ownedRun(id: string) {
    const rows = await this.q(
      "select g.*,s.team_id,s.context_version as current_version from coach.generation_runs g join coach.seasons s on s.id=g.season_id and s.program_id=g.program_id join coach.programs p on p.id=g.program_id where g.id=$1 and p.owner_id=$2 and g.prompt_version='m2-v1'",
      [z.uuid().parse(id), this.actor],
    );
    if (!rows[0]) throw new NotFound();
    return rows[0];
  }
  async attempt(id: string, attempt: number) {
    await this.ownedRun(id);
    z.number().int().min(1).max(3).parse(attempt);
    const rows = await this.q(
      "update coach.generation_runs set attempts=$1,updated_at=now() where id=$2 and status='running' and lease_expires_at>now() returning id",
      [attempt, id],
    );
    if (!rows.length)
      throw new SetupRuleError("This generation is no longer active.");
  }
  async finish(
    id: string,
    content: unknown,
    metrics: RunMetrics,
    errorCode?: string,
  ) {
    await this.q("select pg_advisory_xact_lock(hashtext($1))", [this.actor]);
    const run = await this.ownedRun(id);
    if (run.status !== "running") return this.get(id);
    let context: PlanningContext | undefined;
    let failure = errorCode;
    const [lease] = await this.q<{ valid: boolean }>(
      "select lease_expires_at>now() as valid from coach.generation_runs where id=$1",
      [id],
    );
    if (!lease.valid) failure = "interrupted";
    if (!failure) {
      context = await this.context(String(run.team_id), String(run.season_id));
      if (context.contextVersion !== run.context_version)
        failure = "stale_context";
    }
    if (!failure && context) {
      const action = generationRequest.shape.action.parse(run.action);
      const validated = validateGenerated(action, content, context);
      const payload = {
        schemaVersion: 1,
        status: "draft",
        action,
        context,
        content: validated,
      };
      if (Buffer.byteLength(JSON.stringify(payload), "utf8") > 240000)
        throw new SetupRuleError("Draft is too large.");
      await this.q(
        "insert into coach.generation_drafts(id,program_id,season_id,payload,created_by) values($1,$2,$3,$4::jsonb,$5)",
        [id, run.program_id, run.season_id, payload, this.actor],
      );
    }
    await this.q(
      "update coach.generation_runs set status=$1,attempts=$2,input_tokens=$3,output_tokens=$4,latency_ms=$5,error_code=$6,updated_at=now() where id=$7",
      [
        failure ? "failed" : "succeeded",
        metrics.attempts,
        metrics.inputTokens,
        metrics.outputTokens,
        metrics.latencyMs,
        failure ?? null,
        id,
      ],
    );
    return this.get(id);
  }
  async get(id: string): Promise<GenerationView> {
    const run = await this.ownedRun(id);
    const [draft] = await this.q<{ payload: GenerationView["draft"] }>(
      "select payload from coach.generation_drafts where id=$1",
      [id],
    );
    const [state] = await this.q<{ expired: boolean; created: string }>(
      "select coalesce(lease_expires_at<now(),false) as expired,created_at::text as created from coach.generation_runs where id=$1",
      [id],
    );
    const expired =
      ["queued", "running"].includes(String(run.status)) && state.expired;
    return {
      id,
      seasonId: String(run.season_id),
      action: generationRequest.shape.action.parse(run.action),
      status: expired ? "failed" : String(run.status),
      errorCode: expired ? "interrupted" : (run.error_code as string | null),
      attempts: Number(run.attempts),
      contextVersion: Number(run.context_version),
      currentContextVersion: Number(run.current_version),
      provider: String(run.provider),
      model: String(run.model),
      inputTokens: Number(run.input_tokens),
      outputTokens: Number(run.output_tokens),
      latencyMs: Number(run.latency_ms),
      createdAt: state.created,
      draft: draft?.payload ?? null,
    };
  }
  async list(teamId: string, seasonId: string) {
    await new OnboardingRepository(this.q, this.actor, false).get(
      teamId,
      seasonId,
    );
    return this.q<{
      id: string;
      action: string;
      status: string;
      created: string;
    }>(
      "select id,action,status,created_at::text as created from coach.generation_runs where season_id=$1 and prompt_version='m2-v1' order by created_at desc limit 30",
      [seasonId],
    );
  }
}
