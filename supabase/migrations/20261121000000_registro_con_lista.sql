-- ════════════════════════════════════════════════════════════════════════════
-- Registro solo para mails autorizados (issue #2).
--
-- · app_admins: cuentas que administran la app. Solo ven y editan la lista de mails.
-- · signup_allowlist: mails que pueden crear una cuenta.
-- · Un disparador sobre auth.users rechaza el alta de un mail que no está en la lista. Está en la
--   base de datos, así que no se puede saltear llamando a Supabase desde fuera de la app.
--
-- Arranque: mientras no haya ningún administrador (un proyecto nuevo), el registro queda abierto y
-- la primera cuenta que se crea pasa a ser administradora. Si ya hay cuentas al aplicar esta
-- migración, la más antigua pasa a ser administradora. Las cuentas que ya existen no se tocan.
-- ════════════════════════════════════════════════════════════════════════════

create table public.app_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.signup_allowlist (
  email text primary key check (email = lower(btrim(email)) and email like '%_@_%'),
  note text not null default '' check (char_length(note) <= 200),
  added_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ¿La cuenta que hace la consulta es administradora? Con los permisos del dueño, para poder leer
-- app_admins desde las reglas de acceso sin que cada usuario vea la tabla entera.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select exists (select 1 from public.app_admins where user_id = auth.uid()) $$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

alter table public.app_admins enable row level security;
alter table public.signup_allowlist enable row level security;

-- Cada cuenta puede ver si ella misma es administradora (la app lo usa para mostrar el menú).
create policy app_admins_self on public.app_admins for select to authenticated
  using (user_id = auth.uid());
grant select on public.app_admins to authenticated;

create policy allowlist_admin on public.signup_allowlist for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
grant select, insert, update, delete on public.signup_allowlist to authenticated;

-- ── Control del alta ──
create function public.check_signup_allowed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.app_admins) then
    return new; -- proyecto sin administrador: registro abierto (ver arranque, arriba)
  end if;
  if new.email is null or not exists (
    select 1 from public.signup_allowlist where email = lower(btrim(new.email))
  ) then
    raise exception 'MW403: este mail no tiene permiso para registrarse' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke all on function public.check_signup_allowed() from public, anon, authenticated;

create trigger signup_allowlist_check
  before insert on auth.users
  for each row execute function public.check_signup_allowed();

-- La primera cuenta de un proyecto sin administrador pasa a serlo.
create function public.first_user_is_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.app_admins) then
    insert into public.app_admins (user_id) values (new.id);
  end if;
  return null;
end $$;
revoke all on function public.first_user_is_admin() from public, anon, authenticated;

create trigger first_user_is_admin
  after insert on auth.users
  for each row execute function public.first_user_is_admin();

-- Si ya hay cuentas, la más antigua es la administradora.
insert into public.app_admins (user_id)
select id from auth.users order by created_at nulls last, id limit 1;

-- ── Para la pantalla de administración ──

-- Lista de mails autorizados, con la fecha de alta de la cuenta si ya se registró.
create function public.admin_allowlist()
returns table (email text, note text, created_at timestamptz, registered_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'MW403: solo para administradores' using errcode = '42501';
  end if;
  return query
    select a.email, a.note, a.created_at, u.created_at
    from public.signup_allowlist a
    left join auth.users u on lower(u.email) = a.email
    order by a.created_at desc, a.email;
end $$;
revoke all on function public.admin_allowlist() from public, anon;
grant execute on function public.admin_allowlist() to authenticated;

-- Cuentas que existen (para saber quién se registró antes de la lista).
create function public.admin_accounts()
returns table (email text, created_at timestamptz, last_sign_in_at timestamptz, is_admin boolean, allowed boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'MW403: solo para administradores' using errcode = '42501';
  end if;
  return query
    select u.email::text, u.created_at, u.last_sign_in_at,
           exists (select 1 from public.app_admins ad where ad.user_id = u.id),
           exists (select 1 from public.signup_allowlist a where a.email = lower(u.email))
    from auth.users u
    order by u.created_at;
end $$;
revoke all on function public.admin_accounts() from public, anon;
grant execute on function public.admin_accounts() to authenticated;
