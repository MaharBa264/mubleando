# El motor de cálculo (`@mw/engine`)

El motor es el corazón de la aplicación. Recibe **qué mueble quieres** (medidas y cómo se divide el interior) y **cómo lo fabricas** (el método), y devuelve **todas las piezas** con su medida acabada, su medida de corte, sus cantos y su posición en 3D.

Es una función pura: no guarda nada, no usa la red ni la pantalla, y la misma entrada da siempre la misma salida. Por eso se puede probar a fondo y se puede usar igual en el navegador, en un servidor o en una futura app nativa.

```
 diseño (JSON) ─┐
 método ────────┼──► compute() ──► piezas + huecos + avisos
 materiales ────┘
```

Los paneles **no se guardan nunca**: se recalculan cada vez que cambia algo. Lo único que se guarda es el diseño.

Código: [`packages/engine/src`](../packages/engine/src).

| Archivo | Contenido |
| --- | --- |
| `units.ts` | Unidades y conversión (`mm`, `toMm`, `distribute`…). |
| `types.ts` | Tipos del diseño, el método, los materiales y las piezas, y el esquema zod del diseño. |
| `compute.ts` | El cálculo: `compute()` y `resolveSizes()`. |
| `edit.ts` | Funciones para modificar un diseño sin mutarlo (dividir, fijar medidas, igualar…). |
| `cutlist.ts` | Filas de la lista de corte (agrupadas o pieza a pieza) y totales de material y coste. |
| `presets.ts` | Materiales y métodos de partida. |

## 1. Unidades

Todas las longitudes son **números enteros en centésimas de milímetro**. 1 mm = 100; 19 mm = 1900; 0,5 mm = 50.

¿Por qué? Con decimales, `0.1 + 0.2` no da exactamente `0.3` en un ordenador, y al repartir un hueco entre varios estantes las medidas podrían no sumar el total. Con enteros, las sumas son exactas y se controla dónde va cada centésima.

| Función | Qué hace | Ejemplo |
| --- | --- | --- |
| `mm(v)` | mm → centésimas (redondeando) | `mm(19)` → `1900` |
| `toMm(v)` | centésimas → mm | `toMm(35050)` → `350.5` |
| `toM2(l, w)` | superficie en m² | `toM2(mm(1000), mm(500))` → `0.5` |
| `toMl(v)` | longitud en metros | `toMl(mm(2500))` → `2.5` |
| `distribute(total, n)` | reparte un total en `n` partes enteras que suman exactamente el total; el resto va a las primeras | `distribute(52400, 3)` → `[17467, 17467, 17466]` |

## 2. El diseño

Un diseño es un documento JSON pequeño: las medidas exteriores y un **árbol de huecos**.

```ts
interface Design {
  v: 1;                       // versión del formato
  shape: 'rect';              // de momento solo rectangular
  size: { w: Len; h: Len; d: Len };  // ancho, alto, fondo exteriores
  root: Zone;                 // el interior entero
}

interface Zone {
  id: string;
  split?: Split;              // si no tiene, es un hueco final
}

interface Split {
  axis: 'x' | 'y';            // 'y' = estantes (divide en niveles), 'x' = divisores (divide en columnas)
  sizes: (Len | null)[];      // medida de cada hueco hijo; null = automática
  children: Zone[];           // los huecos hijos, de abajo arriba o de izquierda a derecha
}
```

Un hueco dividido en `n` hijos lleva `n − 1` piezas: estantes si el eje es `y`, divisores si es `x`. Cada hijo puede volver a dividirse, así que un armario con dos columnas y estantes distintos en cada una es:

```
Interior (x: 2 hijos)            → 1 divisor
├─ Columna 1 (y: 4 hijos)        → 3 estantes
└─ Columna 2 (y: 2 hijos)        → 1 estante
```

El formato se valida con zod (`designSchema`) al leerlo del almacenamiento, para no cargar nunca un diseño roto.

### Medidas de los huecos hijos (`resolveSizes`)

1. Se calcula el espacio disponible: la medida del hueco menos el espesor de las piezas que lo dividen.
2. Los hijos con medida fija se quedan con su medida.
3. Lo que sobra se reparte a partes iguales entre los hijos automáticos (`null`), con `distribute`.
4. Si **todos** son fijos, el último absorbe la diferencia, para que la suma cuadre siempre.
5. Si las medidas fijas no caben, o algún hueco queda sin espacio, se añade un aviso (ver la sección 6).

## 3. El método de fabricación

El método reúne las reglas de construcción del taller. Así un mismo diseño se puede fabricar de dos formas sin tocarlo.

