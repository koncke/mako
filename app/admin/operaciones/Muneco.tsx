// =============================================================================
// El muñequito de cada empleado de IA del Centro (16/10/2026) — diseño PROPIO, en SVG y sin dependencias
// =============================================================================
// Martín: «Quiero que copie a Grok, que tiene un mejor diseño, y sobre todo me gusta el concepto de los
// muñequitos de IA o "empleados"». La referencia es Grok Bot (xAI, 11/08/2026; su video de lanzamiento,
// mirado cuadro por cuadro el 15/10): cada Bot es una fila con un personaje de forma simple y color propio,
// su nombre, lo último que dijo y la hora.
//
// Se copia la IDEA (un personaje por empleado, que se reconoce de un vistazo), nunca los personajes de xAI:
//   · el cuerpo es una forma de la casa (círculo, cuadrado redondeado, hexágono, triángulo o frijol) en un color
//     de la paleta categórica de la casa (`--grafo-*`, pasteles), no los colores fuertes de Grok;
//   · la cara es nuestra: dos ojos OSCUROS redondos con su brillo y una sonrisa (Grok usa dos trazos blancos y
//     ninguna boca);
//   · y los ojos dicen el estado: abiertos si el chat está abierto, parpadeando si trabaja, entrecerrados si el
//     dato es viejo, y dormidos (dos arcos) si el chat está cerrado.
//
// ⚠️ EL ASPECTO SALE DEL TÍTULO NORMALIZADO, no de la sesión: el «CRM» de la cuenta 1 y el de la cuenta 3 son el
// mismo empleado en dos turnos, y se reconocen igual. Lo que los separa es la sección de la barra (la cuenta).
// ⚠️ SIN HOOKS y sin ids de SVG (nada de gradientes con `id`): lo dibujan el server (loading.tsx), la
// computadora y el teléfono, y dos muñecos en la misma pantalla no pueden pisarse un `id`.

import type { CSSProperties } from 'react';

export const FORMAS = ['circulo', 'cuadrado', 'hexagono', 'triangulo', 'frijol'] as const;
export type Forma = (typeof FORMAS)[number];
/** La paleta categórica de la casa (app/globals.css). Pasteles: el ojo oscuro se lee sobre todos. `--grafo-funnel`
 *  queda afuera a propósito: al lado de `--grafo-panorama` son dos verdes que no se distinguen en 38 px. */
export const COLORES = [
  '--grafo-documentos', '--grafo-panorama', '--grafo-oferta', '--grafo-cliente', '--grafo-productos',
  '--grafo-entregables', '--grafo-avatares', '--grafo-razones', '--grafo-voz',
] as const;
type Color = (typeof COLORES)[number];

/**
 * El equipo de siempre, con su aspecto FIJO para que no se repita entre ellos (con un hash, dos de las áreas
 * principales pueden salir iguales). Se busca por el comienzo del título normalizado; lo demás, por hash.
 */
const EQUIPO: Array<[string, Forma, Color]> = [
  ['estrategia', 'circulo', '--grafo-avatares'],
  ['centro de operaciones', 'cuadrado', '--grafo-documentos'],
  ['crm', 'hexagono', '--grafo-oferta'],
  ['automations', 'cuadrado', '--grafo-panorama'],
  ['chatbot', 'cuadrado', '--grafo-panorama'],
  ['video editor', 'triangulo', '--grafo-razones'],
  ['image editor', 'triangulo', '--grafo-entregables'],
  ['landing', 'frijol', '--grafo-productos'],
  ['web generator', 'frijol', '--grafo-productos'],
  ['graphics', 'hexagono', '--grafo-cliente'],
  ['dashboard', 'hexagono', '--grafo-cliente'],
  ['mako mobile', 'circulo', '--grafo-documentos'],
  ['offer', 'circulo', '--grafo-voz'],
  ['mako pricing', 'frijol', '--grafo-voz'],
  ['onboarding', 'circulo', '--grafo-entregables'],
  ['ads', 'triangulo', '--grafo-oferta'],
  ['plan', 'cuadrado', '--grafo-razones'],
  ['integracion', 'hexagono', '--grafo-avatares'],
  ['pagos', 'hexagono', '--grafo-avatares'],
  ['seguridad', 'frijol', '--grafo-cliente'],
  ['customer success', 'circulo', '--grafo-razones'],
];

export type Animo = 'trabajando' | 'despierto' | 'cansado' | 'dormido';

const normal = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Un hash chico y estable (FNV-1a): el mismo título da siempre el mismo muñeco, en el server y en el navegador. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

