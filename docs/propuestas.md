# Propuestas

Funciones propuestas, en el orden en que conviene hacerlas. Cada una tiene su *issue* en GitHub, donde se discute y se marca cuando está hecha. Cuando una propuesta se termina, pasa a la [Hoja de ruta](hoja-de-ruta.md) y a la documentación de su tema.

| # | Propuesta | Tamaño | Por qué en este lugar |
| --- | --- | --- | --- |
| 1 | [Corredizas: los estantes no tienen que chocar con las hojas](#1-corredizas-los-estantes-no-tienen-que-chocar-con-las-hojas) | chico | Es un error de medidas: lo que se corta hoy no se puede armar. |
| 2 | [Registro solo para mails autorizados](#2-registro-solo-para-mails-autorizados) | chico | Hoy cualquiera puede crearse una cuenta en el proyecto de Supabase. |
| 3 | [Plano de cortes en las placas](#3-plano-de-cortes-en-las-placas) | grande | Es lo que más se usa: cuántas placas comprar y cuánto cuestan. |
| 4 | [Etiquetas para pegar en las piezas](#4-etiquetas-para-pegar-en-las-piezas) | mediano | Usa el plano de cortes (cada etiqueta dice de qué placa sale la pieza). |
| 5 | [Patas, como herrajes de la biblioteca](#5-patas-como-herrajes-de-la-biblioteca) | mediano | Cambia lo que ocupa el mueble en el piso: conviene antes de las colisiones. |
| 6 | [Muebles que no se atraviesan en el ambiente](#6-muebles-que-no-se-atraviesan-en-el-ambiente) | mediano | Necesita la huella real del mueble, patas incluidas. |

---

## 1. Corredizas: los estantes no tienen que chocar con las hojas

**Qué pasa hoy.** Las hojas corredizas van dentro del hueco y ocupan, desde el frente, el retiro de la hoja delantera más dos espesores de hoja más el espacio entre rieles. Con el sistema de partida y hojas de 18 mm son 5 + 18 + 6 + 18 = **47 mm**. El motor solo **avisa**: los estantes y divisores siguen con el retranqueo del método (pocos milímetros), así que en el despiece salen con un fondo que choca con las hojas. Además, el control mira el retranqueo del método y no el que se haya cambiado en un estante concreto.

**Propuesta.**

- Detrás de una puerta corrediza, los estantes y divisores del hueco (y los de sus subdivisiones) se retranquean **solos** lo que ocupan las hojas más un margen de 2 mm. Con el ejemplo: 49 mm. Su fondo en el despiece baja en consecuencia.
- Si el usuario cambió a mano el retranqueo de un estante, se respeta el suyo. Si es menor que lo necesario, aparece el aviso de choque con el nombre del estante.
- El control mira cada estante y divisor con su retranqueo real (el del método o el cambiado), no solo el valor del método.
- Lo mismo para las puertas encastradas, que usan el mismo control (ahí lo necesario es el espesor de la puerta).

**Hecho cuando.**

- Un bajo de 1200 con 2 hojas y un estante: el estante sale con 49 mm menos de fondo que sin corrediza, y no hay aviso.
- Con el retranqueo del estante forzado a 20 mm, aparece el aviso con su nombre.
- Pruebas del motor con estas cifras calculadas a mano.

---

## 2. Registro solo para mails autorizados

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

## 6. Muebles que no se atraviesan en el ambiente

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
