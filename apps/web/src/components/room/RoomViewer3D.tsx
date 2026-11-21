'use client';

import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { Edges, OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { useMemo, useRef, useState } from 'react';
import { DoubleSide, Shape } from 'three';
import { wallPieces, walls, type LegOut, type Material, type Part, type PlanPoint, type RoomPlan } from '@mw/engine';
import { LegMesh } from '@/components/viewer/LegMesh';

/** Centésimas de mm → metros de la escena. */
const S = 1 / 100_000;

function resolveColor(value: string | undefined, fallback = '#cccccc'): string {
  if (!value) return fallback;
  const m = /^var\((--[\w-]+)\)$/.exec(value.trim());
  if (!m) return value;
  if (typeof window === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(m[1]!).trim() || fallback;
}

/** Planta (x, y) → forma de three.js en el plano XY (se gira después para que quede horizontal). */
function shapeOf(points: readonly PlanPoint[]) {
  const s = new Shape();
  points.forEach((p, i) => (i === 0 ? s.moveTo(p.x * S, p.y * S) : s.lineTo(p.x * S, p.y * S)));
  s.closePath();
  return s;
}

/**
 * Prisma vertical de planta `points` entre dos alturas. La extrusión de three.js va en +Z de la forma;
 * girando 90° sobre X, la forma queda en el piso (y de la planta → z de la escena) y la extrusión
 * baja en −Y: por eso se coloca en la altura de arriba.
 */
function Prism({ points, y0, y1, color, opacity = 1 }: { points: readonly PlanPoint[]; y0: number; y1: number; color: string; opacity?: number }) {
  const shape = useMemo(() => shapeOf(points), [points]);
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, y1 * S, 0]}>
      <extrudeGeometry args={[shape, { depth: (y1 - y0) * S, bevelEnabled: false }]} />
      {/* Siempre "transparent": así cambiar la opacidad no obliga a recompilar el material. */}
      <meshStandardMaterial color={color} transparent opacity={opacity} depthWrite={opacity >= 1} side={DoubleSide} roughness={0.95} />
    </mesh>
  );
}

export interface PlacedCabinet {
  placementId: string;
  x: number;
  y: number;
  rotation: number;
  elevation: number;
  parts: Part[];
  /** Patas del mueble (si lleva). */
  legs?: LegOut[];
}

/** Cómo se ven las paredes: 'auto' = transparentes solo las que tapan la vista desde la cámara. */
export type WallsMode = 'auto' | 'ghost' | 'solid';

export interface RoomViewerProps {
  plan: RoomPlan;
  placed: PlacedCabinet[];
  materials: Material[];
  selectedId: string | null;
  wallsMode: WallsMode;
  onSelect: (placementId: string | null) => void;
}

/** Vista 3D del ambiente: piso, paredes con sus huecos y los muebles colocados (con frentes cerrados). */
export default function RoomViewer3D(props: RoomViewerProps) {
  const { plan } = props;
  const xs = plan.corners.map((c) => c.x);
  const ys = plan.corners.map((c) => c.y);
  const cx = ((Math.min(...xs) + Math.max(...xs)) / 2) * S;
  const cz = ((Math.min(...ys) + Math.max(...ys)) / 2) * S;
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * S;
  return (
    <Canvas dpr={[1, 2]} onPointerMissed={() => props.onSelect(null)} aria-label="Vista 3D del ambiente" role="img">
      <PerspectiveCamera makeDefault position={[cx + span * 0.35, span * 1.1 + 1.5, cz + span * 1.25]} fov={40} near={0.05} far={200} />
      <OrbitControls makeDefault target={[cx, 0.9, cz]} enableDamping dampingFactor={0.12} maxPolarAngle={Math.PI * 0.49} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[cx + 4, 8, cz + 6]} intensity={1.4} />
      <directionalLight position={[cx - 5, 4, cz - 3]} intensity={0.35} />
      <Scene {...props} />
    </Canvas>
  );
}

