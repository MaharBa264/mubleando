# Herrajes

La biblioteca de herrajes guarda las **bisagras**, las **correderas de cajón** y los **sistemas de puertas corredizas** que usa el taller, con las medidas que necesita el motor para calcular las piezas: holguras, descuentos y largos disponibles. También sirven para la lista de compra: el despiece suma cuántos hacen falta y su precio.

> Cada marca usa sus propias constantes. Los herrajes de partida traen valores **típicos**: comprobalos con la ficha técnica del herraje que compres y corregilos en Bibliotecas.

## Dónde se eligen

1. **Método de fabricación** → **Herrajes por defecto**: los usan todos los muebles hechos con ese método.
2. **Mueble completo** → **Herrajes**: para un mueble concreto. «Del método» = usar el del método.
3. Sin herraje elegido, el motor usa las holguras del bloque **Cajones** del método (como antes).

Los métodos argentinos de partida vienen con bisagra de codo 0, corredera telescópica de bolas y sistema corredizo de 2 hojas.

## Bisagras de cazoleta

| Campo | Para qué |
| --- | --- |
| Codo | 0 = puerta superpuesta; 9 = semisuperpuesta (dos puertas sobre un mismo costado); 18 = encastrada. |
| Cierre suave | Solo informativo (mismas medidas de taladro). |
| Diámetro de cazoleta | Casi siempre 35 mm. |
| Distancia al borde | Del borde de la puerta al taladro (3 a 6 mm según la marca). |
| Cantidad por alto | Cuántas bisagras lleva una puerta según su alto. De partida: hasta 900 mm, 2; hasta 1600, 3; hasta 2000, 4; más, 5. |

Qué hace el motor:

- Cuenta las bisagras de cada puerta según su alto y las suma a la lista de herrajes.
- Avisa si el codo no corresponde al montaje: una puerta encastrada con bisagra de codo 0, o una superpuesta con una de codo 18.

## Correderas de cajón

El fondo del cajón es el **largo de corredera más grande que entra** en el mueble (fondo libre del hueco menos el espacio libre de detrás del método). Si no entra ninguna, el motor avisa y no hace la caja. Cada cajón suma un par a la lista, con su largo.

| Tipo | Medidas que usa | Cómo queda la caja |
| --- | --- | --- |
| Telescópica de bolas | Hueco a cada lado (12,5 a 13 mm en las de 45 mm) | Ancho = hueco − 2 × hueco lateral. |
| De rodillo | Igual | Igual. |
| Oculta bajo cajón (tipo Blum Tandem) | Ancho interior = hueco − 42 mm; largo de caja = corredera − 10 mm; laterales de hasta 16 mm | Caja centrada. Avisa si los laterales del método son más gruesos que lo admitido. |
| Cajón metálico (tipo Antaro, Matrix) | Ancho de fondo = hueco − X; ancho de trasera = hueco − Y; largo de fondo = corredera − Z | Solo se cortan fondo y trasera; los laterales son de metal. Los valores de partida son **de ejemplo**: cargá los de tu sistema. |

Ejemplo, bajo de 600 × 860 × 560 con el método argentino (hueco interior 564 de ancho y 542 de fondo):

| Corredera | Resultado |
| --- | --- |
| Bolas, 12,5 por lado | corredera de 500 (entra hasta 532); caja de 539 de ancho; trasera de 503 |
| Oculta, −42 | ancho interior 522; caja de 558, centrada (3 mm por lado); laterales de 490 de largo; aviso: laterales de 18 > 16 |
| Metálico, −75 / −87 / −24 | fondo de 489 × 476; trasera de 477 |

## Sistemas de puertas corredizas

Las hojas van **dentro del hueco**, en dos rieles; cada hoja se monta sobre la siguiente.

| Campo | De partida | Para qué |
| --- | --- | --- |
| Hojas | 2 o 3 | El frente del hueco también lo elige. |
| Solape | 20 mm | Cuánto se monta una hoja sobre la siguiente (Häfele recomienda 20 mm). |
| Luz arriba / abajo | 10 / 10 mm | Espacio para los rieles. Alto de hoja = alto del hueco − ambas. |
| Del frente a la hoja de adelante | 5 mm | Retranqueo de la hoja delantera. |
| Entre las dos hojas | 6 mm | Espacio entre rieles, además del espesor de la hoja. |

Ancho de cada hoja = (ancho del hueco + (hojas − 1) × solape) / hojas.

Ejemplo, bajo de 1200 con 2 hojas: hueco de 1164 × 824 → hojas de 592 × 804, a 5 y a 29 mm del frente. Las hojas ocupan 47 mm desde el frente (5 + 18 + 6 + 18): si dentro hay estantes retranqueados menos que eso, el motor avisa de que chocan.

En la lista de herrajes: un juego por hueco, con el largo de los rieles.

## Código

- Motor: [`packages/engine/src/hardware.ts`](../packages/engine/src/hardware.ts) (tipos, herrajes de partida, validación, `hingeCount`, `pickLength`) y `compute(diseño, método, materiales, herrajes)`, que devuelve además `hardware`: la lista de herrajes. Pruebas en `test/herrajes.test.ts`, con cifras calculadas a mano.
- Datos: tabla `hardware` en Supabase (migración `20261118000001_herrajes.sql`) y `hardware` en el navegador (formato versión 5). Las cuentas sin herrajes reciben los de partida la primera vez.
- Pantallas: Bibliotecas → Herrajes (`components/libraries/HardwareDialog.tsx`); Método → Herrajes por defecto; Mueble completo → Herrajes; Despiece → Herrajes, con su costo.

## Fuentes

- Häfele, sistema Slido: solape recomendado de 20 mm y fórmula de alto de puerta con constantes del sistema ([25S1-82](https://files.hafele.co.uk/CatalogFiles/www/25S1-82.pdf)).
- Mockett: 10 mm de luz arriba y abajo en puertas corredizas sobre riel ([SDH4](https://www.mockett.com/pdf/installation-sheets/SDH4.pdf)).
- Blum Tandem: ancho interior del cajón = hueco − 42 mm; largo = nominal − 10 ([folleto Tandembox](https://woodworkinstitute.com/wp-content/uploads/2024/07/Blum-Tandembox-Brochure.pdf)).
- Hettich: bisagras de cazoleta de 35 mm con codo para puerta superpuesta, semisuperpuesta y encastrada ([catálogo](https://web2.hettich.com/hbh/addon/en/p_KSP_A_en_34.pdf)).
