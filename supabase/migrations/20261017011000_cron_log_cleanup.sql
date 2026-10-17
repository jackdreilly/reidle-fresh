-- pg_cron logs every run in cron.job_run_details; with the per-minute push job that is ~1,440 rows a day.
-- Keep a week of history: a daily job (03:30 UTC, a quiet hour) deletes older rows.
select cron.schedule('reidle-cron-log-cleanup', '30 3 * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '7 days'$$);
