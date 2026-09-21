-- Original M0 examples predate the synthetic flag. Identify them by the
-- exact seed season/program pair, original program name and untouched label.
-- Do not change the synthetic flag or its deletion permissions.
update coach.seasons as s
set title = 'Example season'
from coach.programs as p
where p.id = s.program_id
  and s.title = 'Synthetic season'
  and (s.id, s.program_id, p.name) in (
    ('30000000-0000-4000-8000-000000000001'::uuid, '10000000-0000-4000-8000-000000000001'::uuid, 'Demo Program 1'),
    ('30000000-0000-4000-8000-000000000002'::uuid, '10000000-0000-4000-8000-000000000002'::uuid, 'Demo Program 2')
  );
