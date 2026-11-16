'use client';

import type { PostgrestError } from '@supabase/supabase-js';
import {
  designSchema,
  materialSchema,
  methodSchema,
  normalizeMethod,
  PRESET_MATERIALS,
  PRESET_METHODS,
  type Design,
  type Material,
  type Method,
} from '@mw/engine';
import { supabase } from '@/lib/supabase';
import { readLocalState } from './local';
import { ConflictError, InUseError, NotFoundError, type Cabinet, type DataLayer, type Project } from './types';

/**
 * Capa de datos en la nube (Supabase). Misma interfaz que la local, así que las pantallas no cambian.
 *
 * - Lee y escribe directamente desde el navegador; los permisos los ponen las reglas de acceso
 *   de la base de datos (cada usuario solo ve y cambia sus filas). Ver supabase/migrations.
 * - Guardar un mueble pasa por la función `save_cabinet`, que comprueba la versión (`rev`)
 *   para que dos dispositivos no se pisen.
 * - La primera vez que una cuenta pide sus bibliotecas y no tiene ninguna, se le copian
 *   los materiales y métodos de partida.
 */

// ───────────────────────── filas de la base de datos ─────────────────────────

interface ProjectRow {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}
interface CabinetRow extends ProjectRow {
  project_id: string;
  method_id: string;
  design: Design;
  rev: number;
  quantity: number;
}
interface MaterialRow {
  id: string;
  name: string;
  kind: Material['kind'];
  thickness: number;
  grain: Material['grain'];
  price_cents: number;
  color: string;
}
interface MethodRow {
  id: string;
  name: string;
  spec: Omit<Method, 'id' | 'name'>;
}

const toProject = (r: ProjectRow): Project => ({ id: r.id, name: r.name, createdAt: r.created_at, updatedAt: r.updated_at });

