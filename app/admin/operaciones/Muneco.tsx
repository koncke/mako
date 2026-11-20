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
//     tranquila, asombro, lengua), a veces con mejillas. Sin accesorios desde el 16/10/2026 («Elimina los
//     accesorios de los personajes»);
//   · y los ojos dicen el estado: abiertos si el chat está abierto, parpadeando si trabaja, entrecerrados si el dato es
//     viejo, y dormidos (dos arcos) si el chat está cerrado. Por eso los ojos NO se eligen.
//
// ⚠️ EL ASPECTO SALE DEL NOMBRE (lib/centro-munecos.ts → aspectoDe), o de lo que Martín eligió para ese nombre
// (`aspecto`): el «CRM» de las tres cuentas es el mismo empleado.
// ⚠️ SIN HOOKS y sin ids de SVG (nada de gradientes con `id`): lo dibujan el server (loading.tsx), la computadora y el
// teléfono, y dos muñecos en la misma pantalla no pueden pisarse un `id`.

import type { CSSProperties, ReactElement } from 'react';
import { aspectoDe, type Aspecto, type CaraMuneco, type Forma, type IconoDeChat } from '@/lib/centro-munecos';
import { Retrato } from './Retratos';

export { aspectoDe, COLORES, FORMAS } from '@/lib/centro-munecos';
export type Animo = 'trabajando' | 'despierto' | 'cansado' | 'dormido';

/**
 * El ánimo sale del estado del chat: lo que el ojo cuenta sin leer nada. `avisos` (lo que espera a Martín: una pregunta o un
 * «Completado» sin ver): con él, un chat abierto que NO trabaja ni tiene nada para Martín se ve DORMIDO (Martín, 17/10/2026:
 * «nunca un chat "despierto" y que no tenga ni una notif ni un trabajo»). Sin él (`undefined`, una criatura que se elige o se
 * muestra suelta), el de antes: abierto es despierto.
 */
export function animoDe(c: { estado: 'trabajando' | 'abierto' | 'cerrado' | 'sin_dato'; viejo: boolean }, avisos?: number): Animo {
  // Con la foto vieja (el Runner no da vueltas) no se sabe si duerme: «cansado» antes que «dormido» (Martín, 17/10/2026:
  // «aparecen todos los chats como que no están haciendo nada, cuando no es así»).
  if (c.viejo) return 'cansado';
  if (c.estado === 'cerrado' || c.estado === 'sin_dato') return 'dormido';
  if (c.estado === 'trabajando') return 'trabajando';
  return avisos === 0 ? 'dormido' : 'despierto';
}

/** Dónde caen los ojos y dónde está la cabeza de cada cuerpo. */
const GEO: Record<Forma, { ojos: number; dx: number; brillo: [number, number] }> = {
  circulo: { ojos: 19.5, dx: 5, brillo: [13.5, 12.5] },
  cuadrado: { ojos: 19.5, dx: 5, brillo: [12.5, 11.5] },
  hexagono: { ojos: 19.5, dx: 5, brillo: [13.5, 12.5] },
  triangulo: { ojos: 25.5, dx: 4, brillo: [16, 19] },
  frijol: { ojos: 19.5, dx: 5, brillo: [11.5, 13.5] },
  gota: { ojos: 23, dx: 5, brillo: [14, 17] },
  pildora: { ojos: 18.5, dx: 4.6, brillo: [13.5, 11] },
  nube: { ojos: 21.5, dx: 5, brillo: [12, 15.5] },
  diamante: { ojos: 20, dx: 4.6, brillo: [14.5, 13] },
  // La estrella de MaKo: los ojos van en el centro, que es donde la chispa tiene cuerpo.
  estrella: { ojos: 19, dx: 4.2, brillo: [15.5, 14.5] },
};

export function Cuerpo({ forma, color }: { forma: Forma; color: string }) {
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
    // La nube: tres lomas arriba sobre una base redonda (17/10/2026, la Criatura).
    case 'nube': return (
      <g fill={relleno}>
        <circle cx="13" cy="20" r="8.5" /><circle cx="21" cy="15" r="10" /><circle cx="28.5" cy="21" r="7.5" />
        <rect x="5" y="20" width="31" height="15" rx="7.5" />
      </g>
    );
    case 'diamante': return <polygon points="20,5 34.5,21 20,37 5.5,21" {...redondo} />;
    // La chispa de MaKo (app/_components/MakoBrand.tsx → SPARK), rellena para que tenga cuerpo: cuatro puntas
    // redondeadas y el centro ancho donde caben los ojos y la boca. Sólo el Cerebro (lib/centro-munecos.ts → ASPECTO_MAKO).
    case 'estrella': return <path d="M20 3.5C22.2 13 27 17.8 36.5 20C27 22.2 22.2 27 20 36.5C17.8 27 13 22.2 3.5 20C13 17.8 17.8 13 20 3.5Z" {...redondo} />;
    default: return <circle cx="20" cy="21" r="16" fill={relleno} />;
  }
}

