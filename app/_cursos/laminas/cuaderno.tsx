/**
 * EL CUADERNO: la lámina de siempre (app/conocimientos/PortadaModulo.tsx), como un diseño más del
 * catálogo. A pinta el resaltador detrás del texto y B el sticker.
 *
 * No es una copia: es el MISMO componente con los colores y el texto pasados por props. Por eso el
 * cuaderno elegido en el selector y el de una tarjeta sin portada son la misma lámina, y la que
 * Martín vio «desaparecer» del selector (item 5) vuelve a estar ahí.
 */

import { ANCHO_UTIL, PAPEL, PortadaModulo, TINTA, TIT_FS_PISO } from '@/app/conocimientos/PortadaModulo';
import { contraste, mezclar } from '@/lib/curso-estilo';
import { conPalabrasPartidas } from './comun';

/** El brochazo va con `multiply` y opacidad 0,92 sobre el papel: el color que queda detrás de la letra. */
export function brochaSobrePapel(brocha: string): string {
  const c = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const p = c(PAPEL);
  const b = c(brocha);
  return `#${p.map((v, i) => Math.round(v * (0.08 + 0.92 * (b[i] / 255))).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

/**
 * EL RESALTADOR, ACLARADO HASTA QUE LA TINTA SE LEA ENCIMA (contraste ≥ 4,5 contra lo que de verdad
 * queda detrás de la letra: el brochazo multiplicado sobre el papel). Es la misma regla que
 * `acentoLegible` (lib/curso-estilo.ts) para el acento del curso: un azul marino elegido con buena
 * intención dejaría el texto invisible. Se aclara de a poco, así sigue siendo SU color.
 */
export function brochaLegible(a: string): string {
  for (let i = 0; i <= 20; i++) {
    const c = i === 0 ? a : mezclar(a, '#FFFFFF', i / 20);
    if (contraste(brochaSobrePapel(c), TINTA) >= 4.5) return c;
  }
  return '#FFFFFF';
}

/** La tinta del texto y lo que tiene detrás, para el test del contraste. */
export const tintaCuaderno = (a: string) => ({ tinta: TINTA, fondo: brochaSobrePapel(brochaLegible(a)) });

export function Cuaderno({ n, rotulo, propio, nombre, a, b, className, instancia }: {
  n: number; rotulo: string; propio: string; nombre: string; a: string; b: string; className?: string; instancia?: string;
}) {
  return (
    <PortadaModulo
      n={n}
      titulo={nombre}
      rotulo={rotulo}
      // Vacío = el nombre del módulo limpio, que es exactamente lo que dibuja una tarjeta sin portada.
      // ⚠️ El texto elegido llega con sus palabras larguísimas ya PARTIDAS: el reparto del cuaderno
      //    corta sólo en espacios, y una palabra de 36 letras se achicaba hasta ser una raya (medido
      //    en la primera galería). Con el corte al ancho útil y al piso del cuaderno, no baja de ahí.
      texto={conPalabrasPartidas(propio, ANCHO_UTIL / TIT_FS_PISO)}
      brocha={brochaLegible(a)}
      sticker={b}
      instancia={instancia ?? ''}
      className={className}
    />
  );
}
