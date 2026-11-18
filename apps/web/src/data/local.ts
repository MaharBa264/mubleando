import {
  DEFAULT_HARDWARE_CHOICE,
  designSchema,
  hardwareSchema,
  PRESET_HARDWARE,
  materialSchema,
  methodSchema,
  LEGACY_EURO_PRICES,
  normalizeMethod,
  PRESET_MATERIALS,
  PRESET_METHODS,
  REFERENCE_MATERIALS,
  mm,
  rectRoom,
  roomPlanSchema,
  templateById,
  type Hardware,
  type Material,
  type Method,
} from '@mw/engine';
import { ConflictError, InUseError, NotFoundError, type Cabinet, type DataLayer, type Project, type Room } from './types';

/**
 * Capa de datos local (localStorage). Misma interfaz que tendrá la de Supabase.
 * Si el navegador bloquea el almacenamiento, funciona en memoria y lo avisa `storageAvailable`.
 */

const KEY = 'mueblesweb:v1';

/**
 * Versión del formato guardado. Al subirla, `migrate` pone al día los datos antiguos.
 * 1: fase 1 · 2: métodos con frentes y cajones, tablero de 16 para cajones · 3: precios en pesos · 4: ambientes · 5: herrajes.
 */
const SCHEMA = 5;

interface State {
  schema?: number;
  projects: Project[];
  cabinets: Cabinet[];
  rooms: Room[];
  hardware: Hardware[];
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
  // Muebles de ejemplo hechos con las plantillas (ver packages/engine/src/templates.ts).
  const ejemplos: [string, string, number?][] = [
    ['bajo-pileta', 'Bajo pileta 800'],
    ['bajo-cajonera', 'Cajonera 450'],
    ['bajo-mixto', 'Bajo con cajón 600'],
    ['alacena', 'Alacena 800'],
    ['columna', 'Columna 600'],
  ];
  const cabinets: Cabinet[] = ejemplos.map(([templateId, name]) => {
    const tpl = templateById(templateId)!;
    return {
      id: uid(),
      projectId: project.id,
      name,
      methodId: PRESET_METHODS[0]!.id,
      design: tpl.build(tpl.size),
      rev: 1,
      quantity: 1,
      createdAt: t,
      updatedAt: t,
    };
  });
  // Un ambiente de ejemplo: cocina de 3,20 × 2,60 con ventana sobre la pileta y puerta, y los
  // muebles colocados contra la pared de arriba (la alacena, colgada a 1,45 m).
  const plan = rectRoom(mm(3200), mm(2600));
  const [c0, , c2] = plan.corners;
  plan.openings = [
    { id: uid(), wallId: c0!.id, kind: 'window', offset: mm(1050), width: mm(1000), height: mm(1100), sill: mm(1000) },
    { id: uid(), wallId: c2!.id, kind: 'door', offset: mm(300), width: mm(800), height: mm(2050), sill: 0 },
  ];
  const byName = (n: string) => cabinets.find((c) => c.name === n)!.id;
  plan.placements = [
    ['Columna 600', 0, 0],
    ['Cajonera 450', 600, 0],
    ['Bajo pileta 800', 1050, 0],
    ['Bajo con cajón 600', 1850, 0],
    ['Alacena 800', 2400, 1450],
  ].map(([name, x, elevation]) => ({ id: uid(), cabinetId: byName(name as string), x: mm(x as number), y: 0, rotation: 0, elevation: mm(elevation as number) }));
  const room: Room = { id: uid(), projectId: project.id, name: 'Cocina', plan, rev: 1, createdAt: t, updatedAt: t };
  return {
    schema: SCHEMA,
    projects: [project],
    cabinets,
    rooms: [room],
    hardware: structuredClone(PRESET_HARDWARE),
    materials: structuredClone(PRESET_MATERIALS),
    methods: structuredClone(PRESET_METHODS),
  };
}

