// =============================================================================
// /vsl/cobranza con el DISEÑO de la portada de Rebill (https://www.rebill.com/es): copiado el 11/11/2026, copia fiel el 14/11/2026
// =============================================================================
// Medido con Chromium a 1440 y a 390 px el 14/11/2026: capturas por sección, la ventana en cada paso de un scroll lento, video,
// `getAnimations()`, MutationObserver, los hovers antes y después, y SUS SCRIPTS y su CSS (vienen en el HTML: la página es un clon
// en Astro de su Webflow). Los valores, en docs/diseno/landings-competencia/cobranza.md; el relevo con capturas, en la carpeta de
// notas de la sesión, referencias-landings/cobranza/.
//
// LO QUE SE MUEVE, como en Rebill (y nada más):
//   · El hero: a la derecha, cuatro «checkouts» que se turnan cada 4 s (el grupo entra en 1 s; su pastilla a los 0,2 s, la caja a
//     los 0,4 s, la tarjeta chica a los 0,5 s, cada una subiendo 5 px en 0,8 s). Aquí, cuatro pantallas REALES de la Cobranza de MaKo.
//   · Las tres tarjetas de cifras se dan vuelta con el mouse: la frase grande se va, aparece la explicación y el fondo se oscurece.
//   · «Conexiones locales» es una sección de 600 alturas de pantalla con dos capas pegadas: el título (y su imagen, que sube cuando
//     se baja el 40 % de su tramo) y, después, las cinco piezas, que se turnan según cuánto se bajó (su script, copiado).
//   · «Integración simple» es otra de 600: primero el título centrado; al bajar el 40 % de una pantalla, el título a la izquierda,
//     las tres formas debajo y el dibujo de cada una a la derecha; cada pantalla y media pasa a la forma siguiente (la de antes se
//     pliega). La tercera es la lista que gira cada 1,5 s hacia el centro (su Make; aquí, las plantillas de cobranza hacia MaKo).
//   · Las preguntas: tres tarjetas por fila; con el mouse encima la tarjeta crece (1,35 contra 0,825) y la pregunta se va en 0,3 s
//     para mostrar la respuesta en blanco. En el teléfono, se tocan.
//   · En el teléfono (≤ 991 px) las dos secciones pegadas son listas quietas, como en Rebill.
// Todo eso es un <script data-visor> (el visor de Martín borra los demás), que limpia su estado al arrancar (pulir.mjs guarda el DOM
// después de correrlo). Con «menos movimiento» nada gira, las secciones pegadas son las listas quietas y los videos quedan quietos.
//
// De MaKo: el logo, el azul #2F6FED donde Rebill pone su #0056F6 (y #1B3E8F por su #003497), el botón para empezar, las PANTALLAS
// (grabadas en los bancos C:/dev/bancos-portada/banco-cobranza-landing y banco-cobranza-flujo, con clientes inventados) y el caso de
// Mauricio en «Historias de clientes». Letra: Rebill usa SF Pro Display (de Apple, no se puede servir): va Inter, con sus tamaños,
// pesos y espaciados. Sus `rem` cambian con el ancho (su `html { font-size }` fluido entre 992 y 1440): aquí es `--r`, la misma fórmula.
// Lo que se sacó (sin contenido real de MaKo): la tira de logos de sus clientes y «Leer historia», «Hablar con un experto» (MaKo no
// agenda llamadas: el segundo botón lleva a las piezas), sus íconos de pieza, su cubo, sus logos de Make, los otros cinco casos del
// carrusel (hay uno), «Respaldado por» y sus redes. El pie es el del sitio (el copiado queda oculto, con el resto de las funciones).
// =============================================================================

import type { ReactNode } from 'react';
import type { PropsDiseno } from '.';
import type { Bloque } from '../tipos';
import { RUTA_CTA, CASO, LogoMaKo, EstrellaMaKo, TEXTO_CTA, html, otrasFunciones, TEXTO_CIERRE } from '../marca';
import { DETALLE_CIFRAS, DISPAROS_COBRANZA } from '../cobranza';

const P = 'd-cobranza';
const c = (n: string) => `${P}-${n}`;
const A = '/vsl-assets/cobranza';
const LOGOS = '/vsl-assets/logos/integraciones';

type Img = { src: string; alt: string; w: number; h: number };
type Grabacion = { video: string; poster: string; alt: string; bucle?: boolean };

/**
 * Los cuatro «checkouts» del hero, en su orden. Rebill: la pastilla del país, el checkout de un cliente en su ventana del navegador y
 * el panel de pagos encima. Aquí: la pastilla de la forma de cobrar, la ficha REAL de un cliente (banco-cobranza-landing, fotos.mjs) y
 * la ventana de ese cobro encima. `ancho`: cuánto de la caja ocupa la pieza chica (Rebill, 80 % con su panel apaisado).
 */
export const HERO_GRUPOS: readonly { pastilla: { logo?: string; texto: string }; caja: Img; chico: Img & { ancho: number } }[] = [
  {
    pastilla: { logo: `${LOGOS}/stripe.png`, texto: 'Stripe · en dólares' },
    caja: { src: `${A}/hero-1.webp`, alt: 'La ficha de Paula Romero en MaKo: debe $1,000, la cuota 2 venció', w: 1320, h: 931 },
    chico: { src: `${A}/hero-1-chico.webp`, alt: 'Link listo: el link de la cuota 2, para copiar o abrir en WhatsApp', w: 780, h: 605, ancho: 50 },
  },
  {
    pastilla: { logo: `${LOGOS}/mercadopago.svg`, texto: 'Mercado Pago · en pesos' },
    caja: { src: `${A}/hero-2.webp`, alt: 'Cobrar la cuota 2 con Mercado Pago: el monto en pesos', w: 1320, h: 931 },
    chico: { src: `${A}/hero-2-chico.webp`, alt: '¿Con qué cobras? Stripe, tarjeta en dólares, o Mercado Pago, en ARS', w: 780, h: 634, ancho: 50 },
  },
  {
    pastilla: { texto: 'Transferencia' },
    caja: { src: `${A}/hero-3.webp`, alt: 'La ficha de Paula Romero al día: pagó todo', w: 1320, h: 931 },
    chico: { src: `${A}/hero-3-chico.webp`, alt: 'Marcar la cuota 2 como pagada, por transferencia', w: 700, h: 631, ancho: 46 },
  },
  {
    pastilla: { texto: 'Suscripción' },
    caja: { src: `${A}/hero-4.webp`, alt: 'La suscripción de Tomás Herrera: $300 por mes, al día', w: 1320, h: 931 },
    chico: { src: `${A}/hero-4-chico.webp`, alt: 'Paga hoy $300 por mes, le toca el 12 de diciembre, pagó $1,200', w: 900, h: 504, ancho: 72 },
  },
];

/**
 * La pantalla de cada pieza de «Conexiones locales», en el orden de las piezas de ../cobranza.ts (Rebill: una captura de su producto
 * por pieza). Aquí, grabaciones de la app real (bancos de C:/dev/bancos-portada), con su póster en el PRIMER cuadro. La del Dashboard
 * es la entrada de la hoja Cobranza de la portada (sitio/tableros): corre una vez y queda quieta, sin bucle.
 */
export const PANTALLAS_PIEZAS: readonly Grabacion[] = [
  { video: `${A}/link.webm`, poster: `${A}/link.jpg`, alt: 'Cobrar la cuota 2 desde la ficha: con qué cobras y el link listo para mandar' },
  { video: `${A}/cuotas.webm`, poster: `${A}/cuotas.jpg`, alt: 'Las cuotas de Paula en su ficha y la cuota 2 marcada como pagada, por transferencia' },
  { video: `${A}/suscripcion.webm`, poster: `${A}/suscripcion.jpg`, alt: 'La suscripción de Tomás en su ficha: cada mes, lo que tocaba y lo que entró' },
  { video: `${A}/avisos.webm`, poster: `${A}/avisos.jpg`, alt: 'La plantilla «Una Cuota Venció» en Automations: el aviso, a los 2 días y a los 3 días' },
  { video: '/vsl-assets/sitio/tableros/cobranza.webm', poster: '/vsl-assets/sitio/tableros/cobranza.jpg', alt: 'La hoja Cobranza del Dashboard: lo que te deben, lo cobrado y a quién perseguir', bucle: false },
];

/** El dibujo de cada forma de «Integración simple» (Rebill: su cubo, su formulario y su código; su API y su respuesta; su Make). */
export const SDK_STRIPE = {
  forma: { src: `${A}/sdk-con-que.webp`, alt: '¿Con qué cobras? Stripe o Mercado Pago, en el asistente de la ficha', w: 780, h: 634 },
  codigo: { src: `${A}/sdk-link.webp`, alt: 'El link de pago, con Copiar y Abrir WhatsApp', w: 720, h: 242 },
} as const;
export const SDK_MP = {
  base: { src: `${A}/sdk-monto.webp`, alt: '¿Cuánto es cuota 2 en ARS? Se cobra $ 1.450.000 ARS', w: 780, h: 579 },
  tarjeta: { src: `${A}/sdk-listo.webp`, alt: 'Link listo: Copiar y Abrir WhatsApp', w: 560, h: 434 },
} as const;
/** Las pastillas al lado del monto (Rebill: «Create payment», «Define amount and currency», «Response real time»): los pasos reales. */
const PASOS_MP = ['Eliges Mercado Pago', 'Pones el monto en pesos', 'Se marca solo al pagar'];
/** Lo que sale del centro en la tercera forma (Rebill: Slack «New customer» y Rebill «Create subscription»). */
const SALIDAS = [{ t: 'Tu grupo de WhatsApp', s: 'Aviso de MaKo' }, { t: 'Tu cliente', s: 'Recibo en PDF' }];

/** Los íconos de las piezas (Rebill: uno de 32 px por pieza), en su orden: link, cuotas, suscripción, avisos, tablero. */
const ICONOS_PIEZA: readonly string[][] = [
  ['M9 15l6 -6', 'M11 6l.463 -.536a5 5 0 0 1 7.071 7.072l-.534 .464', 'M13 18l-.397 .534a5.068 5.068 0 0 1 -7.127 0a4.972 4.972 0 0 1 0 -7.071l.524 -.463'],
  ['M4 4h6v6h-6z', 'M14 4h6v6h-6z', 'M4 14h6v6h-6z', 'M14 14h6v6h-6z'],
  ['M10.5 21h-4.5a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v3', 'M16 3v4', 'M8 3v4', 'M4 11h10', 'M18 18m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0', 'M18 16.5v1.5l.5 .5'],
  ['M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6', 'M9 17v1a3 3 0 0 0 6 0v-1'],
  ['M3 13a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z', 'M15 9a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z', 'M9 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z', 'M4 20h14'],
];
function Icono({ d, tam = 32 }: { d: readonly string[]; tam?: number }) {
  return <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d.map((x) => <path key={x} d={x} />)}</svg>;
}

