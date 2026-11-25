# Publicar la app en Cloudflare

Publicada, la app tiene una dirección en internet con HTTPS, por ejemplo `https://mubleando.<tu-subdominio>.workers.dev`. Se abre desde cualquier ordenador o móvil y en el móvil se puede instalar como aplicación.

| Pieza | Dónde vive | Costo |
| --- | --- | --- |
| La app (páginas, motor, visor 3D) | **Cloudflare Workers** | Plan gratuito: 100 000 peticiones al día, de sobra para un taller. Admite uso comercial. |
| Los datos y las cuentas | **Supabase** (ver [nube.md](nube.md)) | Plan gratuito. |
| El código | **GitHub** | Gratis. |

## Cómo funciona

Next.js no corre tal cual en Cloudflare. El adaptador oficial de código abierto [OpenNext](https://opennext.js.org/cloudflare) (`@opennextjs/cloudflare`) convierte la app en un **Worker**, un programa que Cloudflare ejecuta en sus servidores de todo el mundo, más los archivos estáticos (JavaScript, iconos, estilos).

| Archivo | Para qué |
| --- | --- |
| `apps/web/wrangler.jsonc` | El Worker: nombre (`mubleando`), compatibilidad con Node.js y carpeta de archivos estáticos. |
| `apps/web/open-next.config.ts` | Opciones del adaptador (por ahora, las de por defecto). |
| `apps/web/next.config.ts` | `outputFileTracingRoot` apunta a la raíz del repositorio, para que el adaptador encuentre el motor y las exportaciones. |

Comandos, desde `apps/web` o con `-w @mw/web` desde la raíz:

| Comando | Qué hace |
| --- | --- |
| `npm run cf:build` | Compila la app y la convierte en Worker (carpeta `.open-next`, que no se sube a Git). |
| `npm run cf:preview` | Compila y la sirve en `http://localhost:8787` con el mismo motor que usa Cloudflare (`workerd`). Es la mejor prueba antes de publicar. |
| `npm run cf:deploy` | Compila y publica en tu cuenta de Cloudflare. |

## Variables y secretos

| Variable | Tipo | En tu ordenador | En Cloudflare |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | pública | `apps/web/.env.local` | Se mete en la app al compilar: basta con tenerla en `.env.local` al publicar desde tu ordenador. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | pública | `apps/web/.env.local` | Igual. |
| `SUPABASE_SERVICE_ROLE_KEY` | **secreta** | `apps/web/.dev.vars` | **Secreto del Worker** (ver abajo). |

**La clave secreta no puede estar en ningún archivo `.env`.** El adaptador copia dentro del Worker todo lo que encuentra en los `.env` (incluso los de desarrollo). Por eso va en `.dev.vars`, el archivo de secretos locales de Cloudflare, que no se empaqueta. Consecuencia: con `npm run dev` (sin Cloudflare), el botón «Borrar mi cuenta» responde que falta la clave; con `npm run cf:preview` y en la app publicada, funciona.

Para comprobar que no se ha colado en el paquete, compila (`npm run cf:build`) y busca el valor de la clave dentro de `apps/web/.open-next`: no debe aparecer.

`.env.local` y `.dev.vars` están en `.gitignore`.

## Publicar desde tu ordenador (la primera vez)

1. **Entrar en Cloudflare desde la terminal** (una sola vez por ordenador):

   ```bash
   npx wrangler login
   ```

   Se abre el navegador con tu cuenta de Cloudflare y pide permiso para que *Wrangler* (la herramienta oficial de Cloudflare) gestione tus Workers. Acepta. Para comprobar con qué cuenta has entrado:

   ```bash
   npx wrangler whoami
   ```

2. **Guardar la clave secreta en el Worker.** Pide pegar el valor; no queda en el historial de la terminal:

   ```bash
   npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
   ```

   Si el Worker todavía no existe, Wrangler ofrece crearlo: di que sí.

3. **Publicar:**

   ```bash
   npm run cf:deploy -w @mw/web
   ```

   Al terminar muestra la dirección, del tipo `https://mubleando.<tu-subdominio>.workers.dev`.

4. **Decirle a Supabase la nueva dirección.** En Supabase → **Authentication → URL Configuration**:
   - **Site URL**: la dirección de la app publicada.
   - **Redirect URLs**: añade `https://…workers.dev/entrar` y `https://…workers.dev/restablecer`. Deja también las de `localhost` para seguir probando en tu ordenador.

   Sin esto, los enlaces de los correos de confirmación y de nueva contraseña llevarían a `localhost`.

## Publicar cambios

Cada vez que haya cambios que quieras en la app publicada:

```bash
npm run cf:deploy -w @mw/web
```

Si hay una migración nueva de la base de datos, aplícala en Supabase **antes** de publicar (ver [nube.md](nube.md)).

Más adelante se puede conectar el repositorio de GitHub a Cloudflare (**Workers Builds**) para que publique solo con cada cambio en `main`. Habría que configurar en Cloudflare las dos variables públicas como variables de compilación y la secreta como secreto.

## Dominio propio (opcional)

Si tienes un dominio gestionado en Cloudflare: **Workers & Pages → mubleando → Settings → Domains & Routes → Add → Custom domain**, y escribe por ejemplo `app.tudominio.com`. Cloudflare crea el registro DNS y el certificado. Después, añade esa dirección en Supabase (paso 4).

## Problemas frecuentes

**`Authentication error` al publicar.** La sesión de Wrangler ha caducado: `npx wrangler login` otra vez.

**La app publicada pide entrar pero dice «No hay conexión con el servidor».** Faltaban las variables públicas al compilar. Comprueba `apps/web/.env.local` y vuelve a publicar.

**«Borrar mi cuenta» dice que falta la clave de servicio.** Falta el secreto del Worker: paso 2.

**Los enlaces de los correos llevan a `localhost`.** Falta el paso 4.

**Avisos de `npm audit` en `glob` y `minimatch`.** Vienen de las herramientas de compilación del adaptador (minimizar y buscar archivos del propio proyecto). No se ejecutan en la app publicada ni procesan datos de usuarios. Se revisarán al actualizar el adaptador.
## Publicación automática (Cloudflare Workers Builds)
Cada cambio en la rama `main` dispara automáticamente la compilación y el despliegue mediante **Cloudflare Workers Builds**.
Las variables de build `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` deben estar configuradas en Cloudflare.
