-- SỔ TỰ HỌC V8.3.0
-- BẢN VÁ CỘNG DỒN CHO CƠ SỞ DỮ LIỆU ĐÃ Ở V8.2.5.
--
-- AN TOÀN DỮ LIỆU:
-- - Không xóa bảng, tài khoản hay đăng ký.
-- - Bổ sung cờ thiết bị với mặc định false cho dữ liệu cũ.
-- - Chuẩn hóa policy cuối cùng để không có nhiều policy cùng mở rộng quyền.
--
-- Trước khi chạy: sao lưu Supabase.
-- Sau khi chạy: chạy VERIFY-V830.sql.

begin;

alter table public.registrations
  add column if not exists uses_electronic_device boolean not null default false;

comment on column public.registrations.uses_electronic_device is
  'Học sinh khai báo có sử dụng thiết bị điện tử trong buổi tự học hay không.';

create index if not exists idx_registrations_week_slot_active
  on public.registrations (week_id, weekday, period_number, status)
  where is_deleted = false;

create index if not exists idx_registrations_student_week_active
  on public.registrations (student_id, week_id)
  where is_deleted = false;

-- Một policy SELECT duy nhất:
-- chủ bản ghi đọc đăng ký của mình; cán sự/GV chỉ đọc bản đã gửi mà họ được phép xem.
drop policy if exists registrations_select_v830 on public.registrations;
drop policy if exists registrations_select on public.registrations;

create policy registrations_select
on public.registrations
for select
to authenticated
using (
  is_deleted = false
  and (
    (
      student_id = (select auth.uid())
      and public.current_app_role() in ('student','monitor')
    )
    or (
      status <> 'draft'
      and public.can_view_student(student_id)
    )
  )
);

-- Đăng ký thường: học sinh/cán sự chỉ tạo cho chính mình, không giả cờ khẩn cấp.
drop policy if exists registrations_student_insert_v830 on public.registrations;
drop policy if exists registrations_student_insert on public.registrations;

create policy registrations_student_insert
on public.registrations
for insert
to authenticated
with check (
  public.current_app_role() in ('student','monitor')
  and student_id = (select auth.uid())
  and is_deleted = false
  and is_emergency = false
  and (
    status in ('draft','submitted')
    or (
      status = 'approved'
      and approval_source = 'auto_rule'
      and public.smart_approval_is_enabled()
      and exists (
        select 1
        from public.smart_review_registration(content,note) s
        where s.auto_approve = true
      )
    )
  )
  and public.week_registration_is_open(week_id)
  and (
    public.registration_deadline_for_slot(week_id,weekday) is null
    or now() <= public.registration_deadline_for_slot(week_id,weekday)
  )
);

-- Sửa đăng ký: giữ nguyên luật V8.2.5, gồm sửa bản approved trước hạn và
-- sửa needs_revision sau hạn. Cờ khẩn cấp không được đổi từ trình duyệt.
drop policy if exists registrations_student_update_v830 on public.registrations;
drop policy if exists registrations_student_update on public.registrations;

create policy registrations_student_update
on public.registrations
for update
to authenticated
using (
  public.current_app_role() in ('student','monitor')
  and student_id = (select auth.uid())
  and is_deleted = false
  and status in ('draft','submitted','needs_revision','approved')
  and (
    status = 'needs_revision'
    or (
      public.week_registration_is_open(week_id)
      and (
        public.registration_deadline_for_slot(week_id,weekday) is null
        or now() <= public.registration_deadline_for_slot(week_id,weekday)
      )
      and now() < public.study_session_start(week_id,weekday,period_number)
    )
  )
)
with check (
  public.current_app_role() in ('student','monitor')
  and student_id = (select auth.uid())
  and is_deleted = false
  and public.registration_emergency_flag_matches(id,is_emergency)
  and (
    status in ('draft','submitted')
    or (
      status = 'approved'
      and approval_source = 'auto_rule'
      and public.smart_approval_is_enabled()
      and exists (
        select 1
        from public.smart_review_registration(content,note) s
        where s.auto_approve = true
      )
    )
  )
);

-- Giáo viên giữ quyền quản lý; cán sự không thỏa is_teacher().
drop policy if exists registrations_teacher_update_v830 on public.registrations;
drop policy if exists registrations_teacher_update on public.registrations;

create policy registrations_teacher_update
on public.registrations
for update
to authenticated
using (public.is_teacher())
with check (public.is_teacher());

revoke all on table public.registrations from anon;
grant select, insert, update on table public.registrations to authenticated;


-- V8.3.0 least-privilege execution matrix for SECURITY DEFINER helpers.
-- Reset inherited/default grants first, then restore only policy/server call paths.
revoke execute on function public.ai_auto_approve_threshold() from public, anon, authenticated, service_role;
revoke execute on function public.ai_review_is_enabled() from public, anon, authenticated, service_role;
revoke execute on function public.apply_smart_approval() from public, anon, authenticated, service_role;
revoke execute on function public.can_view_class() from public, anon, authenticated, service_role;
revoke execute on function public.can_view_student(uuid) from public, anon, authenticated, service_role;
revoke execute on function public.current_app_class() from public, anon, authenticated, service_role;
revoke execute on function public.current_app_role() from public, anon, authenticated, service_role;
revoke execute on function public.handle_new_user() from public, anon, authenticated, service_role;
revoke execute on function public.is_teacher() from public, anon, authenticated, service_role;
revoke execute on function public.registration_deadline_for_slot(uuid,integer) from public, anon, authenticated, service_role;
revoke execute on function public.registration_emergency_flag_matches(uuid,boolean) from public, anon, authenticated, service_role;
revoke execute on function public.smart_approval_is_enabled() from public, anon, authenticated, service_role;
revoke execute on function public.smart_review_registration(text,text) from public, anon, authenticated, service_role;
revoke execute on function public.smart_review_route(text,text) from public, anon, authenticated, service_role;
revoke execute on function public.study_session_start(uuid,integer,integer) from public, anon, authenticated, service_role;
revoke execute on function public.sync_teacher_review_notification() from public, anon, authenticated, service_role;
revoke execute on function public.week_registration_is_open(uuid) from public, anon, authenticated, service_role;

grant execute on function public.current_app_role() to authenticated;
grant execute on function public.is_teacher() to authenticated;
grant execute on function public.can_view_student(uuid) to authenticated;
grant execute on function public.registration_deadline_for_slot(uuid,integer) to authenticated;
grant execute on function public.registration_emergency_flag_matches(uuid,boolean) to authenticated;
grant execute on function public.smart_approval_is_enabled() to authenticated;
grant execute on function public.smart_review_registration(text,text) to authenticated;
grant execute on function public.study_session_start(uuid,integer,integer) to authenticated;
grant execute on function public.week_registration_is_open(uuid) to authenticated;

grant execute on function public.registration_deadline_for_slot(uuid,integer) to service_role;
grant execute on function public.study_session_start(uuid,integer,integer) to service_role;

commit;

notify pgrst, 'reload schema';
