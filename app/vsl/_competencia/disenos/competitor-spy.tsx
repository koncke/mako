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
//   · En la tarjeta «antes», sus íconos de Slack, Drive y compañía: van chats, capturas y links sin marcas de nadie, con lo que
//     dice el texto («capturas sueltas en el chat, links que ya no abren»). En la órbita del «después», sus cuatro etapas: van las
//     cuatro piezas que guarda la ficha («su web, sus reels, sus videos y sus anuncios», del mismo texto).
//   · El pie de 5 productos lleva 5 funciones de MaKo que trabajan con lo que guarda Spy (Image, Web Generator, Offer,
//     Copywriting, Ads Analyst), y sus columnas, el resto de las funciones.
// Lo que quedó distinto: los textos de cada pestaña (en Foreplay cambian la imagen de la figura) van como leyenda abajo de la
// figura, donde la fila «Swipe File» pone su «Supported ad libraries»; la banda de la extensión, que Foreplay esconde en el
// teléfono, aquí se ve (lleva los tres pasos), y a la cabeza de «antes / después» le falta su párrafo (el bloque no tiene bajada).
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
const ICO_VIDEO = ['M15 10l4.553 -2.276a1 1 0 0 1 1.447 .894v6.764a1 1 0 0 1 -1.447 .894l-4.553 -2.276v-4z', 'M3 6m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z'];
const ICO_CARPETA = ['M5 4h4l3 3h7a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-11a2 2 0 0 1 2 -2'];

/** El montón de capturas, chats y links de la tarjeta «antes» (en la referencia, sus íconos de Slack, Drive y compañía). */
const MONTON: { t?: string; ic?: string[]; num?: string; x: number; y: number; r: number; solo?: boolean }[] = [
  { t: '#anuncios-competencia', ic: ['M5 9h14', 'M5 15h14', 'M11 4l-4 16', 'M17 4l-4 16'], num: '12', x: 4, y: 128, r: -9 },
  { t: '#ideas-de-anuncios', ic: ['M5 9h14', 'M5 15h14', 'M11 4l-4 16', 'M17 4l-4 16'], num: '4', x: 2, y: 168, r: -9 },
  { t: '¿Ese link todavía abre?', ic: ICO_CHAT, x: 3, y: 62, r: -4 },
  { t: 'El link ya no abre', ic: ICO_LINK_ROTO, x: 40, y: 30, r: -8 },
  { t: 'Captura (3).png', ic: ICO_IMG, x: 46, y: 100, r: -13 },
  { t: 'Grabación de pantalla', ic: ICO_VIDEO, x: 55, y: 160, r: 12 },
  { t: '¿Desde cuándo lo corre?', ic: ICO_CHAT, x: 54, y: 222, r: -7 },
  { ic: ICO_CARPETA, x: 33, y: 196, r: 10, solo: true },
  { ic: ICO_IMG, x: 74, y: 58, r: 14, solo: true },
  { ic: ICO_CHAT, x: 26, y: 10, r: -12, solo: true },
];

const ORBITA = ['Su web', 'Sus reels', 'Sus videos', 'Sus anuncios'];

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
                <div className={`${P}-monton`} aria-hidden="true">
                  {MONTON.map((m, i) => (
                    <span key={i} className={`${P}-chip${m.solo ? ` ${P}-chip-solo` : ''}`} style={{ left: `${m.x}%`, top: m.y, transform: `rotate(${m.r}deg)`, animationDelay: `${(i * 0.12).toFixed(2)}s` }}>
                      <Icono d={m.ic} size={m.solo ? 22 : 14} grosor={1.7} />
                      {m.t ? <span>{m.t}</span> : null}
                      {m.num ? <b>{m.num}</b> : null}
                    </span>
                  ))}
                </div>
              </div>
              <div className={`${P}-wcard ${P}-wcard-oscura`}>
                <div className={`${P}-wcard-t`}>
                  <h3 dangerouslySetInnerHTML={html(b.con.titulo)} />
                  <p dangerouslySetInnerHTML={html(b.con.texto)} />
                </div>
                <div className={`${P}-orbita-caja`} aria-hidden="true">
                  <div className={`${P}-orbita`}>
                    <span className={`${P}-orbita-anillo`} />
                    <span className={`${P}-orbita-punto`} />
                    <span className={`${P}-orbita-centro`}><EstrellaMaKo size={54} /></span>
                    {ORBITA.map((t, i) => <span key={t} className={`${P}-orbita-et ${P}-orbita-et-${i}`}>{t}</span>)}
                  </div>
                </div>
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

/** Lo que la ventana de cada fila muestra del visual (en la referencia, la imagen de cada producto). */
const PARTE_DE_FILA = ['anuncios', 'ficha', 'todo', 'anuncios'] as const;
/** El color del halo y del objeto de cada fila (en la referencia, el color de cada producto). */
const TONO_DE_FILA = ['azul', 'dorado', 'plata', 'azul'] as const;

