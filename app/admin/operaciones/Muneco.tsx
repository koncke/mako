// =============================================================================
// El muñequito de cada empleado de IA del Centro — diseño PROPIO, en SVG y sin dependencias
// =============================================================================
// Martín (15/10/2026): «Quiero que copie a Grok, que tiene un mejor diseño, y sobre todo me gusta el concepto de los
// muñequitos de IA o "empleados"». La referencia es Grok Bot (xAI, 11/08/2026; su video de lanzamiento, mirado cuadro
// por cuadro): cada Bot es una fila con un personaje de forma simple y color propio, su nombre, lo último que dijo y
// la hora. Y esa misma noche: «Crea más diseños variados de las figuras tipo trabajadores... Con diferentes caras,
// etc... Y que si le doy click pueda elegir cambiar a otro» (el selector: ElegirMuneco.tsx).
//
// Se copia la IDEA (un personaje por empleado, que se reconoce de un vistazo), nunca los personajes de xAI:
//   · el cuerpo es una forma de la casa (círculo, cuadrado, hexágono, triángulo, frijol, gota o píldora) en un color de
//     la paleta categórica (`--grafo-*`, pasteles), no los colores fuertes de Grok;
//   · la cara es nuestra: dos ojos OSCUROS redondos con su brillo, y una boca de seis (sonrisa, risa, dientes,
//     tranquila, asombro, lengua), a veces con mejillas; y un accesorio (antena, brote, lentes, auriculares, moño, gorro);
//   · y los ojos dicen el estado: abiertos si el chat está abierto, parpadeando si trabaja, entrecerrados si el dato es
//     viejo, y dormidos (dos arcos) si el chat está cerrado. Por eso los ojos NO se eligen.
//
// ⚠️ EL ASPECTO SALE DEL NOMBRE (lib/centro-munecos.ts → aspectoDe), o de lo que Martín eligió para ese nombre
// (`aspecto`): el «CRM» de las tres cuentas es el mismo empleado.
// ⚠️ SIN HOOKS y sin ids de SVG (nada de gradientes con `id`): lo dibujan el server (loading.tsx), la computadora y el
// teléfono, y dos muñecos en la misma pantalla no pueden pisarse un `id`.

import type { CSSProperties } from 'react';
import { aspectoDe, type Accesorio, type Aspecto, type CaraMuneco, type Forma } from '@/lib/centro-munecos';

export { aspectoDe, COLORES, FORMAS } from '@/lib/centro-munecos';
export type Animo = 'trabajando' | 'despierto' | 'cansado' | 'dormido';

/** El ánimo sale del estado del chat: lo que el ojo cuenta sin leer nada. */
export function animoDe(c: { estado: 'trabajando' | 'abierto' | 'cerrado' | 'sin_dato'; viejo: boolean }): Animo {
  if (c.estado === 'cerrado' || c.estado === 'sin_dato') return 'dormido';
  if (c.viejo) return 'cansado';
  return c.estado === 'trabajando' ? 'trabajando' : 'despierto';
}

/** Dónde caen los ojos y dónde está la cabeza de cada cuerpo. */
const GEO: Record<Forma, { ojos: number; dx: number; tope: number; brillo: [number, number] }> = {
  circulo: { ojos: 19.5, dx: 5, tope: 5, brillo: [13.5, 12.5] },
  cuadrado: { ojos: 19.5, dx: 5, tope: 5, brillo: [12.5, 11.5] },
  hexagono: { ojos: 19.5, dx: 5, tope: 5, brillo: [13.5, 12.5] },
  triangulo: { ojos: 25.5, dx: 4, tope: 7, brillo: [16, 19] },
  frijol: { ojos: 19.5, dx: 5, tope: 6.5, brillo: [11.5, 13.5] },
  gota: { ojos: 23, dx: 5, tope: 3.5, brillo: [14, 17] },
  pildora: { ojos: 18.5, dx: 4.6, tope: 4, brillo: [13.5, 11] },
};

