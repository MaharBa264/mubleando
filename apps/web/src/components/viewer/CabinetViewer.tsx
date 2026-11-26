'use client';

import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber';
import { Edges, Html, Line, OrbitControls, OrthographicCamera, PerspectiveCamera } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import { ExtrudeGeometry, Shape } from 'three';
import type { Box, LegOut, Material, Part, ZoneOut } from '@mw/engine';
import { LegMesh } from './LegMesh';
import type { FrontsView, Selection } from '@/components/editor/store';

/** Len (1/100 mm) → metros de la escena. */
const S = 1 / 100_000;

/** Lee un token CSS (var(--x)) para usarlo como color de three.js. */
function resolveColor(value: string | undefined, fallback = '#cccccc'): string {
  if (!value) return fallback;
  const m = /^var\((--[\w-]+)\)$/.exec(value.trim());
  if (!m) return value;
  if (typeof window === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(m[1]!).trim() || fallback;
}

const center = (b: Box): [number, number, number] => [(b.x + b.dx / 2) * S, (b.y + b.dy / 2) * S, (b.z + b.dz / 2) * S];
const size = (b: Box, inset = 0): [number, number, number] => [
  Math.max(b.dx - inset, 1) * S,
  Math.max(b.dy - inset, 1) * S,
  Math.max(b.dz - inset, 1) * S,
];

/** Geometría de una pieza: caja normal, tapa inclinada (largo hipotenusa) o trapecio extruido para corte diagonal. */
function PartGeometry({ part }: { part: Part }) {
  const dc = part.diagonalCut;
  const extrudeGeo = useMemo(() => {
    if (!dc) return null;
    const [w, h, d] = size(part.box);
    const hl = Math.max(dc.heightLeft, 1) * S;
    const hr = Math.max(dc.heightRight, 1) * S;
    const shape = new Shape();
    shape.moveTo(-w / 2, -h / 2);
    shape.lineTo(w / 2, -h / 2);
    shape.lineTo(w / 2, -h / 2 + hr);
    shape.lineTo(-w / 2, -h / 2 + hl);
    shape.closePath();
    const geo = new ExtrudeGeometry(shape, { depth: d, bevelEnabled: false });
    geo.translate(0, 0, -d / 2);
    return geo;
  }, [dc, part.box]);

  useEffect(() => {
    return () => {
      extrudeGeo?.dispose();
    };
  }, [extrudeGeo]);

  if (extrudeGeo) {
    return <primitive object={extrudeGeo} attach="geometry" />;
  }
  if (part.slopeDeg) {
    return <boxGeometry args={[Math.max(part.length, 1) * S, Math.max(part.box.dy, 1) * S, Math.max(part.box.dz, 1) * S]} />;
  }
  return <boxGeometry args={size(part.box)} />;
}

type Hit = { kind: 'part'; key: string } | { kind: 'zone'; id: string };

/** Ángulo de apertura de las puertas en la vista "abiertos". */
const DOOR_OPEN = (95 * Math.PI) / 180;
/** Fracción del fondo que salen los cajones en la vista "abiertos". */
const DRAWER_OUT = 0.6;

const isFront = (p: Part) => p.role === 'door' || p.role === 'drawer-front' || !!p.doorBox;

/**
 * Dónde se dibuja cada pieza según la vista de frentes:
 * - puertas abiertas: giran sobre el canto de las bisagras;
 * - cajones abiertos: todas sus piezas salen hacia delante el 60 % de su fondo.
 */
type V3 = [number, number, number];
const Y0: V3 = [0, 0, 0];

function placement(p: Part, mode: FrontsView, drawerDepth: Map<string, number>): { group: V3; rot: V3; mesh: V3 } {
  const c = center(p.box);
  if (mode !== 'open') return { group: [0, 0, 0] as [number, number, number], rot: Y0, mesh: c };
  if (p.role === 'door' && p.track) {
    // Corrediza abierta: las hojas de adelante se corren media hoja a la izquierda; las de atrás, a la derecha.
    const shift = (p.box.dx / 2) * S * (p.track === 'front' ? -1 : 1);
    return { group: [shift, 0, 0] as [number, number, number], rot: Y0, mesh: c };
  }
  if (p.role === 'door' || p.doorBox) {
    // Las puertas de marco y vidrio giran todas sus piezas sobre el canto de las bisagras de la puerta entera.
    const b = p.doorBox ?? p.box;
    if (p.hinge === 'top' || p.hinge === 'bottom') {
      // Hacia arriba gira sobre el canto de arriba; hacia abajo, sobre el de abajo (hasta quedar horizontal).
      const top = p.hinge === 'top';
      const pivot: V3 = [c[0], (top ? b.y + b.dy : b.y) * S, b.z * S];
      return { group: pivot, rot: [top ? -DOOR_OPEN : Math.PI / 2, 0, 0], mesh: [0, c[1] - pivot[1], c[2] - pivot[2]] };
    }
    const left = p.hinge !== 'right';
    const pivot: V3 = [(left ? b.x : b.x + b.dx) * S, c[1], b.z * S];
    return { group: pivot, rot: [0, left ? -DOOR_OPEN : DOOR_OPEN, 0], mesh: [c[0] - pivot[0], 0, c[2] - pivot[2]] };
  }
  if (p.assembly?.kind === 'drawer') {
    const out = (drawerDepth.get(p.assembly.id) ?? 0) * DRAWER_OUT * S;
    return { group: [0, 0, out] as [number, number, number], rot: Y0, mesh: c };
  }
  return { group: [0, 0, 0] as [number, number, number], rot: Y0, mesh: c };
}

/**
 * Decide qué se ha tocado. Los huecos cubren la cara de los estantes, así que si una pieza
 * aparece menos de 3 cm detrás de la entrada al hueco, se elige la pieza.
 */
function pick(e: ThreeEvent<PointerEvent | MouseEvent>): Hit | null {
  let zone: { id: string; d: number } | null = null;
  let part: { key: string; d: number } | null = null;
  for (const it of e.intersections) {
    const u = it.object.userData as Partial<Hit>;
    if (u.kind === 'zone' && !zone) zone = { id: (u as { id: string }).id, d: it.distance };
    if (u.kind === 'part' && !part) part = { key: (u as { key: string }).key, d: it.distance };
  }
  if (part && (!zone || part.d - zone.d < 0.03)) return { kind: 'part', key: part.key };
  if (zone) return { kind: 'zone', id: zone.id };
  return null;
}

export interface ViewerProps {
  size: { w: number; h: number; d: number };
  parts: Part[];
  zones: ZoneOut[];
  materials: Material[];
  selection: Selection;
  hover: string | null;
  view: { ortho: boolean; wire: boolean; cameraKey: number; fronts: FrontsView; dims: boolean };
  onSelect: (s: Selection) => void;
  onHover: (id: string | null) => void;
  /** Patas del mueble. */
  legs?: LegOut[];
}

export default function CabinetViewer(props: ViewerProps) {
  return (
    <Canvas
      dpr={[1, 2]}
      shadows={false}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      onPointerMissed={() => props.onSelect({ kind: 'cabinet' })}
      aria-label="Vista 3D del mueble"
      role="img"
    >
      <Scene {...props} />
    </Canvas>
  );
}

function Scene({ size: dims, parts, zones, materials, selection, hover, view, onSelect, onHover, legs = [] }: ViewerProps) {
  const colors = useMemo(() => {
    const m = new Map(materials.map((x) => [x.id, resolveColor(x.color)]));
    return {
      mat: (id: string) => m.get(id) ?? '#cccccc',
      sel: resolveColor('var(--sel)', '#e07a1f'),
      zone: resolveColor('var(--zone)', '#1f6f5c'),
      line: resolveColor('var(--viewer-line)', '#5c574d'),
    };
  }, [materials]);

  const offset: [number, number, number] = [(-dims.w * S) / 2, (-dims.h * S) / 2, (-dims.d * S) / 2];
  const selectedZone = selection.kind === 'zone' ? selection.id : null;
  const selectedPart = selection.kind === 'part' ? selection.key : null;
  const visibleZones = zones.filter((z) => z.isLeaf || z.id === selectedZone);
  const shown = view.fronts === 'hidden' ? parts.filter((p) => !isFront(p)) : parts;
  // Plano delantero (incluye puertas superpuestas) para colocar las cotas por delante del mueble.
  const frontZ = Math.max(dims.d, ...parts.map((p) => p.box.z + p.box.dz));
  const zoneOfSel = selectedZone ? zones.find((z) => z.id === selectedZone) : undefined;
  const drawerDepth = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of parts) if (p.role === 'drawer-side' && p.assembly) m.set(p.assembly.id, Math.max(m.get(p.assembly.id) ?? 0, p.length));
    return m;
  }, [parts]);

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 6) return; // fue un arrastre para girar, no un toque
    const hit = pick(e);
    if (hit?.kind === 'part') onSelect({ kind: 'part', key: hit.key });
    else if (hit?.kind === 'zone') onSelect({ kind: 'zone', id: hit.id });
  };
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const hit = pick(e);
    const id = hit ? (hit.kind === 'part' ? `part:${hit.key}` : `zone:${hit.id}`) : null;
    if (id !== hover) onHover(id);
    document.body.style.cursor = hit ? 'pointer' : '';
  };

  return (
    <>
      <CameraRig key={view.cameraKey} ortho={view.ortho} dims={dims} />
      <ambientLight intensity={0.65} />
      <directionalLight position={[2, 3, 4]} intensity={1.6} />
      <directionalLight position={[-3, 1, -2]} intensity={0.35} />

      <group
        position={offset}
        onClick={onClick}
        onPointerMove={onMove}
        onPointerOut={() => {
          onHover(null);
          document.body.style.cursor = '';
        }}
      >
        {shown.map((p) => {
          const isSel = p.key === selectedPart;
          const isHover = hover === `part:${p.key}`;
          const pl = placement(p, view.fronts, drawerDepth);
          const meshRot: V3 = p.slopeDeg ? [0, 0, (p.slopeDeg * Math.PI) / 180] : Y0;
          return (
            <group key={p.key} position={pl.group} rotation={pl.rot}>
              <mesh position={pl.mesh} rotation={meshRot} userData={{ kind: 'part', key: p.key }}>
                <PartGeometry part={p} />
                <meshStandardMaterial
                  color={isSel ? colors.sel : colors.mat(p.materialId)}
                  emissive={isSel ? colors.sel : '#000000'}
                  emissiveIntensity={isSel ? 0.25 : 0}
                  wireframe={view.wire}
                  transparent={view.wire || p.role === 'glass'}
                  opacity={p.role === 'glass' ? 0.4 : isHover && !isSel ? 0.85 : 1}
                  roughness={0.8}
                />
                {!view.wire && <Edges color={isSel ? colors.sel : colors.line} threshold={15} />}
              </mesh>
            </group>
          );
        })}

        {legs.map((l, i) => (
          <LegMesh key={i} leg={l} color={resolveColor('var(--mat-walnut)', '#7a5a3a')} line={colors.line} wire={view.wire} />
        ))}

        {view.dims && <Dimensions dims={dims} frontZ={frontZ} color={colors.line} />}
        {view.dims && zoneOfSel && <ZoneLabel box={zoneOfSel.box} />}

        {visibleZones.map((z) => {
          const isSel = z.id === selectedZone;
          const isHover = hover === `zone:${z.id}`;
          return (
            <mesh key={z.id} position={center(z.box)} userData={{ kind: 'zone', id: z.id }} renderOrder={1}>
              {/* encogido 1 mm para que no pelee con las caras de los tableros */}
              <boxGeometry args={size(z.box, 100)} />
              <meshBasicMaterial color={isSel ? colors.sel : colors.zone} transparent depthWrite={false} opacity={isSel ? 0.22 : isHover ? 0.12 : 0} />
              {isSel && <Edges color={colors.sel} />}
            </mesh>
          );
        })}
      </group>
    </>
  );
}

