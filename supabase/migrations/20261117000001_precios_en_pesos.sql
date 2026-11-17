-- ════════════════════════════════════════════════════════════════════════════
-- La app pasa de euros a pesos argentinos (ARS). Los importes siguen guardándose en centavos.
--
-- Los materiales de partida traían precios orientativos en euros. Los que siguen exactamente
-- con ese precio (nadie los ha cambiado) quedan sin precio (0), para que cada taller cargue
-- los suyos en pesos desde Bibliotecas. Los precios cambiados a mano no se tocan.
-- ════════════════════════════════════════════════════════════════════════════

update public.materials as m
set price_cents = 0
from (values
  ('mel-blanco-19', 1150), ('mel-roble-19', 1480), ('mel-grafito-16', 1320), ('mel-blanco-16', 1050),
  ('dm-8', 640), ('hdf-3', 380), ('pvc-blanco-1', 45), ('abs-roble-2', 90)
) as viejo (id, precio)
where m.id = viejo.id and m.price_cents = viejo.precio;