// ── Los dibujos de las tarjetas de cifras (Rebill: un globo de puntos, escalones que suben y una órbita de íconos, en celeste sobre
//    azul noche). Dibujados aquí, en SVG, con lo que dice cada número de MaKo. ──
const CEL = '#A8C5FF';
/** «2 pasarelas»: una órbita con las dos pasarelas y lo que cobran (tarjeta y transferencia). Los logos van como <img> encima del
 *  SVG, en % de su caja (420 × 300): el visor no reescribe el `href` de un <image> de SVG. */
function DibujoPasarelas() {
  const nodo = (x: number, y: number, r: number, hijo?: ReactNode) => <g transform={`translate(${x} ${y})`}><circle r={r} fill="#08132E" stroke="#2F6FED" strokeOpacity=".7" />{hijo}</g>;
  const logo = (x: number, y: number, src: string, t = 36) => <img className={c('pcard-logo')} src={src} alt="" width={t} height={t} style={{ left: `${(x / 420) * 100}%`, top: `${(y / 300) * 100}%`, width: `${(t / 420) * 100}%` }} />;
  return (
    <div className={c('pcard-dib-w')}>
      <svg className={c('pcard-dib')} viewBox="0 0 420 300" aria-hidden="true">
        <circle cx="215" cy="330" r="150" fill="none" stroke="#2F6FED" strokeOpacity=".45" />
        <circle cx="300" cy="360" r="120" fill="none" stroke="#2F6FED" strokeOpacity=".3" />
        {nodo(88, 232, 34)}
        {nodo(196, 182, 34)}
        {nodo(304, 214, 26, <g fill="none" stroke={CEL} strokeWidth="1.6"><rect x="-13" y="-9" width="26" height="18" rx="3" /><path d="M-13 -3h26" /></g>)}
        {nodo(380, 268, 24, <g fill="none" stroke={CEL} strokeWidth="1.6"><path d="M-12 8h24M-10 -2v8M-3 -2v8M4 -2v8M11 -2v8M-13 -4l13 -8 13 8z" /></g>)}
      </svg>
      {logo(88, 232, `${LOGOS}/stripe.png`, 34)}
      {logo(196, 182, `${LOGOS}/mercadopago.svg`, 40)}
    </div>
  );
}
/** «5 días»: los días que faltan, como escalones que suben hasta el vencimiento. */
function DibujoDias({ dias }: { dias: number }) {
  const n = Math.max(1, Math.min(dias, 7)) + 1;
  return (
    <svg className={c('pcard-dib')} viewBox="0 0 420 300" aria-hidden="true">
      <path d="M20 290 C 160 240, 280 150, 400 40" fill="none" stroke="#2F6FED" strokeOpacity=".7" />
      {Array.from({ length: n }, (_, i) => {
        const x = 26 + i * (368 / n), w = 368 / n - 10, h = 46 + i * (190 / n), ultimo = i === n - 1;
        return (
          <g key={i}>
            <rect x={x} y={300 - h} width={w} height={h + 6} rx="4" fill="#08132E" stroke="#2F6FED" strokeOpacity=".55" />
            <rect x={x} y={300 - h} width={w} height="10" rx="4" fill={ultimo ? '#F2B01E' : CEL} />
            <text x={x + w / 2} y={300 - h + 32} textAnchor="middle" fontSize="13" fontWeight="500" fill={ultimo ? '#F2B01E' : CEL}>{ultimo ? 'vence' : `${n - 1 - i} d`}</text>
          </g>
        );
      })}
    </svg>
  );
}
/** «3 avisos»: tres escalones (el día que vence, a las 48 h y a las 72 h), como los de Rebill. */
function DibujoAvisos() {
  const cubo = (x: number, y: number, t: string) => (
    <g transform={`translate(${x} ${y})`}>
      <path d="M0 0 L70 -40 L140 0 L70 40 Z" fill={CEL} />
      <path d="M0 0 L70 40 L70 140 L0 100 Z" fill="#08132E" stroke="#2F6FED" strokeOpacity=".5" />
      <path d="M140 0 L70 40 L70 140 L140 100 Z" fill="#0B1A3D" stroke="#2F6FED" strokeOpacity=".5" />
      <text x="70" y="5" textAnchor="middle" fontSize="16" fontWeight="600" fill="#0B1A3D">{t}</text>
    </g>
  );
  return (
    <svg className={c('pcard-dib')} viewBox="0 0 420 300" aria-hidden="true">
      <path d="M0 290 C 140 250, 260 160, 330 30" fill="none" stroke="#2F6FED" strokeOpacity=".7" />
      {cubo(30, 250, 'Día 0')}{cubo(140, 180, '48 h')}{cubo(250, 100, '72 h')}
    </svg>
  );
}

/** La imagen que sube debajo del título de «Conexiones locales» (Rebill: un hexágono con tres capas, 288 px). */
function Nivel() {
  return (
    <svg className={c('nivel')} viewBox="0 0 288 320" role="img" aria-label="Tres capas: el link, las cuotas y el aviso">
      <path d="M144 8 L276 84 L276 236 L144 312 L12 236 L12 84 Z" fill="#11151F" />
      <path d="M144 8 L276 84 L144 160 L12 84 Z" fill="#161B27" />
      {[0, 1, 2].map((i) => (
        <path key={i} d={`M144 ${96 + i * 34} L238 ${150 + i * 34} L144 ${204 + i * 34} L50 ${150 + i * 34} Z`} fill="#04102B" stroke="#E5EEFF" strokeWidth="3" strokeLinejoin="round" />
      ))}
    </svg>
  );
}

/** El cubo de la primera forma (Rebill: su cubo azul con «SDK»): aquí, con la pasarela. */
function Cubo({ texto }: { texto: string }) {
  return (
    <svg className={c('d-cubo')} viewBox="0 0 300 330" aria-hidden="true">
      <defs>
        <linearGradient id="dco-cara-1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#1B3E8F" /><stop offset="1" stopColor="#061233" /></linearGradient>
        <linearGradient id="dco-cara-2" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2F6FED" /><stop offset="1" stopColor="#0B2160" /></linearGradient>
        <linearGradient id="dco-tapa" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#2F6FED" /><stop offset="1" stopColor="#1B3E8F" /></linearGradient>
        <radialGradient id="dco-luz" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#2F6FED" stopOpacity=".55" /><stop offset="1" stopColor="#2F6FED" stopOpacity="0" /></radialGradient>
      </defs>
      <ellipse cx="150" cy="290" rx="150" ry="40" fill="url(#dco-luz)" />
      <path d="M150 20 L280 95 L150 170 L20 95 Z" fill="url(#dco-tapa)" />
      <path d="M20 95 L150 170 L150 320 L20 245 Z" fill="url(#dco-cara-1)" />
      <path d="M280 95 L150 170 L150 320 L280 245 Z" fill="url(#dco-cara-2)" />
      <path d="M20 95 L150 170" stroke="#5B8FF2" strokeWidth="2" />
      <text x="0" y="0" fontSize="34" fontWeight="500" fill="#CCDEFF" transform="matrix(.87 .5 0 1 40 162)">{texto}</text>
    </svg>
  );
}

function Chevron() {
  return <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M10 8l4 4-4 4" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function Boton({ href = RUTA_CTA, texto = TEXTO_CTA, tercero = false, clase = '' }: { href?: string; texto?: string; tercero?: boolean; clase?: string }) {
  return (
    <a href={href} className={`${c('btn')}${tercero ? ` ${c('btn-3')}` : ''}${clase ? ` ${clase}` : ''}`}>
      <span className={c('btn-t')}>{texto}</span><span className={c('btn-i')}><Chevron /></span>
    </a>
  );
}

/** La barra copiada de Rebill (queda escondida: arriba va la del sitio, TemaSitio.BARRA_PROPIA). */
function Barra({ links }: { links: { href: string; t: string }[] }) {
  return (
    <header className={c('barra')}>
      <div className={c('barra-in')}>
        <LogoMaKo className={c('logo')} tamano={30} claro />
        <nav className={c('nav')} aria-label="Secciones">{links.map((l) => <a key={l.href} href={l.href}>{l.t}</a>)}</nav>
        <a href={RUTA_CTA} className={c('btn-barra')}>{TEXTO_CTA}</a>
      </div>
    </header>
  );
}

function Pin() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 13a3 3 0 1 0 0 -6a3 3 0 0 0 0 6z" /><path d="M12 21s-6 -6.5 -6 -11a6 6 0 1 1 12 0c0 4.5 -6 11 -6 11z" /><path d="M5 21h14" /></svg>;
}