function CameraRig({ ortho, dims }: { ortho: boolean; dims: { w: number; h: number; d: number } }) {
  const viewport = useThree((s) => s.size);
  const span = Math.max(dims.w, dims.h, dims.d) * S;
  const dist = span * 2.6;
  const pos: [number, number, number] = [dist * 0.55, dist * 0.35, dist];
  const fit = Math.min(viewport.width / (dims.w * S * 1.9), viewport.height / (dims.h * S * 1.6));
  return (
    <>
      {ortho ? (
        <OrthographicCamera makeDefault position={pos} zoom={fit} near={0.01} far={100} />
      ) : (
        <PerspectiveCamera makeDefault position={pos} fov={32} near={0.01} far={100} />
      )}
      <OrbitControls makeDefault enableDamping dampingFactor={0.12} target={[0, 0, 0]} />
    </>
  );
}

/** Etiqueta de cota: número en mm, sin decimales innecesarios, con coma decimal. */
const fmt = (len: number) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 }).format(len / 100);

function DimLabel({ position, children }: { position: [number, number, number]; children: string }) {
  return (
    <Html position={position} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
      <span className="measure whitespace-nowrap rounded-full border border-border bg-surface/95 px-2 py-0.5 text-[11px] font-medium text-text shadow-float">{children}</span>
    </Html>
  );
}

