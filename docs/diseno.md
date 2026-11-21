# Sistema de diseño

Esta página es la referencia visual de la aplicación. Cualquier pantalla o módulo nuevo tiene que poder construirse **solo con lo que está acá**: si hace falta un color, un radio o un componente que no existe, se agrega primero a esta página y a `apps/web/src/app/globals.css`, y después se usa.

- Tokens: [`apps/web/src/app/globals.css`](../apps/web/src/app/globals.css)
- Tipografías: [`apps/web/src/app/layout.tsx`](../apps/web/src/app/layout.tsx)
- Componentes base: [`apps/web/src/components/ui/`](../apps/web/src/components/ui/)

## Principios permanentes

Tomamos Shapr3D como referencia **conceptual** de claridad, orden y aprovechamiento del espacio, sin copiar su interfaz ni su identidad visual.

1. **El mueble es protagonista.** El espacio de trabajo 3D tiene prioridad sobre barras, paneles y adornos.
2. **Complejidad progresiva.** Primero las herramientas relevantes; las opciones avanzadas aparecen cuando se necesitan.
3. **Manipulación directa.** Se selecciona y edita sobre el modelo, conservando campos numéricos para la precisión.
4. **Diseño contextual.** Las herramientas responden a lo seleccionado: mueble, hueco, puerta, cajón o pieza.
5. **Consistencia.** Se reutilizan los componentes existentes y un único sistema visual.
6. **Precisión sin complejidad innecesaria.** Medidas, restricciones y consecuencias de cada operación tienen que ser comprensibles.
7. **Escritorio y móvil.** Se diseña para ambos, adaptando la interacción al ratón y al dedo.
8. **Accesibilidad.** Teclado, contraste suficiente, etiquetas y estados visibles.
9. **Identidad propia.** Nada de interfaces genéricas, decoración gratuita ni parecidos excesivos con productos existentes.
10. **Conservar lo que funciona.** El motor de cálculo, las reglas de fabricación y las exportaciones no se tocan por motivos estéticos.

### Procedimiento

Antes de hacer una pantalla o herramienta: revisar esta página y los componentes de `components/ui/`, identificar la acción principal y las decisiones que el usuario necesita tomar, y pensar jerarquía, espacio y estados.

Después: probarla en un navegador real a ancho de escritorio y de móvil (unos 375 px), en modo claro y oscuro; verificar selección, edición, errores, estados vacíos y respuesta visual; correr `npm test`, `npm run typecheck` y `npm run build`. **La calidad visual y la usabilidad forman parte de "terminado".**

## Dirección visual: "taller luminoso"

- **Fondo hueso cálido** (`--bg`, `--viewer-bg`), como un estudio fotográfico de muebles. La escena 3D usa el mismo tono, así el mueble se ve "en su lugar" y no dentro de una caja gris.
- **Superficies blancas que flotan** sobre la escena (paneles del editor, barras de herramientas), con radios generosos y sombras cálidas y difusas.
- **Un solo color de acción: azul cobalto** (`--accent`). Marca lo que se puede pulsar como acción principal, lo activo y lo seleccionado, también en el 3D (`--sel`). Se dejó atrás el verde agua anterior.
- **Interfaz neutra**: grises cálidos para todo lo demás, para que el color lo pongan los materiales del mueble.

## Color

Todos los pares de texto/fondo cumplen WCAG AA (4,5:1 o más) en claro y oscuro. Se comprobó con un script de contraste al definir la paleta; si cambiás un valor, volvé a medirlo.

| Token | Claro | Oscuro | Uso |
| --- | --- | --- | --- |
| `--bg` | `#f3f0eb` | `#131312` | Fondo de página. |
| `--surface` | `#ffffff` | `#1c1b1a` | Tarjetas, paneles, diálogos, campos. |
| `--surface-2` | `#ece8e1` | `#272624` | Hover, fondo de controles segmentados, miniaturas. |
| `--border` | `#e1dcd3` | `#33312e` | Bordes y separadores. |
| `--border-strong` | `#c3bcb0` | `#4d4a45` | Hover de bordes, bordes punteados de estados vacíos. |
| `--text` | `#1a1917` | `#f2f0ec` | Texto principal. |
| `--text-muted` | `#665f55` | `#a49e94` | Texto secundario, etiquetas, unidades. Contraste 5,2:1 o más. |
| `--accent` | `#1a5fd6` | `#6aa5ff` | Acción principal, foco, activo. |
| `--accent-hover` | `#134cb3` | `#8cb9ff` | Hover del botón principal. |
| `--accent-soft` | `#e4edfc` | `#172a4c` | Fondo de lo seleccionado en listas y barras. |
| `--accent-contrast` | `#ffffff` | `#08142b` | Texto sobre `--accent`. |
| `--danger` / `--danger-soft` | `#b42a20` / `#fbe8e6` | `#f2867e` / `#3b1d1b` | Errores y acciones destructivas. |
| `--warning` / `--warning-soft` | `#865300` / `#fbf0d9` | `#eec06a` / `#3a2f16` | Avisos del motor, ángulos fuera de escuadra. |
| `--sel` | `#2f7bf5` | `#4c94ff` | Pieza u objeto seleccionado en el 3D y en la planta. |
| `--zone` | `#2f7bf5` | `#4c94ff` | Resaltado de huecos al pasar el puntero. |
| `--viewer-bg` | `#e9e5de` | `#201f1d` | Fondo de la escena 3D y de todo el editor. |
| `--viewer-line` | `#6b655b` | `#8d877b` | Aristas y cotas del 3D. |
| `--mat-*` | — | — | Colores de muestra de materiales. **No** son de interfaz. |

