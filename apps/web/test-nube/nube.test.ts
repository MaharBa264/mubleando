/**
 * Prueba de punta a punta contra TU proyecto de Supabase (no se lanza con `npm test`).
 *
 *   npm run test:nube -w @mw/web
 *
 * Necesita apps/web/.env.local (dirección y clave pública) y apps/web/.dev.vars (clave secreta). Crea dos cuentas de prueba ya
 * confirmadas con la clave secreta (no se envía ningún correo; direcciones @example.com que no
 * existen), ejercita la capa de datos real (src/data/cloud.ts) y la ruta de borrar cuenta, y al
 * final borra las dos cuentas y todos sus datos, falle lo que falle. No imprime claves ni contraseñas.
 */
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mm, newDesign, rectRoom, setDrawerSize, setFront, setPlinth } from '@mw/engine';

// Variables públicas de .env.local y la clave secreta de .dev.vars (que no se empaqueta al publicar).
const env: Record<string, string> = {};
for (const file of ['../.env.local', '../.dev.vars']) {
  for (const l of readFileSync(new URL(file, import.meta.url), 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/.exec(l);
    if (m) env[m[1]!] = m[2]!;
  }
}
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SECRET = env.SUPABASE_SERVICE_ROLE_KEY!;

let current: SupabaseClient;
vi.mock('@/lib/supabase', () => ({ cloudEnabled: true, supabase: () => current }));

// localStorage falso para probar la subida de datos del navegador
const store = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) },
  addEventListener: () => {},
};

const { cloudData: data, importLocalData } = await import('@/data/cloud');
const { ConflictError, InUseError, NotFoundError } = await import('@/data/types');
const { POST: deleteAccount } = await import('@/app/api/cuenta/borrar/route');

const admin = createClient(URL_, SECRET, { auth: { persistSession: false, autoRefreshToken: false } });
const tag = randomBytes(4).toString('hex');
const users: { id: string; email: string; client: SupabaseClient; token: string }[] = [];

async function makeUser(name: string) {
  const email = `mw-prueba-${tag}-${name}@example.com`;
  const password = randomBytes(18).toString('base64url');
  const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`crear ${name}: ${error.message}`);
  const client = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: s, error: e2 } = await client.auth.signInWithPassword({ email, password });
  if (e2) throw new Error(`entrar ${name}: ${e2.message}`);
  const u = { id: created.user.id, email, client, token: s.session!.access_token };
  users.push(u);
  return u;
}

const rowsOf = async (table: string, userId: string) => {
  const r = await admin.from(table).select('*', { count: 'exact', head: true }).eq('user_id', userId);
  return r.count ?? -1;
};

let A: Awaited<ReturnType<typeof makeUser>>;
let B: Awaited<ReturnType<typeof makeUser>>;
let projectId = '';
let cabinetId = '';

beforeAll(async () => {
  A = await makeUser('ana');
  B = await makeUser('bea');
});

afterAll(async () => {
  // Limpieza pase lo que pase: borrar las cuentas que queden (cascada borra sus datos).
  for (const u of users) await admin.auth.admin.deleteUser(u.id).catch(() => {});
  for (const u of users) {
    const left = await admin.auth.admin.getUserById(u.id);
    console.log(`limpieza ${u.email.replace(/^(.{14}).*@/, '$1…@')}: ${left.data.user ? 'SIGUE EXISTIENDO' : 'borrada'}`);
  }
});

describe('cuenta A', () => {
  it('cuenta nueva: recibe los materiales y métodos de partida', async () => {
    current = A.client;
    const methods = await data.listMethods();
    const materials = await data.listMaterials();
    expect(methods.map((m) => m.id).sort()).toEqual(['ar-18-clavado', 'ar-18-ranura']);
    expect(materials).toHaveLength(9);
    expect(methods[0]!.drawer.depthStep).toBe(mm(50));
  });

  it('crea proyecto y mueble; el diseño vuelve idéntico', async () => {
    current = A.client;
    const p = await data.createProject('  Cocina de prueba  ');
    expect(p.name).toBe('Cocina de prueba');
    projectId = p.id;
    let d = newDesign({ w: mm(600), h: mm(720), d: mm(560) });
    d = setPlinth(d, { height: mm(100), setback: mm(50) });
    d = setFront(d, d.root.id, { kind: 'drawers', mount: 'overlay', sizes: [null, null, null] });
    d = setDrawerSize(d, d.root.id, 0, mm(140));
    const c = await data.createCabinet({ projectId, name: 'Cajonera', methodId: 'ar-18-ranura', design: d });
    cabinetId = c.id;
    expect(c.rev).toBe(1);
    const back = await data.getCabinet(c.id);
    expect(back?.design).toEqual(d);
    const list = await data.listProjects();
    expect(list.find((x) => x.id === projectId)?.cabinetCount).toBe(1);
  });

  it('guardar sube la versión; una versión vieja da conflicto', async () => {
    current = A.client;
    expect(await data.saveCabinet(cabinetId, 1, { name: 'Cajonera 600', quantity: 2 })).toBe(2);
    await expect(data.saveCabinet(cabinetId, 1, { name: 'otra' })).rejects.toBeInstanceOf(ConflictError);
    const c = await data.getCabinet(cabinetId);
    expect([c?.name, c?.quantity, c?.rev]).toEqual(['Cajonera 600', 2, 2]);
  });

  it('bibliotecas: guardar, y borrado protegido de lo que está en uso', async () => {
    current = A.client;
    const m = (await data.listMethods())[0]!;
    await data.saveMethod({ ...m, id: randomUUID(), name: 'Copia de prueba' });
    expect(await data.listMethods()).toHaveLength(3);
    await expect(data.deleteMethod('ar-18-ranura')).rejects.toThrow(/Lo usa 1 mueble/);
    await expect(data.deleteMaterial('ar-mel-blanca-18')).rejects.toBeInstanceOf(InUseError);
    await data.saveMaterial({ id: 'prueba-mat', name: 'Tablero prueba', kind: 'panel', thickness: mm(18), grain: 'length', priceCents: 1234, color: 'var(--mat-oak)' });
    expect((await data.listMaterials()).find((x) => x.id === 'prueba-mat')?.priceCents).toBe(1234);
    await data.deleteMaterial('prueba-mat');
    await data.renameProject(projectId, 'Cocina renombrada');
    expect((await data.getProject(projectId))?.name).toBe('Cocina renombrada');
  });
});

