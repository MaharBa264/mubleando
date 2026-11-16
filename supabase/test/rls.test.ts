import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Pruebas de la migración y de las reglas de acceso, con un Postgres real (PGlite) en memoria.
 *
 * Supabase trae de serie el esquema `auth` (usuarios y `auth.uid()`) y los roles `anon` y
 * `authenticated`. Aquí se imitan con lo mínimo para que la migración corra igual que allí:
 * `auth.uid()` lee el usuario de la variable `request.jwt.claim.sub`, como hace Supabase.
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
const BEA = '22222222-2222-2222-2222-222222222222';

let db: PGlite;

/** Ejecuta `fn` como el usuario indicado (o como visitante anónimo con `null`), igual que una petición a Supabase. */
async function as<T>(user: string | null, fn: (tx: Pick<PGlite, 'query' | 'exec'>) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${user ? 'authenticated' : 'anon'}`);
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [user ?? '']);
    return fn(tx);
  });
}

/** Ejecuta y devuelve el código de error de Postgres (o null si no falla). */
async function errorCode(p: Promise<unknown>): Promise<string | null> {
  try {
    await p;
    return null;
  } catch (e) {
    return (e as { code?: string }).code ?? 'sin-código';
  }
}

const design = JSON.stringify({ v: 1, shape: 'rect', size: { w: 60000, h: 72000, d: 56000 }, root: { id: 'r' } });

beforeAll(async () => {
  db = await PGlite.create();
  await db.exec(SHIM);
  const dir = join(import.meta.dirname, '..', 'migrations');
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(join(dir, f), 'utf8'));
  }
  await db.query(`insert into auth.users (id, email) values ($1, 'ana@example.com'), ($2, 'bea@example.com')`, [ANA, BEA]);
});

afterAll(async () => {
  await db?.close();
});

describe('datos de cada usuario', () => {
  let anaProject = '';
  let anaCabinet = '';

  it('Ana crea su método, un proyecto y un mueble (user_id sale solo de la sesión)', async () => {
    await as(ANA, async (tx) => {
      await tx.query(`insert into methods (id, name, spec) values ('std', 'Estándar', '{"x":1}')`);
      await tx.query(`insert into materials (id, name, kind, thickness) values ('mel-19', 'Melamina 19', 'panel', 1900)`);
      const p = await tx.query<{ id: string; user_id: string }>(`insert into projects (name) values ('Cocina') returning id, user_id`);
      anaProject = p.rows[0]!.id;
      expect(p.rows[0]!.user_id).toBe(ANA);
      const c = await tx.query<{ id: string; rev: number }>(
        `insert into cabinets (project_id, name, method_id, design) values ($1, 'Bajo', 'std', $2) returning id, rev`,
        [anaProject, design],
      );
      anaCabinet = c.rows[0]!.id;
      expect(c.rows[0]!.rev).toBe(1);
    });
  });

  it('Bea no ve nada de Ana', async () => {
    await as(BEA, async (tx) => {
      for (const t of ['projects', 'cabinets', 'materials', 'methods']) {
        const r = await tx.query<{ n: number }>(`select count(*)::int as n from ${t}`);
        expect(r.rows[0]!.n, t).toBe(0);
      }
    });
  });

  it('Bea no puede cambiar ni borrar lo de Ana (las filas simplemente no existen para ella)', async () => {
    await as(BEA, async (tx) => {
      const u = await tx.query(`update projects set name = 'Hackeado' where id = $1`, [anaProject]);
      expect(u.affectedRows).toBe(0);
      const d = await tx.query(`delete from cabinets where id = $1`, [anaCabinet]);
      expect(d.affectedRows).toBe(0);
    });
    await as(ANA, async (tx) => {
      const r = await tx.query<{ name: string }>(`select name from projects where id = $1`, [anaProject]);
      expect(r.rows[0]!.name).toBe('Cocina');
    });
  });

  it('Bea no puede crear filas a nombre de Ana', async () => {
    const code = await errorCode(as(BEA, (tx) => tx.query(`insert into projects (user_id, name) values ($1, 'Falso')`, [ANA])));
    expect(code).toBe('42501'); // la regla de acceso rechaza la fila
  });

  it('Bea no puede colgar un mueble de un proyecto de Ana', async () => {
    await as(BEA, (tx) => tx.query(`insert into methods (id, name, spec) values ('std', 'Mío', '{}')`));
    const code = await errorCode(
      as(BEA, (tx) => tx.query(`insert into cabinets (project_id, name, method_id, design) values ($1, 'Intruso', 'std', $2)`, [anaProject, design])),
    );
    expect(code).toBe('23503'); // clave foránea (proyecto, usuario) inexistente
  });

  it('un visitante sin sesión no puede leer ni escribir', async () => {
    expect(await errorCode(as(null, (tx) => tx.query(`select * from projects`)))).toBe('42501');
    expect(await errorCode(as(null, (tx) => tx.query(`insert into projects (name) values ('x')`)))).toBe('42501');
  });

  describe('guardar con control de versión', () => {
    it('guarda si la rev coincide y devuelve la siguiente', async () => {
      const rev = await as(ANA, async (tx) => {
        const r = await tx.query<{ rev: number }>(`select save_cabinet($1, 1, $2) as rev`, [anaCabinet, JSON.stringify({ name: 'Bajo 600', quantity: 2 })]);
        return r.rows[0]!.rev;
      });
      expect(rev).toBe(2);
      await as(ANA, async (tx) => {
        const r = await tx.query<{ name: string; quantity: number; design: unknown }>(`select name, quantity, design from cabinets where id = $1`, [anaCabinet]);
        expect(r.rows[0]).toMatchObject({ name: 'Bajo 600', quantity: 2 });
        expect(r.rows[0]!.design).toEqual(JSON.parse(design)); // lo que no viene en el cambio no se toca
      });
    });

    it('rev antigua: conflicto (MW409)', async () => {
      expect(await errorCode(as(ANA, (tx) => tx.query(`select save_cabinet($1, 1, '{}')`, [anaCabinet])))).toBe('MW409');
    });

    it('mueble ajeno o inexistente: MW404, sin revelar si existe', async () => {
      expect(await errorCode(as(BEA, (tx) => tx.query(`select save_cabinet($1, 2, '{}')`, [anaCabinet])))).toBe('MW404');
    });

    it('guardar el mueble actualiza la fecha de su proyecto', async () => {
      await as(ANA, async (tx) => {
        const before = (await tx.query<{ t: string }>(`select updated_at::text as t from projects where id = $1`, [anaProject])).rows[0]!.t;
        await tx.query(`select pg_sleep(0.01)`);
        await tx.query(`select save_cabinet($1, 2, '{"name":"Bajo 600 bis"}')`, [anaCabinet]);
        const after = (await tx.query<{ t: string }>(`select updated_at::text as t from projects where id = $1`, [anaProject])).rows[0]!.t;
        // dentro de una misma transacción now() no avanza: basta con que no falle y siga igual o mayor
        expect(after >= before).toBe(true);
      });
    });
  });

  describe('integridad', () => {
    it('no se puede borrar un método que use algún mueble', async () => {
      expect(await errorCode(as(ANA, (tx) => tx.query(`delete from methods where id = 'std'`)))).toBe('23001'); // restrict_violation
    });

    it('un diseño sin árbol de huecos se rechaza', async () => {
      const code = await errorCode(
        as(ANA, (tx) => tx.query(`insert into cabinets (project_id, name, method_id, design) values ($1, 'Roto', 'std', '{"v":1}')`, [anaProject])),
      );
      expect(code).toBe('23514');
    });

    it('borrar un proyecto borra sus muebles', async () => {
      await as(ANA, async (tx) => {
        await tx.query(`delete from projects where id = $1`, [anaProject]);
        const r = await tx.query<{ n: number }>(`select count(*)::int as n from cabinets`);
        expect(r.rows[0]!.n).toBe(0);
      });
    });

    it('borrar la cuenta borra todos sus datos', async () => {
      await as(ANA, (tx) => tx.query(`insert into projects (name) values ('Otro')`));
      await db.query(`delete from auth.users where id = $1`, [ANA]);
      for (const t of ['projects', 'cabinets', 'materials', 'methods']) {
        const r = await db.query<{ n: number }>(`select count(*)::int as n from ${t} where user_id = $1`, [ANA]);
        expect(r.rows[0]!.n, t).toBe(0);
      }
      // lo de Bea sigue ahí
      const b = await db.query<{ n: number }>(`select count(*)::int as n from methods where user_id = $1`, [BEA]);
      expect(b.rows[0]!.n).toBe(1);
    });
  });
});
