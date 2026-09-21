alter table coach.generation_runs add column library_position integer not null default 0 check(library_position>=0);
grant update(library_position) on coach.generation_runs to season_coach_app;
