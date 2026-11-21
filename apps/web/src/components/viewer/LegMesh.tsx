'use client';

import { Edges } from '@react-three/drei';
import { useMemo } from 'react';
import { Quaternion, Vector3 } from 'three';
import type { LegOut } from '@mw/engine';

/** Len (1/100 mm) → metros de la escena. */
const S = 1 / 100_000;

/**
 * Una pata: tronco de cono (o de pirámide de 4 lados, girado 45°, si es cuadrada) entre la cara de
 * abajo del mueble y el piso; inclinada si el pie se abre hacia afuera.
 */
export function LegMesh({ leg, color, line, wire }: { leg: LegOut; color: string; line: string; wire: boolean }) {
  const { pos, quat, len } = useMemo(() => {
    const axis = new Vector3((leg.top.x - leg.foot.x) * S, leg.height * S, (leg.top.z - leg.foot.z) * S);
    const l = axis.length();
    return {
      pos: [((leg.top.x + leg.foot.x) / 2) * S, (leg.height / 2) * S, ((leg.top.z + leg.foot.z) / 2) * S] as [number, number, number],
      quat: new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), axis.normalize()),
      len: l,
    };
  }, [leg]);
  const square = leg.section === 'square';
  const k = square ? Math.SQRT1_2 : 0.5;
  return (
    <group position={pos} quaternion={quat}>
      <mesh rotation={[0, square ? Math.PI / 4 : 0, 0]}>
        <cylinderGeometry args={[leg.topSize * k * S, leg.bottomSize * k * S, len, square ? 4 : 24]} />
        <meshStandardMaterial color={color} wireframe={wire} roughness={0.6} metalness={0.1} />
        {!wire && <Edges color={line} threshold={30} />}
      </mesh>
      {leg.plate && (
        <mesh position={[0, len / 2 - 1.5 / 1000, 0]}>
          <boxGeometry args={[leg.topSize * 1.6 * S, 3 / 1000, leg.topSize * 1.6 * S]} />
          <meshStandardMaterial color={line} roughness={0.5} metalness={0.4} />
        </mesh>
      )}
    </group>
  );
}

