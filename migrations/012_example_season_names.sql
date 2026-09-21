-- Rename only the original app-supplied seed label. Preserve custom names,
-- real programs, unrelated sample seasons and all saved planning snapshots.
update coach.seasons as s
set title = 'Example season'
from coach.programs as p
where p.id = s.program_id
  and p.synthetic
  and s.title = 'Synthetic season'
  and (s.id, s.program_id) in (
    ('30000000-0000-4000-8000-000000000001'::uuid, '10000000-0000-4000-8000-000000000001'::uuid),
    ('30000000-0000-4000-8000-000000000002'::uuid, '10000000-0000-4000-8000-000000000002'::uuid)
  );
