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

Selecciona **Mueble completo**. En propiedades cambias ancho, alto y fondo, el método de fabricación y cuántas unidades de este mueble lleva el proyecto (por ejemplo, 3 bajos iguales). Todas las piezas se recalculan al momento.

Para escribir una medida: escribe y pulsa **Intro** o sal del campo. **Esc** deshace lo escrito. Si la medida no es válida, el campo se marca en rojo y explica por qué.

### Dividir el interior

1. Selecciona un hueco: en el 3D, en el árbol o desde "Dividir el interior" en las propiedades del mueble.
2. Elige el tipo de división: **estantes** (divide en niveles, de abajo arriba) o **divisores** (divide en columnas, de izquierda a derecha).
3. Elige cuántas piezas con los botones − y +. Los huecos se reparten a partes iguales.
4. Cada hueco hijo tiene su medida. Escribe una para **fijarla**; los demás se reparten lo que queda. Deja el campo vacío para que vuelva a ser automática.
5. **Repartir igual** quita todas las medidas fijas del hueco. **Quitar división** elimina sus piezas.

Cada hueco hijo se puede volver a dividir: por ejemplo, un divisor y luego estantes distintos en cada columna.

### Ver una pieza

Selecciona una pieza para ver su material, espesor, medida acabada, medida de corte y si tiene veta. En la fase 2 se podrá cambiar el material y los cantos de una pieza concreta.

### Deshacer, rehacer y guardado

- **Ctrl+Z** deshace y **Ctrl+Y** (o Ctrl+Mayús+Z) rehace. También están los botones ↶ y ↷. Se guardan los últimos 100 pasos.
- **Esc** quita la selección.
- El mueble se guarda solo, medio segundo después del último cambio. Arriba se ve "Guardando…" y luego "Guardado".
- Si abres el mismo mueble en dos pestañas y cambias las dos, la segunda en guardar avisa del conflicto en lugar de pisar el trabajo de la otra. Recarga para ver la versión guardada.

## 4. Despiece

Desde el editor (**Despiece**) o desde el proyecto (**despiece del proyecto**).

- **Agrupada**: las piezas iguales en una fila con su cantidad. **Pieza a pieza**: una fila por pieza.
- Las medidas grandes son las **de corte**, ya descontado el canto.
- Abajo, el resumen: piezas y m² por tablero, metros de canto y coste estimado del material (sin mermas ni mano de obra).
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

**Bibliotecas** muestra los tableros, los cantos y los métodos de fabricación disponibles, con su espesor, veta y precio. Por ahora son de solo lectura; en la fase 2 se podrán crear y editar con tus propios materiales y precios.

## 7. Dónde se guardan tus datos

Hoy, en el navegador del dispositivo que uses. Eso significa:

- Lo que hagas en el ordenador no aparece en el móvil, y al revés.
- Si borras los datos de navegación del sitio, se borran tus proyectos.

Esto cambia con el guardado en la nube (ver la [hoja de ruta](hoja-de-ruta.md)), que permitirá entrar con tu cuenta desde cualquier dispositivo.