function toCabinet(r: CabinetRow): Cabinet {
  const parsed = designSchema.safeParse(r.design);
  if (!parsed.success) throw new Error(`El mueble «${r.name}» tiene un diseño dañado y no se puede abrir.`);
  return {
    id: r.id,
    projectId: r.project_id,
    name: r.name,
    methodId: r.method_id,
    design: parsed.data,
    rev: r.rev,
    quantity: r.quantity,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const toMaterial = (r: MaterialRow): Material => ({
  id: r.id,
  name: r.name,
  kind: r.kind,
  thickness: r.thickness,
  grain: r.grain,
  priceCents: r.price_cents,
  color: r.color,
});
const fromMaterial = (m: Material, userId: string) => ({
  user_id: userId,
  id: m.id,
  name: m.name,
  kind: m.kind,
  thickness: m.thickness,
  grain: m.grain,
  price_cents: m.priceCents,
  color: m.color,
});

const toMethod = (r: MethodRow): Method => normalizeMethod({ ...r.spec, id: r.id, name: r.name });
function fromMethod(m: Method, userId: string) {
  const { id, name, ...spec } = m;
  return { user_id: userId, id, name, spec };
}

const CABINET_COLUMNS = 'id, project_id, name, method_id, design, rev, quantity, created_at, updated_at';

// ───────────────────────── errores ─────────────────────────

/** Convierte un error de Supabase en uno con un mensaje que se entienda. */
function fail(e: PostgrestError | Error | null | undefined, context: string): never {
  const msg = e?.message ?? '';
  if (/fetch|network|Load failed/i.test(msg)) throw new Error(`No hay conexión con el servidor (${context}). Comprueba la conexión a internet.`);
  if ((e as PostgrestError)?.code === 'PGRST301' || /JWT/i.test(msg)) throw new Error('La sesión ha caducado. Vuelve a entrar.');
  throw new Error(`No se ha podido ${context}. ${msg}`.trim());
}

async function userId(): Promise<string> {
  const { data } = await supabase().auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error('Tienes que entrar con tu cuenta.');
  return id;
}

// ───────────────────────── bibliotecas de partida ─────────────────────────

let libraryChecked: string | null = null;

/** Si la cuenta no tiene métodos (cuenta nueva), le copia los materiales y métodos de partida. Una vez por sesión. */
async function ensureLibrary() {
  const uid = await userId();
  if (libraryChecked === uid) return;
  const sb = supabase();
  const { count, error } = await sb.from('methods').select('id', { count: 'exact', head: true });
  if (error) fail(error, 'leer los métodos');
  if (!count) {
    const m = await sb.from('materials').upsert(PRESET_MATERIALS.map((x) => fromMaterial(x, uid)), { onConflict: 'user_id,id', ignoreDuplicates: true });
    if (m.error) fail(m.error, 'crear los materiales de partida');
    const r = await sb.from('methods').upsert(PRESET_METHODS.map((x) => fromMethod(x, uid)), { onConflict: 'user_id,id', ignoreDuplicates: true });
    if (r.error) fail(r.error, 'crear los métodos de partida');
  }
  libraryChecked = uid;
}

// ───────────────────────── capa de datos ─────────────────────────

export const cloudData: DataLayer = {
  async listProjects() {
    const { data, error } = await supabase()
      .from('projects')
      .select('id, name, created_at, updated_at, cabinets(count)')
      .order('updated_at', { ascending: false });
    if (error) fail(error, 'cargar los proyectos');
    return (data as (ProjectRow & { cabinets: { count: number }[] })[]).map((r) => ({ ...toProject(r), cabinetCount: r.cabinets[0]?.count ?? 0 }));
  },
  async getProject(id) {
    const { data, error } = await supabase().from('projects').select('id, name, created_at, updated_at').eq('id', id).maybeSingle();
    if (error) fail(error, 'cargar el proyecto');
    return data ? toProject(data as ProjectRow) : null;
  },
  async createProject(name) {
    const { data, error } = await supabase()
      .from('projects')
      .insert({ name: name.trim() || 'Proyecto sin nombre', user_id: await userId() })
      .select('id, name, created_at, updated_at')
      .single();
    if (error) fail(error, 'crear el proyecto');
    return toProject(data as ProjectRow);
  },
  async renameProject(id, name) {
    const clean = name.trim();
    if (!clean) return;
    const { data, error } = await supabase().from('projects').update({ name: clean }).eq('id', id).select('id');
    if (error) fail(error, 'cambiar el nombre');
    if (!data?.length) throw new NotFoundError('ese proyecto');
  },
  async deleteProject(id) {
    const { error } = await supabase().from('projects').delete().eq('id', id);
    if (error) fail(error, 'borrar el proyecto');
  },

  async listCabinets(projectId) {
    const { data, error } = await supabase().from('cabinets').select(CABINET_COLUMNS).eq('project_id', projectId).order('created_at');
    if (error) fail(error, 'cargar los muebles');
    // Un mueble dañado no debe impedir ver los demás.
    return (data as CabinetRow[]).flatMap((r) => {
      try {
        return [toCabinet(r)];
      } catch {
        return [];
      }
    });
  },
  async getCabinet(id) {
    const { data, error } = await supabase().from('cabinets').select(CABINET_COLUMNS).eq('id', id).maybeSingle();
    if (error) fail(error, 'cargar el mueble');
    return data ? toCabinet(data as CabinetRow) : null;
  },
  async createCabinet({ projectId, name, methodId, design, quantity = 1 }) {
    designSchema.parse(design);
    const { data, error } = await supabase()
      .from('cabinets')
      .insert({ user_id: await userId(), project_id: projectId, name: name.trim() || 'Mueble', method_id: methodId, design, quantity })
      .select(CABINET_COLUMNS)
      .single();
    if (error?.code === '23503') throw new NotFoundError('ese proyecto o ese método');
    if (error) fail(error, 'crear el mueble');
    return toCabinet(data as CabinetRow);
  },
  async saveCabinet(id, rev, patch) {
    if (patch.design && !designSchema.safeParse(patch.design).success) throw new Error('El diseño no es válido.');
    const { data, error } = await supabase().rpc('save_cabinet', { p_id: id, p_rev: rev, p_patch: patch });
    if (error?.code === 'MW409') throw new ConflictError();
    if (error?.code === 'MW404') throw new NotFoundError('ese mueble');
    if (error) fail(error, 'guardar el mueble');
    return data as number;
  },
  async deleteCabinet(id) {
    const { error } = await supabase().from('cabinets').delete().eq('id', id);
    if (error) fail(error, 'borrar el mueble');
  },

  async listMaterials() {
    await ensureLibrary();
    const { data, error } = await supabase().from('materials').select('id, name, kind, thickness, grain, price_cents, color').order('created_at');
    if (error) fail(error, 'cargar los materiales');
    return (data as MaterialRow[]).map(toMaterial).filter((m) => materialSchema.safeParse(m).success);
  },
  async saveMaterial(material) {
    const m = materialSchema.parse({ ...material, name: material.name.trim() });
    const { error } = await supabase().from('materials').upsert(fromMaterial(m, await userId()), { onConflict: 'user_id,id' });
    if (error) fail(error, 'guardar el material');
    return m;
  },
  async deleteMaterial(id) {
    const methods = await cloudData.listMethods();
    const users = methods.filter((m) =>
      [m.carcassMaterialId, m.back.mode !== 'none' ? m.back.materialId : null, m.frontEdgeMaterialId, m.fronts.materialId, m.fronts.edgeMaterialId, m.drawer.materialId, m.drawer.bottomMaterialId].includes(id),
    );
    if (users.length > 0) {
      throw new InUseError(`Lo usa${users.length > 1 ? 'n' : ''} ${users.map((m) => `«${m.name}»`).join(', ')}. Cambia ${users.length > 1 ? 'esos métodos' : 'ese método'} antes de borrarlo.`);
    }
    const { error } = await supabase().from('materials').delete().eq('id', id);
    if (error) fail(error, 'borrar el material');
  },
  async listMethods() {
    await ensureLibrary();
    const { data, error } = await supabase().from('methods').select('id, name, spec').order('created_at');
    if (error) fail(error, 'cargar los métodos');
    return (data as MethodRow[]).map(toMethod).filter((m) => methodSchema.safeParse(m).success);
  },
  async saveMethod(method) {
    const m = methodSchema.parse({ ...method, name: method.name.trim() });
    const { error } = await supabase().from('methods').upsert(fromMethod(m, await userId()), { onConflict: 'user_id,id' });
    if (error) fail(error, 'guardar el método');
    return m;
  },
  async deleteMethod(id) {
    const sb = supabase();
    const { count } = await sb.from('methods').select('id', { count: 'exact', head: true });
    if ((count ?? 0) <= 1) throw new InUseError('Tiene que quedar al menos un método.');
    const { error } = await sb.from('methods').delete().eq('id', id);
    // La base de datos impide borrar un método que usa algún mueble (ON DELETE RESTRICT).
    if (error?.code === '23001' || error?.code === '23503') {
      const used = await sb.from('cabinets').select('id', { count: 'exact', head: true }).eq('method_id', id);
      const n = used.count ?? 0;
      throw new InUseError(`Lo usa${n === 1 ? '' : 'n'} ${n} mueble${n === 1 ? '' : 's'}. Cámbiales el método antes de borrarlo.`);
    }
    if (error) fail(error, 'borrar el método');
  },
};

// ───────────────────────── subir los datos de este navegador ─────────────────────────

export interface ImportSummary {
  projects: number;
  cabinets: number;
  materials: number;
  methods: number;
}

/** ¿Hay proyectos guardados en este navegador (de antes de usar la nube)? */
export function localDataSummary(): ImportSummary | null {
  const s = readLocalState();
  if (!s || s.projects.length === 0) return null;
  return { projects: s.projects.length, cabinets: s.cabinets.length, materials: s.materials.length, methods: s.methods.length };
}

/**
 * Copia a la cuenta los proyectos, muebles, materiales y métodos guardados en este navegador.
 * No borra nada de la cuenta ni del navegador. Lo que ya exista en la cuenta con el mismo
 * identificador no se toca, así que se puede repetir sin duplicar.
 */
export async function importLocalData(): Promise<ImportSummary> {
  const s = readLocalState();
  if (!s) return { projects: 0, cabinets: 0, materials: 0, methods: 0 };
  const uid = await userId();
  const sb = supabase();
  const opts = { ignoreDuplicates: true } as const;

  const mats = await sb.from('materials').upsert(s.materials.map((m) => fromMaterial(m, uid)), { ...opts, onConflict: 'user_id,id' });
  if (mats.error) fail(mats.error, 'subir los materiales');
  const meths = await sb.from('methods').upsert(s.methods.map((m) => fromMethod(m, uid)), { ...opts, onConflict: 'user_id,id' });
  if (meths.error) fail(meths.error, 'subir los métodos');
  const projs = await sb
    .from('projects')
    .upsert(s.projects.map((p) => ({ id: p.id, user_id: uid, name: p.name, created_at: p.createdAt, updated_at: p.updatedAt })), { ...opts, onConflict: 'id' });
  if (projs.error) fail(projs.error, 'subir los proyectos');
  const cabs = await sb.from('cabinets').upsert(
    s.cabinets.map((c) => ({
      id: c.id,
      user_id: uid,
      project_id: c.projectId,
      name: c.name,
      method_id: c.methodId,
      design: c.design,
      quantity: c.quantity,
      created_at: c.createdAt,
      updated_at: c.updatedAt,
    })),
    { ...opts, onConflict: 'id' },
  );
  if (cabs.error) fail(cabs.error, 'subir los muebles');
  libraryChecked = null;
  return { projects: s.projects.length, cabinets: s.cabinets.length, materials: s.materials.length, methods: s.methods.length };
}
