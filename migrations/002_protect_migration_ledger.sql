-- Supabase grants API roles access to new public tables by default.
-- Migration metadata is operator-only, never part of the application's API.
alter table public.coach_migrations enable row level security;
revoke all on public.coach_migrations from public;
do $$ declare api_role text; begin
  foreach api_role in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = api_role) then
      execute format('revoke all on public.coach_migrations from %I', api_role);
    end if;
  end loop;
end $$;