Reglas:

- En los componentes se usan las clases de Tailwind (`bg-surface`, `text-muted`, `border-border`…) o `var(--x)` en SVG y three.js. **Nunca** un hexadecimal suelto.
- El azul es escaso a propósito: por pantalla, **un solo** botón `primary`. El resto es `secondary` o `ghost`.
- Lo seleccionado siempre se marca con la familia azul: `bg-accent-soft text-accent` en listas, `--sel` en el 3D.

## Tipografía

Las tres familias se cargan con `next/font/google`, que las descarga al compilar y las sirve desde la propia app (el navegador del usuario no pide nada a Google).

| Familia | Variable | Uso |
| --- | --- | --- |
| **Onest** | `--font-ui` → `font-sans` | Toda la interfaz: textos, botones, campos, listas. Clara en tamaños chicos y con cifras tabulares (`.tabular`). |
| **Bricolage Grotesque** | `--font-titles` → `font-display` | Títulos: `h1` (automático), títulos de sección del panel de propiedades, títulos de diálogo, marca, nombre del mueble en el editor. |
| **JetBrains Mono** | `--font-num` → `.measure` | Medidas que se leen como dato técnico: cotas del 3D y chip de dimensiones del mueble. No se usa para texto. |

Escala en uso:

| Rol | Clases |
| --- | --- |
| Título de página (`h1`) | `text-[28px] sm:text-[32px] font-semibold leading-tight` (Bricolage) |
| Título de diálogo | `font-display text-lg font-semibold` |
| Título de sección del panel | `font-display text-[15px] font-semibold tracking-tight` |
| Etiqueta de grupo (árbol) | `text-[11px] font-semibold uppercase tracking-[0.08em] text-muted` |
| Texto | `text-sm` |
| Etiqueta de campo | `text-xs font-medium text-muted` |
| Ayudas, estados | `text-xs text-muted` |
| Cotas | `.measure text-[11px] font-medium` |

Las medidas en listas y tablas llevan `.tabular` para que los números se alineen.

## Forma y profundidad

| Token | Valor | Clase | Para |
| --- | --- | --- | --- |
| `--radius-s` | 8 px | `rounded-control` | Botones, campos, ítems de lista. |
| `--radius-m` | 14 px | `rounded-card` | Tarjetas, paneles flotantes, barras sobre el 3D. |
| `--radius-l` | 20 px | `rounded-sheet` | Diálogos. |
| — | — | `rounded-full` | Píldoras: navegación, controles segmentados, barra de vista, chips de medida, botones − / +. |

> **Ojo:** las clases se llaman `rounded-control`, `rounded-card` y `rounded-sheet` a propósito. En Tailwind v4, `rounded-s` y `rounded-l` son utilidades de **esquinas lógicas** (inicio / izquierda): con los nombres anteriores las esquinas quedaban desparejas (4 px de un lado y 8 px del otro).

| Sombra | Para |
| --- | --- |
| `shadow-1` | Botones, tarjetas en reposo, la opción activa de un control segmentado. |
| `shadow-float` | Todo lo que flota sobre la escena 3D: paneles del editor, barras de herramientas, chips. |
| `shadow-2` | Diálogos. |

## Componentes base (`components/ui/`)

### `Button` / `ButtonLink` / `buttonClass()`

- Variantes: `primary` (una por pantalla), `secondary` (blanco con borde), `ghost` (sin fondo, para acciones de fila y barras), `danger` (confirmar borrados).
- Tamaños: `md` (40 px, por defecto), `sm` (32 px, barras y filas), `icon` (40 × 40) e `icon-sm` (32 × 32) para un solo icono. Un botón de icono **siempre** lleva `aria-label`.
- Al pulsar baja 1 px (`active:translate-y-px`); deshabilitado queda al 45 % de opacidad.

### `Icon`

Set propio de iconos de trazo (24 × 24, trazo 1,75, puntas redondeadas) en `ui/Icon.tsx`: `back`, `undo`, `redo`, `close`, `trash`, `plus`, `minus`, `check`, `cube`, `square`, `wire`, `ruler`, `door`, `focus`, `download`, `list`, `layers`, `sliders`. Heredan el color del texto. Para uno nuevo se agrega su trazo a `PATHS` con el mismo estilo. No se usan glifos de texto (←, ↶, ✕) como iconos.

