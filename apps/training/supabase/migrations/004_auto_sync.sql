-- =====================================================================
--  เชื่อมทุกแอปย่อยกับฐานข้อมูลพนักงานของระบบ HR รวมศูนย์ (อัตโนมัติ)
--
--  ลำดับ: 001–003 → apps/performance/supabase/migrations/20261125000800_hr_unified_sync.sql → ไฟล์นี้
--
--  1) hrd_apply_hr_db()  ซิงก์ hr_db → hrd_* (แทนที่ตัวเดิมใน 003 ที่ใช้ temp table และเรียก
--     hrd_upsert_employees ซึ่งตรวจสิทธิ์ — ตัวนี้ใช้ภายในฐานข้อมูล จึงเรียกจาก trigger ได้)
--     hrd_sync_from_hrm()  = ปุ่ม/การซิงก์ตอนเปิดแอป (เฉพาะ HR) เรียกตัวนี้
--  2) trigger บน hr_db: ทุกครั้งที่ระบบ HR บันทึกแล้วรายชื่อพนักงานเปลี่ยน → ซิงก์แอปฝึกอบรม
--     และ GrowTogether ทันที (ถ้าซิงก์ผิดพลาด การบันทึกของระบบ HR ยังสำเร็จตามปกติ)
--     ระบบเงินเดือนยังซิงก์เองตอนเปิดแอป (เก็บรายชื่อใน plfl_doc ร่วมกับข้อมูลเฉพาะของระบบเงินเดือน)
-- =====================================================================

create or replace function hrd_apply_hr_db() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_ins int := 0; v_upd int := 0; v_resigned int := 0; v_linked int := 0;
begin
  if not exists (select 1 from hr_db where id = 'main') then
    return jsonb_build_object('error', 'ไม่พบฐานข้อมูลระบบ HR');
  end if;

  insert into hrd_business_units (code, name)
  select distinct r.company, 'บริษัท ' || r.company from hr_db_employee_rows() r where r.company is not null
  on conflict (code) do nothing;

  insert into hrd_departments (code, name, business_unit_id)
  select distinct on (d.code) d.code, d.department, (select id from hrd_business_units b where b.code = d.company)
  from (select coalesce(r.company, '') || '-' || r.department as code, r.department, r.company
        from hr_db_employee_rows() r where r.department is not null) d
  on conflict (code) do update set name = excluded.name, business_unit_id = excluded.business_unit_id;

  insert into hrd_positions (code, name, job_level, career_track)
  select distinct on (p.code) p.code, p.title, p.lvl, case when p.lvl >= 4 then 'management' else 'operation' end
  from (select coalesce(r.job_code, coalesce(r.company, '') || '-' || r.position_name) as code,
               coalesce(r.position_name, r.job_code) as title, hrd_level_rank(r.level_code) as lvl
        from hr_db_employee_rows() r where coalesce(r.job_code, r.position_name) is not null) p
  order by p.code, p.lvl desc
  on conflict (code) do update set name = excluded.name, job_level = excluded.job_level;

  with up as (
    insert into hrd_employees (employee_code, first_name, last_name, nickname, email, business_unit_id,
                               department_id, position_id, hire_date, status, synced_at)
    select distinct on (r.emp_code) r.emp_code, r.first_name, r.last_name, r.nickname, r.email,
           (select id from hrd_business_units b where b.code = r.company),
           (select id from hrd_departments d where d.code = coalesce(r.company, '') || '-' || r.department),
           (select id from hrd_positions p where p.code = coalesce(r.job_code, coalesce(r.company, '') || '-' || r.position_name)),
           r.start_date, case when r.active then 'active' else 'resigned' end, now()
    from hr_db_employee_rows() r
    order by r.emp_code, r.active desc   -- รหัสซ้ำใน HR: ใช้แถวที่ยังทำงานอยู่
    on conflict (employee_code) do update set
      first_name = excluded.first_name, last_name = excluded.last_name, nickname = excluded.nickname, email = excluded.email,
      business_unit_id = coalesce(excluded.business_unit_id, hrd_employees.business_unit_id),
      department_id = coalesce(excluded.department_id, hrd_employees.department_id),
      position_id = coalesce(excluded.position_id, hrd_employees.position_id),
      hire_date = excluded.hire_date, status = excluded.status, synced_at = now()
    returning (xmax = 0) as inserted
  )
  select count(*) filter (where inserted), count(*) filter (where not inserted) into v_ins, v_upd from up;

  update hrd_employees h set status = 'resigned', synced_at = now()
  where h.synced_at is not null and h.status <> 'resigned'
    and not exists (select 1 from hr_db_employee_rows() r where r.emp_code = h.employee_code);
  get diagnostics v_resigned = row_count;

  update hrd_employees h set manager_id = m.id
  from hr_db_employee_rows() r join hrd_employees m on m.employee_code = r.parent_code
  where h.employee_code = r.emp_code and m.id <> h.id and h.manager_id is distinct from m.id;
  update hrd_employees h set manager_id = null
  from hr_db_employee_rows() r
  where h.employee_code = r.emp_code and r.parent_code is null and h.manager_id is not null;

  update hrd_employees h set auth_user_id = u.id
  from auth.users u
  where h.auth_user_id is null and h.email is not null and lower(u.email) = h.email
    and not exists (select 1 from hrd_employees o where o.auth_user_id = u.id)
    and (select count(*) from hrd_employees d where d.email = h.email) = 1;
  get diagnostics v_linked = row_count;

  insert into hrd_sync_logs (system_code, finished_at, status, inserted, updated, message)
  values ('HR_CORE', now(), 'success', v_ins, v_upd, 'ซิงก์จากระบบ HR รวมศูนย์ (hr_db)');
  update hrd_integrations set last_sync_at = now(), records = (select count(*) from hrd_employees), status = 'connected'
   where system_code = 'HR_CORE';

  return jsonb_build_object('inserted', v_ins, 'updated', v_upd, 'resigned', v_resigned, 'linked', v_linked);
end $$;
revoke execute on function hrd_apply_hr_db() from public, anon, authenticated;

create or replace function hrd_sync_from_hrm() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not hrd_is_hr() and auth.role() <> 'service_role' then raise exception 'permission denied'; end if;
  return hrd_apply_hr_db();
end $$;
revoke execute on function hrd_sync_from_hrm() from public, anon;
grant execute on function hrd_sync_from_hrm() to authenticated, service_role;

-- ---------- ซิงก์อัตโนมัติเมื่อระบบ HR บันทึก ----------
create or replace function hr_db_sync_subapps() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.id <> 'main' then return new; end if;
  if tg_op = 'UPDATE' and (new.data->'employees') is not distinct from (old.data->'employees') then return new; end if;
  begin
    perform hrd_apply_hr_db();
  exception when others then raise warning 'hr_db → hrd sync failed: %', sqlerrm;
  end;
  if to_regprocedure('pm.apply_hr_db()') is not null then
    begin
      perform pm.apply_hr_db();
    exception when others then raise warning 'hr_db → pm sync failed: %', sqlerrm;
    end;
  end if;
  return new;
end $$;
revoke execute on function hr_db_sync_subapps() from public, anon, authenticated;

drop trigger if exists hr_db_sync_subapps on hr_db;
create trigger hr_db_sync_subapps after insert or update of data on hr_db
  for each row execute function hr_db_sync_subapps();
