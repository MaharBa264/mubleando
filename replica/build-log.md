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
