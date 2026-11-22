import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/** Herrajes de apertura y peso de los materiales (PGlite). */
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
let db: PGlite;

async function as<T>(fn: (tx: Pick<PGlite, 'query'>) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.exec('set local role authenticated');
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [ANA]);
    return fn(tx);
  });
}
async function code(p: Promise<unknown>) {
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
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) await db.exec(readFileSync(join(dir, f), 'utf8'));
  await db.query("insert into auth.users (id, email) values ($1, 'ana@example.com')", [ANA]);
});
afterAll(async () => db?.close());

describe('apertura hacia arriba', () => {
  it('los herrajes aceptan el tipo «lift»', async () => {
    await as((tx) => tx.query(`insert into hardware (id, name, kind, spec) values ('p', 'Pistón 80 N', 'lift', '{"type":"gas"}')`));
    expect((await db.query("select id, kind from hardware where kind = 'lift'")).rows).toEqual([{ id: 'p', kind: 'lift' }]);
    expect(await code(as((tx) => tx.query(`insert into hardware (id, name, kind, spec) values ('x', 'X', 'motor', '{}')`)))).toBe('23514');
  });
  it('los materiales pueden tener peso por m² (vacío por defecto, mayor que 0)', async () => {
    await as((tx) => tx.query("insert into materials (id, name, kind, thickness, weight) values ('m', 'Melamina 18', 'panel', 1800, 12.5)"));
    await as((tx) => tx.query("insert into materials (id, name, kind, thickness) values ('f', 'Fibro 3', 'panel', 300)"));
    expect((await db.query("select id, weight::float8 as weight from materials order by id")).rows).toEqual([
      { id: 'f', weight: null },
      { id: 'm', weight: 12.5 },
    ]);
    expect(await code(as((tx) => tx.query("insert into materials (id, name, kind, thickness, weight) values ('z', 'Z', 'panel', 1800, 0)")))).toBe('23514');
  });
});
