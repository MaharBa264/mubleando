import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/** Tabla de herrajes: reglas de acceso y herrajes por defecto en los métodos argentinos (PGlite). */
const SHIM = [
  'create schema auth;',
  'create table auth.users (id uuid primary key, email text, created_at timestamptz default now(), last_sign_in_at timestamptz);',
  "create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;",
  'create role anon nologin;',
  'create role authenticated nologin;',
  'grant usage on schema public, auth to anon, authenticated;',
  'grant execute on function auth.uid() to anon, authenticated;',
].join('\n');
const ANA = '11111111-1111-1111-1111-111111111111';
const BEA = '22222222-2222-2222-2222-222222222222';
let db: PGlite;

async function as<T>(user: string | null, fn: (tx: Pick<PGlite, 'query' | 'exec'>) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.exec('set local role ' + (user ? 'authenticated' : 'anon'));
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [user ?? '']);
    return fn(tx);
  });
}
async function errorCode(p: Promise<unknown>): Promise<string | null> {
  try {
    await p;
    return null;
  } catch (e) {
    return (e as { code?: string }).code ?? 'sin-código';
  }
}

beforeAll(async () => {
  db = await PGlite.create();
  await db.exec(SHIM);
  const dir = join(import.meta.dirname, '..', 'migrations');
  const files = readdirSync(dir).filter((x) => x.endsWith('.sql')).sort();
  // Se aplican las anteriores a la de herrajes, se crea un método argentino "viejo", la de herrajes y las siguientes.
  const hw = files.find((f) => f.includes('herrajes'))!;
  for (const f of files.filter((f) => f < hw)) await db.exec(readFileSync(join(dir, f), 'utf8'));
  await db.query('insert into auth.users (id) values ($1), ($2)', [ANA, BEA]);
  await as(ANA, (tx) => tx.query("insert into methods (id, name, spec) values ('ar-18-ranura', 'M', '{}'), ('propio', 'P', '{}')"));
  await db.exec(readFileSync(join(dir, hw), 'utf8'));
  for (const f of files.filter((f) => f > hw)) await db.exec(readFileSync(join(dir, f), 'utf8'));
});
afterAll(async () => db?.close());

describe('herrajes', () => {
  it('la migración pone herrajes por defecto a los métodos argentinos y no toca los demás', async () => {
    const r = await db.query<{ id: string; hw: unknown }>("select id, spec -> 'hardware' as hw from methods order by id");
    expect(r.rows).toEqual([
      { id: 'ar-18-ranura', hw: { hinge: 'hw-bisagra-codo0', slide: 'hw-corredera-bolas-45', sliding: 'hw-corredizo-2' } },
      { id: 'propio', hw: null },
    ]);
  });

  it('cada usuario ve solo sus herrajes', async () => {
    await as(ANA, (tx) => tx.query("insert into hardware (id, name, kind, spec) values ('b', 'Bisagra', 'hinge', '{}')"));
    await as(BEA, async (tx) => expect((await tx.query('select * from hardware')).rows).toEqual([]));
    expect(await errorCode(as(null, (tx) => tx.query('select * from hardware')))).toBe('42501');
  });

  it('el tipo se valida', async () => {
    expect(await errorCode(as(ANA, (tx) => tx.query("insert into hardware (id, name, kind, spec) values ('x', 'X', 'tornillo', '{}')")))).toBe('23514');
  });

  it('borrar la cuenta borra sus herrajes', async () => {
    await db.query('delete from auth.users where id = $1', [ANA]);
    expect((await db.query<{ n: number }>('select count(*)::int as n from hardware')).rows[0]!.n).toBe(0);
  });
});
