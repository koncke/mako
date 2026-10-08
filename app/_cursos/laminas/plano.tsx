/**
 * EL PLANO: un plano azul (blueprint) con su cuadrícula, el número contorneado y rayado como un corte,
 * sus cotas, un compás y el rótulo y el texto en la carátula de abajo. A pinta el plano y B el
 * marcador con el que alguien repasó las cotas y el círculo.
 *
 * Las líneas salen del plano (`tintaSobre`): blancas sobre el azul, oscuras si se elige un plano
 * claro — o sea, un plano de lápiz sobre papel. Lo que vive en la carátula va sobre el plano
 * oscurecido un poco: es donde está el texto, y ahí el contraste se calcula contra ESE fondo.
 */

import {
  CLARO, LETRA, MEDIR, Renglones, SvgLamina, TINTA, repartoDe, azar, cifras, r2, rotuloDe, tintaSobre,
  visibleSobre, type AjusteDeTexto, type PropsDibujo,
} from './comun';
import { mezclar } from '@/lib/curso-estilo';

/** La carátula: a lo ancho, abajo. Celda chica con el rótulo y el número, celda grande con el texto. */
const CARATULA = { x: 12, y: 116, ancho: 296, alto: 52 };
const DIVISION = 92;
const CAJA = { x: DIVISION + 8, y: CARATULA.y + 8, ancho: CARATULA.x + CARATULA.ancho - DIVISION - 16, alto: CARATULA.alto - 15 };
export const AJUSTE_PLANO: AjusteDeTexto = {
  caja: CAJA,
  opciones: { fsMax: 16, fsPiso: 9.5, maxLineas: 3, inter: 1.2, cap: 0.62, medir: MEDIR.maquina },
  mayus: true,
};

const fondoCaratula = (a: string) => mezclar(a, tintaSobre(a, TINTA, CLARO) === TINTA ? '#FFFFFF' : '#000000', 0.14);
export const tintaPlano = (a: string) => {
  const fondo = fondoCaratula(a);
  return { tinta: tintaSobre(fondo, TINTA, CLARO), fondo };
};

