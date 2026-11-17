import {
  designSchema,
  materialSchema,
  methodSchema,
  mm,
  newDesign,
  LEGACY_EURO_PRICES,
  normalizeMethod,
  PRESET_MATERIALS,
  PRESET_METHODS,
  setDivisions,
  setDrawerSize,
  setFront,
  setPlinth,
  type Material,
  type Method,
} from '@mw/engine';
import { ConflictError, InUseError, NotFoundError, type Cabinet, type DataLayer, type Project } from './types';

/**
 * Capa de datos local (localStorage). Misma interfaz que tendrá la de Supabase.
 * Si el navegador bloquea el almacenamiento, funciona en memoria y lo avisa `storageAvailable`.
 */

const KEY = 'mueblesweb:v1';

/**
 * Versión del formato guardado. Al subirla, `migrate` pone al día los datos antiguos.
 * 1: fase 1 · 2: métodos con frentes y cajones, tablero de 16 para cajones · 3: precios en pesos.
 */
const SCHEMA = 3;

interface State {
  schema?: number;
  projects: Project[];
  cabinets: Cabinet[];
  materials: Material[];
  methods: Method[];
}

let memory: State | null = null;
export let storageAvailable = true;

const now = () => new Date().toISOString();
const uid = () => globalThis.crypto.randomUUID();

function seed(): State {
  const t = now();
  const project: Project = { id: uid(), name: 'Cocina de ejemplo', createdAt: t, updatedAt: t };
  const d0 = newDesign({ w: mm(600), h: mm(720), d: mm(560) });
  const base: Cabinet = {
    id: uid(),
    projectId: project.id,
    name: 'Bajo fregadero 600',
    methodId: PRESET_METHODS[0]!.id,
    design: setDivisions(d0, d0.root.id, 'y', 1),
    rev: 1,
    quantity: 1,
    createdAt: t,
    updatedAt: t,
  };
  const t0 = newDesign({ w: mm(900), h: mm(2000), d: mm(580) });
  let tall = setDivisions(t0, t0.root.id, 'x', 1);
  const [left, right] = tall.root.split!.children;
  tall = setDivisions(tall, left!.id, 'y', 4);
  tall = setDivisions(tall, right!.id, 'y', 1);
  const despensa: Cabinet = {
    id: uid(),
    projectId: project.id,
    name: 'Despensa 900',
    methodId: PRESET_METHODS[0]!.id,
    design: tall,
    rev: 1,
    quantity: 1,
    createdAt: t,
    updatedAt: t,
  };
  const c0 = newDesign({ w: mm(600), h: mm(720), d: mm(560) });
  let cajonera = setPlinth(c0, { height: mm(100), setback: mm(50) });
  cajonera = setFront(cajonera, c0.root.id, { kind: 'drawers', mount: 'overlay', sizes: [null, null, null] });
  cajonera = setDrawerSize(cajonera, c0.root.id, 0, mm(140));
  const drawers: Cabinet = {
    id: uid(),
    projectId: project.id,
    name: 'Cajonera 600',
    methodId: PRESET_METHODS[0]!.id,
    design: cajonera,
    rev: 1,
    quantity: 1,
    createdAt: t,
    updatedAt: t,
  };
  base.design = setFront(base.design, base.design.root.id, { kind: 'door', leaves: 2, hinge: 'left', mount: 'overlay' });
  base.design = setPlinth(base.design, { height: mm(100), setback: mm(50) });
  return {
    schema: SCHEMA,
    projects: [project],
    cabinets: [base, drawers, despensa],
    materials: structuredClone(PRESET_MATERIALS),
    methods: structuredClone(PRESET_METHODS),
  };
}

/** Pone al día datos guardados con una versión anterior. No borra nada del usuario. */
function migrate(s: State): State {
  if ((s.schema ?? 1) < 2) {
    // Materiales nuevos de partida que usan los cajones por defecto.
    for (const m of PRESET_MATERIALS) if (!s.materials.some((x) => x.id === m.id)) s.materials.push(structuredClone(m));
    s.methods = s.methods.map((m) => normalizeMethod(m));
  }
  if ((s.schema ?? 1) < 3) {
    // Paso de euros a pesos: los materiales de partida que nadie tocó quedan sin precio.
    for (const m of s.materials) if (LEGACY_EURO_PRICES[m.id] === m.priceCents) m.priceCents = 0;
  }
  s.schema = SCHEMA;
  // Bibliotecas dañadas: se descartan solo las entradas inválidas.
  s.materials = s.materials.filter((m) => materialSchema.safeParse(m).success);
  s.methods = s.methods.filter((m) => methodSchema.safeParse(m).success);
  if (s.methods.length === 0) s.methods = structuredClone(PRESET_METHODS);
  return s;
}

/**
 * Lee lo guardado en este navegador sin crear los datos de ejemplo.
 * Lo usa la subida a la nube. Devuelve null si no hay nada guardado.
 */
export function readLocalState(): Pick<State, 'projects' | 'cabinets' | 'materials' | 'methods'> | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as State;
    parsed.cabinets = parsed.cabinets.filter((c) => designSchema.safeParse(c.design).success);
    return structuredClone(migrate(parsed));
  } catch {
    return null;
  }
}

function load(): State {
  if (memory) return memory;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    storageAvailable = false;
  }
  let state: State | null = null;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as State;
      // Un diseño corrupto no debe tumbar la app: se descarta ese mueble.
      parsed.cabinets = parsed.cabinets.filter((c) => designSchema.safeParse(c.design).success);
      const before = parsed.schema;
      state = migrate(parsed);
      if (before !== SCHEMA) {
        memory = state;
        persist();
      }
    } catch {
      state = null;
    }
  }
  memory = state ?? seed();
  if (!state) persist();
  return memory;
}

