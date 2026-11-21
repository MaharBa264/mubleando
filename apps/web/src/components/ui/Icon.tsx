import type { SVGProps } from 'react';

/**
 * Iconos de la app: dibujados a mano, de trazo, en una grilla de 24 × 24 con trazo de 1,75.
 * Heredan el color del texto (currentColor), así que siguen los tokens y el modo oscuro solos.
 *
 * Reglas (docs/diseno.md):
 * - Un icono siempre va acompañado de texto visible o de aria-label en el botón que lo contiene.
 * - Para agregar uno nuevo, sumarlo a PATHS con el mismo estilo: trazos redondeados, sin rellenos.
 */
const PATHS = {
  back: 'M15 5l-7 7 7 7',
  undo: 'M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  redo: 'M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13',
  close: 'M6 6l12 12M18 6L6 18',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  check: 'M5 12.5l4.5 4.5L19 7',
  /** cubo en perspectiva */
  cube: 'M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3zM4 7.5l8 4.5 8-4.5M12 12v9',
  /** cubo plano (proyección ortogonal) */
  square: 'M5 5h14v14H5zM5 12h14',
  /** malla alámbrica */
  wire: 'M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3zM4 7.5l8 4.5 8-4.5M12 12v9M4 16.5l8-4.5 8 4.5',
  /** regla para cotas */
  ruler: 'M3 16.5L16.5 3 21 7.5 7.5 21 3 16.5zM7 12.5l2 2M10 9.5l2 2M13 6.5l2 2',
  /** puerta entreabierta */
  door: 'M5 21V3h9v18M14 4l5 2v14l-5 1M11 12h.01',
  /** encuadrar */
  focus: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5M12 12h.01',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  layers: 'M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5',
  sliders: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M14 4v4M8 10v4M16 16v4',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18, ...rest }: { name: IconName; size?: number } & Omit<SVGProps<SVGSVGElement>, 'name'>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
