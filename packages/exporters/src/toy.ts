import type { Box, LegOut, Part, ZoneOut } from '@mw/engine';
import { legTriangles } from './legmesh';
import { slug, type StlFile } from './stl';

/**
 * STL «de juguete»: el mueble a escala, listo para imprimir y que funcione.
 *
 * - **Mueble + puertas de bisagra en un solo archivo, impreso de una vez** ("print in place"):
 *   cada puerta va unida al costado por una bisagra de nudillos alternados (unos del mueble, otros
 *   de la puerta) alrededor de un perno, con holgura. Al sacarla de la impresora, la puerta gira.
 * - **Cajones**: cada uno de una pieza, en su propio archivo. Entran en su hueco con la holgura
 *   de las correderas (a escala).
 * - **Puertas corredizas**: el mueble lleva rieles arriba y abajo; cada hoja es un archivo. Se
 *   encastran levantando la hoja en el riel de arriba y bajándola en el de abajo.
 *
 * Unidades de trabajo: milímetros impresos, en los ejes del motor (x a la derecha, y hacia arriba,
 * z hacia el frente). Al escribir el STL se pasa a Z hacia arriba, con el frente mirando a −Y.
 */

export interface ToyOptions {
  /** Escala (0.1 = 1:10). */
  scale?: number;
  /** Espesor mínimo de pared impresa, mm. Por defecto 1,2 (tres pasadas de 0,4). */
  minWall?: number;
  /** Holgura entre piezas que se mueven, mm. Por defecto 0,4. */
  clearance?: number;
  name: string;
  /** Patas del mueble: van unidas a la base, en la misma pieza. */
  legs?: readonly LegOut[];
}

export interface ToyExport {
  files: StlFile[];
  readme: string;
  warnings: string[];
}

type V = [number, number, number];
type Tri = [V, V, V];

// ───────────────────────── primitivas (en mm impresos, ejes del motor) ─────────────────────────

interface MBox {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z0: number;
  z1: number;
}

/** Ejes del motor → ejes del STL: X = x, Y = −z, Z = y. */
const toStl = (p: V): V => [p[0], -p[2], p[1]];

const subV = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const crossV = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dotV = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Triángulo con la normal hacia `out` (si hace falta, se invierte el orden de los vértices). */
function tri(a: V, b: V, c: V, out: V): Tri {
  const n = crossV(subV(b, a), subV(c, a));
  return dotV(n, out) >= 0 ? [a, b, c] : [a, c, b];
}

function quad(a: V, b: V, c: V, d: V, out: V): Tri[] {
  return [tri(a, b, c, out), tri(a, c, d, out)];
}

/** Prisma rectangular (en ejes del STL). */
function boxTris(b: MBox): Tri[] {
  const P = (x: number, y: number, z: number) => toStl([x, y, z]);
  const { x0, x1, y0, y1, z0, z1 } = b;
  const c: V = toStl([(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2]);
  const faces: V[][] = [
    [P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1)],
    [P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)],
    [P(x0, y0, z0), P(x1, y0, z0), P(x1, y1, z0), P(x0, y1, z0)],
    [P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)],
    [P(x0, y0, z0), P(x0, y1, z0), P(x0, y1, z1), P(x0, y0, z1)],
    [P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)],
  ];
  return faces.flatMap((f) => {
    const fc = f.reduce<V>((s, p) => [s[0] + p[0] / 4, s[1] + p[1] / 4, s[2] + p[2] / 4], [0, 0, 0]);
    return quad(f[0]!, f[1]!, f[2]!, f[3]!, subV(fc, c));
  });
}

const SEG = 32;

/**
 * Tubo vertical (eje paralelo a y del motor) de radio exterior `ro` e interior `ri` (0 = cilindro
 * macizo), centrado en (x, z), entre y0 e y1.
 */
