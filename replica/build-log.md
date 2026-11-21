# Registro de construcción

## Fase 1: rebanada vertical (2026-11-14)

| ID | pantalla | estado | qué falta | lo que costó más de lo previsto |
| --- | --- | --- | --- | --- |
| motor | `@mw/engine` | hecho | casos de referencia con listas de corte reales de PolyBoard (pedidas al usuario); retranqueos y holguras por pieza | elegir convenciones: enteros en 1/100 mm, canto L1 = frente, claves estables por pieza |
| S01 | Proyectos | hecho | renombrar desde la lista (se renombra dentro del proyecto) | — |
| — | Proyecto (lista de muebles) | hecho | duplicar mueble | — |
| S02 | Nuevo mueble | parcial | formas L / rinconero / libre (se ven desactivadas, "Más adelante") | — |
| S03 | Editor 3D | hecho | cotas permanentes en 3D, vista explosionada | seleccionar estantes en 3D: los huecos los tapan; se resolvió eligiendo la pieza si queda a menos de 3 cm detrás de la entrada al hueco |
| S04 | Propiedades | hecho | cambiar material y cantos de una pieza concreta (fase 2) | — |
| S05 | Divisiones | parcial | divisiones libres, paneles nulos, dobles fondos, reparto proporcional | — |
| S24 | Despiece | hecho | etiquetas, optimización de tableros | en el móvil la tabla escondía las medidas: se cambió a tarjetas por debajo de 640 px |
| S11/S12/S10 | Bibliotecas | parcial (solo lectura) | edición de materiales, cantos y métodos (fase 2) | — |

Comprobado en el navegador a 1440 px y 390 px: crear mueble, dividir con divisor y estantes, medida fija, deshacer, recarga con guardado, despiece, validación de medida. Sin errores en consola. `next build` y 23 pruebas en verde.

No comprobado:
- Descarga real del CSV desde el navegador. El contenido del CSV sí tiene pruebas unitarias.
- Modo sin conexión de la PWA. El service worker solo se registra en producción (`npm run build && npm start`).
- Instalación en un móvil real.
- Navegación solo con teclado en todo el flujo: los controles son nativos y el árbol sustituye al 3D, pero no se ha recorrido entero.

Desviaciones de `architecture.md`:
- npm workspaces en lugar de pnpm. pnpm no está instalado y activarlo con corepack pide permisos de administrador.
- La capa de datos es local (localStorage) con la misma interfaz que tendrá la de Supabase (`apps/web/src/data/types.ts`). La de Supabase llega con `/replica-backend`.
- Los tokens de diseño son provisionales (`globals.css`) hasta ejecutar `/replica-design`.

## Exportación STL y paso a GitHub (2026-11-15)

| ID | pantalla | estado | qué falta | lo que costó más de lo previsto |
| --- | --- | --- | --- | --- |
| STL | Editor → botón STL (`StlExportDialog`) | hecho | tolerancias de encaje para cajones impresos aparte; exportar un proyecto entero | las piezas finas (traseras) no se pueden imprimir a escala: se añadió un espesor mínimo que las engorda y avisa |
| — | `@mw/exporters`: `stl.ts`, `zip.ts` | hecho | — | ZIP propio sin dependencias; validado también con el `zipfile` de Python |
| docs | `README.md` y `docs/` | hecho | mantenerla al día con cada función | — |

Decisiones del usuario: no tiene CNC (el corte se encarga a una maderera), quiere STL del mueble completo y pieza a pieza con opciones para cajones, el repositorio va a GitHub (`MaharBa264/mubleando`, público) y toda la documentación detallada y en español.

Los commits se reescribieron con la dirección privada de GitHub (`…@users.noreply.github.com`) antes de la primera subida, para no publicar el correo personal.

Comprobado: 21 pruebas del motor y 15 de exportaciones en verde; `tsc` sin errores; el diálogo STL en el navegador a 1440 y 375 px, generando el ZIP (5 archivos) sin errores en consola.

## Fase 2: muebles completos (2026-11-16)

