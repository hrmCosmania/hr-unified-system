-- =====================================================================
--  ย้ายข้อมูลการฝึกอบรมจากโมดูลเดิมของระบบ HR (hr_db: trainingCourses / trainingEnrollments)
--  เข้าแอปฝึกอบรม (hrd_*) — เจ้าของระบบอนุมัติ 25 พ.ย. 2026
--  รันซ้ำได้: หลักสูตรใช้รหัส "HR-" + รหัสเดิม, การลงทะเบียน unique (session, employee)
--  ข้อมูลเดิมใน hr_db ไม่ถูกลบ (โมดูลเดิมถูกซ่อนแล้ว)
--  งบประมาณเดิมเป็นรายแผนก (0 บาท) — แอปฝึกอบรมตั้งงบรายบริษัท จึงไม่ย้าย
-- =====================================================================
create or replace function hrd_migrate_hr_training() returns jsonb
language plpgsql security definer set search_path = public as $$
declare c jsonb; v_course uuid; v_trainer uuid; v_session uuid; v_courses int := 0; v_enr int := 0; n int;
begin
  for c in select x from hr_db, jsonb_array_elements(coalesce(data->'trainingCourses', '[]'::jsonb)) x where id = 'main' loop
    insert into hrd_courses (code, title, category, format, level, hours, description, objectives, status)
    values ('HR-' || upper(right(c->>'id', 8)), coalesce(nullif(trim(c->>'title'), ''), 'หลักสูตร'), coalesce(nullif(c->>'category', ''), 'ทั่วไป'),
            case lower(coalesce(c->>'format', '')) when 'online' then 'e-learning' when 'ojt' then 'ojt' when 'hybrid' then 'blended' else 'classroom' end,
            'basic', coalesce(nullif(c->>'hours', '')::numeric, 0), nullif(c->>'description', ''),
            case when coalesce(c->>'objectives', '') <> '' then array[c->>'objectives'] end, 'published')
    on conflict (code) do nothing
    returning id into v_course;
    if v_course is null then continue; end if;   -- ย้ายไปแล้ว
    v_courses := v_courses + 1;

    v_trainer := null;
    if coalesce(trim(c->>'instructor'), '') <> '' then
      insert into hrd_trainers (name, type, expertise)
      values (trim(c->>'instructor'), case when coalesce(c->>'provider', '') <> '' then 'external' else 'internal' end, nullif(trim(c->>'provider'), ''))
      returning id into v_trainer;
    end if;

    insert into hrd_training_sessions (course_id, batch_no, start_date, end_date, start_time, end_time, venue, trainer_id, cost, status)
    values (v_course, 1,
            coalesce(nullif(c->>'startDate', '')::date, current_date), coalesce(nullif(c->>'endDate', '')::date, nullif(c->>'startDate', '')::date, current_date),
            coalesce(nullif(c->>'startTime', ''), '09:00')::time, coalesce(nullif(c->>'endTime', ''), '16:00')::time, nullif(c->>'location', ''), v_trainer,
            coalesce(nullif(c->>'cost', '')::numeric, 0) + coalesce(nullif(c->>'costFood', '')::numeric, 0) + coalesce(nullif(c->>'costVenue', '')::numeric, 0)
              + coalesce(nullif(c->>'costMaterials', '')::numeric, 0) + coalesce(nullif(c->>'logisticsCost', '')::numeric, 0),
            case when coalesce(nullif(c->>'endDate', '')::date, nullif(c->>'startDate', '')::date, current_date) < current_date then 'completed' else 'open' end)
    returning id into v_session;

    insert into hrd_enrollments (session_id, employee_id, status, source, attended_hours, post_score, result_note)
    select v_session, h.id,
           case when x->>'attendance' in ('Attended') or x->>'result' in ('เข้าร่วม', 'ผ่าน') then 'attended'
                when x->>'result' in ('ไม่ผ่าน') then 'failed' when x->>'attendance' in ('Absent', 'No-show') then 'no_show'
                else 'approved' end,
           'hr',
           case when x->>'attendance' in ('Attended') or x->>'result' in ('เข้าร่วม', 'ผ่าน') then coalesce(nullif(c->>'hours', '')::numeric, 0) end,
           case when x->>'score' ~ '^\d+$' then (x->>'score')::smallint end,
           nullif(concat_ws(' · ', nullif(x->>'result', ''), nullif(x->>'note', '')), '')
    from hr_db cross join jsonb_array_elements(coalesce(hr_db.data->'trainingEnrollments', '[]'::jsonb)) x
    join hrd_employees h on h.employee_code = upper(trim(x->>'employeeCode'))
    where hr_db.id = 'main' and x->>'courseId' = c->>'id'
    on conflict (session_id, employee_id) do nothing;
    get diagnostics n = row_count;
    v_enr := v_enr + n;
  end loop;
  return jsonb_build_object('courses', v_courses, 'enrollments', v_enr);
end $$;
revoke execute on function hrd_migrate_hr_training() from public, anon, authenticated;

select hrd_migrate_hr_training();
