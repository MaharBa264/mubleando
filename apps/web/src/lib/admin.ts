'use client';

import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

/**
 * Administración de la app (solo en la nube): quién puede registrarse.
 * Las reglas de acceso están en la base de datos (migración 20261121000000_registro_con_lista.sql):
 * aquí solo se llama a Supabase; una cuenta que no es administradora no puede leer ni cambiar nada.
 */

export interface AllowedEmail {
  email: string;
  note: string;
  createdAt: string;
  /** Fecha de alta de la cuenta, si ya se registró. */
  registeredAt: string | null;
}

export interface Account {
  email: string;
  createdAt: string;
  lastSignInAt: string | null;
  isAdmin: boolean;
  /** Su mail está en la lista (las cuentas anteriores a la lista pueden no estarlo). */
  allowed: boolean;
}

/** La migración del registro todavía no se aplicó en Supabase. */
export class AdminNotInstalledError extends Error {
  constructor() {
    super('Falta aplicar la migración del registro en Supabase (20261121000000_registro_con_lista.sql).');
  }
}

const missing = (e: PostgrestError) => e.code === 'PGRST205' || e.code === 'PGRST202' || e.code === '42P01' || e.code === '42883';

function fail(e: PostgrestError, what: string): never {
  if (missing(e)) throw new AdminNotInstalledError();
  if (e.code === '42501') throw new Error('Esta cuenta no es administradora.');
  throw new Error(`No se pudo ${what}. ${e.message}`.trim());
}

/** ¿La cuenta con la sesión abierta administra la app? (false también si falta la migración). */
export async function isAdmin(): Promise<boolean> {
  const { data, error } = await supabase().rpc('is_admin');
  if (error) return false;
  return data === true;
}

export async function listAllowed(): Promise<AllowedEmail[]> {
  const { data, error } = await supabase().rpc('admin_allowlist');
  if (error) fail(error, 'leer la lista de mails');
  return (data as { email: string; note: string; created_at: string; registered_at: string | null }[]).map((r) => ({
    email: r.email,
    note: r.note,
    createdAt: r.created_at,
    registeredAt: r.registered_at,
  }));
}

export async function listAccounts(): Promise<Account[]> {
  const { data, error } = await supabase().rpc('admin_accounts');
  if (error) fail(error, 'leer las cuentas');
  return (data as { email: string; created_at: string; last_sign_in_at: string | null; is_admin: boolean; allowed: boolean }[]).map((r) => ({
    email: r.email,
    createdAt: r.created_at,
    lastSignInAt: r.last_sign_in_at,
    isAdmin: r.is_admin,
    allowed: r.allowed,
  }));
}

/**
 * Separa los mails de un texto pegado (uno por línea, o separados por comas, punto y coma o espacios).
 * Devuelve los válidos en minúsculas, sin repetir, y los que no parecen mails.
 */
export function parseEmails(text: string): { valid: string[]; invalid: string[] } {
  const valid = new Set<string>();
  const invalid: string[] = [];
  for (const raw of text.split(/[\s,;]+/)) {
    const x = raw.trim().replace(/^<|>$/g, '').toLowerCase();
    if (!x) continue;
    if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x)) valid.add(x);
    else invalid.push(raw.trim());
  }
  return { valid: [...valid], invalid };
}

/** Agrega mails a la lista. Los que ya estaban se dejan como están. */
export async function addAllowed(emails: string[], note: string): Promise<void> {
  if (emails.length === 0) return;
  const sb = supabase();
  const uid = (await sb.auth.getUser()).data.user?.id ?? null;
  const rows = emails.map((email) => ({ email, note: note.trim().slice(0, 200), added_by: uid }));
  const { error } = await sb.from('signup_allowlist').upsert(rows, { onConflict: 'email', ignoreDuplicates: true });
  if (error) fail(error, 'agregar los mails');
}

export async function removeAllowed(email: string): Promise<void> {
  const { error } = await supabase().from('signup_allowlist').delete().eq('email', email);
  if (error) fail(error, 'quitar el mail');
}