| ID | pantalla | estado | qué falta | lo que costó más de lo previsto |
| --- | --- | --- | --- | --- |
| motor | `@mw/engine` | hecho | cornisa y remates; puertas correderas; cajones interiores | decidir hasta dónde tapa un frente superpuesto: depende de si al lado hay estructura exterior (todo el tablero menos media holgura) o un estante o divisor (la mitad) |
| S06 | Puertas (en propiedades del hueco) | hecho | correderas y abatibles | — |
| S07 | Cajones (en propiedades del hueco) | hecho | cajón interior, frente doble | el alto de la caja depende de qué parte del frente cae dentro del hueco: el cajón de arriba y el de abajo salen más bajos |
| S08 | Zócalo (en propiedades del mueble) | parcial | cornisa y remates | — |
| S04 | Material y cantos por pieza | hecho | — | un material de otro espesor cambiaría la geometría: solo se permiten tableros del mismo espesor |
| S10/S11/S12 | Bibliotecas | hecho | importar catálogos de fabricantes | proteger el borrado de materiales y métodos en uso |
| S03 | Visor: frentes cerrados, abiertos, ocultos | hecho | vista explosionada | el panel de propiedades, más largo, estiraba la fila del editor: se fijó la fila a la altura disponible |

Datos: formato guardado versión 2, con migración automática de los datos de la fase 1 (métodos sin frentes ni cajones, tablero de 16 que faltaba). El motor completa también un método antiguo si le llega.

Comprobado: 47 pruebas del motor (25 nuevas con cifras calculadas a mano) y 15 de exportaciones; `tsc` sin errores; en el navegador, puerta en un bajo, cajones en una columna, frentes abiertos, cambio de canto en una pieza y vuelta al método, edición de un método, borrado protegido de un material en uso, STL con cajones aparte (4 archivos), despiece con cajones, migración de datos de la fase 1, y anchos de 1024 y 375 px sin desbordes.

## Nube: cuentas y Supabase (2026-11-16)

| ID | pantalla | estado | qué falta | lo que costó más de lo previsto |
| --- | --- | --- | --- | --- |
| BD | `supabase/migrations` | hecho | probar en un proyecto real; organizaciones | sin Docker ni Postgres en el equipo: las reglas de acceso se prueban con PGlite imitando lo mínimo de Supabase (`auth.uid()`, roles) |
| — | `data/cloud.ts` | parcial | probar contra Supabase real | — |
| S35 | Entrar / crear cuenta / recuperar | parcial | probar los correos reales | — |
| S36 | Cuenta | parcial | probar subida y borrado reales | el borrado de cuentas necesita la clave secreta: va en una ruta del servidor, no en el navegador |

Comprobado: 14 pruebas de la base de datos (dos usuarios, conflictos de versión, borrados en cascada y restringidos), 47 del motor y 15 de exportaciones; `tsc` y `next build` sin errores; en el navegador, el modo local sigue igual y con una dirección de Supabase falsa la app manda a `/entrar` recordando la página, muestra «No hay conexión con el servidor» al entrar, y la ruta de borrar cuenta responde 501 sin clave de servicio.

No comprobado: nada contra un proyecto real de Supabase (no existe todavía; lo crea el usuario). Lista de comprobación en `replica/backend.md`.

## Nube: comprobación con el proyecto real (2026-11-17)

- Primera conexión. En `.env.local`, la dirección del proyecto terminaba en `/rest/v1/`; se corrigió.
- `npm run test:nube -w @mw/web`: prueba de punta a punta contra Supabase con dos cuentas temporales.
- Fallo encontrado: no se podía borrar una cuenta con muebles («permission denied for table projects»). Corregido con la migración `20261117000000` (disparador `security definer`).
  - Lo que costó más de lo previsto: PGlite no reproduce los permisos con que Supabase ejecuta los disparadores al borrar usuarios. Un primer arreglo, la migración `20261116000001`, partió de una hipótesis equivocada. La causa real salió del registro de Auth de Supabase.
- Pruebas de la base de datos: 38, con el borrado de una cuenta con muebles en los 24 órdenes de cascada posibles.
- Pendiente: probar los correos reales (confirmación y nueva contraseña) y el uso en dos dispositivos.

## Publicación en Cloudflare: preparación (2026-11-17)