```ts
interface Method {
  id: string;
  name: string;
  carcassMaterialId: string;      // tablero de costados, tapa, base, estantes y divisores
  back: {
    mode: 'groove' | 'overlay' | 'none';  // en ranura, clavada por detrás o sin trasera
    materialId: string;
    grooveDepth: Len;   // profundidad de la ranura
    inset: Len;         // distancia de la ranura al canto trasero
    clearance: Len;     // holgura que se deja en el fondo de la ranura
  };
  shelfFrontSetback: Len;         // cuánto quedan los estantes por detrás del frente
  dividerFrontSetback: Len;       // lo mismo para los divisores
  frontEdgeMaterialId: string | null;  // canto del frente visible (null = sin canto)
  edgeReducesCut: boolean;        // si el espesor del canto se descuenta de la medida de corte
}
```

Métodos de partida (`presets.ts`):

| Método | Estructura | Trasera | Estantes | Canto frontal |
| --- | --- | --- | --- | --- |
| `std-ranura` · Estándar | Melamina blanca 19 | DM 8 en ranura de 10 mm, a 10 mm del fondo, holgura 1 mm | retranqueados 20 mm | PVC blanco 1 mm, descuenta |
| `std-clavada` · Económico | Melamina blanca 19 | HDF 3 clavada por detrás | retranqueados 20 mm | PVC blanco 1 mm, descuenta |

## 4. Cómo se construye la caja

Ejes: **x** hacia la derecha (ancho), **y** hacia arriba (alto), **z** hacia el frente (fondo). El origen está en la esquina trasera inferior izquierda. `t` es el espesor de la estructura.

| Pieza | Clave | Largo | Ancho | Notas |
| --- | --- | --- | --- | --- |
| Costado izquierdo y derecho | `side.left`, `side.right` | alto `H` | fondo de la caja | Van **enteros**, de arriba abajo. |
| Tapa y base | `top`, `bottom` | `W − 2t` | fondo de la caja | Van **entre los costados**. |
| Trasera en ranura | `back` | `H − 2t + 2·e` | `W − 2t + 2·e` | `e = profundidad de ranura − holgura`: lo que entra en cada ranura. |
| Trasera clavada | `back` | `H` | `W` | Cubre todo el fondo; la caja empieza `espesor de trasera` más adelante. |
| Estante | `zone:<id>/div<i>` | ancho del hueco | fondo del hueco − retranqueo | Uno entre cada dos niveles. |
| Divisor | `zone:<id>/div<i>` | alto del hueco | fondo del hueco − retranqueo | Uno entre cada dos columnas. |

El "fondo de la caja" es el fondo exterior `D`, menos el espesor de la trasera si va clavada. El interior útil empieza, en z, delante de la trasera: `inset + espesor` si va en ranura, o el espesor si va clavada.

Las **claves** de cada pieza (`side.left`, `top`, `zone:z3/div0`…) son estables: no cambian al recalcular. Sirven para recordar la selección en el editor y, más adelante, para guardar cambios hechos a una pieza concreta (otro material, otros cantos).

### Cantos y medida de corte

- Si el método tiene canto frontal, lo llevan en **L1** (el borde delantero) los costados, la tapa, la base, los estantes y los divisores. La trasera no lleva.
- La **medida acabada** (`length`, `width`) es la de la pieza terminada.
- La **medida de corte** (`cutLength`, `cutWidth`) descuenta el espesor de los cantos si `edgeReducesCut` está activo: el ancho pierde L1 + L2 y el largo pierde A1 + A2.
- La veta de la pieza es la de su material (`grain: 'length'` = la veta va a lo largo).

### Ejemplo completo: bajo de 600 × 720 × 560 con un estante

Método `std-ranura`: estructura de 19, trasera DM 8 en ranura de 10 mm a 10 mm del fondo con 1 mm de holgura, estantes retranqueados 20 mm, canto PVC de 1 mm.

| Pieza | Acabada (mm) | Corte (mm) | De dónde sale |
| --- | --- | --- | --- |
| Costado izquierdo ×1 | 720 × 560 | 720 × 559 | alto entero; el fondo pierde 1 mm de canto |
| Costado derecho ×1 | 720 × 560 | 720 × 559 | igual |
| Tapa ×1 | 562 × 560 | 562 × 559 | 600 − 2·19 = 562 |
| Base ×1 | 562 × 560 | 562 × 559 | igual |
| Trasera ×1 | 700 × 580 | 700 × 580 | entra 10 − 1 = 9 mm en cada ranura: 720 − 38 + 18 = 700 y 600 − 38 + 18 = 580 |
| Estante 1 ×1 | 562 × 522 | 562 × 521 | fondo útil 560 − (10 + 8) = 542; menos 20 de retranqueo = 522; menos 1 de canto = 521 |

