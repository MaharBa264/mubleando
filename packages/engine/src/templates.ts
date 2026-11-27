import { defaultIdGen, newDesign, setChildSize, setDivisions, setDrawerSize, setFront, setPlinth, type IdGen } from './edit';
import type { Design, DoorFront, DrawerFront } from './types';
import { mm, type Len } from './units';

/**
 * Plantillas de muebles: diseños de partida para no empezar siempre desde una caja vacía.
 * Cada plantilla tiene unas medidas típicas (en Argentina) y se construye con las medidas que
 * elija el usuario. Todo lo que hace una plantilla se puede cambiar después en el editor.
 */
export interface CabinetTemplate {
  id: string;
  name: string;
  /** Una frase: qué es y para qué sirve. */
  description: string;
  group: 'bajo' | 'alto' | 'columna' | 'otros';
  size: { w: Len; h: Len; d: Len };
  build: (size: Design['size'], idGen?: IdGen) => Design;
}

const ZOCALO = { height: mm(100), setback: mm(50) };
const door = (leaves: 1 | 2, hinge: 'left' | 'right' = 'left'): DoorFront => ({ kind: 'door', leaves, hinge, mount: 'overlay' });
const drawers = (sizes: (Len | null)[]): DrawerFront => ({ kind: 'drawers', mount: 'overlay', sizes });
/** Dos hojas si el hueco es ancho; una si no (las puertas de más de 600 mm pesan y se tuercen). */
const doorsFor = (w: Len) => door(w > mm(600) ? 2 : 1);

/** Caja con zócalo, un estante y puerta(s). */
function bajoPuertas(size: Design['size'], idGen: IdGen = defaultIdGen) {
  let d = setPlinth(newDesign(size, idGen), ZOCALO);
  d = setDivisions(d, d.root.id, 'y', 1, idGen);
  return setFront(d, d.root.id, doorsFor(size.w));
}

