-- ════════════════════════════════════════════════════════════════════════════
-- Puertas que abren hacia arriba o hacia abajo (issue #11).
--
-- - La tabla de herrajes acepta el tipo 'lift' (pistones a gas, brazos con freno y compases).
-- - Los materiales pueden tener su peso en kg por m², para calcular el peso de las puertas. Sin
--   él, la app lo estima por el espesor.
--
-- Los herrajes de apertura de partida los agrega la app a cada cuenta la primera vez que abre la
-- biblioteca.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.hardware drop constraint hardware_kind_check;
alter table public.hardware add constraint hardware_kind_check check (kind in ('hinge', 'slide', 'sliding', 'leg', 'lift'));

alter table public.materials add column weight numeric check (weight is null or (weight > 0 and weight <= 500));
