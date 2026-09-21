alter table coach.preferences
 add column time_format text not null default '12-hour'
 constraint preferences_time_format_check check(time_format in ('12-hour','24-hour'));
