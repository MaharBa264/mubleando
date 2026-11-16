# Arquitectura: mueblesweb (nombre provisional), app propia que reconstruye las funciones principales de PolyBoard 6

Sale de `recon.md` y `features.csv` (2026-11-14). Supuesto: primero para el taller del usuario, con opción de venderla a otros talleres más adelante. Por eso hay organizaciones desde el primer día y los pagos quedan para el final.

## La idea central

PolyBoard es, por dentro, **un motor que convierte una intención en piezas**: "mueble de 600×720×560, un estante, una puerta" → 7 paneles con medidas, cantos, taladros y herrajes. Todo lo demás (3D, listas, CNC) lee la salida de ese motor.

Así que la app se divide en tres capas y solo una toca la base de datos:

```
 ┌──────────── Next.js (web + móvil como PWA) ────────────┐
 │  UI: editor, bibliotecas, listas      Visor 3D (R3F)    │
 │              │                              ▲            │
 │              ▼                              │            │
 │   @mw/engine  ── diseño JSON + método + materiales ──►   │  función pura, TypeScript,
 │               ◄── piezas, cantos, mecanizados, herrajes  │  corre en el navegador (instantáneo,
 │              │                                           │  sin conexión) y en el servidor (exports)
 │              ▼                                           │
 │   @mw/exporters  → CSV · DXF · PDF · etiquetas · CNC     │
 └──────────────────────────┬──────────────────────────────┘
                            │ guarda solo el diseño (jsonb) y las bibliotecas
                     Supabase (Postgres + Auth + Storage)
```

- **El motor es una librería sin interfaz ni red**: entra un documento, salen piezas, y la misma entrada da siempre la misma salida. Se prueba con "casos de referencia": mueble hecho en PolyBoard → su lista de corte → el mismo mueble en el motor → las cifras tienen que coincidir.
- **Los paneles no se guardan**, se recalculan. Solo se congelan al exportar a producción (tabla `exports`), para que conste qué se cortó.

## Stack

| capa | elección | por qué |
| --- | --- | --- |
| repo | monorepo pnpm + Turborepo: `apps/web`, `packages/engine`, `packages/exporters`, `packages/viewer` | el motor se comparte entre web, servidor y una futura app nativa |
| web | Next.js (App Router) + TypeScript | estándar, buen SSR para las páginas públicas (presupuesto para el cliente) |
| móvil | **PWA del mismo Next.js** (instalable, táctil, sin conexión). Expo más tarde solo si hace falta estar en las tiendas | una sola base de código; el 3D en WebGL va bien en móviles actuales. Para Expo se reutilizarían `engine` y `viewer` (R3F native) |
| 3D | Three.js con React Three Fiber + drei | el ecosistema 3D web más maduro; selección por raycast, sirve para ratón y para dedo |
| 2D / planos | SVG generado desde el motor | cotas y planos imprimibles sin otra librería |
| estado del editor | Zustand + historial con Immer patches | deshacer / rehacer barato sobre el documento |
| validación | zod (formato del diseño y de los métodos) | el mismo esquema valida en el cliente, en el servidor y al migrar versiones |
| estilos | Tailwind, con los tokens de replica-design | rápido y coherente |
| base de datos | Postgres en Supabase | una sola BD; jsonb para el documento del mueble, tablas para bibliotecas |
| ORM | Drizzle (servidor) + supabase-js (cliente, con RLS) | tipos desde el esquema; SQL claro |
| auth | Supabase Auth (email + Google) | integrado con RLS |
| archivos | Supabase Storage | texturas, miniaturas, PDFs y ZIP de CNC |
| sin conexión | IndexedDB (Dexie) + service worker | trabajar en obra o en el taller sin cobertura y sincronizar después |
| PDF | @react-pdf/renderer en el servidor | lista de corte, planos, presupuesto |
| DXF | generador propio (ASCII DXF R12/R2000) | formato abierto y simple; sin dependencias raras |
| optimizador de corte | Web Worker con un algoritmo guillotina (o la librería abierta que se elija en la fase 3) | sustituye a OptiCut y no carga el servidor |
| email | Resend | enviar presupuestos y enlaces al cliente |
| trabajos en segundo plano | ninguno al principio; los exports pesados por una Route Handler con `maxDuration`. Inngest si llegan a hacer falta colas | no añadir piezas antes de tiempo |
| pagos | **ninguno en las fases 1-3**. Stripe Billing si se vende como suscripción | es para el taller propio primero |
| hosting | Vercel (web) + Supabase (datos) | cero mantenimiento, gratis o casi con pocos usuarios |
| pruebas | Vitest (motor, casos de referencia, snapshots de exports) + Playwright (flujos) | el motor necesita cientos de casos; la UI unos pocos flujos |

## El documento del mueble (`cabinets.design`)

Es la pieza más importante después del motor. Esbozo (zod en `packages/engine/src/schema.ts`):