- Adaptador OpenNext (`@opennextjs/cloudflare` 1.20.15, `wrangler` 4.156.2), `wrangler.jsonc`, scripts `cf:build`, `cf:preview` y `cf:deploy`. Compila en Windows.
- Lo que costó más de lo previsto: el adaptador empaqueta dentro del Worker todos los archivos `.env`, incluidos los de desarrollo. La clave secreta pasó a `.dev.vars`, que no se empaqueta; en Cloudflare irá como secreto del Worker. Comprobado que el valor no aparece en `.open-next`.
- Probado en local con `workerd` (`cf:preview`): la app redirige a entrar, conecta con Supabase y la ruta de borrar cuenta lee el secreto (401 con un token falso). `npm run test:nube`: 9 de 9.
- `npm audit`: avisos en `glob` y `minimatch` dentro de las herramientas de compilación del adaptador; no llegan a la app publicada.
- Pendiente: el usuario entra en Cloudflare (`wrangler login`), se guarda el secreto y se publica; después, las direcciones en Supabase.

## Primera publicación en Cloudflare (2026-11-17)

- `wrangler login` (autorizado por el usuario) y `npm run cf:deploy`: Worker `mubleando` publicado en `https://mubleando.maharba264.workers.dev`.
- Comprobado: la página de inicio, «Entrar», el manifiesto, los iconos y el service worker responden 200; sin errores de consola; a 375 px sin desbordes; el service worker toma el control (instalable).
- El usuario guardó el secreto `SUPABASE_SERVICE_ROLE_KEY` en el Worker (`wrangler secret put`) y añadió la dirección publicada en Supabase (Site URL y Redirect URLs).
- Comprobado en la app publicada: borrar una cuenta con proyecto, mueble y método responde 200 y no deja ni la cuenta ni sus filas.
- Pendiente: los correos reales (confirmación y nueva contraseña) con la cuenta del usuario, y el uso en el móvil.

## Pesos argentinos (2026-11-17)

- Moneda ARS y formato `es-AR` en toda la app (`lib/format.ts`): `$ 12.345,67`, `2.400 × 599,5`, fechas argentinas. `<html lang="es-AR">`.
- Los precios se escriben como en Argentina (`25.000`, `25.000,50`); `parseCents` con pruebas.
- Los materiales de partida vienen sin precio. Los datos guardados con los precios de partida en euros quedan sin precio: en local, formato versión 3; en Supabase, la migración `20261117000001`. Los precios cambiados a mano no se tocan.
- El despiece avisa de los materiales sin precio y enlaza a Bibliotecas. Las bibliotecas muestran «sin precio».
- Vocabulario de la documentación: «costo» y «centavos».

## Constructor: plantillas, herramientas y medidas argentinas (2026-11-17)

| ID | pantalla | estado | qué falta | lo que costó más de lo previsto |
| --- | --- | --- | --- | --- |
| motor | `presets.ts`, `templates.ts`, `edgeReduceMin` | hecho | herrajes con sus tolerancias | las pruebas y los ejemplos usaban los materiales de partida: pasaron a un juego de referencia para no rehacer las cifras calculadas a mano |
| S02 | Nuevo mueble con galería de plantillas | hecho | catálogo propio del usuario | — |
| S03 | Barra de herramientas sobre el 3D, cotas | hecho; **cotas sin ver en pantalla** (el panel del navegador estaba oculto y el 3D no se dibuja) | arrastrar estantes en 3D | el usuario no encontraba puertas ni cajones: estaban solo en Propiedades al elegir un hueco |
| — | Lista del proyecto: dibujo y Duplicar | hecho | — | — |
| S10/S11 | Bibliotecas: agregar los de partida que falten; tapacanto desde X mm en el método | hecho | — | — |

Comprobado: 147 pruebas (9 del método argentino y 33 de plantillas, nuevas); `npm run test:nube` 9 de 9 contra Supabase; en el navegador (modo local) galería con 10 plantillas y dibujos, crear «Bajo con cajón y puerta» (puerta 580 y frente 174, con 3 mm entre ellos, como el cálculo a mano), barra de herramientas (+ Estante, 2 puertas), sin errores de consola.

