'use client';

import { Edges } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import { ExtrudeGeometry, Shape } from 'three';
import type { CornerMechanismOut } from '@mw/engine';

const S = 1 / 100_000;

/**
 * Volumen 3D simple del mecanismo de esquina ciego:
 * - 'pull-out' (rinconero extraíble): 2 niveles × 2 canastos (delantero + trasero). Con frentes abiertos,
 *   los canastos delanteros salen por la puerta y los traseros se desplazan hacia la abertura.
 * - 'half-moon' (media luna): 2 bandejas semicirculares que giran hacia afuera por la puerta al abrir.
 */
export function CornerMechanismMesh({
  mechanism,
  open,
  line,
  wire,
}: {
  mechanism: CornerMechanismOut;
  open: boolean;
  line: string;
  wire: boolean;
}) {
  const { box: b, type, blindSide, doorWidth } = mechanism;
  const metalColor = '#8f99a8';
  const shelfColor = '#e2e6ec';

  const halfMoonGeo = useMemo(() => {
    if (type !== 'half-moon') return null;
    const radius = Math.max(Math.min(b.dz * 0.44, doorWidth * 0.85), 8000) * S;
    const thick = 0.022;
    const s = new Shape();
    s.absarc(0, 0, radius, 0, Math.PI, false);
    s.closePath();
    const g = new ExtrudeGeometry(s, { depth: thick, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    return g;
  }, [type, b.dz, doorWidth]);

  useEffect(() => {
    return () => {
      halfMoonGeo?.dispose();
    };
  }, [halfMoonGeo]);

  const levels = [b.y + b.dy * 0.24, b.y + b.dy * 0.66];
  const openLeft = blindSide === 'right'; // puerta a la izquierda, panel ciego a la derecha
  const doorCenterX = openLeft ? b.x + doorWidth / 2 : b.x + b.dx - doorWidth / 2;
  const blindCenterX = openLeft ? b.x + b.dx - (b.dx - doorWidth) / 2 : b.x + (b.dx - doorWidth) / 2;

  if (type === 'half-moon' && halfMoonGeo) {
    const pivotX = openLeft ? b.x + doorWidth * 0.92 : b.x + b.dx - doorWidth * 0.92;
    const pivotZ = b.z + b.dz * 0.82;
    const rotY = open ? (openLeft ? -Math.PI * 0.55 : Math.PI * 0.55) : 0;
    const pullZ = open ? b.dz * 0.28 : 0;
    return (
      <group>
        {/* Eje vertical central */}
        <mesh position={[pivotX * S, (b.y + b.dy / 2) * S, pivotZ * S]}>
          <cylinderGeometry args={[0.014, 0.014, b.dy * S * 0.94, 12]} />
          <meshStandardMaterial color={metalColor} roughness={0.4} metalness={0.5} wireframe={wire} />
        </mesh>
        {levels.map((ly, i) => (
          <group key={i} position={[pivotX * S, ly * S, (pivotZ + pullZ) * S]} rotation={[0, rotY, 0]}>
            <mesh geometry={halfMoonGeo} rotation={[0, openLeft ? Math.PI : 0, 0]}>
              <meshStandardMaterial color={shelfColor} roughness={0.5} metalness={0.2} wireframe={wire} />
              {!wire && <Edges color={line} threshold={15} />}
            </mesh>
          </group>
        ))}
      </group>
    );
  }

  // Rinconero extraíble ('pull-out'): canastos delanteros + traseros
  const basketH = Math.min(b.dy * 0.16, 10000);
  const frontW = Math.max(doorWidth * 0.78, 15000);
  const backW = Math.max((b.dx - doorWidth) * 0.78, 15000);
  const basketD = Math.max(b.dz * 0.76, 20000);
  const zBase = b.z + b.dz * 0.5;
  const frontShiftZ = open ? b.dz * 0.85 : 0;
  const backShiftX = open ? (doorCenterX - blindCenterX) * 0.78 : 0;
  const backShiftZ = open ? b.dz * 0.12 : 0;

  return (
    <group>
      {/* Bastidor / riel guía inferior */}
      <mesh position={[(b.x + b.dx / 2) * S, (b.y + 1200) * S, zBase * S]}>
        <boxGeometry args={[b.dx * 0.88 * S, 0.018, b.dz * 0.12 * S]} />
        <meshStandardMaterial color={metalColor} roughness={0.4} metalness={0.5} wireframe={wire} />
      </mesh>
      {levels.map((ly, i) => (
        <group key={i}>
          {/* Canasto delantero (sale con la puerta) */}
          <mesh position={[doorCenterX * S, ly * S, (zBase + frontShiftZ) * S]}>
            <boxGeometry args={[frontW * S, basketH * S, basketD * S]} />
            <meshStandardMaterial color={shelfColor} roughness={0.55} metalness={0.15} wireframe={wire} />
            {!wire && <Edges color={line} threshold={15} />}
          </mesh>
          {/* Canasto trasero (se corre hacia la puerta al abrir) */}
          <mesh position={[(blindCenterX + backShiftX) * S, ly * S, (zBase + backShiftZ) * S]}>
            <boxGeometry args={[backW * S, basketH * S, basketD * S]} />
            <meshStandardMaterial color={metalColor} roughness={0.5} metalness={0.25} wireframe={wire} />
            {!wire && <Edges color={line} threshold={15} />}
          </mesh>
        </group>
      ))}
    </group>
  );
}
