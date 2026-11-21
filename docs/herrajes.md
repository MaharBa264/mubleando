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

**Bisagras para vidrio** (puertas enteras de vidrio templado): tienen además los espesores de vidrio que admiten y cómo se fijan (perforada, pegada o de pinza). Ver [Puertas con vidrio](vidrios.md#puerta-de-vidrio-templado).

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

Ejemplo, bajo de 1200 con 2 hojas: hueco de 1164 × 824 → hojas de 592 × 804, a 5 y a 29 mm del frente. Las hojas ocupan 47 mm desde el frente (5 + 18 + 6 + 18).

**Estantes y divisores de detrás.** Se retranquean solos lo que ocupan las hojas más 2 mm de margen: en el ejemplo, 49 mm. Vale para los del hueco con la corrediza y para los de todos los huecos que tiene dentro. Con un fondo interior de 542, el estante pasa de 522 (retranqueo del método, 20 mm) a 493, y queda a 2 mm de la hoja de atrás.

- Si a un estante se le eligió el retranqueo a mano (Propiedades → Retranqueo del frente), se respeta. Si es menor que lo que ocupan las hojas, aparece un aviso con su nombre: «Estante 1: con 20 mm de retranqueo choca con las puertas corredizas…». Para volver al automático, se deja el campo vacío.
- Lo mismo pasa detrás de un frente encastrado, con el espesor del frente más 2 mm.

En la lista de herrajes: un juego por hueco, con el largo de los rieles.

## Patas

Se eligen en el mueble: **Mueble completo → Base → Con patas** (o, con zócalo, **Patas detrás del zócalo**).

| Campo | Para qué |
| --- | --- |
| Estilo | Recta, cónica, estilo años 60 (inclinada, con placa de montaje) o regulable (la de plástico de cocina, para ir detrás de un zócalo). |
| Sección | Cuadrada o redonda. |
| Alto | Lo que sube el mueble. En las regulables, el alto de partida. |
| Lado o diámetro arriba y abajo | Iguales = recta; abajo más chico = cónica. |
| Inclinación | Grados hacia afuera (0 = a plomo). Las de las esquinas se abren en diagonal; las del medio, hacia adelante o hacia atrás. |
| Retiro | Desde los bordes del mueble hasta el borde de la pata. |
| Regula desde / hasta | Solo regulables: el rango de alto. |
| Cantidad según el ancho | De partida: 4 hasta 1200 mm, 6 hasta 2400, 8 más. La mitad adelante y la mitad atrás, repartidas a lo ancho. |

Patas de partida:

| Pata | Medidas |
| --- | --- |
| Regulable plástica | redonda, 100 mm (regula de 95 a 150), Ø 50 arriba y 40 abajo, retiro 40 |
| Recta cuadrada | 40 × 40, 150 mm, retiro 30 |
| Recta redonda | Ø 40, 150 mm, retiro 30 |
| Cónica | Ø 45 → 25, 150 mm, retiro 30 |
| Estilo años 60 | Ø 45 → 22, 200 mm, inclinada 12°, retiro 50, con placa |

Qué hace el motor:

- **Sin zócalo**: arma la caja con el alto que queda y la sube el alto de la pata. Ejemplo: un bajo de 860 con patas de 150 tiene la caja de 710, de 150 a 860 del piso. Si se desmarca **El alto incluye las patas**, la caja mide 860 y el total, 1010.
- **Con zócalo**: la caja no cambia; las patas van ocultas detrás del zócalo y miden lo que él. Avisa si el zócalo queda fuera de lo que regulan las patas.
- Las patas van debajo de la caja (sin contar las puertas que sobresalen), con su borde al retiro elegido.
- Suma las patas a la lista de herrajes, con su alto.
- Calcula cuánto sobresalen las inclinadas de la huella del mueble. Ejemplo: 200 mm a 15° → el pie se corre 200 × tan 15° = 53,6 mm, en diagonal 37,9 mm por eje; con retiro 0 y Ø 45 → 22 sobresale 37,9 − 22,5 + 11 = 26,4 mm por lado. (Las de partida, a 12° con retiro 50, no sobresalen.)

Dónde se ven: en el 3D del editor, en el STL (montado y pieza a pieza, con un archivo de pata para imprimir tantas veces como patas), en el STL de juguete (unidas a la base, de una pieza), en las vistas del documento PDF (no en la explotada) y en la lista de herrajes con su costo.

## Código

- Motor: [`packages/engine/src/hardware.ts`](../packages/engine/src/hardware.ts) (tipos, herrajes de partida, validación, `hingeCount`, `pickLength`) y `compute(diseño, método, materiales, herrajes)`, que devuelve además `hardware`: la lista de herrajes. Pruebas en `test/herrajes.test.ts`, con cifras calculadas a mano.
- Patas: [`packages/engine/src/legs.ts`](../packages/engine/src/legs.ts) (`legCount`, `placeLegs`, `legsOverhang`); `compute` devuelve además `legs`. Malla para los STL: `packages/exporters/src/legmesh.ts`. Pruebas en `packages/engine/test/legs.test.ts` y `packages/exporters/test/legs.test.ts` (volúmenes exactos de patas rectas, inclinadas y cónicas).
- Datos: tabla `hardware` en Supabase (migraciones `20261118000001_herrajes.sql` y `20261121000002_patas.sql`, que agrega el tipo `leg`) y `hardware` en el navegador (formato versión 6). Las cuentas sin herrajes reciben los de partida la primera vez; las que ya tenían y no tienen ninguna pata reciben las 5 patas de partida.
- Pantallas: Bibliotecas → Herrajes (`components/libraries/HardwareDialog.tsx`); Método → Herrajes por defecto; Mueble completo → Herrajes; Despiece → Herrajes, con su costo.

## Fuentes

- Häfele, sistema Slido: solape recomendado de 20 mm y fórmula de alto de puerta con constantes del sistema ([25S1-82](https://files.hafele.co.uk/CatalogFiles/www/25S1-82.pdf)).
- Mockett: 10 mm de luz arriba y abajo en puertas corredizas sobre riel ([SDH4](https://www.mockett.com/pdf/installation-sheets/SDH4.pdf)).
- Blum Tandem: ancho interior del cajón = hueco − 42 mm; largo = nominal − 10 ([folleto Tandembox](https://woodworkinstitute.com/wp-content/uploads/2024/07/Blum-Tandembox-Brochure.pdf)).
- Hettich: bisagras de cazoleta de 35 mm con codo para puerta superpuesta, semisuperpuesta y encastrada ([catálogo](https://web2.hettich.com/hbh/addon/en/p_KSP_A_en_34.pdf)).
