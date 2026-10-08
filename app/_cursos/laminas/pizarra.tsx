/**
 * LA PIZARRA: pizarrón con marco de madera, el número escrito con tiza de color, el rótulo
 * subrayado y el texto con tiza blanca. A pinta el pizarrón y B la tiza del número.
 *
 * Lo que la hace pizarra y sobrevive al achique es lo MACIZO: el marco, el borrón de un borrador mal
 * pasado y el número de trazo grueso. El texto de tiza es la letra de mano del sistema; si el
 * pizarrón que se elige es claro, la «tiza» pasa a ser oscura (`tintaSobre`): se lee igual.
 */

import {
  CLARO, LETRA, MEDIR, NumeroMano, Renglones, SvgLamina, TINTA, repartoDe, anchoNumeroMano, azar, cifras, r2,
  rotuloDe, tintaSobre, visibleSobre, type AjusteDeTexto, type PropsDibujo,
} from './comun';

const MADERA = '#8A5A32';
const MADERA_OSC = '#5F3B1F';
const MADERA_CLARA = '#A8774C';

/** La caja del texto: debajo del número, a lo ancho del pizarrón. */
const CAJA = { x: 28, y: 100, ancho: 264, alto: 58 };
export const AJUSTE_PIZARRA: AjusteDeTexto = {
  caja: CAJA,
  opciones: { fsMax: 24, fsPiso: 12.5, maxLineas: 3, inter: 1.12, cap: 0.72, medir: MEDIR.mano },
  mayus: false,
};

export const tintaPizarra = (a: string) => ({ tinta: tintaSobre(a, TINTA, CLARO), fondo: a });

export function Pizarra({ n, rotulo, texto, a, b, className, uid, semilla }: PropsDibujo) {
  const r = azar(semilla);
  const tiza = tintaPizarra(a).tinta;
  const tizaColor = visibleSobre(b, a, 2.2);
  const dig = cifras(n);
  const altoNum = dig.length > 2 ? 56 : 66;
  const anchoNum = anchoNumeroMano(dig, altoNum, 9);
  const numX = 30;
  const numY = 22;
  const rot = rotuloDe(rotulo);
  const rotX = numX + anchoNum + 16;
  const reparto = repartoDe(texto, AJUSTE_PIZARRA);

  // Los borrones: arcos anchos y casi transparentes, como un borrador pasado a medias.
  const borrones = [0, 1, 2].map((i) => {
    const y0 = 34 + r() * 110;
    const x0 = 20 + r() * 80;
    const x1 = x0 + 120 + r() * 140;
    const curva = (r() - 0.5) * 40;
    return { d: `M${r2(x0)},${r2(y0)} Q${r2((x0 + x1) / 2)},${r2(y0 + curva)} ${r2(x1)},${r2(y0 + (r() - 0.5) * 20)}`, w: 14 + i * 5 };
  });
  // La estrellita de tiza, a la derecha: lo único que «se dibujó» además del contenido.
  const ex = 262 + r() * 20;
  const ey = 34 + r() * 14;
  const estrella = Array.from({ length: 10 }, (_, i) => {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? 11 : 4.6;
    return `${i === 0 ? 'M' : 'L'}${r2(ex + Math.cos(ang) * rad)},${r2(ey + Math.sin(ang) * rad)}`;
  }).join(' ') + ' Z';
  const anchoRot = Array.from(rot).length * 7.6;

  return (
    <SvgLamina className={className} familia={LETRA.mano}>
      <defs>
        <radialGradient id={`${uid}v`} cx="50%" cy="45%" r="75%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.07} />
          <stop offset="60%" stopColor="#FFFFFF" stopOpacity={0} />
          <stop offset="100%" stopColor="#000000" stopOpacity={0.28} />
        </radialGradient>
      </defs>
      {/* el marco */}
      <rect x={-4} y={-4} width={328} height={188} fill={MADERA} />
      <g stroke={MADERA_OSC} strokeWidth={0.8} opacity={0.45} fill="none">
        <path d="M0,3.5 C80,2 160,5.5 320,3 M0,6.5 C90,7.8 200,5 320,7 M0,173.5 C100,175 210,172 320,174.5 M0,177 C120,176 220,178.6 320,177" />
      </g>
      <rect x={0} y={0} width={320} height={10} fill={MADERA_CLARA} opacity={0.35} />
      {/* el pizarrón */}
      <rect x={10} y={10} width={300} height={156} rx={2} fill={a} />
      <rect x={10} y={10} width={300} height={156} rx={2} fill={`url(#${uid}v)`} />
      <g fill="none" stroke={CLARO} strokeLinecap="round" opacity={0.05}>
        {borrones.map((bo, i) => <path key={i} d={bo.d} strokeWidth={bo.w} />)}
      </g>
      <rect x={10} y={10} width={300} height={156} rx={2} fill="none" stroke="#000000" strokeOpacity={0.35} strokeWidth={1.5} />
      {/* la bandeja, con dos tizas y el borrador */}
      <rect x={6} y={166} width={308} height={7} rx={1.5} fill={MADERA_OSC} />
      <rect x={222} y={162.6} width={18} height={4.2} rx={2} fill={CLARO} />
      <rect x={244} y={162.6} width={12} height={4.2} rx={2} fill={tizaColor} />
      <rect x={266} y={159} width={30} height={8} rx={1.6} fill="#3B3631" />
      <rect x={266} y={164.5} width={30} height={2.5} fill="#D9D3C4" />

      <NumeroMano digitos={dig} x={numX} y={numY} alto={altoNum} trazo={9} color={tizaColor} semilla={semilla}
        opacidad={0.95} corrida={[0.9, 0.7, 5, 0.16]} />
      {rot && (
        <>
          <text x={rotX} y={46} fill={tiza} fontFamily={LETRA.archivo} fontWeight={700} fontSize={10.5} letterSpacing={2.2} opacity={0.92}>{rot}</text>
          <path d={`M${rotX - 1},${52.5} q${r2(anchoRot / 4)},2.2 ${r2(anchoRot / 2)},0.2 t${r2(anchoRot / 2)},0.6`}
            fill="none" stroke={tizaColor} strokeWidth={1.7} strokeLinecap="round" opacity={0.9} />
        </>
      )}
      <path d={estrella} fill="none" stroke={tiza} strokeWidth={1.3} strokeLinejoin="round" opacity={0.55} />
      <Renglones caja={CAJA} reparto={reparto} color={tiza} familia={LETRA.mano} peso={400} />
    </SvgLamina>
  );
}
