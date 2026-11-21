# Propuestas

Funciones propuestas. La tabla está en el orden en que conviene hacerlas; el número es el del *issue*. Cada una tiene su *issue* en GitHub, donde se discute y se marca cuando está hecha. Cuando una propuesta se termina, pasa a la [Hoja de ruta](hoja-de-ruta.md) y a la documentación de su tema.

| # | Propuesta | Issue | Tamaño | Por qué en este lugar |
| --- | --- | --- | --- | --- |
| 1 | [Corredizas: los estantes no tienen que chocar con las hojas](#1-corredizas-los-estantes-no-tienen-que-chocar-con-las-hojas) | [#1](https://github.com/MaharBa264/mubleando/issues/1) | chico | **Hecho** (21-11-2026). |
| 2 | [Registro solo para mails autorizados](#2-registro-solo-para-mails-autorizados) | [#2](https://github.com/MaharBa264/mubleando/issues/2) | chico | **Hecho** (21-11-2026). |
| 8 | [Ayuda: explicación en el inicio y tooltips](#8-ayuda-explicación-en-el-inicio-y-tooltips) | [#8](https://github.com/MaharBa264/mubleando/issues/8) | mediano | **Hecho** (21-11-2026), salvo el recorrido guiado. |
| 9 | [Arrastrar puertas y ventanas en la planta del ambiente](#9-arrastrar-puertas-y-ventanas-en-la-planta-del-ambiente) | [#9](https://github.com/MaharBa264/mubleando/issues/9) | chico | Los muebles y las esquinas se arrastran; las aberturas, no. |
| 3 | [Plano de cortes en las placas](#3-plano-de-cortes-en-las-placas) | [#3](https://github.com/MaharBa264/mubleando/issues/3) | grande | Es lo que más se usa: cuántas placas comprar y cuánto cuestan. |
| 4 | [Etiquetas para pegar en las piezas](#4-etiquetas-para-pegar-en-las-piezas) | [#4](https://github.com/MaharBa264/mubleando/issues/4) | mediano | Usa el plano de cortes (cada etiqueta dice de qué placa sale la pieza). |
| 5 | [Patas, como herrajes de la biblioteca](#5-patas-como-herrajes-de-la-biblioteca) | [#5](https://github.com/MaharBa264/mubleando/issues/5) | mediano | Cambia lo que ocupa el mueble en el piso: conviene antes de las colisiones. |
| 6 | [Puertas con vidrio y puertas de vidrio](#6-puertas-con-vidrio-y-puertas-de-vidrio) | [#6](https://github.com/MaharBa264/mubleando/issues/6) | grande | Suma herrajes nuevos (como las patas) y una lista aparte para la vidriería. |
| 7 | [Muebles que no se atraviesan en el ambiente](#7-muebles-que-no-se-atraviesan-en-el-ambiente) | [#7](https://github.com/MaharBa264/mubleando/issues/7) | mediano | Necesita la huella real del mueble, patas incluidas. |

---

## 1. Corredizas: los estantes no tienen que chocar con las hojas

> **Hecho** el 21-11-2026. Cómo funciona: [Herrajes → Sistemas de puertas corredizas](herrajes.md#sistemas-de-puertas-corredizas).

**Qué pasa hoy.** Las hojas corredizas van dentro del hueco y ocupan, desde el frente, el retiro de la hoja delantera más dos espesores de hoja más el espacio entre rieles. Con el sistema de partida y hojas de 18 mm son 5 + 18 + 6 + 18 = **47 mm**. El motor solo **avisa**: los estantes y divisores siguen con el retranqueo del método (pocos milímetros), así que en el despiece salen con un fondo que choca con las hojas. Además, el control mira el retranqueo del método y no el que se haya cambiado en un estante concreto.

**Propuesta.**

- Detrás de una puerta corrediza, los estantes y divisores del hueco (y los de sus subdivisiones) se retranquean **solos** lo que ocupan las hojas más un margen de 2 mm. Con el ejemplo: 49 mm. Su fondo en el despiece baja en consecuencia.
- Si el usuario cambió a mano el retranqueo de un estante, se respeta el suyo. Si es menor que lo necesario, aparece el aviso de choque con el nombre del estante.
- El control mira cada estante y divisor con su retranqueo real (el del método o el cambiado), no solo el valor del método.
- Lo mismo para las puertas encastradas, que usan el mismo control (ahí lo necesario es el espesor de la puerta).

**Hecho cuando.**

- Un bajo de 1200 con 2 hojas y un estante: el estante sale retranqueado 49 mm (de 522 a 493 de fondo; sin corrediza ya tenía los 20 del método), y no hay aviso.
- Con el retranqueo del estante forzado a 20 mm, aparece el aviso con su nombre.
- Pruebas del motor con estas cifras calculadas a mano.

---

## 2. Registro solo para mails autorizados

> **Hecho** el 21-11-2026. Cómo funciona: [Quién puede registrarse](nube.md#quién-puede-registrarse).

**Qué pasa hoy.** Cualquiera que entre en la página publicada puede crearse una cuenta. No ve los datos de otras cuentas (las reglas de acceso de la base lo impiden), pero ocupa espacio y cuota del proyecto de Supabase.

**Propuesta.**

- Tabla `signup_allowlist` (mail, nota, quién lo agregó, cuándo). Los mails se guardan en minúsculas.
- La base de datos **rechaza el alta** de un mail que no esté en la lista, con un control dentro de Supabase (un *hook* de autenticación antes de crear el usuario, o un disparador sobre los usuarios nuevos). Así no se puede saltear desde fuera de la app.
- Rol de **propietario**: una tabla de administradores con la cuenta del dueño. Solo los administradores leen y editan la lista.
- Pantalla **Administración → Registro**, visible solo para administradores: agregar mails (uno o varios pegados), quitarlos, ver si ya se registraron.
- En la pantalla de registro, si el mail no está autorizado: «Este mail no tiene permiso para registrarse. Pedíselo al responsable de la app.»
- El modo local (sin nube) no cambia.

**A decidir al hacerlo.** Qué pasa con las cuentas que ya existen: quedan como están (lo propuesto) o se revisan una por una.

**Hace falta del dueño.** Ejecutar la migración en Supabase y, si se usa el *hook*, activarlo en Authentication → Hooks.

**Hecho cuando.**

- Un mail fuera de la lista no puede registrarse, ni desde la app ni llamando directamente a Supabase.
- Un mail de la lista sí puede.
- Una cuenta que no es administradora no puede leer ni cambiar la lista.
- Pruebas de base de datos (PGlite) y una comprobación contra el proyecto real (`test:nube`).

---

## 3. Plano de cortes en las placas

**Para qué.** La maderera suele optimizar los cortes con su propio programa de seccionadora. El valor de hacerlo en la app es saber **antes de pedir** cuántas placas hacen falta y cuánto cuesta el mueble (o el ambiente entero), y llevar un plano claro.

**Propuesta.**

- Un optimizador de **cortes guillotina** (de lado a lado, como corta una seccionadora), por material y espesor.
- Datos de cada material en la biblioteca: medida de la placa (de partida 2750 × 1830 para melamina), refilado de bordes (de partida 10 mm) y si tiene **veta**. El espesor de la sierra (de partida 4 mm) es un dato general.
- Las piezas con veta no se giran. Las lisas pueden girarse.
- Las piezas se cortan **sin canto**: la medida de corte descuenta el espesor del canto donde lo lleva (lo mismo que ya hace el despiece).
- Pantalla **Despiece → Placas**: un dibujo por placa con cada pieza numerada y sus medidas, el desperdicio en porcentaje y en m², la cantidad de placas por material y el costo.
- Opción para juntar varios muebles (o todo un ambiente) en un mismo plano.
- Salida en **PDF** para imprimir o mandar.
- El fondo de 3 mm y otros materiales finos se optimizan aparte, cada uno en su placa.

**A decidir al hacerlo.** Si los retazos sobrantes se pueden guardar para usar en otro trabajo (una biblioteca de retazos).

**Hecho cuando.**

- Casos con solución conocida (por ejemplo, piezas que llenan exactamente una placa) dan el resultado esperado.
- Ninguna pieza se superpone ni sale de la placa, con sierra y refilado incluidos. Se comprueba en pruebas con muchos casos al azar.
- Las piezas con veta mantienen su dirección.
- El costo coincide con placas × precio.

---

## 4. Etiquetas para pegar en las piezas

**Para qué.** Que cada pieza cortada tenga su etiqueta y no haya que adivinar qué es al armar.

**Propuesta.**

- PDF de etiquetas en hojas A4 autoadhesivas, con los formatos más comunes (por ejemplo, 3 × 8 y 2 × 7) y uno personalizado (filas, columnas, márgenes).
- Cada etiqueta lleva: nombre del mueble, nombre de la pieza, largo × ancho × espesor, material, en qué cantos lleva canto (un dibujito de la pieza con los lados marcados), una flecha con la dirección de la veta y el número de placa y de pieza del plano de cortes.
- Opcional: un código QR que abre esa pieza en la app.
- Se puede imprimir todo o solo algunas piezas, y empezar desde una etiqueta que no sea la primera (para usar hojas a medio gastar).

**Hecho cuando.**

- El PDF sale con una etiqueta por pieza (una por unidad, si hay piezas repetidas).
- El texto largo no se sale de la etiqueta.
- Imprimir sobre una hoja real del formato elegido: el texto queda dentro de cada etiqueta.

---

## 5. Patas, como herrajes de la biblioteca

**Propuesta.**

- Nuevo tipo de herraje en la biblioteca: **pata**. De partida:
  - recta cuadrada y recta redonda;
  - cónica;
  - estilo años 60: cónica e **inclinada**, con placa de montaje;
  - regulable de plástico, de cocina, que va oculta detrás de un zócalo.
- Datos de cada pata: alto, sección arriba y abajo (cuadrada o redonda), inclinación en grados, retiro desde los bordes del mueble, regulación (mínimo y máximo, en las regulables), cantidad según el ancho del mueble (por ejemplo, 4 hasta 1200 y 6 desde ahí) y precio.
- En el mueble, en **Base**, a elegir: sobre el piso, con zócalo (como hoy) o con patas. Con patas, el mueble sube el alto de la pata. El alto total puede ser el del mueble con o sin patas, a elección.
- Las patas se ven en el 3D, van a la lista de herrajes con su costo y salen en el STL (también en el de juguete, como cilindros o troncos de cono unidos a la base).
- En el ambiente, la huella del mueble incluye lo que sobresalen las patas inclinadas.

**Hecho cuando.**

- Un bajo de 800 con 4 patas de 150 mm: alto total, cantidad y costo correctos.
- Una pata inclinada de 15° y 200 mm sobresale lo calculado a mano.
- En el STL, las patas están unidas a la base y son sólidos cerrados.

---

## 6. Puertas con vidrio y puertas de vidrio

Dos cosas distintas, con herrajes distintos.

### A. Puerta con marco y vidrio (una «ventana» en la puerta)

- La puerta se arma con un **marco**: dos parantes de todo el alto y dos travesaños entre ellos, del material de la puerta. Ancho del marco a elegir (de partida 60 mm), igual en los cuatro lados o distinto abajo.
- El vidrio va **por detrás**, apoyado en un rebaje del marco y sujeto con contravidrio (junquillo) o con grampas, para poder cambiarlo si se rompe.
- **Medida del vidrio** = luz del marco + 2 × rebaje − 2 × holgura. De partida, rebaje de 8 mm y holgura de 1,5 mm por lado (lo habitual es dejar entre 1,5 y 3 mm).
  Ejemplo: puerta de 400 × 700 con marco de 60 → luz de 280 × 580 → vidrio de 293 × 593.
- Las bisagras de cazoleta de siempre van en el parante. Se avisa si el parante es más angosto que la cazoleta más su distancia al borde.
- Variante: puerta de **perfil de aluminio** con vidrio, como herraje de la biblioteca (perfil, descuentos para el vidrio, escuadras, precio por metro). En este caso no se corta madera para la puerta.
- Con melamina, el rebaje no se puede hacer sin dejar el aglomerado a la vista. Para melamina se propone el contravidrio pegado por detrás o el perfil de aluminio. Con MDF para pintar, el rebaje fresado.

### B. Puerta entera de vidrio templado («tipo Blindex»)

- Vidrio **templado** de 4 a 6 mm (en muebles). El templado **no se puede cortar ni perforar después**: las medidas y los agujeros se mandan a la vidriería antes de templar. Por eso la app tiene que dar una lista con las perforaciones acotadas.
- Tipos de bisagra, como herrajes nuevos de la biblioteca:
  - **De cazoleta para vidrio**: agujero de 26 mm en el vidrio, para vidrio de 4 a 6,5 mm según la marca (por ejemplo, Blum, Hettich Intermat 9904, Grass). El solape cambia con el espesor del vidrio (en una ficha de Blum: 8, 7 y 6 mm para vidrio de 4, 5 y 6 mm). Va con la placa de montaje común en el costado.
  - **Pegada, sin perforar**: la base se pega al vidrio con pegamento UV (por ejemplo, Salice Vetro, vidrio de 4 a 6 mm).
  - **De pinza o presión, sin perforar**: aprieta el canto del vidrio. Rango típico de 5 a 8 mm.
- Datos de cada bisagra: espesores admitidos, diámetro y distancia de la perforación (si la tiene), solape según el espesor, holgura entre puertas y con el mueble, y cantidad según el alto (como las bisagras actuales).
- Tirador: perforado en el vidrio (con su cota), pegado o ninguno (apertura por presión).

### Para las dos

- **Biblioteca de vidrios**: tipo (incoloro, templado, esmerilado, bronce, espejo), espesor, si va con cantos pulidos y precio por m².
- **Lista para la vidriería**, separada de la de la maderera: cada vidrio con medidas, espesor, tipo, cantos y, en los templados, el dibujo con las perforaciones acotadas desde los bordes. Su costo se suma al del mueble.
- En el 3D, el vidrio se ve transparente. En el STL normal, como una placa fina. En el de juguete, el hueco queda abierto y la placa sale en un archivo aparte (para imprimirla en material transparente o cambiarla por acetato).
- Más adelante: corredizas de vidrio (rieles de aluminio para vidrio).

**A decidir al hacerlo.** Qué herrajes de vidrio se consiguen en Argentina y a qué precio, para cargar los de partida. Las cifras de arriba son de fichas técnicas europeas y se tienen que confirmar con la ficha de la bisagra comprada.

**Hecho cuando.**

- La puerta de 400 × 700 con marco de 60, rebaje de 8 y holgura de 1,5 da los cuatro listones del marco y un vidrio de 293 × 593.
- Una puerta templada de 5 mm con bisagras de cazoleta da su medida con el solape de la ficha, y en la lista de la vidriería salen las perforaciones de 26 mm a la distancia del borde y a la altura de cada bisagra.
- Se avisa si el espesor del vidrio no entra en el rango de la bisagra elegida.
- Pruebas del motor con estas cifras calculadas a mano.

**Fuentes consultadas.**

- [Bisagras de vidrio de Blum: rango de 4,5 a 7 mm y cazoleta de 26 mm](https://www.wilbrad.com.au/blum-products/blum-hinges/blum-glass-hinges); [solapes de 8, 7 y 6 mm para vidrio de 4, 5 y 6 mm](https://www.blum.org.uk/pdf/GHS005B-cat.pdf).
- [Hettich Intermat 9904, vidrio de 4 a 6,5 mm](https://shop.hettich.com/tm_PT/Hinges/Concealed-hinges/Intermat-fast-assembly-concealed-hinges/Hinges/Intermat-glass-door-hinge-%28Intermat-9904%29%2C-inset%2C-Opening-angle-95%C2%B0%2C-for-screwing-on-%28-%29/p/72968).
- [Salice Vetro, bisagra pegada sin perforar](https://www.salice.com/media/Catalog/hinges/vetro/Salice_VETRO_spa.pdf).
- [Grass, bisagra para vidrio de 4 a 6 mm](https://mediacenter.grass.eu/Produktkataloge/Hinges/EN/142/).
- [Rebaje con contravidrio para poder cambiar el vidrio, y holguras](https://www.finewoodworking.com/1996/02/01/glazing-cabinet-doors).

---

## 7. Muebles que no se atraviesan en el ambiente

**Propuesta.**

- En vez de bloquear el movimiento, que es muy molesto al acomodar:
  - al acercar un mueble a una pared o a otro mueble, se **pega** a ella (y se alinea a su ángulo, aunque la pared esté fuera de escuadra);
  - si dos muebles se superponen, o uno atraviesa una pared, los dos se marcan en **rojo** y aparece un aviso en la lista del ambiente.
- La comparación tiene en cuenta la **altura**: una alacena colgada sobre un bajo no choca con él.
- Opción **Bloquear superposiciones**: si está activada, el mueble no se suelta donde choca y vuelve al último lugar libre.
- Extra: marcar si una puerta, al abrirse, golpea una pared u otro mueble (con el ángulo de apertura).

**Hecho cuando.**

- Pruebas del motor: dos muebles girados que se tocan apenas no chocan, si se superponen 1 mm sí; una alacena a 1400 de altura sobre un bajo de 860 no choca; un mueble contra una pared fuera de escuadra se pega con el ángulo correcto.
- En pantalla, arrastrar un mueble contra la pared lo deja pegado y alineado.

---

## 8. Ayuda: explicación en el inicio y tooltips

> **Hecho** el 21-11-2026, salvo el recorrido guiado (queda para más adelante). Cómo funciona: [Guía de uso → Ayuda dentro de la app](guia-de-uso.md#ayuda-dentro-de-la-app).

**Qué pasa hoy.** Quien no conoce la app no sabe qué se puede hacer ni dónde tocar. Algunos botones tienen un texto al pasar el ratón (el `title` del navegador), pero tarda en aparecer, no se ve con el teclado y en el celular no aparece nunca.

**Propuesta.**

- **En la página principal, al entrar**, un bloque breve «Qué podés hacer»:
  - tres o cuatro pasos con un dibujo cada uno: crear un mueble (desde una plantilla o en blanco), dividirlo y ponerle frentes, ver el despiece con el costo, y armar un ambiente;
  - un enlace a la guía de uso completa;
  - se puede cerrar («Ya lo sé») y volver a abrir desde un botón **Ayuda** fijo en la barra.
- El texto vive en un solo archivo, para que crezca con cada función nueva sin tocar las pantallas.
- **Tooltips propios** en todos los botones e iconos de herramientas (barra del 3D, árbol, propiedades, planta del ambiente, bibliotecas):
  - aparecen rápido al pasar el ratón y también al llegar con el teclado (Tab);
  - en pantallas táctiles, con una pulsación larga;
  - dicen qué hace el botón y, si existe, su atajo de teclado (por ejemplo, «Deshacer · Ctrl+Z»);
  - si el botón está desactivado, dicen por qué (por ejemplo, «Elegí primero un hueco»).
- **Pantallas vacías que explican**: un editor sin nada elegido dice «Tocá una parte del mueble para ver sus medidas»; una planta sin muebles dice cómo agregar uno.
- Más adelante: un recorrido guiado la primera vez que se abre el editor de muebles y el de ambientes.

**Hecho cuando.**

- Un usuario nuevo ve la explicación al entrar, la puede cerrar y la recupera desde **Ayuda**.
- No queda botón de solo icono sin tooltip (se comprueba con una prueba que recorre las pantallas).
- El tooltip se ve con el ratón, con el teclado y con pulsación larga en el celular, y lo lee un lector de pantalla.

---

## 9. Arrastrar puertas y ventanas en la planta del ambiente

**Qué pasa hoy.** En la vista cenital del ambiente se arrastran con el ratón los muebles y las esquinas de las paredes, pero **las puertas y ventanas no**: solo se mueven cambiando su distancia en el panel. No es un error de uso: falta la función.

**Propuesta.**

- Arrastrar una abertura la desliza **a lo largo de su pared**, sin salirse de ella. La distancia al extremo de la pared se ve mientras se arrastra.
- No puede pasar más allá de los extremos de la pared ni encimarse con otra abertura de la misma pared. Si se intenta, queda pegada al límite.
- Opcional: arrastrarla cerca de otra pared la pasa a esa pared.
- Se deshace con Ctrl+Z, como el resto.
- Con el teclado: elegida la abertura, las flechas la mueven de a 10 mm, y de a 100 mm con Mayús.
- Se ve el cursor de mover al pasar sobre la abertura, con su tooltip.

**Hecho cuando.**

- Se puede arrastrar una ventana por su pared con el ratón y con el dedo, y la distancia del panel se actualiza.
- Pruebas: la abertura no sale de la pared ni se encima con otra; en una pared fuera de escuadra sigue la pared.

