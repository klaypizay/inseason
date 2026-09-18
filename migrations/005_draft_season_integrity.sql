-- Defense in depth: a draft must match its run's season, even within one program.
alter table coach.generation_runs add constraint generation_run_season_identity unique(program_id,season_id,id);
alter table coach.generation_drafts add constraint draft_run_season_fk foreign key(program_id,season_id,id)
 references coach.generation_runs(program_id,season_id,id) on delete cascade;