export function Plano({ n, rotulo, texto, a, b, className, uid, semilla }: PropsDibujo) {
  const r = azar(semilla);
  const linea = tintaSobre(a, TINTA, CLARO);
  const { tinta, fondo } = tintaPlano(a);
  const marcador = visibleSobre(b, a, 2.4);
  const menores: string[] = [];
  const mayores: string[] = [];
  for (let x = 10; x <= 310; x += 10) (x % 50 === 10 ? mayores : menores).push(`M${x},8V172`);
  for (let y = 10; y <= 170; y += 10) (y % 50 === 10 ? mayores : menores).push(`M8,${y}H312`);
  const dig = cifras(n);
  const fsNum = Math.min(86, 150 / (dig.length * 0.68));
  const anchoNum = dig.length * 0.68 * fsNum;
  const xNum = 34;
  const baseNum = 100;
  const topeNum = baseNum - fsNum * 0.73;
  const rot = rotuloDe(rotulo);
  const reparto = repartoDe(texto, AJUSTE_PLANO);
  // El compás: un círculo a la derecha del número, con su centro y un radio.
  const cx = Math.max(xNum + anchoNum + 62, 236) + r() * 10;
  const cy = 58 + r() * 6;
  const radio = 30 + r() * 4;
  const ang = -0.9 + r() * 0.6;
  const flecha = (x: number, y: number, dir: 1 | -1) => `M${x},${y} l${dir * 5},-2.2 l0,4.4 Z`;

  return (
    <SvgLamina className={className} familia={LETRA.maquina}>
      <defs>
        {/* El rayado del corte: un patrón, así que lleva id POR INSTANCIA (ver comun.tsx). */}
        <pattern id={`${uid}r`} patternUnits="userSpaceOnUse" width={4.5} height={4.5} patternTransform="rotate(45)">
          <line x1={0} y1={0} x2={0} y2={4.5} stroke={linea} strokeWidth={1.1} />
        </pattern>
      </defs>
      <rect x={-4} y={-4} width={328} height={188} fill={a} />
      <g stroke={linea} fill="none" shapeRendering="crispEdges">
        <path d={menores.join('')} strokeWidth={0.5} opacity={0.14} />
        <path d={mayores.join('')} strokeWidth={0.7} opacity={0.3} />
      </g>
      <rect x={6.5} y={6.5} width={307} height={167} fill="none" stroke={linea} strokeWidth={1.3} opacity={0.85} />
      <rect x={9.5} y={9.5} width={301} height={161} fill="none" stroke={linea} strokeWidth={0.5} opacity={0.6} />

      {/* el número: rayado por dentro y contorneado, como una pieza en corte */}
      <text x={xNum} y={baseNum} fontFamily={LETRA.archivo} fontWeight={900} fontSize={r2(fsNum)} letterSpacing={3}
        fill={`url(#${uid}r)`} opacity={0.55}>{dig}</text>
      <text x={xNum} y={baseNum} fontFamily={LETRA.archivo} fontWeight={900} fontSize={r2(fsNum)} letterSpacing={3}
        fill="none" stroke={linea} strokeWidth={1.4} strokeLinejoin="round">{dig}</text>

      {/* las cotas, repasadas con el marcador */}
      <g stroke={marcador} strokeWidth={0.9} fill="none">
        <path d={`M${xNum},${baseNum + 3} V${baseNum + 12} M${r2(xNum + anchoNum)},${baseNum + 3} V${baseNum + 12}`} opacity={0.8} />
        <path d={`M${xNum + 2},${baseNum + 8} H${r2(xNum + anchoNum - 2)}`} />
        <path d={`M${xNum - 14},${r2(topeNum)} H${xNum - 4} M${xNum - 14},${baseNum} H${xNum - 4}`} opacity={0.8} />
        <path d={`M${xNum - 9},${r2(topeNum + 2)} V${baseNum - 2}`} />
        <circle cx={r2(cx)} cy={r2(cy)} r={r2(radio)} strokeDasharray="5 3" />
      </g>
      <g fill={marcador}>
        <path d={flecha(xNum + 2, baseNum + 8, 1)} />
        <path d={flecha(r2(xNum + anchoNum - 2), baseNum + 8, -1)} />
      </g>
      <g stroke={linea} strokeWidth={0.8} fill="none" opacity={0.75}>
        <path d={`M${r2(cx - radio - 8)},${r2(cy)} H${r2(cx + radio + 8)} M${r2(cx)},${r2(cy - radio - 8)} V${r2(cy + radio + 8)}`} strokeDasharray="7 2 1.5 2" />
        <path d={`M${r2(cx)},${r2(cy)} L${r2(cx + Math.cos(ang) * radio)},${r2(cy + Math.sin(ang) * radio)}`} />
        <circle cx={r2(cx)} cy={r2(cy)} r={r2(radio * 0.42)} />
      </g>

      {/* la carátula */}
      <rect x={CARATULA.x} y={CARATULA.y} width={CARATULA.ancho} height={CARATULA.alto} fill={fondo} stroke={linea} strokeWidth={1.1} />
      <path d={`M${DIVISION},${CARATULA.y} V${CARATULA.y + CARATULA.alto} M${CARATULA.x},${CARATULA.y + 22} H${DIVISION}`} stroke={linea} strokeWidth={0.8} opacity={0.8} />
      {rot && (
        <text x={CARATULA.x + 7} y={CARATULA.y + 15} fill={tinta} fontFamily={LETRA.archivo} fontWeight={700} fontSize={8.2} letterSpacing={1.6}>{rot}</text>
      )}
      <text x={CARATULA.x + 7} y={CARATULA.y + 44} fill={tinta} fontFamily={LETRA.maquina} fontWeight={700} fontSize={16}>{`Nº ${dig}`}</text>
      <Renglones caja={CAJA} reparto={reparto} color={tinta} familia={LETRA.maquina} peso={700} vertical="centro" />
    </SvgLamina>
  );
}
