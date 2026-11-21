# Exportaciones (`@mw/exporters`)

Todo se genera en el propio navegador: no se envía nada a ningún servidor.

| Exportación | Dónde está en la app | Archivo |
| --- | --- | --- |
| Lista de corte en CSV | Despiece del mueble o del proyecto → **Descargar CSV** | `.csv` |
| Lista de corte en papel | Despiece → **Imprimir** | (impresora o PDF) |
| Modelo para impresión 3D | Editor del mueble → botón **STL** | `.stl`, o `.zip` con varios `.stl` y un `LEEME.txt` |

Código: [`packages/exporters/src`](../packages/exporters/src) (`csv.ts`, `stl.ts`, `zip.ts`).

---

## 1. Lista de corte para la maderera (CSV)

### Para qué sirve

La mayoría de las madereras y almacenes de tablero cortan a medida si les mandas una lista con las piezas. El CSV se abre en Excel, LibreOffice o Google Sheets, y lo leen también los programas de optimización de corte.

### Cómo pedir el corte

1. Termina el mueble (o todos los del proyecto) en el editor.
2. Abre el **Despiece**. Para todo un proyecto, usa el despiece del proyecto: suma las piezas de todos sus muebles, multiplicadas por la cantidad de cada uno.
3. Elige **Agrupada**: las piezas iguales salen en una sola fila con su cantidad, que es como suelen pedirlo.
4. Revisa los avisos en amarillo, si los hay. Una lista con avisos puede tener medidas imposibles.
5. Elige el formato de decimales:
   - **coma (Excel)** si la vas a abrir tú o la maderera en Excel en español.
   - **punto (CNC / optimizador)** si la maderera la mete directamente en su programa de corte.
6. **Descargar CSV** y mándala por correo o WhatsApp. Si prefieres papel o PDF, usa **Imprimir** (en el diálogo de impresión puedes elegir "Guardar como PDF").

Consejos al pedir:

- Pregunta si su sierra quita el espesor del canto o si prefieren la medida acabada. La app da las dos: las columnas **Largo corte / Ancho corte** ya descuentan el canto; **Largo acabado / Ancho acabado** son la pieza terminada.
- Si también te ponen el canto, la columna de cada lado (L1, L2, A1, A2) dice qué canto lleva. L1 es siempre el borde delantero.
- En tableros con veta, la columna **Veta** dice "Sí": la pieza no se puede girar al colocarla en el tablero. El largo va en la dirección de la veta.

### Formato del archivo

- Separador: punto y coma (`;`), que es el que espera Excel en español.
- Decimales: coma o punto, a elegir.
- Codificación: UTF-8 con BOM, para que Excel lea bien las tildes y la "ñ".
- Finales de línea: CRLF (Windows).
- Los textos con `;` o comillas van entre comillas, con las comillas internas dobladas.
- Medidas en milímetros.

| Columna | Contenido |
| --- | --- |
| Ref | G1, G2… (agrupada) o P1, P2… (pieza a pieza) |
| Pieza | Nombre: "Costado izquierdo", "Estante 2"… En la agrupada, los nombres de las piezas iguales |
| Mueble | De qué mueble(s) sale |
| Material | Nombre del tablero |
| Espesor | mm |
| Largo corte, Ancho corte | Medida a la que se corta el tablero |
| Cantidad | Número de piezas |
| Veta | Sí / No |
| Canto L1, L2, A1, A2 | Nombre del canto de cada lado, o vacío |
| Largo acabado, Ancho acabado | Medida con el canto puesto |

Función: `cutListCsv(rows, materials, { separator = ';', decimal = ',', bom = true })`, donde `rows` sale de `groupedRows` o `individualRows` del motor.

---

## Documento PDF del mueble o del proyecto

En el despiece, botón **PDF**. Un solo archivo, en A4, con lo que elijas:

