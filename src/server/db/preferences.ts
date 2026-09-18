import { z } from "zod";
import {
  defaultPreferences,
  preferenceSchema,
  libraryEditSchema,
  type Preferences,
  type LibraryItem,
} from "../../domain/preferences";
import { NotFound } from "../../domain/errors";
import { PlanRuleError } from "../../domain/roadmap";
import type { Query } from "./repository";
export class PreferencesRepository {
  constructor(
    private q: Query,
    private actor: string,
  ) {}
  async get(): Promise<Preferences> {
    const [row] = await this.q<Preferences>(
      'select display_name as "displayName",date_format as "dateFormat",revision from coach.preferences where account_id=$1',
      [this.actor],
    );
    return row ?? { ...defaultPreferences };
  }
  async save(input: unknown) {
    const data = preferenceSchema.parse(input);
    await this.q("select pg_advisory_xact_lock(hashtext($1))", [this.actor]);
    const current = await this.get();
    if (current.revision !== data.revision)
      throw new PlanRuleError(
        "Settings changed in another tab. Close and reopen settings before saving.",
      );
    await this.q(
      "insert into coach.preferences(account_id,display_name,date_format,revision) values($1,$2,$3,1) on conflict(account_id) do update set display_name=excluded.display_name,date_format=excluded.date_format,revision=coach.preferences.revision+1,updated_at=now()",
      [this.actor, data.displayName, data.dateFormat],
    );
    return this.get();
  }
}
export class LibraryRepository {
  constructor(
    private q: Query,
    private actor: string,
  ) {}
  private query = `select g.id,g.action,g.status,g.created_at::text as created,
    coalesce(nullif(g.display_name,''),s.title || case when g.action='draftRoadmap' then ' roadmap' else ' assessment' end) as name,
    g.folder,g.library_state as state,g.library_revision as revision,
    (select v.id from coach.plan_versions v where v.generation_id=g.id order by v.number desc limit 1) as "planId",
    exists(select 1 from coach.plan_versions v where v.id=s.current_plan_id and v.generation_id=g.id) as "isCurrent"
    from coach.generation_runs g join coach.seasons s on s.id=g.season_id and s.program_id=g.program_id join coach.programs p on p.id=g.program_id`;
  async item(id: string): Promise<LibraryItem> {
    const [item] = await this.q<LibraryItem>(
      this.query +
        " where g.id=$1 and p.owner_id=$2 and g.prompt_version='m2-v1'",
      [z.uuid().parse(id), this.actor],
    );
    if (!item) throw new NotFound();
    return item;
  }
  async list(season: string) {
    return this.q<LibraryItem>(
      this.query +
        " where s.id=$1 and p.owner_id=$2 and g.prompt_version='m2-v1' order by g.created_at desc limit 200",
      [z.uuid().parse(season), this.actor],
    );
  }
  async save(id: string, input: unknown) {
    const data = libraryEditSchema.parse(input);
    await this.q("select pg_advisory_xact_lock(hashtext($1))", [this.actor]);
    const old = await this.item(id);
    if (old.revision !== data.revision)
      throw new PlanRuleError(
        "This roadmap's details changed in another tab. Reload before saving.",
      );
    if (old.isCurrent && data.state !== "active")
      throw new PlanRuleError(
        "Accept a replacement roadmap before archiving or deleting the active roadmap.",
      );
    await this.q(
      "update coach.generation_runs set display_name=$1,folder=$2,library_state=$3,library_revision=library_revision+1,updated_at=now() where id=$4",
      [data.name, data.folder, data.state, id],
    );
    if (data.state === "trash") {
      await this.q(
        "update coach.seasons s set review_plan_id=current_plan_id,updated_at=now() where exists(select 1 from coach.plan_versions v where v.id=s.review_plan_id and v.generation_id=$1)",
        [id],
      );
      await this.q(
        "update coach.generation_runs set status='failed',error_code='discarded',updated_at=now() where id=$1 and status in ('queued','running')",
        [id],
      );
    }
    return this.item(id);
  }
}
