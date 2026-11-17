# Guía de uso

De un proyecto vacío a la lista de corte para la maderera, o al archivo para la impresora 3D.

## 1. Proyectos

La pantalla de inicio (**Proyectos**) lista tus proyectos: una cocina, un armario, el encargo de un cliente. Cada proyecto agrupa varios muebles.

- **Nuevo proyecto**: escribe el nombre y se crea vacío.
- Pulsa un proyecto para abrirlo. Dentro puedes cambiarle el nombre, añadir muebles, borrarlos y ver el **despiece del proyecto**, que junta las piezas de todos los muebles.
- Borrar un proyecto pide confirmación y borra también sus muebles.

La primera vez que abres la app aparece la "Cocina de ejemplo", con un bajo de fregadero y una despensa, para probar sin empezar de cero.

## 2. Crear un mueble

Dentro de un proyecto, **Nuevo mueble**:

1. **Nombre**: opcional; si lo dejas vacío se numera solo.
2. **Forma**: de momento, rectangular. Las demás formas (en L, rinconero, libre) aparecen como "Más adelante".
3. **Medidas exteriores**: ancho, alto y fondo en milímetros. Hay botones de medidas habituales para ir más rápido. Se aceptan decimales con coma (`560,5`).
4. **Método de fabricación**: las reglas de construcción (qué tablero, cómo va la trasera, qué canto). Ver [el motor](motor.md#3-el-método-de-fabricación).

Al crear, se abre el editor.

## 3. El editor

En el ordenador tiene tres columnas:

| Izquierda: **Estructura** | Centro: **Vista 3D** | Derecha: **Propiedades** |
| --- | --- | --- |
| El árbol del mueble: el mueble completo, los huecos (Interior, Columna 1, Nivel 2…) y todas las piezas con su medida. Pulsa cualquiera para seleccionarlo. | El mueble en 3D. Arrastra para girar, rueda o pellizco para acercar, botón derecho o dos dedos para desplazar. Pulsa un hueco o una pieza para seleccionarlo. | Lo que se puede cambiar de lo seleccionado. |

En el móvil, la vista 3D va arriba y debajo hay dos pestañas: **Propiedades** y **Estructura**.

Debajo de la vista 3D:

- **Perspectiva / Ortogonal**: la ortogonal no deforma las medidas, útil para ver frentes y alineaciones.
- **Alámbrico**: solo las aristas, para ver lo que hay detrás.
- **Centrar**: vuelve a encuadrar el mueble.

En la barra de arriba: volver al proyecto, el nombre del mueble (se edita ahí mismo), el estado del guardado, deshacer y rehacer, **STL** y **Despiece**.

### Cambiar las medidas y el método

Selecciona **Mueble completo**. En propiedades cambias ancho, alto y fondo, el zócalo, el método de fabricación y cuántas unidades de este mueble lleva el proyecto (por ejemplo, 3 bajos iguales). Todas las piezas se recalculan al momento.

### Zócalo

En **Mueble completo**, marca **Con zócalo**. La base del mueble sube a la altura del zócalo (100 mm por defecto) y se añade un tablero delante, retranqueado (50 mm por defecto) para dejar sitio a los pies. Los costados siguen llegando al suelo. Cambia la altura y el retranqueo en los dos campos que aparecen.

Para escribir una medida: escribe y pulsa **Intro** o sal del campo. **Esc** deshace lo escrito. Si la medida no es válida, el campo se marca en rojo y explica por qué.

### Dividir el interior

1. Selecciona un hueco: en el 3D, en el árbol o desde "Dividir el interior" en las propiedades del mueble.
2. Elige el tipo de división: **estantes** (divide en niveles, de abajo arriba) o **divisores** (divide en columnas, de izquierda a derecha).
3. Elige cuántas piezas con los botones − y +. Los huecos se reparten a partes iguales.
4. Cada hueco hijo tiene su medida. Escribe una para **fijarla**; los demás se reparten lo que queda. Deja el campo vacío para que vuelva a ser automática.
5. **Repartir igual** quita todas las medidas fijas del hueco. **Quitar división** elimina sus piezas.

Cada hueco hijo se puede volver a dividir: por ejemplo, un divisor y luego estantes distintos en cada columna.

### Puertas

1. Selecciona el hueco que quieres cerrar. Puede ser el interior entero (una puerta que tapa todos los estantes) o un hueco concreto (por ejemplo, cada columna con su puerta).
2. En **Frente**, elige **Puerta**. Si el hueco mide más de 600 mm de ancho, empieza con dos hojas.
3. Elige el montaje:
   - **Superpuesto**: la puerta tapa los cantos del mueble. Es lo habitual en cocinas.
   - **Encastrado**: la puerta queda dentro del hueco, enrasada con el frente.
4. Elige **Una hoja** o **Dos hojas** y, si es de una, el lado de las **bisagras**.

Las medidas salen solas a partir de la holgura del método (3 mm por defecto): las puertas superpuestas dejan 1,5 mm al borde del mueble y 3 mm entre puertas vecinas.

### Cajones

1. Selecciona un hueco **sin divisiones** (si tiene, se quitan al poner cajones; puedes deshacerlo con Ctrl+Z).
2. En **Frente**, elige **Cajones**. Empieza con tres iguales.
3. Cambia el número con − y +.
4. Las alturas de los frentes van **de arriba abajo**. Escribe una para fijarla (por ejemplo, un cajón de cubiertos de 140 mm arriba); los demás se reparten lo que queda. **Igualar alturas** quita las medidas fijas.

Cada cajón lleva su caja completa: dos laterales, trasera, contrafrente y fondo. Las holguras para las guías, el fondo del cajón (redondeado a largos de guía de 50 en 50 mm) y los materiales salen del método de fabricación. Si un cajón queda demasiado bajo para su caja, aparece un aviso.

### Ver puertas y cajones abiertos

Debajo de la vista 3D, el botón **Frentes cerrados / Frentes abiertos / Sin frentes** cambia cómo se ven:

- **Cerrados**: como quedará el mueble.
- **Abiertos**: las puertas giran sobre sus bisagras y los cajones salen hacia delante.
- **Sin frentes**: se ocultan puertas y frentes para ver y seleccionar el interior.

### Ver y cambiar una pieza

Selecciona una pieza (en el 3D o en el árbol) para ver su espesor, medida acabada, medida de corte y veta. Además puedes cambiarla a mano:

- **Material**: otro tablero **del mismo espesor** (por ejemplo, un costado visto en roble en un mueble blanco).
- **Cantos**: el canto de cada lado. L1 es el delantero; L2 el otro largo; A1 y A2 los extremos. La medida de corte se recalcula al momento.

Las piezas cambiadas muestran el aviso «Esta pieza tiene cambios a mano», con un enlace para volver a lo que dice el método. Desde una puerta o una pieza de cajón, **Editar el frente** lleva al hueco para cambiar puertas o cajones.

### Deshacer, rehacer y guardado

- **Ctrl+Z** deshace y **Ctrl+Y** (o Ctrl+Mayús+Z) rehace. También están los botones ↶ y ↷. Se guardan los últimos 100 pasos.
- **Esc** quita la selección.
- El mueble se guarda solo, medio segundo después del último cambio. Arriba se ve "Guardando…" y luego "Guardado".
- Si abres el mismo mueble en dos pestañas y cambias las dos, la segunda en guardar avisa del conflicto en lugar de pisar el trabajo de la otra. Recarga para ver la versión guardada.

## 4. Despiece

Desde el editor (**Despiece**) o desde el proyecto (**despiece del proyecto**).

- **Agrupada**: las piezas iguales en una fila con su cantidad. **Pieza a pieza**: una fila por pieza.
- Las medidas grandes son las **de corte**, ya descontado el canto.
- Abajo, el resumen: piezas y m² por tablero, metros de canto y costo estimado del material (sin mermas ni mano de obra).
- **Imprimir** saca una versión limpia para papel o PDF.
- **Descargar CSV** baja la lista para Excel o para mandarla a la maderera.

Cómo pedir el corte a una maderera, paso a paso: [Exportaciones → lista de corte](exportaciones.md#1-lista-de-corte-para-la-maderera-csv).

## 5. Imprimir el mueble en 3D

En el editor, botón **STL**:

1. Elige **Mueble completo** (una maqueta montada) o **Pieza a pieza** (un ZIP con cada pieza para montarla).
2. Elige la **escala**. 1:10 es la recomendada.
3. Deja el **espesor mínimo** en 0,8 mm si usas una boquilla normal de 0,4 mm.
4. Comprueba el **tamaño impreso** que se muestra, y que quepa en tu impresora.
5. **Descargar** y abre el archivo en tu laminador (PrusaSlicer, Cura, Orca, Bambu Studio…).

Todas las opciones explicadas, incluidas las de cajones: [Exportaciones → STL](exportaciones.md#2-modelo-para-impresión-3d-stl).

## 6. Bibliotecas

**Bibliotecas** guarda tus tableros, cantos y métodos de fabricación.

**Tableros y cantos.** **Nuevo tablero** / **Nuevo canto**, o **Editar** en uno existente:

- Nombre, espesor y precio en **pesos** (por m² los tableros, por metro los cantos). Se puede escribir como se escribe en Argentina: `25.000`, `25.000,50` o `25000`.
- Los materiales de partida vienen **sin precio**: cargá los tuyos. Mientras falte alguno, el despiece avisa de cuáles son y el total no los incluye.
- **Tiene veta** (solo tableros): las piezas no se podrán girar al colocarlas en el tablero.
- Color con el que se ve en el 3D.

No se puede borrar un material que use algún método: la app dice cuál, para que lo cambies antes.

**Métodos de fabricación.** Reúnen todas las reglas de construcción. **Editar** cambia todos los muebles que lo usan; **Duplicar** crea una copia para hacer una variante sin tocar el original. Cada método tiene cuatro bloques:

| Bloque | Qué se decide |
| --- | --- |
| Estructura | Tablero de la caja, canto del frente, si el canto descuenta de la medida de corte, retranqueo de estantes y divisores. |
| Trasera | En ranura, clavada o sin trasera; tablero; profundidad y posición de la ranura y holgura. |
| Puertas y frentes de cajón | Tablero, canto de los cuatro lados y holgura entre frentes. |
| Cajones | Tableros de la caja y del fondo, fondo en ranura o clavado, hueco para guías, espacios libres arriba, abajo y detrás, y en qué múltiplos se redondea el fondo. |

Si algo no cuadra (una ranura más profunda que el tablero, por ejemplo), el diálogo lo avisa antes de guardar. No se puede borrar un método que use algún mueble, ni el último que quede.

## 7. Dónde se guardan tus datos

Hoy, en el navegador del dispositivo que uses. Eso significa:

- Lo que hagas en el ordenador no aparece en el móvil, y al revés.
- Si borras los datos de navegación del sitio, se borran tus proyectos.

Esto cambia con el guardado en la nube (ver la [hoja de ruta](hoja-de-ruta.md)), que permitirá entrar con tu cuenta desde cualquier dispositivo.
