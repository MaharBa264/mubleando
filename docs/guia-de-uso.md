# Guía de uso

De un proyecto vacío a la lista de corte para la maderera, o al archivo para la impresora 3D.

## 1. Proyectos

La pantalla de inicio (**Proyectos**) lista tus proyectos: una cocina, un armario, el encargo de un cliente. Cada proyecto agrupa varios muebles.

- **Nuevo proyecto**: escribe el nombre y se crea vacío.
- Pulsa un proyecto para abrirlo. Dentro puedes cambiarle el nombre, añadir muebles, borrarlos y ver el **despiece del proyecto**, que junta las piezas de todos los muebles.
- Borrar un proyecto pide confirmación y borra también sus muebles.

La primera vez que abres la app aparece la "Cocina de ejemplo", con un bajo de fregadero y una despensa, para probar sin empezar de cero.

## Ambientes

**Cuentas.** Con la nube, solo pueden crear cuenta los mails que autorice el responsable de la app, desde **Administración** (ver [Quién puede registrarse](nube.md#quién-puede-registrarse)).

Además de muebles sueltos, un proyecto puede tener **ambientes**: la planta de una cocina o habitación, con las paredes medidas en obra (también fuera de escuadra), puertas y ventanas, y los muebles colocados. La app avisa si un mueble choca con otro o con la pared, si tapa una puerta o una ventana, y qué relleno hace falta en una esquina fuera de escuadra. Todo, paso a paso, en [Ambientes](ambientes.md).

## 2. Crear un mueble

Dentro de un proyecto, **Nuevo mueble**:

1. **Plantilla**: cada una con un dibujo de su frente. Se pueden cambiar todas después en el editor.

   | Grupo | Plantilla | Medidas típicas (mm) | Qué trae |
   | --- | --- | --- | --- |
   | Bajo mesada | Bajo con puertas | 600 × 860 × 560 | zócalo, un estante, una puerta (dos si mide más de 600) |
   | Bajo mesada | Cajonera | 450 × 860 × 560 | zócalo y tres cajones; el de arriba, de 150, para cubiertos |
   | Bajo mesada | Bajo con cajón y puerta | 600 × 860 × 560 | un cajón arriba y puerta(s) con un estante debajo |
   | Bajo mesada | Bajo pileta | 800 × 860 × 560 | zócalo y puertas, sin estante (lugar para los caños) |
   | Altos de pared | Alacena | 800 × 700 × 320 | un estante y puerta(s) |
   | Altos de pared | Alacena abierta | 600 × 400 × 320 | un estante, sin puertas |
   | Columnas y placards | Columna / despensa | 600 × 2100 × 560 | puerta abajo con dos estantes y puerta arriba con uno |
   | Columnas y placards | Placard | 1200 × 2400 × 600 | dos cuerpos: estantes a la izquierda; maletero y espacio para colgar a la derecha |
   | Otros | Estantería abierta | 800 × 1800 × 300 | cuatro estantes |
   | Otros | Caja vacía | 600 × 720 × 560 | solo la caja |

2. **Medidas exteriores**: ancho, alto y fondo en milímetros (se aceptan decimales con coma: `560,5`). La plantilla se adapta: por ejemplo, un bajo con puertas de más de 600 mm pasa a dos puertas. El dibujo de la derecha se actualiza al momento.
3. **Nombre**: opcional; si lo dejás vacío se llama como la plantilla y el ancho («Cajonera 450»).
4. **Método de fabricación**: las reglas de construcción (qué tablero, cómo va el fondo, qué tapacanto). Ver [el motor](motor.md#3-el-método-de-fabricación).

Al crear, se abre el editor. En la lista del proyecto, cada mueble tiene su dibujo, y **Duplicar** hace una copia exacta (útil para módulos repetidos).

## 3. El editor

En el ordenador tiene tres columnas:

| Izquierda: **Estructura** | Centro: **Vista 3D** | Derecha: **Propiedades** |
| --- | --- | --- |
| El árbol del mueble: el mueble completo, los huecos (Interior, Columna 1, Nivel 2…) y todas las piezas con su medida. Pulsa cualquiera para seleccionarlo. | El mueble en 3D. Arrastra para girar, rueda o pellizco para acercar, botón derecho o dos dedos para desplazar. Pulsa un hueco o una pieza para seleccionarlo. | Lo que se puede cambiar de lo seleccionado. |

En el móvil, la vista 3D va arriba y debajo hay dos pestañas: **Propiedades** y **Estructura**.

Encima de la vista 3D, la **barra de herramientas** del hueco elegido (al tocar un hueco en el 3D o en Estructura):

| Botón | Qué hace |
| --- | --- |
| + Estante / − Estante | Agrega o quita un estante; los niveles se reparten a partes iguales. |
| + Divisor / − Divisor | Lo mismo con divisores verticales. |
| Puerta / 2 puertas | Pone una puerta de una o dos hojas (otra vez el mismo botón la quita). |
| Cajones | Pone tres cajones (la cantidad y las alturas se ajustan en Propiedades). Si el hueco tenía estantes, se quitan; Ctrl+Z lo deshace. |
| Sin frente | Quita la puerta o los cajones. |

Si no hay ningún hueco elegido, la barra lo recuerda y ofrece **Elegir el interior**. Un mueble vacío abre ya con el interior elegido.

Debajo de la vista 3D:

- **Perspectiva / Ortogonal**: la ortogonal no deforma las medidas, útil para ver frentes y alineaciones.
- **Alámbrico**: solo las aristas, para ver lo que hay detrás.
- **Cotas**: muestra el ancho, el alto y el fondo del mueble, y la medida libre del hueco elegido.
- **Centrar**: vuelve a encuadrar el mueble.

En la barra de arriba: volver al proyecto, el nombre del mueble (se edita ahí mismo), el estado del guardado, deshacer y rehacer, **STL** y **Despiece**.

### Cambiar las medidas y el método

Selecciona **Mueble completo**. En propiedades cambias ancho, alto y fondo, el zócalo, el método de fabricación y cuántas unidades de este mueble lleva el proyecto (por ejemplo, 3 bajos iguales). Todas las piezas se recalculan al momento.

### Herrajes

En **Mueble completo → Herrajes** se eligen las bisagras, las correderas y el sistema corredizo de este mueble (o «Del método»). Cambian las medidas de las piezas (por ejemplo, el ancho y el fondo de los cajones) y debajo se ve la lista de lo que lleva. Todo, en [Herrajes](herrajes.md).

### Construcción: cómo se unen tapa, base y fondo

En **Mueble completo → Construcción**:

| Opción | Qué cambia |
| --- | --- |
| **Tapa** entre los costados | Lo habitual: costados enteros, tapa más corta. |
| **Tapa** encima de los costados | La tapa va de lado a lado (con tapacanto también en las puntas) y los costados son más cortos. |
| **Tapa** con dos travesaños | En lugar de tapa, un travesaño delantero y uno trasero (100 mm por defecto, se puede cambiar). Típico de bajo mesada. |
| **Tapa**: sin tapa | No hay tapa; el fondo llega hasta arriba. |
| **Base** debajo de los costados | La base va de lado a lado y los costados apoyan encima. Con zócalo, el zócalo también va de lado a lado. |
| **Fondo**: sin fondo | Quita el fondo; el interior llega hasta atrás. |

Todas las medidas de corte se recalculan solas.

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

### Puertas corredizas

En **Frente**, elegí **Corrediza** (o el botón **Corrediza** de la barra del 3D) y luego **dos** o **tres hojas**. Las hojas van dentro del hueco, en dos rieles; sus medidas salen del sistema corredizo elegido (ver [Herrajes](herrajes.md)). Los estantes y divisores de detrás se retranquean solos lo que ocupan las hojas más 2 mm, y su fondo baja en el despiece. Si a un estante le pusiste a mano un retranqueo menor, se respeta y la app avisa de que choca, con su nombre. Lo mismo pasa detrás de un frente encastrado.

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

Además, según la pieza:

- **Estante**: **Altura**, la distancia desde el piso del hueco hasta la cara de abajo del estante, para ponerlo a una medida exacta (por ejemplo, a 350 mm). Los niveles de abajo quedan fijos con su medida actual.
- **Estante o divisor**: **Retranqueo del frente** propio. Vacío = el del método.
- **Tapa o fondo**: **Quitar** la pieza de este mueble (equivale a «Sin tapa» o «Sin fondo» en Construcción).
- **Cualquier pieza**: **Usar este tablero y estos tapacantos en todas las piezas del mismo tipo**, por ejemplo, para poner tapacanto de 2 mm a todas las puertas de una vez.

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
- Los materiales de partida vienen **sin precio**: cargá los tuyos. Son los habituales en Argentina: melamina de 18 mm (blanca, símil madera, gris grafito) y de 15 mm, fibrofácil de 3 mm (crudo y blanco), tapacanto de PVC de 0,45 y 2 mm. Si tu cuenta se creó antes del 17-11-2026, en Bibliotecas aparece **Agregarlos** para sumar los que te falten sin tocar los tuyos. Mientras falte alguno, el despiece avisa de cuáles son y el total no los incluye.
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
