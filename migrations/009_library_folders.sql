create table coach.library_folders (
 id uuid primary key default gen_random_uuid(),
 account_id uuid not null references coach.accounts(id) on delete cascade,
 name text not null check(length(name) between 1 and 60),
 revision integer not null default 1 check(revision>0),
 unique(account_id,name)
);
alter table coach.library_folders enable row level security;
alter table coach.library_folders force row level security;
revoke all on coach.library_folders from public;
do $$ begin
 if exists(select 1 from pg_roles where rolname='anon') then revoke all on coach.library_folders from anon; end if;
 if exists(select 1 from pg_roles where rolname='authenticated') then revoke all on coach.library_folders from authenticated; end if;
end $$;
create policy own_library_folders on coach.library_folders for all to season_coach_app using(account_id=coach.actor_id()) with check(account_id=coach.actor_id());
grant select,insert,update,delete on coach.library_folders to season_coach_app;
insert into coach.library_folders(account_id,name)
 select distinct p.owner_id,g.folder from coach.generation_runs g join coach.programs p on p.id=g.program_id where g.folder<>'';
