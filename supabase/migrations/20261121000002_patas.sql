-- ════════════════════════════════════════════════════════════════════════════
-- Patas como herrajes (issue #5): la tabla de herrajes acepta el tipo 'leg'.
--
-- Las patas de partida las agrega la app a cada cuenta la primera vez que abre la biblioteca.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.hardware drop constraint hardware_kind_check;
alter table public.hardware add constraint hardware_kind_check check (kind in ('hinge', 'slide', 'sliding', 'leg'));
