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
| `/bibliotecas` | Tableros, cantos y métodos de fabricación, editables | `src/app/bibliotecas/page.tsx` |
| `/entrar` | Entrar, crear cuenta, recuperar la contraseña (solo con nube) | `src/app/entrar/page.tsx` |
| `/restablecer` | Contraseña nueva desde el enlace del correo | `src/app/restablecer/page.tsx` |
| `/cuenta` | Sesión, subir los datos del navegador, borrar la cuenta. Sin nube, explica dónde están los datos | `src/app/cuenta/page.tsx` |
| `POST /api/cuenta/borrar` | Borra la cuenta de quien la pide (servidor) | `src/app/api/cuenta/borrar/route.ts` |

Diálogos:

- **Nuevo mueble**: `components/NewCabinetDialog.tsx`. Galería de plantillas agrupadas, cada una con su dibujo; medidas, nombre y método; vista previa del frente que se actualiza al cambiar las medidas.
- **Exportar STL**: `components/StlExportDialog.tsx`. Calcula la exportación al vuelo para enseñar el tamaño impreso y los avisos antes de descargar. Las opciones de cajones se activan solas cuando el mueble los tiene.
- **Tablero o canto**: `components/libraries/MaterialDialog.tsx` (nombre, espesor, precio con coma decimal, veta, color del visor).
- **Método de fabricación**: `components/libraries/MethodDialog.tsx`, en cuatro bloques (estructura, trasera, frentes, cajones), con avisos de incoherencias antes de guardar.

## Componentes

| Carpeta / archivo | Qué contiene |
| --- | --- |
| `components/ui/Button.tsx` | `Button`, `ButtonLink` y `buttonClass(variante, tamaño)` para dar aspecto de botón a un enlace. |
| `components/ui/fields.tsx` | `TextField`, `SelectField`, `MmField` (medida en mm con validación, Intro para aplicar, Esc para deshacer, vacío = automático) y `Stepper` (− número +). |
| `components/ui/Dialog.tsx` | Diálogo modal sobre `<dialog>` nativo (foco atrapado y Esc de serie) y `ConfirmDialog`. |
| `components/ui/feedback.tsx` | `Skeleton`, `LoadingBlock`, `Alert`, `EmptyState`, `ErrorState`. |
| `components/AppShell.tsx` | Cabecera, navegación y el contenedor `Page`. |
| `components/CabinetSketch.tsx` | Dibujo del frente de un mueble en SVG a partir de las piezas del motor (de atrás hacia delante, con tiradores). Miniaturas de la galería y de la lista del proyecto. |
| `components/editor/QuickTools.tsx` | Barra de herramientas sobre el 3D para el hueco elegido: + / − estante, + / − divisor, puerta, 2 puertas, cajones, sin frente. |
| `components/CutListView.tsx` | La lista de corte: agrupada o pieza a pieza, tarjetas en el móvil y tabla en el ordenador, totales, imprimir y CSV. |
| `components/editor/` | El editor (ver abajo). |
| `components/viewer/CabinetViewer.tsx` | El visor 3D. |
| `lib/format.ts` | Formato de Argentina (`LOCALE = 'es-AR'`, `CURRENCY = 'ARS'`): medidas, pesos, números y fechas (`fmtMm`, `fmtMoney`…). `parseMm` acepta coma o punto decimal; `parseCents` lee precios como `25.000,50`. Pruebas en `lib/format.test.ts`. Para otro país basta con cambiar esas dos constantes. |
| `lib/download.ts` | `downloadBlob`: descarga un archivo generado en el navegador. |
| `lib/useAsync.ts` | Hook para cargar datos con estados de carga, error y reintento. |

## El editor

- **Estado** (`editor/store.ts`): un store de Zustand con el diseño, el método, la cantidad, el nombre, la selección (mueble, hueco o pieza), el elemento bajo el ratón y las opciones de vista. `apply(fn)` aplica una función de edición del motor y guarda el diseño anterior en el historial (máximo 100 pasos), lo que hace que deshacer y rehacer sean triviales.
- **Contexto** (`editor/context.tsx`): da a todos los paneles el store, los materiales, los métodos y el resultado del cálculo.
- **Cálculo**: `Editor.tsx` llama a `compute()` con `useMemo` cada vez que cambia el diseño o el método. Tarda menos de un milisegundo en un mueble normal.
- **Estructura** (`StructureTree.tsx`): huecos (con una marca si tienen puerta o cajones) y piezas agrupadas en Caja, Estantes y divisores, Puertas y un grupo por cajón.
- **Propiedades** (`PropertiesPanel.tsx`): según lo seleccionado.
  - Mueble: medidas, zócalo, método y unidades.
  - Hueco: frente (abierto, puerta o cajones, con montaje, hojas, bisagras, número y alturas de cajones), divisiones y medidas de los hijos.
  - Pieza: material (solo tableros del mismo espesor) y cantos por lado, con «Volver a lo del método».
