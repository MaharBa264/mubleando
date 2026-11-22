import type { Box, ComputeResult, Design, Edges, Front, FrontMount, Material, Method, Part, PartAssembly, PartRole, Warning, Zone, ZoneOut } from './types';
import { placeLegs } from './legs';
import { hingeCount, hingePositions, liftFits, pickLength, PRESET_HARDWARE, type Hardware, type HardwareItem, type HardwareKind, type SlidingSpec } from './hardware';
import { weightPerM2 } from './types';
import { normalizeMethod } from './presets';
import { distribute, mm, toM2, toMm, type Len } from './units';

type Lift = Extract<Hardware, { kind: 'lift' }>;
/** Kilos con una decimal y coma: 4,5. */
const kg = (w: number) => String(Math.round(w * 10) / 10).replace('.', ',');

export const LIMITS = {
  w: { min: mm(100), max: mm(3000) },
  h: { min: mm(100), max: mm(3000) },
  d: { min: mm(100), max: mm(1200) },
} as const;

const FALLBACK_THICKNESS = mm(19);

/** Altura mínima útil de la caja de un cajón; por debajo no se genera. */
const MIN_DRAWER_BOX_H = mm(50);
/** Fondo mínimo de un cajón; por debajo no se genera. */
const MIN_DRAWER_DEPTH = mm(100);
/** Margen que se deja, además de lo que ocupa el frente, al retranquear solos los estantes de detrás. */
const SETBACK_MARGIN = mm(2);

/** Roles que llevan el canto frontal del método en L1. */
const FRONT_EDGED: ReadonlySet<PartRole> = new Set(['side', 'top', 'bottom', 'shelf', 'divider', 'drawer-side', 'drawer-back']);

const NO_EDGES: Edges = { L1: null, L2: null, W1: null, W2: null };

interface NewPart {
  key: string;
  role: PartRole;
  name: string;
  materialId: string;
  thickness: Len;
  length: Len;
  width: Len;
  box: Box;
  zoneId?: string;
  /** Cantos por defecto. Si no se da, el canto frontal del método en L1 según el papel de la pieza. */
  edges?: Edges;
  grain?: Part['grain'];
  assembly?: PartAssembly;
  hinge?: Part['hinge'];
  track?: Part['track'];
  doorBox?: Box;
  holes?: Part['holes'];
}

/** Rectángulo en el plano del frente (x, y). */
interface Rect {
  x: Len;
  y: Len;
  w: Len;
  h: Len;
}

/**
 * Convierte un diseño en piezas. Función pura y determinista:
 * la misma entrada da siempre la misma salida, en el navegador o en el servidor.
 *
 * Orden de las piezas: costados, tapa, base, trasera, estantes y divisores, zócalo,
 * puertas, y por cada cajón su frente y su caja.
 */
/**
 * Calcula las piezas de un mueble. Con patas (y sin zócalo), arma la caja con el alto que queda y
 * la sube el alto de la pata; con zócalo, las patas van ocultas detrás y el alto lo da el zócalo.
 */
export function compute(design: Design, methodIn: Method, materials: readonly Material[], hardwareLib: readonly Hardware[] = []): ComputeResult {
  if (!design.legs) return computeBox(design, methodIn, materials, hardwareLib);
  const hw =
    (hardwareLib.find((h) => h.id === design.legs!.hardwareId && h.kind === 'leg') as Extract<Hardware, { kind: 'leg' }> | undefined) ??
    (PRESET_HARDWARE.find((h) => h.id === design.legs!.hardwareId && h.kind === 'leg') as Extract<Hardware, { kind: 'leg' }> | undefined);
  if (!hw) {
    const r = computeBox({ ...design, legs: undefined }, methodIn, materials, hardwareLib);
    r.warnings.push({ code: 'material_missing', message: 'Las patas elegidas ya no están en la biblioteca: el mueble se calcula sin patas.' });
    return r;
  }
  const spec = hw.spec;
  const { w, h, d } = design.size;
  const plinthH = design.plinth && design.plinth.height > 0 ? design.plinth.height : 0;
  const warnings: Warning[] = [];
  let r: ComputeResult;
  let legH: Len;
  if (plinthH > 0) {
    // Detrás del zócalo: la pata mide lo que el zócalo.
    legH = plinthH;
    r = computeBox({ ...design, legs: undefined }, methodIn, materials, hardwareLib);
    if (spec.style === 'adjustable' && spec.adjustMax > 0 && (legH < spec.adjustMin || legH > spec.adjustMax)) {
      warnings.push({ code: 'hardware_mismatch', message: `El zócalo mide ${toMm(legH)} mm y las patas regulan de ${toMm(spec.adjustMin)} a ${toMm(spec.adjustMax)} mm.` });
    }
  } else {
    legH = spec.height;
    const inside = design.legs.includeInHeight !== false;
    const boxH = inside ? h - legH : h;
    if (boxH <= 0) {
      r = computeBox({ ...design, legs: undefined }, methodIn, materials, hardwareLib);
      r.warnings.push({ code: 'zone_too_small', message: 'Las patas son tan altas como el mueble: se calcula sin patas.' });
      return r;
    }
    r = computeBox({ ...design, legs: undefined, size: { ...design.size, h: boxH } }, methodIn, materials, hardwareLib);
    // La caja sube el alto de la pata: todas las piezas y huecos.
    for (const p of r.parts) p.box = { ...p.box, y: p.box.y + legH };
    for (const z of r.zones) z.box = { ...z.box, y: z.box.y + legH };
  }
  // La huella de la caja (sin las puertas, que sobresalen): las patas van debajo de la caja.
  const carcass = r.parts.filter((p) => p.role === 'side' || p.role === 'bottom');
  const depth = carcass.length ? Math.max(...carcass.map((p) => p.box.z + p.box.dz)) : d;
  const legs = placeLegs(spec, w, depth, legH);
  const note = `${toMm(legH)} mm`;
  const prev = r.hardware.find((x) => x.hardwareId === hw.id && x.note === note);
  if (prev) prev.qty += legs.length;
  else r.hardware.push({ hardwareId: hw.id, name: hw.name, kind: 'leg', qty: legs.length, unit: 'unidad', priceCents: hw.priceCents, note });
  return { ...r, warnings: [...r.warnings, ...warnings], legs };
}

