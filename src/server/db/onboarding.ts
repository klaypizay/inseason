import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  blankSetup,
  setupSchema,
  type SetupView,
  type ReportField,
} from "../../domain/onboarding";
import { NotFound } from "../../domain/errors";
import type { Query } from "./repository";
export class SetupConflict extends Error {
  constructor() {
    super(
      "This setup changed in another tab. Reload before saving again; copy any unsaved edits first.",
    );
  }
}
export class SetupRuleError extends Error {}
export class OnboardingRepository {
  constructor(
    private q: Query,
    private actor: string,
    private fresh: boolean,
  ) {}
  async load(): Promise<SetupView> {
    const rows = await this.q<{ id: string; team_id: string }>(
      "select s.id,s.team_id from coach.seasons s join coach.programs p on p.id=s.program_id where p.owner_id=$1 order by s.created_at,s.id limit 1",
      [this.actor],
    );
    if (!rows[0]) return { data: blankSetup(), savedAt: null, sources: [] };
    return this.get(rows[0].team_id, rows[0].id);
  }
  private async owned(teamId: string, seasonId: string, lock = false) {
    const rows = await this.q(
      "select s.*,t.name as team_name from coach.seasons s join coach.teams t on t.id=s.team_id and t.program_id=s.program_id join coach.programs p on p.id=s.program_id where s.id=$1 and s.team_id=$2 and p.owner_id=$3 " +
        (lock ? "for update of s" : "for share of s"),
      [z.uuid().parse(seasonId), z.uuid().parse(teamId), this.actor],
    );
    if (!rows[0]) throw new NotFound();
    return rows[0];
  }
  async get(teamId: string, seasonId: string): Promise<SetupView> {
    const s = await this.owned(teamId, seasonId);
    const reports = await this.q<{
      field: ReportField;
      value: string | null;
      confidence: string;
      reported_at: string;
    }>(
      "select distinct on(field) field,value,confidence,created_at::text as reported_at from coach.profile_reports where season_id=$1 order by field,revision desc",
      [seasonId],
    );
    const base = blankSetup();
    for (const r of reports) base.reports[r.field] = r.value ?? "";
    const phases = await this.q(
      "select id,type,start_date::text as start,end_date::text as end from coach.phases where season_id=$1 order by start_date,id",
      [seasonId],
    );
    const availability = await this.q(
      "select id,weekday,to_char(local_time,'HH24:MI') as time,minutes,start_date::text as start,end_date::text as end from coach.availability_rules where season_id=$1 order by weekday,local_time,id",
      [seasonId],
    );
    const events = await this.q(
      "select id,type,title,start_date::text as start,end_date::text as end,coalesce(to_char(local_time,'HH24:MI'),'') as time,coalesce(to_char(end_time,'HH24:MI'),'') as \"endTime\",blocks_practice as \"blocksPractice\" from coach.calendar_events where season_id=$1 order by start_date,id",
      [seasonId],
    );
    const players = await this.q(
      "select p.id,p.alias,r.participation,r.availability_note as note from coach.season_roster r join coach.players p on p.id=r.player_id and p.program_id=r.program_id where r.season_id=$1 order by r.created_at,r.id",
      [seasonId],
    );
    const dates = await this.q<{
      start: string | null;
      end: string | null;
      saved: string;
    }>(
      "select start_date::text as start,end_date::text as end,updated_at::text as saved from coach.seasons where id=$1",
      [seasonId],
    );
    return {
      data: setupSchema.parse({
        ...base,
        teamId,
        seasonId,
        version: s.context_version,
        complete: s.setup_complete,
        teamName: s.team_name,
        title: s.title,
        start: dates[0].start,
        end: dates[0].end,
        timezone: s.timezone,
        weekStart: s.week_start,
        playerCount: s.player_count,
        hoops: s.hoops,
        court: s.court,
        phases,
        availability,
        events,
        players,
      }),
      savedAt: reports.length ? dates[0].saved : null,
      sources: reports.map((r) => ({
        field: r.field,
        confidence: r.confidence,
        reportedAt: r.reported_at,
      })),
    };
  }
  async save(input: unknown): Promise<SetupView> {
    const data = setupSchema.parse(input);
    await this.q("select pg_advisory_xact_lock(hashtext($1))", [this.actor]);
    const limits = await this.q<{ attempts: number }>(
      "insert into coach.login_limits(key,attempts) values($1,1) on conflict(key) do update set attempts=case when coach.login_limits.window_start < now()-interval '10 minutes' then 1 else coach.login_limits.attempts+1 end,window_start=case when coach.login_limits.window_start < now()-interval '10 minutes' then now() else coach.login_limits.window_start end returning attempts",
      ["setup:" + this.actor],
    );
    if (limits[0].attempts > 60)
      throw new SetupRuleError(
        "Too many saves. Wait a few minutes, then retry; keep this tab open to preserve edits.",
      );
    let teamId = data.teamId,
      seasonId = data.seasonId;
    if (!teamId || !seasonId) {
      const existing = await this.q(
        "select id from coach.programs where owner_id=$1 limit 1",
        [this.actor],
      );
      if (existing.length || data.version !== 0) throw new SetupConflict();
      const programId = randomUUID();
      teamId = randomUUID();
      seasonId = randomUUID();
      await this.q(
        "insert into coach.programs(id,owner_id,name) values($1,$2,$3)",
        [programId, this.actor, data.teamName],
      );
      await this.q(
        "insert into coach.teams(id,program_id,name,created_by) values($1,$2,$3,$4)",
        [teamId, programId, data.teamName, this.actor],
      );
      await this.q(
        "insert into coach.seasons(id,program_id,team_id,title,created_by) values($1,$2,$3,$4,$5)",
        [seasonId, programId, teamId, data.title, this.actor],
      );
    }
    const s = await this.owned(teamId, seasonId, true);
    if (data.teamId && s.context_version !== data.version)
      throw new SetupConflict();
    if (s.status !== "setup")
      throw new SetupRuleError(
        "This season has moved beyond setup. Calendar changes need plan review.",
      );
    const programId = s.program_id;
    for (const [table, rows] of [
      ["phases", data.phases],
      ["availability_rules", data.availability],
      ["calendar_events", data.events],
    ] as const) {
      const existing = await this.q<{ id: string }>(
        "select id from coach." + table + " where season_id=$1",
        [seasonId],
      );
      if (rows.some((row) => row.id && !existing.some((e) => e.id === row.id)))
        throw new NotFound();
    }
    const existingPlayers = await this.q<{ player_id: string }>(
      "select player_id from coach.season_roster where season_id=$1",
      [seasonId],
    );
    if (
      data.players.some(
        (row) => row.id && !existingPlayers.some((e) => e.player_id === row.id),
      )
    )
      throw new NotFound();
    const revision = Number(s.context_version) + 1;
    await this.q(
      "update coach.teams set name=$1,updated_at=now() where id=$2",
      [data.teamName, teamId],
    );
    await this.q(
      "update coach.seasons set title=$1,start_date=$2,end_date=$3,timezone=$4,week_start=$5,player_count=$6,hoops=$7,court=$8,setup_complete=$9,context_version=$10,updated_at=now() where id=$11",
      [
        data.title,
        data.start,
        data.end,
        data.timezone,
        data.weekStart,
        data.playerCount,
        data.hoops,
        data.court,
        data.complete,
        revision,
        seasonId,
      ],
    );
    const reportEntries = Object.entries(data.reports);
    await this.q(
      "insert into coach.profile_reports(program_id,season_id,field,value,confidence,revision,created_by) select $1,$2,f,v,c,$3,$4 from unnest($5::text[],$6::text[],$7::text[]) as report(f,v,c) where not exists(select 1 from (select value from coach.profile_reports where season_id=$2 and field=f order by revision desc limit 1) previous where previous.value is not distinct from v)",
      [
        programId,
        seasonId,
        revision,
        this.actor,
        reportEntries.map(([f]) => f),
        reportEntries.map(([, v]) => v || null),
        reportEntries.map(([, v]) => (v ? "Known" : "Unknown")),
      ],
    );
    for (const [table, rows] of [
      ["phases", data.phases],
      ["availability_rules", data.availability],
      ["calendar_events", data.events],
    ] as const) {
      const keep = rows.flatMap((r) => (r.id ? [r.id] : []));
      await this.q(
        "delete from coach." +
          table +
          " where season_id=$1 and not(id=any($2::uuid[]))",
        [seasonId, keep],
      );
    }
    for (const r of data.phases)
      await this.q(
        "insert into coach.phases(id,program_id,season_id,type,start_date,end_date,created_by) values($1,$2,$3,$4,$5,$6,$7) on conflict(id) do update set type=excluded.type,start_date=excluded.start_date,end_date=excluded.end_date,updated_at=now()",
        [
          r.id ?? randomUUID(),
          programId,
          seasonId,
          r.type,
          r.start,
          r.end,
          this.actor,
        ],
      );
    for (const r of data.availability)
      await this.q(
        "insert into coach.availability_rules(id,program_id,season_id,weekday,local_time,minutes,start_date,end_date,created_by) values($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict(id) do update set weekday=excluded.weekday,local_time=excluded.local_time,minutes=excluded.minutes,start_date=excluded.start_date,end_date=excluded.end_date,updated_at=now()",
        [
          r.id ?? randomUUID(),
          programId,
          seasonId,
          r.weekday,
          r.time,
          r.minutes,
          r.start,
          r.end,
          this.actor,
        ],
      );
    for (const r of data.events)
      await this.q(
        "insert into coach.calendar_events(id,program_id,season_id,type,title,start_date,end_date,local_time,end_time,blocks_practice,created_by) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) on conflict(id) do update set type=excluded.type,title=excluded.title,start_date=excluded.start_date,end_date=excluded.end_date,local_time=excluded.local_time,end_time=excluded.end_time,blocks_practice=excluded.blocks_practice,updated_at=now()",
        [
          r.id ?? randomUUID(),
          programId,
          seasonId,
          r.type,
          r.title,
          r.start,
          r.end,
          r.time || null,
          r.endTime || null,
          r.blocksPractice,
          this.actor,
        ],
      );
    await this.q(
      "delete from coach.season_roster where season_id=$1 and not(player_id=any($2::uuid[]))",
      [seasonId, data.players.flatMap((p) => (p.id ? [p.id] : []))],
    );
    const players = data.players.map((r, i) => ({
      ...r,
      id: r.id ?? randomUUID(),
      alias: r.alias || "Player " + (i + 1),
    }));
    if (players.length) {
      await this.q(
        "insert into coach.players(id,program_id,alias,created_by) select id,$1,alias,$2 from unnest($3::uuid[],$4::text[]) as p(id,alias) on conflict(id) do update set alias=excluded.alias,updated_at=now()",
        [
          programId,
          this.actor,
          players.map((p) => p.id),
          players.map((p) => p.alias),
        ],
      );
      await this.q(
        "insert into coach.season_roster(program_id,season_id,player_id,participation,availability_note,created_by) select $1,$2,id,participation,note,$3 from unnest($4::uuid[],$5::text[],$6::text[]) as r(id,participation,note) on conflict(season_id,player_id) do update set participation=excluded.participation,availability_note=excluded.availability_note,updated_at=now()",
        [
          programId,
          seasonId,
          this.actor,
          players.map((p) => p.id),
          players.map((p) => p.participation),
          players.map((p) => p.note),
        ],
      );
    }
    return this.get(teamId, seasonId);
  }
  async deleteSynthetic(programId: string, confirmation: string) {
    z.uuid().parse(programId);
    z.string().max(100).parse(confirmation);
    if (!this.fresh)
      throw new SetupRuleError(
        "Sign in again before deleting a synthetic program.",
      );
    await this.q("select pg_advisory_xact_lock(hashtext($1))", [this.actor]);
    const rows = await this.q(
      "select id from coach.programs where id=$1 and owner_id=$2 and synthetic and name=$3",
      [programId, this.actor, confirmation],
    );
    if (!rows.length) throw new NotFound();
    await this.q(
      "delete from coach.programs where id=$1 and owner_id=$2 and synthetic",
      [programId, this.actor],
    );
    await this.q("delete from coach.sessions where account_id=$1", [
      this.actor,
    ]);
  }
}
