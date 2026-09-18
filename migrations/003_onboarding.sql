-- Extend the private tenant schema; no public API grants.
alter table coach.programs add column synthetic boolean not null default false;
alter table coach.seasons
  add column start_date date,
  add column end_date date,
  add column timezone text not null default 'America/Chicago',
  add column week_start integer not null default 1 check(week_start between 0 and 6),
  add column player_count integer check(player_count between 1 and 50),
  add column hoops integer check(hoops between 0 and 20),
  add column court text not null default 'unknown' check(court in ('unknown','full','half','shared','none')),
  add column setup_complete boolean not null default false,
  add constraint season_dates check(end_date >= start_date);
alter table coach.season_roster add column availability_note text not null default '' check(length(availability_note)<=200);

-- Replace all existing tenant/parent foreign keys with database cascades.
do $$ declare c record; begin
  for c in select conname,conrelid::regclass as tbl,pg_get_constraintdef(oid) as def
    from pg_constraint where contype='f' and confrelid in
    ('coach.programs'::regclass,'coach.teams'::regclass,'coach.seasons'::regclass,'coach.players'::regclass)
    and connamespace='coach'::regnamespace
  loop
    execute format('alter table %s drop constraint %I',c.tbl,c.conname);
    execute format('alter table %s add constraint %I %s on delete cascade',c.tbl,c.conname,c.def);
  end loop;
end $$;

create table coach.profile_reports (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references coach.programs(id) on delete cascade,
  season_id uuid not null,
  field text not null check(field in ('experience','guidance','teamType','ageBand','skill','goals','philosophy','equipment','strengths','gaps','questions')),
  value text check(length(value) between 1 and 600),
  confidence text not null check(confidence in ('Known','Unknown')),
  revision integer not null check(revision>0),
  created_by uuid not null references coach.accounts(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(season_id,revision,field),
  check((value is null and confidence='Unknown') or (value is not null and confidence='Known')),
  foreign key(program_id,season_id) references coach.seasons(program_id,id) on delete cascade
);
create table coach.phases (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references coach.programs(id) on delete cascade,
  season_id uuid not null,
  type text not null check(type in ('offseason','preseason','in_season','postseason')),
  start_date date not null, end_date date not null check(end_date>=start_date),
  created_by uuid not null references coach.accounts(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key(program_id,season_id) references coach.seasons(program_id,id) on delete cascade
);
create table coach.availability_rules (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references coach.programs(id) on delete cascade,
  season_id uuid not null,
  weekday integer not null check(weekday between 0 and 6),
  local_time time not null,
  minutes integer not null check(minutes between 1 and 300),
  start_date date, end_date date, check(end_date>=start_date),
  created_by uuid not null references coach.accounts(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key(program_id,season_id) references coach.seasons(program_id,id) on delete cascade
);
create table coach.calendar_events (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references coach.programs(id) on delete cascade,
  season_id uuid not null,
  type text not null check(type in ('game','tournament','unavailable')),
  title text not null check(length(title)<=100),
  start_date date not null, end_date date not null check(end_date>=start_date),
  local_time time, end_time time,
  blocks_practice boolean not null default true,
  created_by uuid not null references coach.accounts(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key(program_id,season_id) references coach.seasons(program_id,id) on delete cascade
);
do $$ declare t text; begin
  foreach t in array array['profile_reports','phases','availability_rules','calendar_events'] loop
    execute format('alter table coach.%I enable row level security',t);
    execute format('alter table coach.%I force row level security',t);
    execute format('revoke all on coach.%I from public',t);
    if exists(select 1 from pg_roles where rolname='anon') then execute format('revoke all on coach.%I from anon',t); end if;
    if exists(select 1 from pg_roles where rolname='authenticated') then execute format('revoke all on coach.%I from authenticated',t); end if;
    execute format('create policy owned_rows on coach.%I for all to season_coach_app using (exists(select 1 from coach.programs p where p.id=program_id and p.owner_id=coach.actor_id())) with check(created_by=coach.actor_id() and exists(select 1 from coach.programs p where p.id=program_id and p.owner_id=coach.actor_id()))',t);
    execute format('create index on coach.%I(program_id,season_id)',t);
  end loop;
end $$;
grant insert(id,owner_id,name) on coach.programs to season_coach_app;
grant delete on coach.programs to season_coach_app;
-- Runtime can never label arbitrary programs synthetic.
create policy synthetic_delete on coach.programs as restrictive for delete to season_coach_app using(synthetic);
grant insert on coach.teams,coach.seasons,coach.players,coach.season_roster to season_coach_app;
grant update(context_version,start_date,end_date,timezone,week_start,player_count,hoops,court,setup_complete) on coach.seasons to season_coach_app;
grant update(alias,updated_at) on coach.players to season_coach_app;
grant update(participation,availability_note,updated_at),delete on coach.season_roster to season_coach_app;
grant select,insert on coach.profile_reports to season_coach_app;
grant select,insert,update,delete on coach.phases,coach.availability_rules,coach.calendar_events to season_coach_app;
