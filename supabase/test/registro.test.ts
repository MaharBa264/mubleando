import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/** Registro solo para mails autorizados (PGlite). */
const SHIM = [
  'create schema auth;',
  'create table auth.users (id uuid primary key, email text, created_at timestamptz default now(), last_sign_in_at timestamptz);',
  "create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;",
  'create role anon nologin;',
  'create role authenticated nologin;',
  'grant usage on schema public, auth to anon, authenticated;',
  'grant execute on function auth.uid() to anon, authenticated;',
].join('\n');
const DUENO = '11111111-1111-1111-1111-111111111111';
const OTRA = '22222222-2222-2222-2222-222222222222';
const NUEVA = '33333333-3333-3333-3333-333333333333';
const INTRUSA = '44444444-4444-4444-4444-444444444444';
let db: PGlite;

async function as<T>(user: string | null, fn: (tx: Pick<PGlite, 'query' | 'exec'>) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.exec('set local role ' + (user ? 'authenticated' : 'anon'));
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [user ?? '']);
    return fn(tx);
  });
}
async function error(p: Promise<unknown>): Promise<{ code: string; message: string } | null> {
  try {
    await p;
    return null;
  } catch (e) {
    const x = e as { code?: string; message?: string };
    return { code: x.code ?? 'sin-código', message: x.message ?? '' };
  }
}
const signup = (id: string, email: string | null) => db.query('insert into auth.users (id, email) values ($1, $2)', [id, email]);

beforeAll(async () => {
  db = await PGlite.create();
  await db.exec(SHIM);
  const dir = join(import.meta.dirname, '..', 'migrations');
  const files = readdirSync(dir).filter((x) => x.endsWith('.sql')).sort();
  const reg = files.find((f) => f.includes('registro'))!;
  // Dos cuentas que ya existían antes de la migración: la más antigua es la del dueño.
  for (const f of files.filter((f) => f < reg)) await db.exec(readFileSync(join(dir, f), 'utf8'));
  await db.query("insert into auth.users (id, email, created_at) values ($1, 'otra@example.com', '2026-11-18'), ($2, 'dueno@example.com', '2026-11-17')", [OTRA, DUENO]);
  for (const f of files.filter((f) => f >= reg)) await db.exec(readFileSync(join(dir, f), 'utf8'));
});
afterAll(async () => db?.close());

describe('registro con lista de mails', () => {
  it('la migración hace administradora a la cuenta más antigua y no toca las demás', async () => {
    expect((await db.query('select user_id from app_admins')).rows).toEqual([{ user_id: DUENO }]);
    expect((await db.query<{ n: number }>('select count(*)::int as n from auth.users')).rows[0]!.n).toBe(2);
  });

  it('un mail que no está en la lista no puede registrarse (ni sin mail)', async () => {
    const e = await error(signup(INTRUSA, 'intrusa@example.com'));
    expect(e?.code).toBe('P0001');
    expect(e?.message).toContain('MW403');
    expect((await error(signup(INTRUSA, null)))?.code).toBe('P0001');
  });

  it('solo la administradora lee y edita la lista; las demás cuentas y los anónimos, no', async () => {
    await as(DUENO, (tx) => tx.query("insert into signup_allowlist (email, note, added_by) values ('nueva@example.com', 'mi socia', $1)", [DUENO]));
    await as(OTRA, async (tx) => {
      expect((await tx.query('select * from signup_allowlist')).rows).toEqual([]);
      await tx.query("delete from signup_allowlist where email = 'nueva@example.com'");
    });
    expect((await error(as(OTRA, (tx) => tx.query("insert into signup_allowlist (email) values ('amiga@example.com')"))))?.code).toBe('42501');
    expect((await error(as(null, (tx) => tx.query('select * from signup_allowlist'))))?.code).toBe('42501');
    expect((await db.query('select email from signup_allowlist')).rows).toEqual([{ email: 'nueva@example.com' }]);
  });

  it('los mails se guardan en minúsculas y con forma de mail', async () => {
    expect((await error(as(DUENO, (tx) => tx.query("insert into signup_allowlist (email) values ('Mayus@Example.com')"))))?.code).toBe('23514');
    expect((await error(as(DUENO, (tx) => tx.query("insert into signup_allowlist (email) values ('sin-arroba')"))))?.code).toBe('23514');
  });

  it('un mail de la lista sí puede registrarse, aunque lo escriba con mayúsculas', async () => {
    await signup(NUEVA, 'Nueva@Example.com');
    expect((await db.query('select user_id from app_admins')).rows).toEqual([{ user_id: DUENO }]);
  });

  it('cada cuenta ve solo si ella misma es administradora', async () => {
    await as(OTRA, async (tx) => {
      expect((await tx.query('select * from app_admins')).rows).toEqual([]);
      expect((await tx.query<{ a: boolean }>('select public.is_admin() as a')).rows[0]!.a).toBe(false);
    });
    await as(DUENO, async (tx) => expect((await tx.query<{ a: boolean }>('select public.is_admin() as a')).rows[0]!.a).toBe(true));
  });

  it('la pantalla de administración: lista con quién ya se registró y cuentas existentes; solo para administradores', async () => {
    const list = await as(DUENO, (tx) => tx.query<{ email: string; note: string; registered_at: Date | null }>('select email, note, registered_at from public.admin_allowlist()'));
    expect(list.rows.map((r) => [r.email, r.note, r.registered_at !== null])).toEqual([['nueva@example.com', 'mi socia', true]]);
    const accounts = await as(DUENO, (tx) => tx.query<{ email: string; is_admin: boolean; allowed: boolean }>('select email, is_admin, allowed from public.admin_accounts()'));
    expect(accounts.rows).toEqual([
      { email: 'dueno@example.com', is_admin: true, allowed: false },
      { email: 'otra@example.com', is_admin: false, allowed: false },
      { email: 'Nueva@Example.com', is_admin: false, allowed: true },
    ]);
    expect((await error(as(OTRA, (tx) => tx.query('select * from public.admin_accounts()'))))?.code).toBe('42501');
    expect((await error(as(null, (tx) => tx.query('select * from public.admin_allowlist()'))))?.code).toBe('42501');
  });

  it('borrar la cuenta administradora la quita de app_admins; sin administradores, el registro vuelve a estar abierto', async () => {
    await db.query('delete from auth.users where id = $1', [DUENO]);
    expect((await db.query('select * from app_admins')).rows).toEqual([]);
    await signup(INTRUSA, 'intrusa@example.com');
    expect((await db.query('select user_id from app_admins')).rows).toEqual([{ user_id: INTRUSA }]);
  });
});
