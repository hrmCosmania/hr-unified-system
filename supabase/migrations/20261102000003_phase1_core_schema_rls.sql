-- ===== Phase 1: core schema + role-based RLS (CMN/CIL) + audit log =====
-- ไม่แตะ public.hr_db / ยังไม่ย้ายข้อมูลจริงในขั้นนี้

create type public.app_role as enum ('employee','manager','hr','admin');

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code in ('CMN','CIL')),
  name_th text not null,
  name_en text not null
);
insert into public.companies (code, name_th, name_en) values
  ('CMN','คอสเมเนีย แลบอราทอรี่ส์','Cosmania Laboratories'),
  ('CIL','คอสซูติค อินโนเวชั่น แลบอราทอรี่ส์','Cosceutic Innovation Laboratories');

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  emp_code text not null,
  full_name text not null,
  nickname text,
  department text,
  position text,
  job_code text,
  level text,
  supervisor_id uuid references public.employees(id) on delete set null,
  start_date date,
  probation_days int,
  status text not null default 'Active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, emp_code)
);
create index employees_company_idx on public.employees(company_id);
create index employees_supervisor_idx on public.employees(supervisor_id);

-- PII แยกตาราง: hr/admin ของบริษัท, เจ้าของข้อมูลเอง, หัวหน้าในสายบังคับบัญชา (อ่านอย่างเดียว)
create table public.employee_pii (
  employee_id uuid primary key references public.employees(id) on delete cascade,
  company_id uuid not null references public.companies(id),
  email text,
  phone text,
  birth_date date,
  updated_at timestamptz not null default now()
);
create index employee_pii_company_idx on public.employee_pii(company_id);

create table public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  employee_id uuid unique references public.employees(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id),
  role public.app_role not null,
  primary key (user_id, company_id, role)
);
create index user_roles_company_idx on public.user_roles(company_id);

create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid,
  table_name text not null,
  row_pk text,
  action text not null,
  company_id uuid,
  old_data jsonb,
  new_data jsonb
);
create index audit_log_company_at_idx on public.audit_log(company_id, at desc);

-- helper functions (schema private, SECURITY DEFINER เพื่อเลี่ยง RLS recursion)
grant usage on schema private to authenticated;

create function private.has_role(_company uuid, _roles public.app_role[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid()) and company_id = _company and role = any(_roles)
  );
$$;

create function private.my_employee_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select employee_id from public.user_profiles where user_id = (select auth.uid());
$$;

-- true ถ้า "ฉัน" อยู่เหนือพนักงาน _emp ในสายบังคับบัญชา (ไม่นับตัวเอง) ใช้ UNION กัน cycle
create function private.is_my_report(_emp uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  with recursive chain(id, supervisor_id) as (
    select e.id, e.supervisor_id from public.employees e where e.id = _emp
    union
    select e.id, e.supervisor_id from public.employees e join chain c on e.id = c.supervisor_id
  )
  select exists (select 1 from chain where id = private.my_employee_id() and id <> _emp);
$$;

create function private.audit_row()
returns trigger language plpgsql security definer set search_path = '' as $$
declare rec jsonb := to_jsonb(coalesce(new, old));
begin
  insert into public.audit_log (actor, table_name, row_pk, action, company_id, old_data, new_data)
  values ((select auth.uid()), tg_table_name,
          coalesce(rec->>'id', rec->>'employee_id', rec->>'user_id'), tg_op,
          nullif(rec->>'company_id','')::uuid,
          case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
          case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end);
  return coalesce(new, old);
end $$;

revoke execute on all functions in schema private from public, anon;
grant execute on function private.has_role(uuid, public.app_role[]) to authenticated;
grant execute on function private.my_employee_id() to authenticated;
grant execute on function private.is_my_report(uuid) to authenticated;

create trigger audit_employees after insert or update or delete on public.employees
  for each row execute function private.audit_row();
create trigger audit_employee_pii after insert or update or delete on public.employee_pii
  for each row execute function private.audit_row();
create trigger audit_user_roles after insert or update or delete on public.user_roles
  for each row execute function private.audit_row();

-- grants: ปิด default ของ Supabase แล้วเปิดเท่าที่จำเป็น
revoke all on public.companies, public.employees, public.employee_pii,
              public.user_profiles, public.user_roles, public.audit_log from anon, authenticated;
grant select on public.companies, public.user_profiles, public.user_roles, public.audit_log to authenticated;
grant select, insert, update, delete on public.employees, public.employee_pii to authenticated;

alter table public.companies enable row level security;
alter table public.employees enable row level security;
alter table public.employee_pii enable row level security;
alter table public.user_profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.audit_log enable row level security;

create policy companies_select on public.companies for select to authenticated
  using (private.has_role(id, array['employee','manager','hr','admin']::public.app_role[]));

create policy employees_select on public.employees for select to authenticated
  using (private.has_role(company_id, array['employee','manager','hr','admin']::public.app_role[]));
create policy employees_insert on public.employees for insert to authenticated
  with check (private.has_role(company_id, array['hr','admin']::public.app_role[]));
create policy employees_update on public.employees for update to authenticated
  using (private.has_role(company_id, array['hr','admin']::public.app_role[]))
  with check (private.has_role(company_id, array['hr','admin']::public.app_role[]));
create policy employees_delete on public.employees for delete to authenticated
  using (private.has_role(company_id, array['admin']::public.app_role[]));

create policy pii_select on public.employee_pii for select to authenticated
  using (
    private.has_role(company_id, array['hr','admin']::public.app_role[])
    or employee_id = private.my_employee_id()
    or private.is_my_report(employee_id)
  );
create policy pii_insert on public.employee_pii for insert to authenticated
  with check (private.has_role(company_id, array['hr','admin']::public.app_role[]));
create policy pii_update on public.employee_pii for update to authenticated
  using (private.has_role(company_id, array['hr','admin']::public.app_role[]))
  with check (private.has_role(company_id, array['hr','admin']::public.app_role[]));
create policy pii_delete on public.employee_pii for delete to authenticated
  using (private.has_role(company_id, array['admin']::public.app_role[]));

create policy profiles_select_own on public.user_profiles for select to authenticated
  using (user_id = (select auth.uid()));
create policy roles_select_own on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()));

create policy audit_select on public.audit_log for select to authenticated
  using (company_id is not null and private.has_role(company_id, array['hr','admin']::public.app_role[]));

-- bootstrap: ผู้ดูแลระบบคนเดียวที่มีอยู่ เป็น admin ของทั้งสองบริษัท
insert into public.user_roles (user_id, company_id, role)
select 'fcea8d7d-ed42-4c79-9710-1c30de7b2a31'::uuid, c.id, 'admin'
from public.companies c
where exists (select 1 from auth.users u where u.id = 'fcea8d7d-ed42-4c79-9710-1c30de7b2a31'::uuid);
