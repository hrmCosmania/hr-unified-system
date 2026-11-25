-- =====================================================================
-- KPI / Competency จากแอปหลัก (hr_db: kpiDefinitions, competencyDictionary, competencies) → GrowTogether (schema pm)
-- เจ้าของระบบขอ 25 พ.ย. 2026: "การบริหารผลการปฏิบัติงานไม่ดึงค่า KPI Competency มาแสดง"
--   kpiDefinitions[]        → pm.kpi_library (source='hr') + pm.position_kpis (น้ำหนัก/เป้า/สูตร/เกณฑ์ 1–5 ต่อตำแหน่ง)
--   competencyDictionary[]  → pm.competencies (source='hr', คำอธิบายระดับ 1–5 ใน levels)
--   competencies[]          → pm.position_competencies (ระดับที่คาดหวัง + น้ำหนัก ต่อตำแหน่ง)
-- ผูกตำแหน่งด้วย Job Code (pm.positions.code) — "CILWH002,3" = CILWH002 และ CILWH003
-- รันอัตโนมัติเมื่อแก้ KPI/Competency/JD ในแอปหลัก (hr_db_sync_subapps)
-- ข้อมูลตัวอย่างเดิมของ GrowTogether (source='pm') ไม่ถูกลบ; KPI จากแอปหลักที่ถูกลบออก → is_active=false (เป้าหมายเดิมยังอ้างถึงได้)
-- =====================================================================
alter table pm.kpi_library add column if not exists source text not null default 'pm';
alter table pm.competencies add column if not exists source text not null default 'pm';
alter table pm.competencies add column if not exists levels jsonb;

create table if not exists pm.position_kpis (
  position_id uuid not null references pm.positions(id) on delete cascade,
  kpi_id uuid not null references pm.kpi_library(id) on delete cascade,
  weight numeric,
  target_text text,
  formula text,
  frequency text,
  perspective text,
  data_source_text text,
  rating_desc jsonb,          -- ["เกณฑ์ระดับ 1", ..., "เกณฑ์ระดับ 5"]
  primary key (position_id, kpi_id)
);
alter table pm.position_kpis enable row level security;
drop policy if exists read_all_position_kpis on pm.position_kpis;
create policy read_all_position_kpis on pm.position_kpis for select to authenticated using (true);
drop policy if exists hr_admin_write_position_kpis on pm.position_kpis;
create policy hr_admin_write_position_kpis on pm.position_kpis for all to authenticated
  using (pm.has_role('hr_admin'::pm.app_role)) with check (pm.has_role('hr_admin'::pm.app_role));
grant select on pm.position_kpis to authenticated;
grant all on pm.position_kpis to service_role;

-- "CILWH002,3" → {CILWH002, CILWH003} · "A001, A002" → {A001, A002}
create or replace function pm.expand_job_codes(p text) returns text[]
language sql immutable set search_path = pm, public as $$
  with parts as (
    select trim(x) part, ord from unnest(string_to_array(upper(coalesce(p, '')), ',')) with ordinality t(x, ord)
  ), first as (select part from parts where ord = 1)
  select coalesce(array_agg(distinct code) filter (where code <> ''), '{}') from (
    select case when ord = 1 or length(part) >= length((select part from first)) then part
                else left((select part from first), length((select part from first)) - length(part)) || part end code
    from parts where part <> ''
  ) s
$$;

