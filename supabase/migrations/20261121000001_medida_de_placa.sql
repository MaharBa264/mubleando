-- ════════════════════════════════════════════════════════════════════════════
-- Medida de la placa de cada tablero (issue #3, plano de cortes).
--
-- Opcional: sin ella, la app usa la de partida según el espesor (2750 × 1830, o 2600 × 1830
-- hasta 6 mm). Las dos medidas van juntas, en 1/100 mm como el resto.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.materials
  add column sheet_length integer check (sheet_length > 0),
  add column sheet_width integer check (sheet_width > 0),
  add constraint materials_sheet_both check ((sheet_length is null) = (sheet_width is null));