### Campos (`fields.tsx`)

`TextField`, `SelectField`, `MmField` (medidas en mm, con unidad dentro del campo) y `Stepper` (− n +, botones redondos azules). Al enfocar: borde azul y halo suave (`ring-3 ring-accent/20`). Con error: borde y halo rojos y el mensaje debajo con `role="alert"`.

### Control segmentado

Para elegir una opción entre pocas (2 a 4). Contenedor `bg-surface-2`, opción activa `bg-surface shadow-1` con texto en `font-medium`. Se usa en la navegación principal y las pestañas móviles (versión píldora, `rounded-full`), en el panel de propiedades (`Segmented`, `role="radiogroup"`) y en la vista Planta / 3D de ambientes.

### `Dialog` / `ConfirmDialog`

`<dialog>` nativo (foco atrapado, Esc cierra). Radio `rounded-sheet`, sin líneas de separación: título con Bricolage arriba, contenido desplazable, botones abajo a la derecha. El fondo se oscurece y desenfoca levemente.

### `feedback.tsx`

`Alert` (warning, danger, info), `Skeleton`, `LoadingBlock`, `EmptyState` (borde punteado con acción principal) y `ErrorState` (con "Reintentar").

## Patrones de pantalla

### Editores (mueble y ambiente)

```
┌ barra principal (48 px, fondo hueso translúcido) ───────────────────────┐
├ barra del documento: ← nombre · ● Guardado        ↶ ↷ │ STL [Despiece] ┤
│ ┌ Estructura ┐  [800 × 860 × 560 mm] [herramientas del hueco]  ┌ Props ┐│
│ │  tarjeta   │                                                  │tarjeta││
│ │  flotante  │              escena 3D (protagonista)            │flotan-││
│ │            │                                                  │  te   ││
│ └────────────┘     ( Perspectiva · Alámbrico · Cotas · … )      └───────┘│
└───────────────────────────────────────────────────────────────────────────┘
```

- En escritorio la escena (`bg-viewer`) es el fondo de **todo** el editor y los paneles son tarjetas (`rounded-card shadow-float`) separadas 12 px de los bordes. El mueble queda centrado en su columna.
- El alto del editor está fijo al de la ventana menos la barra principal (`lg:h-[calc(100dvh-3rem)] lg:flex-none`). Sin `lg:flex-none` el contenedor crecía con el contenido, la página se desplazaba y el lienzo 3D quedaba altísimo, con el mueble cortado.
- Sobre la escena, arriba: el chip de medidas (`.measure`, píldora) y las herramientas contextuales del hueco seleccionado. Abajo al centro: la barra de vista en forma de píldora; en móvil muestra solo iconos (el texto queda como nombre accesible y tooltip).
- El estado de guardado lleva un punto: gris guardado, azul pulsante guardando, rojo error.
- En móvil: visor arriba (46 % del alto), y debajo el panel con pestañas Propiedades / Estructura como control segmentado.

### Páginas de listado (proyectos, bibliotecas, cuenta)

`Page` de `AppShell.tsx`: ancho máximo 1024 px, título grande con Bricolage, acciones a la derecha (una sola `primary`). Tarjetas `rounded-card shadow-1` sobre el fondo hueso.

## Qué no cambió

Esta línea de trabajo fue **solo visual**: no se agregó ni quitó ninguna función. No se tocaron el motor (`packages/engine`), las exportaciones, la capa de datos ni la lógica de los componentes; solo clases, tokens, tipografías, iconos y la disposición visual de los editores. Los iconos de la PWA se regeneraron con el nuevo azul (`node scripts/make-icons.mjs apps/web/public`).

## Registro de decisiones

| Fecha | Decisión | Motivo |
| --- | --- | --- |
| 2026-11-21 | Acento azul cobalto en lugar de verde agua. | Pedido explícito de salir del verde agua; el azul es el color de selección que el usuario espera en herramientas de modelado y se lleva bien con los colores de madera y melamina. |
| 2026-11-21 | Onest + Bricolage Grotesque + JetBrains Mono. | Tipografías más frescas que la del sistema; Bricolage le da identidad a títulos sin usarse en texto chico; la monoespaciada marca las medidas como dato técnico. |
| 2026-11-21 | Paneles del editor flotando sobre la escena. | Principio 1: el mueble es protagonista; referencia del configurador con panel blanco sobre fondo de estudio. |
| 2026-11-21 | Radios con nombres semánticos (`rounded-control/card/sheet`). | Los nombres `rounded-s/m` chocaban con utilidades de Tailwind v4 y dejaban esquinas desparejas. |
| 2026-11-21 | Alto del editor fijo en escritorio (`lg:flex-none`). | El lienzo 3D crecía más que la ventana y el mueble aparecía cortado y demasiado cerca. |