create or replace function pm.apply_hr_framework() returns jsonb
language plpgsql security definer set search_path = pm, public as $$
declare d jsonb; n_kpi int := 0; n_pk int := 0; n_comp int := 0; n_pc int := 0;
begin
  select data into d from public.hr_db where id = 'main';
  if d is null then return '{}'::jsonb; end if;

  -- 1) พจนานุกรม Competency
  insert into pm.competencies (code, name_th, name_en, category, description, levels, is_active, source)
  select distinct on (upper(trim(x->>'code'))) upper(trim(x->>'code')), coalesce(nullif(trim(x->>'name'), ''), x->>'code'), nullif(trim(x->>'nameEn'), ''),
         (case lower(coalesce(x->>'type', '')) when 'core' then 'core' when 'managerial' then 'leadership' when 'leadership' then 'leadership' else 'functional' end)::pm.competency_category,
         nullif(trim(x->>'definition'), ''),
         jsonb_build_array(x->>'level1', x->>'level2', x->>'level3', x->>'level4', x->>'level5'), true, 'hr'
  from jsonb_array_elements(coalesce(d->'competencyDictionary', '[]')) x
  where coalesce(trim(x->>'code'), '') <> ''
  on conflict (code) do update set name_th = excluded.name_th, name_en = excluded.name_en, category = excluded.category,
    description = excluded.description, levels = excluded.levels, is_active = true, source = 'hr';
  get diagnostics n_comp = row_count;
  -- Competency ที่ใช้ในตำแหน่งแต่ไม่มีในพจนานุกรม
  insert into pm.competencies (code, name_th, name_en, category, is_active, source)
  select distinct on (upper(trim(x->>'code'))) upper(trim(x->>'code')), coalesce(nullif(trim(x->>'name'), ''), x->>'code'), nullif(trim(x->>'nameEn'), ''),
         (case lower(coalesce(x->>'type', '')) when 'core' then 'core' when 'managerial' then 'leadership' when 'leadership' then 'leadership' else 'functional' end)::pm.competency_category,
         true, 'hr'
  from jsonb_array_elements(coalesce(d->'competencies', '[]')) x
  where coalesce(trim(x->>'code'), '') <> ''
  on conflict (code) do nothing;

  -- 2) Competency ต่อตำแหน่ง (สร้างใหม่ทั้งหมดจากแอปหลัก)
  delete from pm.position_competencies pc using pm.competencies c where c.id = pc.competency_id and c.source = 'hr';
  insert into pm.position_competencies (position_id, competency_id, required_level, weight)
  select distinct on (p.id, c.id) p.id, c.id,
         least(5, greatest(1, coalesce(nullif(regexp_replace(coalesce(x->>'expectedLevel', ''), '\D', '', 'g'), '')::int, 3))),
         nullif(regexp_replace(coalesce(x->>'weight', ''), '[^0-9.]', '', 'g'), '')::numeric
  from jsonb_array_elements(coalesce(d->'competencies', '[]')) x
  cross join lateral unnest(pm.expand_job_codes(x->>'jobCode')) jc(code)
  join pm.positions p on upper(p.code) = jc.code
  join pm.competencies c on c.code = upper(trim(x->>'code'));
  get diagnostics n_pc = row_count;

  -- 3) คลัง KPI
  insert into pm.kpi_library (code, name_th, description, unit, direction, data_source, aggregation, is_active, source)
  select distinct on (upper(trim(x->>'code'))) upper(trim(x->>'code')), coalesce(nullif(trim(x->>'name'), ''), x->>'code'),
         nullif(trim(x->>'definition'), ''), coalesce(nullif(trim(x->>'unit'), ''), '-'),
         (case when coalesce(x->>'rating1', '') ~ '(เกิน|มากกว่า|สูงกว่า|ขึ้นไป)' and coalesce(x->>'rating5', '') ~ '(ไม่เกิน|น้อยกว่า|ต่ำกว่า|ภายใน)'
               then 'lower_better' else 'higher_better' end)::pm.kpi_direction,
         'manual'::pm.data_source, 'avg', true, 'hr'
  from jsonb_array_elements(coalesce(d->'kpiDefinitions', '[]')) x
  where coalesce(trim(x->>'code'), '') <> ''
  on conflict (code) do update set name_th = excluded.name_th, description = excluded.description, unit = excluded.unit,
    direction = excluded.direction, is_active = true, source = 'hr';
  get diagnostics n_kpi = row_count;
  update pm.kpi_library k set is_active = false
  where k.source = 'hr' and not exists (
    select 1 from jsonb_array_elements(coalesce(d->'kpiDefinitions', '[]')) x where upper(trim(x->>'code')) = k.code);

  -- 4) KPI ต่อตำแหน่ง (สร้างใหม่ทั้งหมดจากแอปหลัก)
  delete from pm.position_kpis pk using pm.kpi_library k where k.id = pk.kpi_id and k.source = 'hr';
  insert into pm.position_kpis (position_id, kpi_id, weight, target_text, formula, frequency, perspective, data_source_text, rating_desc)
  select distinct on (p.id, k.id) p.id, k.id,
         nullif(regexp_replace(coalesce(x->>'weight', ''), '[^0-9.]', '', 'g'), '')::numeric,
         nullif(trim(x->>'target'), ''), nullif(trim(x->>'formula'), ''), nullif(trim(x->>'frequency'), ''),
         nullif(trim(x->>'perspective'), ''), nullif(trim(x->>'dataSource'), ''),
         jsonb_build_array(x->>'rating1', x->>'rating2', x->>'rating3', x->>'rating4', x->>'rating5')
  from jsonb_array_elements(coalesce(d->'kpiDefinitions', '[]')) x
  cross join lateral unnest(pm.expand_job_codes(x->>'jobCode')) jc(code)
  join pm.positions p on upper(p.code) = jc.code
  join pm.kpi_library k on k.code = upper(trim(x->>'code'));
  get diagnostics n_pk = row_count;

  return jsonb_build_object('kpi', n_kpi, 'position_kpis', n_pk, 'competencies', n_comp, 'position_competencies', n_pc);
end $$;
revoke execute on function pm.apply_hr_framework() from public, anon, authenticated;
revoke execute on function pm.expand_job_codes(text) from public, anon;

-- ซิงก์เมื่อพนักงานเปลี่ยน (ตำแหน่งใหม่) หรือ KPI/Competency/JD เปลี่ยน
create or replace function public.hr_db_sync_subapps()
 returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare emp_changed boolean; fw_changed boolean;
begin
  if new.id <> 'main' then return new; end if;
  emp_changed := tg_op = 'INSERT' or (new.data->'employees') is distinct from (old.data->'employees');
  fw_changed := tg_op = 'INSERT' or emp_changed
    or (new.data->'kpiDefinitions') is distinct from (old.data->'kpiDefinitions')
    or (new.data->'competencies') is distinct from (old.data->'competencies')
    or (new.data->'competencyDictionary') is distinct from (old.data->'competencyDictionary');
  if emp_changed then
    if to_regprocedure('public.hrd_apply_hr_db()') is not null then
      begin perform hrd_apply_hr_db();
      exception when others then raise warning 'hr_db → hrd sync failed: %', sqlerrm; end;
    end if;
    if to_regprocedure('pm.apply_hr_db()') is not null then
      begin perform pm.apply_hr_db();
      exception when others then raise warning 'hr_db → pm sync failed: %', sqlerrm; end;
    end if;
    if to_regprocedure('public.er_apply_hr_db()') is not null then
      begin perform er_apply_hr_db();
      exception when others then raise warning 'hr_db → er sync failed: %', sqlerrm; end;
    end if;
  end if;
  if fw_changed and to_regprocedure('pm.apply_hr_framework()') is not null then
    begin perform pm.apply_hr_framework();
    exception when others then raise warning 'hr_db → pm KPI/Competency sync failed: %', sqlerrm; end;
  end if;
  return new;
end $function$;

select pm.apply_hr_framework();