function persist() {
  if (!memory) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(memory));
    storageAvailable = true;
  } catch {
    storageAvailable = false;
  }
}

/** Otra pestaña guardó: olvidar la copia en memoria para leer la nueva. */
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) memory = null;
  });
}

const clone = <T,>(v: T): T => structuredClone(v);
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

function touchProject(s: State, projectId: string) {
  const p = s.projects.find((x) => x.id === projectId);
  if (p) p.updatedAt = now();
}

export const localData: DataLayer = {
  async listProjects() {
    await tick();
    const s = load();
    return s.projects
      .map((p) => ({ ...clone(p), cabinetCount: s.cabinets.filter((c) => c.projectId === p.id).length }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  async getProject(id) {
    await tick();
    const p = load().projects.find((x) => x.id === id);
    return p ? clone(p) : null;
  },
  async createProject(name) {
    await tick();
    const s = load();
    const t = now();
    const p: Project = { id: uid(), name: name.trim() || 'Proyecto sin nombre', createdAt: t, updatedAt: t };
    s.projects.push(p);
    persist();
    return clone(p);
  },
  async renameProject(id, name) {
    await tick();
    const s = load();
    const p = s.projects.find((x) => x.id === id);
    if (!p) throw new NotFoundError('ese proyecto');
    p.name = name.trim() || p.name;
    p.updatedAt = now();
    persist();
  },
  async deleteProject(id) {
    await tick();
    const s = load();
    s.projects = s.projects.filter((p) => p.id !== id);
    s.cabinets = s.cabinets.filter((c) => c.projectId !== id);
    persist();
  },

  async listCabinets(projectId) {
    await tick();
    return clone(load().cabinets.filter((c) => c.projectId === projectId)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },
  async getCabinet(id) {
    await tick();
    const c = load().cabinets.find((x) => x.id === id);
    return c ? clone(c) : null;
  },
  async createCabinet({ projectId, name, methodId, design, quantity = 1 }) {
    await tick();
    const s = load();
    if (!s.projects.some((p) => p.id === projectId)) throw new NotFoundError('ese proyecto');
    const t = now();
    const c: Cabinet = { id: uid(), projectId, name: name.trim() || 'Mueble', methodId, design, rev: 1, quantity, createdAt: t, updatedAt: t };
    s.cabinets.push(c);
    touchProject(s, projectId);
    persist();
    return clone(c);
  },
  async saveCabinet(id, rev, patch) {
    await tick();
    memory = null; // releer: otra pestaña pudo guardar
    const s = load();
    const c = s.cabinets.find((x) => x.id === id);
    if (!c) throw new NotFoundError('ese mueble');
    if (c.rev !== rev) throw new ConflictError();
    if (patch.design && !designSchema.safeParse(patch.design).success) throw new Error('El diseño no es válido.');
    Object.assign(c, clone(patch), { rev: c.rev + 1, updatedAt: now() });
    touchProject(s, c.projectId);
    persist();
    return c.rev;
  },
  async deleteCabinet(id) {
    await tick();
    const s = load();
    const c = s.cabinets.find((x) => x.id === id);
    s.cabinets = s.cabinets.filter((x) => x.id !== id);
    if (c) touchProject(s, c.projectId);
    persist();
  },

  async listMaterials() {
    await tick();
    return clone(load().materials);
  },
  async saveMaterial(material) {
    await tick();
    const s = load();
    const m = materialSchema.parse({ ...material, name: material.name.trim() });
    const i = s.materials.findIndex((x) => x.id === m.id);
    if (i >= 0) s.materials[i] = m;
    else s.materials.push(m);
    persist();
    return clone(m);
  },
  async deleteMaterial(id) {
    await tick();
    const s = load();
    const users = s.methods.filter((m) =>
      [m.carcassMaterialId, m.back.mode !== 'none' ? m.back.materialId : null, m.frontEdgeMaterialId, m.fronts.materialId, m.fronts.edgeMaterialId, m.drawer.materialId, m.drawer.bottomMaterialId].includes(id),
    );
    if (users.length > 0) {
      throw new InUseError(`Lo usa${users.length > 1 ? 'n' : ''} ${users.map((m) => `«${m.name}»`).join(', ')}. Cambia ${users.length > 1 ? 'esos métodos' : 'ese método'} antes de borrarlo.`);
    }
    s.materials = s.materials.filter((m) => m.id !== id);
    persist();
  },
  async listMethods() {
    await tick();
    return clone(load().methods);
  },
  async saveMethod(method) {
    await tick();
    const s = load();
    const m = methodSchema.parse({ ...method, name: method.name.trim() });
    const i = s.methods.findIndex((x) => x.id === m.id);
    if (i >= 0) s.methods[i] = m;
    else s.methods.push(m);
    persist();
    return clone(m);
  },
  async deleteMethod(id) {
    await tick();
    const s = load();
    if (s.methods.length <= 1) throw new InUseError('Tiene que quedar al menos un método.');
    const used = s.cabinets.filter((c) => c.methodId === id).length;
    if (used > 0) throw new InUseError(`Lo usa${used > 1 ? 'n' : ''} ${used} mueble${used > 1 ? 's' : ''}. Cámbiales el método antes de borrarlo.`);
    s.methods = s.methods.filter((m) => m.id !== id);
    persist();
  },
};
