# Backend

Actualizado el 16 de noviembre de 2026. Guía de configuración: [`docs/nube.md`](../docs/nube.md).

## Qué hay

| Pieza | Estado | Dónde |
| --- | --- | --- |
| Base de datos (Postgres en Supabase) | hecha, probada con PGlite; sin probar en un proyecto real | `supabase/migrations/20261116000000_inicial.sql` |
| Reglas de acceso por fila | hechas y probadas con dos usuarios | misma migración; `supabase/test/rls.test.ts` |
| Cuentas: correo y contraseña con confirmación | hecho; sin probar con Supabase real | `apps/web/src/app/entrar` |
| Recuperar la contraseña | hecho; sin probar con Supabase real | `apps/web/src/app/entrar`, `apps/web/src/app/restablecer` |
| Cerrar sesión en todos los dispositivos | hecho | `apps/web/src/app/cuenta` |
| Borrar la cuenta y todos sus datos | hecho; sin probar con Supabase real | `apps/web/src/app/api/cuenta/borrar/route.ts` |
| Subir los datos del navegador a la cuenta | hecho; sin probar con Supabase real | `apps/web/src/data/cloud.ts` (`importLocalData`) |
| Pagos | no aplica (uso propio) | — |
| Correo propio (SMTP) | pendiente: hoy usa el servidor de correo de Supabase, con pocos envíos por hora | Supabase → Authentication → SMTP |
| Trabajos programados | no hacen falta todavía | — |
| Integraciones externas | ninguna | — |

## Desviaciones de `architecture.md`

- **Sin organizaciones**: cada cuenta es dueña de sus datos (`user_id`). El esquema por organizaciones (`replica/schema.sql`) queda para cuando haya varios usuarios por taller.
- **Sin Drizzle**: no hay código de servidor que consulte la base de datos salvo el borrado de cuentas; todo va desde el navegador con supabase-js y reglas de acceso.
- **Métodos como JSON** (`methods.spec`), validados con el esquema zod del motor, en lugar de columnas: el método cambia de forma con cada fase.
- **Sesión en el almacenamiento del navegador** (lo estándar en supabase-js), no en cookie http-only.

## Lista de seguridad

- [x] Secretos solo en variables de entorno. `.env*.local` y `.env` en `.gitignore`; `.env.example` sin valores. La clave service_role solo se lee en el servidor (sin `NEXT_PUBLIC_`).
- [x] Datos validados antes de escribir: zod en la app (diseño, material, método) y `check` en la base de datos (longitudes, rangos, forma del JSON, tamaño del diseño).
- [x] Autorización en cada lectura y escritura: reglas de acceso por fila en las cuatro tablas, y claves foráneas que incluyen el dueño. Probado con un segundo usuario (`npm test -w @mw/db`).
- [x] La ruta de borrar cuenta solo actúa sobre el dueño del token, comprobado por Supabase.
- [x] Redirecciones tras entrar solo a rutas internas (`/entrar?volver=`): no se puede usar para mandar a otra web.
- [x] "He olvidado la contraseña" responde lo mismo exista o no la cuenta.
- [ ] Límites de intentos: los pone Supabase Auth (por IP y por correo). **Revisar** sus valores en Authentication → Rate Limits al crear el proyecto.
- [x] Sin datos personales en URLs ni en registros de la app.
- [x] Dependencias auditadas: `npm audit --omit=dev` sin vulnerabilidades (16-11-2026).
- [ ] Copias de seguridad: el plan gratuito de Supabase no guarda copias diarias descargables. **Antes de usarla para trabajo real**, o pasar al plan Pro, o programar una exportación (`pg_dump`) periódica.
- [ ] Política de privacidad que nombre a los encargados del tratamiento (Supabase; el alojamiento, cuando se publique). Pendiente de `/replica-deploy`.
- [x] Subidas de archivos: no hay.

## Comprobación con un proyecto real (pendiente)

Cuando exista el proyecto de Supabase y `.env.local`:

1. Crear cuenta → llega el correo → el enlace vuelve a `/entrar` → entrar.
2. La cuenta nueva tiene los 8 materiales y 2 métodos de partida.
3. Crear proyecto y mueble, editar, recargar: se conserva. Abrir en otro navegador con la misma cuenta: aparece igual.
4. Editar el mismo mueble en dos pestañas: la segunda en guardar muestra el aviso de conflicto.
5. Segunda cuenta: no ve nada de la primera.
6. "He olvidado la contraseña" → correo → `/restablecer` → nueva contraseña → entrar con ella.
7. Subir los datos del navegador: aparecen los proyectos; repetir no duplica.
8. Borrar un método usado por un mueble: mensaje "Lo usa 1 mueble".
9. Borrar la cuenta: vuelve a `/entrar` y en Supabase ya no está el usuario ni sus filas.
