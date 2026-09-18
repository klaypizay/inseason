-- Immutable review/accepted snapshots, plus tenant-scoped calendar projections.
create table coach.plan_versions (
 id uuid primary key, program_id uuid not null references coach.programs(id) on delete cascade,
 season_id uuid not null, number integer not null check(number>0),
 status text not null check(status in ('draft','accepted')), parent_id uuid, base_id uuid,
 context_version integer not null check(context_version>0), generation_id uuid,
 request_id uuid not null, reason text not null check(length(reason) between 1 and 200),
 snapshot jsonb not null check(jsonb_typeof(snapshot)='object' and octet_length(snapshot::text)<=600000),
 created_by uuid not null references coach.accounts(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(program_id,season_id,id), unique(season_id,number), unique(season_id,request_id),
 foreign key(program_id,season_id) references coach.seasons(program_id,id) on delete cascade,
 foreign key(program_id,season_id,parent_id) references coach.plan_versions(program_id,season_id,id),
 foreign key(program_id,season_id,base_id) references coach.plan_versions(program_id,season_id,id),
 foreign key(program_id,season_id,generation_id) references coach.generation_runs(program_id,season_id,id) on delete cascade
);
alter table coach.seasons add column current_plan_id uuid, add column review_plan_id uuid;
alter table coach.seasons add foreign key(program_id,id,current_plan_id) references coach.plan_versions(program_id,season_id,id) deferrable initially deferred;
alter table coach.seasons add foreign key(program_id,id,review_plan_id) references coach.plan_versions(program_id,season_id,id) deferrable initially deferred;
alter table coach.phases add constraint phase_program_season_id_unique unique(program_id,season_id,id);
create table coach.plan_goals (
 id uuid primary key, program_id uuid not null references coach.programs(id) on delete cascade, season_id uuid not null, phase_id uuid not null,
 description text not null check(length(description) between 1 and 600), success_criteria text not null check(length(success_criteria) between 1 and 600),
 locked boolean not null, content_version integer not null check(content_version>0), active boolean not null default true,
 created_by uuid not null references coach.accounts(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(program_id,season_id,id), foreign key(program_id,season_id) references coach.seasons(program_id,id) on delete cascade,
 foreign key(program_id,season_id,phase_id) references coach.phases(program_id,season_id,id) on delete cascade
);
create table coach.plan_weeks (
 id uuid primary key, program_id uuid not null references coach.programs(id) on delete cascade, season_id uuid not null, phase_id uuid not null,
 start_date date not null, end_date date not null check(end_date>=start_date), emphasis text not null check(length(emphasis) between 1 and 600), checkpoint text not null check(length(checkpoint) between 1 and 600),
 locked boolean not null, content_version integer not null check(content_version>0), active boolean not null default true,
 created_by uuid not null references coach.accounts(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(program_id,season_id,id), foreign key(program_id,season_id) references coach.seasons(program_id,id) on delete cascade,
 foreign key(program_id,season_id,phase_id) references coach.phases(program_id,season_id,id) on delete cascade
);
create table coach.plan_sessions (
 id uuid primary key, program_id uuid not null references coach.programs(id) on delete cascade, season_id uuid not null, week_id uuid not null,
 local_date date not null, local_time time not null, minutes integer not null check(minutes between 1 and 300), status text not null check(status in ('scheduled','completed','canceled')),
 override_reason text not null default '' check(length(override_reason)<=200), content_version integer not null check(content_version>0),
 created_by uuid not null references coach.accounts(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(program_id,season_id,id), foreign key(program_id,season_id) references coach.seasons(program_id,id) on delete cascade,
 foreign key(program_id,season_id,week_id) references coach.plan_weeks(program_id,season_id,id) on delete cascade
);
do $$ declare t text; begin
 foreach t in array array['plan_versions','plan_goals','plan_weeks','plan_sessions'] loop
  execute format('alter table coach.%I enable row level security',t);
  execute format('alter table coach.%I force row level security',t);
  execute format('revoke all on coach.%I from public',t);
  if exists(select 1 from pg_roles where rolname='anon') then execute format('revoke all on coach.%I from anon',t); end if;
  if exists(select 1 from pg_roles where rolname='authenticated') then execute format('revoke all on coach.%I from authenticated',t); end if;
  execute format('create policy owned_rows on coach.%I for all to season_coach_app using(exists(select 1 from coach.programs p where p.id=program_id and p.owner_id=coach.actor_id())) with check(created_by=coach.actor_id() and exists(select 1 from coach.programs p where p.id=program_id and p.owner_id=coach.actor_id()))',t);
  execute format('create index on coach.%I(program_id,season_id)',t);
 end loop;
end $$;
grant select,insert on coach.plan_versions to season_coach_app;
grant select,insert,update on coach.plan_goals,coach.plan_weeks,coach.plan_sessions to season_coach_app;
grant update(current_plan_id,review_plan_id,status) on coach.seasons to season_coach_app;
