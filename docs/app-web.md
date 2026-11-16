# La aplicación web (`apps/web`)

Next.js 16 con App Router. Todas las páginas son de cliente (`'use client'`): el motor corre en el navegador, así que cada cambio se recalcula al instante y sin conexión.

## Pantallas y rutas

| Ruta | Pantalla | Archivo |
| --- | --- | --- |
| `/` | Proyectos: lista, crear y borrar | `src/app/page.tsx` |
| `/proyectos/[id]` | Un proyecto: sus muebles, renombrar, nuevo mueble | `src/app/proyectos/[id]/page.tsx` |
| `/proyectos/[id]/despiece` | Despiece del proyecto entero | `src/app/proyectos/[id]/despiece/page.tsx` |
| `/muebles/[id]` | Editor del mueble | `src/app/muebles/[id]/page.tsx` → `components/editor/Editor.tsx` |
| `/muebles/[id]/despiece` | Despiece de un mueble | `src/app/muebles/[id]/despiece/page.tsx` |
| `/bibliotecas` | Materiales, cantos y métodos (solo lectura) | `src/app/bibliotecas/page.tsx` |

Diálogos:

- **Nuevo mueble**: `components/NewCabinetDialog.tsx`.
- **Exportar STL**: `components/StlExportDialog.tsx`. Calcula la exportación al vuelo para enseñar el tamaño impreso y los avisos antes de descargar.

## Componentes

| Carpeta / archivo | Qué contiene |
| --- | --- |
| `components/ui/Button.tsx` | `Button`, `ButtonLink` y `buttonClass(variante, tamaño)` para dar aspecto de botón a un enlace. |
| `components/ui/fields.tsx` | `TextField`, `SelectField`, `MmField` (medida en mm con validación, Intro para aplicar, Esc para deshacer, vacío = automático) y `Stepper` (− número +). |
| `components/ui/Dialog.tsx` | Diálogo modal sobre `<dialog>` nativo (foco atrapado y Esc de serie) y `ConfirmDialog`. |
| `components/ui/feedback.tsx` | `Skeleton`, `LoadingBlock`, `Alert`, `EmptyState`, `ErrorState`. |
| `components/AppShell.tsx` | Cabecera, navegación y el contenedor `Page`. |
| `components/CutListView.tsx` | La lista de corte: agrupada o pieza a pieza, tarjetas en el móvil y tabla en el ordenador, totales, imprimir y CSV. |
| `components/editor/` | El editor (ver abajo). |
| `components/viewer/CabinetViewer.tsx` | El visor 3D. |
| `lib/format.ts` | Formato de medidas, dinero, números y fechas en español (`fmtMm`, `fmtMoney`…) y `parseMm`, que acepta coma decimal. |
| `lib/download.ts` | `downloadBlob`: descarga un archivo generado en el navegador. |
| `lib/useAsync.ts` | Hook para cargar datos con estados de carga, error y reintento. |

## El editor

- **Estado** (`editor/store.ts`): un store de Zustand con el diseño, el método, la cantidad, el nombre, la selección (mueble, hueco o pieza), el elemento bajo el ratón y las opciones de vista. `apply(fn)` aplica una función de edición del motor y guarda el diseño anterior en el historial (máximo 100 pasos), lo que hace que deshacer y rehacer sean triviales.
- **Contexto** (`editor/context.tsx`): da a todos los paneles el store, los materiales, los métodos y el resultado del cálculo.
- **Cálculo**: `Editor.tsx` llama a `compute()` con `useMemo` cada vez que cambia el diseño o el método. Tarda menos de un milisegundo en un mueble normal.
- **Estructura** (`StructureTree.tsx`), **Propiedades** (`PropertiesPanel.tsx`) y nombres legibles de los huecos (`labels.ts`: "Interior", "Columna 2", "Nivel 3").
- **Atajos**: Ctrl+Z, Ctrl+Y / Ctrl+Mayús+Z, Esc. No actúan mientras se escribe en un campo.
- **Aviso al salir**: si quedan cambios sin guardar, el navegador pregunta antes de cerrar la pestaña.

## El visor 3D

`CabinetViewer.tsx`, con React Three Fiber. Se carga con `next/dynamic` sin renderizado en servidor, porque WebGL solo existe en el navegador.

- **Escala**: 1 unidad de Three.js = 1 metro (las centésimas de mm se multiplican por 1/100 000).
- **Colores**: se leen de las variables CSS (`--mat-white`, `--sel`…), así el 3D sigue el tema claro u oscuro.
- **Huecos**: cajas transparentes 1 mm más pequeñas que el hueco, para poder seleccionarlos.
- **Selección**: al pulsar, si hay una pieza a menos de 3 cm por detrás de la entrada al hueco, gana la pieza. Así se pueden seleccionar los estantes aunque los huecos estén delante. Un arrastre de más de 6 píxeles se toma como giro de cámara y no selecciona.
- **Cámara**: perspectiva u ortogonal, con OrbitControls (ratón y táctil).

## Datos

La interfaz no habla directamente con el almacenamiento: usa una **capa de datos** con una interfaz fija (`src/data/types.ts`, `DataLayer`):

| Función | Qué hace |
| --- | --- |
| `listProjects`, `getProject`, `createProject`, `renameProject`, `deleteProject` | Proyectos. |
| `listCabinets`, `getCabinet`, `createCabinet`, `deleteCabinet` | Muebles. |
| `saveCabinet(id, rev, cambios)` | Guarda y devuelve la nueva versión (`rev`). Si la versión guardada ya no es `rev`, lanza `ConflictError`. |
| `listMaterials`, `listMethods` | Bibliotecas. |

Hoy la implementación es `src/data/local.ts`:

- Guarda todo en `localStorage` bajo la clave `mueblesweb:v1`.
- La primera vez crea los datos de ejemplo.
- Valida cada diseño con zod al leerlo.
- Si el almacenamiento falla (modo privado, cuota llena), sigue funcionando en memoria.
- Escucha el evento `storage` para enterarse de cambios hechos en otra pestaña.
- `saveCabinet` vuelve a leer la versión guardada antes de escribir: es el **control optimista** que detecta conflictos entre pestañas.

Cuando llegue el guardado en la nube, se escribirá otra implementación de `DataLayer` (Supabase) y se cambiará una línea en `src/data/index.ts`. Las pantallas no cambian. El esquema SQL previsto está en [`replica/schema.sql`](../replica/schema.sql).

## Estilos y tema

- Tailwind CSS 4. Los colores, radios y sombras son variables CSS en `src/app/globals.css` y se exponen a Tailwind con `@theme inline` (`bg-surface`, `text-muted`, `bg-accent-soft`…). No se escriben colores sueltos en los componentes.
- Tema oscuro automático según el sistema (`prefers-color-scheme`).
- Estilos de impresión: lo marcado con `.no-print` no sale en papel.
- Son provisionales hasta que se haga el diseño visual propio.

## PWA y modo sin conexión

- `src/app/manifest.ts`: nombre, colores e iconos para instalarla.
- `public/sw.js`: el *service worker*. Solo se registra en producción (`components/PwaRegister`).
- Iconos en `public/` y `src/app/` (generados con `scripts/make-icons.mjs`).
- Instalar en el móvil exige HTTPS, que llegará al publicarla.

## Accesibilidad

- Controles nativos (`button`, `select`, `input`, `dialog`), con etiquetas.
- Enlace "saltar al contenido".
- El árbol de estructura permite hacer con teclado todo lo que se hace pulsando en el 3D.
- La selección se anuncia a los lectores de pantalla (`aria-live`).
- Pendiente: recorrer el flujo completo solo con teclado.
