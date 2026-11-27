-- Propuesta #12: esquinero ciego con mecanismo de esquina (media luna y rinconero extraíble).
-- - La tabla de herrajes acepta el tipo 'corner'.
-- - El diseño del mueble se guarda en jsonb (`design.blindCorner`), así que no hace falta tocar `cabinets`.

alter table public.hardware drop constraint if exists hardware_kind_check;
alter table public.hardware add constraint hardware_kind_check check (kind in ('hinge', 'slide', 'sliding', 'leg', 'lift', 'corner'));