export function tubeTris(x: number, z: number, y0: number, y1: number, ro: number, ri = 0): Tri[] {
  const out: Tri[] = [];
  const ring = (r: number, y: number) => Array.from({ length: SEG }, (_, i) => toStl([x + r * Math.cos((2 * Math.PI * i) / SEG), y, z + r * Math.sin((2 * Math.PI * i) / SEG)]));
  const axisAt = (y: number) => toStl([x, y, z]);
  const ob = ring(ro, y0);
  const ot = ring(ro, y1);
  const up: V = toStl([0, 1, 0]);
  const down: V = toStl([0, -1, 0]);
  for (let i = 0; i < SEG; i++) {
    const j = (i + 1) % SEG;
    const mid = toStl([x + ro * Math.cos((2 * Math.PI * (i + 0.5)) / SEG), (y0 + y1) / 2, z + ro * Math.sin((2 * Math.PI * (i + 0.5)) / SEG)]);
    out.push(...quad(ob[i]!, ob[j]!, ot[j]!, ot[i]!, subV(mid, axisAt((y0 + y1) / 2))));
    if (ri > 0) {
      const ib = ring(ri, y0);
      const it = ring(ri, y1);
      const inMid = toStl([x + ri * Math.cos((2 * Math.PI * (i + 0.5)) / SEG), (y0 + y1) / 2, z + ri * Math.sin((2 * Math.PI * (i + 0.5)) / SEG)]);
      out.push(...quad(ib[i]!, ib[j]!, it[j]!, it[i]!, subV(axisAt((y0 + y1) / 2), inMid)));
      out.push(...quad(ob[i]!, ob[j]!, ib[j]!, ib[i]!, down));
      out.push(...quad(ot[i]!, ot[j]!, it[j]!, it[i]!, up));
    } else {
      out.push(tri(axisAt(y0), ob[i]!, ob[j]!, down));
      out.push(tri(axisAt(y1), ot[i]!, ot[j]!, up));
    }
  }
  return out;
}

/** STL binario a partir de triángulos, apoyado en Z = 0 y con la esquina mínima en el origen. */
export function trisToStl(tris: Tri[], header = 'mueblesweb juguete'): Uint8Array<ArrayBuffer> {
  let mx = Infinity;
  let my = Infinity;
  let mz = Infinity;
  for (const t of tris) for (const v of t) {
    mx = Math.min(mx, v[0]);
    my = Math.min(my, v[1]);
    mz = Math.min(mz, v[2]);
  }
  const buf = new ArrayBuffer(84 + tris.length * 50);
  const view = new DataView(buf);
  new Uint8Array(buf, 0, 80).set(new TextEncoder().encode(header.slice(0, 80)));
  view.setUint32(80, tris.length, true);
  let o = 84;
  for (const t of tris) {
    const a = t[0];
    const n = crossV(subV(t[1], a), subV(t[2], a));
    const L = Math.hypot(...n) || 1;
    for (const k of [0, 1, 2]) view.setFloat32(o + k * 4, n[k]! / L, true);
    o += 12;
    for (const v of t) {
      view.setFloat32(o, v[0] - mx, true);
      view.setFloat32(o + 4, v[1] - my, true);
      view.setFloat32(o + 8, v[2] - mz, true);
      o += 12;
    }
    view.setUint16(o, 0, true);
    o += 2;
  }
  return new Uint8Array(buf);
}

// ───────────────────────── armado ─────────────────────────

const fmt = (v: number) => (Math.round(v * 100) / 100).toString().replace('.', ',');

/**
 * Exporta el mueble como juguete imprimible. `parts` y `zones` salen de `compute()`; `size` son las
 * medidas exteriores del mueble.
 */
