import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/** Medida de la placa de cada tablero (PGlite). */
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

describe('medida de la placa', () => {
  it('es opcional: un tablero sin medida se guarda como antes', async () => {
    await as((tx) => tx.query("insert into materials (id, name, kind, thickness) values ('a', 'A', 'panel', 1800)"));
    const r = await db.query('select sheet_length, sheet_width from materials where id = $1', ['a']);
    expect(r.rows).toEqual([{ sheet_length: null, sheet_width: null }]);
  });

  it('se guardan las dos medidas juntas', async () => {
    await as((tx) => tx.query("insert into materials (id, name, kind, thickness, sheet_length, sheet_width) values ('b', 'B', 'panel', 1800, 260000, 183000)"));
    expect((await db.query('select sheet_length, sheet_width from materials where id = $1', ['b'])).rows).toEqual([{ sheet_length: 260000, sheet_width: 183000 }]);
  });

  it('no se puede guardar una sola, ni medidas en cero', async () => {
    expect(await code(as((tx) => tx.query("insert into materials (id, name, kind, thickness, sheet_length) values ('c', 'C', 'panel', 1800, 260000)")))).toBe('23514');
    expect(await code(as((tx) => tx.query("insert into materials (id, name, kind, thickness, sheet_length, sheet_width) values ('d', 'D', 'panel', 1800, 0, 0)")))).toBe('23514');
  });
});
