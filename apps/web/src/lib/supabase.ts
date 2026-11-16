'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Conexión con Supabase (base de datos y cuentas en la nube).
 *
 * Se activa sola si existen las dos variables públicas de `.env.local`:
 *   NEXT_PUBLIC_SUPABASE_URL       dirección del proyecto (https://xxxx.supabase.co)
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY  clave pública "anon" (es pública a propósito: los permisos
 *                                  los ponen las reglas de acceso de la base de datos)
 * Sin ellas, la app funciona como antes: todo se guarda en el navegador.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const cloudEnabled = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!cloudEnabled) throw new Error('La nube no está configurada (faltan las variables NEXT_PUBLIC_SUPABASE_*).');
  client ??= createClient(url!, anonKey!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      // PKCE: los enlaces de confirmación y de nueva contraseña llevan un código de un solo uso, no el token.
      flowType: 'pkce',
      storageKey: 'mueblesweb:sesion',
    },
  });
  return client;
}