| Parte | Qué lleva |
| --- | --- |
| Portada (siempre) | Nombre, medidas (o cantidad de muebles), fecha, costo estimado del material y herrajes (si hay precios) y una vista del mueble armado. |
| Lista de corte | La lista agrupada: número, pieza, material, largo y ancho de corte, espesor, cantidad y cantos (L1 delantero, L2 trasero, A1 y A2 los extremos). Sigue en otra página si no entra. |
| Plano de cortes | Cada material aparte, dos placas por página, con las piezas numeradas y su medida. Usa la sierra y el refilado elegidos en el plano de cortes del despiece. |
| Mueble armado, frentes cerrados | Vista isométrica (desde adelante, a la derecha y arriba). |
| Mueble armado, frentes abiertos | Puertas abiertas 95° sobre sus bisagras, cajones afuera el 60 % de su fondo y corredizas corridas (como en el 3D). |
| Vista explotada | Cada pieza separada en la dirección en que se arma (costados hacia los lados, tapa arriba, fondo atrás, estantes y frentes adelante, cajones afuera), con su número de la lista. |
| Etiquetas | Al final, sin pie de página, en el formato elegido en **Etiquetas**: esas hojas se imprimen en papel autoadhesivo. |

En un proyecto, las vistas salen una por mueble. Lo elegido queda guardado en ese navegador.

**Cómo se dibujan las vistas.** No son capturas de la pantalla: cada pieza es una caja con sus medidas reales y se dibuja con polígonos, así que se ven nítidas a cualquier tamaño. Se dibuja solo la cara de cada pieza que mira hacia el observador, con tres tonos (arriba más claro, costados más oscuros) para que se lea el volumen. El orden de dibujo sale de comparar cada par de piezas que se tapan en el papel: primero la que queda detrás. En la vista explotada, cada número busca un punto visible de su pieza.

Código: [`packages/exporters/src/views.ts`](../packages/exporters/src/views.ts) (`cabinetView`) y [`document.ts`](../packages/exporters/src/document.ts) (`cabinetPdf`). Pruebas: proyección con cifras a mano, contornos y superposición, orden de dibujo (el lateral del cajón detrás del costado), vista abierta y explotada (todas las piezas con su número) y cantidad de páginas según lo elegido.

## Etiquetas para las piezas (PDF)

En el despiece, botón **Etiquetas**. Un PDF para imprimir en hojas A4 autoadhesivas y pegar cada etiqueta en su pieza.

**Qué lleva cada etiqueta** (una por unidad: si una pieza va 4 veces, salen 4):

- el mueble (en un proyecto, el de esa pieza) y, a la derecha, el número de la lista agrupada (G1, G2…);
- el nombre de la pieza;
- la medida de corte, grande: largo × ancho × espesor;
- el material;
- abajo a la izquierda, un dibujo de la pieza con **trazo grueso en los lados que llevan canto** (el de abajo es el canto delantero, L1) y, si tiene veta, una flecha en su dirección;
- abajo a la derecha, de qué placa del [plano de cortes](plano-de-cortes.md) sale: «Placa 2 de 4».

Los textos largos se achican y, si aun así no entran, se cortan con «…».

**Opciones:**

| Opción | Para qué |
| --- | --- |
| Hoja de etiquetas | 24 por hoja (70 × 37), 21 (63,5 × 38,1, tipo L7160), 14 (99,1 × 38,1, tipo L7163), 8 (105 × 74) o **medidas propias** (columnas, filas, medida de la etiqueta, márgenes y separaciones). Avisa si no entran en la hoja. |
| Empezar en la etiqueta | Para usar una hoja empezada: la primera etiqueta va en esa posición (contando de izquierda a derecha y de arriba abajo). |
| Dibujar el borde | Para probar primero en papel común, ponerlo sobre la hoja de etiquetas a contraluz y ver si coincide. |
| Piezas | Todas, o solo algunas (por número de la lista). |

El formato elegido queda guardado en ese navegador. Al imprimir, elegí **tamaño real** (100 %, sin «ajustar a la página»).