## Cambiar paneles después de hecho el mueble (2026-11-17)

- Motor: `design.construction` (tapa entre / encima / travesaños / sin tapa; base entre / debajo; sin fondo; ancho de travesaño), retranqueo propio de estantes y divisores, `setShelfHeight`.
- Editor: sección Construcción en el mueble; en la pieza, altura exacta y retranqueo del estante, quitar tapa o fondo, y aplicar tablero y tapacantos a todas las piezas del mismo tipo.
- Fallo encontrado por las pruebas: `setOverride` descartaba un cambio que solo tenía retranqueo, por considerarlo vacío. Corregido.
- Comprobado: 102 pruebas del motor (13 nuevas, con cifras a mano); en el navegador, travesaños (564 × 100), tapa encima y base debajo con zócalo (costados de 724), estante a 200 mm con retranqueo de 50 (564 × 492), tapacanto de 2 mm copiado a los dos estantes (cada uno 2 mm menos de corte).

## Ambientes, primera versión (2026-11-18)

| ID | pantalla | estado | qué falta | lo que costó más de lo previsto |
| --- | --- | --- | --- | --- |
| motor | `room.ts` | hecho | adaptar el mueble a la esquina (relleno en el despiece) | definir la convención: esquinas por la cara interior, y que al cambiar un largo se conserven las demás medidas «como en obra», con la última pared cerrando |
| datos | tabla `rooms` + `save_room`; local formato v4 | hecho; **migración pendiente de aplicar en Supabase** | — | — |
| S21 | Proyecto: lista de ambientes; editor de ambiente (planta, paredes, aberturas, muebles, avisos, 3D) | hecho; **3D sin ver en pantalla** (panel del navegador oculto) | casa con varios ambientes; arrastrar en 3D | arrastrar con el puntero en SVG convirtiendo coordenadas de pantalla a planta |

Comprobado: 24 pruebas de geometría (fuera de escuadra con relleno de 11,2 mm a mano, L, cierre, arrimar a pared, aberturas, trozos de pared) y 6 de la tabla de ambientes en PGlite; en el navegador (modo local), cocina de ejemplo sin avisos, esquina a 92° con avisos de columna metida en la pared y alacena con relleno de 0 a 11,2 mm, colocar un mueble en un hueco libre, «Contar 2» en el despiece, arrastrar un mueble y el imán a la pared de abajo (giro de 180°, aviso de puerta tapada), vista 3D sin errores.

- 2026-11-18: el usuario aplicó la migración de ambientes en Supabase. `npm run test:nube` pasa 12 de 12 (3 nuevas de ambientes: crear y leer idéntico, conflicto de versión, otra cuenta no lo ve ni lo cambia; el borrado de cuenta también borra sus ambientes).

## Herrajes, corredizas, juguete y paredes automáticas (2026-11-18)

| ID | pantalla | estado | qué falta | lo que costó más de lo previsto |
| --- | --- | --- | --- | --- |
| motor | `hardware.ts`; `compute(…, herrajes)` con lista de herrajes | hecho | taladros, reglas de posición | cada marca usa sus propias constantes: biblioteca editable con valores típicos y fuentes citadas |
| S06 | Puertas corredizas | hecho | — | — |
| S14 | Bibliotecas → Herrajes; método y mueble eligen herrajes; despiece con herrajes | hecho; **migración pendiente de aplicar en Supabase** | — | — |
| S29b | STL de juguete | hecho; **sin imprimir todavía** | — | la bisagra en su lugar: nudillos alternados con holgura, eje por delante del mueble para que la puerta gire sin chocar, y 0,6 mm entre nudillos porque su base se imprime en el aire |
| S21 | Paredes automáticas en el 3D del ambiente | hecho; **sin ver en pantalla** | — | — |

Comprobado: 142 pruebas del motor (16 de herrajes con cifras a mano), 24 de exportaciones (9 del juguete: volumen exacto de cilindros y tubos, archivos por caso, alto de hojas corredizas), 48 de base de datos (4 de herrajes, incluida la migración que pone herrajes por defecto a los métodos argentinos); en el navegador (modo local), migración a formato 5, editar el precio de una corredera (`2.500`), herrajes en el despiece (6 pares, $ 15.000) y corrediza en un bajo de 800 (hojas de 704 × 392, juego con rieles de 764).

