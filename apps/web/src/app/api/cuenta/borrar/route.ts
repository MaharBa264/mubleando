import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/cuenta/borrar · Borra la cuenta de quien hace la petición y, en cascada, todos sus datos.
 *
 * Borrar un usuario de Supabase Auth exige la clave de servicio (service_role), que nunca puede
 * llegar al navegador. Por eso va en el servidor, leída de SUPABASE_SERVICE_ROLE_KEY (sin NEXT_PUBLIC_).
 *
 * Seguridad: solo se borra la cuenta dueña del token de la cabecera Authorization, y el token lo
 * comprueba Supabase (getUser). No se acepta ningún identificador desde fuera.
 */
export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return Response.json({ error: 'El servidor no tiene configurada la clave de servicio de Supabase; no puede borrar cuentas.' }, { status: 501 });
  }

  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return Response.json({ error: 'Falta la sesión.' }, { status: 401 });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return Response.json({ error: 'La sesión no es válida. Vuelve a entrar.' }, { status: 401 });

  // Las tablas tienen `on delete cascade` hacia auth.users: se borran proyectos, muebles y bibliotecas.
  const del = await admin.auth.admin.deleteUser(data.user.id);
  if (del.error) return Response.json({ error: 'No se ha podido borrar la cuenta. Inténtalo más tarde.' }, { status: 500 });

  return Response.json({ ok: true });
}
