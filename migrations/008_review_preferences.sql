create table coach.preferences (
 account_id uuid primary key references coach.accounts(id) on delete cascade,
 display_name text not null default '' check(length(display_name)<=80),
 date_format text not null default 'MM/DD/YYYY' check(date_format in ('MM/DD/YYYY','DD/MM/YYYY','YYYY-MM-DD')),
 revision integer not null default 1 check(revision>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table coach.preferences enable row level security;
alter table coach.preferences force row level security;
revoke all on coach.preferences from public;
do $$ begin
 if exists(select 1 from pg_roles where rolname='anon') then revoke all on coach.preferences from anon; end if;
 if exists(select 1 from pg_roles where rolname='authenticated') then revoke all on coach.preferences from authenticated; end if;
end $$;
create policy own_preferences on coach.preferences for all to season_coach_app using(account_id=coach.actor_id()) with check(account_id=coach.actor_id());
grant select,insert,update on coach.preferences to season_coach_app;
alter table coach.generation_runs
 add column display_name text not null default '' check(length(display_name)<=100),
 add column folder text not null default '' check(length(folder)<=60),
 add column library_state text not null default 'active' check(library_state in ('active','archived','trash')),
 add column library_revision integer not null default 1 check(library_revision>0);
grant update(display_name,folder,library_state,library_revision) on coach.generation_runs to season_coach_app;
