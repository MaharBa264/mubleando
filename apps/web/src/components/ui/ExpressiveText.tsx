import type { CSSProperties } from 'react';

/** Patrones deliberados, no aleatorios. Se conservan para la futura animación por carácter. */
const patterns: Record<string, readonly number[]> = {
  Proyectos: [1.48, .83, 1.08, .76, 1.22, .89, 1.09, .79, .96],
  Bibliotecas: [1.43, .83, 1.17, .87, 1.33, .83, 1, 1.17, .77, .97, .9],
  'Cómo se usa': [1.4, .84, 1.15, .86, 1, .8, 1.2, 1, 1.26, .79, 1.05],
  Mubleando: [1.48, .78, 1.12, .75, 1.27, .84, 1, 1.19, .86],
};
const fallback = [1.4, .84, 1.12, .82, 1.23, .92, 1.05];

export function ExpressiveText({ text }: { text: string }) {
  const scales = patterns[text] ?? fallback;
  let offset = 0;
  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" className="constructive-text">
        {text.split(' ').map((word, wi) => {
          const start = offset;
          offset += Array.from(word).length + 1;
          return (
            <span key={wi} className="constructive-word">
              {Array.from(word).map((letter, li) => {
                const scale = scales[(start + li) % scales.length] ?? 1;
                const style = {
                  '--letter-scale': scale,
                  '--letter-weight': scale >= 1.15 ? 850 : scale < .9 ? 600 : 750,
                } as CSSProperties;
                return <span key={li} className="constructive-letter" style={style}>{letter}</span>;
              })}
            </span>
          );
        })}
      </span>
    </>
  );
}
