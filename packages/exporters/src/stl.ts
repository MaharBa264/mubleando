import type { Box, Part } from '@mw/engine';

/**
 * Exportación STL para impresión 3D (maquetas).
 *
 * Todas las piezas del motor son prismas rectos alineados con los ejes, así que cada una
 * se convierte en 12 triángulos. El archivo es STL binario, en milímetros, con el eje Z
 * hacia arriba (lo que esperan los programas de laminado como PrusaSlicer, Cura u Orca).
 *
 * Cambio de ejes respecto al motor:
 *   motor x (ancho)        → STL X
 *   motor z (hacia frente) → STL −Y (el frente del mueble mira hacia −Y, como en una vista frontal)
 *   motor y (alto)         → STL Z
 */

export interface StlOptions {
  /**
   * Escala de impresión. 1 = tamaño real, 0.1 = escala 1:10, 0.05 = escala 1:20.
   * Por defecto 0.1.
   */
  scale?: number;
  /**
   * Espesor mínimo impreso en mm. Las piezas más finas (por ejemplo una trasera de 3 mm
   * a escala 1:10 = 0,3 mm) se engordan hasta este valor para que la impresora las pueda hacer.
   * 0 = no tocar. Por defecto 0,8 mm (dos pasadas de una boquilla de 0,4 mm).
   */
  minThicknessMm?: number;
}

/** Qué hacer con los cajones (piezas con `assembly.kind === 'drawer'`) al exportar el mueble completo. */
export type DrawerMode =
  /** Dentro del mueble, en su sitio, en el mismo archivo. */
  | 'integrated'
  /** Cada cajón montado, en su propio archivo, para imprimirlo aparte y meterlo luego. */
  | 'separate'
  /** Cada pieza del cajón suelta y tumbada, para imprimirlas y pegarlas. */
  | 'pieces';

export interface StlFile {
  /** Nombre de archivo sugerido, sin carpetas. */
  name: string;
  data: Uint8Array<ArrayBuffer>;
}

export interface StlExport {
  files: StlFile[];
  /** Texto de ayuda que acompaña al ZIP (qué es cada archivo y sus medidas reales). */
  readme: string;
  /** Avisos para mostrar al usuario (piezas engordadas, etc.). */
  warnings: string[];
  /** Medidas del mueble completo ya impreso, en mm (sin cajones si van aparte). */
  printedSize: { x: number; y: number; z: number } | null;
}

/** Caja en el espacio de impresión, en mm ya escalados. */
export interface PBox {
  x0: number;
  y0: number;
  z0: number;
  x1: number;
  y1: number;
  z1: number;
}

const DEFAULTS = { scale: 0.1, minThicknessMm: 0.8 };

/** Centésimas de mm (unidad del motor) → mm impresos. */
const toPrinted = (v: number, scale: number) => (v / 100) * scale;

/** Caja del motor colocada en el espacio de impresión (ver cambio de ejes arriba). */
function placedBox(b: Box, scale: number): PBox {
  return {
    x0: toPrinted(b.x, scale),
    x1: toPrinted(b.x + b.dx, scale),
    y0: -toPrinted(b.z + b.dz, scale),
    y1: -toPrinted(b.z, scale),
    z0: toPrinted(b.y, scale),
    z1: toPrinted(b.y + b.dy, scale),
  };
}

/** Pieza tumbada en el origen: la medida mayor en X, la siguiente en Y y el espesor en Z. */
function flatBox(b: Box, scale: number): PBox {
  const [a, w, t] = [b.dx, b.dy, b.dz].sort((p, q) => q - p) as [number, number, number];
  return { x0: 0, y0: 0, z0: 0, x1: toPrinted(a, scale), y1: toPrinted(w, scale), z1: toPrinted(t, scale) };
}

/** Engorda (simétricamente) cada lado de la caja que quede por debajo del mínimo. Devuelve si cambió algo. */
function thicken(b: PBox, min: number): boolean {
  if (min <= 0) return false;
  let changed = false;
  for (const [lo, hi] of [
    ['x0', 'x1'],
    ['y0', 'y1'],
    ['z0', 'z1'],
  ] as const) {
    const size = b[hi] - b[lo];
    if (size < min) {
      const grow = (min - size) / 2;
      b[lo] -= grow;
      b[hi] += grow;
      changed = true;
    }
  }
  return changed;
}

/** Lleva el conjunto de cajas a que su esquina mínima quede en (0, 0, 0): apoyado en la cama de impresión. */
function toOrigin(boxes: PBox[]): PBox[] {
  if (boxes.length === 0) return boxes;
  const mx = Math.min(...boxes.map((b) => b.x0));
  const my = Math.min(...boxes.map((b) => b.y0));
  const mz = Math.min(...boxes.map((b) => b.z0));
  return boxes.map((b) => ({ x0: b.x0 - mx, x1: b.x1 - mx, y0: b.y0 - my, y1: b.y1 - my, z0: b.z0 - mz, z1: b.z1 - mz }));
}