function Hero({ b }: { b: Extract<Bloque, { tipo: 'hero' }> }) {
  return (
    <section className={c('hero')} data-tema-fijo="">
      <div className={c('g')}>
        <div className={c('hero-in')}>
          <div className={c('hero-txt')}>
            <h1 className={c('h1')} dangerouslySetInnerHTML={html(b.titulo)} />
            <div className={c('hero-p')}>
              <p dangerouslySetInnerHTML={html(b.bajada)} />
              {b.puntos?.map((t) => <p key={t} dangerouslySetInnerHTML={html(t)} />)}
            </div>
            <div className={`${c('btns')} ${c('btns-hero')}`}>
              <Boton />
              <Boton href={`#${c('piezas')}`} texto="Ver cómo cobras" tercero />
            </div>
          </div>
          <div className={c('hero-anim')}>
            <div className={c('ck')}>
              {HERO_GRUPOS.map((g, i) => (
                <div key={g.caja.src} className={`${c('ck-g')}${i === 0 ? ` ${c('on')}` : ''}`}>
                  <div className={c('ck-in')}>
                    <span className={c('ck-pais')}>
                      <Pin />
                      {g.pastilla.logo ? <img src={g.pastilla.logo} alt="" width={18} height={18} /> : null}
                      {g.pastilla.texto}
                    </span>
                    <div className={c('ck-caja')}>
                      <div className={c('ck-nav')} aria-hidden="true"><i /><i /><i /><span>hola-mako.com/crm</span></div>
                      <img src={g.caja.src} alt={g.caja.alt} width={g.caja.w} height={g.caja.h} loading={i ? 'lazy' : 'eager'} decoding="async" />
                    </div>
                    <img className={c('ck-chico')} style={{ width: `${g.chico.ancho}%` }} src={g.chico.src} alt={g.chico.alt} width={g.chico.w} height={g.chico.h} loading={i ? 'lazy' : 'eager'} decoding="async" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <span className={c('elipse')} aria-hidden="true" />
    </section>
  );
}

/** «Infraestructura financiera para tu negocio en las Américas»: el título y las tres tarjetas que se dan vuelta. */
function Cifras({ b }: { b: Extract<Bloque, { tipo: 'cifras' }> }) {
  const dibujos = [<DibujoPasarelas key="p" />, <DibujoDias key="d" dias={Number(b.items[1]?.valor) || 5} />, <DibujoAvisos key="a" />];
  return (
    <div className={c('plat')}>
      <span className={c('elipse-2')} aria-hidden="true" />
      <div className={c('g')}>
        <div className={c('plat-in')}>
          {b.titulo ? <h2 className={`${c('h')} ${c('h-plat')}`}>{b.titulo}</h2> : null}
          <div className={c('plat-grid')}>
            {b.items.map((it, i) => (
              <div key={it.label} className={c('pcard')} tabIndex={0}>
                <div className={c('pcard-bg')}>{dibujos[i] ?? null}</div>
                <div className={c('pcard-in')}>
                  <div className={c('pcard-wrap')}>
                    <p className={c('pcard-1')}><span>{it.valor}</span> {it.label}</p>
                    {DETALLE_CIFRAS[i] ? <p className={c('pcard-2')}>{DETALLE_CIFRAS[i]}</p> : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Pieza({ f, i }: { f: Extract<Bloque, { tipo: 'filas' }>['items'][number]; i: number }) {
  return (
    <div className={c('sl-txt')}>
      <span className={c('sl-linea')} aria-hidden="true" />
      <div className={c('sl-cont')}>
        <span className={c('sl-ico')}><Icono d={ICONOS_PIEZA[i] ?? ICONOS_PIEZA[0]} /></span>
        <h3 className={c('sl-h')} dangerouslySetInnerHTML={html(f.titulo)} />
        <p className={c('sl-p')} dangerouslySetInnerHTML={html(f.texto)} />
      </div>
    </div>
  );
}

function VideoPieza({ g }: { g: Grabacion | undefined }) {
  if (!g) return null;
  return <video src={g.video} poster={g.poster} muted loop={g.bucle !== false} playsInline preload="none" aria-label={g.alt} data-tema-fijo="" />;
}

/** «Conexiones locales.»: el título pegado con su imagen que sube, y las cinco piezas que se turnan con el scroll. En el teléfono, la lista. */
function Piezas({ b }: { b: Extract<Bloque, { tipo: 'filas' }> }) {
  const titulo = (
    <>
      <h2 className={`${c('h')} ${c('h-plat')}`} dangerouslySetInnerHTML={html(b.titulo)} />
      {b.etiqueta ? <p className={c('int-sub')}>{b.etiqueta}</p> : null}
      {b.bajada ? <p className={c('int-p')} dangerouslySetInnerHTML={html(b.bajada)} /> : null}
    </>
  );
  return (
    <>
      <div className={c('int')} id={c('piezas')}>
        <div className={`${c('int-titulo')} ${c('on')}`}>
          <div className={c('int-tw')}>{titulo}</div>
          <div className={c('int-img')}><Nivel /></div>
        </div>
        <div className={c('int-slides')}>
          {b.items.map((f, i) => (
            <div key={f.titulo} className={c('sl')} data-i={i}>
              <Pieza f={f} i={i} />
              <div className={c('sl-img')}><div className={c('sl-marco')}><VideoPieza g={PANTALLAS_PIEZAS[i]} /></div></div>
            </div>
          ))}
        </div>
        <span className={c('elipse-3')} aria-hidden="true" />
      </div>
      <div className={c('int-movil')}>
        <div className={c('g')}>
          <div className={c('int-movil-t')}>{titulo}</div>
          <div className={c('int-movil-img')}><Nivel /></div>
          {b.items.map((f, i) => (
            <div key={f.titulo} className={c('int-movil-f')}>
              <Pieza f={f} i={i} />
              <div className={c('sl-marco')}><VideoPieza g={PANTALLAS_PIEZAS[i]} /></div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/** La tercera forma (Rebill: los disparadores de otras apps que giran hacia Make, y lo que sale de Make): lo que dispara cada plantilla
 *  de cobranza, girando hacia MaKo, y lo que sale (el aviso a tu grupo, el recibo a tu cliente). */
function Giro() {
  return (
    <div className={c('giro')}>
      <div className={c('giro-centro')}>
        <div className={c('giro-lista')}>
          {DISPAROS_COBRANZA.map((d, i) => (
            <span key={d.plantilla} className={`${c('giro-app')} ${c(`pos-${Math.min(i, 4)}`)}`}>
              <span className={c('giro-ico')}><EstrellaMaKo size={18} /></span>
              <span className={c('giro-tx')}><span>{d.disparo}</span><strong>{d.plantilla}</strong></span>
            </span>
          ))}
        </div>
        <span className={c('giro-logo')}><EstrellaMaKo size={64} /><b>MaKo</b></span>
        <span className={c('giro-lin')} aria-hidden="true" />
        <div className={c('giro-sal')}>
          {SALIDAS.map((x) => <span key={x.t} className={c('giro-app')}><span className={c('giro-ico')}><img src="/vsl-assets/logos/whatsapp.png" alt="" width={20} height={20} /></span><span className={c('giro-tx')}><span>{x.t}</span><strong>{x.s}</strong></span></span>)}
        </div>
      </div>
    </div>
  );
}

/** «Integración simple. Resultado profesional.»: el título centrado, después las tres formas con su dibujo. En el teléfono, la lista. */
function Formas({ pasarelas, auto }: { pasarelas: Extract<Bloque, { tipo: 'tarjetas' }>; auto?: Extract<Bloque, { tipo: 'tarjetas' }> }) {
  const formas = [
    ...pasarelas.items.map((t) => ({ titulo: t.titulo, texto: t.texto })),
    ...(auto ? [{ titulo: auto.titulo, texto: auto.bajada ?? '' }] : []),
  ];
  const dibujo = (i: number) => {
    if (i === 0) return (
      <div className={c('d-sdk')}>
        <div className={c('d-izq')}><Cubo texto="Stripe" /><span className={c('d-punto')} aria-hidden="true" /></div>
        <div className={c('d-der')}>
          <img className={c('d-codigo')} src={SDK_STRIPE.codigo.src} alt={SDK_STRIPE.codigo.alt} width={SDK_STRIPE.codigo.w} height={SDK_STRIPE.codigo.h} loading="lazy" decoding="async" />
          <img className={c('d-forma')} src={SDK_STRIPE.forma.src} alt={SDK_STRIPE.forma.alt} width={SDK_STRIPE.forma.w} height={SDK_STRIPE.forma.h} loading="lazy" decoding="async" />
        </div>
      </div>
    );
    if (i === 1) return (
      <div className={c('d-api')}>
        <div className={c('d-api-in')}>
          <img className={c('d-base')} src={SDK_MP.base.src} alt={SDK_MP.base.alt} width={SDK_MP.base.w} height={SDK_MP.base.h} loading="lazy" decoding="async" />
          <div className={c('d-pasos')}>{PASOS_MP.map((t) => <span key={t}>{t}</span>)}</div>
          <img className={c('d-resp')} src={SDK_MP.tarjeta.src} alt={SDK_MP.tarjeta.alt} width={SDK_MP.tarjeta.w} height={SDK_MP.tarjeta.h} loading="lazy" decoding="async" />
        </div>
      </div>
    );
    return <Giro />;
  };
  const movil = (i: number) => (i === 0 ? <img src={SDK_STRIPE.forma.src} alt="" width={SDK_STRIPE.forma.w} height={SDK_STRIPE.forma.h} loading="lazy" decoding="async" />
    : i === 1 ? <img src={SDK_MP.base.src} alt="" width={SDK_MP.base.w} height={SDK_MP.base.h} loading="lazy" decoding="async" /> : <Giro />);
  return (
    <>
      <div className={c('sdk')} id={c('pasarelas')}>
        <div className={c('sdk-pega')}>
          <div className={c('sdk-centro')}><h2 className={`${c('h')} ${c('h-sdk')}`} dangerouslySetInnerHTML={html(pasarelas.titulo)} /></div>
          <div className={c('sdk-full')}>
            <div className={c('g')}>
              <div className={c('sdk-in')}>
                <div className={c('sdk-tw')}>
                  <p className={`${c('h')} ${c('h-sdk-izq')}`} aria-hidden="true" dangerouslySetInnerHTML={html(pasarelas.titulo)} />
                  {pasarelas.bajada ? <p className={c('sdk-p')} dangerouslySetInnerHTML={html(pasarelas.bajada)} /> : null}
                  <Boton />
                </div>
                <div className={c('sdk-fc')}>
                  <div className={c('sdk-feats')}>
                    {formas.map((f, i) => (
                      <div key={f.titulo} className={`${c('feat')}${i === 0 ? ` ${c('on')}` : ''}`} data-i={i}>
                        <h3 className={c('feat-h')} dangerouslySetInnerHTML={html(f.titulo)} />
                        <p className={c('feat-p')} dangerouslySetInnerHTML={html(f.texto)} />
                        <a href={RUTA_CTA} className={c('feat-btn')} tabIndex={-1}><span>Empezar</span><span className={c('btn-i')}><Chevron /></span></a>
                      </div>
                    ))}
                  </div>
                  <div className={c('sdk-anims')}>
                    {formas.map((f, i) => <div key={f.titulo} className={`${c('anim')}${i === 0 ? ` ${c('on')}` : ''}`} data-i={i}>{dibujo(i)}</div>)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className={c('sdk-movil')}>
        <div className={c('g')}>
          <div className={c('sdk-movil-tw')}>
            <p className={`${c('h')} ${c('h-sdk-izq')}`} aria-hidden="true" dangerouslySetInnerHTML={html(pasarelas.titulo)} />
            {pasarelas.bajada ? <p className={c('sdk-p')} dangerouslySetInnerHTML={html(pasarelas.bajada)} /> : null}
            <Boton />
          </div>
          {formas.map((f, i) => (
            <div key={f.titulo} className={c('sdk-movil-f')}>
              <div className={c('feat')}>
                <h3 className={c('feat-h')} dangerouslySetInnerHTML={html(f.titulo)} />
                <p className={c('feat-p')} dangerouslySetInnerHTML={html(f.texto)} />
                <a href={RUTA_CTA} className={`${c('feat-btn')} ${c('feat-btn-movil')}`}><span>Empezar</span><span className={c('btn-i')}><Chevron /></span></a>
              </div>
              <div className={c('sdk-movil-img')}>{movil(i)}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/** «Historias de clientes»: la ceja, el título centrado y la tarjeta del carrusel (una: el caso de Mauricio). */
function Caso() {
  const ultimo = CASO.meses[CASO.meses.length - 1];
  return (
    <section className={c('his')} id={c('caso')} data-tema-fijo="">
      <div className={c('g')}>
        <div className={c('his-tw')}>
          <p className={c('his-ceja')}>Historias de clientes</p>
          <h2 className={`${c('h')} ${c('h-his')}`} dangerouslySetInnerHTML={html(CASO.titulo)} />
          <p className={c('his-p')}>{CASO.sub}</p>
        </div>
      </div>
      <div className={c('his-pista')}>
        <article className={c('his-card')}>
          <div className={c('his-izq')}>
            <div className={c('his-izq-top')}><LogoMaKo tamano={22} /><span className={c('his-tag')}>Mentorías</span></div>
            <div className={c('his-vid')} data-tema-fijo=""><video muted autoPlay loop playsInline preload="metadata" aria-label={`${CASO.quien}, en un escenario`}><source src={CASO.video} type="video/mp4" /></video></div>
          </div>
          <div className={c('his-der')}>
            <div className={c('his-der-top')}>
              <p className={c('his-num')}>{ultimo.monto}</p>
              <p className={c('his-sub')} dangerouslySetInnerHTML={html(CASO.resultado)} />
            </div>
            <div className={c('his-lista-w')}>
              <p className={c('his-lista-t')}>{CASO.quien}, mes a mes</p>
              <ul className={c('his-lista')}>
                {CASO.meses.map((m) => <li key={m.mes}><span className={c('his-pt')} aria-hidden="true" />{m.mes}<strong>{m.monto}</strong></li>)}
              </ul>
            </div>
            <Boton clase={c('btn-az')} />
          </div>
        </article>
      </div>
    </section>
  );
}

/** «Preguntas Frecuentes»: tarjetas de a tres que, con el mouse, crecen y muestran la respuesta en blanco. */
function Preguntas({ b }: { b: Extract<Bloque, { tipo: 'preguntas' }> }) {
  const filas: (typeof b.items)[] = [];
  for (let i = 0; i < b.items.length; i += 3) filas.push(b.items.slice(i, i + 3));
  return (
    <section className={c('faq')} id={c('preguntas')}>
      <div className={c('g')}>
        <div className={c('faq-tw')}>
          <h2 className={`${c('h')} ${c('h-faq')}`} dangerouslySetInnerHTML={html(b.titulo)} />
          <Boton />
        </div>
        <div className={c('faq-filas')}>
          {filas.map((fila, k) => (
            <div key={k} className={c('faq-fila')}>
              {fila.map((q) => (
                <div key={q.p} className={c('faq-card')} tabIndex={0}>
                  <div className={c('faq-q')}><h3>{q.p}</h3></div>
                  <div className={c('faq-a')} data-tema-fijo="">
                    <p className={c('faq-a-t')}>{q.p}</p>
                    <p className={c('faq-a-r')} dangerouslySetInnerHTML={html(q.r)} />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** El cierre azul: el titular del hero, el botón y la frase del cierre de todas las landings. */
function Cierre({ titulo }: { titulo: string }) {
  return (
    <section className={c('cierre')} data-tema-fijo="">
      <div className={c('g')}>
        <div className={c('cierre-tw')}>
          <h2 className={`${c('h')} ${c('h-cierre')}`}>{titulo.replace(/<br\s*\/?>/g, ' ').replace(/<[^>]+>/g, '')}</h2>
          <div className={c('btns')}><Boton /></div>
          <p className={c('cierre-p')}>{TEXTO_CIERRE}</p>
        </div>
      </div>
    </section>
  );
}

function Pie({ slug }: { slug: string }) {
  const otras = otrasFunciones(slug);
  const n = Math.ceil(otras.length / 3);
  const cols = [otras.slice(0, n), otras.slice(n, n * 2), otras.slice(n * 2)];
  return (
    <footer className={c('pie')}>
      <div className={c('g')}>
        <div className={c('pie-in')}>
          <LogoMaKo className={c('pie-logo')} tamano={30} claro />
          {cols.map((col, i) => (
            <div key={i} className={c('pie-col')}>
              <p className={c('pie-h')}>{i === 0 ? 'Funciones' : ' '}</p>
              <ul>{col.map((o) => <li key={o.href}><a href={o.href}>{o.nombre}</a></li>)}</ul>
            </div>
          ))}
          <div className={c('pie-col')}>
            <p className={c('pie-h')}>Legal</p>
            <ul>
              <li><a href="/terminos">Términos del servicio</a></li>
              <li><a href="/privacidad">Privacidad</a></li>
              <li><a href="/aup">Política de uso aceptable</a></li>
            </ul>
          </div>
        </div>
        <p className={c('pie-copy')}>© 2026 MaKo. Todos los derechos reservados.</p>
      </div>
    </footer>
  );
}

export default function DisenoCobranza({ landing }: PropsDiseno) {
  const bloques = landing.bloques;
  const hero = bloques.find((b): b is Extract<Bloque, { tipo: 'hero' }> => b.tipo === 'hero');
  const tarjetas = bloques.filter((b): b is Extract<Bloque, { tipo: 'tarjetas' }> => b.tipo === 'tarjetas');
  const cifras = bloques.find((b): b is Extract<Bloque, { tipo: 'cifras' }> => b.tipo === 'cifras');
  const filas = bloques.find((b): b is Extract<Bloque, { tipo: 'filas' }> => b.tipo === 'filas');
  const links: { href: string; t: string }[] = [];
  if (filas) links.push({ href: `#${c('piezas')}`, t: 'Plataforma' });
  if (tarjetas.length) links.push({ href: `#${c('pasarelas')}`, t: 'Pasarelas' });
  if (bloques.some((b) => b.tipo === 'caso')) links.push({ href: `#${c('caso')}`, t: 'Clientes' });
  if (bloques.some((b) => b.tipo === 'preguntas')) links.push({ href: `#${c('preguntas')}`, t: 'Preguntas' });
  return (
    <div className={c('raiz')}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <Barra links={links} />
      <main>
        {bloques.map((b, i) => {
          switch (b.tipo) {
            case 'hero': return <Hero key={i} b={b} />;
            // «Infraestructura financiera…» y «Conexiones locales» comparten el degradado de fondo (su .sections_wrapper).
            case 'cifras': return (
              <section key={i} className={c('envuelve')} data-tema-fijo="">
                <Cifras b={b} />
                {filas ? <Piezas b={filas} /> : null}
              </section>
            );
            case 'filas': return cifras ? null : <section key={i} className={c('envuelve')} data-tema-fijo=""><Piezas b={b} /></section>;
            case 'tarjetas': return b === tarjetas[0] ? <section key={i} className={c('sdk-sec')}><Formas pasarelas={b} auto={tarjetas[1]} /></section> : null;
            case 'caso': return <Caso key={i} />;
            case 'preguntas': return <Preguntas key={i} b={b} />;
            default: return null;
          }
        })}
        {hero ? <Cierre titulo={hero.titulo} /> : null}
      </main>
      <Pie slug={landing.slug} />
      <script data-visor="" dangerouslySetInnerHTML={{ __html: SCRIPT }} />
    </div>
  );
}

const CSS = `
@font-face{font-family:'DCo Inter';src:url('/vsl-assets/fuentes/inter/inter-latin-var.woff2') format('woff2');font-weight:100 900;font-style:normal;font-display:swap}
.k-raiz{--r:16px;--az:#2F6FED;--azm:#1B3E8F;--noche:#000919;--lbl:#CCDEFF;--lbl2:#E5EEFF;--barra-alto:72px;--f:'DCo Inter',-apple-system,BlinkMacSystemFont,Arial,sans-serif;background:#000919;color:#333;font-family:var(--f);font-size:14px;line-height:20px;-webkit-font-smoothing:antialiased;overflow-x:clip}
@media (min-width:768px){.k-raiz{--r:calc(12px + 4 * ((100vw - 768px) / 223))}}
@media (min-width:992px){.k-raiz{--r:calc(10.49px + 5.51 * ((100vw - 992px) / 448))}}
@media (min-width:1440px){.k-raiz{--r:16px}}
:where(.k-raiz) *,:where(.k-raiz) *::before,:where(.k-raiz) *::after{box-sizing:border-box}
:where(.k-raiz) a{color:inherit;text-decoration:none}
:where(.k-raiz) :where(h1,h2,h3,p,ul,ol){margin:0;padding:0}
:where(.k-raiz) :where(ul,ol){list-style:none}
:where(.k-raiz) :where(img,video){display:block;max-width:100%}
.k-g{padding-left:calc(var(--r) * 4.5);padding-right:calc(var(--r) * 4.5)}
.k-h{font-size:calc(var(--r) * 4);line-height:1.1;font-weight:500;letter-spacing:-.01em;color:#fff}
.k-h em,.k-h1 em{font-style:normal;color:var(--lbl)}

/* Botones: el blanco (is-new) y el transparente (is-third); la flecha se corre 2 px con el mouse. */
.k-btns{display:flex;align-items:center;gap:calc(var(--r) * 1.5);flex-wrap:wrap}
.k-btn{display:inline-flex;align-items:center;justify-content:center;gap:calc(var(--r) * .5);padding:calc(var(--r) * .5) var(--r);border-radius:8px;background:#fff;color:#1F315C;font-size:var(--r);font-weight:500;line-height:1;letter-spacing:-.2px;transition:box-shadow .3s,transform .3s}
.k-btn-t{line-height:1}
.k-btn-i{display:flex;width:calc(var(--r) * 1.5);height:calc(var(--r) * 1.5);transition:transform .2s}
.k-btn:hover{background:#F9FAFB}
.k-btn-3:hover,.k-btn-az:hover{background:transparent}
.k-btn:hover .k-btn-i,.k-feat-btn:hover .k-btn-i{transform:translateX(2px)}
.k-btn-3{background:transparent;color:#fff}
.k-btn-az{background:var(--az);color:#fff;font-size:20px;padding:8px 20px;align-self:flex-start}
.k-btn-az:hover{background:#2A64D6}

/* Barra copiada (escondida por la del sitio). */
.k-barra{position:sticky;top:0;z-index:30;background:#000C24}
.k-barra-in{min-height:72px;padding:0 72px;display:flex;align-items:center;gap:24px}
.k-nav{flex:1;display:flex;justify-content:flex-end;gap:0}
.k-nav a{padding:8px 16px;font-size:18px;color:#fff}
.k-btn-barra{padding:8px 14px;border-radius:8px;border:3px solid transparent;background:linear-gradient(#fff,#fff) padding-box,linear-gradient(135deg,#5B8FF2,#fff,#2F6FED) border-box;color:#1F315C;font-size:18px;line-height:20px}

/* Hero (.section_n-hero): 90svh, como mucho 800; el texto en la mitad izquierda y el checkout que rota en la derecha. */
.k-hero{position:relative;overflow:hidden;height:90svh;max-height:800px;background:linear-gradient(#000919 20.73%,var(--azm) 71.22%,var(--az) 99.99%)}
.k-hero-in{max-width:100rem;margin:0 auto;padding-top:calc(var(--r) * 5);padding-bottom:calc(var(--r) * 7);display:flex;justify-content:space-between;align-items:flex-start;gap:calc(var(--r) * 2);position:relative}
.k-hero-txt{position:relative;z-index:100;width:50%;display:flex;flex-direction:column;align-items:flex-start;gap:calc(var(--r) * 1.5)}
.k-h1{font-size:calc(var(--r) * 4);line-height:1.1;font-weight:500;letter-spacing:-.01em;color:#fff}
.k-hero-p{display:flex;flex-direction:column;gap:25px;font-size:calc(var(--r) * 1.125);line-height:142%;letter-spacing:.02em;font-weight:300;color:#fff}
.k-hero-p strong{font-weight:500}
.k-hero-anim{position:relative;z-index:10;width:50%;max-width:660px}
.k-ck{position:relative}
.k-ck-g:first-child{position:relative}
.k-ck-g{position:absolute;inset:0 0 auto 0;opacity:.3;visibility:hidden;transition:opacity 1s ease-in-out,visibility 1s ease-in-out}
.k-ck-g.k-on{opacity:1;visibility:visible;transition:opacity 1s ease-in-out}
.k-ck-in{position:relative;display:flex;flex-direction:column;align-items:flex-start;width:100%}
.k-ck-pais{position:relative;z-index:2;display:inline-flex;align-items:center;gap:10px;height:32px;margin-bottom:16px;padding:0 14px 0 12px;border:1px solid rgba(255,255,255,.75);border-radius:9px;background:#000;color:#fff;font-size:13px;font-weight:400;line-height:1;letter-spacing:.01em}
.k-ck-pais img{width:18px;height:18px;object-fit:contain;border-radius:4px;background:#fff}
.k-ck-caja{width:100%;border-radius:12px;overflow:hidden;background:#F7F7F5;box-shadow:0 20px 50px -20px rgba(0,0,0,.6)}
.k-ck-caja img{width:100%;height:auto}
.k-ck-nav{display:flex;align-items:center;gap:5px;height:26px;padding:0 12px;background:#EDEEF0;border-bottom:1px solid #DCDDE0}
.k-ck-nav i{width:8px;height:8px;border-radius:50%;background:#FF5F57}
.k-ck-nav i:nth-child(2){background:#FEBC2E}
.k-ck-nav i:nth-child(3){background:#28C840}
.k-ck-nav span{margin:0 auto;padding:2px 40px;border-radius:5px;background:#E0E1E4;color:#555;font-size:10px;line-height:14px}
.k-ck-chico{position:absolute;top:75%;right:-4%;width:80%;height:auto;filter:drop-shadow(0 0 30px rgba(88,97,110,.35));transform:translateY(-50%)}
.k-ck-g .k-ck-chico{opacity:.3;transition:all .8s cubic-bezier(.4,0,.2,1)}
.k-ck-g .k-ck-pais,.k-ck-g .k-ck-caja{opacity:.3;transform:translateY(5px);transition:all .8s cubic-bezier(.4,0,.2,1)}
.k-ck-g.k-on .k-ck-pais{opacity:1;transform:none;transition-delay:.2s}
.k-ck-g.k-on .k-ck-caja{opacity:1;transform:none;transition-delay:.4s}
.k-ck-g.k-on .k-ck-chico{opacity:1;transition-delay:.5s}
.k-elipse{position:absolute;left:0;right:0;bottom:-1px;margin:0 auto;width:80%;aspect-ratio:2496/434;pointer-events:none;border:1px solid rgba(120,170,255,.55);border-bottom:0;border-radius:50% 50% 0 0/100% 100% 0 0;-webkit-mask-image:linear-gradient(90deg,transparent,#000 30%,#000 70%,transparent);mask-image:linear-gradient(90deg,transparent,#000 30%,#000 70%,transparent)}

/* El degradado que comparten las cifras y las piezas (.sections_wrapper). */
.k-envuelve{position:relative;background:linear-gradient(var(--az),var(--azm) 11.52%,#000919 56.1%);overflow:visible}

/* Cifras (.section_plataforma): título de 680 y tres tarjetas de 500 de alto que se dan vuelta con el mouse. */
.k-plat{position:relative;overflow:hidden}
.k-elipse-2{position:absolute;z-index:0;left:0;right:0;top:-12rem;margin:0 auto;width:75%;height:24rem;pointer-events:none;background:radial-gradient(50% 50% at 50% 50%,rgba(140,185,255,.35),rgba(47,111,237,0) 70%)}
.k-plat-in{position:relative;max-width:100rem;margin:0 auto;padding:calc(var(--r) * 9) 0}
.k-h-plat{color:var(--lbl2);max-width:680px;margin:0 auto;text-align:center}
.k-plat-grid{margin-top:calc(var(--r) * 6 * 2 + 0px);display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
.k-pcard{position:relative;z-index:10;overflow:hidden;isolation:isolate;min-height:calc(var(--r) * 31.25);border-radius:calc(var(--r) * .625);background:rgba(0,0,0,.5);transition:all .3s;outline:none}
.k-pcard:hover,.k-pcard:focus-visible{background:#0E0F11}
.k-pcard:nth-child(3):hover,.k-pcard:nth-child(3):focus-visible{background:#000}
.k-pcard-bg{position:absolute;z-index:-1;left:0;right:0;bottom:0;transition:all .3s}
.k-pcard-dib{display:block;width:100%;height:auto;transition:all .3s}
.k-pcard-dib-w{position:relative;transition:all .3s}
.k-pcard-logo{position:absolute;height:auto;transform:translate(-50%,-50%);border-radius:8px}
.k-pcard:nth-child(1):hover .k-pcard-dib-w{mix-blend-mode:hard-light}

.k-pcard:nth-child(2):hover .k-pcard-dib{transform:translateY(30px) scale(1.1)}
.k-pcard-in{width:100%;height:100%;padding:calc(var(--r) * 2.5) calc(var(--r) * 2)}
.k-pcard-wrap{position:relative}
.k-pcard-1{opacity:1;display:block;font-size:22px;line-height:140%;font-weight:300;letter-spacing:.02em;color:#fff;transition:all .2s}
.k-pcard-1 span{font-weight:500}
.k-pcard-2{opacity:0;display:none;position:absolute;inset:0;font-size:18px;line-height:140%;letter-spacing:.02em;color:#fff;transition:all .2s}
@media (min-width:991px){
  .k-pcard:hover .k-pcard-1,.k-pcard:focus-visible .k-pcard-1{display:none;opacity:0}
  .k-pcard:hover .k-pcard-2,.k-pcard:focus-visible .k-pcard-2{display:block;opacity:1}
}

/* Piezas (.section_integra.desktop): 600svh, el título pegado y las piezas pegadas que se turnan con el scroll. */
.k-int{position:relative;min-height:600svh;padding:0 calc(var(--r) * 4.5)}
.k-int-titulo{position:sticky;top:calc(var(--barra-alto) + 16px);z-index:5;height:100svh;display:flex;flex-direction:column;justify-content:center;align-items:center;opacity:0;padding:0 calc(var(--r) * 4.5);transition:all .6s}
.k-int-titulo.k-on{opacity:1;max-width:100rem;margin:0 auto;padding:0;transition-property:none}
.k-int-tw{position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;text-align:center;transition:transform 1s cubic-bezier(.4,0,.2,1)}
.k-int-tw.k-arriba{transform:translateY(-20px)}
.k-int-sub{margin-top:2px;font-size:24px;line-height:120%;color:var(--lbl2)}
.k-int-p{margin-top:18px;max-width:48rem;font-size:calc(var(--r) * 1.25);line-height:142%;font-weight:300;color:#fff;text-align:center}
.k-int-img{transform:translateY(120%);opacity:0;transition:all 1s cubic-bezier(.4,0,.2,1)}
.k-int-img.k-ve{transform:none;opacity:1}
.k-int-img{margin-top:48px}
.k-nivel{display:block;width:18rem;max-width:100%;height:auto}
.k-int-slides{position:sticky;top:calc(var(--barra-alto) + 16px);z-index:10;height:100svh;max-width:100rem;margin:0 auto;opacity:0;overflow:hidden;transition:all .6s;pointer-events:none}
.k-int-slides.k-on{opacity:1;pointer-events:auto}
.k-sl{position:absolute;inset:0;z-index:5;height:90svh;display:flex;justify-content:space-between;align-items:center;gap:2rem;opacity:0}
.k-sl.k-on{opacity:1;transition:all .6s}
.k-sl-txt{width:35%;min-width:35%;max-width:35%;display:flex;gap:16px}
.k-sl-linea{width:1px;min-width:1px;background:linear-gradient(var(--az),#172B85)}
.k-sl-cont{display:flex;flex-direction:column;align-items:flex-start;gap:12px;width:100%}
.k-sl-ico{display:flex;width:32px;height:32px;color:#6E9BFF}
.k-sl-h{font-size:24px;line-height:120%;letter-spacing:.02em;font-weight:400;color:#fff}
.k-sl-p{font-size:20px;line-height:140%;letter-spacing:.02em;font-weight:300;color:#fff}
.k-sl-p strong{font-weight:500}
.k-sl-img{width:65%;max-height:40rem;display:flex;justify-content:flex-start;align-items:center}
.k-sl-marco{width:100%;max-width:858px;border-radius:14px;overflow:hidden;background:#fff;box-shadow:0 40px 80px -40px rgba(0,0,0,.9),0 0 0 1px rgba(255,255,255,.08)}
.k-sl-marco video{width:100%;height:auto;aspect-ratio:16/10;object-fit:cover}
.k-elipse-3{position:absolute;z-index:15;left:0;right:0;bottom:0;height:150px;pointer-events:none;background:radial-gradient(60% 100% at 50% 100%,rgba(47,111,237,.22),rgba(47,111,237,0) 75%)}
.k-int-movil{display:none}

/* Formas (.sdk-section): 600vh sobre #0E0F11, la caja pegada a la barra; primero el título centrado, después el armado entero. */
.k-sdk-sec{background:#0E0F11}
.k-sdk{position:relative;min-height:600vh;background:#0E0F11}
.k-sdk-pega{position:sticky;top:var(--barra-alto);height:100vh;overflow:hidden}
.k-sdk-centro{position:absolute;inset:0;z-index:2;display:flex;justify-content:center;align-items:center;background:#0E0F11;transition:opacity .5s ease-out}
.k-sdk-centro.k-fuera{display:none}
.k-h-sdk{text-align:center;font-size:calc(var(--r) * 4);font-weight:400}
.k-h-sdk em,.k-h-sdk-izq em{color:var(--lbl)}
.k-sdk-full{height:100vh;background:#0E0F11}
.k-sdk-in{max-width:100rem;margin:0 auto;height:100svh;display:flex;flex-direction:column;justify-content:center;padding:3rem 0}
.k-sdk-tw{display:flex;flex-direction:column;align-items:flex-start;gap:calc(var(--r) * 1.5);opacity:0;transform:translateY(30px);transition:all .8s cubic-bezier(.4,0,.2,1)}
.k-sdk.k-show .k-sdk-tw{opacity:1;transform:none;transition-delay:.3s}
.k-h-sdk-izq{font-weight:400}
.k-sdk-p{font-size:calc(var(--r) * 1.25);line-height:120%;font-weight:300;color:#fff;max-width:36rem}
.k-sdk-fc{position:relative;margin-top:2rem}
.k-sdk-feats{position:relative;z-index:100;width:42%;max-width:460px;display:flex;flex-direction:column;opacity:0;transform:translateY(20px);transition:all .8s cubic-bezier(.4,0,.2,1)}
.k-sdk.k-show .k-sdk-feats{opacity:1;transform:none;transition-delay:.5s}
.k-feat{position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:16px;margin-top:1.25rem;padding:18px 18px 36px;border:1.13px solid #2D2D2D;border-radius:10px;background:#0E0F11;color:#D8DADF;opacity:.3;transition:all .5s cubic-bezier(.4,0,.2,1)}
.k-feat.k-on{opacity:1;margin-top:0;padding:36px 18px 50px;background:#000;transform:translateX(10px);box-shadow:0 0 6.8px 1px #1E2025}
.k-feat.k-pasada{visibility:hidden;height:0;opacity:0;padding:0;margin:0;border-width:0;transform:translateX(-20px);overflow:hidden}
.k-feat-h{font-size:20px;line-height:140%;font-weight:400;letter-spacing:.02em;color:#D8DADF}
.k-feat-p{font-size:16px;line-height:150%;font-weight:300;letter-spacing:.02em;color:#D8DADF}
.k-feat-btn{position:absolute;right:28px;bottom:20px;display:inline-flex;align-items:center;gap:.5rem;padding:.25rem .5rem;border-radius:6px;background:#fff;color:#1F315C;font-size:14px;font-weight:500;opacity:0;transition:all .2s}
.k-feat-btn .k-btn-i{width:1.25rem;height:1.25rem}
.k-feat.k-on:hover .k-feat-btn{opacity:1}
.k-sdk-anims{position:absolute;top:0;right:0;bottom:0;width:58%}
.k-anim{position:absolute;inset:0;opacity:0;visibility:hidden;transition:all .5s ease}
.k-anim.k-on{opacity:1;visibility:visible}
.k-d-sdk{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;transform:translateY(-110px)}
.k-d-izq{flex:1;position:relative;display:flex;justify-content:flex-end;align-items:center}
.k-d-cubo{position:relative;z-index:4;width:340px;max-width:100%;height:auto;margin-right:-40px;opacity:0;transform:scale(.8);transition:all .8s cubic-bezier(.4,0,.2,1)}
.k-sdk.k-show .k-d-cubo{opacity:1;transform:none}
.k-d-punto{position:absolute;z-index:5;right:-70px;top:52%;width:110px;height:1px;background:linear-gradient(90deg,#fff,#2F6FED);opacity:0;transition:opacity .8s .3s}
.k-d-punto::before{content:'';position:absolute;left:0;top:-3px;width:7px;height:7px;border-radius:50%;background:#fff}
.k-sdk.k-show .k-d-punto{opacity:.9}
.k-d-der{flex:1;position:relative;z-index:10;max-width:450px;margin-left:30px}
.k-d-forma{position:relative;z-index:3;display:block;width:100%;max-width:400px;height:auto;filter:drop-shadow(0 30px 40px rgba(0,0,0,.6));opacity:0;transform:translateX(30px);transition:all .8s cubic-bezier(.4,0,.2,1)}
.k-sdk.k-show .k-d-forma{opacity:1;transform:none}
.k-d-codigo{position:absolute;z-index:1;right:0;top:12px;width:100%;max-width:350px;height:auto;opacity:0;filter:drop-shadow(0 20px 30px rgba(0,0,0,.6));transition:all .8s cubic-bezier(.4,0,.2,1)}
.k-d-codigo.k-f2{opacity:.3}
.k-d-codigo.k-f3{opacity:1;z-index:1;transform:translateY(-105px)}
.k-d-api{position:absolute;inset:0;display:flex;align-items:flex-start;justify-content:center;padding:60px 40px 0}
.k-d-api-in{position:relative;width:100%;max-width:520px}
.k-d-base{display:block;width:100%;max-width:440px;height:auto;filter:drop-shadow(0 30px 40px rgba(0,0,0,.6));opacity:0;transform:translateY(-50px);transition:opacity .5s}
.k-anim.k-on .k-d-base{opacity:1}
.k-d-pasos{position:absolute;left:62%;top:44%;display:flex;flex-direction:column;align-items:flex-start;gap:10px;z-index:3}
.k-d-pasos span{padding:8px 18px;border-radius:8px;background:#121418;border:1px solid #2D2D2D;color:#E5E7EB;font-size:12px;line-height:1.3;white-space:nowrap;box-shadow:0 6px 16px rgba(0,0,0,.4)}
.k-d-resp{position:absolute;top:25%;left:75%;z-index:2;width:56%;max-width:260px;height:auto;filter:drop-shadow(0 20px 30px rgba(0,0,0,.6));opacity:0;transform:translate(-40%,-60%) translateY(85px)}
.k-giro{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;transform:translateY(-100px)}
.k-giro-centro{position:relative;width:575px;max-width:100%;height:575px;max-height:100%;background:radial-gradient(40% 40% at 50% 50%,rgba(47,111,237,.16),transparent 70%)}
.k-giro-logo{position:absolute;left:50%;top:50%;z-index:3;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;width:110px;height:110px;margin:-55px 0 0 -55px;border-radius:16px;background:#000;border:2px solid #2F6FED;box-shadow:0 0 0 1px rgba(255,255,255,.08),0 0 40px rgba(47,111,237,.55);color:#fff}
.k-giro-logo b{font-size:17px;font-weight:600;letter-spacing:-.01em}
.k-giro-lin{position:absolute;z-index:1;left:52%;top:50%;width:26%;height:1px;background:#2F6FED}
.k-giro-lin::after{content:'';position:absolute;right:0;top:-74px;width:1px;height:148px;background:#2F6FED}
.k-giro-sal{position:absolute;z-index:2;right:-40px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:96px}
.k-giro-sal .k-giro-app{position:relative;transform:none}
.k-giro-lista{position:absolute;z-index:2;left:-60px;top:50%;width:250px;height:330px;transform:translateY(-50%);overflow:hidden}
.k-giro-app{position:absolute;left:0;display:flex;align-items:center;gap:10px;width:230px;padding:8px 10px;border-radius:6px;background:#000;border:1px solid #1F3A78;color:#fff;transition:all .8s cubic-bezier(.4,0,.2,1)}
.k-giro-ico{flex:none;display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:8px;background:#fff}
.k-giro-ico img{width:20px;height:20px}
.k-giro-tx{display:flex;flex-direction:column;min-width:0;line-height:1.3}
.k-giro-tx span{font-size:11px;color:#9CA3AF;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.k-giro-tx strong{font-size:12px;font-weight:500;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.k-pos-0{top:-60px;opacity:0;transform:translateY(-15px)}
.k-pos-1{top:76px;opacity:.4;transform:none}
.k-pos-2{top:140px;opacity:1;transform:none;z-index:5;filter:drop-shadow(0 0 15px rgba(74,144,226,.6))}
.k-pos-3{top:204px;opacity:.4;transform:none}
.k-pos-4{top:300px;opacity:0;transform:translateY(15px)}
.k-pos-2::after{content:'';position:absolute;right:-50px;top:50%;width:50px;height:2px;background:linear-gradient(90deg,#4A90E2,rgba(74,144,226,.8));opacity:.9}
.k-sdk-movil{display:none}

/* Historias (.section_slider): #FAFAFA, la ceja azul, el título de 64 y la tarjeta blanca de 800 con su sombra al pasar. */
.k-his{background:#FAFAFA;overflow:hidden;padding:calc(var(--r) * 5) 0}
.k-his-tw{max-width:838px;margin:0 auto;display:flex;flex-direction:column;align-items:center;text-align:center}
.k-his-ceja{font-size:20px;line-height:1.5;font-weight:500;color:var(--az)}
.k-h-his{margin-top:8px;max-width:768px;color:#001131;font-size:calc(var(--r) * 4)}
.k-his-p{margin-top:16px;max-width:690px;font-size:20px;line-height:140%;letter-spacing:.02em;color:#333}
.k-his-pista{margin-top:calc(var(--r) * 3);padding:3rem 15%}
.k-his-card{max-width:800px;margin:0 auto;display:flex;background:#fff;border-radius:8.8px;overflow:hidden;transition:all .65s;cursor:default}
.k-his-card:hover{box-shadow:0 -1px 17.3px #C4C8CF,0 2px 47.3px rgba(0,0,0,.1)}
.k-his-izq{width:50%;min-width:300px;max-width:380px;display:flex;flex-direction:column}
.k-his-izq-top{display:flex;justify-content:center;align-items:center;gap:12px;padding:29px}
.k-his-tag{display:flex;align-items:center;padding:4px 6px;border-radius:5px;background:#E5EEFF;color:#2D77FF;font-size:12px;font-weight:500;line-height:12px}
.k-his-vid{flex:1;min-height:320px;background:#000919}
.k-his-vid video{width:100%;height:100%;object-fit:cover}
.k-his-der{width:50%;min-width:0;display:flex;flex-direction:column;justify-content:space-between;align-items:flex-start;gap:1rem;padding:29px}
.k-his-der-top{display:flex;flex-direction:column;gap:16px;padding:12px 0}
.k-his-num{font-size:38px;line-height:38px;font-weight:500;color:var(--az)}
.k-his-sub{font-size:16px;line-height:1.45;color:#000}
.k-his-sub strong{font-weight:500}
.k-his-lista-w{display:flex;flex-direction:column;gap:16px;width:100%}
.k-his-lista-t{font-size:17px;font-weight:500;color:#000}
.k-his-lista{display:flex;flex-direction:column;gap:10px}
.k-his-lista li{display:flex;align-items:center;gap:9.68px;font-size:16px;color:#000}
.k-his-lista strong{margin-left:auto;font-weight:500}
.k-his-pt{width:16px;height:16px;border-radius:4px;background:#E5EEFF;box-shadow:inset 0 0 0 4px #fff,inset 0 0 0 16px var(--az)}

/* Preguntas (.section_faqs): negro, tarjetas de 480 con borde #788191; la respuesta es una tarjeta blanca que aparece encima. */
.k-faq{background:#000;padding:6rem 0;overflow:hidden}
.k-faq-tw{max-width:100rem;margin:0 auto;display:flex;flex-direction:column;align-items:flex-start;gap:16px}
.k-h-faq{font-weight:400}
.k-faq-filas{max-width:100rem;margin:2rem auto 0;display:flex;flex-direction:column;gap:1rem}
.k-faq-fila{display:flex;justify-content:flex-start;align-items:stretch;gap:1rem}
.k-faq-card{position:relative;flex:1;min-width:0;min-height:400px;border:1px solid #788191;border-radius:8px;overflow:hidden;transition:flex .4s ease;outline:none}
.k-faq-card:focus-visible{border-color:var(--lbl)}
.k-faq-q{position:absolute;inset:0;z-index:5;display:flex;flex-direction:column;align-items:flex-start;padding:2rem;border-radius:8px;background:#000;opacity:1;transition:opacity .3s ease}
.k-faq-q h3{font-size:31px;line-height:120%;font-weight:300;color:var(--lbl2)}
.k-faq-a{position:absolute;inset:0;z-index:1;display:flex;flex-direction:column;justify-content:space-between;align-items:flex-start;gap:1rem;padding:2rem;border-radius:8px;background:#fff;color:#000919;opacity:0;transition:opacity .3s ease}
.k-faq-a-t{font-size:28px;line-height:120%;color:#000919}
.k-faq-a-r{font-size:20px;line-height:120%;font-weight:500;color:#000919;overflow:auto}
.k-faq-card.k-abierta .k-faq-q{opacity:0}
.k-faq-card.k-abierta .k-faq-a{opacity:1;z-index:6}

/* Cierre (.section_final-cta): el degradado azul, el titular de 61 en 400 y los botones. */
.k-cierre{background:linear-gradient(var(--az),#020C22 86.16%)}
.k-cierre .k-g{padding-top:calc(var(--r) * 7);padding-bottom:calc(var(--r) * 7)}
.k-cierre-tw{max-width:100rem;margin:0 auto;display:flex;flex-direction:column;align-items:flex-start;gap:16px}
.k-h-cierre{max-width:600px;font-weight:400}
.k-cierre-p{max-width:520px;font-size:18px;line-height:142%;font-weight:300;letter-spacing:.02em;color:#fff}

/* Pie (.footer_component; el del sitio lo tapa en producción). */
.k-pie{background:#000C24;padding:80px 0 56px}
.k-pie-in{max-width:100rem;margin:0 auto;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:2.2rem}
.k-pie-h{font-size:16px;font-weight:500;color:#fff;margin-bottom:8px}
.k-pie-col a{display:block;padding:.5rem 0;font-size:16px;color:#E0E0E0}
.k-pie-col a:hover{color:#fff}
.k-pie-copy{max-width:100rem;margin:64px auto 0;text-align:right;font-size:14px;color:#E0E0E0}

/* Hasta 991: el hero en columna, las cifras con su explicación a la vista, y las secciones pegadas pasan a sus listas quietas. */
@media (max-width:991px){
  .k-g{padding-left:2rem;padding-right:2rem}
  .k-h,.k-h1{font-size:3.25rem}
  .k-hero{height:auto;max-height:none}
  .k-hero-in{flex-direction:column;padding-top:6rem;padding-bottom:6rem}
  .k-hero-txt{width:100%}
  .k-hero-anim{width:80%;margin:0 auto}
  .k-plat-in{padding:8rem 0}
  .k-h-plat{max-width:520px}
  .k-pcard{min-height:20rem;max-height:28rem}
  .k-pcard-in{padding:1.25rem}
  .k-pcard-wrap{display:flex;flex-direction:column;gap:1rem}
  .k-pcard-1{font-size:18px}
  .k-pcard-2{opacity:1;display:block;position:relative;font-size:.875rem}
  .k-int,.k-sdk{display:none}
  .k-int-movil,.k-sdk-movil{display:block}
  .k-int-movil{padding:3rem 0 4rem}
  .k-int-movil-t{display:flex;flex-direction:column;align-items:center;text-align:center}
  .k-int-movil-img{margin:32px auto 0;display:flex;justify-content:center}
  .k-int-movil-img .k-nivel{width:14rem}
  .k-int-movil-f{margin-top:56px;display:flex;flex-direction:column;gap:24px}
  .k-int-movil-f .k-sl-txt{width:100%;min-width:100%;max-width:100%}
  .k-sdk-movil{background:#000;padding:4rem 0}
  .k-sdk-movil-tw{display:flex;flex-direction:column;align-items:flex-start;gap:16px}
  .k-sdk-movil .k-sdk-p{font-size:16px;line-height:1.4}
  .k-sdk-movil-f{margin-top:32px;display:flex;flex-direction:column;gap:24px}
  .k-sdk-movil-f .k-feat{opacity:1;margin:0;background:#000;padding:24px 18px 32px;transform:none}
  .k-sdk-movil-img{position:relative;display:flex;justify-content:center}
  .k-sdk-movil-img img{border-radius:14px;width:100%;height:auto}
  .k-sdk-movil-img .k-giro{position:relative;inset:auto;transform:none;width:100%;height:330px}
  .k-sdk-movil-img .k-giro-centro{width:100%;height:330px}
  .k-sdk-movil-img .k-giro-lista{left:-6px;width:190px}
  .k-sdk-movil-img .k-giro-app{width:180px}
  .k-sdk-movil-img .k-giro-sal{right:-6px;gap:110px}
  .k-sdk-movil-img .k-giro-sal .k-giro-app{width:150px}
  .k-sdk-movil-img .k-giro-logo{width:84px;height:84px;margin:-42px 0 0 -42px}
  .k-sdk-movil-img .k-giro-lin{left:50%;width:30%}
  .k-feat-btn-movil{position:static;opacity:1;align-self:flex-start;margin-top:4px}
  .k-faq-fila{flex-direction:column}
  .k-faq-card{flex:none;min-height:0;cursor:pointer}
  .k-faq-q,.k-faq-a{position:relative;inset:auto}
  .k-faq-a{display:none}
  .k-faq-card.k-abierta .k-faq-q{display:none}
  .k-faq-card.k-abierta .k-faq-a{display:flex}
  .k-faq-card:active{transform:scale(.98)}
  .k-his-pista{padding:3rem 2rem}
  .k-pie-in{grid-template-columns:1fr 1fr 1fr}
}
@media (max-width:767px){
  .k-g{padding-left:1rem;padding-right:1rem}
  .k-h,.k-h1{font-size:2.75rem}
  .k-h-sdk{font-size:3rem}
  .k-hero-in{padding-top:4rem;padding-bottom:3rem}
  .k-hero-anim{width:100%;min-height:0}
  .k-btns-hero{flex-direction:column;align-items:stretch;gap:12px}
  .k-btns-hero .k-btn{width:100%;padding:12px 16px}
  .k-ck-chico{right:-2%}
  .k-elipse{width:85%}
  .k-plat-in{padding:6rem 0}
  .k-plat-grid{grid-template-columns:1fr 1fr;margin-top:6rem}
  .k-pcard{min-height:25rem}
  .k-sl-h{font-size:24px}
  .k-faq-q,.k-faq-a{padding:1.5rem}
  .k-faq-q h3{font-size:22px}
  .k-faq-a-t{font-size:18px}
  .k-faq-a-r{font-size:16px}
  .k-his-pista{padding:2rem 1rem}
  .k-his-card{flex-direction:column}
  .k-his-izq{width:100%;min-width:0;max-width:none}
  .k-his-izq-top{padding:16px}
  .k-his-der{width:100%;padding:16px 16px 24px;gap:.75rem}
  .k-his-num{font-size:32px}
  .k-his-vid{aspect-ratio:16/10;min-height:0}
  .k-h-his{font-size:2.75rem}
  .k-cierre .k-g{padding-top:4rem;padding-bottom:4rem}
  .k-pie-in{grid-template-columns:1fr}
  .k-pie-copy{text-align:left}
}
@media (max-width:479px){
  .k-plat-grid{grid-template-columns:1fr}
  .k-hero-p{font-size:1rem}
}
@media (prefers-reduced-motion:reduce){
  .k-raiz *,.k-raiz *::before,.k-raiz *::after{animation:none !important;transition:none !important}
  .k-int,.k-sdk{display:none}
  .k-int-movil,.k-sdk-movil{display:block}
}
`.replace(/\.k-/g, `.${P}-`).replace(/\bk-(on|arriba|ve|fuera|show|pasada|f2|f3|abierta)\b/g, `${P}-$1`);

// =============================================================================
// El script (data-visor): los cuatro movimientos de Rebill, con sus números (sus scripts, leídos de su HTML el 14/11/2026).
// Idempotente y limpia su estado al arrancar (pulir.mjs guarda el DOM después de correrlo). Con «menos movimiento», sólo los videos
// quedan en su primer cuadro: las secciones pegadas ya son listas quietas (CSS).
// =============================================================================
const SCRIPT = `(function(){
var P='${P}';
function trasHidratar(fn){if(!document.querySelector('script[src*="/_next/"]'))return fn();var t0=Date.now();(function mira(){var h=Object.keys(document.body).some(function(k){return k.indexOf('__reactFiber')===0||k.indexOf('__reactProps')===0;});if(h||Date.now()-t0>6000)fn();else setTimeout(mira,60);})();}
function iniciar(){
  var R=document.querySelector('.'+P+'-raiz');if(!R||R.__listo)return;R.__listo=1;
  var ON=P+'-on',q=function(s,e){return [].slice.call((e||R).querySelectorAll('.'+P+'-'+s));};
  var quieto=!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);
  var movil=function(){return innerWidth<=991;};
  // La altura de la barra del sitio (las capas pegadas van debajo, como las de Rebill debajo de la suya).
  var barra=document.querySelector('.s-solo-barra');if(barra)R.style.setProperty('--barra-alto',Math.round(barra.getBoundingClientRect().height)+'px');
  // Los videos: corren sólo los que se ven (y, en las piezas, sólo el de la pieza activa).
  var vids=q('raiz video').concat([].slice.call(R.querySelectorAll('video')));
  vids=vids.filter(function(v,i){return vids.indexOf(v)===i;});
  vids.forEach(function(v){v.muted=true;if(quieto){v.removeAttribute('autoplay');v.pause();}});
  var play=function(v){if(quieto||!v)return;v.preload='auto';var p=v.play();if(p&&p.catch)p.catch(function(){});};
  if(!quieto&&'IntersectionObserver' in window){var ob=new IntersectionObserver(function(es){es.forEach(function(e){var v=e.target;var sl=v.closest('.'+P+'-sl');if(e.isIntersecting&&(!sl||sl.classList.contains(ON)))play(v);else if(!e.isIntersecting&&!v.paused)v.pause();});},{threshold:.25});vids.forEach(function(v){ob.observe(v);});}

  // 1. El hero: un grupo cada 4 s (su setInterval de 4000).
  var gs=q('ck-g');gs.forEach(function(g,i){g.classList.toggle(ON,i===0);});
  if(!quieto&&gs.length>1){var gi=0;setInterval(function(){gs[gi].classList.remove(ON);gi=(gi+1)%gs.length;gs[gi].classList.add(ON);},4000);}

  // 2. Las piezas: el progreso dentro de la sección (600svh) decide qué capa y qué pieza (sus 0,16 / 0,22 / 0,4).
  var sec=R.querySelector('.'+P+'-int'),tit=R.querySelector('.'+P+'-int-titulo'),tw=R.querySelector('.'+P+'-int-tw'),img=R.querySelector('.'+P+'-int-img'),cap=R.querySelector('.'+P+'-int-slides'),sls=q('sl');
  var piezaVista=-1;
  function verPieza(i){if(i===piezaVista)return;piezaVista=i;sls.forEach(function(s,k){var on=k===i;s.classList.toggle(ON,on);var v=s.querySelector('video');if(v){if(on){try{v.currentTime=0;}catch(e){}play(v);}else v.pause();}});}
  function piezas(){
    if(!sec||movil()||quieto)return;
    var r=sec.getBoundingClientRect(),p=Math.max(0,Math.min(1,-r.top/(sec.offsetHeight-innerHeight)));
    if(p<=.16){tit.classList.add(ON);cap.classList.remove(ON);verPieza(-1);var m=p/.16>.4;img.classList.toggle(P+'-ve',m);tw.classList.toggle(P+'-arriba',m);}
    else if(p<=.22){tit.classList.remove(ON);}
    else{tit.classList.remove(ON);cap.classList.add(ON);verPieza(Math.max(0,Math.min(sls.length-1,Math.floor((p-.22)/.78*sls.length))));}
  }
  if(tit){tit.classList.add(ON);cap.classList.remove(ON);img.classList.remove(P+'-ve');tw.classList.remove(P+'-arriba');sls.forEach(function(s){s.classList.remove(ON);});}

  // 3. Las formas: fase 1 (el título centrado) hasta 0,3 de pantalla, fase 2 desde 0,4; desde 2,5 pantallas, una forma cada 1,5.
  var sdk=R.querySelector('.'+P+'-sdk'),cen=R.querySelector('.'+P+'-sdk-centro'),fs=q('feat',sdk||R),an=q('anim',sdk||R),cod=R.querySelector('.'+P+'-d-codigo'),resp=R.querySelector('.'+P+'-d-resp');
  var forma=0,ultimo=0;
  function verForma(i){forma=i;fs.forEach(function(f,k){f.classList.toggle(ON,k===i);f.classList.toggle(P+'-pasada',k<i);});an.forEach(function(a,k){a.classList.toggle(ON,k===i);});}
  function formas(){
    if(!sdk||movil()||quieto)return;
    var y=scrollY,top=sdk.getBoundingClientRect().top+y,rel=Math.max(0,y-top),h=innerHeight,baja=y>ultimo;ultimo=y;
    if(rel<h*.3){cen.classList.remove(P+'-fuera');sdk.classList.remove(P+'-show');if(forma)verForma(0);}
    else if(rel<h*.4){if(baja){cen.classList.add(P+'-fuera');sdk.classList.add(P+'-show');}else{cen.classList.remove(P+'-fuera');sdk.classList.remove(P+'-show');if(forma)verForma(0);}}
    else{cen.classList.add(P+'-fuera');sdk.classList.add(P+'-show');var i=0;if(rel>=h*2.5){var d=rel-h*2.5,alto=h*1.5;i=Math.min(Math.floor(d/alto)+1,fs.length-1);if(!baja&&d%alto<alto*.1)i=Math.max(0,i-1);}if(i!==forma)verForma(i);}
    // el link sube (sus fases de 0,8 / 1 / 1,5 pantallas) y, en la segunda, la tarjeta de respuesta sube con el scroll
    if(cod){cod.classList.toggle(P+'-f2',rel>=h*.8&&rel<h*1.5);cod.classList.toggle(P+'-f3',rel>=h*1.5);}
    if(resp&&forma===1){var k=Math.min(1,Math.max(0,rel-h)/h);k=1-Math.pow(1-k,3);resp.style.transform='translate(-40%,-60%) translateY('+(85+(-140-85)*k)+'px)';resp.style.opacity=k>.05?Math.min(1,(k-.05)*1.2):0;}
  }
  if(sdk){cen.classList.remove(P+'-fuera');sdk.classList.remove(P+'-show');verForma(0);if(cod)cod.classList.remove(P+'-f2',P+'-f3');if(resp){resp.style.transform='';resp.style.opacity='';}}
  // la lista que gira hacia el centro cada 1,5 s (su rotate: cada una baja un lugar), sólo mientras se ve la tercera forma
  var giros=q('giro');
  giros.forEach(function(gi){var apps=[].slice.call(gi.querySelectorAll('.'+P+'-giro-lista .'+P+'-giro-app'));var pos=apps.map(function(_,i){return i%5;});var pon=function(){apps.forEach(function(a,i){for(var k=0;k<5;k++)a.classList.remove(P+'-pos-'+k);a.classList.add(P+'-pos-'+pos[i]);});};pon();
    if(quieto)return;setInterval(function(){var vivo=movil()?gi.getBoundingClientRect().top<innerHeight&&gi.getBoundingClientRect().bottom>0:forma===2&&sdk&&sdk.classList.contains(P+'-show');if(!vivo)return;pos=pos.map(function(x){return x===0?4:x-1;});pon();},1500);});

  var tic=false;addEventListener('scroll',function(){if(tic)return;tic=true;requestAnimationFrame(function(){tic=false;piezas();formas();});},{passive:true});
  addEventListener('resize',function(){piezas();formas();},{passive:true});
  piezas();formas();

  // 4. Las preguntas: con el mouse, la tarjeta crece (1,35; las otras de su fila 0,825) y la pregunta se va (0,3 s) para mostrar la
  // respuesta; en el teléfono se tocan, una abierta a la vez.
  q('faq-card').forEach(function(card){
    card.classList.remove(P+'-abierta');card.style.flex='';
    var fila=card.parentNode,todas=function(){return [].slice.call(fila.children);};
    var abrir=function(){card.classList.add(P+'-abierta');if(!movil()){card.style.flex='1.35';todas().forEach(function(o){if(o!==card)o.style.flex='0.825';});}};
    var cerrar=function(){card.classList.remove(P+'-abierta');if(!movil())todas().forEach(function(o){o.style.flex='';});};
    card.addEventListener('mouseenter',function(){if(!movil())abrir();});
    card.addEventListener('mouseleave',function(){if(!movil())cerrar();});
    card.addEventListener('focus',function(){if(!movil())abrir();});
    card.addEventListener('blur',function(){if(!movil())cerrar();});
    card.addEventListener('click',function(){if(!movil())return;var ya=card.classList.contains(P+'-abierta');q('faq-card').forEach(function(o){o.classList.remove(P+'-abierta');});if(!ya)card.classList.add(P+'-abierta');});
  });
}
function arrancar(){trasHidratar(iniciar);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',arrancar);else arrancar();
})();`;
