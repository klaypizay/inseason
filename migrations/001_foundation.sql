-- Run with migration credentials, never the web application's connection.
create role season_coach_app nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
create schema coach;
revoke all on schema coach from public;
grant usage on schema coach to season_coach_app;

create table coach.accounts (
  id uuid primary key,
  adult_attested_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create table coach.sessions (
  token_hash text primary key check (length(token_hash) = 64),
  account_id uuid not null references coach.accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days'
);
create index on coach.sessions(account_id);
create table coach.login_limits (
  key text primary key,
  attempts integer not null,
  window_start timestamptz not null default now()
);
create table coach.programs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references coach.accounts(id),
  name text not null check (length(name) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on coach.programs(owner_id);
create table coach.teams (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references coach.programs(id),
  name text not null check (length(name) between 1 and 100),
  created_by uuid not null references coach.accounts(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(program_id, id)
);
create table coach.seasons (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references coach.programs(id),
  team_id uuid not null,
  title text not null check (length(title) between 1 and 100),
  status text not null default 'setup' check (status in ('setup','active','archived')),
  context_version integer not null default 1 check (context_version > 0),
  created_by uuid not null references coach.accounts(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(program_id,id),
  foreign key(program_id,team_id) references coach.teams(program_id,id)
);
create unique index on coach.seasons(team_id) where status = 'active';
create table coach.players (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references coach.programs(id),
  alias text not null check (length(alias) between 1 and 80),
  created_by uuid not null references coach.accounts(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(program_id,id)
);
create table coach.season_roster (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references coach.programs(id),
  season_id uuid not null,
  player_id uuid not null,
  participation text not null default 'unknown' check (participation in ('available','limited','unavailable','unknown')),
  created_by uuid not null references coach.accounts(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(season_id,player_id),
  foreign key(program_id,season_id) references coach.seasons(program_id,id),
  foreign key(program_id,player_id) references coach.players(program_id,id)
);
create table coach.generation_runs (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references coach.programs(id),
  season_id uuid not null,
  action text not null check(action in ('assessSeason','draftRoadmap','draftWeek','draftPractice','proposeMemory','proposeAdaptation')),
  idempotency_key uuid not null,
  context_version integer not null check(context_version > 0),
  model text not null default 'fixture-v1',
  prompt_version text not null default 'm0-v1',
  schema_version integer not null default 1 check(schema_version = 1),
  status text not null default 'queued' check(status in ('queued','running','succeeded','failed')),
  created_by uuid not null references coach.accounts(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(program_id,action,idempotency_key),
  foreign key(program_id,season_id) references coach.seasons(program_id,id)
);

create function coach.actor_id() returns uuid language sql stable as $$
  select nullif(current_setting('coach.actor_id',true),'')::uuid
$$;
alter table coach.programs enable row level security;
alter table coach.programs force row level security;
create policy owned_program on coach.programs for all to season_coach_app
  using(owner_id = coach.actor_id()) with check(owner_id = coach.actor_id());

do $$ declare t text; begin
  foreach t in array array['teams','seasons','players','season_roster','generation_runs'] loop
    execute format('alter table coach.%I enable row level security',t);
    execute format('alter table coach.%I force row level security',t);
    execute format('create policy owned_rows on coach.%I for all to season_coach_app using (exists (select 1 from coach.programs p where p.id = program_id and p.owner_id = coach.actor_id())) with check (created_by = coach.actor_id() and exists (select 1 from coach.programs p where p.id = program_id and p.owner_id = coach.actor_id()))',t);
    execute format('create index on coach.%I(program_id)',t);
  end loop;
end $$;
grant select,insert on coach.accounts to season_coach_app;
grant select,insert,update,delete on coach.sessions,coach.login_limits to season_coach_app;
grant select on coach.programs,coach.teams,coach.seasons,coach.players,coach.season_roster,coach.generation_runs to season_coach_app;
-- Only the bounded foundation mutations are available to the runtime.
grant update(name,updated_at) on coach.teams to season_coach_app;
grant update(title,updated_at) on coach.seasons to season_coach_app;
grant update(status,updated_at) on coach.generation_runs to season_coach_app;
