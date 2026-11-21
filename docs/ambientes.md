# Ambientes

Un **ambiente** es la planta de una habitación (piso, paredes, puertas y ventanas) con los muebles del proyecto colocados en ella. Un proyecto puede tener varios ambientes y muebles sueltos; el mismo mueble se puede colocar varias veces.

Está pensado para crecer: hoy cada ambiente es independiente; más adelante, una casa entera (varios ambientes que comparten paredes).

## Crear un ambiente

En el proyecto, **Ambientes → Nuevo ambiente**:

- **Nombre**: cocina, lavadero, dormitorio…
- **Ancho y largo interiores** (de pared a pared): el ambiente empieza rectangular.
- **Alto y espesor de las paredes**: 2,60 m y 15 cm por defecto.

Se abre el editor. El proyecto muestra cada ambiente con su planta en miniatura, la superficie y cuántos muebles tiene.

## El editor

A un lado, la vista (**Planta** o **3D**); al otro, el panel con cuatro pestañas: **Paredes**, **Aberturas**, **Muebles** y **Avisos**. Al tocar algo en la planta se abre su pestaña. Deshacer y rehacer (Ctrl+Z / Ctrl+Y) y guardado automático, igual que en el editor de muebles. **Supr** quita el mueble elegido.

### La planta

Vista desde arriba:

- Paredes con su espesor y esquinas a inglete, con cualquier ángulo.
- **Largo de cada pared** por fuera (en gris, la última, que cierra sola).
- **Ángulo de cada esquina** por dentro. En naranja, los que no son de 90°.
- Puertas, con la hoja y el arco de giro, y ventanas.
- Muebles: de piso, rellenos; colgados, con borde punteado. El frente se marca con una línea más gruesa; en rojo, los que tienen algún aviso.
- **Esquinas arrastrables**: se mueven de 10 en 10 mm.

### Paredes fuera de escuadra

Un ambiente real casi nunca está a escuadra. Se carga como se mide en obra:

1. Pared por pared, el **largo** por la cara de adentro.
2. Esquina por esquina, el **ángulo interior** (90 si está a escuadra).
3. La **última pared cierra sola**: su largo y los ángulos de sus dos esquinas salen calculados. Si la mediste, poné su medida en **Medida en obra** para ver el **error de cierre** (la diferencia entre lo calculado y lo medido). Si pasa de 5 mm, revisá algún largo o algún ángulo.

Al cambiar un largo o un ángulo, las demás medidas se conservan tal como se cargaron, como en obra. Por ejemplo, si alargás la pared de arriba y la de abajo sigue con su medida, el ambiente deja de ser rectangular.

**Partir** agrega una esquina en medio de una pared (a 180°, sin cambiar la forma). Arrastrándola o cambiando su ángulo se hacen una L, una ochava o un quiebre. **Quitar esquina** une las dos paredes que toca.

### Aberturas

Tocá una pared en la planta y agregá **Puerta**, **Ventana** o **Abertura sin hoja**. Aparece centrada, con medidas habituales (puerta 800 × 2050; ventana 1000 × 1100 con antepecho de 1 m). Se ajustan la pared, la distancia desde el inicio de la pared, el ancho, el alto y el antepecho.

**Moverlas en la planta**:

- **Arrastrá** la puerta o ventana con el mouse o el dedo: se desliza a lo largo de su pared, de a 10 mm, aunque la pared esté fuera de escuadra. Se puede agarrar también por la parte de afuera de la pared, si delante hay un mueble.
- No se sale de la pared ni se encima con otra abertura de la misma pared: queda pegada al límite.
- Con una abertura elegida, las **flechas** la mueven de a 10 mm (de a 100 con **Mayús**), hacia donde apunta la flecha.
- Mientras está elegida, la planta muestra la distancia a cada extremo de la pared.
- Se deshace con Ctrl+Z, como el resto.

### Colocar muebles

En **Muebles** están todos los muebles del proyecto:

- **Colocar** lo pone contra la pared elegida (o la primera con lugar) en el primer hueco libre, sin pisar otros muebles ni tapar puertas. Los que parecen de colgar (poco fondo y menos de 1 m de alto) se colocan a 1,45 m del piso.
- En la planta se **arrastran**. Al soltarlos:
  - a menos de 15 cm de una pared, **se arriman solos**: giran para dar la espalda a la pared y mirar al ambiente;
  - a menos de 15 cm del costado de otro mueble girado igual y a la misma altura, **se juntan** costado con costado y espalda con espalda (una alacena no se pega a un bajo).
- Mientras se arrastra, lo que choca se ve **en rojo** al momento.
- **Bloquear superposiciones** (arriba a la derecha de la planta): si está marcado, un mueble no se puede soltar donde choca con otro o atraviesa una pared, y vuelve al último lugar libre por el que pasó. Queda guardado en ese navegador.
- En la planta, una línea punteada muestra **por dónde abre cada puerta** (un cuarto de círculo del ancho de la hoja).
- Con un mueble elegido: posición, giro y altura desde el piso; **Arrimar a la pared más cercana**; **Girar 90°**; **Abrir el mueble**; **Quitar del ambiente**.
- **Cantidad en el despiece**: si un mueble está colocado más veces de las que cuenta el despiece, aparece **Contar N** para igualarlas.

### Avisos