/**
 * Cotas generales: ancho por debajo del frente, alto a la izquierda y fondo a la derecha,
 * separadas 6 cm del mueble para que no tapen nada.
 */
function Dimensions({ dims, frontZ, color }: { dims: { w: number; h: number; d: number }; frontZ: number; color: string }) {
  const off = 6000;
  const W = dims.w * S, H = dims.h * S, D = dims.d * S, Z = frontZ * S, o = off * S, t = 1500 * S;
  return (
    <group>
      <Line points={[[0, -o, Z], [W, -o, Z]]} color={color} lineWidth={1} />
      <Line points={[[0, -o - t, Z], [0, -o + t, Z]]} color={color} lineWidth={1} />
      <Line points={[[W, -o - t, Z], [W, -o + t, Z]]} color={color} lineWidth={1} />
      <DimLabel position={[W / 2, -o, Z]}>{fmt(dims.w)}</DimLabel>

      <Line points={[[-o, 0, Z], [-o, H, Z]]} color={color} lineWidth={1} />
      <Line points={[[-o - t, 0, Z], [-o + t, 0, Z]]} color={color} lineWidth={1} />
      <Line points={[[-o - t, H, Z], [-o + t, H, Z]]} color={color} lineWidth={1} />
      <DimLabel position={[-o, H / 2, Z]}>{fmt(dims.h)}</DimLabel>

      <Line points={[[W + o, 0, 0], [W + o, 0, D]]} color={color} lineWidth={1} />
      <DimLabel position={[W + o, 0, D / 2]}>{fmt(dims.d)}</DimLabel>
    </group>
  );
}

/** Medida libre del hueco elegido (ancho × alto), en su centro, por delante. */
function ZoneLabel({ box }: { box: Box }) {
  const c = center(box);
  return <DimLabel position={[c[0], c[1], (box.z + box.dz) * S]}>{`${fmt(box.dx)} × ${fmt(box.dy)}`}</DimLabel>;
}
