# Puertas con vidrio

Dos maneras de poner vidrio en una puerta, cada una con lo suyo:

| | Puerta con marco y vidrio | Puerta de vidrio |
| --- | --- | --- |
| Qué es | Una «ventana»: marco de cuatro listones con el vidrio por detrás | La puerta entera es de vidrio templado |
| Vidrio | Cualquiera (incoloro, esmerilado, espejo…) | Templado, de 4 a 6 mm en muebles |
| Bisagras | Las de cazoleta de siempre, en el parante | Bisagras para vidrio |
| Se corta | El marco, en la maderera; el vidrio, en la vidriería | Todo en la vidriería, a medida y con las perforaciones |

## Cómo se elige

En el editor, tocá un hueco con **Puerta** y, en **Frente → Vidrio**, elegí **Con marco** o **De vidrio**. Debajo aparecen el vidrio (de la biblioteca) y lo demás.

Los vidrios se cargan en **Bibliotecas → Vidrios**: nombre, espesor, precio por m² y si es **templado**. De partida: incoloro 4, esmerilado 4, templado incoloro 5 y espejo 4, sin precio.

## Puerta con marco y vidrio

- El marco tiene **dos parantes** de todo el alto de la puerta y **dos travesaños** entre ellos, del material de los frentes. Ancho del marco: 60 mm de partida.
- Cantos: los parantes, en los cuatro lados; los travesaños, en los dos largos (sus puntas quedan contra los parantes).
- El vidrio va **por detrás**, apoyado en el marco. En melamina no conviene fresar un rebaje (queda el aglomerado a la vista): se sujeta con contravidrio pegado por detrás o con grampas. En MDF para pintar, con rebaje fresado.
- **Medida del vidrio = luz del marco + 2 × rebaje − 2 × holgura.** De partida, rebaje de 8 mm (lo que el vidrio entra detrás del marco) y holgura de 1,5 mm por lado.

Ejemplo, puerta de 597 × 717 con marco de 60:

| Pieza | Medida |
| --- | --- |
| Parantes (2) | 717 × 60 |
| Travesaños (2) | 597 − 2 × 60 = 477 × 60 |
| Luz del marco | 477 × 597 |
| Vidrio | 477 + 16 − 3 = **490** de ancho × 597 + 16 − 3 = **610** de alto |

Avisos:

- Si el parante es más angosto que la cazoleta de la bisagra más su distancia al borde (35 + 4 = 39 mm con la de partida).
- Si el marco no deja lugar para el vidrio: la puerta va entera de tablero.

## Puerta de vidrio (templado)

- El vidrio mide lo que mediría la puerta de tablero, con el espesor del vidrio.
- El **templado no se puede cortar ni perforar después de templar**: la vidriería lo hace a medida, con los agujeros. Por eso la app da las perforaciones acotadas.
- Bisagras para vidrio de partida (en Bibliotecas → Herrajes):

| Bisagra | Vidrio | Cómo se fija |
| --- | --- | --- |
| Cazoleta 26 perforada | 4 a 6,5 mm | Agujero de 26 mm en el vidrio, con la cazoleta adentro. |
| Pegada | 4 a 6 mm | La base se pega al vidrio con pegamento UV. Sin perforar. |
| De pinza | 5 a 8 mm | Aprieta el canto del vidrio. Sin perforar. |

- **Perforaciones** (solo con bisagras perforadas): Ø 26, con el centro a distancia al borde + radio = 4 + 13 = **17 mm** del canto de las bisagras; una a 100 mm de cada punta y las demás repartidas en el medio. La cantidad, según el alto (como las demás bisagras). Ejemplo: puerta de 717 → a 100 y 617 desde abajo; de 1200 → a 100, 600 y 1100.
- Avisos: si el vidrio no es templado, y si su espesor no entra en el rango de la bisagra.
- En la lista de herrajes van las bisagras para vidrio (no las de cazoleta 35).

## Lista para la vidriería

Los vidrios **no** van en la lista de corte de la maderera, ni en el plano de cortes, ni en las etiquetas. Van aparte:

- **Despiece → Vidriería**: cada vidrio (V1, V2…) con alto × ancho vistos de frente, espesor, tipo, si es templado, cantos (pulidos en las puertas de vidrio; sin pulir en las de marco, que quedan adentro) y las perforaciones. El costo (m² × precio) se suma al total.
- **Documento PDF**: con la lista de corte va también la hoja **Lista para la vidriería**, con un dibujo de cada vidrio templado y sus perforaciones acotadas desde abajo y desde el borde.

## En el 3D, el STL y el PDF

- En el 3D el vidrio se ve transparente, y las puertas de marco y vidrio giran enteras sobre sus bisagras.
- En las vistas del PDF, el vidrio va en celeste; en la explotada, el vidrio de una puerta con marco queda detrás de su marco.
- En el STL de juguete, la puerta sale maciza, del tamaño de la puerta, con su bisagra impresa.

## Código

- Motor: `DoorGlass` en `packages/engine/src/types.ts`; puertas en `compute.ts`; `glassRows` en `cutlist.ts`; `hingePositions` y las bisagras para vidrio en `hardware.ts`. Pruebas en `packages/engine/test/glass.test.ts` (cifras de arriba calculadas a mano).
- Exportaciones: vidrios fuera de las etiquetas, hoja de la vidriería en `document.ts`, puertas de varias piezas en `toy.ts` y `views.ts`. Pruebas en `packages/exporters/test/glass.test.ts`.
- Base de datos: migración `20261122000000_vidrios.sql` (materiales de tipo `glass` y columna `tempered`).

## Pendiente

- Puerta de **perfil de aluminio** con vidrio.
- **Corredizas de vidrio** (rieles de aluminio para vidrio).
- Que el solape de la puerta de vidrio dependa del espesor del vidrio según la ficha de cada bisagra (hoy usa las holguras de los frentes del método).
- Tiradores perforados en el vidrio.