/** Pone al día datos guardados con una versión anterior. No borra nada del usuario. */
function migrate(s: State): State {
  if ((s.schema ?? 1) < 2) {
    // Materiales nuevos de partida que usan los cajones por defecto.
    for (const m of REFERENCE_MATERIALS) if (!s.materials.some((x) => x.id === m.id)) s.materials.push(structuredClone(m));
    s.methods = s.methods.map((m) => normalizeMethod(m));
  }
  if ((s.schema ?? 1) < 3) {
    // Paso de euros a pesos: los materiales de partida que nadie tocó quedan sin precio.
    for (const m of s.materials) if (LEGACY_EURO_PRICES[m.id] === m.priceCents) m.priceCents = 0;
  }
  s.rooms = (s.rooms ?? []).filter((r) => roomPlanSchema.safeParse(r.plan).success);
  if ((s.schema ?? 1) < 5) {
    // Herrajes de partida y, en los métodos argentinos de partida, los herrajes por defecto.
    s.hardware = structuredClone(PRESET_HARDWARE);
    s.methods = s.methods.map((m) => (m.id.startsWith('ar-18-') && !m.hardware ? { ...m, hardware: { ...DEFAULT_HARDWARE_CHOICE } } : m));
  }
  s.hardware = (s.hardware ?? []).filter((h) => hardwareSchema.safeParse(h).success);
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
export function readLocalState(): Pick<State, 'projects' | 'cabinets' | 'rooms' | 'materials' | 'methods'> | null {
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
    s.rooms = s.rooms.filter((r) => r.projectId !== id);
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

  async listRooms(projectId) {
    await tick();
    return clone(load().rooms.filter((r) => r.projectId === projectId)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },
  async getRoom(id) {
    await tick();
    const r = load().rooms.find((x) => x.id === id);
    return r ? clone(r) : null;
  },
  async createRoom({ projectId, name, plan }) {
    await tick();
    const s = load();
    if (!s.projects.some((p) => p.id === projectId)) throw new NotFoundError('ese proyecto');
    roomPlanSchema.parse(plan);
    const t = now();
    const r: Room = { id: uid(), projectId, name: name.trim() || 'Ambiente', plan, rev: 1, createdAt: t, updatedAt: t };
    s.rooms.push(r);
    touchProject(s, projectId);
    persist();
    return clone(r);
  },
  async saveRoom(id, rev, patch) {
    await tick();
    memory = null;
    const s = load();
    const r = s.rooms.find((x) => x.id === id);
    if (!r) throw new NotFoundError('ese ambiente');
    if (r.rev !== rev) throw new ConflictError();
    if (patch.plan && !roomPlanSchema.safeParse(patch.plan).success) throw new Error('La planta no es válida.');
    Object.assign(r, clone(patch), { rev: r.rev + 1, updatedAt: now() });
    touchProject(s, r.projectId);
    persist();
    return r.rev;
  },
  async deleteRoom(id) {
    await tick();
    const s = load();
    const r = s.rooms.find((x) => x.id === id);
    s.rooms = s.rooms.filter((x) => x.id !== id);
    if (r) touchProject(s, r.projectId);
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
  async listHardware() {
    await tick();
    return clone(load().hardware);
  },
  async saveHardware(hw) {
    await tick();
    const s = load();
    const h = hardwareSchema.parse({ ...hw, name: hw.name.trim() });
    const i = s.hardware.findIndex((x) => x.id === h.id);
    if (i >= 0) s.hardware[i] = h;
    else s.hardware.push(h);
    persist();
    return clone(h);
  },
  async deleteHardware(id) {
    await tick();
    const s = load();
    const users = s.methods.filter((m) => m.hardware && Object.values(m.hardware).includes(id));
    if (users.length > 0) throw new InUseError(`Lo usa${users.length > 1 ? 'n' : ''} por defecto ${users.map((m) => `«${m.name}»`).join(', ')}. Cambiá ese herraje en el método antes de borrarlo.`);
    s.hardware = s.hardware.filter((h) => h.id !== id);
    persist();
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