function computeBox(design: Design, methodIn: Method, materials: readonly Material[], hardwareLib: readonly Hardware[] = []): ComputeResult {
  // Un método guardado con una versión anterior (sin frentes ni cajones) se completa en lugar de fallar.
  const method = normalizeMethod(methodIn);
  const mats = new Map(materials.map((m) => [m.id, m]));
  const warnings: Warning[] = [];
  const parts: Part[] = [];
  const zones: ZoneOut[] = [];
  const overrides = design.overrides ?? {};

  // ── herrajes: el que elige el mueble, o el del método ──
  const pickHw = <K extends Exclude<HardwareKind, 'leg' | 'lift'>>(kind: K) => {
    const id = design.hardware?.[kind] ?? method.hardware?.[kind];
    return id ? (hardwareLib.find((h) => h.id === id && h.kind === kind) as Extract<Hardware, { kind: K }> | undefined) : undefined;
  };
  const hinge = pickHw('hinge');
  const slide = pickHw('slide');
  const slidingHw = pickHw('sliding');
  const items = new Map<string, HardwareItem>();
  const addItem = (hw: Hardware, qty: number, unit: HardwareItem['unit'], note?: string) => {
    const key = `${hw.id}|${note ?? ''}`;
    const prev = items.get(key);
    if (prev) prev.qty += qty;
    else items.set(key, { hardwareId: hw.id, name: hw.name, kind: hw.kind, qty, unit, priceCents: hw.priceCents, note });
  };

  const thicknessOf = (id: string, what: string): Len => {
    const m = mats.get(id);
    if (!m) {
      warnings.push({ code: 'material_missing', message: `Falta el material de ${what}; se usa ${toMm(FALLBACK_THICKNESS)} mm.` });
      return FALLBACK_THICKNESS;
    }
    return m.thickness;
  };
  const edgeThickness = (id: string | null): Len => (id ? (mats.get(id)?.thickness ?? 0) : 0);
  /** Lo que un canto descuenta de la medida de corte: su espesor, si el método descuenta y llega al mínimo. */
  const edgeCut = (id: string | null): Len => {
    if (!method.edgeReducesCut) return 0;
    const th = edgeThickness(id);
    return th >= method.edgeReduceMin ? th : 0;
  };
  const grainOf = (id: string) => mats.get(id)?.grain ?? 'none';
  const validEdge = (id: string | null) => (id && mats.get(id)?.kind === 'edge' ? id : null);

  const { w: W, h: H, d: D } = design.size;
  for (const k of ['w', 'h', 'd'] as const) {
    const v = design.size[k];
    if (v < LIMITS[k].min || v > LIMITS[k].max) {
      warnings.push({
        code: 'size_out_of_range',
        message: `${{ w: 'El ancho', h: 'El alto', d: 'El fondo' }[k]} debe estar entre ${toMm(LIMITS[k].min)} y ${toMm(LIMITS[k].max)} mm.`,
      });
    }
  }

  const t = thicknessOf(method.carcassMaterialId, 'la estructura');
  const frontEdge = method.frontEdgeMaterialId;
  if (frontEdge && !mats.has(frontEdge)) {
    warnings.push({ code: 'material_missing', message: 'Falta el material del canto frontal; las piezas salen sin canto.' });
  }
  const methodFrontEdge = validEdge(frontEdge);

  const addPart = (p: NewPart) => {
    let edges: Edges = p.edges ?? (methodFrontEdge && FRONT_EDGED.has(p.role) ? { ...NO_EDGES, L1: methodFrontEdge } : { ...NO_EDGES });
    let materialId = p.materialId;
    let overridden = false;

    const ov = overrides[p.key];
    if (ov) {
      if (ov.materialId && ov.materialId !== materialId) {
        const m = mats.get(ov.materialId);
        if (m && m.kind === 'panel' && m.thickness === p.thickness) {
          materialId = m.id;
          overridden = true;
        } else {
          warnings.push({
            code: 'override_ignored',
            message: `${p.name}: el material elegido no existe o no tiene ${toMm(p.thickness)} mm de espesor; se usa el del método.`,
          });
        }
      }
      // El retranqueo ya se aplicó al calcular la caja de la pieza (estantes y divisores).
      if (ov.frontSetback !== undefined && (p.role === 'shelf' || p.role === 'divider')) overridden = true;
      if (ov.edges) {
        const next = { ...edges };
        for (const side of ['L1', 'L2', 'W1', 'W2'] as const) {
          if (side in ov.edges) next[side] = validEdge(ov.edges[side] ?? null);
        }
        edges = next;
        overridden = true;
      }
    }

    const cutWidth = p.width - edgeCut(edges.L1) - edgeCut(edges.L2);
    const cutLength = p.length - edgeCut(edges.W1) - edgeCut(edges.W2);
    const { edges: _e, grain, ...rest } = p;
    const part: Part = { ...rest, materialId, cutLength, cutWidth, edges, grain: grain ?? grainOf(materialId) };
    if (overridden) part.overridden = true;
    parts.push(part);
  };

  // ── cómo se arma la caja ──
  const cons = design.construction ?? {};
  const topMode = cons.top ?? 'between';
  const bottomMode = cons.bottom ?? 'between';
  const railW = cons.railWidth ?? mm(100);

  // ── zócalo: la base sube; los costados siguen enteros hasta el suelo ──
  const plinthH: Len = design.plinth && design.plinth.height > 0 ? design.plinth.height : 0;
  if (plinthH > 0 && plinthH >= H - 2 * t) {
    warnings.push({ code: 'zone_too_small', message: 'El zócalo es tan alto como el mueble.' });
  }

  // ── trasera ──
  const back = method.back;
  let carcassZ0: Len = 0;
  let innerZ0: Len = 0;
  let backPart: NewPart | null = null;

  if (back.mode !== 'none' && cons.back !== 'none') {
    const tb = thicknessOf(back.materialId, 'la trasera');
    if (back.mode === 'overlay') {
      carcassZ0 = tb;
      innerZ0 = tb;
      backPart = {
        key: 'back',
        role: 'back',
        name: 'Trasera',
        materialId: back.materialId,
        thickness: tb,
        length: H - plinthH,
        width: W,
        box: { x: 0, y: plinthH, z: 0, dx: W, dy: H - plinthH, dz: tb },
      };
    } else {
      if (back.grooveDepth >= t) {
        warnings.push({ code: 'groove_too_deep', message: 'La ranura de la trasera es tan profunda como el tablero o más.' });
      }
      const into = back.grooveDepth - back.clearance; // lo que entra la trasera en cada ranura
      innerZ0 = back.inset + tb;
      const bw = W - 2 * t + 2 * into;
      // Sin tapa, el fondo solo entra en la ranura de la base y llega hasta arriba del todo.
      const bh = topMode === 'none' ? H - plinthH - t + into : H - plinthH - 2 * t + 2 * into;
      backPart = {
        key: 'back',
        role: 'back',
        name: 'Trasera',
        materialId: back.materialId,
        thickness: tb,
        length: bh,
        width: bw,
        box: { x: t - into, y: plinthH + t - into, z: back.inset, dx: bw, dy: bh, dz: tb },
      };
    }
  }

  const carcassDz = D - carcassZ0;

  // ── caja ──
  // Costados: enteros salvo que la tapa vaya encima (terminan debajo de ella) o la base debajo
  // (empiezan encima de ella).
  const sideY0: Len = bottomMode === 'under' ? plinthH + t : 0;
  const sideY1: Len = topMode === 'over' ? H - t : H;
  for (const [key, name, x] of [
    ['side.left', 'Costado izquierdo', 0],
    ['side.right', 'Costado derecho', W - t],
  ] as const) {
    addPart({
      key,
      role: 'side',
      name,
      materialId: method.carcassMaterialId,
      thickness: t,
      length: sideY1 - sideY0,
      width: carcassDz,
      box: { x, y: sideY0, z: carcassZ0, dx: t, dy: sideY1 - sideY0, dz: carcassDz },
    });
  }

  const innerW = W - 2 * t;
  // Arriba del hueco interior: la cara de abajo de la tapa (o de los travesaños), o el borde del mueble si no hay tapa.
  const innerTopY: Len = topMode === 'none' ? H : H - t;
  const innerH = innerTopY - (plinthH + t);
  if (innerW <= 0 || innerH <= 0) {
    warnings.push({ code: 'zone_too_small', message: 'El mueble es más estrecho o más bajo que dos tableros.' });
    return { parts, zones, warnings, hardware: [], legs: [] };
  }

  const frontEdgeOnly = methodFrontEdge ? { ...NO_EDGES, L1: methodFrontEdge } : { ...NO_EDGES };
  if (topMode === 'between' || topMode === 'over') {
    const full = topMode === 'over';
    addPart({
      key: 'top',
      role: 'top',
      name: 'Tapa',
      materialId: method.carcassMaterialId,
      thickness: t,
      length: full ? W : innerW,
      width: carcassDz,
      box: { x: full ? 0 : t, y: H - t, z: carcassZ0, dx: full ? W : innerW, dy: t, dz: carcassDz },
      // Encima de los costados se le ven también las puntas: llevan el mismo tapacanto que el frente.
      edges: full && methodFrontEdge ? { ...NO_EDGES, L1: methodFrontEdge, W1: methodFrontEdge, W2: methodFrontEdge } : undefined,
    });
  } else if (topMode === 'rails') {
    const rw = Math.min(railW, Math.floor(carcassDz / 2));
    addPart({
      key: 'top.rail.front',
      role: 'top',
      name: 'Travesaño delantero',
      materialId: method.carcassMaterialId,
      thickness: t,
      length: innerW,
      width: rw,
      box: { x: t, y: H - t, z: D - rw, dx: innerW, dy: t, dz: rw },
      edges: frontEdgeOnly,
    });
    addPart({
      key: 'top.rail.back',
      role: 'top',
      name: 'Travesaño trasero',
      materialId: method.carcassMaterialId,
      thickness: t,
      length: innerW,
      width: rw,
      box: { x: t, y: H - t, z: carcassZ0, dx: innerW, dy: t, dz: rw },
      edges: { ...NO_EDGES },
    });
  }
  const bottomFull = bottomMode === 'under';
  addPart({
    key: 'bottom',
    role: 'bottom',
    name: 'Base',
    materialId: method.carcassMaterialId,
    thickness: t,
    length: bottomFull ? W : innerW,
    width: carcassDz,
    box: { x: bottomFull ? 0 : t, y: plinthH, z: carcassZ0, dx: bottomFull ? W : innerW, dy: t, dz: carcassDz },
  });
  if (backPart) addPart(backPart);

  // ── frentes: espesor y sistema corredizo (los estantes de detrás dependen de ellos) ──
  const fm = method.fronts;
  const tf = thicknessOf(fm.materialId, 'los frentes');
  // Sistema corredizo: el elegido o, si no hay, el de partida de 2 hojas (sus medidas típicas).
  const slidingSpec: SlidingSpec = slidingHw?.spec ?? (PRESET_HARDWARE.find((h) => h.kind === 'sliding')!.spec as SlidingSpec);

  /**
   * Lo que ocupa un frente dentro del mueble, desde el borde delantero: los estantes y divisores de
   * detrás tienen que retranquearse al menos eso. Las puertas corredizas van dentro del hueco (retiro,
   * dos hojas y el espacio entre rieles); las encastradas, su espesor. Las superpuestas, nada.
   */
  type Clearance = { need: Len; what: 'sliding' | 'inset' };
  const clearanceOf = (f: Front | undefined): Clearance | null => {
    if (!f) return null;
    if (f.kind === 'sliding') return { need: slidingSpec.frontSetback + 2 * tf + slidingSpec.trackGap, what: 'sliding' };
    if (f.mount === 'inset') return { need: tf, what: 'inset' };
    return null;
  };
  /** Estantes y divisores con un retranqueo elegido a mano que choca con el frente (el aviso se arma al final, con su nombre). */
  const collisions: { key: string; setback: Len; clearance: Clearance; zoneId: string }[] = [];

  // ── huecos interiores ──
  const inner: Box = { x: t, y: plinthH + t, z: innerZ0, dx: innerW, dy: innerH, dz: D - innerZ0 };
  const fronted: { zone: Zone; front: Front; box: Box }[] = [];

  /**
   * `behind`: lo que ocupa el frente más profundo de este hueco o de los que lo contienen. Los estantes
   * y divisores se retranquean solos eso más un margen; si se eligió un retranqueo a mano, se respeta
   * y, si es menor, se avisa.
   */
  const layout = (zone: Zone, box: Box, parentId: string | null, depth: number, index: number, behind: Clearance | null) => {
    zones.push({ id: zone.id, parentId, depth, box, isLeaf: !zone.split, index });
    if (zone.front) fronted.push({ zone, front: zone.front, box });
    const split = zone.split;
    if (!split) return;
    const own = clearanceOf(zone.front);
    const clearance = own && (!behind || own.need > behind.need) ? own : behind;
    const setbackFor = (key: string, methodSetback: Len): Len => {
      const forced = overrides[key]?.frontSetback;
      if (forced !== undefined) {
        if (clearance && forced < clearance.need) collisions.push({ key, setback: forced, clearance, zoneId: zone.id });
        return forced;
      }
      return clearance ? Math.max(methodSetback, clearance.need + SETBACK_MARGIN) : methodSetback;
    };

    const n = split.children.length;
    const along: 'dx' | 'dy' = split.axis === 'x' ? 'dx' : 'dy';
    const avail = box[along] - (n - 1) * t;
    const sizes = resolveSizes(split.sizes, avail, zone.id, warnings);

    let pos = split.axis === 'x' ? box.x : box.y;
    split.children.forEach((child, i) => {
      const size = Math.max(0, sizes[i] ?? 0);
      const childBox: Box = split.axis === 'x' ? { ...box, x: pos, dx: size } : { ...box, y: pos, dy: size };
      layout(child, childBox, zone.id, depth + 1, i, clearance);
      pos += size;
      if (i < n - 1) {
        if (split.axis === 'y') {
          const dz = box.dz - setbackFor(`zone:${zone.id}/div${i}`, method.shelfFrontSetback);
          addPart({
            key: `zone:${zone.id}/div${i}`,
            role: 'shelf',
            name: 'Estante',
            materialId: method.carcassMaterialId,
            thickness: t,
            length: box.dx,
            width: dz,
            box: { x: box.x, y: pos, z: box.z, dx: box.dx, dy: t, dz },
            zoneId: zone.id,
          });
        } else {
          const dz = box.dz - setbackFor(`zone:${zone.id}/div${i}`, method.dividerFrontSetback);
          addPart({
            key: `zone:${zone.id}/div${i}`,
            role: 'divider',
            name: 'Divisor',
            materialId: method.carcassMaterialId,
            thickness: t,
            length: box.dy,
            width: dz,
            box: { x: pos, y: box.y, z: box.z, dx: t, dy: box.dy, dz },
            zoneId: zone.id,
          });
        }
        pos += t;
      }
    });
  };
  layout(design.root, inner, null, 0, 0, null);

  // ── zócalo ──
  if (plinthH > 0) {
    const setback = Math.min(design.plinth!.setback, carcassDz - t);
    addPart({
      key: 'plinth',
      role: 'plinth',
      name: 'Zócalo',
      materialId: method.carcassMaterialId,
      thickness: t,
      // Con la base debajo de los costados, los costados no llegan al suelo: el zócalo va de lado a lado.
      length: bottomFull ? W : innerW,
      width: plinthH,
      box: { x: bottomFull ? 0 : t, y: 0, z: D - setback - t, dx: bottomFull ? W : innerW, dy: plinthH, dz: t },
      edges: { ...NO_EDGES },
    });
  }

  // ── frentes: puertas y cajones ──
  const fEdge = validEdge(fm.edgeMaterialId);
  const frontEdges: Edges = { L1: fEdge, L2: fEdge, W1: fEdge, W2: fEdge };
  const gap = fm.gap;
  const half = Math.floor(gap / 2);
  const innerBottomY = plinthH + t;

  /** Rectángulo que ocupa el frente de un hueco, según el montaje y lo que rodea al hueco. */
  const frontRect = (b: Box, mount: FrontMount): Rect => {
    if (mount === 'inset') return { x: b.x + gap, y: b.y + gap, w: b.dx - 2 * gap, h: b.dy - 2 * gap };
    // Superpuesto: sobre la estructura exterior tapa todo el tablero menos media holgura;
    // sobre un estante o divisor, solo hasta la mitad del tablero menos media holgura.
    const outer = t - half;
    const inside = Math.floor(t / 2) - half;
    const left = b.x === t ? outer : inside;
    const right = b.x + b.dx === W - t ? outer : inside;
    const bottom = b.y === innerBottomY ? outer : inside;
    // Arriba: sobre la tapa, tapa todo menos media holgura; sin tapa, queda media holgura por debajo del borde.
    const top = b.y + b.dy === innerTopY ? (topMode === 'none' ? -half : outer) : inside;
    return { x: b.x - left, y: b.y - bottom, w: b.dx + left + right, h: b.dy + bottom + top };
  };
  const frontZ = (mount: FrontMount) => (mount === 'inset' ? D - tf : D);

  // Herrajes de apertura (hacia arriba o abajo): los de la biblioteca o, si no tiene ninguno, los de partida.
  const libLifts = hardwareLib.filter((h): h is Lift => h.kind === 'lift');
  const lifts = libLifts.length ? libLifts : PRESET_HARDWARE.filter((h): h is Lift => h.kind === 'lift');
  const liftFor = (id: string | undefined, opens: 'up' | 'down', weight: number, height: Len, zoneId: string) => {
    const dir = opens === 'up' ? 'hacia arriba' : 'hacia abajo';
    const chosen = id ? ((hardwareLib.find((h) => h.id === id && h.kind === 'lift') ?? PRESET_HARDWARE.find((h) => h.id === id && h.kind === 'lift')) as Lift | undefined) : undefined;
    const lift =
      chosen ??
      [...lifts].filter((h) => h.spec.direction === opens && liftFits(h.spec, weight, height)).sort((a, b) => a.spec.maxWeight - b.spec.maxWeight || a.spec.minWeight - b.spec.minWeight)[0];
    if (!lift) {
      warnings.push({
        code: 'hardware_mismatch',
        message: `La puerta pesa ${kg(weight)} kg y mide ${toMm(height)} mm de alto: ningún herraje de la biblioteca para abrir ${dir} la aguanta.`,
        zoneId,
      });
      return;
    }
    const sp = lift.spec;
    if (sp.direction !== opens) {
      warnings.push({ code: 'hardware_mismatch', message: `«${lift.name}» es para puertas que abren ${sp.direction === 'up' ? 'hacia arriba' : 'hacia abajo'} y esta abre ${dir}.`, zoneId });
    } else if (!liftFits(sp, weight, height)) {
      warnings.push({
        code: 'hardware_mismatch',
        message: `La puerta pesa ${kg(weight)} kg y mide ${toMm(height)} mm de alto: «${lift.name}» es para puertas de ${kg(sp.minWeight)} a ${kg(sp.maxWeight)} kg y de ${toMm(sp.minHeight)} a ${toMm(sp.maxHeight)} mm.`,
        zoneId,
      });
    }
    if (D < sp.minDepth) {
      warnings.push({ code: 'hardware_mismatch', message: `«${lift.name}» necesita un mueble de al menos ${toMm(sp.minDepth)} mm de fondo.`, zoneId });
    }
    addItem(lift, sp.perDoor, 'unidad', `puerta de ${kg(weight)} kg`);
  };

  let doorCount = 0;
  /** Piezas de puertas de varias partes (marco, vidrio): clave, nombre, número de puerta y lado, para nombrarlas al final. */
  const doorNames: [string, string, number, string][] = [];
  let drawerCount = 0;

  for (const { zone, front, box } of fronted) {
    // ── puertas corredizas: dentro del hueco, en dos rieles ──
    if (front.kind === 'sliding') {
      const sp = slidingSpec;
      const n = front.leaves;
      const h = box.dy - sp.topGap - sp.bottomGap;
      const widths = distribute(box.dx + (n - 1) * sp.overlap, n);
      if (h <= 0 || widths.some((w) => w <= sp.overlap)) {
        warnings.push({ code: 'zone_too_small', message: 'El hueco es demasiado chico para puertas corredizas.', zoneId: zone.id });
        continue;
      }
      const zFront = D - sp.frontSetback - tf;
      const zBack = zFront - tf - sp.trackGap;
      let x = box.x;
      widths.forEach((w, i) => {
        doorCount++;
        // Con 2 hojas: la izquierda atrás y la derecha adelante. Con 3: las de los extremos adelante.
        const track: 'front' | 'back' = i % 2 === (n === 2 ? 1 : 0) ? 'front' : 'back';
        addPart({
          key: `zone:${zone.id}/sliding${i}`,
          role: 'door',
          name: `Puerta corrediza ${doorCount}`,
          materialId: fm.materialId,
          thickness: tf,
          length: h,
          width: w,
          box: { x, y: box.y + sp.bottomGap, z: track === 'front' ? zFront : zBack, dx: w, dy: h, dz: tf },
          zoneId: zone.id,
          edges: { ...frontEdges },
          track,
        });
        x += w - sp.overlap;
      });
      if (slidingHw) addItem(slidingHw, 1, 'juego', `rieles de ${toMm(box.dx)} mm`);
      continue;
    }

    const r = frontRect(box, front.mount);
    if (r.w <= 0 || r.h <= 0) {
      warnings.push({ code: 'zone_too_small', message: 'Un hueco es demasiado pequeño para su frente.', zoneId: zone.id });
      continue;
    }
    const z = frontZ(front.mount);

    if (front.kind === 'door') {
      // Hacia arriba o hacia abajo: una sola hoja, con las bisagras en el canto de arriba o de abajo.
      const opens = front.opens ?? 'side';
      const vertical = opens !== 'side';
      const leaves = vertical ? 1 : front.leaves;
      const widths = leaves === 2 ? distribute(r.w - gap, 2) : [r.w];
      const glass = front.glass;
      const glassMat = glass ? mats.get(glass.glassId) : undefined;
      if (glass && (!glassMat || glassMat.kind !== 'glass')) {
        warnings.push({ code: 'material_missing', message: 'El vidrio elegido para la puerta no está en la biblioteca: se usa uno de 4 mm.', zoneId: zone.id });
      }
      const gt = glassMat?.kind === 'glass' ? glassMat.thickness : mm(4);
      // Bisagras de la puerta entera de vidrio: la elegida, o la primera para vidrio.
      const glassHinge =
        glass?.type === 'frameless'
          ? ((hardwareLib.find((h) => h.id === glass.hingeId && h.kind === 'hinge') ??
              PRESET_HARDWARE.find((h) => h.id === glass.hingeId && h.kind === 'hinge') ??
              hardwareLib.find((h) => h.kind === 'hinge' && h.spec.forGlass) ??
              PRESET_HARDWARE.find((h) => h.kind === 'hinge' && h.spec.forGlass)) as Extract<Hardware, { kind: 'hinge' }>)
          : undefined;
      let x = r.x;
      widths.forEach((w, i) => {
        doorCount++;
        const num = doorCount;
        const side = leaves === 2 ? (i === 0 ? ' (izquierda)' : ' (derecha)') : '';
        const hingeSide: NonNullable<Part['hinge']> = opens === 'up' ? 'top' : opens === 'down' ? 'bottom' : leaves === 2 ? (i === 0 ? 'left' : 'right') : front.hinge;
        /** Largo del canto que lleva las bisagras: el alto, o el ancho si abre hacia arriba o abajo. */
        const hingeRun = vertical ? w : r.h;
        const first = parts.length;
        const doorBox: Box = { x, y: r.y, z, dx: w, dy: r.h, dz: tf };
        const base = { zoneId: zone.id, hinge: hingeSide };
        const fw = glass?.type === 'frame' ? glass.frameWidth : 0;

        if (glass?.type === 'frame' && 2 * fw < Math.min(w, r.h) - mm(20)) {
          // Marco: parantes de todo el alto y travesaños entre ellos; el vidrio, por detrás.
          const k = `zone:${zone.id}/door${i}`;
          const stileEdges: Edges = { ...frontEdges };
          const railEdges: Edges = { ...NO_EDGES, L1: fEdge, L2: fEdge };
          const frame: [string, string, Box, Len, Len, Edges][] = [
            [`${k}/stile-l`, 'Parante izquierdo', { x, y: r.y, z, dx: fw, dy: r.h, dz: tf }, r.h, fw, stileEdges],
            [`${k}/stile-r`, 'Parante derecho', { x: x + w - fw, y: r.y, z, dx: fw, dy: r.h, dz: tf }, r.h, fw, stileEdges],
            [`${k}/rail-b`, 'Travesaño de abajo', { x: x + fw, y: r.y, z, dx: w - 2 * fw, dy: fw, dz: tf }, w - 2 * fw, fw, railEdges],
            [`${k}/rail-t`, 'Travesaño de arriba', { x: x + fw, y: r.y + r.h - fw, z, dx: w - 2 * fw, dy: fw, dz: tf }, w - 2 * fw, fw, railEdges],
          ];
          for (const [key, name, box, length, width, edges] of frame) {
            doorNames.push([key, name, num, side]);
            addPart({ key, role: 'door', name, materialId: fm.materialId, thickness: tf, length, width, box, edges, doorBox, ...base });
          }
          const off = fw - glass.rebate + glass.clearance;
          const gw = w - 2 * off;
          const gh = r.h - 2 * off;
          doorNames.push([`${k}/glass`, 'Vidrio', num, side]);
          addPart({
            key: `${k}/glass`,
            role: 'glass',
            name: 'Vidrio',
            materialId: glass.glassId,
            thickness: gt,
            length: gh,
            width: gw,
            box: { x: x + off, y: r.y + off, z: z - gt, dx: gw, dy: gh, dz: gt },
            edges: { ...NO_EDGES },
            grain: 'none',
            doorBox,
            ...base,
          });
          if (hinge) {
            addItem(hinge, hingeCount(hinge.spec, hingeRun), 'unidad');
            if (fw < hinge.spec.cupDistance + hinge.spec.cupDiameter) {
              warnings.push({
                code: 'hardware_mismatch',
                message: `El parante mide ${toMm(fw)} mm y la cazoleta de la bisagra necesita ${toMm(hinge.spec.cupDistance + hinge.spec.cupDiameter)} mm desde el borde.`,
                zoneId: zone.id,
              });
            }
          }
        } else if (glass?.type === 'frameless') {
          // Puerta entera de vidrio templado.
          const g = glassHinge?.spec;
          const off = g ? g.cupDistance + g.cupDiameter / 2 : 0;
          const holes =
            g?.forGlass?.mount === 'drilled'
              ? hingePositions(g, hingeRun).map((pos) =>
                  hingeSide === 'top'
                    ? { x: pos, y: r.h - off, d: g.cupDiameter }
                    : hingeSide === 'bottom'
                      ? { x: pos, y: off, d: g.cupDiameter }
                      : { x: hingeSide === 'left' ? off : w - off, y: pos, d: g.cupDiameter },
                )
              : undefined;
          const key = `zone:${zone.id}/door${i}`;
          doorNames.push([key, 'Puerta de vidrio', num, side]);
          addPart({
            key,
            role: 'glass',
            name: 'Puerta de vidrio',
            materialId: glass.glassId,
            thickness: gt,
            length: r.h,
            width: w,
            box: { ...doorBox, dz: gt },
            edges: { ...NO_EDGES },
            grain: 'none',
            doorBox: { ...doorBox, dz: gt },
            holes,
            ...base,
          });
          if (glassHinge) addItem(glassHinge, hingeCount(glassHinge.spec, hingeRun), 'unidad');
        } else {
          if (glass?.type === 'frame') {
            warnings.push({ code: 'zone_too_small', message: `El marco de ${toMm(fw)} mm no deja lugar para el vidrio: la puerta va entera de tablero.`, zoneId: zone.id });
          }
          addPart({
            key: `zone:${zone.id}/door${i}`,
            role: 'door',
            name: `Puerta ${num}${side}`,
            materialId: fm.materialId,
            thickness: tf,
            length: r.h,
            width: w,
            box: doorBox,
            edges: { ...frontEdges },
            ...base,
          });
          if (hinge) addItem(hinge, hingeCount(hinge.spec, hingeRun), 'unidad');
        }
        if (vertical) {
          // Peso de la puerta entera (marco y vidrio incluidos) para elegir el pistón, el brazo o el compás.
          const weight = parts.slice(first).reduce((sum, q) => {
            const m = mats.get(q.materialId);
            return sum + toM2(q.length * q.width) * weightPerM2(m ?? { kind: q.role === 'glass' ? 'glass' : 'panel', thickness: q.thickness });
          }, 0);
          liftFor(front.liftId, opens, weight, r.h, zone.id);
        }
        x += w + gap;
      });
      if (glass?.type === 'frameless') {
        const g = glassHinge?.spec.forGlass;
        if (glassMat?.kind === 'glass' && !glassMat.tempered) {
          warnings.push({ code: 'hardware_mismatch', message: `«${glassMat.name}» no es templado: una puerta entera de vidrio tiene que ser de vidrio templado.`, zoneId: zone.id });
        }
        if (g && (gt < g.minThickness || gt > g.maxThickness)) {
          warnings.push({
            code: 'hardware_mismatch',
            message: `El vidrio mide ${toMm(gt)} mm y la bisagra «${glassHinge!.name}» es para vidrio de ${toMm(g.minThickness)} a ${toMm(g.maxThickness)} mm.`,
            zoneId: zone.id,
          });
        }
      } else if (hinge) {
        const crank = hinge.spec.crank;
        if ((front.mount === 'inset') !== (crank === 'inset')) {
          warnings.push({
            code: 'hardware_mismatch',
            message:
              front.mount === 'inset'
                ? `La puerta es encastrada y la bisagra «${hinge.name}» es para puertas superpuestas: hace falta una de codo 18.`
                : `La puerta es superpuesta y la bisagra «${hinge.name}» es para puertas encastradas.`,
            zoneId: zone.id,
          });
        }
      }
      continue;
    }

    // Cajones: frentes de arriba abajo.
    const n = front.sizes.length;
    const heights = resolveSizes(front.sizes, r.h - (n - 1) * gap, zone.id, warnings);
    if (zone.split) {
      warnings.push({
        code: 'drawer_on_split',
        message: 'Un hueco con estantes o divisores no puede llevar cajones: se dibujan los frentes pero no las cajas.',
        zoneId: zone.id,
      });
    }
    let top = r.y + r.h;
    heights.forEach((h, i) => {
      drawerCount++;
      const fy = top - h;
      top = fy - gap;
      const assembly: PartAssembly = { id: `${zone.id}/drawer${i}`, kind: 'drawer', name: `Cajón ${drawerCount}` };
      const key = `zone:${zone.id}/drawer${i}`;
      const label = `cajón ${drawerCount}`;
      if (h <= 0) return;
      addPart({
        key: `${key}/front`,
        role: 'drawer-front',
        name: `Frente ${label}`,
        materialId: fm.materialId,
        thickness: tf,
        length: r.w,
        width: h,
        box: { x: r.x, y: fy, z, dx: r.w, dy: h, dz: tf },
        zoneId: zone.id,
        edges: { ...frontEdges },
        assembly,
      });
      if (zone.split) return;
      addDrawerBox({ key, label, assembly, zoneId: zone.id, opening: box, fy, fh: h, inset: front.mount === 'inset' });
    });
  }

  /**
   * Caja de un cajón: dos laterales enteros, trasera y contrafrente entre laterales, y fondo.
   * Con corredera elegida, sus medidas mandan:
   * - de bolas o de rodillo: hueco a cada lado según la corredera y fondo = el largo de corredera más grande que entra;
   * - oculta bajo el cajón: ancho interior = hueco − descuento (42 mm en Blum Tandem), caja centrada, largo = nominal − descuento;
   * - cajón metálico: los laterales son de metal (no se cortan); solo fondo y trasera, con los descuentos del sistema.
   */
  function addDrawerBox(o: { key: string; label: string; assembly: PartAssembly; zoneId: string; opening: Box; fy: Len; fh: Len; inset: boolean }) {
    const dm = method.drawer;
    const td = thicknessOf(dm.materialId, 'los cajones');
    const tb = thicknessOf(dm.bottomMaterialId, 'el fondo de los cajones');
    const { opening: b } = o;
    const sl = slide?.spec;

    // Altura: la parte del frente que cae dentro del hueco, menos las holguras de arriba y abajo.
    const lo = Math.max(o.fy, b.y);
    const hi = Math.min(o.fy + o.fh, b.y + b.dy);
    const y0 = lo + dm.bottomClearance;
    const boxH = hi - lo - dm.bottomClearance - dm.topClearance;
    const frontDepth = o.inset ? tf : 0;
    const avail = b.dz - frontDepth - dm.rearClearance;

    // Largo de la corredera (si hay) y fondo de la caja.
    let nominal: Len | null = null;
    let depth: Len;
    if (sl) {
      nominal = pickLength(sl.lengths, avail);
      if (nominal === null) {
        warnings.push({
          code: 'drawer_too_small',
          message: `En el ${o.label} no entra ninguna «${slide!.name}»: hay ${toMm(Math.max(avail, 0))} mm de fondo libre y la más corta mide ${toMm(Math.min(...sl.lengths))} mm.`,
          zoneId: o.zoneId,
        });
        return;
      }
      depth = sl.type === 'undermount' ? nominal - sl.lengthDeduction : nominal;
    } else {
      depth = dm.depthStep > 0 && avail >= dm.depthStep ? Math.floor(avail / dm.depthStep) * dm.depthStep : avail;
    }

    // Ancho de la caja y posición.
    let boxW: Len;
    if (sl && sl.type === 'undermount') boxW = b.dx - sl.innerWidthDeduction + 2 * td;
    else if (sl && (sl.type === 'ball' || sl.type === 'roller')) boxW = b.dx - 2 * sl.sideClearance;
    else if (sl && sl.type === 'metal') boxW = b.dx - sl.bottomWidthDeduction;
    else boxW = b.dx - 2 * dm.sideClearance;
    const x0 = b.x + Math.round((b.dx - boxW) / 2);

    if (boxH < MIN_DRAWER_BOX_H || depth < MIN_DRAWER_DEPTH || boxW <= 2 * td) {
      warnings.push({
        code: 'drawer_too_small',
        message: `El ${o.label} no cabe: necesita al menos ${toMm(MIN_DRAWER_BOX_H)} mm de alto y ${toMm(MIN_DRAWER_DEPTH)} mm de fondo libres.`,
        zoneId: o.zoneId,
      });
      return;
    }
    if (sl && sl.type === 'undermount' && sl.maxSideThickness > 0 && td > sl.maxSideThickness) {
      warnings.push({
        code: 'hardware_mismatch',
        message: `La «${slide!.name}» admite laterales de hasta ${toMm(sl.maxSideThickness)} mm y los del método son de ${toMm(td)} mm.`,
        zoneId: o.zoneId,
      });
    }
    if (slide && nominal !== null) addItem(slide, 1, 'par', `de ${toMm(nominal)} mm`);

    const z0 = D - frontDepth - depth;
    const common = { thickness: td, materialId: dm.materialId, zoneId: o.zoneId, assembly: o.assembly };

    // Cajón metálico: solo fondo y trasera de madera.
    if (sl && sl.type === 'metal') {
      const bw = b.dx - sl.bottomWidthDeduction;
      const bd = nominal! - sl.bottomLengthDeduction;
      const backW = b.dx - sl.backWidthDeduction;
      addPart({
        key: `${o.key}/bottom`, role: 'drawer-bottom', name: `Fondo ${o.label}`, materialId: dm.bottomMaterialId, thickness: tb,
        length: bd, width: bw, box: { x: b.x + Math.round((b.dx - bw) / 2), y: y0, z: D - frontDepth - bd, dx: bw, dy: tb, dz: bd }, zoneId: o.zoneId, assembly: o.assembly, edges: { ...NO_EDGES },
      });
      addPart({
        ...common, key: `${o.key}/back`, role: 'drawer-back', name: `Trasera ${o.label}`, length: backW, width: boxH - tb,
        box: { x: b.x + Math.round((b.dx - backW) / 2), y: y0 + tb, z: D - frontDepth - bd, dx: backW, dy: boxH - tb, dz: td },
      });
      return;
    }

    const under = dm.bottomMode === 'under';
    const sy = under ? y0 + tb : y0; // los laterales apoyan sobre el fondo si va clavado debajo
    const sh = under ? boxH - tb : boxH;
    const innerBW = boxW - 2 * td;

    addPart({ ...common, key: `${o.key}/side.left`, role: 'drawer-side', name: `Lateral izquierdo ${o.label}`, length: depth, width: sh, box: { x: x0, y: sy, z: z0, dx: td, dy: sh, dz: depth } });
    addPart({ ...common, key: `${o.key}/side.right`, role: 'drawer-side', name: `Lateral derecho ${o.label}`, length: depth, width: sh, box: { x: x0 + boxW - td, y: sy, z: z0, dx: td, dy: sh, dz: depth } });
    addPart({ ...common, key: `${o.key}/back`, role: 'drawer-back', name: `Trasera ${o.label}`, length: innerBW, width: sh, box: { x: x0 + td, y: sy, z: z0, dx: innerBW, dy: sh, dz: td } });
    addPart({ ...common, key: `${o.key}/inner-front`, role: 'drawer-back', name: `Contrafrente ${o.label}`, length: innerBW, width: sh, box: { x: x0 + td, y: sy, z: z0 + depth - td, dx: innerBW, dy: sh, dz: td } });

    if (under) {
      addPart({
        key: `${o.key}/bottom`, role: 'drawer-bottom', name: `Fondo ${o.label}`, materialId: dm.bottomMaterialId, thickness: tb,
        length: depth, width: boxW, box: { x: x0, y: y0, z: z0, dx: boxW, dy: tb, dz: depth }, zoneId: o.zoneId, assembly: o.assembly, edges: { ...NO_EDGES },
      });
    } else {
      const into = Math.min(dm.grooveDepth, td);
      const bw = innerBW + 2 * into;
      const bd = depth - 2 * td + 2 * into;
      addPart({
        key: `${o.key}/bottom`, role: 'drawer-bottom', name: `Fondo ${o.label}`, materialId: dm.bottomMaterialId, thickness: tb,
        length: bd, width: bw, box: { x: x0 + td - into, y: y0 + dm.grooveHeight, z: z0 + td - into, dx: bw, dy: tb, dz: bd }, zoneId: o.zoneId, assembly: o.assembly, edges: { ...NO_EDGES },
      });
    }
  }

  // Numeración legible: Estante 1, 2... Divisor 1, 2...
  const counters: Partial<Record<PartRole, number>> = {};
  for (const p of parts) {
    if (p.role === 'shelf' || p.role === 'divider') {
      counters[p.role] = (counters[p.role] ?? 0) + 1;
      p.name = `${p.name} ${counters[p.role]}`;
    }
  }
  // Retranqueos elegidos a mano que chocan con el frente: el aviso lleva el nombre ya numerado.
  for (const c of collisions) {
    const name = parts.find((p) => p.key === c.key)?.name ?? 'Un estante';
    const front =
      c.clearance.what === 'sliding'
        ? `las puertas corredizas, que ocupan ${toMm(c.clearance.need)} mm desde el frente`
        : `el frente encastrado, de ${toMm(c.clearance.need)} mm`;
    warnings.push({
      code: 'front_collision',
      message: `${name}: con ${toMm(c.setback)} mm de retranqueo choca con ${front}. Retranquealo al menos ${toMm(c.clearance.need)} mm o quitá el cambio para que se ajuste solo.`,
      zoneId: c.zoneId,
    });
  }

  // Con una sola puerta, "Puerta" a secas.
  if (doorCount === 1) {
    const d = parts.find((p) => p.role === 'door' && !p.doorBox);
    if (d) d.name = 'Puerta';
  }
  // Marco y vidrio: «Parante izquierdo puerta 2 (izquierda)», o «… de la puerta» si hay una sola.
  for (const [key, name, num, side] of doorNames) {
    const p = parts.find((x) => x.key === key);
    if (p) p.name = doorCount === 1 ? (name === 'Puerta de vidrio' ? name : `${name} de la puerta`) : `${name} ${name === 'Puerta de vidrio' ? '' : 'puerta '}${num}${side}`.replace('  ', ' ');
  }

  // El mismo aviso (por ejemplo un material que falta) puede salir una vez por cajón: solo se muestra una.
  const seen = new Set<string>();
  const unique = warnings.filter((w) => {
    const k = `${w.code}|${w.message}|${w.zoneId ?? ''}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return { parts, zones, warnings: unique, hardware: [...items.values()], legs: [] };
}

/**
 * Tamaños de los huecos hijos. Los fijos se respetan; los `null` se reparten lo que sobra.
 * Si todos son fijos, el último absorbe la diferencia para que la suma cuadre siempre.
 */
export function resolveSizes(requested: readonly (Len | null)[], avail: Len, zoneId: string, warnings: Warning[]): Len[] {
  const fixed = requested.reduce<number>((s, v) => s + (v ?? 0), 0);
  const autoCount = requested.filter((v) => v === null).length;
  let remaining = avail - fixed;

  if (remaining < 0) {
    warnings.push({
      code: 'fixed_sizes_exceed',
      message: `Las medidas fijas suman ${toMm(fixed)} mm y solo caben ${toMm(Math.max(avail, 0))} mm.`,
      zoneId,
    });
  }

  let sizes: Len[];
  if (autoCount > 0) {
    const auto = distribute(Math.max(remaining, 0), autoCount);
    let k = 0;
    sizes = requested.map((v) => (v === null ? (auto[k++] ?? 0) : v));
  } else {
    sizes = [...requested] as Len[];
    const last = sizes.length - 1;
    sizes[last] = (sizes[last] ?? 0) + remaining;
    remaining = 0;
  }

  if (sizes.some((s) => s <= 0)) {
    warnings.push({ code: 'zone_too_small', message: 'Hay huecos sin espacio: quita divisiones o reduce las medidas fijas.', zoneId });
  }
  return sizes;
}
