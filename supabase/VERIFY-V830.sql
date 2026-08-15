-- SỔ TỰ HỌC V8.3.0 — CHỈ KIỂM TRA, KHÔNG THAY ĐỔI DỮ LIỆU.
-- Chạy sau PATCH-V830-CUMULATIVE-FROM-V825.sql.

select
  'device_column' as check_name,
  c.data_type,
  c.is_nullable,
  c.column_default,
  (
    c.data_type = 'boolean'
    and c.is_nullable = 'NO'
    and c.column_default = 'false'
  ) as ok
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name = 'registrations'
  and c.column_name = 'uses_electronic_device';

select
  'registration_indexes' as check_name,
  i.indexname,
  i.indexdef,
  i.indexname in (
    'idx_registrations_week_slot_active',
    'idx_registrations_student_week_active'
  ) as ok
from pg_indexes i
where i.schemaname = 'public'
  and i.tablename = 'registrations'
  and i.indexname in (
    'idx_registrations_week_slot_active',
    'idx_registrations_student_week_active'
  )
order by i.indexname;

select
  'registration_policies' as check_name,
  p.policyname,
  p.cmd,
  p.roles,
  p.qual,
  p.with_check,
  p.policyname in (
    'registrations_select',
    'registrations_student_insert',
    'registrations_student_update',
    'registrations_teacher_update'
  ) as ok
from pg_policies p
where p.schemaname = 'public'
  and p.tablename = 'registrations'
order by p.policyname;

select
  'security_definer_search_path' as check_name,
  n.nspname as function_schema,
  p.proname as function_name,
  p.prosecdef as is_security_definer,
  p.proconfig,
  (
    not p.prosecdef
    or coalesce(array_to_string(p.proconfig, ','), '') like '%search_path=public%'
  ) as ok
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'current_app_role',
    'current_app_class',
    'can_view_student',
    'registration_deadline_for_slot',
    'week_registration_is_open',
    'study_session_start',
    'registration_emergency_flag_matches'
  )
order by p.proname;

select
  'sample_session_totals' as check_name,
  r.week_id,
  r.weekday,
  r.period_number,
  count(distinct r.student_id) filter (
    where r.is_deleted = false
      and r.status in ('submitted','needs_revision','approved')
  ) as registered_count,
  count(distinct r.student_id) filter (
    where r.is_deleted = false
      and r.status in ('submitted','needs_revision','approved')
      and r.uses_electronic_device = true
  ) as device_count
from public.registrations r
group by r.week_id, r.weekday, r.period_number
order by r.week_id desc, r.weekday, r.period_number
limit 30;


select
  'function_execute_privileges' as check_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as identity_args,
  has_function_privilege('anon', p.oid, 'execute') as anon_execute,
  has_function_privilege('authenticated', p.oid, 'execute') as authenticated_execute,
  not has_function_privilege('anon', p.oid, 'execute') as ok
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef
order by p.proname, pg_get_function_identity_arguments(p.oid);