export const TEMPLATES: CabinetTemplate[] = [
  {
    id: 'bajo-puertas',
    name: 'Bajo con puertas',
    description: 'Bajo mesada con zócalo, un estante y una puerta (dos si mide más de 60 cm).',
    group: 'bajo',
    size: { w: mm(600), h: mm(860), d: mm(560) },
    build: bajoPuertas,
  },
  {
    id: 'bajo-cajonera',
    name: 'Cajonera',
    description: 'Bajo mesada con zócalo y tres cajones; el de arriba, bajo, para cubiertos.',
    group: 'bajo',
    size: { w: mm(450), h: mm(860), d: mm(560) },
    build: (size, idGen = defaultIdGen) => {
      let d = setPlinth(newDesign(size, idGen), ZOCALO);
      d = setFront(d, d.root.id, drawers([null, null, null]));
      return setDrawerSize(d, d.root.id, 0, mm(150));
    },
  },
  {
    id: 'bajo-mixto',
    name: 'Bajo con cajón y puerta',
    description: 'Un cajón arriba y, debajo, puerta(s) con un estante.',
    group: 'bajo',
    size: { w: mm(600), h: mm(860), d: mm(560) },
    build: (size, idGen = defaultIdGen) => {
      let d = setPlinth(newDesign(size, idGen), ZOCALO);
      d = setDivisions(d, d.root.id, 'y', 1, idGen);
      const [abajo, arriba] = d.root.split!.children;
      d = setChildSize(d, d.root.id, 1, mm(150));
      d = setFront(d, arriba!.id, drawers([null]));
      d = setDivisions(d, abajo!.id, 'y', 1, idGen);
      return setFront(d, abajo!.id, doorsFor(size.w));
    },
  },
  {
    id: 'bajo-pileta',
    name: 'Bajo pileta',
    description: 'Bajo mesada para la pileta: zócalo y puertas, sin estante para dejar lugar a los caños.',
    group: 'bajo',
    size: { w: mm(800), h: mm(860), d: mm(560) },
    build: (size, idGen = defaultIdGen) => {
      const d = setPlinth(newDesign(size, idGen), ZOCALO);
      return setFront(d, d.root.id, doorsFor(size.w));
    },
  },
  {
    id: 'bajo-esquinero-ciego',
    name: 'Esquinero ciego',
    description: 'Bajo mesada de esquina con panel ciego, puerta y rinconero extraíble.',
    group: 'bajo',
    size: { w: mm(1000), h: mm(860), d: mm(560) },
    build: (size, idGen = defaultIdGen) => {
      const d = setPlinth(newDesign(size, idGen), ZOCALO);
      return {
        ...d,
        blindCorner: {
          blindSide: 'left',
          doorWidth: Math.min(mm(450), Math.round(size.w * 0.45)),
          hardwareId: 'hw-rinconero-extraible-450',
        },
      };
    },
  },
  {
    id: 'alacena',
    name: 'Alacena',
    description: 'Mueble alto de pared con un estante y puerta(s).',
    group: 'alto',
    size: { w: mm(800), h: mm(700), d: mm(320) },
    build: (size, idGen = defaultIdGen) => {
      let d = newDesign(size, idGen);
      d = setDivisions(d, d.root.id, 'y', 1, idGen);
      return setFront(d, d.root.id, doorsFor(size.w));
    },
  },
  {
    id: 'alacena-abierta',
    name: 'Alacena abierta',
    description: 'Mueble alto de pared sin puertas, con un estante.',
    group: 'alto',
    size: { w: mm(600), h: mm(400), d: mm(320) },
    build: (size, idGen = defaultIdGen) => {
      const d = newDesign(size, idGen);
      return setDivisions(d, d.root.id, 'y', 1, idGen);
    },
  },
  {
    id: 'columna',
    name: 'Columna / despensa',
    description: 'Mueble alto hasta el techo: puerta abajo con dos estantes y puerta arriba con uno.',
    group: 'columna',
    size: { w: mm(600), h: mm(2100), d: mm(560) },
    build: (size, idGen = defaultIdGen) => {
      let d = setPlinth(newDesign(size, idGen), ZOCALO);
      d = setDivisions(d, d.root.id, 'y', 1, idGen);
      const [abajo, arriba] = d.root.split!.children;
      d = setChildSize(d, d.root.id, 1, mm(600));
      d = setDivisions(d, abajo!.id, 'y', 2, idGen);
      d = setFront(d, abajo!.id, doorsFor(size.w));
      d = setDivisions(d, arriba!.id, 'y', 1, idGen);
      return setFront(d, arriba!.id, doorsFor(size.w));
    },
  },
  {
    id: 'placard',
    name: 'Placard',
    description: 'Dos cuerpos: a la izquierda estantes, a la derecha espacio para colgar; una puerta en cada uno.',
    group: 'columna',
    size: { w: mm(1200), h: mm(2400), d: mm(600) },
    build: (size, idGen = defaultIdGen) => {
      let d = setPlinth(newDesign(size, idGen), { height: mm(80), setback: mm(30) });
      d = setDivisions(d, d.root.id, 'x', 1, idGen);
      const [izq, der] = d.root.split!.children;
      d = setDivisions(d, izq!.id, 'y', 5, idGen);
      d = setFront(d, izq!.id, door(1, 'left'));
      // Derecha: un estante alto (maletero) y espacio libre para colgar debajo.
      d = setDivisions(d, der!.id, 'y', 1, idGen);
      d = setChildSize(d, der!.id, 1, mm(400));
      return setFront(d, der!.id, door(1, 'right'));
    },
  },
  {
    id: 'estanteria',
    name: 'Estantería abierta',
    description: 'Biblioteca sin puertas con cuatro estantes.',
    group: 'otros',
    size: { w: mm(800), h: mm(1800), d: mm(300) },
    build: (size, idGen = defaultIdGen) => {
      const d = newDesign(size, idGen);
      return setDivisions(d, d.root.id, 'y', 4, idGen);
    },
  },
  {
    id: 'vacio',
    name: 'Caja vacía',
    description: 'Solo la caja, para armar el interior a mano.',
    group: 'otros',
    size: { w: mm(600), h: mm(720), d: mm(560) },
    build: (size, idGen = defaultIdGen) => newDesign(size, idGen),
  },
];

export const templateById = (id: string) => TEMPLATES.find((t) => t.id === id);
