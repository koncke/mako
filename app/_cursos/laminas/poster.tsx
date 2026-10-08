/**
 * EL PÓSTER: una portada editorial —filetes arriba y abajo, el rótulo en versalitas, un número
 * enorme y el texto en una columna de serif— con una trama de puntos de imprenta en una esquina.
 * A pinta el fondo y B el número.
 *
 * El número es lo que manda y se COME el ancho que le toca: con tres cifras se achica para no pisar
 * la columna. Si se elige el mismo color para los dos, el número se empuja hacia el negro o el blanco
 * (`visibleSobre`) en vez de desaparecer.
 */

import {
  LETRA, MEDIR, Renglones, SvgLamina, repartoDe, cifras, r2, rotuloDe, tintaSobre, visibleSobre,
  type AjusteDeTexto, type PropsDibujo,
} from './comun';
import { mezclar } from '@/lib/curso-estilo';

/** La columna del texto, a la derecha del número. Angosta y alta: el texto baja, no se estira. */
const CAJA = { x: 196, y: 36, ancho: 110, alto: 116 };
export const AJUSTE_POSTER: AjusteDeTexto = {
  caja: CAJA,
  opciones: { fsMax: 22, fsPiso: 11, maxLineas: 6, inter: 1.1, cap: 0.7, medir: MEDIR.serif },
  mayus: false,
};

export const tintaPoster = (a: string) => ({ tinta: tintaSobre(a), fondo: a });

export function Poster({ n, rotulo, texto, a, b, className, semilla }: PropsDibujo) {
  const tinta = tintaPoster(a).tinta;
  const numero = visibleSobre(b, a, 2.5);
  const dig = cifras(n);
  const fsNum = Math.min(140, 176 / (dig.length * 0.64));
  const rot = rotuloDe(rotulo);
  const reparto = repartoDe(texto, AJUSTE_POSTER);
  // La trama: puntos que crecen hacia la esquina, como una media tinta mal registrada.
  const trama: string[] = [];
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9 - i; j++) {
      const rr = 0.5 + (8 - i - j) * 0.22;
      const x = 304 - j * 7 - (i % 2) * 3.5;
      const y = 170 - i * 6;
      trama.push(`M${r2(x - rr)},${y}a${r2(rr)},${r2(rr)} 0 1,0 ${r2(rr * 2)},0a${r2(rr)},${r2(rr)} 0 1,0 ${r2(-rr * 2)},0`);
    }
  }
  const circulo = 52 + (semilla % 18);

  return (
    <SvgLamina className={className} familia={LETRA.serif}>
      <rect x={-4} y={-4} width={328} height={188} fill={a} />
      <circle cx={84} cy={circulo + 70} r={72} fill={mezclar(a, '#FFFFFF', 0.14)} />
      <path d={trama.join('')} fill={tinta} opacity={0.16} />

      {rot && (
        <text x={16} y={18} fill={tinta} fontFamily={LETRA.archivo} fontWeight={800} fontSize={8.6} letterSpacing={2.2}>{rot}</text>
      )}
      <text x={304} y={18} textAnchor="end" fill={tinta} fontFamily={LETRA.archivo} fontWeight={700} fontSize={8.6} letterSpacing={1.4}>{`N.º ${dig}`}</text>
      <path d="M16,24 H304" stroke={tinta} strokeWidth={1.3} />

      <text x={10} y={152} fill={numero} fontFamily={LETRA.archivo} fontWeight={900} fontSize={r2(fsNum)} letterSpacing={-5}>{dig}</text>

      <Renglones caja={CAJA} reparto={reparto} color={tinta} familia={LETRA.serif} peso={700} vertical="abajo" />
      <path d="M16,162 H304" stroke={tinta} strokeWidth={0.8} />
      <g fill={numero}>
        <rect x={16} y={166} width={6} height={6} />
        <rect x={25} y={166} width={6} height={6} opacity={0.6} />
        <rect x={34} y={166} width={6} height={6} opacity={0.3} />
      </g>
    </SvgLamina>
  );
}