- Nombres legibles de los huecos (`labels.ts`: "Interior", "Columna 2", "Nivel 3").
- **Atajos**: Ctrl+Z, Ctrl+Y / Ctrl+Mayús+Z, Esc. No actúan mientras se escribe en un campo.
- **Aviso al salir**: si quedan cambios sin guardar, el navegador pregunta antes de cerrar la pestaña.

## El visor 3D

`CabinetViewer.tsx`, con React Three Fiber. Se carga con `next/dynamic` sin renderizado en servidor, porque WebGL solo existe en el navegador.

- **Escala**: 1 unidad de Three.js = 1 metro (las centésimas de mm se multiplican por 1/100 000).
- **Colores**: se leen de las variables CSS (`--mat-white`, `--sel`…), así el 3D sigue el tema claro u oscuro.
- **Huecos**: cajas transparentes 1 mm más pequeñas que el hueco, para poder seleccionarlos.
- **Selección**: al pulsar, si hay una pieza a menos de 3 cm por detrás de la entrada al hueco, gana la pieza. Así se pueden seleccionar los estantes aunque los huecos estén delante. Un arrastre de más de 6 píxeles se toma como giro de cámara y no selecciona.
- **Cámara**: perspectiva u ortogonal, con OrbitControls (ratón y táctil).
- **Cotas** (`view.dims`): líneas y etiquetas (drei `Line` y `Html`) con el ancho, el alto y el fondo, por delante del frente más saliente, y la medida libre del hueco elegido.
- **Frentes** (`view.fronts` en el store): `closed` (como quedará), `open` (cada puerta gira 95° sobre el canto de sus bisagras, según `part.hinge`; cada cajón sale el 60 % de su fondo, moviendo todas las piezas con el mismo `assembly.id`) y `hidden` (sin puertas ni frentes de cajón, para trabajar en el interior).

## Datos

La interfaz no habla directamente con el almacenamiento: usa una **capa de datos** con una interfaz fija (`src/data/types.ts`, `DataLayer`):

| Función | Qué hace |
| --- | --- |
| `listProjects`, `getProject`, `createProject`, `renameProject`, `deleteProject` | Proyectos. |
| `listCabinets`, `getCabinet`, `createCabinet`, `deleteCabinet` | Muebles. |
| `saveCabinet(id, rev, cambios)` | Guarda y devuelve la nueva versión (`rev`). Si la versión guardada ya no es `rev`, lanza `ConflictError`. |
| `listMaterials`, `saveMaterial`, `deleteMaterial` | Tableros y cantos. Borrar lanza `InUseError` si algún método usa el material. |
| `listMethods`, `saveMethod`, `deleteMethod` | Métodos. Borrar lanza `InUseError` si algún mueble usa el método o si es el último. |

Hay dos implementaciones, y `src/data/index.ts` elige una al arrancar:

- **Nube** (`src/data/cloud.ts`) si existen `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Detalles en [Guardado en la nube](nube.md).
- **Navegador** (`src/data/local.ts`) si no.

La del navegador:

- Guarda todo en `localStorage` bajo la clave `mueblesweb:v1`.
- La primera vez crea los datos de ejemplo.
- Valida cada diseño, material y método con zod al leerlo y al guardarlo.
- Lleva un número de versión del formato (`schema`). Al abrir datos de una versión anterior los pone al día sin borrar nada (`migrate`): la versión 2 añade a los métodos los frentes y cajones por defecto y el tablero de 16 que usan los cajones.
- Los datos de ejemplo incluyen un bajo con dos puertas y zócalo, una cajonera y una despensa.
- Si el almacenamiento falla (modo privado, cuota llena), sigue funcionando en memoria.
- Escucha el evento `storage` para enterarse de cambios hechos en otra pestaña.
- `saveCabinet` vuelve a leer la versión guardada antes de escribir: es el **control optimista** que detecta conflictos entre pestañas.

Las pantallas no saben cuál se está usando. La sesión la lleva `components/auth/AuthProvider.tsx`; su `AuthGate`, dentro de `AppShell`, manda a `/entrar` a quien no ha entrado cuando hay nube. En la cabecera, el enlace de la derecha lleva a `/cuenta`.

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