function sizeOf(boxes: PBox[]) {
  if (boxes.length === 0) return null;
  const r = (v: number) => Math.round(v * 100) / 100;
  return {
    x: r(Math.max(...boxes.map((b) => b.x1)) - Math.min(...boxes.map((b) => b.x0))),
    y: r(Math.max(...boxes.map((b) => b.y1)) - Math.min(...boxes.map((b) => b.y0))),
    z: r(Math.max(...boxes.map((b) => b.z1)) - Math.min(...boxes.map((b) => b.z0))),
  };
}

type Tri = [n: [number, number, number], a: [number, number, number], b: [number, number, number], c: [number, number, number]];

/** 12 triángulos de una caja, con las normales hacia fuera y los vértices en sentido antihorario vistos desde fuera. */
export function boxTriangles(b: PBox): Tri[] {
  const { x0, y0, z0, x1, y1, z1 } = b;
  return [
    // abajo (−Z)
    [[0, 0, -1], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]],
    [[0, 0, -1], [x0, y0, z0], [x1, y1, z0], [x1, y0, z0]],
    // arriba (+Z)
    [[0, 0, 1], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1]],
    [[0, 0, 1], [x0, y0, z1], [x1, y1, z1], [x0, y1, z1]],
    // −Y
    [[0, -1, 0], [x0, y0, z0], [x1, y0, z0], [x1, y0, z1]],
    [[0, -1, 0], [x0, y0, z0], [x1, y0, z1], [x0, y0, z1]],
    // +Y
    [[0, 1, 0], [x0, y1, z0], [x0, y1, z1], [x1, y1, z1]],
    [[0, 1, 0], [x0, y1, z0], [x1, y1, z1], [x1, y1, z0]],
    // −X
    [[-1, 0, 0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1]],
    [[-1, 0, 0], [x0, y0, z0], [x0, y1, z1], [x0, y1, z0]],
    // +X
    [[1, 0, 0], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]],
    [[1, 0, 0], [x1, y0, z0], [x1, y1, z1], [x1, y0, z1]],
  ];
}

/**
 * STL binario: cabecera de 80 bytes, número de triángulos (uint32) y 50 bytes por triángulo
 * (normal + 3 vértices en float32, y 2 bytes de atributo a cero). Todo en little endian.
 */
export function binaryStl(boxes: PBox[], header = 'mueblesweb'): Uint8Array<ArrayBuffer> {
  const tris = boxes.flatMap(boxTriangles);
  const buf = new ArrayBuffer(84 + tris.length * 50);
  const view = new DataView(buf);
  const head = new TextEncoder().encode(header.slice(0, 80));
  new Uint8Array(buf, 0, 80).set(head.subarray(0, 80));
  view.setUint32(80, tris.length, true);
  let o = 84;
  for (const t of tris) {
    for (const v of t) {
      view.setFloat32(o, v[0], true);
      view.setFloat32(o + 4, v[1], true);
      view.setFloat32(o + 8, v[2], true);
      o += 12;
    }
    view.setUint16(o, 0, true);
    o += 2;
  }
  return new Uint8Array(buf);
}

/** Nombre de archivo seguro: minúsculas, sin tildes, guiones en lugar de espacios. */
export function slug(s: string): string {
  const out = s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return out || 'pieza';
}

const fmt = (v: number) => (Math.round(v * 100) / 100).toString().replace('.', ',');
/** Centésimas de mm → texto en mm reales (sin escalar). */
const realMm = (v: number) => fmt(v / 100);

interface PieceGroup {
  dims: [number, number, number];
  names: string[];
  box: Box;
}

/** Agrupa piezas con las mismas tres medidas (da igual la orientación): se imprime una y se indica la cantidad. */
function groupPieces(parts: Part[]): PieceGroup[] {
  const map = new Map<string, PieceGroup>();
  for (const p of parts) {
    const dims = [p.box.dx, p.box.dy, p.box.dz].sort((a, b) => b - a) as [number, number, number];
    const key = dims.join('x');
    const g = map.get(key);
    if (g) g.names.push(p.name);
    else map.set(key, { dims, names: [p.name], box: p.box });
  }
  return [...map.values()];
}

function piecesFiles(parts: Part[], prefix: string, o: Required<StlOptions>, readme: string[], counters: { thin: number }) {
  const files: StlFile[] = [];
  groupPieces(parts).forEach((g, i) => {
    const b = flatBox(g.box, o.scale);
    if (thicken(b, o.minThicknessMm)) counters.thin += g.names.length;
    const qty = g.names.length;
    const dimsTxt = g.dims.map(realMm).join('x');
    const name = `${prefix}${String(i + 1).padStart(2, '0')}-${slug(g.names[0]!)}${qty > 1 ? `-x${qty}` : ''}-${dimsTxt.replace(/,/g, '.')}.stl`;
    files.push({ name, data: binaryStl([b], `pieza ${g.names[0]}`) });
    readme.push(`${name}\n    Imprimir ${qty} ${qty === 1 ? 'vez' : 'veces'}. Medida real ${dimsTxt.replace(/x/g, ' x ')} mm.\n    Piezas: ${g.names.join(', ')}.`);
  });
  return files;
}

