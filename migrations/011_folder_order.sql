alter table coach.library_folders add column position integer not null default 0 check(position>=0);
