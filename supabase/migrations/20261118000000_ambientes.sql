-- ════════════════════════════════════════════════════════════════════════════
-- Ambientes: la planta de una habitación (paredes, aberturas) y los muebles colocados en ella.
--
-- Un proyecto puede tener varios ambientes. La planta se guarda entera como JSON (rooms.plan),
-- validada en la aplicación (roomPlanSchema del motor). Los muebles colocados apuntan a muebles
-- del mismo proyecto por su id, dentro del JSON: si se borra un mueble, la app avisa de que su
-- colocación quedó sin mueble.
--
-- Misma idea que cabinets: cada fila es de un usuario (reglas de acceso por fila), se guarda con
-- control de versión (save_room) y tocar un ambiente actualiza la fecha de su proyecto.
-- ════════════════════════════════════════════════════════════════════════════

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null,
  name text not null check (char_length(name) between 1 and 120),
  plan jsonb not null check (jsonb_typeof(plan) = 'object' and plan ? 'corners' and pg_column_size(plan) < 1048576),
  rev integer not null default 1 check (rev > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Solo en proyectos del mismo usuario (las claves foráneas no pasan por las reglas de acceso).
  foreign key (project_id, user_id) references public.projects (id, user_id) on delete cascade
);
create index rooms_project on public.rooms (project_id, created_at);
create trigger rooms_updated before update on public.rooms
  for each row execute function public.set_updated_at();
-- touch_project() es security definer (ver 20261117000000): funciona también al borrar la cuenta.
create trigger rooms_touch_project after insert or update or delete on public.rooms
  for each row execute function public.touch_project();

-- Guardar con control de versión: MW409 = conflicto, MW404 = no existe o no es tuyo.
create or replace function public.save_room(p_id uuid, p_rev integer, p_patch jsonb)
returns integer language plpgsql security invoker set search_path = public as $$
declare
  new_rev integer;
begin
  update public.rooms set
    name = coalesce(p_patch ->> 'name', name),
    plan = coalesce(p_patch -> 'plan', plan),
    rev  = rev + 1
  where id = p_id and rev = p_rev
  returning rev into new_rev;

  if new_rev is null then
    if exists (select 1 from public.rooms where id = p_id) then
      raise exception 'Este ambiente se guardó desde otro sitio mientras lo editabas.' using errcode = 'MW409';
    end if;
    raise exception 'No existe ese ambiente.' using errcode = 'MW404';
  end if;
  return new_rev;
end $$;

alter table public.rooms enable row level security;
create policy rooms_own on public.rooms for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.rooms from anon;
grant select, insert, update, delete on public.rooms to authenticated;
revoke all on function public.save_room(uuid, integer, jsonb) from public, anon;
grant execute on function public.save_room(uuid, integer, jsonb) to authenticated;
