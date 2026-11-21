import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/** Vidrios en la biblioteca de materiales (PGlite). */
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
    return (e as { code?: string }).code ?? 'sin-cÃ³digo';
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

describe('vidrios', () => {
  it('los materiales aceptan vidrios, templados o no (por defecto, no)', async () => {
    await as((tx) => tx.query("insert into materials (id, name, kind, thickness, tempered) values ('t', 'Templado 5', 'glass', 500, true)"));
    await as((tx) => tx.query("insert into materials (id, name, kind, thickness) values ('i', 'Incoloro 4', 'glass', 400)"));
    expect((await db.query("select id, kind, tempered from materials where kind = 'glass' order by id")).rows).toEqual([
      { id: 'i', kind: 'glass', tempered: false },
      { id: 't', kind: 'glass', tempered: true },
    ]);
  });
  it('y siguen rechazando los tipos que no existen', async () => {
    expect(await code(as((tx) => tx.query("insert into materials (id, name, kind, thickness) values ('x', 'X', 'metal', 100)")))).toBe('23514');
  });
});
