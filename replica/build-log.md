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
