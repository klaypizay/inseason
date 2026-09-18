alter table coach.generation_runs
 add column provider text not null default 'fixture',
 add column attempts integer not null default 0 check(attempts between 0 and 3),
 add column input_tokens integer not null default 0 check(input_tokens>=0),
 add column output_tokens integer not null default 0 check(output_tokens>=0),
 add column latency_ms integer not null default 0 check(latency_ms>=0),
 add column error_code text,
 add column lease_expires_at timestamptz,
 add constraint generation_program_id_unique unique(program_id,id);

create table coach.generation_drafts (
 id uuid primary key,
 program_id uuid not null references coach.programs(id) on delete cascade,
 season_id uuid not null,
 payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=256000),
 created_by uuid not null references coach.accounts(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 foreign key(program_id,season_id) references coach.seasons(program_id,id) on delete cascade,
 foreign key(program_id,id) references coach.generation_runs(program_id,id) on delete cascade
);
alter table coach.generation_drafts enable row level security;
alter table coach.generation_drafts force row level security;
create policy owned_rows on coach.generation_drafts for all to season_coach_app
 using(exists(select 1 from coach.programs p where p.id=program_id and p.owner_id=coach.actor_id()))
 with check(created_by=coach.actor_id() and exists(select 1 from coach.programs p where p.id=program_id and p.owner_id=coach.actor_id()));
revoke all on coach.generation_drafts from public;
do $$ begin
 if exists(select 1 from pg_roles where rolname='anon') then revoke all on coach.generation_drafts from anon; end if;
 if exists(select 1 from pg_roles where rolname='authenticated') then revoke all on coach.generation_drafts from authenticated; end if;
end $$;
create index on coach.generation_drafts(program_id,season_id);
create index on coach.generation_runs(program_id,created_at);
grant select,insert on coach.generation_drafts to season_coach_app;
grant insert on coach.generation_runs to season_coach_app;
grant update(provider,attempts,input_tokens,output_tokens,latency_ms,error_code,lease_expires_at) on coach.generation_runs to season_coach_app;