function Cuerpo({ forma, color }: { forma: Forma; color: string }) {
  const relleno = `var(${color})`;
  // Los polígonos se redondean con un trazo del mismo color y uniones redondas.
  const redondo = { fill: relleno, stroke: relleno, strokeWidth: 5, strokeLinejoin: 'round' as const };
  switch (forma) {
    case 'cuadrado': return <rect x="4" y="5" width="32" height="32" rx="11" fill={relleno} />;
    case 'hexagono': return <polygon points="20,5.5 33,13 33,29 20,36.5 7,29 7,13" {...redondo} />;
    case 'triangulo': return <polygon points="20,7.5 35.5,34 4.5,34" {...redondo} />;
    case 'frijol': return <ellipse cx="20" cy="21" rx="17" ry="14.5" fill={relleno} />;
    case 'gota': return <path d="M20 3.5C26 11 35 17.5 35 25.5a15 12.5 0 0 1-30 0C5 17.5 14 11 20 3.5Z" fill={relleno} />;
    case 'pildora': return <rect x="7" y="4" width="26" height="34" rx="13" fill={relleno} />;
    default: return <circle cx="20" cy="21" r="16" fill={relleno} />;
  }
}

const TINTA = 'var(--ink)';

function Boca({ cara, y }: { cara: CaraMuneco; y: number }) {
  const b = y + 4.6;
  switch (cara) {
    case 'risa': return <path d={`M16.6 ${b - 0.4}h6.8q0 3.8-3.4 3.8t-3.4-3.8Z`} fill={TINTA} />;
    case 'dientes': return (
      <g>
        <path d={`M16 ${b - 0.4}q4 4.8 8 0Z`} fill={TINTA} />
        <path d={`M16.9 ${b + 0.2}h6.2`} stroke="#fff" strokeWidth={0.9} strokeLinecap="round" />
      </g>
    );
    case 'tranquila': return <path d={`M18 ${b + 0.9}h4`} fill="none" stroke={TINTA} strokeWidth={1.6} strokeLinecap="round" />;
    case 'asombro': return <ellipse cx="20" cy={b + 1.3} rx="1.6" ry="1.9" fill={TINTA} />;
    case 'lengua': return (
      <g>
        <path d={`M17.2 ${b}q2.8 2.4 5.6 0`} fill="none" stroke={TINTA} strokeWidth={1.6} strokeLinecap="round" />
        <path d={`M19.4 ${b + 1.6}q1.2 2.4 2.4 0`} fill="var(--bad)" opacity={0.75} />
      </g>
    );
    default: return <path d={`M17.4 ${b}q2.6 2.2 5.2 0`} fill="none" stroke={TINTA} strokeWidth={1.6} strokeLinecap="round" />;
  }
}

function Cara({ forma, cara, animo }: { forma: Forma; cara: CaraMuneco; animo: Animo }) {
  const { ojos: y, dx } = GEO[forma];
  const mejillas = cara === 'risa' || cara === 'lengua' || cara === 'dientes';
  if (animo === 'dormido') {
    return (
      <g fill="none" stroke={TINTA} strokeWidth={1.7} strokeLinecap="round">
        <path d={`M${20 - dx - 2.4} ${y} q2.4 2 4.8 0`} />
        <path d={`M${20 + dx - 2.4} ${y} q2.4 2 4.8 0`} />
        <path d={`M18.6 ${y + 5.2} h2.8`} />
      </g>
    );
  }
  const ry = animo === 'cansado' ? 1.5 : 3.1;
  return (
    <g>
      {mejillas && <>
        <ellipse cx={20 - dx - 3.2} cy={y + 3.6} rx="2.2" ry="1.3" fill="var(--bad)" opacity="0.22" />
        <ellipse cx={20 + dx + 3.2} cy={y + 3.6} rx="2.2" ry="1.3" fill="var(--bad)" opacity="0.22" />
      </>}
      <g className={animo === 'trabajando' ? 'mun-ojos mun-ojos--parpadeo' : 'mun-ojos'} style={{ transformOrigin: `20px ${y}px` }}>
        <ellipse cx={20 - dx} cy={y} rx="2.5" ry={ry} fill={TINTA} />
        <ellipse cx={20 + dx} cy={y} rx="2.5" ry={ry} fill={TINTA} />
        {animo !== 'cansado' && <>
          <circle cx={20 - dx + 0.9} cy={y - 1.2} r="0.85" fill="#fff" />
          <circle cx={20 + dx + 0.9} cy={y - 1.2} r="0.85" fill="#fff" />
        </>}
      </g>
      <Boca cara={cara} y={y} />
    </g>
  );
}