El estante queda a 350,5 mm del suelo del mueble: hueco interior de 720 − 38 = 682 mm, menos 19 del estante = 663, repartido en dos niveles de 331,5; 19 + 331,5 = 350,5. Este caso está en las pruebas automáticas ([`compute.test.ts`](../packages/engine/test/compute.test.ts)).

## 5. Salida de `compute()`

```ts
const { parts, zones, warnings } = compute(design, method, materials);
```

- `parts`: las piezas (`Part`), con clave, papel (`side`, `top`, `bottom`, `back`, `shelf`, `divider`), nombre legible ("Estante 2"), material, espesor, medidas acabadas y de corte, cantos, veta, caja 3D (`box`) y, si viene de una división, el hueco que divide (`zoneId`). El campo opcional `assembly` agrupará las piezas de un mismo cajón cuando lleguen los cajones; las exportaciones ya lo tienen en cuenta.
- `zones`: los huecos (`ZoneOut`) con su caja 3D, profundidad en el árbol, si es final y su posición dentro del padre. El editor los usa para seleccionar y dibujar.
- `warnings`: avisos para el usuario.

## 6. Avisos

| Código | Cuándo sale |
| --- | --- |
| `size_out_of_range` | Ancho o alto fuera de 100–3000 mm, o fondo fuera de 100–1200 mm. |
| `fixed_sizes_exceed` | Las medidas fijas de los huecos suman más que el espacio disponible. |
| `zone_too_small` | Algún hueco se queda con medida 0 o negativa. |
| `groove_too_deep` | La ranura es tan profunda como el tablero o más. |
| `material_missing` | El método usa un material que no existe. Se sigue calculando con 19 mm, o sin canto. |

El motor nunca lanza un error por un diseño raro: calcula lo que puede y avisa. Así la pantalla nunca se queda en blanco mientras se escribe una medida.

## 7. Funciones de edición (`edit.ts`)

Todas devuelven un diseño **nuevo** y no modifican el original. Eso hace que deshacer y rehacer sea simplemente guardar los diseños anteriores.

| Función | Qué hace |
| --- | --- |
| `newDesign(size)` | Diseño vacío con esas medidas. |
| `setSize(design, { w?, h?, d? })` | Cambia las medidas exteriores. |
| `setDivisions(design, zoneId, axis, n)` | Pone `n` piezas en un hueco (n estantes = n + 1 niveles). Si ya estaba dividido en el mismo eje, conserva los hijos que ya había y sus subdivisiones. `n = 0` quita la división. |
| `removeDivisions(design, zoneId)` | Quita la división de un hueco. |
| `setChildSize(design, parentId, index, size \| null)` | Fija la medida de un hueco hijo, o la vuelve automática con `null`. |
| `equalize(design, parentId)` | Vuelve automáticos todos los hijos (reparto igual). |
| `findZone`, `findParent`, `updateZone` | Utilidades para recorrer el árbol. |

Los identificadores de los huecos nuevos salen de un generador (`IdGen`). En la app es `crypto.randomUUID`; en las pruebas, un contador, para que los resultados sean repetibles.

## 8. Lista de corte (`cutlist.ts`)

- `individualRows(items)`: una fila por pieza, con referencias P1, P2…
- `groupedRows(items)`: junta las piezas iguales (mismo material, espesor, medida de corte, veta y cantos) en una fila con su cantidad. Referencias G1, G2…
- `totals(items, materials)`: por material, número de piezas, m² (con la medida de corte) y coste; por canto, metros (con la medida acabada) y coste; y el total.

Cada `item` es `{ part, qty?, source? }`: `qty` multiplica la pieza (un mueble repetido 3 veces en el proyecto) y `source` es el nombre del mueble, que aparece en la lista del proyecto.

Los precios están en **céntimos** (enteros) por el mismo motivo que las medidas: el tablero en céntimos por m² y el canto en céntimos por metro lineal.

## 9. Pruebas

```bash
npm test -w @mw/engine
```

Las pruebas cubren las medidas del ejemplo de arriba, el reparto exacto de centésimas, las medidas fijas, los avisos, que las piezas anidadas no se solapen, que el resultado sea determinista, la agrupación de la lista de corte y los totales.

Pendiente: **casos de referencia reales**. La idea es montar el mismo mueble en el programa comercial que usa hoy el taller, exportar su lista de corte, dejarla en `replica/referencia/` y convertirla en una prueba que exija las mismas cifras. Así se demuestra que las medidas salen bien antes de cortar tablero de verdad.
