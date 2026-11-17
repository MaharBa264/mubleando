# Instalación y desarrollo

## Requisitos

- **Node.js 22 o superior** y **npm** (viene con Node). Probado con Node 24.14 y npm 11.9.
- **Git**, para descargar el repositorio y guardar cambios.
- Un navegador actual: Chrome, Edge, Firefox o Safari. El visor 3D usa WebGL, que tienen todos desde hace años.

No hace falta base de datos ni ninguna cuenta: sin configurar nada, los datos se guardan en el propio navegador. Para usar cuentas y la nube, ver [Guardado en la nube](nube.md).

## Descargar y arrancar

```bash
git clone https://github.com/MaharBa264/mubleando.git
```

```bash
cd mubleando
```

```bash
npm install
```

```bash
npm run dev
```

Abre <http://localhost:3100>. El servidor de desarrollo recarga la página sola cada vez que guardas un archivo.

### Comandos

Todos se lanzan desde la carpeta raíz del repositorio.

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Arranca la aplicación en modo desarrollo en el puerto 3100. |
| `npm test` | Pasa las pruebas del motor (`packages/engine`), de las exportaciones (`packages/exporters`) y de la base de datos (`supabase`) con Vitest. |
| `npm run test:nube -w @mw/web` | Prueba de punta a punta contra tu proyecto de Supabase (crea y borra dos cuentas de prueba). Ver [Guardado en la nube](nube.md). |
| `npm run typecheck` | Comprueba los tipos de TypeScript de los tres paquetes. No genera archivos. |
| `npm run build` | Compila la aplicación para producción (carpeta `apps/web/.next`). |
| `npm start -w @mw/web` | Sirve la versión compilada en el puerto 3100. Necesita `npm run build` antes. |
| `node scripts/make-icons.mjs` | Vuelve a generar los iconos PNG de la aplicación. |

Para pasar solo las pruebas de un paquete, o una sola prueba:

```bash
npm test -w @mw/engine
```

```bash
npx vitest run --root packages/exporters -t "STL"
```

## Abrirla en el móvil

En la misma red wifi que el ordenador:

1. Arranca `npm run dev`. En la consola aparece una línea `Network: http://192.168.x.x:3100`.
2. Abre esa dirección en el navegador del móvil.

Así se puede probar el editor táctil. Para **instalarla** como aplicación (icono en la pantalla de inicio, sin barra del navegador) y para el **modo sin conexión**, el navegador exige HTTPS, salvo en `localhost`. Eso llegará con la publicación en un dominio propio (ver la [hoja de ruta](hoja-de-ruta.md)).

## Organización del repositorio

Es un *monorepo* con *workspaces* de npm: tres paquetes que se instalan juntos y se importan entre sí por su nombre.

| Carpeta | Paquete | Qué contiene |
| --- | --- | --- |
| `packages/engine` | `@mw/engine` | El motor: tipos del diseño, cálculo de piezas, funciones de edición, lista de corte, materiales y métodos de partida. No depende de React ni del navegador. |
| `packages/exporters` | `@mw/exporters` | CSV de lista de corte, STL para impresión 3D y un escritor de ZIP. Solo depende del motor. |
| `supabase` | `@mw/db` | Migraciones SQL de la base de datos en la nube y sus pruebas (con PGlite, un Postgres en memoria). |
| `apps/web` | `@mw/web` | La aplicación Next.js. Importa los otros dos paquetes directamente desde su código TypeScript (`transpilePackages` en `next.config.ts`), sin compilarlos aparte. |

Archivos de configuración de la raíz:

- `package.json`: lista de workspaces y comandos.
- `tsconfig.base.json`: opciones de TypeScript comunes (modo estricto y `noUncheckedIndexedAccess`, que obliga a comprobar que un elemento de un array existe antes de usarlo).
- `.gitattributes`: fuerza finales de línea LF en el repositorio, aunque se trabaje en Windows.
- `.claude/launch.json`: configuración para que el asistente pueda arrancar el servidor de desarrollo.

## Tecnologías

| Para qué | Qué se usa |
| --- | --- |
| Lenguaje | TypeScript en modo estricto |
| Aplicación | Next.js 16 (App Router) y React 19 |
| Estilos | Tailwind CSS 4, con los colores y medidas como variables CSS en `apps/web/src/app/globals.css` |
| 3D | Three.js con React Three Fiber y drei |
| Estado del editor | Zustand, con historial propio para deshacer y rehacer |
| Validación de datos | zod 4 |
| Pruebas | Vitest 3 |

## Variables de entorno

Van en `apps/web/.env.local` (no se sube a GitHub). La plantilla es `apps/web/.env.example`.

| Variable | Para qué |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Dirección del proyecto de Supabase. Con esta y la siguiente, la app usa la nube y pide entrar. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública del proyecto. |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave secreta, solo en el servidor, para borrar cuentas. |

Al cambiar `.env.local`, el servidor de desarrollo lo recarga solo; si no, reinícialo.

## Problemas frecuentes

**El puerto 3100 está ocupado.** Otro proceso lo usa (puede ser un `npm run dev` anterior que sigue abierto). Ciérralo, o arranca en otro puerto con `npx next dev --port 3200` dentro de `apps/web`.

**`npm install` avisa de que no encuentra un workspace.** Asegúrate de lanzarlo desde la carpeta raíz del repositorio, no desde `apps/web`.

**La página sale en blanco o con datos raros después de cambiar el formato de los datos.** Los datos viven en el `localStorage` del navegador, con la clave `mueblesweb:v1`. Para empezar de cero: herramientas de desarrollo del navegador (F12) → Aplicación → Almacenamiento local → borrar esa clave, y recargar. Vuelve a aparecer el proyecto de ejemplo.

**El modo sin conexión no funciona en desarrollo.** Es a propósito: el *service worker* solo se registra en la versión compilada (`npm run build` y `npm start -w @mw/web`), para que no guarde en caché versiones viejas mientras se programa.

**Error de tipos con `Uint8Array` y `Blob`.** Las funciones de exportación devuelven `Uint8Array<ArrayBuffer>`. Si escribes una nueva, declara ese tipo de retorno para que el navegador lo acepte como contenido de un `Blob`.
