import type { Design, Material, Method, RoomPlan } from '@mw/engine';

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectSummary extends Project {
  cabinetCount: number;
}

export interface Cabinet {
  id: string;
  projectId: string;
  name: string;
  methodId: string;
  design: Design;
  /** Se sube en cada guardado; sirve para detectar que otro dispositivo guardó antes. */
  rev: number;
  quantity: number;
  createdAt: string;
  updatedAt: string;
}

export type CabinetPatch = Partial<Pick<Cabinet, 'design' | 'name' | 'methodId' | 'quantity'>>;

/** Un ambiente del proyecto: su planta (paredes, aberturas) y los muebles colocados. */
export interface Room {
  id: string;
  projectId: string;
  name: string;
  plan: RoomPlan;
  /** Se sube en cada guardado, como en los muebles. */
  rev: number;
  createdAt: string;
  updatedAt: string;
}

export type RoomPatch = Partial<Pick<Room, 'name' | 'plan'>>;

export class ConflictError extends Error {
  constructor() {
    super('Este mueble se guardó desde otro sitio mientras lo editabas.');
    this.name = 'ConflictError';
  }
}

export class NotFoundError extends Error {
  constructor(what: string) {
    super(`No existe ${what}.`);
    this.name = 'NotFoundError';
  }
}

/** No se puede borrar algo porque otra cosa lo usa. El mensaje dice qué. */
export class InUseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InUseError';
  }
}

/**
 * Contrato de datos. Hoy lo cumple `localData` (navegador); mañana una versión con Supabase
 * con las mismas firmas, sin tocar las pantallas.
 */
export interface DataLayer {
  listProjects(): Promise<ProjectSummary[]>;
  getProject(id: string): Promise<Project | null>;
  createProject(name: string): Promise<Project>;
  renameProject(id: string, name: string): Promise<void>;
  deleteProject(id: string): Promise<void>;

  listCabinets(projectId: string): Promise<Cabinet[]>;
  getCabinet(id: string): Promise<Cabinet | null>;
  createCabinet(input: { projectId: string; name: string; methodId: string; design: Design; quantity?: number }): Promise<Cabinet>;
  /** Guarda si `rev` coincide; devuelve la nueva rev o lanza ConflictError. */
  saveCabinet(id: string, rev: number, patch: CabinetPatch): Promise<number>;
  deleteCabinet(id: string): Promise<void>;

  listRooms(projectId: string): Promise<Room[]>;
  getRoom(id: string): Promise<Room | null>;
  createRoom(input: { projectId: string; name: string; plan: RoomPlan }): Promise<Room>;
  /** Como saveCabinet: guarda si `rev` coincide y devuelve la nueva rev; si no, ConflictError. */
  saveRoom(id: string, rev: number, patch: RoomPatch): Promise<number>;
  deleteRoom(id: string): Promise<void>;

  listMaterials(): Promise<Material[]>;
  /** Crea o actualiza (por id) un tablero o canto. */
  saveMaterial(material: Material): Promise<Material>;
  /** Lanza InUseError si algún método lo usa. */
  deleteMaterial(id: string): Promise<void>;
  listMethods(): Promise<Method[]>;
  /** Crea o actualiza (por id) un método de fabricación. */
  saveMethod(method: Method): Promise<Method>;
  /** Lanza InUseError si algún mueble lo usa o si es el último. */
  deleteMethod(id: string): Promise<void>;
}