export function aspectoDe(titulo: string): { forma: Forma; color: Color } {
  const t = normal(titulo) || '?';
  const fijo = EQUIPO.find(([pre]) => t.startsWith(pre));
  if (fijo) return { forma: fijo[1], color: fijo[2] };
  const h = hash(t);
  return { forma: FORMAS[h % FORMAS.length], color: COLORES[Math.floor(h / FORMAS.length) % COLORES.length] };
}

/** El ánimo sale del estado del chat: lo que el ojo cuenta sin leer nada. */
export function animoDe(c: { estado: 'trabajando' | 'abierto' | 'cerrado' | 'sin_dato'; viejo: boolean }): Animo {
  if (c.estado === 'cerrado' || c.estado === 'sin_dato') return 'dormido';
  if (c.viejo) return 'cansado';
  return c.estado === 'trabajando' ? 'trabajando' : 'despierto';
}

function Cuerpo({ forma, color }: { forma: Forma; color: string }) {
  const relleno = `var(${color})`;
  // Los polígonos se redondean con un trazo del mismo color y uniones redondas.
  const redondo = { fill: relleno, stroke: relleno, strokeWidth: 5, strokeLinejoin: 'round' as const };
  switch (forma) {
    case 'cuadrado': return <rect x="4" y="5" width="32" height="32" rx="11" fill={relleno} />;
    case 'hexagono': return <polygon points="20,5.5 33,13 33,29 20,36.5 7,29 7,13" {...redondo} />;
    case 'triangulo': return <polygon points="20,7.5 35.5,34 4.5,34" {...redondo} />;
    case 'frijol': return <ellipse cx="20" cy="21" rx="17" ry="14.5" fill={relleno} />;
    default: return <circle cx="20" cy="21" r="16" fill={relleno} />;
  }
}

function Cara({ forma, animo }: { forma: Forma; animo: Animo }) {
  const y = forma === 'triangulo' ? 25.5 : 19.5;
  const dx = forma === 'triangulo' ? 4 : 5;
  const tinta = 'var(--ink)';
  if (animo === 'dormido') {
    return (
      <g fill="none" stroke={tinta} strokeWidth={1.7} strokeLinecap="round">
        <path d={`M${20 - dx - 2.4} ${y} q2.4 2 4.8 0`} />
        <path d={`M${20 + dx - 2.4} ${y} q2.4 2 4.8 0`} />
        <path d={`M18.6 ${y + 5.2} h2.8`} />
      </g>
    );
  }
  const ry = animo === 'cansado' ? 1.5 : 3.1;
  return (
    <g>
      <g className={animo === 'trabajando' ? 'mun-ojos mun-ojos--parpadeo' : 'mun-ojos'} style={{ transformOrigin: `20px ${y}px` }}>
        <ellipse cx={20 - dx} cy={y} rx="2.5" ry={ry} fill={tinta} />
        <ellipse cx={20 + dx} cy={y} rx="2.5" ry={ry} fill={tinta} />
        {animo !== 'cansado' && <>
          <circle cx={20 - dx + 0.9} cy={y - 1.2} r="0.85" fill="#fff" />
          <circle cx={20 + dx + 0.9} cy={y - 1.2} r="0.85" fill="#fff" />
        </>}
      </g>
      <path d={`M17.4 ${y + 4.6} q2.6 2.2 5.2 0`} fill="none" stroke={tinta} strokeWidth={1.6} strokeLinecap="round" />
    </g>
  );
}

/** El muñeco de un empleado. `titulo` decide la forma y el color; el estado, los ojos; `espera`, el globito de
 *  las tarjetas de la Ticketera que esperan una respuesta de Martín (lo que Grok Bot llama pedir aprobación). */
export function Muneco({ titulo, animo, size = 40, espera = 0, style }: { titulo: string; animo: Animo; size?: number; espera?: number; style?: CSSProperties }) {
  const { forma, color } = aspectoDe(titulo);
  return (
    <svg
      className={`mun mun--${animo}`} width={size} height={size} viewBox="0 0 40 40" aria-hidden
      style={{ flex: 'none', display: 'block', overflow: 'visible', ...style }}
    >
      <g className="mun-cuerpo">
        <Cuerpo forma={forma} color={color} />
        {/* El brillo arriba a la izquierda: le da volumen sin un gradiente (que pediría un id). */}
        <ellipse cx="13.5" cy={forma === 'triangulo' ? 19 : 12.5} rx="4.2" ry="2.6" fill="#fff" opacity="0.38" transform={`rotate(-28 13.5 ${forma === 'triangulo' ? 19 : 12.5})`} />
        <Cara forma={forma} animo={animo} />
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
