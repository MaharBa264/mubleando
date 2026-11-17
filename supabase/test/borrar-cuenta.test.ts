import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';

/**
 * Borrar una cuenta con muebles, en todos los órdenes de cascada que pueden darse.
 *
 * Al borrar una fila de auth.users, Postgres lanza las cascadas hacia projects, materials,
 * methods y cabinets en un orden que depende de detalles internos (el nombre de los
 * disparadores que crea para cada clave foránea). Ningún orden debe impedir el borrado.
 *
 * Nota: el fallo real que se vio en Supabase el 17-11-2026 ("permission denied for table
 * projects") venía de los permisos con que corre el disparador touch_project, no del orden,
 * y PGlite no lo reproduce. Ver supabase/migrations/20261117000000_*.sql.
 *
 * Aquí se fuerza cada orden volviendo a crear las claves foráneas hacia auth.users en el orden
 * deseado: la que se crea antes, cascada antes.
 */
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
const TABLES = ['projects', 'materials', 'methods', 'cabinets'] as const;
const design = JSON.stringify({ v: 1, shape: 'rect', size: { w: 60000, h: 72000, d: 56000 }, root: { id: 'r' } });

async function dbWithCascadeOrder(order: readonly string[]) {
  const db = await PGlite.create();
  await db.exec(SHIM);
  const dir = join(import.meta.dirname, '..', 'migrations');
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) await db.exec(readFileSync(join(dir, f), 'utf8'));
  for (const t of TABLES) await db.exec(`alter table public.${t} drop constraint ${t}_user_id_fkey`);
  for (const t of order) {
    await db.exec(`alter table public.${t} add constraint ${t}_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade`);
  }
  await db.query(`insert into auth.users (id, email) values ($1, 'ana@example.com')`, [ANA]);
  // Una cuenta con todo: material, método, proyecto y un mueble que usa el método.
  await db.query(`insert into materials (user_id, id, name, kind, thickness) values ($1, 'm', 'Melamina', 'panel', 1900)`, [ANA]);
  await db.query(`insert into methods (user_id, id, name, spec) values ($1, 'std', 'Estándar', '{}')`, [ANA]);
  const p = await db.query<{ id: string }>(`insert into projects (user_id, name) values ($1, 'Cocina') returning id`, [ANA]);
  await db.query(`insert into cabinets (user_id, project_id, name, method_id, design) values ($1, $2, 'Bajo', 'std', $3)`, [ANA, p.rows[0]!.id, design]);
  return db;
}

/** Todos los órdenes posibles de las cuatro cascadas (24). */
function permutations<T>(xs: readonly T[]): T[][] {
  if (xs.length <= 1) return [[...xs]];
  return xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((rest) => [x, ...rest]));
}

describe('borrar una cuenta con muebles', () => {
  for (const order of permutations(TABLES)) {
    it(`cascada en orden ${order.join(' → ')}`, async () => {
      const db = await dbWithCascadeOrder(order);
      try {
        await db.query(`delete from auth.users where id = $1`, [ANA]);
        for (const t of TABLES) {
          const r = await db.query<{ n: number }>(`select count(*)::int as n from ${t}`);
          expect(r.rows[0]!.n, t).toBe(0);
        }
      } finally {
        await db.close();
      }
    });
  }
});
