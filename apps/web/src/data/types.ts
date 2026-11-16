import type { Design, Material, Method } from '@mw/engine';

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

  listMaterials(): Promise<Material[]>;
  listMethods(): Promise<Method[]>;
}