| Aviso | Cuándo |
| --- | --- |
| Se sale del ambiente o atraviesa una pared | Alguna esquina del mueble queda fuera de la planta. |
| Se pisan | Dos muebles se superponen en planta y a la misma altura (una alacena sobre un bajo no se pisa con él). |
| Las patas se pisan | Las patas inclinadas de un mueble sobresalen de su huella (en su alto) y tocan al de al lado. También cuentan para «se sale del ambiente»: contra la pared, las patas la atraviesan. |
| **Una puerta golpea al abrirse** | Al abrir 90°, la puerta de un mueble llega a una pared o a otro mueble que está a la altura de la puerta. Ejemplo: bajo de 560 de fondo con una puerta de 597: barre hasta 560 + 597 = 1157 mm de la pared; en una planta de 1000 de fondo golpea la de enfrente. |
| **Esquina fuera de escuadra** | El costado de un mueble está cerca de una pared que no va paralela. Dice la separación atrás y adelante: el **relleno cónico** que hace falta (por ejemplo, de 0 a 11,2 mm) o, si el mueble se mete en la pared, cuánto hay que separarlo o recortar el costado en cuña. |
| Tapa una puerta | Un mueble contra una pared, delante de una puerta. |
| Tapa una ventana | Contra la pared de una ventana y llega a la altura del antepecho. |
| Abertura que no entra | Una puerta o ventana más larga que el resto de su pared. |
| Paredes que se cruzan | Las medidas forman un polígono imposible. |
| Mueble borrado | Una colocación cuyo mueble ya no existe en el proyecto. |

### Vista 3D

Piso, paredes con los huecos de puertas y ventanas, y los muebles colocados con sus frentes. Se gira con el ratón o con el dedo. Tocar un mueble lo elige.

Las paredes tienen tres modos:

- **Automático** (por defecto): las paredes que quedan entre la cámara y el interior se vuelven transparentes mientras girás, como en una casa de muñecas. Una pared tapa la vista cuando la cámara está del lado de fuera de su cara interior.
- **Transparentes**: todas.
- **Sólidas**: ninguna.

## Cómo funciona por dentro

Código: [`packages/engine/src/room.ts`](../packages/engine/src/room.ts), pruebas en `packages/engine/test/room.test.ts`.

- **Coordenadas de la planta**: x a la derecha, y hacia abajo (como en pantalla), en centésimas de mm. Las esquinas son la **cara interior** de las paredes.
- **Esquinas exteriores** (`outerCorners`): cada esquina desplazada hacia fuera el espesor de pared con unión a inglete. En ángulos muy agudos, el inglete se limita a 4 veces el espesor.
- **Medidas de obra** (`fromMeasures`): desde la primera esquina, con la dirección de la primera pared, se avanza el largo de cada pared y se gira 180° − ángulo interior en cada esquina. La última pared une la última esquina con la primera.
- **Mueble colocado** (`Placement`): esquina trasera izquierda (x, y), giro en grados y altura desde el piso. Con giro 0, el ancho va hacia +x y el frente mira hacia +y.
- **Arrimar a la pared** (`snapToWall`): giro = el que hace que el frente apunte hacia el interior de la pared; posición = el punto de la pared más cercano a donde estaba, sin pasarse de los extremos.
- **Fuera de escuadra**: para cada costado del mueble y cada pared casi paralela a él (menos de 15°) que esté a menos de 15 cm, se mide la distancia del punto trasero y del delantero a la recta de la pared. Si difieren 1 mm o más, o el mueble se mete en la pared, se avisa con las dos cifras.
- **Choques** (`placementSolids`, `placementCollides`): cada mueble es una caja (su rectángulo en toda la altura) y, si tiene patas inclinadas, una franja de abajo con la huella agrandada (`legsOverhang`). Dos muebles chocan si alguna caja de uno se cruza con alguna del otro en la planta y en el alto.
- **Pegar al vecino** (`snapToNeighbor`): en los ejes del otro mueble, si la espalda está a menos de 15 cm de su línea y un costado a menos de 15 cm del suyo, lo pone justo al lado.
- **Puertas** (`doorSwing`): cuarto de círculo de radio igual al ancho de la hoja, con centro en la bisagra, en el frente; se compara con la planta y con los demás muebles a la altura de la puerta.
- **Medidas para el ambiente** (`roomSize`): alto real (con las patas, si suman al alto), lo que sobresalen las patas y las puertas de bisagra de cada mueble, a partir de lo que calcula el motor.
- **Deslizar una abertura** (`slideOpening`): la lleva a la distancia pedida, o al lugar libre más cercano de su pared si ahí no entra (sin salirse ni encimarse). `alongWall` proyecta un punto de la planta sobre la pared, para el arrastre.
- **Trozos de pared para el 3D** (`wallPieces`): entre aberturas, pared entera; encima de cada abertura, el dintel; debajo de cada ventana, el antepecho.

Datos: tabla `rooms` en Supabase (migración `20261118000000_ambientes.sql`, con reglas de acceso, `save_room` con control de versión y borrado en cascada con el proyecto y con la cuenta) y `rooms` en el almacenamiento del navegador (formato versión 4).

## Limitaciones de esta primera versión

- Un ambiente por planta; todavía no hay una casa con varios ambientes que compartan paredes.
- Las paredes tienen todas el mismo espesor y alto.
- El mueble no se adapta solo a una esquina fuera de escuadra: la app avisa del relleno o el recorte, pero no lo agrega al despiece.
- Muebles rectangulares solamente (las formas irregulares quedaron para más adelante).
- En el 3D no se puede arrastrar: los muebles se mueven en la planta.