// La cara es FIJA en los dos modos (20/10/2026; Martín: «no quiero que cambien las criaturas de color»): con --ink, en
// oscuro los ojos quedaban blancos sobre el cuerpo pastel. Lo mismo el rubor, que iba con --bad (app/globals.css).
const TINTA = 'var(--criatura-tinta)';
const RUBOR = 'var(--criatura-rubor)';

export function Boca({ cara, y }: { cara: CaraMuneco; y: number }) {
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
    // El beso: un corazoncito en lugar de la boca.
    case 'beso': return <path d={`M20 ${b + 2.6}c-2.6-1.6-3-3.6-1.6-4.2c.8-.3 1.4.2 1.6.7c.2-.5.8-1 1.6-.7c1.4.6 1 2.6-1.6 4.2Z`} fill={RUBOR} opacity={0.85} />;
    case 'bigote': return (
      <g>
        <path d={`M17.6 ${b + 1.2}q2.4 2 4.8 0`} fill="none" stroke={TINTA} strokeWidth={1.4} strokeLinecap="round" />
        <path d={`M20 ${b - 0.4}c-1.6-1.4-4.6-1.4-5.6.8c1.8-.6 3.6.2 5.6-.2c2 .4 3.8-.4 5.6.2c-1-2.2-4-2.2-5.6-.8Z`} fill={TINTA} />
      </g>
    );
    // La de gato: «ω».
    case 'gato': return <path d={`M16.8 ${b}q1.6 2.2 3.2 0q1.6 2.2 3.2 0`} fill="none" stroke={TINTA} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />;
    case 'lengua': return (
      <g>
        <path d={`M17.2 ${b}q2.8 2.4 5.6 0`} fill="none" stroke={TINTA} strokeWidth={1.6} strokeLinecap="round" />
        <path d={`M19.4 ${b + 1.6}q1.2 2.4 2.4 0`} fill={RUBOR} opacity={0.75} />
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
        <ellipse cx={20 - dx - 3.2} cy={y + 3.6} rx="2.2" ry="1.3" fill={RUBOR} opacity="0.22" />
        <ellipse cx={20 + dx + 3.2} cy={y + 3.6} rx="2.2" ry="1.3" fill={RUBOR} opacity="0.22" />
      </>}
      <g className="mun-ojos mun-ojos--parpadeo" style={{ transformOrigin: `20px ${y}px` }}>
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

/**
 * Cuándo arranca su movimiento (`--mun-desfase`, en segundos y negativo: empieza a mitad de su ciclo), sacado de cómo es.
 * SIEMPRE VIVAS (21/10/2026, Martín: «las criaturas, siempre, donde sea que estén deben tener su animación de movimiento, y
 * parpadeo»): cada una flota y parpadea con UNA animación CSS (centro.css, criatura.css), sin un timer por criatura; con el
 * mismo desfase todas parpadeaban a la vez, como un tablero. Sale de su aspecto (no del nombre: la estrella es la misma criatura
 * se llame «Cerebro» u «Ops Center»), igual en el server y en el navegador.
 */
function desfaseDe({ forma, color, cara, retrato }: Aspecto): string {
  const clave = `${forma}${color}${cara}${retrato ?? ''}`;
  let h = 0;
  for (let i = 0; i < clave.length; i++) h = (h * 31 + clave.charCodeAt(i)) >>> 0;
  return `-${(h % 37) / 10}s`;
}

/** LOS AVATARES QUE NO SON CRIATURAS (20/11/2026, el Cerebro; la llamada con Leila, 00:39:14: «la criatura de Mako está reservada
 *  únicamente para Ops Center»). Los pide `aspecto.icono` (ASPECTO_RETO / ASPECTO_GRUPO, lib/centro-munecos.ts), en el viewBox del
 *  muñeco. Sin hooks ni ids (ver arriba): el degradé del reto es el FONDO CSS del propio SVG, no un <linearGradient> con `id`.
 *  Dibujados primero en un artefacto (https://claude.ai/artifact/6ixE1LC5s1Pe8bAYrfpCH4): lista 38, cabecera 34, burbuja 26. */
/** El degradé cálido de MaKo, de amarillo a naranja. Fijo: la hoja es blanca en los dos temas. */
const FONDO_RETO = 'linear-gradient(150deg, #F8CB63 0%, #F2B01E 52%, #EC8A1F 100%)';
function AvatarDelReto({ size, style }: { size: number; style?: CSSProperties }) {
  return (
    <svg className="mun mun--reto" width={size} height={size} viewBox="0 0 40 40" aria-hidden
      style={{ flex: 'none', display: 'block', borderRadius: '50%', background: FONDO_RETO, ...style }}>
      {/* La hoja de calendario: su sombra (la misma hoja corrida, sin un filtro que pediría un id), la hoja, su franja y sus dos anillos. */}
      <rect x="10.5" y="9.9" width="19" height="22.6" rx="3.6" fill="#7A3E00" opacity="0.2" />
      <rect x="10.5" y="8.9" width="19" height="22.6" rx="3.6" fill="#fff" />
      <path d="M10.5 12.5a3.6 3.6 0 0 1 3.6-3.6h11.8a3.6 3.6 0 0 1 3.6 3.6v1.5h-19z" fill="#E9781C" />
      <rect x="14.5" y="7.2" width="1.9" height="3.8" rx="0.95" fill="#5A3305" />
      <rect x="23.6" y="7.2" width="1.9" height="3.8" rx="0.95" fill="#5A3305" />
      <text x="20" y="25.2" textAnchor="middle" fontSize="12.5" fontWeight="800" fill="#2E2312">7</text>
      <text x="20" y="29.6" textAnchor="middle" fontSize="3.9" fontWeight="700" fill="#8F6709">días</text>
    </svg>
  );
}
/** El de un grupo de WhatsApp sin foto: tres siluetas blancas en un círculo gris claro. El gris cambia con el tema
 *  (--avatar-grupo-fondo / --avatar-grupo-figura, app/globals.css). La del frente lleva un borde del color del fondo: así se separa de
 *  las de atrás, que son del mismo blanco. También es la foto del grupo en el teléfono (FotoDelGrupo, app/m/second-brain/FilasDelGrupoM.tsx). */
export function AvatarDelGrupo({ size, style }: { size: number; style?: CSSProperties }) {
  const fondo = 'var(--avatar-grupo-fondo, #DFE5E7)';
  return (
    <svg className="mun mun--grupo" width={size} height={size} viewBox="0 0 40 40" aria-hidden style={{ flex: 'none', display: 'block', ...style }}>
      <circle cx="20" cy="20" r="20" fill={fondo} />
      <g fill="var(--avatar-grupo-figura, #FFFFFF)">
        <g opacity="0.8">
          <circle cx="11.6" cy="17.6" r="3.3" />
          <path d="M5.4 30.5v-2a6.2 5.8 0 0 1 12.4 0v2z" />
          <circle cx="28.4" cy="17.6" r="3.3" />
          <path d="M22.2 30.5v-2a6.2 5.8 0 0 1 12.4 0v2z" />
        </g>
        <g stroke={fondo} strokeWidth="1.6">
          <circle cx="20" cy="15.4" r="4.6" />
          <path d="M12.4 30.5v-2.2a7.6 7 0 0 1 15.2 0v2.2z" />
        </g>
      </g>
    </svg>
  );
}
const ICONOS: Record<IconoDeChat, (p: { size: number; style?: CSSProperties }) => ReactElement> = { reto: AvatarDelReto, grupo: AvatarDelGrupo };

/** El muñeco de un empleado. `titulo` decide cómo es (o `aspecto`, si Martín eligió otro); el estado, los ojos;
 *  `espera`, el globito de las tarjetas de la Ticketera que esperan una respuesta de Martín. */
export function Muneco({ titulo, animo, size = 40, espera = 0, style, aspecto }: {
  titulo: string; animo: Animo; size?: number; espera?: number; style?: CSSProperties; aspecto?: Aspecto | null;
}) {
  // El avatar del reto o del grupo (`aspecto.icono`), antes del título: «MaKo» sería la criatura.
  if (aspecto?.icono) { const Icono = ICONOS[aspecto.icono]; return <Icono size={size} style={style} />; }
  const { forma, color, cara, retrato } = aspectoDe(titulo, aspecto);
  const [bx, by] = GEO[forma].brillo;
  return (
    <svg
      className={`mun mun--${animo}`} width={size} height={size} viewBox="0 0 40 40" aria-hidden
      style={{ flex: 'none', display: 'block', overflow: 'visible', ['--mun-desfase' as string]: desfaseDe({ forma, color, cara, retrato }), ...style }}
    >
      <g className="mun-cuerpo">
        {retrato ? <Retrato id={retrato} animo={animo} /> : (
          <>
            <Cuerpo forma={forma} color={color} />
            {/* El brillo arriba a la izquierda: le da volumen sin un gradiente (que pediría un id). */}
            <ellipse cx={bx} cy={by} rx="4.2" ry="2.6" fill="#fff" opacity="0.38" transform={`rotate(-28 ${bx} ${by})`} />
            <Cara forma={forma} cara={cara} animo={animo} />
          </>
        )}
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
