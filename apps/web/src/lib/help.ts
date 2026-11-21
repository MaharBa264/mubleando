/**
 * Textos de ayuda de la app, en un solo lugar para que crezcan con cada función nueva sin tocar las
 * pantallas. Los usan la explicación del inicio (components/HelpIntro.tsx) y la página /ayuda.
 */

export interface HelpStep {
  title: string;
  /** Qué se hace, en una o dos frases. */
  text: string;
  /** Dónde se toca, paso a paso. */
  how: string[];
  /** Icono del paso (nombre de components/ui/Icon, o un dibujo propio). */
  art: 'project' | 'cabinet' | 'cutlist' | 'room' | 'library';
}

export const HELP_INTRO = 'Diseñás el mueble con sus medidas; la app calcula cada pieza con sus cantos, la lista para la maderera y el costo.';

export const HELP_STEPS: HelpStep[] = [
  {
    title: 'Creá un proyecto y un mueble',
    text: 'Un proyecto agrupa los muebles de un trabajo (una cocina, un placard). Cada mueble parte de una plantilla o de una caja con tus medidas.',
    how: ['En Proyectos, tocá Nuevo proyecto.', 'Dentro del proyecto, tocá Nuevo mueble y elegí una plantilla o «En blanco».'],
    art: 'project',
  },
  {
    title: 'Dividilo y ponele frentes',
    text: 'Tocá un hueco en el dibujo 3D o en la lista de la izquierda. Con la barra que aparece le agregás estantes, divisores, puertas, corredizas o cajones.',
    how: [
      'Las medidas de lo elegido se cambian en Propiedades (a la derecha, o abajo en el celular).',
      'Tocá una pieza para cambiarle el material, los cantos o el retranqueo.',
      'Ctrl+Z deshace y Ctrl+Y rehace.',
    ],
    art: 'cabinet',
  },
  {
    title: 'Mirá el despiece y el costo',
    text: 'Cada pieza con su medida de corte (descontando cantos), sus cantos, los herrajes que lleva y el costo total en pesos.',
    how: ['En el mueble o en el proyecto, tocá Despiece.', 'Descargar CSV para mandarlo a la maderera, o Imprimir.', 'STL exporta el mueble para imprimirlo en 3D, también como juguete que funciona.'],
    art: 'cutlist',
  },
  {
    title: 'Armá el ambiente',
    text: 'Dibujá la planta de la habitación con sus medidas reales (también fuera de escuadra), sus puertas y ventanas, y colocá los muebles.',
    how: ['En el proyecto, tocá Nuevo ambiente.', 'Arrastrá las esquinas para ajustar las paredes y los muebles para ubicarlos.', 'La vista 3D transparenta las paredes que tapan.'],
    art: 'room',
  },
  {
    title: 'Cargá tus materiales y precios',
    text: 'Tableros, cantos, métodos de fabricación y herrajes, con sus medidas y precios. Lo que cambies acá corrige las piezas y el costo de todos los muebles.',
    how: ['Tocá Bibliotecas en la barra de arriba.'],
    art: 'library',
  },
];

/** Guía de uso completa, en el repositorio. */
export const GUIDE_URL = 'https://github.com/MaharBa264/mubleando/blob/main/docs/guia-de-uso.md';

/** Versión de la explicación: si cambia, se vuelve a mostrar a quien la había cerrado. */
export const HELP_VERSION = 1;