function scaleLabel(scale: number) {
  if (scale === 1) return 'tamaño real (1:1)';
  const inv = 1 / scale;
  return Number.isInteger(Math.round(inv * 1000) / 1000) ? `1:${Math.round(inv)}` : `×${fmt(scale)}`;
}

/**
 * Exporta un mueble a STL.
 *
 * - `mode: 'assembled'`: el mueble completo, montado, en un archivo. Los cajones según `drawers`.
 * - `mode: 'pieces'`: cada pieza distinta en su archivo, tumbada sobre su cara mayor.
 *   Las piezas idénticas se imprimen una vez y el nombre lleva la cantidad (`-x2`).
 */
export function exportStl(
  parts: Part[],
  opts: StlOptions & { mode: 'assembled' | 'pieces'; drawers?: DrawerMode; name: string },
): StlExport {
  const o: Required<StlOptions> = {
    scale: opts.scale ?? DEFAULTS.scale,
    minThicknessMm: opts.minThicknessMm ?? DEFAULTS.minThicknessMm,
  };
  if (!(o.scale > 0)) throw new Error('La escala tiene que ser mayor que cero.');
  const base = slug(opts.name);
  const counters = { thin: 0 };
  const readme: string[] = [
    `${opts.name}: modelo para impresión 3D`,
    '',
    `Escala ${scaleLabel(o.scale)}. Unidades del archivo: milímetros. Eje Z hacia arriba; el frente del mueble mira hacia -Y.`,
    o.minThicknessMm > 0
      ? `Espesor mínimo impreso: ${fmt(o.minThicknessMm)} mm. Las piezas que a esta escala quedaban más finas se han engordado hasta ese valor para que se puedan imprimir.`
      : 'No se ha engordado ninguna pieza: las muy finas pueden no imprimirse.',
    '',
    'Archivos:',
  ];
  const files: StlFile[] = [];
  let printedSize: StlExport['printedSize'] = null;

  if (opts.mode === 'pieces') {
    files.push(...piecesFiles(parts, '', o, readme, counters));
  } else {
    const drawers = opts.drawers ?? 'integrated';
    const isDrawer = (p: Part) => p.assembly?.kind === 'drawer';
    const inBody = drawers === 'integrated' ? parts : parts.filter((p) => !isDrawer(p));
    const placed = inBody.map((p) => {
      const b = placedBox(p.box, o.scale);
      if (thicken(b, o.minThicknessMm)) counters.thin++;
      return b;
    });
    const boxes = toOrigin(placed);
    printedSize = sizeOf(boxes);
    const main = `${base}.stl`;
    files.push({ name: main, data: binaryStl(boxes, opts.name) });
    readme.push(
      `${main}\n    Mueble montado${drawers === 'integrated' ? ', con los cajones en su sitio' : ', sin cajones'}. Tamaño impreso ${fmt(printedSize?.x ?? 0)} x ${fmt(printedSize?.y ?? 0)} x ${fmt(printedSize?.z ?? 0)} mm (ancho x fondo x alto).`,
    );

    if (drawers !== 'integrated') {
      const byAssembly = new Map<string, Part[]>();
      for (const p of parts.filter(isDrawer)) {
        const id = p.assembly!.id;
        byAssembly.set(id, [...(byAssembly.get(id) ?? []), p]);
      }
      for (const group of byAssembly.values()) {
        const label = group[0]!.assembly!.name;
        if (drawers === 'separate') {
          const bx = toOrigin(
            group.map((p) => {
              const b = placedBox(p.box, o.scale);
              if (thicken(b, o.minThicknessMm)) counters.thin++;
              return b;
            }),
          );
          const s = sizeOf(bx)!;
          const name = `${base}-${slug(label)}.stl`;
          files.push({ name, data: binaryStl(bx, label) });
          readme.push(`${name}\n    ${label} montado, para imprimir aparte. Tamaño impreso ${fmt(s.x)} x ${fmt(s.y)} x ${fmt(s.z)} mm.`);
        } else {
          files.push(...piecesFiles(group, `${slug(label)}-`, o, readme, counters));
        }
      }
    }
  }

  const warnings: string[] = [];
  if (counters.thin > 0) {
    warnings.push(
      `${counters.thin} ${counters.thin === 1 ? 'pieza quedaba' : 'piezas quedaban'} por debajo de ${fmt(o.minThicknessMm)} mm al imprimir y se ${counters.thin === 1 ? 'ha' : 'han'} engordado.`,
    );
  }
  if (opts.mode === 'assembled' && o.scale >= 0.5) {
    warnings.push('A esta escala el mueble completo no cabe en una impresora doméstica. Prueba 1:10 o 1:20, o exporta pieza a pieza.');
  }
  readme.push('', 'Generado por mueblesweb.');
  return { files, readme: readme.join('\n'), warnings, printedSize };
}
