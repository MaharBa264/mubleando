# Guardado en la nube (Supabase)

Con la nube activada:

- Cada persona entra con su **cuenta** (correo y contraseña).
- Sus proyectos, muebles, tableros, cantos y métodos se guardan en una base de datos y se ven igual en el **ordenador y en el móvil**.
- Nadie ve los datos de otra cuenta. Lo garantiza la propia base de datos, no la app.

Sin configurar la nube, la app sigue funcionando como siempre: todo se guarda en el navegador. Las dos formas usan la misma interfaz de datos (`DataLayer`), así que las pantallas son las mismas.

## Qué es Supabase y cuánto cuesta

[Supabase](https://supabase.com) es un servicio que da una base de datos Postgres, cuentas de usuario y envío de correos de confirmación, todo gestionado. El plan gratuito sobra para un taller: 500 MB de base de datos (decenas de miles de muebles) y 50 000 usuarios al mes.

Un detalle del plan gratuito: si el proyecto pasa una semana sin uso, Supabase lo pone en pausa. No se pierde nada, se reactiva desde su panel con un botón.

## Configurarlo, paso a paso

Lo tiene que hacer el dueño de la cuenta de Supabase. La app no crea cuentas ni claves por ti.

### 1. Crear el proyecto

1. Entra en <https://supabase.com> y crea una cuenta (puedes usar tu cuenta de GitHub).
2. **New project**. Elige un nombre (por ejemplo `mubleando`), una contraseña para la base de datos (guárdala en tu gestor de contraseñas; la app no la necesita) y la región más cercana (por ejemplo, *West EU*).
3. Espera un par de minutos a que termine de crearse.

### 2. Crear las tablas

1. En el panel del proyecto, abre **SQL Editor** → **New query**.
2. Copia y pega el contenido entero de [`supabase/migrations/20261116000000_inicial.sql`](../supabase/migrations/20261116000000_inicial.sql).
3. Pulsa **Run**. Debe terminar sin errores ("Success. No rows returned").
4. Comprueba en **Table Editor** que aparecen cuatro tablas: `projects`, `cabinets`, `materials` y `methods`, todas con el candado de *RLS enabled*.

(Si en el futuro usas la herramienta de línea de comandos de Supabase, `supabase db push` aplica las migraciones de la carpeta `supabase/migrations` en orden. No hace falta para empezar.)

### 3. Configurar las cuentas

En **Authentication**:

1. **Sign In / Providers → Email**: déjalo activado, con **Confirm email** activado (así nadie crea cuentas con correos ajenos).
2. **URL Configuration**:
   - **Site URL**: la dirección donde usarás la app. Mientras pruebas en tu ordenador, `http://localhost:3100`. Cuando la publiques, tu dominio (por ejemplo `https://mubleando.com`).
   - **Redirect URLs**: añade las dos páginas a las que vuelven los enlaces de los correos, para cada dirección que uses:
     - `http://localhost:3100/entrar`
     - `http://localhost:3100/restablecer`
     - y lo mismo con tu dominio cuando lo tengas.
3. Opcional, **Emails**: puedes cambiar el texto de los correos de confirmación y de nueva contraseña.

**Límite de correos.** Supabase envía los correos con su propio servidor, que en el plan gratuito permite solo unos pocos por hora. Para pruebas basta. Antes de que lo use más gente, configura un servidor de correo propio en **Authentication → Emails → SMTP Settings** (por ejemplo Resend, con tu dominio). Está en la [hoja de ruta](hoja-de-ruta.md).

### 4. Conectar la app

1. En Supabase, **Project Settings → API** (o **API Keys**). Copia:
   - **Project URL**.
   - La clave pública: **anon** (o **publishable**).
   - La clave secreta: **service_role** (o **secret**). Solo hace falta para poder borrar cuentas desde la app.
2. En la carpeta `apps/web`, copia `.env.example` como `.env.local` y rellénalo:

```
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=la-clave-anon
SUPABASE_SERVICE_ROLE_KEY=la-clave-service-role
```

3. Reinicia la app (`npm run dev`). Ahora pide entrar.

`.env.local` está en `.gitignore`: **no se sube a GitHub**. La clave anon es pública a propósito (va dentro de la app en el navegador; sin sesión no da acceso a nada). La clave service_role **nunca** debe llevar `NEXT_PUBLIC_` delante ni compartirse: quien la tenga puede leer y borrar toda la base de datos.

### 5. Primer uso

1. Abre la app → **Crear cuenta** con tu correo y una contraseña de al menos 8 caracteres.
2. Abre el correo de confirmación y pulsa el enlace. Vuelves a la app; entra.
3. La cuenta nueva recibe los tableros, cantos y métodos de partida.
4. Si en ese navegador tenías proyectos de antes, en **Cuenta → Datos de este navegador → Subir a mi cuenta** se copian a la nube. No se borra nada del navegador, y si lo repites no se duplica.
5. En el móvil, abre la misma dirección y entra con la misma cuenta.

## Cómo funciona por dentro

### Tablas

| Tabla | Qué guarda | Clave |
| --- | --- | --- |
| `projects` | Proyectos: nombre y fechas. | `id` (uuid) |
| `cabinets` | Muebles: proyecto, nombre, método, diseño completo en JSON (`design`), versión (`rev`), unidades. | `id` (uuid) |
| `materials` | Tableros y cantos: tipo, espesor, veta, precio en céntimos, color. | (`user_id`, `id`) |
| `methods` | Métodos de fabricación: nombre y el resto del método en JSON (`spec`). | (`user_id`, `id`) |

Todas llevan `user_id`, que la base de datos rellena sola con el usuario de la sesión (`auth.uid()`). Los tableros y métodos tienen identificadores de texto únicos **por usuario**, para que cada cuenta tenga sus propios `mel-blanco-19` o `std-ranura` de partida.

Las piezas no se guardan: las calcula el motor en el navegador a partir del diseño, como siempre.

### Quién puede ver qué

- **Reglas de acceso por fila** (Row Level Security) en las cuatro tablas: cada usuario solo lee, crea, cambia y borra filas con su `user_id`. Para la base de datos, las filas de otros no existen.
- Los visitantes sin sesión (`anon`) no tienen ningún permiso.
- Las claves foráneas incluyen el `user_id`: un mueble solo puede apuntar a un proyecto y a un método de su mismo dueño, aunque alguien manipule la petición.

### Reglas que pone la base de datos

| Regla | Cómo |
| --- | --- |
| Dos dispositivos no se pisan al guardar un mueble | La función `save_cabinet(id, rev, cambios)` solo guarda si la versión coincide, y la sube en uno. Si no coincide, devuelve el error `MW409` y la app avisa del conflicto. |
| No se puede borrar un método que usa algún mueble | Clave foránea con `on delete restrict`. |
| Borrar un proyecto borra sus muebles | `on delete cascade`. |
| Borrar la cuenta borra todos sus datos | Todas las tablas tienen `on delete cascade` hacia `auth.users`. |
| Nombres de 1 a 120 caracteres, unidades de 1 a 99, espesores y precios no negativos | Restricciones `check`. |
| Diseños con forma válida y de menos de 256 KB | `check` sobre el JSON (además de la validación con zod en la app). |
| La lista de proyectos se ordena por el último cambio | Un disparador actualiza el proyecto cuando cambia uno de sus muebles. |

### En la app

| Archivo | Qué hace |
| --- | --- |
| `apps/web/src/lib/supabase.ts` | Crea la conexión si existen las variables; `cloudEnabled` dice si la nube está activa. La sesión se guarda en el navegador y se renueva sola. Los enlaces de los correos usan PKCE (un código de un solo uso). |
| `apps/web/src/data/cloud.ts` | La capa de datos en la nube. Traduce filas ↔ tipos del motor, valida con zod, traduce los errores al español y copia las bibliotecas de partida a las cuentas nuevas. También `importLocalData` (subir los datos del navegador). |
| `apps/web/src/data/index.ts` | Elige la capa: nube si hay variables, navegador si no. |
| `apps/web/src/components/auth/AuthProvider.tsx` | Sesión actual y `AuthGate`: en modo nube, quien no ha entrado va a `/entrar` (recordando a qué página iba). |
| `apps/web/src/app/entrar` | Entrar, crear cuenta y "He olvidado la contraseña". |
| `apps/web/src/app/restablecer` | Elegir una contraseña nueva desde el enlace del correo. |
| `apps/web/src/app/cuenta` | Cerrar sesión (en este dispositivo o en todos), subir los datos del navegador y borrar la cuenta. |
| `apps/web/src/app/api/cuenta/borrar/route.ts` | Borra la cuenta de quien la pide. Corre en el servidor porque necesita la clave service_role. Solo acepta el token de la propia sesión, que comprueba Supabase. |

## Pruebas

```bash
npm test -w @mw/db
```

Aplica la migración a un Postgres real que corre en memoria ([PGlite](https://pglite.dev)), imitando lo mínimo de Supabase (`auth.users`, `auth.uid()` y los roles `anon` y `authenticated`), y comprueba con dos usuarias de prueba, Ana y Bea:

- Bea no ve, no cambia y no borra nada de Ana.
- Bea no puede crear filas a nombre de Ana ni colgar un mueble de un proyecto de Ana.
- Un visitante sin sesión no puede leer ni escribir.
- `save_cabinet` guarda con la versión correcta, da conflicto con una antigua y no revela si existe un mueble ajeno.
- No se borra un método en uso; borrar un proyecto borra sus muebles; borrar la cuenta borra todo lo suyo y nada de los demás.
- Se rechaza un diseño sin árbol de huecos.

Lo que estas pruebas **no** cubren: la conexión real con un proyecto de Supabase (las peticiones de `cloud.ts`, los correos y el borrado de cuentas). Eso se comprueba a mano la primera vez que se conecte un proyecto, con la lista de [`replica/backend.md`](../replica/backend.md).

## Limitaciones actuales

- **Sin conexión, en modo nube, no se puede trabajar**: cada cambio se guarda en el servidor. Trabajar sin cobertura y sincronizar después está en la hoja de ruta.
- **Sin talleres compartidos**: cada cuenta es independiente. Varias personas en el mismo taller, con los mismos proyectos, llegará con otra migración (organizaciones y roles).
- **Sin inicio de sesión con Google**: solo correo y contraseña.
- **Sesión en el almacenamiento del navegador**, no en una cookie *http-only*. Es lo normal en aplicaciones que hablan directamente con Supabase desde el navegador; protegerla con cookies exigiría pasar todas las peticiones por el servidor.
