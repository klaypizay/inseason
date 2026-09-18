import { PreferencesRepository, LibraryRepository } from "./preferences";
import { WeekRepository } from "./week";
import { RoadmapRepository } from "./roadmap";
import { PlanningRepository } from "./planning";
import { OnboardingRepository } from "./onboarding";
import { createHash } from "node:crypto";
import { z } from "zod";
import { NotFound, Unauthorized } from "../../domain/errors";

export interface Query {
  <T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    values?: unknown[],
  ): Promise<T[]>;
}
export interface Database {
  transaction<T>(work: (query: Query) => Promise<T>): Promise<T>;
}
export const digest = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export async function revokeApplicationSession(
  database: Database,
  token: string | undefined,
) {
  if (token && /^[a-f0-9]{64}$/.test(token)) {
    await database.transaction((q) =>
      q("delete from coach.sessions where token_hash=$1", [digest(token)]),
    );
  }
}
const id = z.uuid();
const label = z.string().trim().min(1).max(100);

// The only repository entry point accepts an opaque cookie, never an actor ID.
export async function withSession<T>(
  database: Database,
  token: string | undefined,
  work: (repo: Repository) => Promise<T>,
): Promise<T> {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) throw new Unauthorized();
  return database.transaction(async (q) => {
    const sessions = await q<{ account_id: string; fresh: boolean }>(
      `update coach.sessions set last_seen_at = now()
      where token_hash = $1 and expires_at > now() and last_seen_at > now() - interval '24 hours'
      returning account_id, created_at > now() - interval '10 minutes' as fresh`,
      [digest(token)],
    );
    if (!sessions[0]) throw new Unauthorized();
    const actor = sessions[0].account_id;
    await q("select set_config('coach.actor_id',$1,true)", [actor]);
    return work(new Repository(q, actor, sessions[0].fresh));
  });
}
class Repository {
  constructor(
    private q: Query,
    private actor: string,
    private fresh: boolean,
  ) {}
  preferences() {
    return new PreferencesRepository(this.q, this.actor);
  }
  library() {
    return new LibraryRepository(this.q, this.actor);
  }
  week() {
    return new WeekRepository(this.q, this.actor);
  }
  roadmap() {
    return new RoadmapRepository(this.q, this.actor);
  }
  planning() {
    return new PlanningRepository(this.q, this.actor);
  }
  onboarding() {
    return new OnboardingRepository(this.q, this.actor, this.fresh);
  }
  async teams() {
    return this.q<{ id: string; name: string }>(
      `select t.id,t.name from coach.teams t join coach.programs p on p.id=t.program_id where p.owner_id=$1 order by t.created_at,t.id limit 50`,
      [this.actor],
    );
  }
  async team(teamId: string) {
    const rows = await this.q(
      `select t.id,t.name,t.program_id from coach.teams t join coach.programs p on p.id=t.program_id where t.id=$1 and p.owner_id=$2`,
      [id.parse(teamId), this.actor],
    );
    if (!rows[0]) throw new NotFound();
    return rows[0];
  }
  async season(teamId: string, seasonId: string) {
    await this.team(teamId);
    const rows = await this.q(
      `select id,title,program_id,context_version from coach.seasons where team_id=$1 and id=$2`,
      [id.parse(teamId), id.parse(seasonId)],
    );
    if (!rows[0]) throw new NotFound();
    return rows[0];
  }
  async roster(teamId: string, seasonId: string) {
    await this.season(teamId, seasonId);
    return this.q(
      `select p.id,p.alias,r.participation from coach.season_roster r join coach.players p on p.id=r.player_id and p.program_id=r.program_id where r.season_id=$1 order by p.id limit 100`,
      [seasonId],
    );
  }
  async generation(runId: string) {
    const rows = await this.q(
      `select g.id,g.status,g.action from coach.generation_runs g join coach.programs p on p.id=g.program_id where g.id=$1 and p.owner_id=$2`,
      [id.parse(runId), this.actor],
    );
    if (!rows[0]) throw new NotFound();
    return rows[0];
  }
  async renameTeam(teamId: string, name: string) {
    await this.team(teamId);
    await this.q(
      "update coach.teams set name=$1,updated_at=now() where id=$2",
      [label.parse(name), teamId],
    );
  }
  async renameSeason(teamId: string, seasonId: string, title: string) {
    await this.season(teamId, seasonId);
    await this.q(
      "update coach.seasons set title=$1,updated_at=now() where id=$2",
      [label.parse(title), seasonId],
    );
  }
  async failGeneration(runId: string) {
    await this.generation(runId);
    await this.q(
      "update coach.generation_runs set status='failed',updated_at=now() where id=$1",
      [runId],
    );
  }
}
