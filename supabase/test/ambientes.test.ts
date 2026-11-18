import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/** Ambientes: reglas de acceso, guardado con versión y borrados en cascada (PGlite, dos usuarias). */
const SHIM = `
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  create role anon nologin;
  create role authenticated nologin;
  grant usage on schema public, auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`;
const ANA = '11111111-1111-1111-1111-111111111111';
const BEA = '22222222-2222-2222-2222-222222222222';
const plan = JSON.stringify({ v: 1, corners: [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 300000, y: 0 }, { id: 'c', x: 300000, y: 250000 }], wallThickness: 15000, wallHeight: 260000, openings: [], placements: [] });

let db: PGlite;
async function as<T>(user: string | null, fn: (tx: Pick<PGlite, 'query' | 'exec'>) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${user ? 'authenticated' : 'anon'}`);
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [user ?? '']);
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

let project = '';
let room = '';

beforeAll(async () => {
  db = await PGlite.create();
  await db.exec(SHIM);
  const dir = join(import.meta.dirname, '..', 'migrations');
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) await db.exec(readFileSync(join(dir, f), 'utf8'));
  await db.query(`insert into auth.users (id) values ($1), ($2)`, [ANA, BEA]);
  await as(ANA, async (tx) => {
    project = (await tx.query<{ id: string }>(`insert into projects (name) values ('Casa') returning id`)).rows[0]!.id;
    room = (await tx.query<{ id: string }>(`insert into rooms (project_id, name, plan) values ($1, 'Cocina', $2) returning id`, [project, plan])).rows[0]!.id;
  });
});
afterAll(async () => db?.close());

describe('ambientes', () => {
  it('Bea no ve ni cambia el ambiente de Ana', async () => {
    await as(BEA, async (tx) => {
      expect((await tx.query(`select * from rooms`)).rows).toEqual([]);
      expect((await tx.query(`update rooms set name = 'x' where id = $1`, [room])).affectedRows).toBe(0);
    });
  });

  it('Bea no puede colgar un ambiente del proyecto de Ana', async () => {
    expect(await errorCode(as(BEA, (tx) => tx.query(`insert into rooms (project_id, name, plan) values ($1, 'Intruso', $2)`, [project, plan])))).toBe('23503');
  });

  it('un visitante sin sesión no puede leer', async () => {
    expect(await errorCode(as(null, (tx) => tx.query(`select * from rooms`)))).toBe('42501');
  });

  it('guardar con versión: sube la rev; una rev vieja da MW409; uno ajeno, MW404', async () => {
    const rev = await as(ANA, async (tx) => (await tx.query<{ r: number }>(`select save_room($1, 1, '{"name":"Cocina grande"}') as r`, [room])).rows[0]!.r);
    expect(rev).toBe(2);
    expect(await errorCode(as(ANA, (tx) => tx.query(`select save_room($1, 1, '{}')`, [room])))).toBe('MW409');
    expect(await errorCode(as(BEA, (tx) => tx.query(`select save_room($1, 2, '{}')`, [room])))).toBe('MW404');
  });

  it('una planta sin esquinas se rechaza', async () => {
    expect(await errorCode(as(ANA, (tx) => tx.query(`insert into rooms (project_id, name, plan) values ($1, 'Mal', '{"v":1}')`, [project])))).toBe('23514');
  });

  it('borrar la cuenta borra sus ambientes (y no falla)', async () => {
    await db.query(`delete from auth.users where id = $1`, [ANA]);
    expect((await db.query<{ n: number }>(`select count(*)::int as n from rooms`)).rows[0]!.n).toBe(0);
  });
});
