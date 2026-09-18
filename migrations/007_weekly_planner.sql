-- Immutable weekly revisions and tenant-safe teaching projections.
create table coach.week_versions (
 id uuid primary key, program_id uuid not null references coach.programs(id) on delete cascade,
 season_id uuid not null, week_id uuid not null, roadmap_id uuid not null,
 number integer not null check(number>0), status text not null check(status in ('draft','accepted')),
 context_version integer not null, request_id uuid not null, generation_id uuid,
 snapshot jsonb not null check(jsonb_typeof(snapshot)='object' and octet_length(snapshot::text)<=60000),
 created_by uuid not null references coach.accounts(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(program_id,season_id,week_id,id), unique(week_id,number), unique(week_id,request_id),
 foreign key(program_id,season_id,week_id) references coach.plan_weeks(program_id,season_id,id) on delete cascade,
 foreign key(program_id,season_id,roadmap_id) references coach.plan_versions(program_id,season_id,id) on delete cascade,
 foreign key(program_id,season_id,generation_id) references coach.generation_runs(program_id,season_id,id) on delete cascade
);
create table coach.week_heads (
 week_id uuid primary key, program_id uuid not null references coach.programs(id) on delete cascade, season_id uuid not null,
 current_id uuid, review_id uuid,
 created_by uuid not null references coach.accounts(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(program_id,season_id,week_id) references coach.plan_weeks(program_id,season_id,id) on delete cascade,
 foreign key(program_id,season_id,week_id,current_id) references coach.week_versions(program_id,season_id,week_id,id) on delete cascade,
 foreign key(program_id,season_id,week_id,review_id) references coach.week_versions(program_id,season_id,week_id,id) on delete cascade
);
create table coach.week_objectives (
 id uuid not null, version_id uuid not null, program_id uuid not null references coach.programs(id) on delete cascade,
 season_id uuid not null, week_id uuid not null, roadmap_id uuid not null, goal_id uuid not null,
 description text not null check(length(description) between 1 and 600), success_criteria text not null check(length(success_criteria) between 1 and 600),
 priority integer not null check(priority between 1 and 3), locked boolean not null,
 created_by uuid not null references coach.accounts(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 primary key(version_id,id), unique(program_id,season_id,week_id,version_id,id),
 foreign key(program_id,season_id,week_id,version_id) references coach.week_versions(program_id,season_id,week_id,id) on delete cascade,
 foreign key(program_id,season_id,roadmap_id) references coach.plan_versions(program_id,season_id,id) on delete cascade,
 foreign key(program_id,season_id,goal_id) references coach.plan_goals(program_id,season_id,id) on delete cascade
);
create table coach.week_allocations (
 program_id uuid not null references coach.programs(id) on delete cascade, season_id uuid not null, week_id uuid not null,
 version_id uuid not null, objective_id uuid not null, session_id uuid not null,
 created_by uuid not null references coach.accounts(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 primary key(version_id,objective_id,session_id),
 foreign key(program_id,season_id,week_id,version_id,objective_id) references coach.week_objectives(program_id,season_id,week_id,version_id,id) on delete cascade,
 foreign key(program_id,season_id,session_id) references coach.plan_sessions(program_id,season_id,id) on delete cascade
);
create table coach.week_generation_contexts (
 id uuid primary key, program_id uuid not null references coach.programs(id) on delete cascade, season_id uuid not null, week_id uuid not null,
 roadmap_id uuid not null, base_id uuid, payload jsonb not null check(octet_length(payload::text)<=60000),
 created_by uuid not null references coach.accounts(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(program_id,season_id,id) references coach.generation_runs(program_id,season_id,id) on delete cascade,
 foreign key(program_id,season_id,week_id) references coach.plan_weeks(program_id,season_id,id) on delete cascade,
 foreign key(program_id,season_id,roadmap_id) references coach.plan_versions(program_id,season_id,id) on delete cascade,
 foreign key(program_id,season_id,week_id,base_id) references coach.week_versions(program_id,season_id,week_id,id) on delete cascade
);
do $$ declare t text; begin
 foreach t in array array['week_versions','week_heads','week_objectives','week_allocations','week_generation_contexts'] loop
  execute format('alter table coach.%I enable row level security',t);
  execute format('alter table coach.%I force row level security',t);
  execute format('revoke all on coach.%I from public',t);
  if exists(select 1 from pg_roles where rolname='anon') then execute format('revoke all on coach.%I from anon',t); end if;
  if exists(select 1 from pg_roles where rolname='authenticated') then execute format('revoke all on coach.%I from authenticated',t); end if;
  execute format('create policy owned_rows on coach.%I for all to season_coach_app using(exists(select 1 from coach.programs p where p.id=program_id and p.owner_id=coach.actor_id())) with check(created_by=coach.actor_id() and exists(select 1 from coach.programs p where p.id=program_id and p.owner_id=coach.actor_id()))',t);
  execute format('create index on coach.%I(program_id,season_id)',t);
  execute format('grant select,insert on coach.%I to season_coach_app',t);
 end loop;
end $$;
grant update(current_id,review_id,updated_at) on coach.week_heads to season_coach_app;
