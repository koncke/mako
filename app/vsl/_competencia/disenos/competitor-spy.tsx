// =============================================================================
// /vsl/competitor-spy — Competitor Spy con el DISEÑO de la portada de Foreplay (https://www.foreplay.co/, leída el 11/11/2026)
// =============================================================================
// Copiado de la referencia, con los valores leídos del navegador a 1440 y 390 px (docs/diseno/landings-competencia/competitor-spy.md):
// la página negra #020308 con los blancos en transparencia, la barra pegajosa de 72 px con desenfoque y su botón blanco de
// 10 px de radio, el hero centrado sobre la grilla de puntos enmascarada (el titular de 60 px con su degradado radial
// recortado al texto, el párrafo de 18 px, el botón, la sobrelínea espaciada y la fila de 52 px donde va su tira de logos),
// la captura de la app de 1264 px que se funde en negro y queda tapada por el bloque blanco, el bloque blanco de 36 px de
// radio con «antes / después» (las dos tarjetas de 470 px, la clara con su montón de capturas y chats y la oscura con su
// órbita), las cabezas de sección (sobrelínea al 36 %, h2 de 44 px, párrafo de 18 px), las filas de 640 px (la tarjeta de
// 419 px con su anillo, la sobrelínea, el h3 de 36 px, el botón oscuro con filete, las tres pestañas y el objeto en 3D
// abajo; la figura al 6 % de blanco con su halo de color y la ventana de la app), la banda de la extensión (32 px de radio,
// el ícono cortado al costado al 50 %), el cierre y el pie (la fila de productos, los filetes al 16 %, las columnas de
// links de 214 px con su sobrelínea). La letra es la de la referencia: Inter (texto) e Inter Display (títulos), con la
// fuente variable de eje óptico que ya está en public/vsl-assets/fuentes/inter/ (opsz 14 para el texto y 32 para los títulos).
// Las pestañas de cada fila funcionan sin JavaScript (radios ocultos con :checked); el menú de funciones abre con :hover y
// :focus-within, y el de 390 px con <details>.
//
// De MaKo: el logo, el azul #2F6FED y el dorado #F2B01E en los lugares donde Foreplay pone los colores de sus productos (el
// halo de cada figura, el brillo de la barra lateral de la captura, los objetos en 3D, la órbita), el botón de la llamada
// donde la referencia pone «Start free trial» / «Get Free Trial» / «Install Free», los textos de
// app/vsl/_competencia/competitor-spy.ts y los links del pie. Sus botones blancos y oscuros son neutros: quedan así.
// Donde Foreplay pone la captura de su app (el hero, la figura de cada fila, la foto de la laptop del cierre) va el visual de
// Competitor Spy (la ficha de un competidor y sus anuncios guardados, app/vsl/_competencia/visuales-propios/competitor-spy.tsx),
// con el mismo encuadre: la app con su barra lateral oscura y su panel claro, la ventana dentro de la figura, la pantalla
// de la laptop. Competitor Spy no tiene gráficos en app/vsl/_detalle/feature-visuals.ts.
// Lo que se sacó de la referencia, y por qué:
//   · Su tira de logos de clientes, «Powering +10,000…», sus reseñas, el contador de anuncios del pie, el «Click Me!» de su
//     llamada de ventas, «Ask AI about Foreplay.co» y sus redes: son suyos o de uso. En el lugar de los logos van la etiqueta
//     y los dos renglones del hero.
//   · El «Learn More» de cada fila y «View Pricing» del cierre: no hay a dónde llevarlos (sin precios en /vsl).
//   · Sus filas «Discovery» (buscador de anuncios del mercado), «Collaboration», «Sharing & presenting» y la grilla «Miles beyond
//     the status quo» (expertos, app y API de su biblioteca): Competitor Spy no tiene nada de eso.
//   · Los objetos 3D de cada fila (su carpeta, su lupa, su lápiz) son suyos: en su lugar va, con el mismo tratamiento (una losa
//     de vidrio con un ícono que flota encima), el ícono de MaKo de la primera pestaña de la fila.
//   · En la tarjeta «antes», sus píldoras de Slack y sus íconos de Drive y compañía caen con física (su LogoRain de Matter.js): aquí
//     caen las cuatro cosas del texto (el chat de grupo, el link que no abre, la captura suelta, «¿desde cuándo lo corre?») y logos
//     de apps que MaKo reemplaza (ver LLUVIA y SCRIPT_LLUVIA). En la órbita del «después», sus cuatro etapas (las secciones de su
//     página): van las de la nuestra, «Investigación», «Inspiración», «Producción» y «Análisis» (ver Orbita).
//   · El pie de 5 productos lleva 5 funciones de MaKo que trabajan con lo que guarda Spy (Image, Web Generator, Offer,
//     Copywriting, Ads Analyst), y sus columnas, el resto de las funciones.
// Lo que quedó distinto: los textos de cada pestaña (en Foreplay cambian la imagen de la figura) van como leyenda abajo de la
// figura, donde la fila «Swipe File» pone su «Supported ad libraries»; la banda de la extensión, que Foreplay esconde en el
// teléfono, aquí se ve (lleva los tres pasos), y a la cabeza de «antes / después» le falta su párrafo (el bloque no tiene bajada).
//
// 14/11/2026, noche (Martín: «quiero que la copia salga muy fiel a todas las animaciones»): mirado en Foreplay con el navegador, cuadro
// a cuadro y con sus estilos calculados (notas: foreplay-relevo/visto-1411/). El hero pegado que se achica y la captura que le pasa
// por encima; la lluvia con su configuración; la órbita que da cuartos de vuelta; una grabación de la app real por pestaña, grande y
// cortada por el borde de la figura; el objeto 3D que flota y al que lo recorre la luz. Sus hovers (los links de .52 a .84 en ,5 s,
// el botón blanco a #DDDEE5 o al 84 %, el oscuro al 6 % de blanco, las pestañas de .44 a blanco en ,4 s) ya eran estos.
// =============================================================================

import type { ReactNode } from 'react';
import type { PropsDiseno } from '.';
import type { Bloque, VisualHero } from '../tipos';
import { RUTA_CTA, EstrellaMaKo, LogoMaKo, TEXTO_CTA, html, otrasFunciones, TEXTO_CIERRE } from '../marca';
import { LANDINGS_COMPETENCIA } from '../registro';
import { VisualDeLanding } from '../Visuales';

const P = 'd-competitor-spy';
const SLUG = 'competitor-spy';

type De<T extends Bloque['tipo']> = Extract<Bloque, { tipo: T }>;

function Icono({ d, size = 20, grosor = 1.5 }: { d?: readonly string[]; size?: number; grosor?: number }) {
  if (!d?.length) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={grosor} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d.map((p, i) => <path key={i} d={p} />)}
    </svg>
  );
}

/** El chevrón de los botones de la referencia (20 px dentro de su caja de 24). */
function Chev() {
  return (
    <span className={`${P}-btn-ic`} aria-hidden="true">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 6.5L12 10l-3.5 3.5" /></svg>
    </span>
  );
}

/** El botón de la llamada, con las tres caras de la referencia: blanco, oscuro con filete, y el de la barra. */
function Cta({ cara = 'blanco', clase = '' }: { cara?: 'blanco' | 'oscuro' | 'barra'; clase?: string }) {
  return (
    <a href={RUTA_CTA} className={`${P}-btn ${P}-btn-${cara} ${clase}`}>
      <span className={`${P}-btn-t`}>{TEXTO_CTA}</span>
      <Chev />
    </a>
  );
}

const ICONO_CHECK = ['M5 12l5 5l10 -10'];

