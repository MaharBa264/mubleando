-- ════════════════════════════════════════════════════════════════════════════
-- Biblioteca de herrajes: bisagras, correderas de cajón y sistemas de puertas corredizas.
--
-- Igual que materiales y métodos: cada usuario tiene los suyos, con id de texto único por usuario
-- (los de partida se llaman igual en todas las cuentas: 'hw-bisagra-codo0'…). Las medidas propias
-- de cada tipo van en `spec` (JSON), validadas en la aplicación (hardwareSchema del motor).
--
-- Además, los dos métodos de partida argentinos pasan a usar por defecto bisagra de codo 0,
-- corredera telescópica de bolas y sistema corredizo de 2 hojas (si no tienen ya herrajes elegidos).
-- ════════════════════════════════════════════════════════════════════════════

create table public.hardware (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (char_length(id) between 1 and 64),
  name text not null check (char_length(name) between 1 and 120),
  kind text not null check (kind in ('hinge', 'slide', 'sliding')),
  price_cents integer not null default 0 check (price_cents >= 0),
  spec jsonb not null check (jsonb_typeof(spec) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create trigger hardware_updated before update on public.hardware
  for each row execute function public.set_updated_at();

alter table public.hardware enable row level security;
create policy hardware_own on public.hardware for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.hardware from anon;
grant select, insert, update, delete on public.hardware to authenticated;

-- Herrajes por defecto en los métodos argentinos de partida que todavía no tienen.
update public.methods
set spec = spec || '{"hardware": {"hinge": "hw-bisagra-codo0", "slide": "hw-corredera-bolas-45", "sliding": "hw-corredizo-2"}}'::jsonb
where id in ('ar-18-ranura', 'ar-18-clavado') and not (spec ? 'hardware');