export function exportToy(partsIn: Part[], zones: ZoneOut[], size: { w: number; h: number; d: number }, opts: ToyOptions): ToyExport {
  // Puertas de varias piezas (marco y vidrio, o vidrio entero): una sola puerta maciza del tamaño de la puerta.
  const merged = new Map<string, Part>();
  const parts: Part[] = [];
  for (const p of partsIn) {
    if (!p.doorBox) {
      parts.push(p);
      continue;
    }
    const k = `${p.doorBox.x},${p.doorBox.y},${p.doorBox.z}`;
    if (!merged.has(k)) {
      const door: Part = { ...p, role: 'door', key: `${p.zoneId}/puerta-${merged.size}`, box: p.doorBox, doorBox: undefined, holes: undefined };
      merged.set(k, door);
      parts.push(door);
    }
  }
  const scale = opts.scale ?? 0.1;
  const minWall = opts.minWall ?? 1.2;
  const c = opts.clearance ?? 0.4;
  const s = (v: number) => (v / 100) * scale;
  const W = s(size.w);
  const D = s(size.d);
  const warnings: string[] = [];
  const base = slug(opts.name);

  /** Caja de una pieza en mm impresos, engordada al mínimo de pared (simétricamente). */
  const mbox = (b: Box): MBox => {
    const r: MBox = { x0: s(b.x), x1: s(b.x + b.dx), y0: s(b.y), y1: s(b.y + b.dy), z0: s(b.z), z1: s(b.z + b.dz) };
    for (const [lo, hi] of [
      ['x0', 'x1'],
      ['y0', 'y1'],
      ['z0', 'z1'],
    ] as const) {
      const d = r[hi] - r[lo];
      if (d < minWall) {
        r[lo] -= (minWall - d) / 2;
        r[hi] += (minWall - d) / 2;
      }
    }
    return r;
  };
  /** Un poco más grande, para que las piezas del mueble se fundan entre sí al laminar. */
  const grow = (b: MBox, e = 0.05): MBox => ({ x0: b.x0 - e, x1: b.x1 + e, y0: b.y0 - e, y1: b.y1 + e, z0: b.z0 - e, z1: b.z1 + e });

  const isDrawer = (p: Part) => p.assembly?.kind === 'drawer';
  const carcassParts = parts.filter((p) => p.role !== 'door' && !isDrawer(p));
  const hinged = parts.filter((p) => p.role === 'door' && !p.track);
  const sliding = parts.filter((p) => p.role === 'door' && p.track);

  const main: Tri[] = carcassParts.flatMap((p) => boxTris(grow(mbox(p.box))));
  const files: StlFile[] = [];
  const readme: string[] = [
    `${opts.name}: juguete para imprimir`,
    '',
    `Escala 1:${Math.round(1 / scale)}. Milímetros; Z hacia arriba; el frente mira a -Y.`,
    `Paredes de al menos ${fmt(minWall)} mm y ${fmt(c)} mm de holgura en todo lo que se mueve.`,
    '',
    'Archivos:',
  ];

  // ── puertas con bisagra impresa en su lugar ──
  let hingeCount = 0;
  const loose: Part[] = [];
  for (const d of hinged) {
    const b = mbox(d.box);
    const tf = b.z1 - b.z0;
    const left = d.hinge !== 'right';
    // La bisagra se apoya en un costado exterior: la puerta tiene que llegar hasta el borde del mueble.
    const edgeX = left ? b.x0 : b.x1;
    if (Math.abs(edgeX - (left ? 0 : W)) > 3) {
      loose.push(d);
      continue;
    }
    const R = Math.max(tf / 2 + 0.5, 1.5);
    let rp = Math.max(0.45 * R, 0.7);
    if (R - (rp + c) < 0.6) rp = Math.max(0.5, R - c - 0.6);
    const ax = left ? R : W - R;
    const az = D + c + R;
    const y0 = b.y0 + c / 2;
    const y1 = b.y1 - c / 2;
    const h = y1 - y0;
    const N = h >= 30 ? 5 : 3;
    // Entre nudillos, al menos 0,6 mm: la base de cada nudillo se imprime en el aire sobre el de abajo
    // y con poca separación se pega.
    const vg = Math.max(c, 0.6);
    const segLen = (h - (N - 1) * vg) / N;
    const segs = Array.from({ length: N }, (_, k) => ({ k, a: y0 + k * (segLen + vg), b: y0 + k * (segLen + vg) + segLen }));

    // Cuerpo de la puerta, separado del eje. Los bordes libres se recortan media holgura: dos
    // puertas vecinas quedan separadas al menos `c`.
    const bodyZ0 = az - tf / 2;
    const bodyZ1 = az + tf / 2;
    const body: MBox = left
      ? { x0: ax + R + c, x1: b.x1 - c / 2, y0, y1, z0: bodyZ0, z1: bodyZ1 }
      : { x0: b.x0 + c / 2, x1: ax - R - c, y0, y1, z0: bodyZ0, z1: bodyZ1 };
    if (body.x1 - body.x0 < 2) {
      loose.push(d);
      continue;
    }
    hingeCount++;

    // Mueble: perno continuo, nudillos en los tramos pares y una pestaña que los une al costado.
    main.push(...tubeTris(ax, az, y0, y1, rp));
    for (const g of segs.filter((g) => g.k % 2 === 0)) {
      main.push(...tubeTris(ax, az, g.a, g.b, R));
      main.push(...boxTris({ x0: ax - R, x1: ax + R, y0: g.a, y1: g.b, z0: D - 0.6, z1: az }));
    }

    // Puerta: el cuerpo y, en los tramos impares, un tubo alrededor del perno unido al cuerpo.
    const door: Tri[] = [];
    door.push(...boxTris(body));
    for (const g of segs.filter((g) => g.k % 2 === 1)) {
      door.push(...tubeTris(ax, az, g.a, g.b, R, rp + c));
      const from = ax + (left ? 1 : -1) * (rp + c + 0.15);
      const to = left ? body.x0 + 0.3 : body.x1 - 0.3;
      door.push(...boxTris({ x0: Math.min(from, to), x1: Math.max(from, to), y0: g.a, y1: g.b, z0: bodyZ0, z1: bodyZ1 }));
    }
    main.push(...door);
  }
  for (const d of loose) {
    warnings.push(`${d.name}: no llega al costado del mueble, así que no lleva bisagra impresa; va en un archivo aparte para pegarla.`);
    const name = `${base}-${slug(d.name)}.stl`;
    files.push({ name, data: trisToStl(boxTris(mbox(d.box)), d.name) });
    readme.push(`${name}\n    ${d.name}, sin bisagra (pegarla o ponerle una bisagra comprada).`);
  }

  // ── corredizas: rieles en el mueble y hojas aparte ──
  const byZone = new Map<string, Part[]>();
  for (const p of sliding) byZone.set(p.zoneId ?? '', [...(byZone.get(p.zoneId ?? '') ?? []), p]);
  const RB = 1.2; // alto de los rieles de abajo
  const RT = 2.4; // alto de los de arriba (más altos: la hoja entra levantándola)
  const RW = 0.8; // espesor de cada riel
  for (const [zoneId, leaves] of byZone) {
    const zb = zones.find((z) => z.id === zoneId)?.box;
    if (!zb) continue;
    const op = mbox(zb);
    const tracks = [...new Set(leaves.map((l) => mbox(l.box).z0))].sort((a, b) => a - b);
    const tf = Math.max(...leaves.map((l) => mbox(l.box).z1 - mbox(l.box).z0));
    // Paredes de los canales: delante y detrás de cada riel (una sola entre dos rieles vecinos).
    const walls: [number, number][] = [];
    tracks.forEach((z0, i) => {
      walls.push([z0 - c - RW, z0 - c]);
      if (i === tracks.length - 1) walls.push([z0 + tf + c, z0 + tf + c + RW]);
    });
    for (const [wz0, wz1] of walls) {
      main.push(...boxTris({ x0: op.x0 - 0.05, x1: op.x1 + 0.05, y0: op.y0 - 0.05, y1: op.y0 + RB, z0: wz0, z1: wz1 }));
      main.push(...boxTris({ x0: op.x0 - 0.05, x1: op.x1 + 0.05, y0: op.y1 - RT, y1: op.y1 + 0.05, z0: wz0, z1: wz1 }));
    }
    leaves.forEach((l, i) => {
      const b = mbox(l.box);
      const leaf: MBox = { x0: b.x0, x1: b.x1, y0: op.y0 + c, y1: op.y1 - (RT - RB) - c, z0: b.z0, z1: b.z0 + tf };
      const name = `${base}-corrediza-${i + 1}.stl`;
      files.push({ name, data: trisToStl(boxTris(leaf), l.name) });
      readme.push(`${name}\n    ${l.name}. Se encastra levantándola en el riel de arriba y bajándola en el de abajo (riel ${l.track === 'front' ? 'delantero' : 'trasero'}).`);
    });
  }

  // ── cajones: uno por archivo, de una pieza ──
  const drawers = new Map<string, Part[]>();
  for (const p of parts.filter(isDrawer)) drawers.set(p.assembly!.id, [...(drawers.get(p.assembly!.id) ?? []), p]);
  for (const group of drawers.values()) {
    const label = group[0]!.assembly!.name;
    // El frente se separa una holgura del mueble para que el cajón cierre del todo.
    const tris = group.flatMap((p) => {
      const b = grow(mbox(p.box));
      return boxTris(p.role === 'drawer-front' ? { ...b, z0: b.z0 + c, z1: b.z1 + c } : b);
    });
    const name = `${base}-${slug(label)}.stl`;
    files.push({ name, data: trisToStl(tris, label) });
    readme.push(`${name}\n    ${label}, de una pieza. Imprimilo con el frente hacia abajo y metelo en su hueco.`);
  }

  const mainName = `${base}-juguete.stl`;
  // Patas: unidas a la base (entran 0,1 mm impreso en ella para que se fundan), engordadas al mínimo de pared.
  const sink = (0.1 / scale) * 100;
  for (const l of opts.legs ?? []) main.push(...legTriangles({ ...l, height: l.height + sink }, (p) => toStl([s(p[0]), s(p[1]), s(p[2])]), (minWall / scale) * 100));
  files.unshift({ name: mainName, data: trisToStl(main, `${opts.name} juguete`) });
  readme.splice(
    6,
    0,
    `${mainName}\n    El mueble${hingeCount ? ` con ${hingeCount} ${hingeCount === 1 ? 'puerta' : 'puertas'} unidas por bisagras impresas en su lugar` : ''}. Imprimilo de pie, con la base sobre la cama.${hingeCount ? ' Al terminar, movés las puertas con suavidad para soltar la bisagra.' : ''}`,
  );
  readme.push('', 'Consejos: capa de 0,2 mm, sin soportes dentro de las bisagras. Si una bisagra queda pegada, subí la holgura a 0,5 mm.', '', 'Generado por mueblesweb.');
  return { files, readme: readme.join('\n'), warnings };
}