// ── La barra ─────────────────────────────────────────────────────────────────
function Barra() {
  const otras = otrasFunciones(SLUG);
  return (
    <header className={`${P}-nav`}>
      <div className={`${P}-nav-in`}>
        <div className={`${P}-nav-stack`}>
          <LogoMaKo className={`${P}-brand`} tamano={30} claro />
          <nav className={`${P}-nav-menu`} aria-label="Funciones de MaKo">
            <div className={`${P}-dd`}>
              <span tabIndex={0} className={`${P}-navlink ${P}-dd-btn`}>
                Funciones
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6.5 8.5L10 12l3.5-3.5" /></svg>
              </span>
              <div className={`${P}-dd-panel`}>
                <p className={`${P}-overline`}>Funciones de MaKo</p>
                <div className={`${P}-dd-grid`}>
                  {otras.map((o) => <a key={o.href} href={o.href}>{o.nombre}</a>)}
                </div>
              </div>
            </div>
          </nav>
          <div className={`${P}-nav-cta`}>
            <a href="/login" className={`${P}-navlink ${P}-signin`}>Iniciar sesión</a>
            <Cta cara="barra" />
          </div>
          <details className={`${P}-burger`}>
            <summary aria-label="Menú">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" aria-hidden="true"><path d="M4 7h12" /><path d="M4 13h12" /></svg>
            </summary>
            <div className={`${P}-burger-panel`}>
              {otras.map((o) => <a key={o.href} href={o.href}>{o.nombre}</a>)}
              <a href="/login">Iniciar sesión</a>
              <Cta />
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}

// ── El hero ──────────────────────────────────────────────────────────────────
const ICONOS_PUNTOS = [
  ['M18 7v14l-6 -4l-6 4v-14a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4z'],
  ['M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2', 'M9 12l2 2l4 -4'],
];

/** Donde la referencia pone el video de su app: el visual de la landing, sin barra lateral ni cabecera dibujadas
 *  (12/11/2026: el marco de app inventado se sacó). */
function Captura({ visual }: { visual: VisualHero }) {
  return (
    <div className={`${P}-captura`}>
      <div className={`${P}-pantalla`}><VisualDeLanding visual={visual} /></div>
    </div>
  );
}

function Hero({ b }: { b: De<'hero'> }) {
  return (
    <section className={`${P}-hero`}>
      <div className={`${P}-dots`} aria-hidden="true" />
      <div className={`${P}-wrap`}>
        <div className={`${P}-hero-in`}>
          {/* Lo que queda pegado arriba y se va con el scroll (su «home-hero-sticky»); la captura pasa por encima. */}
          <div className={`${P}-hero-pega`}>
          <div className={`${P}-hero-top`}>
            <div className={`${P}-hero-content`}>
              <h1 className={`${P}-h1`} dangerouslySetInnerHTML={html(b.titulo)} />
              <p className={`${P}-hero-sub`} dangerouslySetInnerHTML={html(b.bajada)} />
            </div>
            <div className={`${P}-hero-cta`}><Cta /></div>
          </div>
          <div className={`${P}-hero-bottom`}>
            <p className={`${P}-overline ${P}-hero-over`} dangerouslySetInnerHTML={html(b.etiqueta)} />
            {b.puntos?.length ? (
              <ul className={`${P}-puntos`}>
                {b.puntos.map((p, i) => (
                  <li key={p} className={`${P}-punto`}>
                    <Icono d={ICONOS_PUNTOS[i % ICONOS_PUNTOS.length]} size={20} grosor={1.6} />
                    <span dangerouslySetInnerHTML={html(p)} />
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          </div>
          <Captura visual={b.visual} />
        </div>
      </div>
    </section>
  );
}

// ── Antes / después (el bloque blanco) ───────────────────────────────────────
const ICO_CHAT = ['M3 20l1.3 -3.9c-2.3 -3.4 -1.4 -7.8 2.1 -10.3c3.5 -2.4 8.2 -2.2 11.4 .5c3.1 2.7 3.6 7 1.1 10.2c-2.5 3.2 -7.2 4.2 -11 2.3l-4.9 1.2'];
const ICO_IMG = ['M15 8h.01', 'M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12z', 'M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5', 'M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3'];
const ICO_LINK_ROTO = ['M9 15l3 -3m2 -2l1 -1', 'M11 6l.463 -.536a5 5 0 0 1 7.071 7.072l-.534 .464', 'M3 3l18 18', 'M13 18l-.397 .534a5.068 5.068 0 0 1 -7.127 0a4.972 4.972 0 0 1 0 -7.071l.524 -.463'];
const ICO_CARPETA = ['M5 4h4l3 3h7a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-11a2 2 0 0 1 2 -2'];

/**
 * LA LLUVIA DE LA TARJETA «ANTES» (14/11/2026, Martín: «el antes de Foreplay son iconos cayendo»). La de Foreplay es su LogoRain con
 * Matter.js (leída del navegador el 14/11, foreplay-relevo/visto-1411/scripts-pc.txt): al entrar la tarjeta en pantalla caen uno por uno,
 * cada 300 ms desde 60 px por encima, con gravedad 0,7 (≈700 px/s²), rebote 0,1, roce 0,3, un giro al azar de ±30° y ±0,6 rad/s, y se
 * apilan; 16 en la computadora, 12 hasta 768 px y 8 hasta 480 px, a 1,2× si la caja mide 400 px o más. Sus píldoras de Slack y sus
 * íconos de Drive y compañía son, en MaKo, las cuatro cosas del texto (el chat de grupo, el link que ya no abre, la captura suelta y el
 * «¿desde cuándo?») y los logos de apps que MaKo reemplaza (app/vsl/_sitio/reemplaza.ts), en su recuadro blanco como allá.
 * El orden importa: los primeros 8 son los del teléfono (mitad píldoras, mitad logos).
 * Sin JavaScript (o antes de que entre en pantalla) se ven ya apilados donde dice `x`/`y`/`r`, como su imagen fija de respaldo.
 */
type Cae = { x: number; y: number; r: number } & (
  | { tipo: 'pildora'; t: string; ic: readonly string[]; num?: string }
  | { tipo: 'logo'; archivo: string; nombre: string }
  | { tipo: 'carpeta'; t: string });
const ICO_HASH = ['M5 9h14', 'M5 15h14', 'M11 4l-4 16', 'M17 4l-4 16'];
const LLUVIA: readonly Cae[] = [
  { tipo: 'pildora', t: '#anuncios-competencia', ic: ICO_HASH, num: '12', x: 2, y: 88, r: -8 },
  { tipo: 'pildora', t: 'El link ya no abre', ic: ICO_LINK_ROTO, x: 44, y: 93, r: 6 },
  { tipo: 'logo', archivo: 'notion', nombre: 'Notion', x: 8, y: 70, r: -12 },
  { tipo: 'pildora', t: 'Captura (3).png', ic: ICO_IMG, x: 52, y: 80, r: -14 },
  { tipo: 'logo', archivo: 'canva', nombre: 'Canva', x: 30, y: 72, r: 10 },
  { tipo: 'pildora', t: '¿Desde cuándo lo corre?', ic: ICO_CHAT, x: 4, y: 61, r: 5 },
  { tipo: 'logo', archivo: 'capcut', nombre: 'CapCut', x: 84, y: 82, r: 14 },
  { tipo: 'logo', archivo: 'minea', nombre: 'Minea', x: 66, y: 66, r: -8 },
  { tipo: 'logo', archivo: 'bigspy', nombre: 'BigSpy', x: 46, y: 64, r: 18 },
  { tipo: 'logo', archivo: 'hubspot', nombre: 'HubSpot', x: 20, y: 50, r: -20 },
  { tipo: 'logo', archivo: 'lookerstudio', nombre: 'Looker Studio', x: 78, y: 62, r: 7 },
  { tipo: 'logo', archivo: 'metricool', nombre: 'Metricool', x: 58, y: 52, r: -6 },
  { tipo: 'logo', archivo: 'gohighlevel', nombre: 'GoHighLevel', x: 36, y: 52, r: 12 },
  { tipo: 'logo', archivo: 'manychat', nombre: 'ManyChat', x: 88, y: 50, r: -16 },
  { tipo: 'logo', archivo: 'zap', nombre: 'Zapier', x: 6, y: 44, r: 9 },
  { tipo: 'carpeta', t: 'Anuncios (final)', x: 68, y: 38, r: -10 },
];

function Lluvia() {
  return (
    // `data-tema-fijo`: blancas en los dos modos del sol y la luna, como sus logos (app/vsl/_sitio/reemplaza.ts: «se dibujan sobre un
    // recuadro blanco»); si no, en el oscuro las píldoras se oscurecían y los recuadros de los logos quedaban blancos, mezclados.
    <div className={`${P}-lluvia`} aria-hidden="true" data-tema-fijo="">
      {LLUVIA.map((c, i) => (
        <span key={i} className={`${P}-cae ${P}-cae-${c.tipo}`} style={{ left: `${c.x}%`, top: `${c.y}%`, transform: `rotate(${c.r}deg)` }}>
          {c.tipo === 'pildora' ? (<><Icono d={c.ic} size={16} grosor={1.7} /><span>{c.t}</span>{c.num ? <b>{c.num}</b> : null}</>) : null}
          {/* eslint-disable-next-line @next/next/no-img-element -- un logo de 128 px de public/, sin optimizar */}
          {c.tipo === 'logo' ? <img src={`/vsl-assets/logos/apps/${c.archivo}.png`} alt="" width={128} height={128} loading="lazy" decoding="async" /> : null}
          {c.tipo === 'carpeta' ? (<><Icono d={ICO_CARPETA} size={30} grosor={1.6} /><span>{c.t}</span></>) : null}
        </span>
      ))}
    </div>
  );
}

/**
 * LA ÓRBITA DE LA TARJETA «DESPUÉS» (14/11/2026, Martín: «la animación del After no es muy similar a la que hiciste»). La de Foreplay es un
 * video en bucle (home-loader-main), mirado cuadro a cuadro el 14/11: un anillo de 280 px con sus cuatro etapas que da un cuarto de vuelta
 * en sentido horario cada 2 s (quieta 1,25 s, se mueve 0,75 s con aceleración suave) y las etiquetas siempre derechas; al centro, una
 * esfera oscura de baldosas con su logo encendido, que destella en cada paso. Sus cuatro etapas son las secciones de su página
 * (Research, Inspiration, Production, Analysis); aquí, las de la nuestra, en el mismo orden horario desde arriba.
 */
const ORBITA = ['Inspiración', 'Producción', 'Análisis', 'Investigación'];
/** Las baldosas de la esfera (7 × 7): las que titilan, y cuándo. */
const BALDOSAS_QUE_TITILAN: Readonly<Record<number, number>> = { 3: 0.4, 9: 1.6, 12: 2.9, 16: 0.9, 22: 3.6, 26: 2.2, 31: 1.2, 34: 3.1, 39: 0.2, 44: 2.6, 46: 1.9 };

function Orbita() {
  return (
    <div className={`${P}-orbita-caja`} aria-hidden="true">
      <div className={`${P}-orbita`}>
        <span className={`${P}-orbita-anillo`} />
        <span className={`${P}-orbita-centro`}>
          <span className={`${P}-orbita-baldosas`}>
            {Array.from({ length: 49 }, (_, i) => (
              <i key={i} style={BALDOSAS_QUE_TITILAN[i] != null ? { animationDelay: `${BALDOSAS_QUE_TITILAN[i]}s` } : undefined} className={BALDOSAS_QUE_TITILAN[i] != null ? `${P}-baldosa-titila` : undefined} />
            ))}
          </span>
          <span className={`${P}-orbita-logo`}><EstrellaMaKo size={58} color="#FFF6DD" /></span>
        </span>
        <span className={`${P}-orbita-giro`}>
          {ORBITA.map((t, i) => <span key={t} className={`${P}-orbita-et ${P}-orbita-et-${i}`}><span>{t}</span></span>)}
        </span>
      </div>
    </div>
  );
}

function Contraste({ b }: { b: De<'contraste'> }) {
  return (
    <section className={`${P}-sec-blanca`}>
      <div className={`${P}-blanco`}>
        <div className={`${P}-wrap`}>
          <div className={`${P}-winning`}>
            <div className={`${P}-head ${P}-head-oscura`}>
              {b.etiqueta ? <p className={`${P}-overline ${P}-head-over`} dangerouslySetInnerHTML={html(b.etiqueta)} /> : null}
              <h2 className={`${P}-h2c`} dangerouslySetInnerHTML={html(b.titulo)} />
            </div>
            <div className={`${P}-winning-grid`}>
              <div className={`${P}-wcard`}>
                <div className={`${P}-wcard-t`}>
                  <h3 dangerouslySetInnerHTML={html(b.sin.titulo)} />
                  <p dangerouslySetInnerHTML={html(b.sin.texto)} />
                </div>
                <Lluvia />
              </div>
              {/* Negra en los dos modos, como la de Foreplay (en el claro, negra sobre el bloque blanco). */}
              <div className={`${P}-wcard ${P}-wcard-oscura`} data-tema-fijo="">
                <div className={`${P}-wcard-t`}>
                  <h3 dangerouslySetInnerHTML={html(b.con.titulo)} />
                  <p dangerouslySetInnerHTML={html(b.con.texto)} />
                </div>
                <Orbita />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Las cabezas de sección, las filas con pestañas y la banda de la extensión ─
function Cabeza({ b }: { b: De<'tarjetas'> }) {
  return (
    <div className={`${P}-head`}>
      {b.etiqueta ? <p className={`${P}-overline ${P}-head-over`} dangerouslySetInnerHTML={html(b.etiqueta)} /> : null}
      <h2 className={`${P}-h2`} dangerouslySetInnerHTML={html(b.titulo)} />
      {b.bajada ? <p className={`${P}-head-p`} dangerouslySetInnerHTML={html(b.bajada)} /> : null}
    </div>
  );
}

/** El color del halo y del objeto de cada fila (en la referencia, el color de cada producto). */
const TONO_DE_FILA = ['azul', 'dorado', 'plata', 'azul'] as const;

/**
 * UNA PANTALLA POR PESTAÑA (14/11/2026, Martín: «lo que tiene esa landing es… muchos videos que hacen que tenga sentido la landing. También
 * cuando se pasa el hover, botones que uno puede ir intercambiando para ir viendo»). Como Foreplay: cada pestaña cambia lo que se ve a
 * la derecha. La grabación sólo donde ES esa pantalla (la regla del Cerebro, 14/11), y TODAS la tienen (Martín, 14/11, noche: «no
 * funcionan los botones de cada cosa, por ejemplo, desde Chrome con un clic o le pegas»): tests/vsl-landings-competencia.test.ts mira que
 * cada pestaña tenga la suya y que el archivo exista. Cada una es la app REAL compilada en un banco (C:/dev/bancos-portada/banco-spy-gurus,
 * con los datos de @AlexHormozi leídos en sólo lectura del espacio de MaKo) y la cámara encima de lo que pasa.
 */
const sitio = (n: string) => ({ video: `/vsl-assets/sitio/${n}.webm`, poster: `/vsl-assets/sitio/${n}.jpg` });
export const GRABACION_DE_PESTANA: Readonly<Record<string, { video: string; poster: string }>> = {
  // La extensión de MaKo (extension/popup.html y popup.js, los reales) en la Biblioteca de Anuncios de Meta: «Guardar en Spy».
  'Desde Chrome, con un clic': sitio('spy-extension'),
  // «Guardar un anuncio» en la ficha de Hormozi: se pega el enlace de uno de sus anuncios de la Biblioteca y queda en su ficha.
  'O lo pegas': sitio('spy-pegar'),
  // La pestaña «Anuncios» de la ficha (fase 1 del plan de Foreplay, 79b3439f7): los 64 anuncios reales de @AlexHormozi, con sus días
  // activos, a dónde mandan, los tests creativos con su «Ganador» y la línea de tiempo (banco-spy-gurus/grabar-anuncios.mjs).
  'Desde cuándo está a la vista': sitio('spy-anuncios'),
  'Sumas a tus competidores': sitio('spy'),
  // Sus videos con sus vistas, cuánto rindió cada uno frente a su cuenta y su gráfico por fecha.
  'MaKo lee lo que publican': sitio('spy-lee'),
  // «Sugeridos» de un negocio nuevo: los referentes que MaKo ya mira, con su caricatura; se suma a Hormozi.
  'Te sugiere a quién mirar': sitio('spy-sugeridos'),
  // La pestaña «Funnel» de su ficha: qué funnel usa y lo que lo delata.
  'Qué funnel usa': sitio('spy-funnel'),
  // Su oferta de acquisition.com leída por el analista de Offer el 14/11 (spy.oferta.5): las nueve notas y su total.
  'Su oferta, con nota': sitio('spy-oferta'),
  // El detalle de uno de sus videos: sus números, cuánto rindió frente a su cuenta y su estructura (gancho, ángulo y formato).
  'Su gancho y su ángulo': sitio('spy-gancho'),
  'Tu versión, en Image': sitio('carruseles'),
  // Su sitio replicado en el Web Generator: acquisition.com, la de la portada.
  'Copia su sitio': sitio('replicar'),
  // Un short real de Hormozi replicado por MaKo en Copywriting (el de la portada).
  'Su guion, con tu oferta': sitio('copywriting'),
};

function Fila({ b, n }: { b: De<'tarjetas'>; n: number }) {
  const nombre = `${P}-t${n}`;
  const tono = TONO_DE_FILA[n % TONO_DE_FILA.length];
  return (
    <div className={`${P}-fila ${P}-tono-${tono}`}>
      {b.items.map((it, k) => (
        <input key={it.titulo} type="radio" name={nombre} id={`${nombre}-${k}`} className={`${P}-radio`} defaultChecked={k === 0} aria-label={it.titulo.replace(/<[^>]+>/g, '')} />
      ))}
      <div className={`${P}-fcard`}>
        <div className={`${P}-fcard-head`}>
          {b.etiqueta ? <p className={`${P}-overline ${P}-fcard-over`} dangerouslySetInnerHTML={html(b.etiqueta)} /> : null}
          <h3 className={`${P}-h3`} dangerouslySetInnerHTML={html(b.titulo)} />
        </div>
        <div className={`${P}-fcard-btns`}><Cta cara="oscuro" /></div>
        <div className={`${P}-tabs`}>
          {b.items.map((it, k) => (
            <label key={it.titulo} htmlFor={`${nombre}-${k}`} className={`${P}-tab ${P}-tab-${k}`}>
              <Icono d={it.icono} size={20} grosor={1.5} />
              <span dangerouslySetInnerHTML={html(it.titulo)} />
            </label>
          ))}
        </div>
        <div className={`${P}-obj`} aria-hidden="true">
          <span className={`${P}-obj-losa`} />
          <span className={`${P}-obj-sombra`} />
          <span className={`${P}-obj-pieza`}><span className={`${P}-obj-cara`}><Icono d={b.items[0]?.icono} size={70} grosor={1.5} /></span></span>
        </div>
      </div>
      {/* La figura: como la de Foreplay, la pantalla de la app grande y de cerca, cortada por el borde derecho de la figura, una por
          pestaña y sin transición (su `display: none/flex`). Abajo, lo que dice esa pestaña, como su franja «Supported ad libraries». */}
      <div className={`${P}-figura`}>
        <div className={`${P}-figura-halo`} aria-hidden="true" />
        <div className={`${P}-ventana`} aria-hidden="true">
          {b.items.map((it, k) => {
            const g = GRABACION_DE_PESTANA[it.titulo.replace(/<[^>]+>/g, '')];
            return g ? (
              <div key={it.titulo} className={`${P}-pantalla-tab ${P}-pantalla-tab-${k}`}>
                {/* Sólo la primera arranca sola; las demás las pone a andar el script al elegir su pestaña (y sin JavaScript, su póster). */}
                <video className={`${P}-pantalla-video`} src={g.video} poster={g.poster} muted loop playsInline autoPlay={k === 0} preload={k === 0 ? 'metadata' : 'none'} />
              </div>
            ) : null;
          })}
        </div>
        <div className={`${P}-leyendas`}>
          {b.items.map((it, k) => (
            <p key={it.titulo} className={`${P}-leyenda ${P}-leyenda-${k}`} dangerouslySetInnerHTML={html(it.texto)} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Banda({ b }: { b: De<'pasos'> }) {
  return (
    <div className={`${P}-banda`}>
      <figure className={`${P}-banda-logo`} aria-hidden="true">
        <span><EstrellaMaKo size={64} color="#C9CCD3" /></span>
      </figure>
      <div className={`${P}-banda-content`}>
        <div className={`${P}-banda-title`}>
          {b.etiqueta ? <p className={`${P}-overline ${P}-fcard-over`} dangerouslySetInnerHTML={html(b.etiqueta)} /> : null}
          <h3 className={`${P}-h4`} dangerouslySetInnerHTML={html(b.titulo)} />
          {b.bajada ? <p className={`${P}-banda-p`} dangerouslySetInnerHTML={html(b.bajada)} /> : null}
        </div>
        <ol className={`${P}-banda-pasos`}>
          {b.pasos.map((p, i) => (
            <li key={p.titulo}>
              <span className={`${P}-banda-n`}>{i + 1}</span>
              <span className={`${P}-banda-pt`}>
                <strong dangerouslySetInnerHTML={html(p.titulo)} />
                <span dangerouslySetInnerHTML={html(p.texto)} />
              </span>
            </li>
          ))}
        </ol>
      </div>
      <div className={`${P}-banda-cta`}><Cta /></div>
    </div>
  );
}

// ── El cierre y el pie ───────────────────────────────────────────────────────
/** El cierre: su «Ready to ship more winning ads?» tal cual (12/11/2026); la bajada es la de la banda de la llamada de /vsl. */
function Cierre({ visual }: { visual?: VisualHero }) {
  return (
    <section className={`${P}-cierre`}>
      <div className={`${P}-wrap`}>
        <div className={`${P}-cierre-in`}>
          <div className={`${P}-head ${P}-cierre-head`}>
            <h2 className={`${P}-h2`}>¿Listo para lanzar más anuncios ganadores?</h2>
            <p className={`${P}-head-p ${P}-cierre-p`}>{TEXTO_CIERRE}</p>
          </div>
          <div className={`${P}-cierre-btns`}><Cta /></div>
        </div>
      </div>
      {visual ? (
        <div className={`${P}-escena`} aria-hidden="true">
          <div className={`${P}-laptop`}>
            <div className={`${P}-laptop-pantalla`}>
              <div className={`${P}-pantalla ${P}-pantalla-todo ${P}-pantalla-laptop`}><VisualDeLanding visual={visual} /></div>
            </div>
            <div className={`${P}-laptop-base`} />
          </div>
        </div>
      ) : null}
    </section>
  );
}

/** La fila de productos del pie: las funciones que trabajan con lo que guarda Spy (lib/funciones-mako.ts → 'market-an' e 'image-editor'). */
const PRODUCTOS: { slug: string; linea: string }[] = [
  { slug: 'image', linea: 'Haz tu versión' },
  { slug: 'web-generator', linea: 'Replica su landing' },
  { slug: 'offer', linea: 'Arma tu oferta' },
  { slug: 'copywriting', linea: 'Escribe tus anuncios' },
  { slug: 'script', linea: 'Lee tus anuncios' },
];

function Pie() {
  const otras = otrasFunciones(SLUG);
  const productos = PRODUCTOS.map((p) => ({ ...p, l: LANDINGS_COMPETENCIA.find((x) => x.slug === p.slug) })).filter((p) => p.l);
  return (
    <footer className={`${P}-pie`}>
      <div className={`${P}-pie-in`}>
        <div className={`${P}-pie-block`}>
          <ul className={`${P}-pie-prods`}>
            {productos.map((p) => (
              <li key={p.slug}>
                <a href={`/vsl/${p.slug}`} className={`${P}-pie-prod`}>
                  <span className={`${P}-pie-prod-ic`}><Icono d={p.l!.icono} size={22} grosor={1.6} /></span>
                  <span className={`${P}-pie-prod-t`}><span>{p.linea}</span><strong>{p.l!.nombre}</strong></span>
                </a>
              </li>
            ))}
          </ul>
          <div className={`${P}-pie-div`} />
          <div className={`${P}-pie-company`}><LogoMaKo className={`${P}-brand`} tamano={30} claro /></div>
          <div className={`${P}-pie-div`} />
          <div className={`${P}-pie-links`}>
            <div className={`${P}-pie-cat ${P}-pie-cat-funciones`}>
              <p className={`${P}-overline ${P}-pie-h`}>Funciones</p>
              <ul>{otras.map((o) => <li key={o.href}><a href={o.href}>{o.nombre}</a></li>)}</ul>
            </div>
            <div className={`${P}-pie-cat`}>
              <p className={`${P}-overline ${P}-pie-h`}>MaKo</p>
              <ul>
                <li><a href="/">Inicio</a></li>
                <li><a href={RUTA_CTA}>{TEXTO_CTA}</a></li>
                <li><a href="/login">Iniciar sesión</a></li>
              </ul>
            </div>
          </div>
          <div className={`${P}-pie-div`} />
          <div className={`${P}-pie-foot`}>
            <p>© MaKo — Todos los derechos reservados.</p>
            <a href="/privacidad">Privacidad</a>
            <a href="/terminos">Términos</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default function DisenoCompetitorSpy({ landing }: PropsDiseno) {
  const bl = landing.bloques;
  const heroB = bl.find((b): b is De<'hero'> => b.tipo === 'hero');
  const visual = heroB?.visual;
  const cabeza: ReactNode[] = [];
  // Cada cabeza (un bloque de tarjetas sin tarjetas) abre una sección de la referencia; las filas y la banda la siguen.
  const secciones: { cabeza: ReactNode; cuerpo: ReactNode[] }[] = [];
  let filas = 0;
  bl.forEach((b, i) => {
    const actual = secciones[secciones.length - 1];
    switch (b.tipo) {
      case 'hero': cabeza.push(<Hero key={i} b={b} />); break;
      case 'contraste': cabeza.push(<Contraste key={i} b={b} />); break;
      case 'tarjetas':
        if (!b.items.length) { secciones.push({ cabeza: <Cabeza key={i} b={b} />, cuerpo: [] }); break; }
        (actual ? actual.cuerpo : cabeza).push(<Fila key={i} b={b} n={filas} />);
        filas += 1;
        break;
      case 'pasos': (actual ? actual.cuerpo : cabeza).push(<Banda key={i} b={b} />); break;
      default: break;
    }
  });
  return (
    <div className={P}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {/* Al pasar el mouse por una pestaña, se ve su pantalla (Martín, 14/11/2026: «cuando se pasa el hover, botones que uno puede ir
          intercambiando para ir viendo»). Sin JavaScript igual cambian al tocarlas (los radios). */}
      <script data-visor="" dangerouslySetInnerHTML={{ __html: SCRIPT_PESTANAS }} />
      <script data-visor="" dangerouslySetInnerHTML={{ __html: SCRIPT_LLUVIA }} />
      <Barra />
      <main>
        {cabeza}
        {secciones.map((s, i) => (
          <section key={i} className={`${P}-prod`}>
            <div className={`${P}-wrap`}>
              <div className={`${P}-prod-in`}>
                {s.cabeza}
                {s.cuerpo}
              </div>
            </div>
          </section>
        ))}
        <Cierre visual={visual} />
      </main>
      <Pie />
    </div>
  );
}

// Los valores salen de getComputedStyle sobre https://www.foreplay.co/ a 1440 y 390 px (11/11/2026). Los colores de sus
// productos (el azul de Swipe File, el rojo de Spyder, el verde de Briefs, el violeta de la barra lateral de su app) van
// como el azul y el dorado de MaKo; lo demás (el negro #020308, los blancos en transparencia, los grises de los filetes)
// es de la referencia.
// LAS PESTAÑAS: cambian con el clic y con las flechas (los radios, sin JavaScript), y al pasar el mouse (Martín, 14/11). Este script,
// además, pone a andar desde el principio el video de la pestaña elegida y frena los otros, y sólo mientras la fila se ve: doce
// videos andando a la vez son doce descargas (por eso las demás llevan preload="none" y ninguna arranca sola, salvo la primera).
// Es un <script data-visor>: el visor de Martín borra los demás scripts.
const SCRIPT_PESTANAS = `(function(){
var P='${P}';
function filaDe(n){return n&&n.closest?n.closest('.'+P+'-fila'):null;}
function mostrar(fila){
  if(!fila)return;
  var radios=fila.querySelectorAll('.'+P+'-radio'),k=-1,i;
  for(i=0;i<radios.length;i++)if(radios[i].checked)k=i;
  var tabs=fila.querySelectorAll('.'+P+'-pantalla-tab'),ve=fila.__ve!==false;
  for(i=0;i<tabs.length;i++){
    var v=tabs[i].querySelector('video');if(!v)continue;
    if(tabs[i].classList.contains(P+'-pantalla-tab-'+k)&&ve){
      if(v.preload==='none')v.preload='auto';
      if(fila.__k!==k){try{v.currentTime=0;}catch(e){}}
      var pr=v.play();if(pr&&pr.catch)pr.catch(function(){});
    }else if(!v.paused)v.pause();
  }
  fila.__k=k;
}
document.addEventListener('mouseover',function(e){var l=e.target.closest&&e.target.closest('.'+P+'-tab');if(!l)return;var r=document.getElementById(l.htmlFor);if(r&&!r.checked){r.checked=true;mostrar(filaDe(r));}});
document.addEventListener('change',function(e){var t=e.target;if(t&&t.classList&&t.classList.contains(P+'-radio'))mostrar(filaDe(t));});
function vigilar(){
  var filas=document.querySelectorAll('.'+P+'-fila');
  if(!('IntersectionObserver' in window)){filas.forEach(mostrar);return;}
  var io=new IntersectionObserver(function(es){es.forEach(function(en){en.target.__ve=en.isIntersecting;mostrar(en.target);});},{threshold:0.15});
  filas.forEach(function(f){f.__ve=false;io.observe(f);});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',vigilar);else vigilar();
})();`;

// LA LLUVIA DE LA TARJETA «ANTES», con física de verdad y sin librerías: cajas que giran, chocan, se frenan con el roce y se apilan.
// Es el Box2D-lite de Erin Catto (la colisión de dos cajas por recorte de caras y los impulsos secuenciales con el roce acotado), en
// píxeles y segundos, con la configuración del LogoRain de Foreplay (ver LLUVIA). Una pieza quieta 0,4 s se «duerme» y pasa a ser piso
// (así la pila no tiembla y el cuadro deja de calcularse cuando todas duermen). Con «menos movimiento» se calcula entera de una vez y se
// dibuja ya apilada. Corre al entrar la tarjeta en pantalla, una vez.
const SCRIPT_LLUVIA = `(function(){
var P='${P}',G=700,PASO=1/120,VUELTAS=10,TOPE=0.5,SESGO=0.2,ROCE=0.3,CADA=0.3;
function caja(x,y,w,h,fija){var m=fija?0:w*h*0.001;return{x:x,y:y,r:0,vx:0,vy:0,w:0,hw:w/2,hh:h/2,im:m?1/m:0,iI:m?12/(m*(w*w+h*h)):0,fija:!!fija,quieto:0,duerme:false,vida:0};}
function borde(B,nx,ny){var c=Math.cos(B.r),s=Math.sin(B.r),lx=-(c*nx+s*ny),ly=-(-s*nx+c*ny),h=B.hw,k=B.hh,p;
  if(Math.abs(lx)>Math.abs(ly))p=lx>=0?[h,-k,h,k]:[-h,k,-h,-k];else p=ly>=0?[h,k,-h,k]:[-h,-k,h,-k];
  return[B.x+c*p[0]-s*p[1],B.y+s*p[0]+c*p[1],B.x+c*p[2]-s*p[3],B.y+s*p[2]+c*p[3]];}
function recorte(v,nx,ny,o){var d0=nx*v[0]+ny*v[1]-o,d1=nx*v[2]+ny*v[3]-o,r=[];
  if(d0<=0)r.push(v[0],v[1]);if(d1<=0)r.push(v[2],v[3]);
  if(d0*d1<0){var t=d0/(d0-d1);r.push(v[0]+t*(v[2]-v[0]),v[1]+t*(v[3]-v[1]));}
  return r.length>=4?r:null;}
function choque(A,B,out){
  var cA=Math.cos(A.r),sA=Math.sin(A.r),cB=Math.cos(B.r),sB=Math.sin(B.r),px=B.x-A.x,py=B.y-A.y;
  var dAx=cA*px+sA*py,dAy=-sA*px+cA*py,dBx=cB*px+sB*py,dBy=-sB*px+cB*py;
  var a11=Math.abs(cA*cB+sA*sB),a12=Math.abs(-cA*sB+sA*cB),a21=Math.abs(-sA*cB+cA*sB),a22=Math.abs(sA*sB+cA*cB);
  var fAx=Math.abs(dAx)-A.hw-(a11*B.hw+a12*B.hh),fAy=Math.abs(dAy)-A.hh-(a21*B.hw+a22*B.hh);
  if(fAx>0||fAy>0)return 0;
  var fBx=Math.abs(dBx)-(a11*A.hw+a21*A.hh)-B.hw,fBy=Math.abs(dBy)-(a12*A.hw+a22*A.hh)-B.hh;
  if(fBx>0||fBy>0)return 0;
  var eje=0,sep=fAx,nx=dAx>0?cA:-cA,ny=dAx>0?sA:-sA;
  if(fAy>0.95*sep+0.01*A.hh){eje=1;sep=fAy;nx=dAy>0?-sA:sA;ny=dAy>0?cA:-cA;}
  if(fBx>0.95*sep+0.01*B.hw){eje=2;sep=fBx;nx=dBx>0?cB:-cB;ny=dBx>0?sB:-sB;}
  if(fBy>0.95*sep+0.01*B.hh){eje=3;sep=fBy;nx=dBy>0?-sB:sB;ny=dBy>0?cB:-cB;}
  var fx,fy,fr,sx,sy,lado,neg,pos,inc;
  if(eje<2){fx=nx;fy=ny;inc=borde(B,fx,fy);
    if(eje===0){fr=A.x*fx+A.y*fy+A.hw;sx=-sA;sy=cA;lado=A.x*sx+A.y*sy;neg=-lado+A.hh;pos=lado+A.hh;}
    else{fr=A.x*fx+A.y*fy+A.hh;sx=cA;sy=sA;lado=A.x*sx+A.y*sy;neg=-lado+A.hw;pos=lado+A.hw;}}
  else{fx=-nx;fy=-ny;inc=borde(A,fx,fy);
    if(eje===2){fr=B.x*fx+B.y*fy+B.hw;sx=-sB;sy=cB;lado=B.x*sx+B.y*sy;neg=-lado+B.hh;pos=lado+B.hh;}
    else{fr=B.x*fx+B.y*fy+B.hh;sx=cB;sy=sB;lado=B.x*sx+B.y*sy;neg=-lado+B.hw;pos=lado+B.hw;}}
  var c1=recorte(inc,-sx,-sy,neg);if(!c1)return 0;
  var c2=recorte(c1,sx,sy,pos);if(!c2)return 0;
  var n=0;
  for(var i=0;i<2;i++){var vx=c2[i*2],vy=c2[i*2+1],s=fx*vx+fy*vy-fr;if(s<=0){out.push({x:vx-s*fx,y:vy-s*fy,s:s,nx:nx,ny:ny});n++;}}
  return n;}
function preparar(A,B,c,dt){
  var imA=A.duerme?0:A.im,iIA=A.duerme?0:A.iI,imB=B.duerme?0:B.im,iIB=B.duerme?0:B.iI;
  var r1x=c.x-A.x,r1y=c.y-A.y,r2x=c.x-B.x,r2y=c.y-B.y,nx=c.nx,ny=c.ny,tx=ny,ty=-nx;
  var rn1=r1x*nx+r1y*ny,rn2=r2x*nx+r2y*ny,rt1=r1x*tx+r1y*ty,rt2=r2x*tx+r2y*ty;
  var kn=imA+imB+iIA*(r1x*r1x+r1y*r1y-rn1*rn1)+iIB*(r2x*r2x+r2y*r2y-rn2*rn2);
  var kt=imA+imB+iIA*(r1x*r1x+r1y*r1y-rt1*rt1)+iIB*(r2x*r2x+r2y*r2y-rt2*rt2);
  return{A:A,B:B,imA:imA,iIA:iIA,imB:imB,iIB:iIB,r1x:r1x,r1y:r1y,r2x:r2x,r2y:r2y,nx:nx,ny:ny,tx:tx,ty:ty,mn:kn>0?1/kn:0,mt:kt>0?1/kt:0,sesgo:-SESGO/dt*Math.min(0,c.s+TOPE),Pn:0,Pt:0};}
function empujar(c,px,py){var A=c.A,B=c.B;
  A.vx-=c.imA*px;A.vy-=c.imA*py;A.w-=c.iIA*(c.r1x*py-c.r1y*px);
  B.vx+=c.imB*px;B.vy+=c.imB*py;B.w+=c.iIB*(c.r2x*py-c.r2y*px);}
function impulso(c){var A=c.A,B=c.B;
  var dx=B.vx-B.w*c.r2y-A.vx+A.w*c.r1y,dy=B.vy+B.w*c.r2x-A.vy-A.w*c.r1x;
  var d=c.mn*(-(dx*c.nx+dy*c.ny)+c.sesgo),p0=c.Pn;c.Pn=Math.max(p0+d,0);d=c.Pn-p0;empujar(c,d*c.nx,d*c.ny);
  dx=B.vx-B.w*c.r2y-A.vx+A.w*c.r1y;dy=B.vy+B.w*c.r2x-A.vy-A.w*c.r1x;
  d=c.mt*(-(dx*c.tx+dy*c.ty));var tope=ROCE*c.Pn;p0=c.Pt;c.Pt=Math.max(-tope,Math.min(tope,p0+d));d=c.Pt-p0;empujar(c,d*c.tx,d*c.ty);}
function paso(m,dt){
  var cs=[],todos=m.cuerpos.concat(m.paredes),i,j,k,b;
  for(i=0;i<m.cuerpos.length;i++){b=m.cuerpos[i];if(!b.duerme)b.vy+=G*dt;}
  for(i=0;i<m.cuerpos.length;i++){var A=m.cuerpos[i];
    for(j=i+1;j<todos.length;j++){var B=todos[j];
      if(A.duerme&&(B.fija||B.duerme))continue;
      if(!B.fija){var ex=A.x-B.x,ey=A.y-B.y,rr=A.hw+A.hh+B.hw+B.hh;if(ex*ex+ey*ey>rr*rr)continue;}
      var pts=[];if(!choque(A,B,pts))continue;
      // Un golpe fuerte despierta a la que dormía.
      for(k=0;k<pts.length;k++){var q=pts[k],dvn=(B.vx-A.vx)*q.nx+(B.vy-A.vy)*q.ny;if(dvn<-90){if(A.duerme){A.duerme=false;A.quieto=0;}if(B.duerme){B.duerme=false;B.quieto=0;}}cs.push(preparar(A,B,q,dt));}
    }}
  for(var v=0;v<VUELTAS;v++)for(k=0;k<cs.length;k++)impulso(cs[k]);
  for(i=0;i<m.cuerpos.length;i++){b=m.cuerpos[i];if(b.duerme)continue;
    b.x+=b.vx*dt;b.y+=b.vy*dt;b.r+=b.w*dt;b.vida+=dt;
    if(b.vida>0.8&&b.vx*b.vx+b.vy*b.vy<64&&Math.abs(b.w)<0.12){b.quieto+=dt;if(b.quieto>0.4){b.duerme=true;b.vx=b.vy=b.w=0;}}else b.quieto=0;}
}
function paredes(W,H){var t=100;return[caja(-t/2,H/2,t,H*5,1),caja(W+t/2,H/2,t,H*5,1),caja(W/2,H+t/2,W*2,t,1)];}
function dibujar(b){b.el.style.transform='translate('+(b.x-b.hw).toFixed(1)+'px,'+(b.y-b.hh).toFixed(1)+'px) rotate('+b.r.toFixed(4)+'rad)';}
function lluvia(cj){
  if(cj.__lluvia)return;cj.__lluvia=1;
  var els=[].slice.call(cj.querySelectorAll('.'+P+'-cae')),vw=window.innerWidth,n=vw<=480?8:vw<=768?12:16;
  var W=cj.clientWidth,H=cj.clientHeight;if(!W||!H)return;
  cj.style.setProperty('--k',W<400?'1':'1.2');
  els.forEach(function(e,i){if(i>=n)e.style.display='none';});
  els=els.slice(0,n);
  cj.setAttribute('data-cayendo','');
  var m={cuerpos:[],paredes:paredes(W,H)};
  var cola=els.map(function(e){var w=e.offsetWidth,h=e.offsetHeight,b=caja(Math.random()*Math.max(1,W-w)+w/2,-60,w,h,0);
    b.r=(Math.random()*60-30)*Math.PI/180;b.w=Math.random()*1.2-0.6;b.el=e;return b;});
  var quieto=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(quieto){var t=0,q=0;for(var s=0;s<2400;s++){t+=PASO;while(q<cola.length&&t>=CADA*(q+1)){m.cuerpos.push(cola[q]);q++;}paso(m,PASO);}
    cola.forEach(function(b){dibujar(b);b.el.setAttribute('data-vivo','');});return;}
  var andando=false;
  function correr(){if(andando)return;andando=true;var t0=null,ult=0,acum=0,q=m.cuerpos.length;
    function cuadro(ts){if(t0===null){t0=ts;ult=ts;}var dt=Math.min(0.05,(ts-ult)/1000),t=(ts-t0)/1000;ult=ts;
      while(q<cola.length&&t>=CADA*(q+1)){var b=cola[q];m.cuerpos.push(b);dibujar(b);b.el.setAttribute('data-vivo','');q++;}
      acum+=dt;while(acum>=PASO){paso(m,PASO);acum-=PASO;}
      var dormidas=0;m.cuerpos.forEach(function(b){if(b.duerme){dormidas++;if(b.pintada)return;b.pintada=true;}else b.pintada=false;dibujar(b);});
      if((q>=cola.length&&dormidas===m.cuerpos.length)||t>25){andando=false;return;}
      requestAnimationFrame(cuadro);}
    requestAnimationFrame(cuadro);}
  if('IntersectionObserver' in window){var io=new IntersectionObserver(function(es){if(es.some(function(e){return e.isIntersecting;})){io.disconnect();correr();}});io.observe(cj);}
  else correr();
  // Si la tarjeta cambia de tamaño (girar el teléfono), las paredes van con ella y las piezas se despiertan.
  window.addEventListener('resize',function(){var w=cj.clientWidth,h=cj.clientHeight;if(!w||!h||(w===W&&h===H))return;W=w;H=h;m.paredes=paredes(W,H);
    m.cuerpos.forEach(function(b){b.duerme=false;b.quieto=0;b.vida=0;if(b.x>W-b.hw)b.x=W-b.hw;});if(m.cuerpos.length)correr();});
}
function todas(){document.querySelectorAll('.'+P+'-lluvia').forEach(lluvia);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',todas);else todas();
})();`;
const PESTANAS = [0, 1, 2, 3];
const CSS_PESTANAS = PESTANAS.map((k) => `
.${P}-radio:nth-of-type(${k + 1}):checked ~ .${P}-fcard .${P}-tab-${k} { color: #fff; }
.${P}-radio:nth-of-type(${k + 1}):checked ~ .${P}-figura .${P}-leyenda-${k} { display: block; }
.${P}-radio:nth-of-type(${k + 1}):checked ~ .${P}-figura .${P}-pantalla-tab-${k} { display: block; }
.${P}-radio:nth-of-type(${k + 1}):focus-visible ~ .${P}-fcard .${P}-tab-${k} { outline: 2px solid rgba(255,255,255,.6); outline-offset: 2px; }`).join('');

const CSS = `
/* Pantallas por pestaña: una a la vez (la del radio marcado), sin transición, como su «display: none/flex». */
.${P}-pantalla-tab { display: none; }
.${P}-pantalla-video { display: block; width: 100%; height: auto; }
/* EL HERO ACOMPAÑA AL SCROLL (14/11/2026, Martín: «al principio, al hacer scroll, tiene una animación que acompaña al scroll»). Medido en
   Foreplay con el navegador el 14/11 (foreplay-relevo/visto-1411/pc-datos.json → hero): su «home-hero-sticky» (el titular, la bajada,
   el botón y los logos) queda PEGADO a 132 px del borde y, en el primer alto de pantalla, va LINEAL de escala 1 a ,75, sube un 33 % de
   su alto y pasa de opacidad 1 a 0 (a 450 px de scroll: ,875 y ,5); la captura de su app NO se achica: sigue de largo y le pasa por
   encima. Sólo computadora y tablet, sin JavaScript (animation-timeline), y nada si se pidió menos movimiento. */
@supports (animation-timeline: scroll()) {
  @media (min-width: 768px) and (prefers-reduced-motion: no-preference) {
    .${P}-hero-pega { position: sticky; top: calc(var(--barra-agencia, 0px) + 132px); animation: ${P}-hero-sale linear both; animation-timeline: scroll(root); animation-range: 0 100vh; }
    @keyframes ${P}-hero-sale { to { transform: translateY(-33%) scale(.75); opacity: 0; } }
    .${P}-captura { position: relative; z-index: 1; }
    .${P}-sec-blanca { position: relative; z-index: 2; }
  }
}
@font-face { font-family: 'd-competitor-spy-inter'; src: url('/vsl-assets/fuentes/inter/inter-latin-opsz-var.woff2') format('woff2'); font-weight: 100 900; font-style: normal; font-display: swap; }
.${P} { --az: #2F6FED; --az-o: #1F57C8; --oro: #F2B01E; --negro: #020308; --negro2: #090A0E; --filete: #24262E; --ease: cubic-bezier(.19,1,.22,1);
  background: var(--negro); color: rgba(255,255,255,.36); font-family: 'd-competitor-spy-inter', Inter, Arial, sans-serif; font-size: 16px; line-height: 24px; letter-spacing: -0.18px;
  font-variation-settings: 'opsz' 14; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; overflow-x: clip; }
.${P} *, .${P} *::before, .${P} *::after { box-sizing: border-box; }
.${P} :where(h1, h2, h3, h4, p, ul, ol, figure) { margin: 0; padding: 0; }
.${P} :where(ul, ol) { list-style: none; }
.${P} :where(a) { color: inherit; text-decoration: none; }
.${P} :where(strong) { font-weight: 600; color: #fff; }
.${P}-wrap { max-width: 1344px; margin: 0 auto; padding: 0 40px; }
.${P}-overline { font-size: 12px; font-weight: 550; line-height: 16px; letter-spacing: 2px; text-transform: uppercase; color: rgba(255,255,255,.84); }
.${P}-h1, .${P}-h2, .${P}-h2c, .${P}-h3, .${P}-h4, .${P}-wcard h3 { font-family: inherit; font-variation-settings: 'opsz' 32; font-weight: 600; }

/* ── Botones: 10 px de radio, 8 px de relleno, texto 16/550 con 6 px a los lados y el chevrón de 24 px ── */
.${P}-btn { position: relative; display: inline-flex; align-items: center; justify-content: center; padding: 8px; border-radius: 10px; font-size: 16px; font-weight: 550; line-height: 24px; letter-spacing: -0.18px; white-space: nowrap; transition: background-color .2s, color .2s; }
.${P}-btn-t { padding: 0 6px; }
.${P}-btn-ic { width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center; opacity: .68; }
.${P}-btn-blanco { background: #fff; color: #090A0E; }
.${P}-btn-blanco .${P}-btn-ic { opacity: 1; }
.${P}-btn-blanco:hover { background: rgba(255,255,255,.84); }
.${P}-btn-oscuro { background: var(--negro2); color: #fff; border: 1px solid var(--filete); }
.${P}-btn-oscuro:hover { background: rgba(255,255,255,.06); }
.${P}-btn-barra { background: #fff; color: #090A0E; font-size: 15px; line-height: 20px; transition: background-color .6s var(--ease); }
.${P}-btn-barra:hover { background: #DDDEE5; }
.${P}-btn:focus-visible, .${P}-navlink:focus-visible, .${P}-tab:focus-visible { outline: 2px solid rgba(255,255,255,.7); outline-offset: 2px; }

/* ── Barra: 72 px, pegajosa, #020308 al 92 % con desenfoque de 24 px ── */
.${P}-nav { position: sticky; top: var(--barra-agencia, 0px); z-index: 100; background: rgba(2,3,8,.92); -webkit-backdrop-filter: blur(24px); backdrop-filter: blur(24px); }
.${P}-nav-in { max-width: 1440px; margin: 0 auto; padding: 0 40px; height: 72px; display: flex; align-items: center; }
.${P}-nav-stack { flex: 1; display: flex; align-items: center; gap: 36px; padding: 16px; height: 72px; }
.${P}-brand { padding: 4px; border-radius: 10px; flex: none; }
.${P}-brand span:last-child { font-size: 21px !important; letter-spacing: -0.4px !important; }
.${P}-nav-menu { flex: 1; display: flex; align-items: center; gap: 12px; }
.${P}-navlink { display: inline-flex; align-items: center; gap: 4px; padding: 6px 10px; border-radius: 10px; font: inherit; font-size: 15px; font-weight: 400; line-height: 20px; letter-spacing: -0.18px; color: rgba(255,255,255,.52); background: none; border: 0; cursor: pointer; transition: color .5s var(--ease); white-space: nowrap; }
.${P}-navlink:hover { color: rgba(255,255,255,.84); }
.${P}-dd-btn { padding: 6px 6px 6px 10px; }
.${P}-dd { position: relative; }
.${P}-dd-panel { position: absolute; left: -16px; top: calc(100% + 14px); width: 640px; padding: 16px; background: var(--negro); border: 1px solid #2A2B30; border-radius: 28px; display: flex; flex-direction: column; gap: 8px;
  opacity: 0; visibility: hidden; pointer-events: none; transform: scale(.96) translateY(-8px); transform-origin: top left; transition: opacity .5s var(--ease), transform .5s var(--ease), visibility .5s; }
.${P}-dd-panel .${P}-overline { padding: 8px; }
.${P}-dd:hover .${P}-dd-panel, .${P}-dd:focus-within .${P}-dd-panel { opacity: 1; visibility: visible; pointer-events: auto; transform: none; }
.${P}-dd-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px 12px; }
.${P}-dd-grid a { padding: 8px; border-radius: 10px; font-size: 14px; font-weight: 500; line-height: 20px; letter-spacing: -0.09px; color: #fff; transition: background-color .2s; }
.${P}-dd-grid a:hover { background: rgba(255,255,255,.06); }
.${P}-nav-cta { margin-left: auto; display: flex; align-items: center; gap: 8px; }
.${P}-burger { display: none; position: relative; margin-left: auto; }
.${P}-burger summary { list-style: none; width: 44px; height: 44px; padding: 12px; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #fff; cursor: pointer; }
.${P}-burger summary::-webkit-details-marker { display: none; }
.${P}-burger-panel { position: absolute; right: -16px; top: calc(100% + 12px); width: min(374px, calc(100vw - 16px)); max-height: 70vh; overflow-y: auto; padding: 12px; background: var(--negro); border: 1px solid #2A2B30; border-radius: 20px; display: flex; flex-direction: column; gap: 2px; }
.${P}-burger-panel a:not(.${P}-btn) { padding: 10px 8px; border-radius: 10px; font-size: 15px; line-height: 20px; color: rgba(255,255,255,.84); }
.${P}-burger-panel .${P}-btn { margin-top: 8px; }

/* ── Hero: la grilla de puntos de 20 px al 66 %, enmascarada arriba y abajo ── */
.${P}-hero { position: relative; z-index: 0; }
.${P}-dots { position: absolute; inset: 0; z-index: -1; opacity: .66; pointer-events: none;
  background-image: radial-gradient(circle at 10px 10px, rgba(255,255,255,.115) 1.6px, transparent 2px), radial-gradient(circle at 10px 10px, rgba(255,255,255,.07) 1.6px, transparent 2px);
  background-size: 20px 20px, 60px 40px; background-position: 50% 0, 50% 0;
  -webkit-mask-image: linear-gradient(rgba(0,0,0,0) 0%, #000 20%, #000 75%, rgba(0,0,0,0) 100%); mask-image: linear-gradient(rgba(0,0,0,0) 0%, #000 20%, #000 75%, rgba(0,0,0,0) 100%); }
.${P}-hero-in { padding: 60px 0 0; display: flex; flex-direction: column; gap: 64px; }
.${P}-hero-top { padding: 0 0 80px; display: flex; flex-direction: column; align-items: center; gap: 40px; }
.${P}-hero-content { max-width: 960px; display: flex; flex-direction: column; align-items: center; gap: 12px; text-align: center; }
.${P}-h1 { font-size: 60px; line-height: 68px; letter-spacing: -0.45px; text-wrap: balance; color: rgba(255,255,255,.88);
  background-image: radial-gradient(circle at 50% -100%, #fff, rgba(255,255,255,.88)); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
.${P}-hero-sub { max-width: 690px; font-size: 18px; line-height: 28px; letter-spacing: -0.26px; color: rgba(255,255,255,.84); text-wrap: balance; }
.${P}-hero-sub strong { font-weight: 500; }
.${P}-hero-cta { display: flex; gap: 12px; }
.${P}-hero-pega { display: flex; flex-direction: column; gap: 64px; }
.${P}-hero-bottom { margin-top: -64px; display: flex; flex-direction: column; gap: 40px; }
.${P}-hero-over { text-align: center; color: rgba(255,255,255,.68); }
.${P}-puntos { display: flex; justify-content: center; flex-wrap: wrap; gap: 16px 48px; }
.${P}-punto { min-height: 52px; padding: 12px; display: inline-flex; align-items: center; gap: 10px; font-size: 16px; font-weight: 500; line-height: 24px; letter-spacing: -0.18px; color: rgba(255,255,255,.68); transition: color .2s; }
.${P}-punto svg { flex: none; color: rgba(255,255,255,.84); }
.${P}-punto:hover { color: rgba(255,255,255,.92); }

/* La captura de la app: 1264 × 659, fundida en negro los últimos 330 px y tapada por el bloque blanco. */
.${P}-captura { width: 100%; max-width: 1000px; margin: 0 auto; border-radius: 14px; background: #fff; overflow: hidden; }
.${P}-mock { position: relative; height: 659px; margin-bottom: -40px; }
.${P}-mock-app { position: absolute; inset: 0; display: flex; border-radius: 4px; overflow: hidden; background: #08090F;
  background-image: radial-gradient(60% 55% at 0% 70%, rgba(47,111,237,.32), transparent 70%), radial-gradient(40% 40% at 12% 15%, rgba(47,111,237,.16), transparent 70%); }
.${P}-mock-side { flex: 0 0 244px; padding: 22px 24px; display: flex; flex-direction: column; gap: 22px; }
.${P}-mock-marca { display: inline-flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 600; letter-spacing: -0.3px; color: #fff; }
.${P}-mock-item { display: flex; align-items: center; gap: 8px; padding: 7px 8px; border-radius: 8px; background: rgba(255,255,255,.08); font-size: 13px; font-weight: 500; color: #fff; }
.${P}-mock-panel { flex: 1; margin: 8px 6px 0 0; border-radius: 12px 12px 0 0; background: #F9F9FA; display: flex; flex-direction: column; overflow: hidden; }
.${P}-mock-head { height: 66px; padding: 0 18px; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid #ECEDF0; font-size: 15px; font-weight: 500; letter-spacing: -0.2px; color: #12151B; }
.${P}-mock-tile { width: 32px; height: 32px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; color: #fff; background: linear-gradient(160deg, #5B8DF5, var(--az) 60%, var(--az-o)); }
.${P}-mock .${P}-pantalla { padding: 20px; }
.${P}-mock .mk-v-spy, .${P}-pantalla-laptop .mk-v-spy { zoom: 1.3; }
.${P}-mock-fade { position: absolute; left: 0; right: 0; bottom: 0; height: 330px; background: linear-gradient(0deg, var(--negro), rgba(2,3,8,0)); pointer-events: none; }

/* El visual de la función, acomodado a lo ancho (la ficha a la izquierda, los anuncios a la derecha). */
.${P}-pantalla .mk-v-spy { flex-direction: row; align-items: stretch; gap: 14px; }
.${P}-pantalla .mk-v-spy-ficha { flex: 0 0 38%; }
.${P}-pantalla .mk-v-spy-anuncios { flex: 1; min-width: 0; }
.${P}-pantalla-anuncios .mk-v-spy-ficha, .${P}-pantalla-ficha .mk-v-spy-anuncios { display: none; }
.${P}-pantalla-ficha .mk-v-spy-ficha { flex: 1; }

/* ── El bloque blanco: 8 px de margen, 36 px de radio ── */
.${P}-sec-blanca { position: relative; z-index: 1; padding: 8px; }
.${P}-blanco { background: #fff; border-radius: 36px; }
.${P}-winning { padding: 80px 0; display: flex; flex-direction: column; align-items: center; gap: 72px; }
.${P}-head { max-width: 720px; margin: 0 auto; display: flex; flex-direction: column; align-items: center; gap: 12px; text-align: center; }
.${P}-h2c { font-size: 36px; line-height: 44px; letter-spacing: -0.26px; color: #171920; text-wrap: balance; }
.${P}-head-oscura .${P}-head-over { color: #4C505F; }
.${P}-winning-grid { width: 100%; max-width: 960px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.${P}-wcard { position: relative; height: 519px; padding: 24px; border-radius: 24px; box-shadow: 0 0 0 1px #E9EAEF; display: flex; flex-direction: column; gap: 24px; overflow: hidden; background: #fff; }
.${P}-wcard-t { position: relative; z-index: 1; display: flex; flex-direction: column; gap: 4px; }
.${P}-wcard h3 { font-family: inherit; font-variation-settings: 'opsz' 14; font-size: 18px; font-weight: 500; line-height: 27px; letter-spacing: -0.26px; color: #090A0E; }
.${P}-wcard p { font-size: 16px; line-height: 24px; letter-spacing: -0.18px; color: #343642; }
.${P}-wcard-oscura { background: var(--negro); }
.${P}-wcard-oscura h3 { color: #fff; }
.${P}-wcard-oscura p { color: rgba(255,255,255,.68); }
.${P}-wcard-oscura p strong { color: rgba(255,255,255,.92); }

/* LA LLUVIA de la tarjeta «antes»: la caja es la tarjeta entera (en Foreplay los que caen pasan por encima del texto). Cada pieza es
   blanca con su anillo, como sus «hba-asset»: las píldoras de 28,5 px de alto (57 / 2) y los recuadros de 44,5 (89 / 2), a 1,2× desde
   400 px de caja (el script pone --k). Medidas en em sobre 11 px. Sin JavaScript quedan donde las dejó el servidor, ya apiladas. */
.${P}-lluvia { --k: 1.2; position: absolute; inset: 0; z-index: 2; pointer-events: none; font-size: calc(11px * var(--k)); }
.${P}-cae { position: absolute; display: inline-flex; align-items: center; justify-content: center; background: #fff; color: #5D6170; white-space: nowrap;
  box-shadow: 0 0 0 1px #E6E7EC, 0 2px 6px rgba(9,10,14,.06); transform-origin: 50% 50%; will-change: transform; }
.${P}-lluvia[data-cayendo] .${P}-cae { left: 0 !important; top: 0 !important; visibility: hidden; }
.${P}-lluvia[data-cayendo] .${P}-cae[data-vivo] { visibility: visible; }
.${P}-cae-pildora { height: 2.6em; padding: 0 .95em 0 .8em; gap: .45em; border-radius: .8em; font-size: 1em; font-weight: 500; letter-spacing: -0.1px; }
.${P}-cae-pildora svg { flex: none; width: 1.3em; height: 1.3em; color: #8A8E9B; }
.${P}-cae-pildora b { min-width: 1.6em; height: 1.6em; padding: 0 .45em; border-radius: 99px; background: #E5484D; color: #fff; font-size: .82em; font-weight: 600; display: inline-flex; align-items: center; justify-content: center; }
.${P}-cae-logo { width: 4.05em; height: 4.05em; border-radius: 1.05em; }
.${P}-cae-logo img { width: 2.45em; height: 2.45em; border-radius: .55em; display: block; }
.${P}-cae-carpeta { width: 7.3em; height: 7em; flex-direction: column; gap: .45em; border-radius: 1.1em; font-size: 1em; font-weight: 500; color: #4C505F; }
.${P}-cae-carpeta svg { width: 2.9em; height: 2.9em; color: var(--az); fill: rgba(47,111,237,.14); }
.${P}-cae-carpeta span { font-size: .9em; }

/* La órbita de la tarjeta «después», medida en su video cuadro a cuadro (14/11): anillo de 280 px al 22 % de blanco, etiquetas de 13 px
   en su caja #1C1D22 que dan un cuarto de vuelta horario cada 2 s (quietas 1,25 s, se mueven ,75 s) siempre derechas, y la esfera de
   140 px con sus baldosas y su logo encendido, que destella en cada paso. */
.${P}-orbita-caja { flex: 1; display: flex; align-items: center; justify-content: center; }
.${P}-orbita { position: relative; width: 400px; height: 400px; max-width: 100%; flex: none; }
.${P}-orbita-anillo { position: absolute; inset: 60px; border-radius: 50%; border: 1px solid rgba(255,255,255,.22); }
.${P}-orbita-centro { position: absolute; left: 50%; top: 50%; width: 140px; height: 140px; margin: -70px 0 0 -70px; border-radius: 50%; overflow: hidden;
  background: radial-gradient(circle at 50% 42%, #22242B 0%, #101116 58%, #07080B 100%); box-shadow: 0 0 0 1px rgba(255,255,255,.2), inset 0 0 26px rgba(0,0,0,.8), inset 0 10px 22px rgba(255,255,255,.07); }
.${P}-orbita-baldosas { position: absolute; left: 50%; top: 50%; width: 140px; height: 140px; margin: -70px 0 0 -70px; display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; padding: 2px;
  -webkit-mask-image: radial-gradient(circle, #000 52%, transparent 72%); mask-image: radial-gradient(circle, #000 52%, transparent 72%); }
.${P}-orbita-baldosas i { border-radius: 4px; background: rgba(255,255,255,.045); box-shadow: inset 0 0 0 1px rgba(255,255,255,.07); }
.${P}-orbita-baldosas i.${P}-baldosa-titila { animation: dcsTitila 4s ease-in-out infinite; }
.${P}-orbita-logo { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; animation: dcsDestello 2s ease-in-out infinite; }
.${P}-orbita-logo svg { filter: drop-shadow(0 0 6px rgba(255,255,255,.55)) drop-shadow(0 0 18px rgba(242,176,30,.35)); }
.${P}-orbita-giro { position: absolute; inset: 0; animation: dcsOrbita 8s infinite; }
.${P}-orbita-et { position: absolute; transform: translate(-50%, -50%); }
.${P}-orbita-et span { display: block; padding: 6px 16px; border-radius: 6px; background: #1C1D22; box-shadow: 0 0 0 1px rgba(255,255,255,.08); font-size: 13px; font-weight: 500; line-height: 18px; color: #fff; white-space: nowrap; animation: dcsOrbitaContra 8s infinite; }
.${P}-orbita-et-0 { left: 50%; top: 60px; }
.${P}-orbita-et-1 { left: 340px; top: 50%; }
.${P}-orbita-et-2 { left: 50%; top: 340px; }
.${P}-orbita-et-3 { left: 60px; top: 50%; }

/* ── Las secciones de producto: 128 px arriba, 40 abajo, 80 entre piezas ── */
.${P}-prod-in { padding: 128px 0 40px; display: flex; flex-direction: column; gap: 80px; }
.${P}-head-over { color: rgba(255,255,255,.36); }
.${P}-h2 { font-size: 44px; line-height: 53.76px; letter-spacing: -0.33px; color: #fff; text-wrap: balance; }
.${P}-head-p { max-width: 512px; font-size: 18px; line-height: 28px; letter-spacing: -0.26px; color: rgba(255,255,255,.68); text-wrap: balance; }

/* La fila: la tarjeta de 419 px y la figura, 640 px de alto, 16 de separación. */
.${P}-fila { position: relative; display: flex; gap: 16px; height: 640px; }
.${P}-radio { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
.${P}-fcard { position: relative; flex: 0 0 419px; padding: 32px; border-radius: 24px; box-shadow: 0 0 0 1px rgba(255,255,255,.1); display: flex; flex-direction: column; align-items: flex-start; gap: 32px; overflow: hidden; }
.${P}-fcard-head { position: relative; z-index: 1; display: flex; flex-direction: column; gap: 8px; }
.${P}-h3 { font-size: 36px; line-height: 44px; letter-spacing: -0.26px; color: #fff; }
.${P}-fcard-btns { position: relative; z-index: 1; display: flex; gap: 12px; }
.${P}-tabs { position: relative; z-index: 1; display: flex; flex-direction: column; gap: 6px; }
.${P}-tab { display: flex; align-items: center; gap: 6px; padding: 6px 20px 6px 6px; border-radius: 10px; font-size: 16px; font-weight: 500; line-height: 24px; letter-spacing: -0.18px; color: rgba(255,255,255,.44); cursor: pointer; transition: color .4s var(--ease); }
.${P}-tab svg { flex: none; }
.${P}-tab:hover { color: #fff; }
${CSS_PESTANAS}

/* El objeto en 3D de cada fila: la losa de vidrio y la pieza con el ícono, que flota. */
.${P}-obj { position: absolute; left: -14px; bottom: -48px; width: 320px; height: 320px; pointer-events: none; }
.${P}-obj-losa { position: absolute; left: 25px; top: 105px; width: 270px; height: 270px; border-radius: 34px; transform: rotateX(58deg) rotateZ(-45deg);
  background: linear-gradient(135deg, #2B2D35 0%, #121319 55%, #07080C 100%); box-shadow: inset 0 0 0 1px rgba(255,255,255,.14), inset 8px 8px 24px rgba(255,255,255,.06), 0 30px 50px rgba(0,0,0,.6); }
.${P}-obj-sombra { position: absolute; left: 70px; top: 150px; width: 180px; height: 180px; border-radius: 50%; filter: blur(30px); opacity: .55; transform: rotateX(58deg); }
/* Sus objetos en 3D son videos en bucle (cta-swipe-file.mov…), mirados cuadro a cuadro el 14/11: la pieza flota y la luz la recorre
   (de blanca a su color, unos 3 s ida y vuelta); la sombra de color respira con ella. Aquí, con su degradado corriéndose. */
.${P}-obj-pieza { position: absolute; left: 75px; top: 30px; width: 170px; height: 170px; animation: dcsFlota 3.2s ease-in-out infinite alternate; }
.${P}-obj-sombra { animation: dcsRespira 3.2s ease-in-out infinite alternate; }
.${P}-obj-cara { width: 100%; height: 100%; border-radius: 38px; display: flex; align-items: center; justify-content: center; color: #fff; transform: rotateX(28deg) rotateZ(-14deg);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.35), inset 0 -16px 30px rgba(0,0,0,.25), inset 0 14px 24px rgba(255,255,255,.35), 0 26px 40px rgba(0,0,0,.45);
  background-size: 220% 220% !important; animation: dcsLuz 3.2s ease-in-out infinite alternate; }
.${P}-obj-cara svg { filter: drop-shadow(0 4px 10px rgba(0,0,0,.25)); }
.${P}-tono-azul .${P}-obj-cara { background: linear-gradient(150deg, #A9C6FF 0%, #5B8DF5 32%, var(--az) 62%, #173F99 100%); }
.${P}-tono-azul .${P}-obj-sombra { background: var(--az); }
.${P}-tono-dorado .${P}-obj-cara { background: linear-gradient(150deg, #FFE3A0 0%, #F7C450 34%, var(--oro) 62%, #A8720F 100%); }
.${P}-tono-dorado .${P}-obj-sombra { background: var(--oro); }
.${P}-tono-plata .${P}-obj-cara { background: linear-gradient(150deg, #FFFFFF 0%, #D9DCE3 38%, #9EA3AE 70%, #5D626D 100%); color: #20232B; }
.${P}-tono-plata .${P}-obj-sombra { background: #C9CCD3; }

/* La figura: 6 % de blanco, 24 px de radio, el halo del color de la fila y la ventana de la app. */
.${P}-figura { position: relative; flex: 1; min-width: 0; border-radius: 24px; background: rgba(255,255,255,.06); overflow: hidden; display: flex; flex-direction: column; align-items: center; }
.${P}-figura-halo { position: absolute; inset: 0; pointer-events: none; }
.${P}-tono-azul .${P}-figura-halo { background: radial-gradient(70% 55% at 50% 0%, rgba(47,111,237,.55), transparent 72%), radial-gradient(60% 50% at 10% 100%, rgba(47,111,237,.38), transparent 70%), radial-gradient(40% 40% at 92% 60%, rgba(255,255,255,.10), transparent 70%); }
.${P}-tono-dorado .${P}-figura-halo { background: radial-gradient(70% 55% at 50% 0%, rgba(242,176,30,.42), transparent 72%), radial-gradient(55% 50% at 100% 100%, rgba(242,176,30,.30), transparent 70%), radial-gradient(40% 40% at 0% 50%, rgba(255,255,255,.06), transparent 70%); }
.${P}-tono-plata .${P}-figura-halo { background: radial-gradient(70% 55% at 50% 0%, rgba(255,255,255,.24), transparent 72%), radial-gradient(55% 50% at 0% 100%, rgba(47,111,237,.22), transparent 70%); }
.${P}-ventana { position: relative; z-index: 1; flex: none; align-self: stretch; margin: 40px 0 0 40px; border-radius: 14px 0 0 14px; overflow: hidden; background: #F7F8FA;
  box-shadow: 0 0 0 1px rgba(255,255,255,.14), 0 30px 60px rgba(0,0,0,.45); }
.${P}-leyendas { position: relative; z-index: 1; flex: 1; display: flex; align-items: center; justify-content: center; width: 100%; padding: 16px 40px 18px; }
.${P}-leyenda { display: none; max-width: 600px; text-align: center; font-size: 16px; font-weight: 500; line-height: 24px; letter-spacing: -0.18px; color: rgba(255,255,255,.84); text-wrap: balance; }
.${P}-leyenda strong { font-weight: 600; color: #fff; }

/* ── La banda de la extensión: 32 px de radio, anillo #171920, 40 de relleno, el ícono cortado al 50 % ── */
.${P}-banda { position: relative; display: flex; gap: 40px; padding: 40px; border-radius: 32px; box-shadow: 0 0 0 1px #171920; overflow: hidden; }
.${P}-banda-logo { position: absolute; left: -51px; top: 0; bottom: 0; width: 128px; display: flex; align-items: center; opacity: .5; }
.${P}-banda-logo span { width: 128px; height: 128px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: radial-gradient(circle at 35% 30%, #4A4D55, #17181D 70%); box-shadow: inset 0 0 0 10px #0D0E12, inset 0 0 0 12px rgba(255,255,255,.18); }
.${P}-banda-content { flex: 1; padding-left: 80px; display: flex; flex-direction: column; gap: 20px; }
.${P}-banda-title { max-width: 520px; display: flex; flex-direction: column; gap: 8px; }
.${P}-h4 { font-size: 28px; line-height: 36px; letter-spacing: -0.2px; color: #fff; text-wrap: balance; }
.${P}-banda-p { font-size: 16px; line-height: 24px; color: rgba(255,255,255,.68); }
.${P}-banda-pasos { display: flex; gap: 36px; }
.${P}-banda-pasos li { flex: 1; display: flex; align-items: flex-start; gap: 8px; }
.${P}-banda-n { flex: none; width: 24px; height: 24px; margin-top: 3px; border-radius: 50%; box-shadow: inset 0 0 0 1.5px rgba(255,255,255,.84); display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; color: #fff; }
.${P}-banda-pt { display: flex; flex-direction: column; gap: 2px; }
.${P}-banda-pt strong { font-size: 16px; font-weight: 500; line-height: 30px; letter-spacing: -0.18px; color: rgba(255,255,255,.84); }
.${P}-banda-pt span { font-size: 14px; line-height: 20px; letter-spacing: -0.09px; color: rgba(255,255,255,.52); }
.${P}-banda-cta { flex: none; display: flex; align-items: flex-end; justify-content: flex-end; }

/* ── El cierre: 108 px arriba, h2 de 44, párrafo de 18, el botón blanco y la escena ── */
.${P}-cierre { position: relative; overflow: hidden; }
.${P}-cierre-in { padding: 108px 0 0; display: flex; flex-direction: column; align-items: center; gap: 36px; }
.${P}-cierre-head { max-width: 960px; }
.${P}-cierre-p { max-width: 640px; }
.${P}-cierre-btns { display: flex; gap: 12px; }
.${P}-escena { position: relative; height: 660px; margin-top: 8px; display: flex; justify-content: center; align-items: flex-start; padding-top: 110px;
  background: radial-gradient(34% 40% at 50% 46%, rgba(255,255,255,.08), rgba(255,255,255,0) 70%), linear-gradient(180deg, transparent 58%, rgba(255,255,255,.035) 58%, rgba(255,255,255,.012) 78%, transparent 100%); }
.${P}-escena::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 200px; background: linear-gradient(0deg, var(--negro), rgba(2,3,8,0)); pointer-events: none; }
.${P}-laptop { width: 540px; display: flex; flex-direction: column; align-items: center; }
.${P}-laptop-pantalla { width: 100%; aspect-ratio: 16 / 10; padding: 10px; border-radius: 16px 16px 6px 6px; background: #17181D; box-shadow: 0 0 0 1px rgba(255,255,255,.08), 0 40px 80px rgba(0,0,0,.6); overflow: hidden; }
.${P}-pantalla-laptop { zoom: .52; width: 1000px; height: 610px; overflow: hidden; background: #F7F8FA; padding: 26px; border-radius: 10px; }
.${P}-laptop-base { width: 116%; height: 16px; border-radius: 2px 2px 14px 14px; background: linear-gradient(180deg, #4A4C53, #24252A 60%, #141519); box-shadow: 0 18px 30px rgba(0,0,0,.6); position: relative; }
.${P}-laptop-base::before { content: ''; position: absolute; left: 50%; top: 0; width: 110px; height: 6px; margin-left: -55px; border-radius: 0 0 8px 8px; background: #17181D; }

/* ── El pie: 40 px arriba y abajo, 1136 de ancho, 44 entre filas, los filetes al 16 % ── */
.${P}-pie { position: relative; padding: 40px 0; }
.${P}-pie-in { max-width: 1216px; margin: 0 auto; padding: 0 40px; }
.${P}-pie-block { padding-bottom: 60px; display: flex; flex-direction: column; gap: 44px; }
.${P}-pie-prods { display: flex; gap: 16px; }
.${P}-pie-prods li { flex: 1; min-width: 0; }
.${P}-pie-prod { display: flex; align-items: center; gap: 12px; padding: 8px 10px; border-radius: 12px; transition: background-color .2s; }
.${P}-pie-prod:hover { background: rgba(255,255,255,.04); }
.${P}-pie-prod-ic { flex: none; width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #fff;
  background: linear-gradient(150deg, #5B8DF5, var(--az) 55%, #173F99); box-shadow: inset 0 0 0 1px rgba(255,255,255,.25), inset 0 8px 14px rgba(255,255,255,.22); }
.${P}-pie-prods li:nth-child(2) .${P}-pie-prod-ic, .${P}-pie-prods li:nth-child(4) .${P}-pie-prod-ic { background: linear-gradient(150deg, #FFE3A0, var(--oro) 55%, #A8720F); color: #20232B; }
.${P}-pie-prod-t { display: flex; flex-direction: column; min-width: 0; }
.${P}-pie-prod-t span { font-size: 14px; line-height: 20px; letter-spacing: -0.09px; color: rgba(255,255,255,.72); }
.${P}-pie-prod-t strong { font-size: 16px; font-weight: 500; line-height: 24px; letter-spacing: -0.18px; color: #fff; }
.${P}-pie-div { height: 1px; background: rgba(255,255,255,.16); }
.${P}-pie-company { display: flex; align-items: center; gap: 60px; }
.${P}-pie-company .${P}-brand { padding: 0; }
.${P}-pie-links { display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px; }
.${P}-pie-cat { display: flex; flex-direction: column; gap: 10px; }
.${P}-pie-h { color: rgba(255,255,255,.92); }
.${P}-pie-cat ul { display: flex; flex-direction: column; gap: 4px; }
.${P}-pie-cat-funciones { grid-column: span 3; }
.${P}-pie-cat-funciones ul { display: grid; grid-template-columns: repeat(3, 1fr); grid-auto-flow: column; grid-template-rows: repeat(6, auto); gap: 4px 16px; }
.${P}-pie-cat a { display: inline-block; padding: 3px 0; font-size: 14px; line-height: 20px; letter-spacing: -0.09px; color: rgba(255,255,255,.68); transition: color .2s; }
.${P}-pie-cat a:hover { color: #fff; }
.${P}-pie-foot { display: flex; align-items: center; gap: 16px; }
.${P}-pie-foot p, .${P}-pie-foot a { padding: 4px 0; font-size: 14px; line-height: 20px; letter-spacing: -0.09px; color: rgba(255,255,255,.36); }
.${P}-pie-foot a { transition: color .2s; }
.${P}-pie-foot a:hover { color: rgba(255,255,255,.68); }

/* ── Las animaciones de entrada, sólo CSS (nada arranca invisible) ── */
@keyframes dcsOrbita { 0%, 15.6% { transform: rotate(0deg); } 25%, 40.6% { transform: rotate(90deg); } 50%, 65.6% { transform: rotate(180deg); } 75%, 90.6% { transform: rotate(270deg); } 100% { transform: rotate(360deg); } }
@keyframes dcsOrbitaContra { 0%, 15.6% { transform: rotate(0deg); } 25%, 40.6% { transform: rotate(-90deg); } 50%, 65.6% { transform: rotate(-180deg); } 75%, 90.6% { transform: rotate(-270deg); } 100% { transform: rotate(-360deg); } }
.${P}-orbita-giro, .${P}-orbita-et span { animation-timing-function: cubic-bezier(.65,0,.35,1); }
@keyframes dcsDestello { 0%, 58% { opacity: .9; transform: scale(1); filter: none; } 72% { opacity: 1; transform: scale(1.06); filter: brightness(1.5) drop-shadow(0 0 16px rgba(255,255,255,.9)); } 100% { opacity: .9; transform: scale(1); filter: none; } }
@keyframes dcsTitila { 0%, 70%, 100% { background: rgba(255,255,255,.045); } 82% { background: rgba(255,255,255,.34); } }
@keyframes dcsFlota { from { translate: 0 0; } to { translate: 0 -10px; } }
@keyframes dcsLuz { from { background-position: 0% 0%; } to { background-position: 100% 100%; } }
@keyframes dcsRespira { from { opacity: .35; } to { opacity: .7; } }
@media (prefers-reduced-motion: reduce) {
  .${P}-orbita-giro, .${P}-orbita-et span, .${P}-orbita-logo, .${P}-orbita-baldosas i, .${P}-obj-pieza, .${P}-obj-cara, .${P}-obj-sombra { animation: none !important; }
  .${P} * { transition: none !important; }
}

/* ── Tableta (≤ 991 px): las filas se apilan ── */
@media (max-width: 991px) {
  .${P}-nav-menu, .${P}-signin { display: none; }
  .${P}-burger { display: block; margin-left: 8px; }
  .${P}-mock-side { display: none; }
  .${P}-mock-panel { margin: 0; }
  .${P}-mock .mk-v-spy { zoom: 1; }
  .${P}-fila { flex-direction: column; height: auto; }
  .${P}-fcard { flex: none; }
  .${P}-fcard-head .${P}-h3 { max-width: 75%; }
  .${P}-obj { left: auto; right: -40px; top: -10px; bottom: auto; transform: scale(.6); transform-origin: top right; }
  .${P}-figura { height: auto; }
  .${P}-ventana { margin: 32px 0 0 32px; }
  .${P}-winning-grid { grid-template-columns: 1fr; max-width: 640px; }
  .${P}-banda { flex-direction: column; }
  .${P}-banda-cta { justify-content: flex-start; }
  .${P}-pie-links { grid-template-columns: repeat(4, 1fr); }
  .${P}-pie-cat-funciones { grid-column: span 3; }
  .${P}-pie-prods { flex-wrap: wrap; }
  .${P}-pie-prods li { flex: 0 0 calc(50% - 8px); }
}

/* ── Teléfono (≤ 767 px): los valores medidos a 390 ── */
@media (max-width: 767px) {
  .${P}-wrap { padding: 0 24px; }
  .${P}-nav { background: rgba(2,3,8,.94); }
  .${P}-nav-in { padding: 0 8px; }
  .${P}-nav-stack { padding: 12px 16px; }
  .${P}-nav-cta { display: none; }
  .${P}-burger { display: block; margin-left: auto; }
  .${P}-mock-side { display: flex; }
  .${P}-mock-panel { margin: 8px 6px 0 0; }
  .${P}-mock .mk-v-spy { zoom: 1.3; }
  .${P}-fcard-head .${P}-h3 { max-width: none; }
  .${P}-hero-in { padding-top: 64px; gap: 64px; }
  .${P}-hero-top { padding: 0 0 48px; align-items: stretch; }
  .${P}-h1 { font-size: 38px; line-height: 48px; letter-spacing: -0.285px; }
  .${P}-hero-cta .${P}-btn { width: 100%; }
  .${P}-hero-cta { width: 100%; }
  .${P}-puntos { flex-direction: column; align-items: center; gap: 0; }
  .${P}-punto { min-height: 0; padding: 8px 0; align-items: flex-start; }
  .${P}-punto svg { margin-top: 2px; }
  .${P}-mock { height: 195px; margin: 0 -16px; }
  .${P}-mock-app { width: 1264px; height: 659px; zoom: .296; inset: auto; }
  .${P}-mock-fade { height: 100px; }
  .${P}-blanco { border-radius: 16px; }
  .${P}-winning { padding: 48px 0; }
  .${P}-winning-grid { gap: 20px; }
  .${P}-wcard { height: auto; min-height: 357px; }
  .${P}-wcard h3 { font-size: 16px; line-height: 24px; letter-spacing: -0.23px; }
  .${P}-wcard-oscura { min-height: 420px; }
  /* Su órbita a 390 mide 7/10 de la de 1440 (el anillo de 196 px): la misma, más chica. */
  .${P}-orbita { zoom: .7; }
  .${P}-prod-in { padding: 128px 0 40px; gap: 64px; }
  .${P}-h2, .${P}-h2c { font-size: 36px; line-height: 48px; letter-spacing: -0.27px; }
  .${P}-h2c { line-height: 44px; letter-spacing: -0.26px; }
  .${P}-fila { gap: 16px; }
  .${P}-fcard { padding: 32px 24px; border-radius: 16px; gap: 24px; align-items: stretch; }
  .${P}-fcard-btns { display: grid; }
  .${P}-fcard-btns .${P}-btn { width: 100%; }
  .${P}-tab { padding-right: 6px; }
  .${P}-obj { left: auto; right: -50px; top: -6px; bottom: auto; transform: scale(.5); transform-origin: top right; }
  .${P}-figura { border-radius: 16px; }
  .${P}-ventana { margin: 16px 0 0 16px; border-radius: 10px 0 0 10px; }
  .${P}-leyendas { padding: 14px 18px 18px; }
  .${P}-leyenda { font-size: 15px; line-height: 22px; }
  .${P}-banda { padding: 32px 24px; border-radius: 16px; gap: 24px; }
  .${P}-banda-logo { left: auto; right: -40px; top: -30px; bottom: auto; width: 128px; height: 128px; }
  .${P}-banda-content { padding-left: 0; }
  .${P}-banda-title { max-width: 80%; }
  .${P}-banda-pasos { flex-direction: column; gap: 16px; }
  .${P}-banda-cta .${P}-btn { width: 100%; }
  .${P}-banda-cta { display: block; }
  .${P}-cierre-in { padding-top: 80px; align-items: stretch; }
  .${P}-cierre-btns .${P}-btn { width: 100%; }
  .${P}-escena { height: 290px; padding-top: 44px; }
  .${P}-laptop { width: 300px; }
  .${P}-laptop-pantalla { padding: 6px; border-radius: 10px 10px 4px 4px; }
  .${P}-pantalla-laptop { zoom: .288; }
  .${P}-laptop-base { height: 10px; }
  .${P}-pie { padding: 96px 0 40px; }
  .${P}-pie-in { padding: 0 24px; }
  .${P}-pie-block { gap: 40px; }
  .${P}-pie-prods { flex-direction: column; gap: 16px; }
  .${P}-pie-prods li { flex: none; }
  .${P}-pie-prod { padding: 4px 0; }
  .${P}-pie-links { grid-template-columns: 1fr 1fr; gap: 32px 16px; }
  .${P}-pie-cat { gap: 12px; }
  .${P}-pie-cat-funciones { grid-column: 1 / -1; }
  .${P}-pie-cat-funciones ul { grid-template-columns: 1fr 1fr; grid-template-rows: repeat(9, auto); }
  .${P}-pie-foot { flex-direction: column; gap: 12px; text-align: center; }
}
`;