describe('cuenta B no ve nada de A', () => {
  it('lista vacía, mueble invisible, no puede guardar, borrar ni colgar muebles en el proyecto de A', async () => {
    current = B.client;
    expect(await data.listProjects()).toEqual([]);
    expect(await data.getProject(projectId)).toBeNull();
    expect(await data.getCabinet(cabinetId)).toBeNull();
    await expect(data.saveCabinet(cabinetId, 2, { name: 'Hackeado' })).rejects.toBeInstanceOf(NotFoundError);
    await data.deleteProject(projectId); // no falla, pero no borra nada
    await expect(
      data.createCabinet({ projectId, name: 'Intruso', methodId: 'ar-18-ranura', design: newDesign({ w: mm(600), h: mm(720), d: mm(560) }) }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(await data.listMaterials()).toHaveLength(9); // sus propias bibliotecas de partida
  });

  it('lo de A sigue intacto', async () => {
    current = A.client;
    const c = await data.getCabinet(cabinetId);
    expect(c?.name).toBe('Cajonera 600');
    expect(await data.getProject(projectId)).not.toBeNull();
  });
});

describe('ambientes', () => {
  let roomId = '';

  it('A crea un ambiente con un mueble colocado; vuelve idéntico', async () => {
    current = A.client;
    const plan = rectRoom(mm(3200), mm(2600));
    plan.placements = [{ id: randomUUID(), cabinetId, x: 0, y: 0, rotation: 0, elevation: 0 }];
    const r = await data.createRoom({ projectId, name: 'Cocina', plan });
    roomId = r.id;
    expect(r.rev).toBe(1);
    expect((await data.getRoom(roomId))?.plan).toEqual(plan);
    expect((await data.listRooms(projectId)).map((x) => x.name)).toEqual(['Cocina']);
  });

  it('guardar sube la versión; una versión vieja da conflicto', async () => {
    current = A.client;
    expect(await data.saveRoom(roomId, 1, { name: 'Cocina grande' })).toBe(2);
    await expect(data.saveRoom(roomId, 1, { name: 'otra' })).rejects.toBeInstanceOf(ConflictError);
  });

  it('B no ve ni puede guardar el ambiente de A', async () => {
    current = B.client;
    expect(await data.getRoom(roomId)).toBeNull();
    expect(await data.listRooms(projectId)).toEqual([]);
    await expect(data.saveRoom(roomId, 2, { name: 'Hackeado' })).rejects.toBeInstanceOf(NotFoundError);
    await expect(data.createRoom({ projectId, name: 'Intruso', plan: rectRoom(mm(1000), mm(1000)) })).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('subir los datos del navegador', () => {
  it('copia proyectos y muebles; repetir no duplica', async () => {
    current = A.client;
    const pid = randomUUID();
    const cid = randomUUID();
    const t = new Date().toISOString();
    const d = newDesign({ w: mm(900), h: mm(2000), d: mm(580) });
    store.set(
      'mueblesweb:v1',
      JSON.stringify({
        schema: 2,
        projects: [{ id: pid, name: 'Del navegador', createdAt: t, updatedAt: t }],
        cabinets: [{ id: cid, projectId: pid, name: 'Despensa local', methodId: 'ar-18-ranura', design: d, rev: 3, quantity: 1, createdAt: t, updatedAt: t }],
        materials: [],
        methods: [],
      }),
    );
    const r1 = await importLocalData();
    expect(r1).toMatchObject({ projects: 1, cabinets: 1 });
    await importLocalData();
    const list = await data.listProjects();
    expect(list.filter((p) => p.id === pid)).toHaveLength(1);
    expect((await data.listCabinets(pid)).map((c) => c.name)).toEqual(['Despensa local']);
  });
});

describe('borrar la cuenta', () => {
  it('sin sesión válida: 401', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = URL_;
    process.env.SUPABASE_SERVICE_ROLE_KEY = SECRET;
    const res = await deleteAccount(new Request('http://x/api/cuenta/borrar', { method: 'POST', headers: { Authorization: 'Bearer token-falso' } }));
    expect(res.status).toBe(401);
  });

  it('con la sesión de A: borra la cuenta y todas sus filas, y no toca a B', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = URL_;
    process.env.SUPABASE_SERVICE_ROLE_KEY = SECRET;
    const before = await rowsOf('projects', A.id);
    expect(before).toBeGreaterThan(0);
    const res = await deleteAccount(new Request('http://x/api/cuenta/borrar', { method: 'POST', headers: { Authorization: `Bearer ${A.token}` } }));
    expect(res.status).toBe(200);
    expect((await admin.auth.admin.getUserById(A.id)).data.user).toBeNull();
    for (const t of ['projects', 'cabinets', 'rooms', 'materials', 'methods']) expect(await rowsOf(t, A.id), t).toBe(0);
    expect(await rowsOf('materials', B.id)).toBe(9);
  });
});
