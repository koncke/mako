'use client';

// =============================================================================
// Vocabulario — el rayado de «no medido», como `<pattern>` de SVG
// =============================================================================
// La REGLA vive en lib/graficos-temas.ts (`Procedencia`, `pinturaDe`): un número estimado no
// se dibuja igual que uno medido. Acá sólo vive la parte que necesita SVG — el relleno rayado
// en diagonal, que no se puede expresar como un color.
//
// `pinturaDe('no-medido', …)` devuelve `fill: url(#rayado-…)`, así que la marca necesita que
// este `<defs>` esté en el MISMO `<svg>`. Por eso se monta adentro del gráfico de recharts
// (que pasa los hijos que no conoce derecho al svg, igual que los degradados de las áreas),
// nunca en un svg aparte: un `url(#…)` que apunta a otro documento sale vacío y la barra
// queda invisible — que es exactamente el modo de fallar que no queremos (una barra que
// desaparece en vez de una que se ve estimada).
//
// El id sale del COLOR (`idRayado`), no del gráfico: dos bloques de la misma hoja con el
// mismo color comparten un patrón, y el id no cambia entre renders (si cambiara, el morfeo
// perdería el relleno a mitad de camino).

import { idRayado } from '@/lib/graficos-temas';

/** El paso del rayado, en px. Más apretado se ve como una textura sucia; más abierto, como rayas. */
const PASO = 6;
/** El ancho de la raya. Contra el paso de 6 deja ~40 % de tinta: se lee como «rayado», no como «sólido». */
const ANCHO = 2.5;
/**
 * El lavado de color debajo de las rayas. Sin él, una barra rayada sobre fondo claro pierde
 * su identidad de serie (se lee gris); con él, sigue siendo «el azul, pero rayado».
 */
const LAVADO = 0.14;

/**
 * Los `<pattern>` de rayado de estos colores. Va como hijo de un gráfico de recharts.
 * Los colores repetidos se emiten una sola vez.
 */
export function DefsRayado({ colores }: { colores: readonly string[] }) {
  const unicos = [...new Set(colores.filter(Boolean))];
  if (!unicos.length) return null;
  return (
    <defs>
      {unicos.map((c) => (
        // `patternTransform` rota el mosaico entero: las líneas se dibujan verticales y quedan a 45°.
        <pattern key={c} id={idRayado(c)} width={PASO} height={PASO} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width={PASO} height={PASO} fill={c} opacity={LAVADO} />
          <line x1={0} y1={0} x2={0} y2={PASO} stroke={c} strokeWidth={ANCHO} strokeLinecap="square" />
        </pattern>
      ))}
    </defs>
  );
}