```ts
type Length = number;          // entero, centésimas de mm
type Design = {
  v: 1;                         // versión del formato → migraciones
  shape: 'rect' | 'L' | 'corner' | 'free';
  size: { w: Length; h: Length; d: Length };
  params?: Record<string, Expr>;          // variables: "ancho_hueco = w - 2*esp"
  root: Zone;                              // el volumen interior
  exterior: { plinth?: Plinth; top?: Strip; fillers?: Filler[] };
  overrides: Record<PanelKey, PanelOverride>; // material, cantos, fibra o contorno de un panel concreto
};
type Zone = {
  id: string;
  split?: { axis: 'x' | 'y' | 'z';         // montantes | estantes | dobles fondos
            mode: 'equal' | 'ratio' | 'fixed';
            sizes?: (Length | number)[];
            panel: 'real' | 'nil';         // panel nulo = división sin tablero
            children: Zone[] };
  front?: Door | DrawerStack;              // lo que cierra la zona
};
```

`PanelKey` es estable (p. ej. `root.split[1].panel`, `zone:abc.door.left`) para que un override sobreviva a los recálculos. Esa estabilidad es lo que permite cambiar el ancho del mueble sin perder el material de una puerta.

## Esquema

Tablas: **14** (`orgs`, `org_members`, `materials`, `material_styles`, `hardware`, `hardware_rules`, `methods`, `clients`, `projects`, `catalogs`, `cabinets`, `postprocessors`, `exports`, `quotes`, más `auth.users` de Supabase). SQL completo en [`schema.sql`](schema.sql).

Acceso: **Row Level Security** por organización, con la función `is_member(org, roles)`. Roles: `owner`, `designer` (edita), `workshop` (lee y exporta), `viewer`. El servidor usa service role solo para el worker de exports y la página pública del presupuesto.

Decisiones:
- Longitudes en enteros de 1/100 mm: nunca habrá errores de 0,0001 en una lista de corte.
- `cabinets.rev` + `save_cabinet()` para el guardado optimista. Si dos dispositivos editan el mismo mueble, el segundo recibe un conflicto en lugar de pisar al primero.
- `cabinets` vive en un proyecto **o** en un catálogo (check `one_home`). Un modelo de catálogo es un mueble más, y `source_model_id` hace de "asociado al modelo".
- Borrar un método usado por muebles está prohibido (`on delete restrict`); materiales y herrajes se archivan en vez de borrarse, porque los diseños viejos los referencian.

## API

La lectura y escritura sencilla de bibliotecas, proyectos y muebles va directa desde el cliente con supabase-js, protegida por RLS. Lo que necesita lógica va en Route Handlers / Server Actions de Next.js.

| método ruta | hace | quién | entrada | salida | flujo |
| --- | --- | --- | --- | --- | --- |
| (supabase) `projects` CRUD | crear, listar, renombrar, archivar proyectos | designer+ | — | filas | F01, F05 |
| (supabase) `cabinets` select / insert | abrir y crear muebles | member / designer+ | — | filas | F01–F02 |
| `rpc save_cabinet` | guardar diseño con control de versión | designer+ | id, rev, design | rev nueva o 409 | F01–F02, F08 |
| (supabase) `materials`, `material_styles`, `hardware`, `hardware_rules`, `methods` CRUD | bibliotecas | designer+ | — | filas | F03, F04 |
| `POST /api/cabinets/:id/duplicate` | duplicar mueble o crear desde un modelo | designer+ | {target_project?, from_model?} | cabinet | F05 |
| `POST /api/projects/:id/compute` | calcular en el servidor todas las piezas del proyecto (el cliente ya lo hace; este es el de referencia) | member | — | {parts, totals, warnings} | F01, F06 |
| `POST /api/projects/:id/exports` | crear un export: cutlist / bom / labels / drawings / cnc / nesting | workshop+ | {kind, postprocessor_id?, options} | export (status) | F06 |
| `GET /api/exports/:id` | estado y URL firmada del archivo | member | — | export + url | F06 |
| `POST /api/projects/:id/quotes` | generar presupuesto desde los totales | designer+ | {tax_bp, valid_until, detail} | quote | F07 |
| `POST /api/quotes/:id/send` | enviar el enlace al cliente por email | designer+ | {to} | ok | F07 |
| `GET /q/:share_token` | página pública del presupuesto (sin login) | anónimo con token | — | HTML / PDF | F07 |
| `POST /api/import/dxf` | leer curvas de un DXF para forma libre / muro | designer+ | archivo | curvas | F08 |
| `POST /api/import/csv` | importar materiales o herrajes desde CSV | designer+ | archivo | n importados | F03, F04 |
| `POST /api/orgs/:id/invite` | invitar a alguien del taller | owner | {email, role} | ok | — |

Webhooks entrantes: ninguno hasta que haya Stripe (`/api/stripe/webhook`).
Webhooks salientes: ninguno.
Trabajos: `cleanup-exports`, a diario (Vercel Cron), borra los archivos de exports de más de 90 días que no estén en un proyecto `in_production`.

Solo APIs oficiales y con tus propias claves. Nada de PolyBoard en tiempo de ejecución.

