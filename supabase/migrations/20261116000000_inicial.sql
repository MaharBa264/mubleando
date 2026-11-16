-- ════════════════════════════════════════════════════════════════════════════
-- mueblesweb · esquema inicial en la nube (Supabase / Postgres 15+)
--
-- Cada usuario ve y cambia solo lo suyo: todas las tablas llevan `user_id` y
-- reglas de acceso por fila (Row Level Security) con `user_id = auth.uid()`.
--
-- Convenciones (las mismas que el motor):
--   * Longitudes: enteros en centésimas de milímetro (1 mm = 100).
--   * Dinero: enteros en céntimos.
--   * Fechas: timestamptz (UTC).
--   * El diseño del mueble se guarda entero como JSON (cabinets.design). Las piezas
--     no se guardan: las calcula el motor (@mw/engine) en el navegador.
--
-- Simplificación respecto a replica/schema.sql: de momento no hay organizaciones
-- (talleres con varios usuarios). Se añadirán con otra migración cuando hagan falta.
-- ════════════════════════════════════════════════════════════════════════════

-- ───────────────────────── utilidades ─────────────────────────

-- Pone updated_at al guardar.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ───────────────────────── proyectos ─────────────────────────

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Para que los muebles solo puedan apuntar a proyectos del mismo usuario (ver cabinets).
  unique (id, user_id)
);
create index projects_user_updated on public.projects (user_id, updated_at desc);
create trigger projects_updated before update on public.projects
  for each row execute function public.set_updated_at();

-- ───────────────────────── bibliotecas ─────────────────────────
-- Los identificadores son texto y únicos por usuario: así los materiales y métodos
-- de partida conservan sus nombres cortos ('mel-blanco-19', 'std-ranura') en cada cuenta.

create table public.materials (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (char_length(id) between 1 and 64),
  name text not null check (char_length(name) between 1 and 120),
  kind text not null check (kind in ('panel', 'edge')),
  thickness integer not null check (thickness > 0),
  grain text not null default 'none' check (grain in ('none', 'length')),
  price_cents integer not null default 0 check (price_cents >= 0),
  color text not null default 'var(--mat-white)' check (char_length(color) <= 64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create trigger materials_updated before update on public.materials
  for each row execute function public.set_updated_at();

-- El método completo (estructura, trasera, frentes, cajones) va en `spec`, validado
-- con zod en la aplicación (methodSchema del motor) antes de guardarlo.
create table public.methods (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (char_length(id) between 1 and 64),
  name text not null check (char_length(name) between 1 and 120),
  spec jsonb not null check (jsonb_typeof(spec) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create trigger methods_updated before update on public.methods
  for each row execute function public.set_updated_at();

-- ───────────────────────── muebles ─────────────────────────

create table public.cabinets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null,
  name text not null check (char_length(name) between 1 and 120),
  method_id text not null,
  design jsonb not null check (jsonb_typeof(design) = 'object' and design ? 'root' and pg_column_size(design) < 262144),
  -- Se sube en cada guardado: dos dispositivos no se pisan (ver save_cabinet).
  rev integer not null default 1 check (rev > 0),
  quantity integer not null default 1 check (quantity between 1 and 99),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Las claves foráneas se comprueban sin reglas de acceso, así que se incluye user_id:
  -- nadie puede colgar un mueble de un proyecto o un método de otra persona.
  foreign key (project_id, user_id) references public.projects (id, user_id) on delete cascade,
  -- No se puede borrar un método que use algún mueble.
  foreign key (user_id, method_id) references public.methods (user_id, id) on delete restrict on update cascade
);
create index cabinets_project on public.cabinets (project_id, created_at);
create index cabinets_user_method on public.cabinets (user_id, method_id);
create trigger cabinets_updated before update on public.cabinets
  for each row execute function public.set_updated_at();

-- Cualquier cambio en un mueble marca su proyecto como actualizado (para ordenar la lista).
create or replace function public.touch_project()
returns trigger language plpgsql as $$
begin
  update public.projects set updated_at = now()
  where id = coalesce(new.project_id, old.project_id);
  return null;
end $$;
create trigger cabinets_touch_project after insert or update or delete on public.cabinets
  for each row execute function public.touch_project();

-- ───────────────────────── guardar con control de versión ─────────────────────────
-- Guarda los cambios de un mueble solo si nadie lo ha guardado desde que se abrió (rev).
-- Devuelve la nueva rev. Errores: MW409 = conflicto (otra rev), MW404 = no existe o no es tuyo.
-- `security invoker`: corre con los permisos del usuario, así que las reglas de acceso se aplican.

create or replace function public.save_cabinet(p_id uuid, p_rev integer, p_patch jsonb)
returns integer language plpgsql security invoker set search_path = public as $$
declare
  new_rev integer;
begin
  update public.cabinets set
    name      = coalesce(p_patch ->> 'name', name),
    method_id = coalesce(p_patch ->> 'methodId', method_id),
    quantity  = coalesce((p_patch ->> 'quantity')::integer, quantity),
    design    = coalesce(p_patch -> 'design', design),
    rev       = rev + 1
  where id = p_id and rev = p_rev
  returning rev into new_rev;

  if new_rev is null then
    if exists (select 1 from public.cabinets where id = p_id) then
      raise exception 'Este mueble se guardó desde otro sitio mientras lo editabas.' using errcode = 'MW409';
    end if;
    raise exception 'No existe ese mueble.' using errcode = 'MW404';
  end if;
  return new_rev;
end $$;

-- ───────────────────────── reglas de acceso ─────────────────────────

alter table public.projects enable row level security;
alter table public.materials enable row level security;
alter table public.methods enable row level security;
alter table public.cabinets enable row level security;

-- `(select auth.uid())` en lugar de `auth.uid()`: Postgres lo calcula una vez por consulta.
create policy projects_own on public.projects for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy materials_own on public.materials for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy methods_own on public.methods for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy cabinets_own on public.cabinets for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Solo los usuarios con sesión. Los visitantes anónimos no tocan nada.
revoke all on public.projects, public.materials, public.methods, public.cabinets from anon;
grant select, insert, update, delete on public.projects, public.materials, public.methods, public.cabinets to authenticated;
revoke all on function public.save_cabinet(uuid, integer, jsonb) from public, anon;
grant execute on function public.save_cabinet(uuid, integer, jsonb) to authenticated;
