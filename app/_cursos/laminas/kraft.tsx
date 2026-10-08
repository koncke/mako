/**
 * CINTA Y KRAFT: cartón kraft con un pedazo de cinta de papel arriba (el rótulo, escrito a mano), el
 * número estampado con plantilla y el texto a máquina. A pinta el cartón y B la cinta.
 *
 * El estarcido son dos cortes horizontales del color del cartón cruzando el número (los puentes de
 * una plantilla) más un halo de pintura apenas corrida: con eso se lee «plantilla» a 64 px de alto,
 * cosa que unos puentes verticales finos no lograban. La tinta del número sale del cartón, oscurecida:
 * es estampado, no impreso.
 */

import {
  LETRA, MEDIR, Renglones, SvgLamina, TINTA, repartoDe, azar, cifras, r2, rotuloDe, tintaSobre,
  visibleSobre, type AjusteDeTexto, type PropsDibujo,
} from './comun';
import { mezclar } from '@/lib/curso-estilo';

const CAJA = { x: 22, y: 122, ancho: 276, alto: 42 };
export const AJUSTE_KRAFT: AjusteDeTexto = {
  caja: CAJA,
  opciones: { fsMax: 19, fsPiso: 11, maxLineas: 3, inter: 1.16, cap: 0.62, medir: MEDIR.maquina },
  mayus: true,
};

export const tintaKraft = (a: string) => ({ tinta: tintaSobre(a), fondo: a });

export function Kraft({ n, rotulo, texto, a, b, className, semilla }: PropsDibujo) {
  const r = azar(semilla);
  const tinta = tintaKraft(a).tinta;
  // El número: el color del cartón llevado casi a negro (o a blanco, si el cartón es oscuro).
  const sello = visibleSobre(mezclar(a, tinta === TINTA ? '#120C06' : '#FFFFFF', 0.82), a, 3);
  const fibrasO: string[] = [];
  const fibrasC: string[] = [];
  for (let i = 0; i < 110; i++) {
    const x = r() * 330 - 5;
    const y = r() * 190 - 5;
    const largo = 3 + r() * 8;
    const ang = (r() - 0.5) * 0.9;
    (i % 2 ? fibrasO : fibrasC).push(`M${r2(x)},${r2(y)}l${r2(Math.cos(ang) * largo)},${r2(Math.sin(ang) * largo)}`);
  }
  const dig = cifras(n);
  const fsNum = Math.min(100, 206 / (dig.length * 0.66));
  const anchoNum = dig.length * 0.66 * fsNum;
  const baseNum = 110;
  const xNum = 300;
  const rot = rotuloDe(rotulo);
  const reparto = repartoDe(texto, AJUSTE_KRAFT);
  const tintaCinta = tintaSobre(b);
  const giroCinta = -4 + r() * 2.5;
  // Los bordes rotos de la cinta: un serrucho irregular en cada punta, de `y0` a `y1`.
  const ALTO_CINTA = 28;
  const largoCinta = 150;
  const serrucho = (x: number, y0: number, y1: number, afuera: number) => Array.from({ length: 6 }, (_, i) =>
    `L${r2(x + (i % 2 ? 0 : afuera * (1.5 + r() * 2.5)))},${r2(y0 + ((i + 1) * (y1 - y0)) / 6)}`).join(' ');
  const cinta = `M0,0 L${largoCinta},0 ${serrucho(largoCinta, 0, ALTO_CINTA, 1)} L0,${ALTO_CINTA} ${serrucho(0, ALTO_CINTA, 0, -1)} Z`;

  return (
    <SvgLamina className={className} familia={LETRA.maquina}>
      <rect x={-4} y={-4} width={328} height={188} fill={a} />
      <g strokeWidth={0.7} strokeLinecap="round" fill="none">
        <path d={fibrasO.join('')} stroke={mezclar(a, '#000000', 0.3)} opacity={0.35} />
        <path d={fibrasC.join('')} stroke={mezclar(a, '#FFFFFF', 0.35)} opacity={0.4} />
      </g>
      {/* el borde corrugado de abajo: el cartón cortado */}
      <path d={Array.from({ length: 41 }, (_, i) => `${i ? 'L' : 'M'}${i * 8},${i % 2 ? 176 : 179}`).join(' ') + ' L320,184 L0,184 Z'}
        fill={mezclar(a, '#000000', 0.18)} />

      {/* el número estampado: halo, pintura y los dos puentes de la plantilla */}
      <text x={xNum} y={baseNum} textAnchor="end" fontFamily={LETRA.archivo} fontWeight={900} fontSize={r2(fsNum)}
        fill="none" stroke={sello} strokeWidth={6} opacity={0.1} letterSpacing={2}>{dig}</text>
      <text x={xNum} y={baseNum} textAnchor="end" fontFamily={LETRA.archivo} fontWeight={900} fontSize={r2(fsNum)}
        fill={sello} opacity={0.9} letterSpacing={2}>{dig}</text>
      <g fill={a}>
        <rect x={xNum - anchoNum - 12} y={r2(baseNum - fsNum * 0.5)} width={anchoNum + 20} height={3.2} />
        <rect x={xNum - anchoNum - 12} y={r2(baseNum - fsNum * 0.24)} width={anchoNum + 20} height={2.6} />
      </g>

      {/* la cinta, con el rótulo escrito encima */}
      <g transform={`translate(16,20) rotate(${r2(giroCinta)})`}>
        <path d={cinta} fill={b} opacity={0.92} />
        <path d={`M4,7 H${largoCinta - 6} M6,21 H${largoCinta - 10}`} stroke="#FFFFFF" strokeOpacity={0.25} strokeWidth={1.2} />
        {rot && (
          <text x={14} y={19.5} fill={tintaCinta} fontFamily={LETRA.mano} fontWeight={700} fontSize={13} letterSpacing={1.2}>{rot}</text>
        )}
      </g>

      <path d={`M${CAJA.x},${CAJA.y - 7} H${CAJA.x + CAJA.ancho}`} stroke={tinta} strokeOpacity={0.45} strokeWidth={0.9} strokeDasharray="4 3" />
      <Renglones caja={CAJA} reparto={reparto} color={tinta} familia={LETRA.maquina} peso={700} />
    </SvgLamina>
  );
}
