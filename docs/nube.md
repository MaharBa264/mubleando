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
2. Copia y pega el contenido entero del primer archivo de [`supabase/migrations`](../supabase/migrations) y pulsa **Run**. Debe terminar sin errores ("Success. No rows returned").
3. Repite con cada archivo siguiente, **en orden** (el nombre empieza por la fecha):
   - `20261116000000_inicial.sql`: las tablas, las reglas de acceso y la función de guardado.
   - `20261116000001_borrar_cuenta_con_muebles.sql`: ajuste de la clave foránea de los métodos.
   - `20261117000000_disparador_con_permisos_del_dueno.sql`: arreglo para poder borrar cuentas que tengan muebles.
   - `20261117000001_precios_en_pesos.sql`: deja sin precio los materiales de partida que seguían con su precio en euros.
   - `20261118000001_herrajes.sql`: tabla de herrajes; los métodos argentinos de partida pasan a usar herrajes por defecto. Mientras no esté, la app funciona sin herrajes.
   - `20261118000000_ambientes.sql`: tabla de ambientes (planta y muebles colocados). Mientras no esté, los proyectos se ven sin ambientes y crear uno avisa de que falta.
   - `20261121000001_medida_de_placa.sql`: medida de la placa de cada tablero, para el plano de cortes. Mientras no esté, el plano usa las placas de partida.
   - `20261121000000_registro_con_lista.sql`: el registro pasa a ser **solo para los mails de una lista** que edita el administrador. La cuenta más antigua del proyecto pasa a ser la administradora. Ver [Quién puede registrarse](#quién-puede-registrarse).

Cada archivo se aplica **una sola vez**. Cuando salga una migración nueva, pega solo esa.
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
2. En la carpeta `apps/web`, copia `.env.example` como `.env.local` y rellena las dos variables públicas. La dirección es solo `https://tu-proyecto.supabase.co`, sin `/rest/v1/` al final:

```
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=la-clave-anon-o-publishable
```

   Y en la misma carpeta crea `.dev.vars` con la clave secreta:

```
SUPABASE_SERVICE_ROLE_KEY=la-clave-service-role-o-secret
```

   La secreta no puede ir en `.env.local`: el adaptador de Cloudflare empaqueta en la app todo lo que hay en los archivos `.env` (ver [publicar.md](publicar.md)).

3. Reinicia la app (`npm run dev`). Ahora pide entrar.

`.env.local` y `.dev.vars` están en `.gitignore`: **no se suben a GitHub**. La clave anon es pública a propósito (va dentro de la app en el navegador; sin sesión no da acceso a nada). La clave service_role **nunca** debe llevar `NEXT_PUBLIC_` delante ni compartirse: quien la tenga puede leer y borrar toda la base de datos.

### 5. Primer uso

1. Abre la app → **Crear cuenta** con tu correo y una contraseña de al menos 8 caracteres. En un proyecto nuevo, la primera cuenta que se crea es la **administradora**; desde ahí, solo pueden registrarse los mails que ella agregue (ver [Quién puede registrarse](#quién-puede-registrarse)).
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
| `materials` | Tableros y cantos: tipo, espesor, veta, precio en centavos, color. | (`user_id`, `id`) |
| `methods` | Métodos de fabricación: nombre y el resto del método en JSON (`spec`). | (`user_id`, `id`) |

Todas llevan `user_id`, que la base de datos rellena sola con el usuario de la sesión (`auth.uid()`). Los tableros y métodos tienen identificadores de texto únicos **por usuario**, para que cada cuenta tenga sus propios `mel-blanco-19` o `std-ranura` de partida.

Las piezas no se guardan: las calcula el motor en el navegador a partir del diseño, como siempre.

### Quién puede ver qué

- **Reglas de acceso por fila** (Row Level Security) en las cuatro tablas: cada usuario solo lee, crea, cambia y borra filas con su `user_id`. Para la base de datos, las filas de otros no existen.
- Los visitantes sin sesión (`anon`) no tienen ningún permiso.
- Las claves foráneas incluyen el `user_id`: un mueble solo puede apuntar a un proyecto y a un método de su mismo dueño, aunque alguien manipule la petición.

### Quién puede registrarse

Solo los mails de una lista, que edita el administrador en la app (**Administración**, en la barra de arriba; solo se ve con una cuenta administradora).

| Pieza | Qué hace |
| --- | --- |
| `app_admins` | Cuentas administradoras. Cada cuenta solo puede ver si ella misma lo es. |
| `signup_allowlist` | Mails autorizados (en minúsculas), con una nota. Solo los administradores la leen y la cambian. |
| Disparador `signup_allowlist_check` sobre `auth.users` | Rechaza el alta de un mail que no está en la lista. Está en la base de datos: no se saltea llamando a Supabase desde fuera de la app, ni con el panel de Supabase («Add user» también falla). |
| `admin_allowlist()` y `admin_accounts()` | Lo que muestra la pantalla de administración: la lista, con quién ya creó su cuenta, y todas las cuentas. Fallan si quien las llama no es administrador. |

- **Arranque.** Mientras no haya ningún administrador, el registro queda abierto y la primera cuenta que se crea pasa a serlo. Al aplicar la migración en un proyecto con cuentas, la **más antigua** pasa a ser la administradora.
- **Las cuentas que ya existían** no se tocan: siguen entrando aunque su mail no esté en la lista. La pantalla de administración las marca («no está en la lista») para que las revises. Para borrar una cuenta: Supabase → **Authentication → Users**.
- **Quitar un mail de la lista** no borra su cuenta si ya la tenía; solo impide crearla.
- **Si se borra la cuenta administradora** y no queda otra, el registro vuelve a quedar abierto hasta que alguien se registre (y pase a ser administrador). Para agregar otro administrador, en el SQL Editor: `insert into public.app_admins (user_id) select id from auth.users where email = 'su-mail';`
- Al intentar registrarse con un mail que no está, Supabase devuelve un error genérico («Database error saving new user») y la app muestra: «Este mail no tiene permiso para registrarse. Pedíselo al responsable de la app.»

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

Además, `borrar-cuenta.test.ts` borra una cuenta con muebles forzando los 24 órdenes posibles en que Postgres puede encadenar los borrados.

Un caso que PGlite **no reproduce**: en Supabase, al borrar una cuenta, los disparadores se ejecutan con los permisos del rol interno que borra el usuario (`supabase_auth_admin`), que no tiene acceso a nuestras tablas. Por eso cualquier disparador que toque otra tabla debe ser `security definer` (ver la migración del 17-11-2026). Ese caso se comprobó directamente contra Supabase.

### Prueba contra tu proyecto real

```bash
npm run test:nube -w @mw/web
```

No forma parte de `npm test`, porque necesita tu proyecto de Supabase y `apps/web/.env.local` con las tres variables. Hace esto:

1. Crea dos cuentas de prueba ya confirmadas, con la clave secreta. No envía ningún correo; las direcciones son `@example.com`, que no existen.
2. Usa la capa de datos real de la app (`src/data/cloud.ts`) para comprobar:
   - que una cuenta nueva recibe las bibliotecas de partida;
   - que un proyecto y un mueble con zócalo y cajones se guardan y vuelven idénticos;
   - el control de versión y el conflicto;
   - el borrado protegido de métodos y tableros en uso;
   - que la segunda cuenta no ve, no cambia y no borra nada de la primera;
   - la subida de datos del navegador sin duplicar;
   - la ruta de borrar cuenta, que rechaza una sesión falsa y borra la cuenta con todos sus datos sin tocar la otra.
3. Al terminar, pase lo que pase, borra las dos cuentas.

No imprime claves ni contraseñas. Conviene lanzarla después de aplicar cada migración nueva.

Lo que **no** cubre: los correos de confirmación y de nueva contraseña, que se comprueban creando tu cuenta desde la app.

## Limitaciones actuales

- **Sin conexión, en modo nube, no se puede trabajar**: cada cambio se guarda en el servidor. Trabajar sin cobertura y sincronizar después está en la hoja de ruta.
- **Sin talleres compartidos**: cada cuenta es independiente. Varias personas en el mismo taller, con los mismos proyectos, llegará con otra migración (organizaciones y roles).
- **Sin inicio de sesión con Google**: solo correo y contraseña.
- **Sesión en el almacenamiento del navegador**, no en una cookie *http-only*. Es lo normal en aplicaciones que hablan directamente con Supabase desde el navegador; protegerla con cookies exigiría pasar todas las peticiones por el servidor.
