-- ════════════════════════════════════════════════════════════════════════════
-- Vidrios (issue #6): la biblioteca de materiales acepta vidrios, que pueden ser templados.
--
-- Los vidrios y las bisagras para vidrio de partida los agrega la app a cada cuenta la primera
-- vez que abre la biblioteca.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.materials drop constraint materials_kind_check;
alter table public.materials add constraint materials_kind_check check (kind in ('panel', 'edge', 'glass'));
alter table public.materials add column tempered boolean not null default false;
