import { designSchema, mm, newDesign, PRESET_MATERIALS, PRESET_METHODS, setDivisions, type Material, type Method } from '@mw/engine';
import { ConflictError, NotFoundError, type Cabinet, type DataLayer, type Project } from './types';

/**
 * Capa de datos local (localStorage). Misma interfaz que tendrá la de Supabase.
 * Si el navegador bloquea el almacenamiento, funciona en memoria y lo avisa `storageAvailable`.
 */

const KEY = 'mueblesweb:v1';

interface State {
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
  return { projects: [project], cabinets: [base, despensa], materials: PRESET_MATERIALS, methods: PRESET_METHODS };
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
      state = parsed;
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
  async listMethods() {
    await tick();
    return clone(load().methods);
  },
};