## Lo que muerde

- **Exactitud del motor:** el riesgo número uno. Mitigación: carpeta `packages/engine/fixtures/` con muebles reales de PolyBoard (diseño descrito + lista de corte exportada en CSV) y una prueba por caso; tolerancia 0 en medidas de corte.
- **Coma flotante:** enteros en 1/100 mm en todo el motor; se pasa a mm solo para mostrar o exportar.
- **Rendimiento del recálculo:** cocina de 20 muebles = cientos de paneles. El motor tiene que tardar menos de 16 ms por mueble para que se vea en vivo al arrastrar. Se calcula en un Web Worker y se memoriza por mueble (solo se recalcula el que cambia).
- **Móvil:** pantallas pequeñas y dedos gordos. El editor se diseña con una hoja inferior de propiedades y selección por toque en el 3D, más un árbol de zonas como alternativa precisa. Se baja la calidad de render en móviles (sin sombras, `dpr` 1).
- **Sin conexión y sincronización:** cola local en IndexedDB y `rev` para detectar conflictos. Ante un conflicto se pregunta al usuario cuál quedarse; no se fusiona automáticamente.
- **Migraciones del documento:** `design.v` + funciones `migrate_v1_to_v2` en el motor. Nunca romper muebles guardados.
- **Formatos CNC:** cada máquina interpreta los formatos a su manera. Se empieza por DXF por capas (lo lee casi todo el CAM) y luego el formato nativo de la máquina del usuario, probado en ella con piezas de descarte.
- **Multi-taller:** RLS en todas las tablas desde el día uno; así vender después no obliga a rehacer nada.
- **Unidades:** 1/100 mm por dentro; mm, cm o pulgadas por fuera. Las pulgadas fraccionarias (1/16") se redondean al mostrar, nunca al guardar.
- **Archivos:** texturas de 2 MB como máximo, redimensionadas a 1024 px; los ZIP de CNC con URL firmada de 1 hora.
- **RGPD:** los datos de clientes viven en `clients`. Borrar una org lo borra todo en cascada; queda una ruta para exportar todos los datos.
- **Legal / clean-room:** ningún archivo, textura, biblioteca o texto copiado de PolyBoard. Las bibliotecas de herrajes se crean desde los catálogos públicos de los fabricantes.

## Orden de construcción

### 1. Rebanada vertical (2–3 semanas): un mueble → lista de corte
- Pantallas: S01 (lista de proyectos), S02 (solo rectangular), S03 + S04 (visor 3D y propiedades), S05 (estantes y montantes), S24 (lista de corte).
- Tablas: `orgs`, `org_members`, `materials`, `methods` (un método fijo), `projects`, `cabinets`.
- Rutas: auth, CRUD de supabase, `save_cabinet`, `POST /exports` (solo CSV).
- Motor: caja con laterales, techo, suelo y trasera; estantes / montantes equidistantes; cantos por defecto. **Cinco casos de referencia de PolyBoard en verde.**
- Funciona en el móvil desde el primer día (PWA).

### 2. Imprescindibles (6–8 semanas)
- Puertas (única, doble, encastrada / superpuesta) y cajones con su estructura: S06, S07.
- Zonas exteriores y zócalo: S08. Trasera en ranura: S09.
- Biblioteca de materiales y cantos con precios: S11, S12. Regla de canteado y panel prioritario en el método: S10 básico.
- Lista de corte agrupada, lista de materiales con coste: S24, S26. Unidades: S33. Deshacer / rehacer.
- Guardado en la nube, sin conexión y conflicto de `rev`.
- Tablas nuevas: `material_styles`. Rutas: `/compute`, exports `bom`.

### 3. Recomendables (6–8 semanas)
- Herrajes, reglas y relaciones: S14–S16 (`hardware`, `hardware_rules`, `methods.spec.joints`).
- DXF 2D por pieza con capas y el post-procesador de **tu** máquina: S28, S29 (`postprocessors`).
- Etiquetas con código de barras, planos PDF: S27, S32.
- Presupuesto PDF y enlace al cliente: `quotes`, `/q/:token`, Resend.
- Optimizador de corte en un Web Worker (`exports.kind = 'nesting'`).
- Puerta corredera, cajón múltiple, divisiones libres, dobles fondos, parámetros / variables.

### 4. Opcionales
- Forma libre + editor 2D + importar DXF (S18, S20, S31); mueble en L y en ángulo.
- Proyecto de estancia con muros y suelo, y colocar / girar muebles (S21).
- Catálogo de modelos (S22, `catalogs`).
- Render con texturas, exportar GLB.
- Más post-procesadores (MPR, CIX, PGMX…), cada uno validado en una máquina real.
- Importar `.pb-cab` (solo si aparecen archivos de ejemplo y el formato se deja leer).
- Stripe Billing, si se decide vender.

### 5. Mejoras de replica-entrepreneur
Pendiente. Ahí entra lo que los usuarios de PolyBoard echan en falta (precio, curva de aprendizaje, sin móvil, sin nube…).
