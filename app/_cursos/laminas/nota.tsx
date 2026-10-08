/**
 * LA NOTA ADHESIVA: una nota pegada con una chinche sobre un tablero de corcho, con el número escrito
 * con marcador. A pinta la nota y B la chinche.
 *
 * El corcho son puntos sueltos de dos tonos (UN `<path>` por tono, no cien círculos: esto se paga
 * por tarjeta), la nota va apenas torcida y con la esquina levantada, y la banda de pegamento de
 * arriba se nota un tono más oscura. La tinta del marcador sale de la nota (`tintaSobre`): una nota
 * oscura se escribe en claro.
 */

import {
  LETRA, MEDIR, NumeroMano, Renglones, SvgLamina, repartoDe, anchoNumeroMano, azar, cifras, r2,
  rotuloDe, tintaSobre, type AjusteDeTexto, type PropsDibujo,
} from './comun';
import { mezclar } from '@/lib/curso-estilo';

const CORCHO = '#B98B59';
const CORCHO_OSC = '#8E6439';
const CORCHO_CLARO = '#DDB47F';

/** La nota, centrada. El texto va abajo, adentro de la nota (y gira con ella). */
const NOTA = { x: 62, y: 18, ancho: 196, alto: 150 };
const CAJA = { x: NOTA.x + 13, y: 110, ancho: NOTA.ancho - 26, alto: 50 };
export const AJUSTE_NOTA: AjusteDeTexto = {
  caja: CAJA,
  // ⚠️ CUATRO renglones y no tres: la nota es la caja más angosta, y con tres el peor texto que el
  //    tope deja escribir (dos palabras de 14 letras anchas) bajaba a 10,1 — medido en
  //    tests/laminas.test.ts. Con cuatro, 12,5 de techo por alto, y el peor caso queda en el piso.
  opciones: { fsMax: 22, fsPiso: 11.5, maxLineas: 4, inter: 1.08, cap: 0.72, medir: MEDIR.mano },
  mayus: false,
};

export const tintaNota = (a: string) => ({ tinta: tintaSobre(a), fondo: a });

/** Un punto de radio `r` como dos arcos: muchos puntos entran en UN path. */
const punto = (x: number, y: number, r: number) => `M${r2(x - r)},${r2(y)}a${r2(r)},${r2(r)} 0 1,0 ${r2(r * 2)},0a${r2(r)},${r2(r)} 0 1,0 ${r2(-r * 2)},0`;

export function Nota({ n, rotulo, texto, a, b, className, semilla }: PropsDibujo) {
  const r = azar(semilla);
  const tinta = tintaNota(a).tinta;
  const oscuros: string[] = [];
  const claros: string[] = [];
  for (let i = 0; i < 130; i++) (i % 2 ? oscuros : claros).push(punto(r() * 324 - 2, r() * 184 - 2, 0.5 + r() * 1.2));
  const giro = -2.6 + r() * 3.4;
  const dig = cifras(n);
  const altoNum = dig.length > 2 ? 42 : 50;
  const anchoNum = anchoNumeroMano(dig, altoNum, 11);
  const cx = NOTA.x + NOTA.ancho / 2;
  const reparto = repartoDe(texto, AJUSTE_NOTA);
  const rot = rotuloDe(rotulo);
  const x1 = NOTA.x + NOTA.ancho;
  const y1 = NOTA.y + NOTA.alto;
  // La esquina de abajo a la derecha, levantada: el cuerpo la recorta y un triángulo la dibuja.
  const doblez = 16;

  return (
    <SvgLamina className={className} familia={LETRA.mano}>
      <rect x={-4} y={-4} width={328} height={188} fill={CORCHO} />
      <path d={oscuros.join('')} fill={CORCHO_OSC} opacity={0.55} />
      <path d={claros.join('')} fill={CORCHO_CLARO} opacity={0.5} />
      <rect x={-4} y={-4} width={328} height={188} fill="none" stroke="#000000" strokeOpacity={0.12} strokeWidth={10} />

      <g transform={`rotate(${r2(giro)},${cx},${NOTA.y + NOTA.alto / 2})`}>
        {/* la sombra: corrida abajo a la derecha, más fuerte bajo la esquina levantada */}
        <path d={`M${NOTA.x + 3},${NOTA.y + 5} H${x1 + 3} V${y1 - doblez + 4} L${x1 - doblez + 6},${y1 + 6} H${NOTA.x + 3} Z`} fill="#000000" opacity={0.22} />
        <path d={`M${NOTA.x},${NOTA.y} H${x1} V${y1 - doblez} L${x1 - doblez},${y1} H${NOTA.x} Z`} fill={a} />
        {/* la banda de pegamento */}
        <rect x={NOTA.x} y={NOTA.y} width={NOTA.ancho} height={22} fill={mezclar(a, '#000000', 0.06)} />
        <path d={`M${x1},${y1 - doblez} L${x1 - doblez},${y1} L${x1 - doblez + 2},${y1 - doblez + 2} Z`} fill={mezclar(a, '#000000', 0.16)} />
        <path d={`M${x1 - doblez + 2},${y1 - doblez + 2} L${x1},${y1 - doblez}`} stroke={mezclar(a, '#FFFFFF', 0.4)} strokeWidth={0.8} />

        <NumeroMano digitos={dig} x={cx - anchoNum / 2} y={NOTA.y + 26} alto={altoNum} trazo={11} color={tinta} semilla={semilla} opacidad={0.92} />
        {rot && (
          <text x={cx + 0.8} y={NOTA.y + 26 + altoNum + 14} textAnchor="middle" fill={tinta} fontFamily={LETRA.archivo}
            fontWeight={700} fontSize={8.6} letterSpacing={1.6} opacity={0.8}>{rot}</text>
        )}
        <Renglones caja={CAJA} reparto={reparto} color={tinta} familia={LETRA.mano} peso={400} alinear="centro" vertical="centro" />
      </g>

      {/* la chinche, encima de todo y sin girar: está clavada, no pegada */}
      <ellipse cx={cx + 3} cy={NOTA.y + 9} rx={7} ry={4.5} fill="#000000" opacity={0.25} />
      <circle cx={cx} cy={NOTA.y + 6} r={7.4} fill={b} />
      <circle cx={cx} cy={NOTA.y + 6} r={7.4} fill="none" stroke={mezclar(b, '#000000', 0.35)} strokeWidth={1} />
      <circle cx={cx - 2.3} cy={NOTA.y + 3.6} r={2.4} fill="#FFFFFF" opacity={0.55} />
    </SvgLamina>
  );
}