- 2026-11-18: el usuario aplicó la migración de herrajes. `npm run test:nube` pasa 13 de 13 (nueva: cuenta nueva con 10 herrajes, guardar precio, no se borra uno en uso, otra cuenta no ve los cambios). Los métodos argentinos de la cuenta del usuario ya tienen herrajes por defecto.

## Corredizas y estantes, issue #1 (2026-11-21)

| ID | pantalla | estado | qué falta | lo que costó más de lo previsto |
| --- | --- | --- | --- | --- |
| motor | Estantes y divisores detrás de corredizas y frentes encastrados | hecho | — | el aviso se arma al final, cuando las piezas ya tienen su nombre numerado |

Antes el motor solo avisaba y dejaba los estantes con el retranqueo del método, que chocaban con las hojas. Ahora se retranquean solos lo que ocupa el frente más 2 mm, también en los huecos de dentro. Un retranqueo elegido a mano se respeta y, si es menor, avisa con el nombre de la pieza. Comprobado: 145 pruebas del motor (3 nuevas con cifras a mano: estante de 493 a 2 mm de la hoja de atrás; huecos de dentro y vecinos; retranqueo a mano de 20 y de 60).

## Registro con lista de mails, issue #2 (2026-11-21)

| ID | pantalla | estado | qué falta | lo que costó más de lo previsto |
| --- | --- | --- | --- | --- |
| admin | Administración: mails autorizados y cuentas | hecho; **migración pendiente de aplicar en Supabase** | — | cómo nombrar al primer administrador sin poner un mail en el repositorio público: la cuenta más antigua, y en un proyecto nuevo la primera que se registra |

Comprobado: 56 pruebas de base de datos (8 nuevas: alta rechazada fuera de la lista, también sin mail; solo el administrador lee y edita; mails en minúsculas; las funciones de la pantalla fallan para los demás; sin administradores el registro vuelve a abrirse), 8 de la web (3 nuevas: separar mails pegados). La prueba contra Supabase suma 2 comprobaciones de registro.

Migración del registro aplicada en Supabase (21-11-2026): la prueba contra el proyecto real pasa 15 de 15; el único administrador es la cuenta del dueño; la lista quedó vacía y las cuentas de prueba, borradas.


## Ayuda y tooltips, issue #8 (2026-11-21)

| ID | pantalla | estado | qué falta | lo que costó más de lo previsto |
| --- | --- | --- | --- | --- |
| S01 | Inicio: «Qué podés hacer»; página /ayuda; botón Ayuda | hecho | recorrido guiado | — |
| todas | Tooltips propios (ratón, teclado, pulsación larga) | hecho | — | que la pulsación larga no active el botón ni abra el menú del navegador |

Comprobado: 15 pruebas de la web (7 nuevas: texto del tooltip, atajo aparte, posición dentro de la ventana, y que todo botón de solo icono tenga aria-label, title o data-tip); en el navegador (modo local), la explicación del inicio, el tooltip de Ayuda y el de Deshacer desactivado con su atajo. La pulsación larga no se probó en un celular real.

## Arrastrar aberturas, issue #9 (2026-11-21)

| ID | pantalla | estado | qué falta | lo que costó más de lo previsto |
| --- | --- | --- | --- | --- |
| S21 | Planta del ambiente: puertas y ventanas arrastrables, flechas, distancias a los extremos | hecho | pasar una abertura a otra pared arrastrándola | los muebles de delante tapaban la abertura: la zona para agarrarla se extiende por fuera de la pared |

Comprobado: 151 pruebas del motor (7 nuevas de `slideOpening`: dentro de la pared, pegada a los extremos y a otra abertura, salto al lugar libre más cercano, pared fuera de escuadra); en el navegador (modo local), arrastrar la ventana hasta el final de la pared (queda en 2200 en una pared de 3200), Mayús + flecha (300 mm) y las distancias 1.900 y 300. El arrastre con el dedo no se probó en un celular real.
