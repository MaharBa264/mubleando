-- Esquema inicial: app de diseño paramétrico de muebles (nombre provisional "mueblesweb")
-- Postgres 15+ en Supabase. Acceso: Row Level Security por organización (taller).
--
-- Convenciones
--   * Longitudes: enteros en CENTÉSIMAS DE MILÍMETRO (1 mm = 100). Nada de floats en medidas.
--   * Dinero: enteros en céntimos + columna currency (ISO 4217).
--   * Fechas: timestamptz en UTC.
--   * El diseño del mueble (árbol de zonas, puertas, cajones...) se guarda como documento JSON
--     versionado (cabinets.design). Los paneles NO se guardan: los calcula el motor
--     (paquete @mw/engine) a partir del diseño + método + materiales. Solo se congelan
--     en exports.parts cuando se manda a producción, para que el taller tenga lo que se cortó.

create extension if not exists pgcrypto;

-- ───────────────────────── organizaciones y usuarios ─────────────────────────

create table orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  currency char(3) not null default 'EUR',
  units text not null default 'mm' check (units in ('mm','cm','in')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table org_members (
  org_id uuid not null references orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'designer' check (role in ('owner','designer','workshop','viewer')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index on org_members (user_id);

-- ¿El usuario actual pertenece a la org (con al menos ese rol)?
create or replace function is_member(p_org uuid, p_roles text[] default null)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from org_members m
    where m.org_id = p_org and m.user_id = auth.uid()
      and (p_roles is null or m.role = any(p_roles))
  );
$$;

-- ───────────────────────────── bibliotecas ─────────────────────────────
-- Materiales: tableros, cantos (cintas) y perfiles/barras.
create table materials (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  kind text not null check (kind in ('panel','edge','profile')),
  name text not null,
  code text,
  thickness integer not null check (thickness > 0),        -- 1/100 mm
  grain text not null default 'none' check (grain in ('none','length','width')),
  sheet_length integer, sheet_width integer,              -- tablero bruto, 1/100 mm
  price_cents integer not null default 0 check (price_cents >= 0),
  price_unit text not null default 'm2' check (price_unit in ('m2','ml','unit','sheet')),
  texture_path text,                                       -- Storage
  color_hex char(7),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sheet_dims check ((sheet_length is null) = (sheet_width is null))
);
create index on materials (org_id, kind) where not archived;
create unique index on materials (org_id, kind, lower(name)) where not archived;

-- Estilos: "Cocina blanca" = {lateral: mat A, puerta: mat B, canto puerta: mat C ...}
create table material_styles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  assignments jsonb not null default '{}',   -- { panelRole: {material_id, edges:{top,bottom,left,right}} }
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on material_styles (org_id);

-- Herrajes: bisagras, correderas, excéntricas, espigas, patas...
create table hardware (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  category text not null check (category in ('hinge','slide','connector','dowel','leg','handle','shelf_support','other')),
  name text not null,
  brand text,
  code text,
  price_cents integer not null default 0 check (price_cents >= 0),
  machining jsonb not null default '[]',     -- [{face, x, y, diameter, depth, through:bool, ...}] relativo al herraje
  params jsonb not null default '{}',        -- p.ej. corredera: longitudes nominales, holgura lateral
  model_path text,                           -- GLB opcional para el 3D
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on hardware (org_id, category) where not archived;

-- Reglas de posicionado: cuántos y dónde según la longitud de la unión.
create table hardware_rules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  hardware_id uuid not null references hardware(id) on delete cascade,
  name text not null,
  min_length integer, max_length integer,    -- 1/100 mm, rango de aplicación
  count_mode text not null default 'fixed' check (count_mode in ('fixed','pitch','table')),
  spec jsonb not null,                       -- {count, from_start, from_end, pitch, table:[{upto, count}]}
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint range_ok check (min_length is null or max_length is null or max_length >= min_length)
);
create index on hardware_rules (hardware_id);
create index on hardware_rules (org_id);

-- Métodos de fabricación: holguras, retrasos, solapes, canteado, uniones, ranuras.
-- Documento JSON validado por el motor (zod). Los sub-métodos son claves del documento.
create table methods (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  version integer not null default 1,
  spec jsonb not null,                       -- {body, doors, drawers, grooves, edging, joints:[{a,b,rule_id,priority}]}
  default_style_id uuid references material_styles(id) on delete set null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on methods (org_id);
create unique index one_default_method on methods (org_id) where is_default;

-- ───────────────────────────── diseño ─────────────────────────────

create table clients (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  email text, phone text, address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on clients (org_id, lower(name));

-- Proyecto = estancia/encargo con varios muebles (S21).
create table projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  name text not null,
  status text not null default 'draft' check (status in ('draft','quoted','approved','in_production','done','archived')),
  room jsonb not null default '{}',          -- muros, suelo, techo, luces (fase "could")
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on projects (org_id, status, updated_at desc);
create index on projects (client_id);

-- Catálogo de modelos reutilizables (S22). Un modelo es un mueble plantilla.
create table catalogs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on catalogs (org_id);

-- Mueble. Vive en un proyecto, o en un catálogo como modelo (exactamente uno de los dos).
create table cabinets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  catalog_id uuid references catalogs(id) on delete cascade,
  family text,                               -- solo modelos de catálogo
  source_model_id uuid references cabinets(id) on delete set null, -- "asociado al modelo"
  name text not null,
  method_id uuid references methods(id) on delete restrict,
  style_id uuid references material_styles(id) on delete set null,
  design jsonb not null,                     -- árbol de zonas, ver @mw/engine/schema
  design_version integer not null default 1, -- versión del formato del documento
  rev integer not null default 1,            -- control optimista: se sube en cada guardado
  placement jsonb not null default '{"x":0,"y":0,"z":0,"rot":0}', -- posición en la estancia
  quantity integer not null default 1 check (quantity > 0),
  thumb_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint one_home check ((project_id is null) <> (catalog_id is null))
);
create index on cabinets (project_id);
create index on cabinets (catalog_id, family);
create index on cabinets (org_id, updated_at desc);
create index on cabinets (method_id);
create index on cabinets (source_model_id);

-- ───────────────────────────── producción ─────────────────────────────

create table postprocessors (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  format text not null check (format in ('dxf','csv','mpr','cix','pgmx','hop','tcn')),
  config jsonb not null default '{}',        -- herramientas, códigos, capas, carpeta por material/mueble
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on postprocessors (org_id);

-- Cada exportación congela las piezas calculadas: lo que se cortó queda registrado.
create table exports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  kind text not null check (kind in ('cutlist','bom','labels','drawings','cnc','quote','nesting')),
  postprocessor_id uuid references postprocessors(id) on delete set null,
  status text not null default 'queued' check (status in ('queued','running','done','failed')),
  engine_version text not null,
  parts jsonb,                               -- snapshot de paneles, cantos, mecanizados, herrajes
  totals jsonb,                              -- {area_m2, edge_ml, cost_cents, ...}
  file_path text,                            -- Storage: zip / pdf / csv
  error text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on exports (project_id, created_at desc);
create index on exports (org_id, status) where status in ('queued','running');

-- Presupuestos (mejora sobre v6).
create table quotes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  number integer not null,
  currency char(3) not null,
  subtotal_cents integer not null check (subtotal_cents >= 0),
  tax_bp integer not null default 2100 check (tax_bp between 0 and 10000), -- puntos básicos: 2100 = 21 %
  total_cents integer not null check (total_cents >= 0),
  lines jsonb not null,                      -- por mueble / categoría
  valid_until date,
  status text not null default 'draft' check (status in ('draft','sent','accepted','rejected','expired')),
  share_token text unique,                   -- enlace de vista para el cliente
  export_id uuid references exports(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, number)
);
create index on quotes (project_id);

-- ───────────────────────────── triggers ─────────────────────────────

create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['orgs','materials','material_styles','hardware','hardware_rules','methods',
                           'clients','projects','catalogs','cabinets','postprocessors','exports','quotes']
  loop
    execute format('create trigger %I_touch before update on %I for each row execute function touch_updated_at()', t, t);
  end loop;
end $$;

-- Guardado optimista del mueble: solo si el cliente envía la rev que tenía.
create or replace function save_cabinet(p_id uuid, p_rev integer, p_design jsonb)
returns integer language plpgsql security invoker as $$
declare new_rev integer;
begin
  update cabinets set design = p_design, rev = rev + 1
   where id = p_id and rev = p_rev
   returning rev into new_rev;
  if new_rev is null then
    raise exception 'conflict' using errcode = '40001';  -- otro dispositivo guardó antes
  end if;
  return new_rev;
end $$;

-- ───────────────────────────── RLS ─────────────────────────────

alter table orgs enable row level security;
alter table org_members enable row level security;

create policy orgs_read on orgs for select using (is_member(id));
create policy orgs_write on orgs for update using (is_member(id, array['owner']));
create policy members_read on org_members for select using (is_member(org_id));
create policy members_write on org_members for all
  using (is_member(org_id, array['owner'])) with check (is_member(org_id, array['owner']));

-- Todas las tablas con org_id: leer = miembro; escribir = owner/designer.
-- 'workshop' solo lee y puede crear exports; 'viewer' solo lee.
do $$
declare t text;
begin
  foreach t in array array['materials','material_styles','hardware','hardware_rules','methods',
                           'clients','projects','catalogs','cabinets','postprocessors','quotes']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I_read on %I for select using (is_member(org_id))', t, t);
    execute format($p$create policy %I_write on %I for all
                     using (is_member(org_id, array['owner','designer']))
                     with check (is_member(org_id, array['owner','designer']))$p$, t, t);
  end loop;
end $$;

alter table exports enable row level security;
create policy exports_read on exports for select using (is_member(org_id));
create policy exports_insert on exports for insert
  with check (is_member(org_id, array['owner','designer','workshop']));
-- update de exports solo desde el worker con service role (salta RLS).

-- La vista pública del presupuesto se sirve desde una ruta del servidor con service role,
-- buscando por share_token; no hay política anónima en la tabla.
