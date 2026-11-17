-- ════════════════════════════════════════════════════════════════════════════
-- Arreglo: no se podía borrar una cuenta que tuviera muebles.
--
-- Causa (registro de Supabase, 17-11-2026): "permission denied for table projects".
-- Al borrar una cuenta, Supabase borra el usuario con un rol interno (supabase_auth_admin)
-- que no tiene permisos sobre nuestras tablas. El borrado en cascada de cada mueble dispara
-- touch_project(), que actualiza la fecha de su proyecto, y lo hacía con los permisos de ese
-- rol interno, así que fallaba la operación entera.
--
-- Solución: touch_project() se ejecuta con los permisos de su dueño (security definer), el
-- mismo que es dueño de las tablas. No da más acceso a nadie: solo cambia updated_at del
-- proyecto del mueble que se acaba de crear, cambiar o borrar, una fila que ya ha pasado las
-- reglas de acceso de quien hizo el cambio.
--
-- (La migración 20261116000001 cambió la clave foránea de los métodos pensando que era la
-- causa. No lo era, pero el cambio es inocuo y se mantiene.)
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.touch_project()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.projects set updated_at = now()
  where id = coalesce(new.project_id, old.project_id);
  return null;
end $$;

-- Una función de disparador no se puede llamar directamente, pero por si acaso:
revoke all on function public.touch_project() from public, anon, authenticated;