/** El accesorio va arriba de la cabeza (o sobre los ojos, los lentes). */
function Extra({ accesorio, forma }: { accesorio: Accesorio; forma: Forma }) {
  const { ojos: y, dx, tope } = GEO[forma];
  switch (accesorio) {
    case 'antena': return (
      <g>
        <path d={`M20 ${tope + 1}V${tope - 4.5}`} stroke={TINTA} strokeWidth={1.5} strokeLinecap="round" />
        <circle cx="20" cy={tope - 5.5} r="2" fill="var(--warn)" stroke={TINTA} strokeWidth={1} />
      </g>
    );
    case 'brote': return (
      <g>
        <path d={`M20 ${tope + 1}V${tope - 3}`} stroke="var(--good)" strokeWidth={1.5} strokeLinecap="round" />
        <path d={`M20 ${tope - 2.6}q-4.6-0.4-5.4-4q4.4 0 5.4 4Z`} fill="var(--good)" />
        <path d={`M20 ${tope - 2.6}q4.6-0.4 5.4-4q-4.4 0-5.4 4Z`} fill="var(--good)" />
      </g>
    );
    case 'lentes': return (
      <g fill="none" stroke={TINTA} strokeWidth={1.3}>
        <circle cx={20 - dx} cy={y} r="4.3" />
        <circle cx={20 + dx} cy={y} r="4.3" />
        <path d={`M${20 - dx + 4.3} ${y}h${2 * dx - 8.6}`} />
      </g>
    );
    case 'auriculares': return (
      <g>
        <path d={`M6.5 ${y + 1}V${y - 3}a13.5 13.5 0 0 1 27 0v4`} fill="none" stroke={TINTA} strokeWidth={1.6} strokeLinecap="round" />
        <rect x="3.6" y={y - 1} width="5" height="8" rx="2.4" fill={TINTA} />
        <rect x="31.4" y={y - 1} width="5" height="8" rx="2.4" fill={TINTA} />
      </g>
    );
    case 'mono': return (
      <g transform={`translate(28 ${tope + 1.5}) rotate(18)`}>
        <path d="M0 0l-5.2-3.2v6.4Z" fill="var(--bad)" />
        <path d="M0 0l5.2-3.2v6.4Z" fill="var(--bad)" />
        <circle r="1.5" fill="var(--bad)" stroke={TINTA} strokeWidth={0.6} />
      </g>
    );
    case 'gorro': return (
      <g>
        <path d={`M11 ${tope + 3.5}q9-9.5 18 0Z`} fill="var(--primary)" />
        <rect x="10" y={tope + 2.4} width="20" height="3.2" rx="1.6" fill="var(--primary-strong)" />
        <circle cx="20" cy={tope - 2.6} r="2.1" fill="var(--primary-strong)" />
      </g>
    );
    default: return null;
  }
}

/** El muñeco de un empleado. `titulo` decide cómo es (o `aspecto`, si Martín eligió otro); el estado, los ojos;
 *  `espera`, el globito de las tarjetas de la Ticketera que esperan una respuesta de Martín. */
export function Muneco({ titulo, animo, size = 40, espera = 0, style, aspecto }: {
  titulo: string; animo: Animo; size?: number; espera?: number; style?: CSSProperties; aspecto?: Aspecto | null;
}) {
  const { forma, color, cara, accesorio } = aspectoDe(titulo, aspecto);
  const [bx, by] = GEO[forma].brillo;
  return (
    <svg
      className={`mun mun--${animo}`} width={size} height={size} viewBox="0 0 40 40" aria-hidden
      style={{ flex: 'none', display: 'block', overflow: 'visible', ...style }}
    >
      <g className="mun-cuerpo">
        <Cuerpo forma={forma} color={color} />
        {/* El brillo arriba a la izquierda: le da volumen sin un gradiente (que pediría un id). */}
        <ellipse cx={bx} cy={by} rx="4.2" ry="2.6" fill="#fff" opacity="0.38" transform={`rotate(-28 ${bx} ${by})`} />
        <Cara forma={forma} cara={cara} animo={animo} />
        <Extra accesorio={accesorio} forma={forma} />
      </g>
      {espera > 0 && (
        <g className="mun-espera">
          <circle cx="34" cy="7" r="7" fill="var(--warn)" stroke="var(--surface)" strokeWidth="2" />
          <text x="34" y="10.2" textAnchor="middle" fontSize="9" fontWeight="700" fill="#fff">{espera > 9 ? '9+' : espera}</text>
        </g>
      )}
    </svg>
  );
}