/**
 * Paredes que tapan la vista: las que dejan la cámara del lado de fuera de su cara interior.
 * Se recalcula en cada fotograma, pero solo se actualiza el estado cuando cambia el conjunto.
 */
function useOccluding(plan: RoomPlan, mode: WallsMode) {
  const ws = useMemo(() => walls(plan), [plan]);
  const [hidden, setHidden] = useState<ReadonlySet<number>>(new Set());
  const last = useRef('');
  useFrame(({ camera }) => {
    if (mode !== 'auto') return;
    const cx = camera.position.x / S;
    const cy = camera.position.z / S;
    const ids = ws.filter((w) => (cx - w.a.x) * w.inward.x + (cy - w.a.y) * w.inward.y < 0).map((w) => w.index);
    const key = ids.join(',');
    if (key !== last.current) {
      last.current = key;
      setHidden(new Set(ids));
    }
  });
  return mode === 'ghost' ? null : mode === 'solid' ? new Set<number>() : hidden;
}

function Scene({ plan, placed, materials, selectedId, wallsMode, onSelect }: RoomViewerProps) {
  const colors = useMemo(() => {
    const m = new Map(materials.map((x) => [x.id, resolveColor(x.color)]));
    return {
      mat: (id: string) => m.get(id) ?? '#cccccc',
      wall: resolveColor('var(--surface-2)', '#e8e5df'),
      floor: resolveColor('var(--mat-sand)', '#d8c8a8'),
      leg: resolveColor('var(--mat-walnut)', '#7a5a3a'),
      sel: resolveColor('var(--sel)', '#e07a1f'),
      line: resolveColor('var(--viewer-line)', '#5c574d'),
    };
  }, [materials]);
  const pieces = useMemo(() => wallPieces(plan), [plan]);
  // null = todas transparentes; si no, el conjunto de paredes que tapan la vista.
  const occluding = useOccluding(plan, wallsMode);

  return (
    <>
      <Prism points={plan.corners} y0={-2000} y1={0} color={colors.floor} />
      {pieces.map((p, i) => (
        <Prism key={i} points={p.quad} y0={p.y0} y1={p.y1} color={colors.wall} opacity={occluding === null || occluding.has(p.wallIndex) ? 0.18 : 1} />
      ))}
      {placed.map((c) => {
        const isSel = c.placementId === selectedId;
        return (
          <group
            key={c.placementId}
            position={[c.x * S, c.elevation * S, c.y * S]}
            rotation={[0, (-c.rotation * Math.PI) / 180, 0]}
            onClick={(e: ThreeEvent<MouseEvent>) => {
              e.stopPropagation();
              if (e.delta > 6) return;
              onSelect(c.placementId);
            }}
          >
            {c.parts.map((p) => (
              <mesh key={p.key} position={[(p.box.x + p.box.dx / 2) * S, (p.box.y + p.box.dy / 2) * S, (p.box.z + p.box.dz / 2) * S]}>
                <boxGeometry args={[Math.max(p.box.dx, 1) * S, Math.max(p.box.dy, 1) * S, Math.max(p.box.dz, 1) * S]} />
                <meshStandardMaterial
                  color={isSel ? colors.sel : colors.mat(p.materialId)}
                  emissive={isSel ? colors.sel : '#000000'}
                  emissiveIntensity={isSel ? 0.2 : 0}
                  transparent={p.role === 'glass'}
                  opacity={p.role === 'glass' ? 0.4 : 1}
                  roughness={0.8}
                />
                <Edges color={isSel ? colors.sel : colors.line} threshold={15} />
              </mesh>
            ))}
            {(c.legs ?? []).map((l, i) => (
              <LegMesh key={`pata${i}`} leg={l} color={isSel ? colors.sel : colors.leg} line={colors.line} wire={false} />
            ))}
          </group>
        );
      })}
    </>
  );
}