Código: [`packages/exporters/src/labels.ts`](../packages/exporters/src/labels.ts) (`labelsFromCutList`, `labelSlots`, `labelsPdf`, con [jsPDF](https://github.com/parallax/jsPDF)). Pruebas: formatos que entran en A4, posiciones con márgenes y separación, empezar en una hoja usada, una etiqueta por unidad con su mueble, su pieza y su placa, y cantidad de hojas del PDF.

## 2. Modelo para impresión 3D (STL)

### Para qué sirve

Para imprimir el mueble en una impresora 3D como **maqueta**: enseñarlo a un cliente, comprobar proporciones o tener una referencia en el taller. Se puede exportar el mueble entero, montado, o cada pieza por separado para imprimirlas y montarlas como el mueble real.

### Opciones del diálogo

**Qué exportar**

| Opción | Qué sale | Cuándo usarla |
| --- | --- | --- |
| Mueble completo | Un `.stl` con el mueble montado, tal como se ve en el visor. | Para una maqueta rápida de una sola impresión. |
| Pieza a pieza | Un `.zip` con un `.stl` por cada pieza **distinta**, tumbada sobre su cara mayor, más un `LEEME.txt`. | Para montar la maqueta pieza a pieza, o cuando el mueble entero no cabe en la impresora. |

En **pieza a pieza**, las piezas con las mismas tres medidas se imprimen una vez y el nombre del archivo lleva la cantidad. Por ejemplo, `01-costado-izquierdo-x2-720x560x19.stl` significa: imprimir 2; medida real 720 × 560 × 19 mm. El `LEEME.txt` repite, para cada archivo, cuántas veces imprimirlo, la medida real y el nombre de todas las piezas que representa.

**Cajones** (solo con *Mueble completo*)

Esta opción solo se activa si el mueble tiene cajones. Cada cajón (su frente y su caja) se trata como un conjunto.

| Opción | Qué sale |
| --- | --- |
| Integrados en el mueble | Los cajones en su sitio, dentro del mismo archivo. Una sola impresión. |
| Cada cajón aparte, montado | El mueble sin cajones en un archivo, y un archivo por cada cajón ya montado, para imprimirlo aparte y meterlo luego en su hueco. |
| Cajones pieza a pieza | El mueble sin cajones en un archivo, y las piezas de cada cajón sueltas y tumbadas, para pegarlas. |

**Escala**

| Escala | Un mueble de 600 × 720 × 560 queda en | Comentario |
| --- | --- | --- |
| 1:5 | 120 × 112 × 144 mm | Mucho detalle; los muebles altos pueden no caber. |
| 1:10 | 60 × 56 × 72 mm | **Recomendada.** Cabe casi cualquier mueble en una impresora doméstica. |
| 1:20 | 30 × 28 × 36 mm | Para conjuntos (una cocina entera). |
| 1:25, 1:50 | más pequeño | Para estancias completas. |
| 1:1 | tamaño real | Solo tiene sentido para piezas sueltas pequeñas. La app avisa si exportas el mueble completo así. |

El diálogo enseña el **tamaño impreso** del mueble completo antes de descargar, para comprobar si cabe en la cama de la impresora.

**Espesor mínimo impreso**

Al reducir, los tableros finos se vuelven demasiado finos para imprimirse: una trasera de 3 mm a escala 1:10 mediría 0,3 mm, y una boquilla normal de 0,4 mm no la puede hacer. Por eso las piezas que queden por debajo del mínimo se **engordan** hasta él (por igual por las dos caras), y la app avisa de cuántas han cambiado.

| Opción | Cuándo |
| --- | --- |
| No engordar | Si prefieres la proporción exacta, aunque algunas piezas no salgan. |
| 0,4 mm | Boquillas finas (0,2–0,25 mm). |
| 0,8 mm | **Recomendado** para la boquilla estándar de 0,4 mm (dos pasadas). |
| 1,2 mm | Maquetas que se van a manipular mucho. |

### Detalles del archivo

- STL **binario**, en **milímetros**.
- Eje **Z hacia arriba**, como esperan PrusaSlicer, Cura, OrcaSlicer o Bambu Studio. El frente del mueble mira hacia **−Y** (hacia ti en la vista frontal del laminador).
- El modelo queda apoyado en la cama (su punto más bajo en Z = 0) y en la esquina del origen.
- Cada pieza es un prisma cerrado de 12 triángulos con las normales hacia fuera. Las pruebas comprueban que el volumen calculado del archivo coincide con la suma de las piezas, lo que garantiza que ninguna cara está del revés.
- En el mueble completo, cada pieza es un cuerpo separado que toca a sus vecinas. Los laminadores las unen sin problema al imprimir. Donde la trasera entra en la ranura, la trasera y los costados se solapan unos milímetros (el STL no fresa la ranura); al imprimir es lo mismo que si estuvieran pegados.
- El ZIP no está comprimido (los STL comprimen poco) y los nombres van en UTF-8. El `LEEME.txt` lleva BOM y finales de línea de Windows para que el Bloc de notas lo abra bien.

### Imprimir la maqueta: consejos

- **Mueble completo**: imprímelo de pie, con la base sobre la cama. Los estantes quedan en voladizo dentro del hueco; actívale soportes en el laminador o, si el mueble tiene muchos estantes, usa *pieza a pieza*.
- **Pieza a pieza**: todas salen tumbadas, sin soportes. Se pegan con cianoacrilato (pegamento instantáneo). Monta igual que el mueble real: costados, base y tapa, trasera, estantes.
- Los cajones impresos aparte entran en su hueco porque el diseño ya les deja holgura: el hueco de las guías a cada lado (13 mm reales por defecto, 1,3 mm a escala 1:10) y los espacios libres de arriba y abajo. A escalas muy pequeñas esas holguras se vuelven milimétricas; si no entran, lija un poco o imprime el cajón con una expansión horizontal negativa.

### De juguete: que funcione

**Qué exportar → De juguete (funciona)**: un juguete a escala que se mueve de verdad, sin bisagras ni correderas compradas.

| Archivo | Qué es | Cómo se imprime |
| --- | --- | --- |
| `…-juguete.stl` | El mueble entero, de una pieza, **con las puertas de bisagra ya unidas** | De pie, con la base sobre la cama, sin soportes dentro de las bisagras. Al terminar, se mueven las puertas con suavidad para soltarlas. |
| `…-cajon-N.stl` | Cada cajón, de una pieza (frente, laterales, trasera y fondo) | Con el frente hacia abajo. Entra en su hueco con la holgura de las correderas a escala. |
| `…-corrediza-N.stl` | Cada hoja corrediza | Tumbada. Se encastra levantándola en el riel de arriba y bajándola en el de abajo. |

Cómo es la **bisagra impresa en su lugar**:

- Un perno vertical en el costado del mueble, con **nudillos alternados**: los de los extremos y el del medio son del mueble (unidos al canto del costado con una pestaña); los otros dos son tubos de la puerta, alrededor del perno.
- Holgura elegida (0,4 mm por defecto) entre el perno y los tubos, y entre la puerta y el mueble. Al menos 0,6 mm entre nudillos, porque la base de cada nudillo se imprime en el aire.
- La puerta queda un poco por delante del mueble para poder girar. Las puertas de dos hojas llevan una bisagra en cada costado.
- Solo las puertas que llegan a un **costado exterior** llevan bisagra impresa. Las que giran sobre un divisor salen en un archivo aparte, con aviso, para pegarlas o ponerles una bisagra comprada.

Cómo son los **rieles de las corredizas**: tiras de 0,8 mm a lo largo del hueco, delante y detrás de cada hoja, de 1,2 mm de alto abajo y 2,4 mm arriba. La hoja es más baja que el hueco para poder levantarla en el riel de arriba y bajarla en el de abajo.

Opciones: escala, holgura (0,3 / 0,4 / 0,5 mm) y espesor mínimo de pared (al menos 0,8 mm; por defecto 1,2 mm en el juguete). Si una bisagra queda pegada, volvé a imprimir con más holgura.

Código: [`packages/exporters/src/toy.ts`](../packages/exporters/src/toy.ts) (`exportToy`). Las pruebas comprueban que cilindros y tubos quedan cerrados y con las caras hacia fuera (su volumen coincide con el calculado), qué archivos salen en cada caso y el alto de las hojas corredizas.

### Uso desde el código

```ts
import { exportStl, zip } from '@mw/exporters';

const r = exportStl(parts, {
  mode: 'pieces',          // 'assembled' | 'pieces'
  scale: 0.1,              // 1:10
  minThicknessMm: 0.8,
  drawers: 'separate',     // solo con mode 'assembled': 'integrated' | 'separate' | 'pieces'
  name: 'Bajo fregadero',
});
// r.files: [{ name, data: Uint8Array }], r.readme: texto, r.warnings: string[], r.printedSize: {x,y,z} | null
const archivo = zip([...r.files, { name: 'LEEME.txt', data: r.readme }]);
```

Otras funciones exportadas: `binaryStl(cajas)` (STL de una lista de cajas ya en mm), `boxTriangles(caja)`, `slug(texto)` (nombre de archivo seguro, sin tildes) y `crc32(bytes)`.

### Limitaciones actuales

- No se dibujan ranuras, taladros ni cantos: cada pieza es un prisma liso.
- Solo se exporta un mueble cada vez, desde su editor. Exportar un proyecto entero (varios muebles colocados en una estancia) llegará cuando exista la vista de estancia.
- No hay tolerancias de encaje para piezas impresas por separado: las medidas son las del mueble real escaladas. Si quieres que encajen a presión, imprime con una expansión horizontal negativa pequeña en el laminador (por ejemplo −0,1 mm).
