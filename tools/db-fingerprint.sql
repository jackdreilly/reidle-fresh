-- One row per schema object in `public` with a hash of its definition. Same output on any DB that ran
-- the same migrations, so diffing it between the repo (local build) and a live project shows drift.
-- Function bodies are compared without `--` comments and whitespace (hand-applied copies lost them).
select kind, name, md5(regexp_replace(regexp_replace(def, '--[^\n]*', '', 'g'), '\s+', ' ', 'g')) as hash from (
  select 'function' as kind, p.oid::regprocedure::text as name,
         pg_get_functiondef(p.oid) || coalesce(array_to_string(p.proacl, ','), '') as def
  from pg_proc p where p.pronamespace = 'public'::regnamespace
  union all
  select 'table', c.relname,
         string_agg(a.attname || ' ' || format_type(a.atttypid, a.atttypmod) || ' ' || a.attnotnull
                    || ' ' || coalesce(pg_get_expr(d.adbin, d.adrelid), ''), ', ' order by a.attnum)
         || ' rls=' || c.relrowsecurity || ' acl=' || coalesce(array_to_string(c.relacl, ','), '')
  from pg_class c join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
  left join pg_attrdef d on d.adrelid = c.oid and d.adnum = a.attnum
  where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'v', 'm', 'p')
  group by c.oid, c.relname, c.relrowsecurity, c.relacl
  union all
  select 'index', indexname, indexdef from pg_indexes where schemaname = 'public'
  union all
  select 'constraint', conrelid::regclass::text || '.' || conname, pg_get_constraintdef(oid)
  from pg_constraint where connamespace = 'public'::regnamespace
  union all
  select 'policy', tablename || '.' || policyname, cmd || ' ' || coalesce(qual, '') || ' ' || coalesce(with_check, '')
  from pg_policies where schemaname = 'public'
  union all
  select 'trigger', tgrelid::regclass::text || '.' || tgname, pg_get_triggerdef(oid)
  from pg_trigger where not tgisinternal
    and tgrelid in (select oid from pg_class where relnamespace in ('public'::regnamespace, 'auth'::regnamespace))
) o order by kind, name;
