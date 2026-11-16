'use client';

import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber';
import { Edges, OrbitControls, OrthographicCamera, PerspectiveCamera } from '@react-three/drei';
import { useMemo } from 'react';
import type { Box, Material, Part, ZoneOut } from '@mw/engine';
import type { Selection } from '@/components/editor/store';

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

type Hit = { kind: 'part'; key: string } | { kind: 'zone'; id: string };

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
  view: { ortho: boolean; wire: boolean; cameraKey: number };
  onSelect: (s: Selection) => void;
  onHover: (id: string | null) => void;
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

function Scene({ size: dims, parts, zones, materials, selection, hover, view, onSelect, onHover }: ViewerProps) {
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
        {parts.map((p) => {
          const isSel = p.key === selectedPart;
          const isHover = hover === `part:${p.key}`;
          return (
            <mesh key={p.key} position={center(p.box)} userData={{ kind: 'part', key: p.key }}>
              <boxGeometry args={size(p.box)} />
              <meshStandardMaterial
                color={isSel ? colors.sel : colors.mat(p.materialId)}
                emissive={isSel ? colors.sel : '#000000'}
                emissiveIntensity={isSel ? 0.25 : 0}
                wireframe={view.wire}
                transparent={view.wire}
                opacity={isHover && !isSel ? 0.85 : 1}
                roughness={0.8}
              />
              {!view.wire && <Edges color={isSel ? colors.sel : colors.line} threshold={15} />}
            </mesh>
          );
        })}

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
