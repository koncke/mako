/**
 * LA ENTRADA: un ticket de papel sobre una mesa oscura, con su talón troquelado, un sello de goma con
 * el número, y en el cuerpo el rótulo, el número grande y el texto a máquina. A pinta la entrada y B
 * el sello (y la franja del talón).
 *
 * La mesa sale del sello oscurecido, así que cualquier B queda en familia con el fondo. El código de
 * barras es decoración y no codifica nada: sus anchos salen del azar de la lámina.
 */

import {
  LETRA, MEDIR, Renglones, SvgLamina, repartoDe, azar, cifras, r2, rotuloDe, tintaSobre, visibleSobre,
  type AjusteDeTexto, type PropsDibujo,
} from './comun';
import { mezclar } from '@/lib/curso-estilo';

const X0 = 14;
const X1 = 306;
const Y0 = 22;
const Y1 = 158;
/** Donde se corta el talón. */
const XT = 98;
const MUESCA = 8;
const CAJA = { x: XT + 16, y: 114, ancho: X1 - XT - 30, alto: 34 };
export const AJUSTE_ENTRADA: AjusteDeTexto = {
  caja: CAJA,
  opciones: { fsMax: 16, fsPiso: 10, maxLineas: 2, inter: 1.16, cap: 0.62, medir: MEDIR.maquina },
  mayus: true,
};

export const tintaEntrada = (a: string) => ({ tinta: tintaSobre(a), fondo: a });

/** El contorno del ticket: esquinas redondeadas y las dos muescas del troquel. */
function contorno(dx = 0, dy = 0): string {
  const x0 = X0 + dx; const x1 = X1 + dx; const y0 = Y0 + dy; const y1 = Y1 + dy; const xt = XT + dx;
  const rr = 5;
  return `M${x0 + rr},${y0} H${xt - MUESCA} A${MUESCA},${MUESCA} 0 0,0 ${xt + MUESCA},${y0} H${x1 - rr} Q${x1},${y0} ${x1},${y0 + rr}`
    + ` V${y1 - rr} Q${x1},${y1} ${x1 - rr},${y1} H${xt + MUESCA} A${MUESCA},${MUESCA} 0 0,0 ${xt - MUESCA},${y1}`
    + ` H${x0 + rr} Q${x0},${y1} ${x0},${y1 - rr} V${y0 + rr} Q${x0},${y0} ${x0 + rr},${y0} Z`;
}

export function Entrada({ n, rotulo, texto, a, b, className, semilla }: PropsDibujo) {
  const r = azar(semilla);
  const tinta = tintaEntrada(a).tinta;
  const sello = visibleSobre(b, a, 2.2);
  const mesa = mezclar(b, '#121318', 0.8);
  const dig = cifras(n);
  const fsNum = Math.min(62, 120 / (dig.length * 0.66));
  const rot = rotuloDe(rotulo);
  const reparto = repartoDe(texto, AJUSTE_ENTRADA);
  // El código de barras, en el talón y de costado.
  const barras: string[] = [];
  let y = 108;
  while (y < 146) {
    const w = 0.8 + Math.floor(r() * 3) * 0.9;
    barras.push(`M${X0 + 14},${r2(y)}h40v${r2(w)}h-40Z`);
    y += w + 0.9 + r() * 1.6;
  }
  const giroSello = -14 + r() * 10;
  const sx = (X0 + XT) / 2;
  const sy = 64;

  return (
    <SvgLamina className={className} familia={LETRA.maquina}>
      <rect x={-4} y={-4} width={328} height={188} fill={mesa} />
      <path d={Array.from({ length: 14 }, (_, i) => `M${i * 26 - 40},190 L${i * 26 + 60},-10`).join(' ')} stroke="#FFFFFF" strokeOpacity={0.04} strokeWidth={9} />
      <path d={contorno(2.5, 3.5)} fill="#000000" opacity={0.35} />
      <path d={contorno()} fill={a} />
      {/* la franja del talón y el troquel */}
      <rect x={X0} y={Y0 + 10} width={XT - X0 - MUESCA - 2} height={9} fill={sello} opacity={0.9} />
      <path d={`M${XT},${Y0 + MUESCA + 3} V${Y1 - MUESCA - 3}`} stroke={tinta} strokeOpacity={0.45} strokeWidth={1.2} strokeDasharray="1.2 3.4" strokeLinecap="round" />
      <rect x={XT + 10} y={Y0 + 10} width={X1 - XT - 20} height={Y1 - Y0 - 20} fill="none" stroke={tinta} strokeOpacity={0.28} strokeWidth={0.8} />

      {/* el talón: el sello de goma con el número, y el código de barras */}
      <g transform={`rotate(${r2(giroSello)},${sx},${sy})`} fill="none" stroke={sello} opacity={0.85}>
        <circle cx={sx} cy={sy} r={23} strokeWidth={2.2} />
        <circle cx={sx} cy={sy} r={18.5} strokeWidth={0.8} />
        <text x={sx} y={sy - 4} textAnchor="middle" fill={sello} stroke="none" fontFamily={LETRA.archivo} fontWeight={800} fontSize={6.4} letterSpacing={1.2}>{`Nº`}</text>
        <text x={sx} y={sy + 10} textAnchor="middle" fill={sello} stroke="none" fontFamily={LETRA.archivo} fontWeight={900} fontSize={dig.length > 2 ? 12 : 15}>{dig}</text>
      </g>
      <path d={barras.join('')} fill={tinta} opacity={0.8} />

      {/* el cuerpo */}
      {rot && (
        <text x={XT + 16} y={47} fill={tinta} fontFamily={LETRA.archivo} fontWeight={700} fontSize={9} letterSpacing={2.4} opacity={0.8}>{rot}</text>
      )}
      <g fill={sello} opacity={0.9}>
        {[0, 1, 2].map((i) => <path key={i} d={`M${X1 - 22 - i * 9},40 l3,-3 l3,3 l-3,3 Z`} />)}
      </g>
      <text x={XT + 14} y={104} fill={tinta} fontFamily={LETRA.archivo} fontWeight={900} fontSize={r2(fsNum)} letterSpacing={1}>{dig}</text>
      <Renglones caja={CAJA} reparto={reparto} color={tinta} familia={LETRA.maquina} peso={700} vertical="centro" />
    </SvgLamina>
  );
}