function Fila({ b, n, visual }: { b: De<'tarjetas'>; n: number; visual?: VisualHero }) {
  const nombre = `${P}-t${n}`;
  const tono = TONO_DE_FILA[n % TONO_DE_FILA.length];
  const parte = PARTE_DE_FILA[n % PARTE_DE_FILA.length];
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
      <div className={`${P}-figura`}>
        <div className={`${P}-figura-halo`} aria-hidden="true" />
        {visual ? (
          <div className={`${P}-ventana ${P}-ventana-${parte}`} aria-hidden="true">
            <div className={`${P}-pantalla ${P}-pantalla-${parte}`}><VisualDeLanding visual={visual} falta={`La pantalla de «${b.titulo.replace(/<[^>]+>/g, '')}» en Competitor Spy, tal cual es.`} /></div>
          </div>
        ) : null}
        <div className={`${P}-leyendas`}>
          {b.items.map((it, k) => (
            <p key={it.titulo} className={`${P}-leyenda ${P}-leyenda-${k}`}>
              <span className={`${P}-overline ${P}-leyenda-t`} dangerouslySetInnerHTML={html(it.titulo)} />
              <span className={`${P}-leyenda-x`} dangerouslySetInnerHTML={html(it.texto)} />
            </p>
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
        (actual ? actual.cuerpo : cabeza).push(<Fila key={i} b={b} n={filas} visual={visual} />);
        filas += 1;
        break;
      case 'pasos': (actual ? actual.cuerpo : cabeza).push(<Banda key={i} b={b} />); break;
      default: break;
    }
  });
  return (
    <div className={P}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
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
const PESTANAS = [0, 1, 2, 3];
const CSS_PESTANAS = PESTANAS.map((k) => `
.${P}-radio:nth-of-type(${k + 1}):checked ~ .${P}-fcard .${P}-tab-${k} { color: #fff; }
.${P}-radio:nth-of-type(${k + 1}):checked ~ .${P}-figura .${P}-leyenda-${k} { display: flex; }
.${P}-radio:nth-of-type(${k + 1}):focus-visible ~ .${P}-fcard .${P}-tab-${k} { outline: 2px solid rgba(255,255,255,.6); outline-offset: 2px; }`).join('');

const CSS = `
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

/* El montón de la tarjeta «antes»: chips blancos con su anillo, girados, que caen al entrar. */
.${P}-monton { position: absolute; left: 0; right: 0; bottom: 0; height: 290px; }
.${P}-chip { position: absolute; display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 9px; background: #fff; box-shadow: 0 0 0 1px #E9EAEF, 0 4px 12px rgba(9,10,14,.06); font-size: 12.5px; font-weight: 500; line-height: 16px; letter-spacing: -0.1px; color: #343642; white-space: nowrap; animation: dcsCae .9s var(--ease) both; }
.${P}-chip svg { flex: none; color: #4C505F; }
.${P}-chip b { margin-left: 2px; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 99px; background: #E5484D; color: #fff; font-size: 10.5px; font-weight: 600; display: inline-flex; align-items: center; justify-content: center; }
.${P}-chip-solo { width: 46px; height: 46px; padding: 0; justify-content: center; border-radius: 12px; }
.${P}-chip-solo svg { color: var(--az); }

/* La órbita de la tarjeta «después»: 400 × 400, el anillo, el centro que brilla y las cuatro etiquetas. */
.${P}-orbita-caja { flex: 1; display: flex; align-items: center; justify-content: center; }
.${P}-orbita { position: relative; width: 400px; height: 400px; max-width: 100%; aspect-ratio: 1; }
.${P}-orbita-anillo { position: absolute; inset: 60px; border-radius: 50%; border: 1px solid rgba(255,255,255,.28); }
.${P}-orbita-punto { position: absolute; inset: 60px; border-radius: 50%; animation: dcsGira 14s linear infinite; }
.${P}-orbita-punto::after { content: ''; position: absolute; top: -3px; left: 50%; width: 6px; height: 6px; margin-left: -3px; border-radius: 50%; background: #fff; box-shadow: 0 0 10px 2px rgba(242,176,30,.7); }
.${P}-orbita-centro { position: absolute; left: 50%; top: 50%; width: 140px; height: 140px; margin: -70px 0 0 -70px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  background: radial-gradient(circle at 50% 50%, rgba(242,176,30,.28), rgba(2,3,8,.0) 62%), #0B0C11; box-shadow: 0 0 0 1px rgba(255,255,255,.16), inset 0 0 40px rgba(255,255,255,.06); }
.${P}-orbita-centro svg { filter: drop-shadow(0 0 14px rgba(242,176,30,.75)); }
.${P}-orbita-et { position: absolute; padding: 6px 16px; border-radius: 6px; background: #1C1D22; box-shadow: 0 0 0 1px rgba(255,255,255,.08); font-size: 13px; font-weight: 500; line-height: 18px; color: #fff; white-space: nowrap; transform: translate(-50%, -50%); }
.${P}-orbita-et-0 { left: 50%; top: 60px; }
.${P}-orbita-et-1 { left: 88%; top: 57%; }
.${P}-orbita-et-2 { left: 42%; top: 340px; }
.${P}-orbita-et-3 { left: 12%; top: 41%; }

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
.${P}-obj-pieza { position: absolute; left: 75px; top: 30px; width: 170px; height: 170px; animation: dcsFlota 6s ease-in-out infinite; }
.${P}-obj-cara { width: 100%; height: 100%; border-radius: 38px; display: flex; align-items: center; justify-content: center; color: #fff; transform: rotateX(28deg) rotateZ(-14deg);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.35), inset 0 -16px 30px rgba(0,0,0,.25), inset 0 14px 24px rgba(255,255,255,.35), 0 26px 40px rgba(0,0,0,.45); }
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
.${P}-figura-pill { position: relative; z-index: 1; margin-top: 18px; display: inline-flex; align-items: center; gap: 10px; padding: 9px 18px; border-radius: 12px; background: rgba(255,255,255,.08); box-shadow: 0 0 0 1px rgba(255,255,255,.08); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); font-size: 16px; font-weight: 500; line-height: 24px; color: #fff; }
.${P}-ventana { position: relative; z-index: 1; flex: 0 1 auto; min-height: 0; width: calc(100% - 124px); margin-top: 84px; border-radius: 14px; border: 6px solid #15161B; background: #F7F8FA; box-shadow: 0 30px 60px rgba(0,0,0,.45); overflow: hidden; }
.${P}-figura-pill + .${P}-ventana { margin-top: 26px; }
.${P}-ventana .${P}-pantalla { padding: 18px; }
.${P}-ventana-ficha { width: min(600px, calc(100% - 124px)); }
.${P}-pantalla-ficha .mk-v-spy { zoom: 1.35; }
.${P}-leyendas { position: relative; z-index: 1; flex: none; margin-top: auto; width: 100%; padding: 28px 40px 30px; }
.${P}-leyenda { display: none; flex-direction: column; align-items: center; gap: 10px; text-align: center; }
.${P}-leyenda-t { color: rgba(255,255,255,.84); }
.${P}-leyenda-x { max-width: 560px; font-size: 16px; font-weight: 500; line-height: 24px; letter-spacing: -0.18px; color: #fff; text-wrap: balance; }
.${P}-leyenda-x strong { font-weight: 600; }

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
@keyframes dcsCae { from { translate: 0 -14px; } to { translate: 0 0; } }
@keyframes dcsGira { to { transform: rotate(360deg); } }
@keyframes dcsFlota { 0%, 100% { translate: 0 0; } 50% { translate: 0 -8px; } }
@media (prefers-reduced-motion: reduce) {
  .${P}-chip, .${P}-orbita-punto, .${P}-obj-pieza { animation: none; }
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
  .${P}-figura { height: 560px; }
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
  .${P}-monton { position: relative; height: 230px; margin: 0 -24px -24px; zoom: .8; }
  .${P}-chip { font-size: 11.5px; padding: 5px 8px; }
  .${P}-chip-solo { width: 40px; height: 40px; }
  .${P}-wcard-oscura { min-height: 420px; }
  .${P}-orbita { width: 280px; height: 280px; }
  .${P}-orbita-anillo, .${P}-orbita-punto { inset: 42px; }
  .${P}-orbita-centro { width: 100px; height: 100px; margin: -50px 0 0 -50px; }
  .${P}-orbita-centro svg { width: 40px; height: 40px; }
  .${P}-orbita-et { font-size: 11px; padding: 4px 12px; }
  .${P}-orbita-et-0 { top: 42px; }
  .${P}-orbita-et-2 { top: 238px; }
  .${P}-prod-in { padding: 128px 0 40px; gap: 64px; }
  .${P}-h2, .${P}-h2c { font-size: 36px; line-height: 48px; letter-spacing: -0.27px; }
  .${P}-h2c { line-height: 44px; letter-spacing: -0.26px; }
  .${P}-fila { gap: 16px; }
  .${P}-fcard { padding: 32px 24px; border-radius: 16px; gap: 24px; align-items: stretch; }
  .${P}-fcard-btns { display: grid; }
  .${P}-fcard-btns .${P}-btn { width: 100%; }
  .${P}-tab { padding-right: 6px; }
  .${P}-obj { left: auto; right: -50px; top: -6px; bottom: auto; transform: scale(.5); transform-origin: top right; }
  .${P}-figura { height: auto; max-height: 420px; border-radius: 16px; }
  .${P}-figura-pill { margin-top: 12px; padding: 6px 12px; font-size: 13px; line-height: 18px; zoom: .9; }
  .${P}-ventana { width: calc(100% - 32px); margin-top: 24px; border-width: 4px; border-radius: 10px; }
  .${P}-figura-pill + .${P}-ventana { margin-top: 14px; }
  .${P}-ventana .${P}-pantalla { width: 640px; zoom: .46; padding: 20px; }
  .${P}-ventana-ficha .${P}-pantalla { width: 520px; zoom: .55; }
  .${P}-leyendas { padding: 18px 20px 22px; }
  .${P}-leyenda-x { font-size: 15px; line-height: 22px; }
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
