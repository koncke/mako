// =============================================================================
// /vsl/crm con el DISEÑO de la portada de GoHighLevel (https://www.gohighlevel.com/), copiado el 11/11/2026; relevo FIEL el 14/11/2026
// =============================================================================
// Medida con Chromium a 1440 y a 390 px el 11/11 y otra vez el 14/11/2026 con video del scroll, `getAnimations()` en cada paso,
// MutationObserver e IntersectionObserver, los hovers con su tiempo y su CSS propio, que viene DENTRO del HTML (los valores, en
// docs/diseno/landings-competencia/crm.md; el relevo con capturas y videos, en la carpeta de notas de la sesión, referencias-landings/crm/).
//
// LO QUE SE MUEVE es lo de la referencia y nada más (medido: ninguna aparición al bajar; su CSS apaga las animaciones de entrada):
//   · su imagen del hero abre su video en una ventana (fondo cian al 40 %, video de 720 × 405 a 90 px de arriba, la × en la esquina):
//     aquí la grabación REAL del CRM (la de la portada, banco C:/dev/bancos-portada/banco-crm) abre el mini-VSL de Panda del CRM;
//   · los contadores suben en 2 s cuando se ven a la mitad, una sola vez;
//   · pasada la mitad del hero aparece ARRIBA su franja fija («Take your marketing to the next level!» con el botón amarillo de dos
//     renglones), que se prende con la opacidad en 0,5 s; aquí, debajo de la barra del sitio;
//   · las pestañas del ciclo cambian al tocarlas, sin animación, y al pasar el mouse se prende su brillo de color en 0,4 s; cada una
//     con su video en bucle (aquí, la grabación de esa parte en MaKo; «Cerrar», el recuadro de lo que falta);
//   · el botón oscuro cruza un brillo (`left` en 0,6 s) y el del hero brilla blanco;
//   · en el teléfono, los testimonios son un carrusel que avanza solo cada 3 s (0,3 s, se frena con el mouse), con sus puntos;
//   · la cinta de logos corre sola (40 px por segundo, como la suya: 66 s por vuelta de 2.646 px) con los bordes que se desvanecen;
//   · su popup de salida aparece una vez cuando el mouse sale por arriba de la ventana.
// Todo eso en un <script data-visor> (el visor de Martín borra los demás), con «menos movimiento» respetado. Sin JavaScript la página
// se lee entera: los números finales, la primera pestaña, la franja escondida.
//
// De MaKo: el logo, el azul #2F6FED donde GoHighLevel pone su cian, el dorado donde pone su amarillo, los textos, las PANTALLAS y el
// caso de Mauricio. Lo que NO va, y por qué:
//   · «We're in the business…» con sus premios, «Join the movement» (su comunidad), «Everything you need… even on the go» (su app),
//     «See Our Pricing» (sus precios), el robot y el testimonio de la caja de principios y su globo del chat: MaKo no tiene ese
//     contenido (ningún precio a mano; el caso de Mauricio no se suma en lugares nuevos).
//   · El formulario de dos pasos de su popup de salida: el popup va (cuando el mouse sale por arriba, una vez) con su título, su botón
//     azul a lo ancho y su frase chica; en MaKo se entra por /planes.
//   · La columna de precios de su tabla («Other tools $99/mo») y su total: sin precios.
// =============================================================================

import type { PropsDiseno } from '.';
import type { Bloque } from '../tipos';
import { RUTA_CTA, CASO, EstrellaMaKo, LogoMaKo, MAKO, TEXTO_CTA, TEXTO_CIERRE, html, otrasFunciones } from '../marca';
import { FEATURES } from '../../_detalle/features';
import { STACK_QUE_REEMPLAZA } from '../../_sitio/reemplaza';
import { AI_AVATAR_SE_VENDE } from '@/lib/planes-comparacion';
import { PRUEBA_DIAS, PRUEBA_GRATIS_PRENDIDA } from '@/lib/planes-mako';
import { FaltaAnimacion } from '../FaltaAnimacion';

const P = 'd-crm';
const S = '/vsl-assets/sitio';

/** El hero: la grabación del CRM de la portada (aprobada por Martín el 14/11/2026: el tablero, el arrastre y la ficha con todo el
 *  tracking), la MISMA toma grabada otra vez con el cuadro de la imagen de su hero (660 × 530: banco-crm/grabar-landing.mjs, 1200 × 964,
 *  `TAM=960:770 codificar-bucle.sh`); su póster es el PRIMER cuadro. Al tocarla se abre el mini-VSL de Panda del CRM, como su imagen
 *  abre su video. */
export const VIDEO_HERO_CRM = { video: '/vsl-assets/crm/ficha-hero.webm', poster: '/vsl-assets/crm/ficha-hero.jpg' } as const;
/** El mini-VSL del CRM (app/vsl/_detalle/features.ts → crm.videoEmbed), el de la landing anterior. */
const VSL_CRM = FEATURES.crm?.videoEmbed ?? '';

/** El video de cada pestaña del ciclo, EN EL ORDEN de las pestañas de ../crm.ts (Captar, Nutrir, Cerrar, Cobrar, Reactivar): la
 *  grabación REAL de esa parte (las de la portada; la difusión, del banco C:/dev/bancos-portada/banco-crm-difusion con la hoja REAL),
 *  o lo que falta grabar. Los pósters de Chats y de Cobranza son su PRIMER cuadro (los de la portada son cuadros del medio). */
export const VIDEOS_CICLO: readonly ({ video: string; poster: string; alt: string } | { falta: string })[] = [
  { video: `${S}/chats.webm`, poster: '/vsl-assets/crm/chats-poster.jpg', alt: 'Chats de MaKo: WhatsApp, Instagram, Messenger y email en una sola bandeja, y cada lead nuevo como «Lead entrante»' },
  { video: `${S}/automations.webm`, poster: `${S}/automations.jpg`, alt: 'Automations de MaKo: cuando el lead entra a «Reunión agendada», MaKo le confirma la reunión por WhatsApp' },
  { falta: 'La tarjeta del lead que pasa sola a «Agenda R1» cuando agenda, y la grabación de su reunión enganchada en su ficha' },
  { video: `${S}/cobranza.webm`, poster: '/vsl-assets/crm/cobranza-poster.jpg', alt: 'La ficha de un lead en MaKo: lo que debe, el plan de cuotas y «Cobrar la cuota 2»' },
  { video: '/vsl-assets/crm/difusion.webm', poster: '/vsl-assets/crm/difusion.jpg', alt: 'El CRM de MaKo: el «⋯» de la columna «Nutrición - No Agenda», «Mandar mensaje de difusión», a cuántos les llega por cada canal y el ritmo de envío, y el mensaje de WhatsApp escrito' },
];

/** Los colores de cada pestaña de su ciclo (Capture amarillo, Nurture azul, Close verde, Evangelize celeste, Reactivate crema): el
 *  amarillo pasa al dorado de MaKo y el azul al de MaKo. */
const COLORES_PESTANA = [MAKO.dorado, MAKO.azul, '#17D94B', '#6FCDFF', '#FFEEA3'];

/** Las filas de su tabla «What's included», de app/vsl/_sitio/reemplaza.ts (la comparación de la portada). AI Avatar no se vende
 *  todavía (lib/planes-comparacion.ts, `AI_AVATAR_SE_VENDE`); el setter con IA y la comunidad de Classroom son de MaKo Pro
 *  (lib/topes-plan.ts, `FUNCIONES_SOLO_PRO`: 'setter-ia', 'comunidad'). */
const SOLO_PRO = new Set(['Setter con IA', 'Cursos y comunidad']);
const FILAS_INCLUYE = STACK_QUE_REEMPLAZA.filter((t) => AI_AVATAR_SE_VENDE || t.landing !== 'ai-avatar');

/** El segundo renglón del botón de su franja fija («No obligation, cancel at any time»): lo que dice la prueba de MaKo. */
const FRANJA_CHICO = PRUEBA_GRATIS_PRENDIDA ? `${PRUEBA_DIAS} días gratis` : 'Eliges tu plan y entras';
/** El título de su popup de salida («Start Your 14 Day Free Trial Today!»), con lo que dice la prueba de MaKo. */
const TITULO_SALIDA = PRUEBA_GRATIS_PRENDIDA ? `¡Empieza hoy tus ${PRUEBA_DIAS} días gratis!` : '¡Empieza hoy con MaKo!';

/** Su × de las ventanas (un círculo negro con aro blanco, 28 px). */
const Cruz = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true"><circle cx="14" cy="14" r="12.5" fill="#111" stroke="#fff" strokeWidth="2" /><path d="M9.5 9.5l9 9M18.5 9.5l-9 9" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" /></svg>
);

type Tarjetas = Extract<Bloque, { tipo: 'tarjetas' }>;

function Ico({ paths, size = 24 }: { paths?: string[]; size?: number }) {
  if (!paths?.length) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths.map((d) => <path key={d} d={d} />)}
    </svg>
  );
}

/** Su tilde (Font Awesome «check-circle»), el de las listas y de los principios. */
function Tilde({ size = 14 }: { size?: number }) {
  return <svg className={`${P}-tilde`} width={size} height={size} viewBox="0 0 512 512" aria-hidden="true"><path fill="currentColor" d="M504 256c0 137-111 248-248 248S8 393 8 256 119 8 256 8s248 111 248 248zM227 387l184-184c6-6 6-16 0-22l-23-23c-6-6-16-6-22 0L216 308l-70-70c-6-6-16-6-22 0l-23 23c-6 6-6 16 0 22l104 104c6 6 16 6 22 0z" /></svg>;
}

/** La flecha de su botón del hero (en el cuadrito negro) y el «>» de sus botones oscuros. */
const Flecha = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="M13 6l6 6l-6 6" /></svg>;
const Chevron = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5l7 7l-7 7" /></svg>;
/** El rayo de su píldora del hero («Power up your business with AI»). */
const Rayo = () => <svg width="15" height="25" viewBox="0 0 15 25" aria-hidden="true"><path d="M9.6 0 0 14.2h6.1L4.6 25 15 9.9H8.7z" fill="#8FB3FA" /></svg>;
/** Sus comillas de los testimonios (40 × 30). */
const Comillas = () => <svg className={`${P}-comillas`} width="40" height="30" viewBox="0 0 40 30" aria-hidden="true"><path d="M0 30V17.6C0 7.9 4.5 2 13.2 0l1.6 4.1C10 5.6 7.8 9 7.6 14H15v16zm23 0V17.6C23 7.9 27.5 2 36.2 0l1.6 4.1C33 5.6 30.8 9 30.6 14H38v16z" fill="#fff" /></svg>;

/** Su botón oscuro (#011D38, 16px 40px, radio 10) con el brillo que cruza al pasar el mouse; `claro`: el blanco con borde. */
function BotonOscuro({ claro = false }: { claro?: boolean }) {
  return <a href={RUTA_CTA} data-tema-fijo="" className={`${P}-btn ${claro ? `${P}-btn-claro` : `${P}-btn-oscuro`}`}>{TEXTO_CTA}<Chevron /></a>;
}

function Hero({ b }: { b: Extract<Bloque, { tipo: 'hero' }> }) {
  return (
    // Fija en los dos modos: en el claro, el sol y la luna llevaba su degradado a gris claro y dejaba la letra blanca encima (el visor,
    // 14/11/2026). Como en GoHighLevel, el hero es oscuro siempre.
    <section className={`${P}-hero`} data-tema-fijo="">
      <div className={`${P}-hero-fila`}>
        <div className={`${P}-hero-txt`}>
          <p className={`${P}-pill`}><span className={`${P}-pill-ic`}><Rayo /></span>{b.etiqueta}</p>
          <h1 className={`${P}-h1`} dangerouslySetInnerHTML={html(b.titulo)} />
          <p className={`${P}-hero-p`} dangerouslySetInnerHTML={html(b.bajada)} />
          <a href={RUTA_CTA} data-tema-fijo="" className={`${P}-btn-hero`}>{TEXTO_CTA}<span className={`${P}-btn-hero-ic`}><Flecha /></span></a>
        </div>
        <div className={`${P}-hero-media`}>
          {/* Su imagen abre su video: un link a la ventana (sin JavaScript, la abre :target), con su play encima. */}
          <a href={`#${P}-vsl`} className={`${P}-hero-abre`} data-tema-fijo="" aria-label="Ver el video del CRM de MaKo">
            <video src={VIDEO_HERO_CRM.video} poster={VIDEO_HERO_CRM.poster} muted loop playsInline autoPlay preload="metadata"
              aria-label="Grabado en MaKo: el tablero del CRM, un lead que se pasa a «Agenda R1» y su ficha con todo lo que hizo: de dónde vino, cuánto vio del VSL, su mapa de calor, el video de su visita y cada clic" />
            <span className={`${P}-play`} aria-hidden="true"><svg width="26" height="26" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="#fff" /></svg></span>
          </a>
        </div>
      </div>
    </section>
  );
}

/** Lo que se cuenta: el número (sin puntos de miles), lo que va antes y lo que va después («1.400+» → 1400 y «+»). */
function partesDe(valor: string): { pre: string; n: number; suf: string } | null {
  const m = valor.match(/^([^0-9]*)([0-9][0-9.]*)(.*)$/);
  if (!m) return null;
  return { pre: m[1], n: Number(m[2].replace(/\./g, '')), suf: m[3] };
}

function Cifras({ b }: { b: Extract<Bloque, { tipo: 'cifras' }> }) {
  return (
    <>
      <div className={`${P}-contadores`} aria-label="En números">
        {b.items.map((c) => {
          const p = partesDe(c.valor);
          return (
            <div key={c.label} className={`${P}-contador`}>
              <span className={`${P}-contador-v ${P}-grad`} data-tema-fijo="" {...(p ? { 'data-fin': p.n, 'data-pre': p.pre, 'data-suf': p.suf } : {})}>{c.valor}</span>
              <span className={`${P}-contador-l`}>{c.label}</span>
            </div>
          );
        })}
      </div>
      {b.titulo ? (
        <section className={`${P}-sec ${P}-sec-cifras`}>
          <h2 className={`${P}-h2-30 ${P}-grad ${P}-centro`} dangerouslySetInnerHTML={html(b.titulo)} />
        </section>
      ) : null}
    </>
  );
}

function Ciclo({ b }: { b: Tarjetas }) {
  return (
    <section className={`${P}-sec ${P}-sec-ciclo`}>
      <div className={`${P}-enc-ciclo`}>
        <h2 className={`${P}-h2-40 ${P}-grad ${P}-centro`} dangerouslySetInnerHTML={html(b.titulo)} />
        {b.bajada ? <p className={`${P}-sub ${P}-centro`} dangerouslySetInnerHTML={html(b.bajada)} /> : null}
      </div>
      <div className={`${P}-tabs`}>
        {b.items.map((t, i) => <input key={t.titulo} type="radio" name={`${P}-ciclo`} id={`${P}-t${i}`} className={`${P}-radio ${P}-radio-${i}`} defaultChecked={i === 0} aria-label={t.meta ?? t.titulo} />)}
        <div className={`${P}-pills`} role="presentation">
          {b.items.map((t, i) => (
            <label key={t.titulo} htmlFor={`${P}-t${i}`} data-tema-fijo="" className={`${P}-pill-tab ${P}-pill-tab-${i}`} style={{ ['--c' as string]: COLORES_PESTANA[i % COLORES_PESTANA.length] }}>
              <span>{t.meta ?? t.titulo}</span>
            </label>
          ))}
        </div>
        {b.items.map((t, i) => {
          const v = VIDEOS_CICLO[i];
          return (
            <div key={t.titulo} className={`${P}-panel ${P}-pan-${i}`}>
              <div className={`${P}-panel-txt`}>
                <span className={`${P}-pan-ic`} data-tema-fijo="" style={{ ['--c' as string]: COLORES_PESTANA[i % COLORES_PESTANA.length] }}><Ico paths={t.icono} size={22} /></span>
                <h3 className={`${P}-h2-30 ${P}-grad`} dangerouslySetInnerHTML={html(t.titulo)} />
                <p className={`${P}-pan-p`} dangerouslySetInnerHTML={html(t.texto)} />
                {t.puntos?.length ? (
                  <ul className={`${P}-lista`}>
                    {t.puntos.map((x) => <li key={x}><Tilde />{x}</li>)}
                  </ul>
                ) : null}
                <BotonOscuro />
              </div>
              <div className={`${P}-panel-vis`}>
                {v && 'video' in v ? (
                  <video src={v.video} poster={v.poster} muted loop playsInline preload={i === 0 ? 'metadata' : 'none'} autoPlay={i === 0} aria-label={v.alt} data-tema-fijo="" />
                ) : v ? <FaltaAnimacion que={v.falta} /> : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Principios({ b }: { b: Tarjetas }) {
  return (
    <section className={`${P}-sec ${P}-sec-caja`}>
      <div className={`${P}-principios`} data-tema-fijo="">
        <h2 className={`${P}-principios-h`} dangerouslySetInnerHTML={html(b.titulo)} />
        <div className={`${P}-principios-cols`}>
          {b.items.map((t) => (
            <div key={t.titulo} className={`${P}-principio`}>
              <p className={`${P}-principio-t`}><Tilde size={16} /><span dangerouslySetInnerHTML={html(t.titulo)} /></p>
              <p className={`${P}-principio-x`} dangerouslySetInnerHTML={html(t.texto)} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** «What's included with HighLevel»: la caja con el degradado desde la esquina y su TABLA (trabajo · lo que reemplaza · MaKo). */
function Incluye({ b }: { b: Tarjetas }) {
  return (
    <section className={`${P}-sec ${P}-sec-caja`}>
      <div className={`${P}-incluye`} data-tema-fijo="">
        <h2 className={`${P}-h2-40 ${P}-grad-claro ${P}-centro`} dangerouslySetInnerHTML={html(b.titulo)} />
        <div className={`${P}-tabla`} role="table" aria-label="Lo que MaKo reemplaza, trabajo por trabajo">
          <div className={`${P}-tabla-cab`} role="row">
            <span role="columnheader">Trabajo</span>
            <span role="columnheader">Reemplaza</span>
            <span role="columnheader" className={`${P}-tabla-mako`}><span className={`${P}-tabla-estrella`}><EstrellaMaKo size={13} /></span>MaKo</span>
          </div>
          {FILAS_INCLUYE.map((t) => (
            <div key={t.trabajo} className={`${P}-tabla-fila`} role="row">
              <span role="cell" className={`${P}-tabla-trabajo`}>{t.trabajo}</span>
              <span role="cell" className={`${P}-tabla-apps`}>
                {t.apps.slice(0, 3).map((a) => (
                  <span key={a.nombre} className={`${P}-app`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.logo} alt="" width={16} height={16} loading="lazy" decoding="async" />{a.nombre}
                  </span>
                ))}
              </span>
              <span role="cell" className={`${P}-tabla-si`}>
                {SOLO_PRO.has(t.trabajo) ? <span className={`${P}-pro`}>Con MaKo Pro</span> : <span className={`${P}-incl`}><Tilde size={11} />Incluido</span>}
              </span>
            </div>
          ))}
        </div>
        <div className={`${P}-centro`}><BotonOscuro claro /></div>
      </div>
    </section>
  );
}

function BloqueTarjetas({ b, i }: { b: Tarjetas; i: number }) {
  // El orden de crm.ts: el ciclo (pestañas), los principios (la caja oscura) y lo que incluye (la caja con el degradado y su tabla).
  if (i === 0) return <Ciclo b={b} />;
  if (i === 1) return <Principios b={b} />;
  return <Incluye b={b} />;
}

function Autor() {
  return (
    <span className={`${P}-autor`}>
      <span className={`${P}-autor-av`} aria-hidden="true">M</span>
      <span className={`${P}-autor-n`}>{CASO.quien}</span>
    </span>
  );
}

/** «Discover More Success Stories!» con el caso de Mauricio: la banda oscura, la fila de tarjetas (en el teléfono, su carrusel que
 *  avanza solo, con sus puntos: radios, para que ande sin JavaScript) y la caja del cierre. */
function Caso() {
  const max = Math.max(...CASO.meses.map((m) => Number(m.monto.replace(/[^0-9]/g, ''))));
  const tarjetas = [null, ...CASO.historia, CASO.resultado];
  return (
    <>
      <section className={`${P}-casos`} data-tema-fijo="">
        <div className={`${P}-cont`}>
          <h2 className={`${P}-h2-40 ${P}-grad-claro ${P}-centro`} dangerouslySetInnerHTML={html(CASO.titulo)} />
          <div className={`${P}-carrusel`}>
            {tarjetas.map((_, i) => <input key={i} type="radio" name={`${P}-caso`} id={`${P}-c${i}`} className={`${P}-radio ${P}-crad-${i}`} defaultChecked={i === 0} aria-label={`Tarjeta ${i + 1} de ${tarjetas.length}`} />)}
            <div className={`${P}-casos-ventana`}>
              <div className={`${P}-casos-fila`}>
                {tarjetas.map((t, i) => (
                  <div key={i} className={`${P}-caso-borde`}>
                    {t === null ? (
                      <div className={`${P}-caso ${P}-caso-video`}>
                        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                        <video muted autoPlay loop playsInline preload="metadata" aria-label={`${CASO.quien}, en un escenario`}><source src={CASO.video} type="video/mp4" /></video>
                        <div className={`${P}-caso-pie`}><Autor /><span className={`${P}-caso-rol`}>{CASO.rol}</span></div>
                      </div>
                    ) : (
                      <div className={`${P}-caso`}>
                        <Comillas />
                        <p className={`${P}-caso-x`} dangerouslySetInnerHTML={html(t)} />
                        <Autor />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className={`${P}-puntos`}>
              {tarjetas.map((_, i) => <label key={i} htmlFor={`${P}-c${i}`} className={`${P}-punto ${P}-punto-${i}`} title={`Tarjeta ${i + 1}`} />)}
            </div>
          </div>
        </div>
      </section>
      <div className={`${P}-cierre-banda`}>
        <div className={`${P}-cierre`} data-tema-fijo="">
          <div className={`${P}-cierre-txt`}>
            <h2 className={`${P}-cierre-h`}>{CASO.sub}</h2>
            <BotonOscuro />
          </div>
          <div className={`${P}-cierre-vis`} aria-label="Lo que vendió Mauricio, mes a mes">
            {CASO.meses.map((m) => (
              <div key={m.mes} className={`${P}-mes`}>
                <span className={`${P}-mes-v`}>{m.monto}</span>
                <span className={`${P}-mes-barra`} style={{ height: `${Math.round((Number(m.monto.replace(/[^0-9]/g, '')) / max) * 100)}%` }} />
                <span className={`${P}-mes-l`}>{m.mes}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

/** «Integrates With Your Favorite Tools»: la cinta que corre sola, con los bordes que se desvanecen y que se frena con el mouse. */
function Logos({ b }: { b: Extract<Bloque, { tipo: 'logos' }> }) {
  return (
    <section className={`${P}-integra`}>
      <h2 className={`${P}-integra-h`} dangerouslySetInnerHTML={html(b.titulo)} />
      <div className={`${P}-cinta`}>
        <div className={`${P}-cinta-pista`}>
          {[0, 1, 2, 3].map((copia) => (
            <ul key={copia} className={`${P}-cinta-set`} aria-hidden={copia ? true : undefined}>
              {b.items.map((l) => (
                <li key={l.logo} title={copia ? undefined : l.nombre}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/vsl-assets/logos/${l.logo}`} alt={copia ? '' : l.nombre} width={50} height={50} loading="lazy" decoding="async" />
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pie({ slug }: { slug: string }) {
  const otras = otrasFunciones(slug);
  const porColumna = Math.ceil(otras.length / 3);
  const columnas = [0, 1, 2].map((c) => otras.slice(c * porColumna, (c + 1) * porColumna));
  return (
    <footer className={`${P}-pie`}>
      <div className={`${P}-pie-cols`}>
        {columnas.map((col, i) => (
          <nav key={i} className={`${P}-pie-col`} aria-label={i === 0 ? 'Funciones de MaKo' : undefined}>
            <p className={`${P}-pie-h`}>{i === 0 ? 'Funciones de MaKo' : '\u00a0'}</p>
            {col.map((f) => <a key={f.href} href={f.href} className={`${P}-pie-a`}>{f.nombre}</a>)}
          </nav>
        ))}
        <div className={`${P}-pie-col`}>
          <p className={`${P}-pie-h`}>Contacto</p>
          <a href={RUTA_CTA} className={`${P}-pie-a`}>{TEXTO_CTA}</a>
        </div>
      </div>
      <div className={`${P}-pie-base`}>
        <p>© 2026 MaKo</p>
        <p><a href="/privacidad">Privacidad</a> | <a href="/terminos">Términos</a></p>
      </div>
    </footer>
  );
}

export default function DisenoCrm({ landing }: PropsDiseno) {
  const bloques = landing.bloques;
  let nTarjetas = 0;
  return (
    <div className={P}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <header className={`${P}-barra`}>
        <div className={`${P}-barra-in`}>
          <LogoMaKo className={`${P}-logo`} tamano={34} claro />
          <div className={`${P}-barra-btns`}>
            <a href="/login" className={`${P}-btn-login`}>Entrar</a>
            <a href={RUTA_CTA} className={`${P}-btn-barra`}>{TEXTO_CTA}</a>
          </div>
        </div>
      </header>
      {bloques.map((b, i) => {
        switch (b.tipo) {
          case 'hero': return <Hero key={i} b={b} />;
          case 'cifras': return <Cifras key={i} b={b} />;
          case 'tarjetas': return <BloqueTarjetas key={i} b={b} i={nTarjetas++} />;
          case 'caso': return <Caso key={i} />;
          case 'logos': return <Logos key={i} b={b} />;
          default: return null;
        }
      })}
      <Pie slug={landing.slug} />
      {/* Su franja fija de arriba (la sección `.bottom-sticky`): aparece pasada la mitad del hero. */}
      <div className={`${P}-franja`} data-tema-fijo="" aria-hidden="true">
        <div className={`${P}-franja-in`}>
          <p className={`${P}-franja-t`}>¡Lleva tus ventas al siguiente nivel!</p>
          <a href={RUTA_CTA} className={`${P}-franja-btn`} tabIndex={-1}><b>{TEXTO_CTA}</b><span>{FRANJA_CHICO}</span></a>
        </div>
      </div>
      {/* La ventana del video del hero (su popup): el iframe recibe su src recién al abrirla (data-src). */}
      <div id={`${P}-vsl`} className={`${P}-pop`} role="dialog" aria-modal="true" aria-label="El CRM de MaKo, en video">
        <a href="#" className={`${P}-pop-fondo`} aria-label="Cerrar el video" tabIndex={-1} />
        <div className={`${P}-pop-caja`} data-tema-fijo="">
          <iframe className={`${P}-pop-video`} data-src={VSL_CRM} title="El CRM de MaKo, en video" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
          <a href="#" className={`${P}-pop-x`} aria-label="Cerrar el video"><Cruz /></a>
        </div>
      </div>
      {/* Su popup de salida («Start Your 14 Day Free Trial Today!», cuando el mouse sale por arriba, una vez): aquí sin su formulario de
          dos pasos (en MaKo se entra por /planes), con su botón azul a lo ancho y la frase chica de abajo. */}
      <div id={`${P}-salida`} className={`${P}-pop ${P}-pop-salida`} role="dialog" aria-modal="true" aria-label={TITULO_SALIDA}>
        <a href="#" className={`${P}-pop-fondo ${P}-pop-fondo-negro`} aria-label="Cerrar" tabIndex={-1} />
        <div className={`${P}-salida-caja`} data-tema-fijo="">
          <p className={`${P}-salida-h`}>{TITULO_SALIDA}</p>
          <a href={RUTA_CTA} className={`${P}-salida-btn`}>{TEXTO_CTA}</a>
          <p className={`${P}-salida-chico`}>{TEXTO_CIERRE}</p>
          <a href="#" className={`${P}-pop-x`} aria-label="Cerrar"><Cruz /></a>
        </div>
      </div>
      <script data-visor="" dangerouslySetInnerHTML={{ __html: SCRIPT }} />
    </div>
  );
}

// Los valores, de getComputedStyle y de su CSS propio sobre https://www.gohighlevel.com/ a 1440 y 390 (docs/diseno/landings-competencia/crm.md).
const CSS = `
@font-face { font-family: 'Poppins'; font-style: normal; font-weight: 400; font-display: swap; src: url('/vsl-assets/fuentes/poppins/poppins-400.woff2') format('woff2'); }
@font-face { font-family: 'Poppins'; font-style: normal; font-weight: 500; font-display: swap; src: url('/vsl-assets/fuentes/poppins/poppins-500.woff2') format('woff2'); }
@font-face { font-family: 'Poppins'; font-style: normal; font-weight: 600; font-display: swap; src: url('/vsl-assets/fuentes/poppins/poppins-600.woff2') format('woff2'); }
@font-face { font-family: 'Poppins'; font-style: normal; font-weight: 700; font-display: swap; src: url('/vsl-assets/fuentes/poppins/poppins-700.woff2') format('woff2'); }

.${P} { background: #fff; color: #000; font-family: 'Poppins', Arial, sans-serif; font-size: 16px; line-height: 1.3; -webkit-font-smoothing: antialiased; overflow-x: clip; }
.${P} *, .${P} *::before, .${P} *::after { box-sizing: border-box; }
.${P} a { color: inherit; }
.${P}-cont { width: 100%; max-width: 1170px; margin: 0 auto; padding: 0 10px; }
.${P}-centro { text-align: center; }
.${P}-grad { background-image: linear-gradient(90deg, #03101D 0.13%, #958D8D 109.5%); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: #03101D; }
.${P}-grad-claro { background-image: linear-gradient(90deg, #FFFFFF 0.13%, #958D8D 109.5%); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: #fff; }
.${P}-h2-40 { margin: 0; font-size: 40px; line-height: 52px; font-weight: 700; }
.${P}-h2-30 { margin: 0; font-size: 30px; line-height: 39px; font-weight: 700; }
.${P}-sub { margin: 10px auto 0; font-size: 16px; line-height: 20.8px; color: #575757; max-width: 760px; }
.${P}-sub strong, .${P}-pan-p strong { color: #03101D; font-weight: 600; }
.${P}-radio { position: absolute; opacity: 0; width: 1px; height: 1px; pointer-events: none; }

/* La barra: #03101C, 146 de alto, el logo a la izquierda y dos botones de 40 de alto, radio 10, que suben 2 px con su sombra al pasar el
   mouse (glow-button, 0,3 s). En producción la tapa la barra del sitio (BARRA_PROPIA). */
.${P}-barra { background: #03101C; padding: 50px 0 0; height: 146px; }
.${P}-barra-in { max-width: 1170px; margin: 0 auto; padding: 0 20px 0 10px; display: flex; align-items: center; justify-content: space-between; gap: 16px; height: 40px; }
.${P}-logo span:last-child { font-family: 'Poppins', Arial, sans-serif; }
.${P}-barra-btns { display: flex; gap: 20px; }
.${P}-btn-login, .${P}-btn-barra { display: inline-flex; align-items: center; height: 40px; border-radius: 10px; font-size: 14px; font-weight: 600; text-decoration: none; transition: all .3s cubic-bezier(0.4, 0, 0.2, 1); }
.${P}-btn-login { padding: 10px 32px; color: #fff !important; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.19); }
.${P}-btn-barra { padding: 10px 20px; color: #fff !important; background: ${MAKO.azul}; border: 1px solid ${MAKO.azul}; }
.${P}-btn-login:hover, .${P}-btn-barra:hover { transform: translateY(-2px); box-shadow: rgba(47,111,237,.19) 0 20px 25px -5px, rgba(47,111,237,.19) 0 10px 10px -5px; }

/* El hero: su degradado de 0deg (azul noche arriba, el celeste y el blanco abajo), con los azules de MaKo; 10 + 40 arriba y 230 abajo.
   Su fila partida (.split-layout-row, 612 de alto): el texto en una columna de la mitad (523 px de 140 a 663) y la imagen de 713 × 572
   hasta el borde derecho, con sus esquinas izquierdas de 10. */
.${P}-hero { background-image: linear-gradient(0deg, rgba(255,255,255,0) 11.84%, #A9C4F8 27.88%, ${MAKO.azul} 36.97%, ${MAKO.azulOscuro} 47.01%, #01264C 56.81%, #01162A 69.88%, #03101D 76.79%); padding: 50px 0 230px; }
.${P}-hero-fila { display: flex; align-items: center; min-height: 612px; padding: 10px 0 10px 5px; }
.${P}-hero-txt { flex: 0 0 50%; min-width: 0; padding: 10px 60px 10px max(20px, calc((100vw - 1170px) / 2)); display: flex; flex-direction: column; align-items: flex-start; }
.${P}-pill { margin: 0 0 20px; display: inline-flex; align-items: center; position: relative; padding: 10px 20px 10px 40px; border-radius: 75px; border: 1px solid #8FB3FA; background: rgba(250,250,250,.07); color: #fff; font-size: 14px; font-weight: 500; line-height: 18.2px; }
.${P}-pill-ic { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); display: flex; }
.${P}-pill-ic svg { width: 15px; height: 25px; }
.${P}-h1 { margin: 0 0 20px; font-size: 48px; line-height: 57.6px; font-weight: 700; color: #fff; }
.${P}-hero-p { margin: 0; font-size: 16px; line-height: 20.8px; color: #fff; }
.${P}-hero-p strong { font-weight: 600; }
/* Su botón del hero (277 × 45): el degradado de 91deg (su cian → blanco: aquí un azul claro de MaKo, para que la letra oscura se lea),
   letra #021221, el cuadrito negro con la flecha, y al pasar el mouse SÓLO su brillo blanco 0 0 20px 5px (medido: no sube). */
.${P}-btn-hero { margin: 40px 0 20px; display: inline-flex; align-items: center; gap: 30px; padding: 10px 20px 10px 35px; min-height: 45px; border-radius: 10px; background: linear-gradient(91deg, #8FB3FA 1.1%, #FFFFFF 105.74%); color: #021221 !important; white-space: nowrap; font-size: 16px; font-weight: 600; line-height: 1; text-decoration: none; transition: all .3s cubic-bezier(0.4, 0, 0.2, 1); }
.${P}-btn-hero:hover { box-shadow: 0 0 20px 5px rgba(255,255,255,.57); }
.${P}-btn-hero-ic { width: 30px; height: 25px; border-radius: 5px; background: #000; color: #fff; display: inline-flex; align-items: center; justify-content: center; }
.${P}-hero-media { flex: 1 1 0; min-width: 0; padding: 10px 0 10px 5px; display: flex; align-items: center; }
.${P}-hero-abre { position: relative; display: block; width: 100%; aspect-ratio: 660 / 530; border-radius: 10px 0 0 10px; overflow: hidden; background: #0B0D12; cursor: pointer;
  -webkit-mask-image: linear-gradient(180deg, #000 74%, transparent 100%); mask-image: linear-gradient(180deg, #000 74%, transparent 100%); }
.${P}-hero-abre video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
/* El play de su imagen: el círculo de su color (#1FB9E6 → el azul de MaKo), al medio. */
.${P}-play { position: absolute; left: 50%; top: 50%; width: 64px; height: 64px; margin: -32px 0 0 -32px; border-radius: 50%; background: rgba(47,111,237,.92); box-shadow: 0 8px 30px rgba(3,16,29,.35); display: flex; align-items: center; justify-content: center; padding-left: 3px; }

/* Los contadores: 161 px por encima del final del hero; tarjetas de 269 × 124, fondo blanco al 31 %, radio 15, sombra 0 0 5,08px,
   2rem 1rem; el número de 30/36 con el degradado y el rótulo de 14 en mayúsculas. Suben en 2 s (ease-out cuártico, medido). */
.${P}-contadores { position: relative; max-width: 1170px; margin: -161px auto 0; padding: 0 10px; display: flex; justify-content: center; gap: 25px; }
.${P}-contador { flex: 0 1 269px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px 16px; min-height: 124px; border-radius: 15px; background: rgba(255,255,255,.31); box-shadow: rgba(0,0,0,.25) 0 0 5.08px 0; text-align: center; }
.${P}-contador-v { font-size: 30px; line-height: 36px; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
/* Las cifras, fijas: oscuras en el claro y blancas en el oscuro (con el degradado de la referencia, en oscuro casi no se leían). */
html[data-sitio-modo="oscuro"] .${P}-contador-v { background-image: linear-gradient(90deg, #FFFFFF 0%, #AFC6F7 110%); color: #fff; }
/* En oscuro la tarjeta blanca al 31 % cae sobre el brillo azul del hero: letra blanca sobre celeste. Vidrio oscuro (14/11). */
html[data-sitio-modo="oscuro"] .${P}-contador { background: rgba(6,12,30,.62); box-shadow: inset 0 0 0 1px rgba(255,255,255,.14); }
.${P}-contador-l { margin-top: 8px; font-size: 14px; line-height: 1.2; color: #03101C; text-transform: uppercase; }

/* Secciones */
.${P}-sec { padding: 20px 10px 60px; }
.${P}-sec-cifras { padding: 79px 10px 60px; }
.${P}-sec-cifras h2 { max-width: 1150px; margin: 0 auto; }
.${P}-sec-ciclo { padding: 20px 10px 60px; }
.${P}-enc-ciclo { max-width: 565px; margin: 0 auto; padding: 30px 0 0; }
.${P}-enc-ciclo .${P}-sub { max-width: 565px; }

/* Las pestañas del ciclo: 140 × 41, gris, radio 5, 20 px entre ellas; la elegida y la del mouse, con el degradado y el brillo de su color
   (::before, opacidad en 0,4 s). Cambian al tocarlas, SIN animación (su script pone display: block / none). */
.${P}-tabs { max-width: 1170px; margin: 0 auto; }
.${P}-pills { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px 20px; margin: 40px 0; }
.${P}-pill-tab { position: relative; isolation: isolate; width: 140px; height: 41px; padding: 7px 20px; display: inline-flex; align-items: center; justify-content: center; border-radius: 5px; background: rgba(237,237,237,.53); border: 1px solid #ECECEC; color: #03101D; font-size: 14px; font-weight: 600; cursor: pointer; transition: all .4s ease; }
.${P}-pill-tab::before { content: ''; position: absolute; inset: -1px; z-index: -1; border-radius: inherit; border: 1px solid var(--c); background: linear-gradient(89deg, var(--c) -17.03%, #FFFFFF 119.64%); box-shadow: 0 0 30px color-mix(in srgb, var(--c) 60%, transparent); opacity: 0; transition: opacity .4s ease; }
.${P}-pill-tab:hover::before { opacity: 1; }
.${P}-panel { display: none; }
${[0, 1, 2, 3, 4].map((i) => `#${P}-t${i}:checked ~ .${P}-pills .${P}-pill-tab-${i}::before { opacity: 1; }
#${P}-t${i}:checked ~ .${P}-pan-${i} { display: grid; }
#${P}-t${i}:focus-visible ~ .${P}-pills .${P}-pill-tab-${i} { outline: 2px solid ${MAKO.azul}; outline-offset: 3px; }
html[data-sitio-modo="oscuro"] #${P}-t${i}:checked ~ .${P}-pills .${P}-pill-tab-${i} { color: #03101D; }`).join('\n')}
/* Las pestañas son fijas (el sol y la luna congela la elegida al cargar): su oscuro va escrito; la elegida y la del mouse, con su
   degradado claro, siguen con la letra oscura. */
html[data-sitio-modo="oscuro"] .${P}-pill-tab { background: #1C212C; border-color: #353B47; color: #E6E8EE; }
html[data-sitio-modo="oscuro"] .${P}-pill-tab:hover { color: #03101D; }

/* El panel: caja #F6F6F6 de 1170 × 571, radio 25, borde 1 px, 20px 40px; dos columnas iguales: el texto (10 10 10 5) y el video de
   519 px de ancho, al medio (10 5 10 20). */
.${P}-panel { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: center; padding: 20px 40px; min-height: 571px; border-radius: 25px; background: #F6F6F6; border: 1px solid #EFEFEF; }
.${P}-panel-txt { padding: 10px 10px 10px 5px; }
/* Su ícono de 50 × 50: el círculo del color de la pestaña con el dibujo oscuro. */
.${P}-pan-ic { width: 50px; height: 50px; margin-left: 10px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #03101D; background: var(--c); }
.${P}-panel h3 { margin: 10px 0 20px; padding-left: 10px; }
.${P}-pan-p { margin: 0; padding-left: 10px; font-size: 16px; line-height: 20.8px; color: #575757; }
/* Su lista: dos columnas de 14/21 #575757, el tilde negro de 16 px y 7 px hasta el texto. */
.${P}-lista { list-style: none; margin: 25px 0 0; padding: 0 0 0 10px; columns: 2; column-gap: 20px; }
.${P}-lista li { break-inside: avoid; position: relative; padding-left: 23px; font-size: 14px; line-height: 21px; color: #575757; }
.${P}-lista .${P}-tilde { position: absolute; left: 0; top: 2.5px; width: 16px; height: 16px; color: #03101D; }
.${P}-panel-txt .${P}-btn { margin: 35px 0 0 10px; }
.${P}-panel-vis { padding: 10px 5px 10px 20px; }
.${P}-panel-vis video { display: block; width: 100%; aspect-ratio: 16 / 10; border-radius: 12px; object-fit: cover; background: #fff; }

/* Los botones de bloque: su #011D38 (16px 40px, radio 10, 16px 600, 59 de alto) con el «>»; al pasar el mouse el brillo que cruza (left
   -80 % → 120 %, 0,6 s) y la sombra 0 0 10px 2px #6bb2ff78. El claro: blanco con el borde oscuro y el brillo azul (su btn-hover2). */
.${P}-btn { position: relative; overflow: hidden; display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 16px 40px; white-space: nowrap; border-radius: 10px; font-size: 16px; line-height: 25px; font-weight: 600; text-decoration: none; transition: all .3s; }
.${P}-btn::after { content: ''; position: absolute; top: 0; left: -80%; width: 70%; height: 100%; background: linear-gradient(120deg, rgba(255,255,255,0), rgba(255,255,255,.65), rgba(255,255,255,0)); transform: skewX(-20deg); transition: .6s ease; }
.${P}-btn:hover::after { left: 120%; }
.${P}-btn:hover { box-shadow: 0 0 10px 2px rgba(107,178,255,.47); }
.${P}-btn-oscuro { background: #011D38; border: 1px solid #011D38; color: #fff !important; }
.${P}-btn-claro { background: #fff; border: 1px solid #011D38; color: #021221 !important; }
.${P}-btn-claro::after { background: linear-gradient(120deg, rgba(5,133,252,.05), rgba(5,133,252,.34), rgba(9,134,253,.05)); }

/* Los principios: caja de 1170, radio 50, borde 1 px, 60px 40px; su imagen de fondo (azul noche arriba, el brillo azul y el blanco abajo,
   donde va su robot) en degradados. Título blanco de 30 (600) en 1038 px; tres columnas de 267 con el tilde, separadas por una raya. */
.${P}-sec-caja { padding: 20px 10px 60px; }
.${P}-principios { max-width: 1170px; margin: 0 auto; padding: 81px 40px 190px; border-radius: 50px; border: 1px solid #DEDEDE; color: #fff;
  background: radial-gradient(62% 60% at 50% 104%, #FFFFFF 0%, #DCE8FD 16%, #7FA6F5 34%, ${MAKO.azul} 52%, rgba(31,87,200,0) 82%), linear-gradient(180deg, #03101D 0%, #03101D 46%, #06224D 100%); }
.${P}-principios-h { margin: 0 auto 54px; max-width: 1038px; text-align: center; font-size: 30px; line-height: 39px; font-weight: 600; }
.${P}-principios-cols { display: grid; grid-template-columns: 323fr 381fr 324fr; max-width: 1028px; margin: 0 auto; }
.${P}-principio { padding: 12px 56px 12px 57px; border-left: 1px solid rgba(255,255,255,.22); }
.${P}-principio:first-child { border-left: 0; padding-left: 0; }
.${P}-principio:last-child { padding-right: 0; }
.${P}-principio-t { margin: 0 0 10px; display: flex; align-items: center; gap: 6px; font-size: 16px; line-height: 20.8px; font-weight: 600; text-transform: uppercase; }
.${P}-principio-t .${P}-tilde { flex: none; color: #fff; }
.${P}-principio-x { margin: 0; font-size: 15px; line-height: 19.5px; }
.${P}-principio-x strong { font-weight: 600; }

/* Lo que incluye: su caja con el degradado radial desde la esquina (blanco, celeste, azul, noche), radio 25, y su tabla clara de radio 20. */
.${P}-incluye { max-width: 1160px; margin: 0 auto; padding: 60px 20px 60px; border-radius: 25px; background-color: #03101D;
  background-image: radial-gradient(98.6% 67.41% at -6.16% -45.46%, #FFFFFF 36.98%, #C9DAFB 50.43%, ${MAKO.azul} 65.68%, ${MAKO.azulOscuro} 76.55%, #01264C 88.57%, #03101D 100%); }
.${P}-tabla { max-width: 872px; margin: 40px auto 50px; padding: 30px 30px 26px; border-radius: 20px; background: #E3EFFB; color: #03101D; }
.${P}-tabla-cab, .${P}-tabla-fila { display: grid; grid-template-columns: 1.15fr 2fr 140px; align-items: center; gap: 14px; }
.${P}-tabla-cab { padding: 0 14px 14px; font-size: 16px; font-weight: 600; }
.${P}-tabla-cab span:nth-child(2) { text-align: center; }
.${P}-tabla-mako { display: flex; align-items: center; justify-content: center; gap: 7px; font-weight: 700; }
.${P}-tabla-estrella { width: 22px; height: 22px; border-radius: 6px; background: #1A1712; display: inline-flex; align-items: center; justify-content: center; }
.${P}-tabla-fila { min-height: 46px; padding: 7px 14px; border-radius: 8px; }
.${P}-tabla-fila:nth-child(even) { background: #D5E5F7; }
.${P}-tabla-trabajo { font-size: 11px; line-height: 1.3; font-weight: 700; letter-spacing: .02em; text-transform: uppercase; }
.${P}-tabla-apps { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; }
.${P}-app { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px 4px 6px; border-radius: 20px; background: #fff; box-shadow: 0 1px 3px rgba(3,16,29,.14); font-size: 11px; font-weight: 600; color: #03101D; white-space: nowrap; }
.${P}-app img { width: 16px; height: 16px; border-radius: 4px; object-fit: contain; }
.${P}-tabla-si { display: flex; justify-content: center; }
.${P}-incl, .${P}-pro { display: inline-flex; align-items: center; gap: 5px; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; white-space: nowrap; }
.${P}-incl { background: ${MAKO.azul}; color: #fff; box-shadow: 0 2px 6px rgba(47,111,237,.35); }
.${P}-pro { background: #FFF1D1; color: #8A5A00; }

/* Los casos: banda #03101D con 300 abajo; tarjetas de 265 con su borde degradado, radio 20, el degradado a negro y sus comillas; al pasar
   el mouse suben 2 px con la sombra 0 8px 25px (medido). */
.${P}-casos { background: #03101D; padding: 50px 0 360px; color: #fff; }
.${P}-casos h2 { max-width: 1150px; margin: 0 auto; }
.${P}-carrusel { position: relative; }
.${P}-casos-ventana { margin-top: 90px; }
.${P}-casos-fila { display: grid; grid-template-columns: repeat(4, 265px); justify-content: space-between; max-width: 1150px; margin: 0 auto; }
.${P}-caso-borde { border-radius: 20px; padding: 1px; background-image: linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(135,136,138,.58) 100%); }
.${P}-caso { position: relative; height: 100%; min-height: 290px; display: flex; flex-direction: column; justify-content: flex-start; gap: 18px; padding: 30px; border-radius: 20px; border: 1px solid rgba(255,255,255,.2); background-image: linear-gradient(180deg, rgba(0,0,0,0) 0%, #000 100%); box-shadow: rgba(0,0,0,.1) 0 4px 6px 0; overflow: hidden; transition: transform .2s, box-shadow .2s; }
.${P}-caso:hover { transform: translateY(-2px); box-shadow: rgba(0,0,0,.15) 0 8px 25px 0; }
.${P}-comillas { flex: none; }
.${P}-caso-x { margin: 0; font-size: 15px; line-height: 24px; color: #fff; flex: 1; }
.${P}-caso-x strong { font-weight: 600; }
.${P}-autor { display: inline-flex; align-items: center; gap: 16px; }
.${P}-autor-av { width: 60px; height: 60px; flex: none; border-radius: 50%; border: 2px solid #E5E7EB; background: ${MAKO.azul}; color: #fff; display: inline-flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 700; }
.${P}-autor-n { font-size: 14px; font-weight: 600; color: #fff; }
.${P}-caso-video { justify-content: flex-end; padding: 0; }
.${P}-caso-video video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.${P}-caso-video::after { content: ''; position: absolute; inset: 0; background-image: linear-gradient(rgba(0,0,0,0) 40%, #000 100%); }
.${P}-caso-pie { position: relative; z-index: 1; padding: 30px; display: flex; flex-direction: column; gap: 10px; }
.${P}-caso-rol { font-size: 13px; line-height: 16.9px; color: rgba(255,255,255,.75); }
.${P}-puntos { display: none; }

/* La caja del cierre («Built to make things easier», 1170 × 347, radio 25, 40px 0 0 40px), montada 320 px sobre el final de la banda
   oscura: su fondo celeste → violeta, con los azules de MaKo; título 40/52 700 #03101D y el botón oscuro. */
.${P}-cierre-banda { display: flow-root; background: #F9FBFC; padding: 0 10px 60px; }
.${P}-cierre { position: relative; max-width: 1170px; margin: -320px auto 0; min-height: 347px; padding: 40px 40px 0 45px; border-radius: 25px; display: grid; grid-template-columns: 449px 1fr; gap: 40px;
  background: linear-gradient(115deg, #FFFFFF 0%, #A9C4F8 22%, #6E9BF4 48%, #8C9DF5 78%, #B9A9F7 100%); }
.${P}-cierre-txt { padding: 11px 0 40px; }
.${P}-cierre-h { margin: 0; font-size: 40px; line-height: 52px; font-weight: 700; color: #03101D; }
.${P}-cierre-txt .${P}-btn { margin-top: 40px; }
.${P}-cierre-vis { display: flex; align-items: flex-end; justify-content: center; gap: 28px; height: 307px; padding: 0 20px; }
.${P}-mes { display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 8px; height: 100%; width: 96px; }
.${P}-mes-v { font-size: 22px; font-weight: 700; color: #03101D; }
.${P}-mes-barra { width: 100%; max-height: 210px; border-radius: 12px 12px 0 0; background: linear-gradient(180deg, ${MAKO.azul}, ${MAKO.azulOscuro}); }
.${P}-mes:last-child .${P}-mes-barra { background: linear-gradient(180deg, ${MAKO.dorado}, #E09A0B); }
.${P}-mes-l { font-size: 14px; color: #03101D; padding-bottom: 14px; }

/* «Integrates With Your Favorite Tools» (fondo #F9FBFC, título 28/36,4 700 #0D3056): su cinta de logos de 50 px, que corre a 40 px por
   segundo y se frena con el mouse, con los bordes desvanecidos (mask 5 % / 95 %). */
.${P}-integra { background: #F9FBFC; padding: 35px 0 45px; }
.${P}-integra-h { margin: 0 0 36px; padding: 0 10px; text-align: center; font-size: 28px; line-height: 36.4px; font-weight: 700; color: #0D3056; }
.${P}-cinta { max-width: 1440px; margin: 0 auto; overflow: hidden; -webkit-mask: linear-gradient(90deg, transparent, #fff 5%, #fff 95%, transparent); mask: linear-gradient(90deg, transparent, #fff 5%, #fff 95%, transparent); }
.${P}-cinta-pista { display: flex; width: max-content; animation: ${P}-cinta 22.5s linear infinite; will-change: transform; }
.${P}-cinta:hover .${P}-cinta-pista { animation-play-state: paused; }
.${P}-cinta-set { display: flex; align-items: center; gap: 40px; margin: 0; padding: 0 20px; list-style: none; }
.${P}-cinta-set li { flex: none; display: flex; }
.${P}-cinta-set img { display: block; width: 50px; height: 50px; object-fit: contain; }
@keyframes ${P}-cinta { from { transform: translateX(0); } to { transform: translateX(-25%); } }

/* Su franja fija: #178AF6 (el azul de MaKo), 100 de alto, el texto blanco 22/28,6 600 y el botón amarillo (el dorado de MaKo) de 277 × 60,
   radio 10, letra #0D3056 en dos renglones (15 px 800 y 13 px 600) y la sombra 0 10px 15px -10px; sin hover (medido). Se prende con la
   opacidad en 0,5 s, debajo de la barra del sitio. */
.${P}-franja { position: fixed; left: 0; right: 0; top: var(--${P}-arriba, 0px); z-index: 60; height: 100px; display: flex; align-items: center; background: ${MAKO.azul}; opacity: 0; visibility: hidden; pointer-events: none; transition: opacity .5s ease, visibility 0s linear .5s; }
.${P}-franja.${P}-fija { opacity: 1; visibility: visible; pointer-events: auto; transition: opacity .5s ease; }
.${P}-franja-in { width: 100%; max-width: 1170px; margin: 0 auto; padding: 0 20px; display: flex; align-items: center; justify-content: center; gap: 75px; }
.${P}-franja-t { margin: 0; font-size: 22px; line-height: 28.6px; font-weight: 600; color: #fff; }
.${P}-franja-btn { display: inline-flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; min-width: 277px; height: 60px; padding: 8px 40px; border-radius: 10px; background: ${MAKO.dorado}; color: #0D3056 !important; text-decoration: none; box-shadow: rgba(0,0,0,.43) 0 10px 15px -10px; }
.${P}-franja-btn b { font-size: 15px; line-height: 1.2; font-weight: 700; }
.${P}-franja-btn span { font-family: ui-sans-serif, system-ui, sans-serif; font-size: 13px; line-height: 1.2; font-weight: 600; }

/* Las ventanas: la del video (su fondo cian al 40 % → el azul de MaKo; el video de 720 × 405 a 90 px de arriba; la × en la esquina) y
   la de salida (fondo negro al 50 %, la caja blanca de 720 con su título de 30, el botón azul a lo ancho y la frase chica gris). */
.${P}-pop { position: fixed; inset: 0; z-index: 2147481000; display: none; }
.${P}-pop:target, .${P}-pop.${P}-abierta { display: block; }
.${P}-pop-fondo { position: absolute; inset: 0; background: rgba(47,111,237,.4); cursor: default; }
.${P}-pop-fondo-negro { background: rgba(0,0,0,.5); }
.${P}-pop-caja { position: absolute; left: 50%; top: 90px; width: min(720px, calc(100vw - 30px)); aspect-ratio: 16 / 9; transform: translateX(-50%); background: #000; box-shadow: 0 30px 70px -20px rgba(3,16,29,.55); }
.${P}-pop-video { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; display: block; }
.${P}-pop-x { position: absolute; right: -10px; top: -10px; z-index: 2; display: flex; width: 28px; height: 28px; }
.${P}-salida-caja { position: absolute; left: 50%; top: 90px; width: min(720px, calc(100vw - 30px)); transform: translateX(-50%); padding: 40px 45px 30px; border: 4px solid #E6E6E6; border-radius: 10px; background: #fff; text-align: center; color: #000; animation: ${P}-sube .3s ease both; }
.${P}-salida-h { margin: 0 0 30px; font-size: 30px; line-height: 39px; font-weight: 700; color: #000; }
.${P}-salida-btn { display: flex; align-items: center; justify-content: center; min-height: 52px; padding: 8px 20px; border-radius: 4px; background: ${MAKO.azul}; color: #fff !important; font-size: 24px; line-height: 1.2; font-weight: 700; text-decoration: none; transition: all .15s ease; }
.${P}-salida-btn:hover { transform: translateY(-1px); box-shadow: 0 7px 14px rgba(50,50,93,.1), 0 3px 6px rgba(0,0,0,.08); }
.${P}-salida-chico { margin: 14px 0 0; font-size: 12px; line-height: 1.4; color: #9C9C9C; }
@keyframes ${P}-sube { from { opacity: 0; transform: translate(-50%, 16px); } to { opacity: 1; transform: translate(-50%, 0); } }

/* El pie: #07223D (en producción lo tapa el del sitio). */
.${P}-pie { background: #07223D; color: #fff; padding: 32px 20px 0; }
.${P}-pie-cols { max-width: 1150px; margin: 0 auto; padding: 25px 5px 40px; display: grid; grid-template-columns: 321px 299px 289px 1fr; }
.${P}-pie-col { display: flex; flex-direction: column; align-items: flex-start; }
.${P}-pie-h { margin: 0 0 21px; font-size: 17px; line-height: 22.1px; font-weight: 400; text-transform: uppercase; min-height: 22px; }
.${P}-pie-a { font-size: 15px; line-height: 19.5px; padding: 5px 0; text-decoration: none; }
.${P}-pie-a:hover { text-decoration: underline; }
.${P}-pie-base { max-width: 1170px; margin: 0 auto; border-top: 2px solid #fff; padding: 15px 0 5px; text-align: center; font-size: 13px; line-height: 16.9px; }
.${P}-pie-base p { margin: 48px 0 10px; }
.${P}-pie-base p + p { margin: 0 0 26px; }
.${P}-pie-base a { text-decoration: none; }

@media (max-width: 1190px) {
  .${P}-casos-fila { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 30px; }
  .${P}-principio { padding: 12px 24px; }
}
@media (max-width: 1023px) {
  .${P}-panel { grid-template-columns: minmax(0, 1fr); }
  .${P}-cierre { grid-template-columns: minmax(0, 1fr); }
}

/* 390: lo que medimos en su versión de teléfono (corta a 767 px). */
@media (max-width: 767px) {
  .${P}-barra { padding: 10px; height: 102px; }
  .${P}-barra-in { padding: 20px 10px 0; height: auto; }
  .${P}-barra-btns { display: none; }
  .${P}-hero { padding: 20px 10px 200px; }
  .${P}-hero-fila { flex-direction: column; min-height: 0; padding: 0; }
  .${P}-hero-txt { flex: none; width: 100%; padding: 10px; align-items: center; text-align: center; }
  .${P}-pill { padding: 7px 20px 7px 40px; font-size: 12px; line-height: 15.6px; }
  .${P}-pill-ic svg { width: 12px; height: 20px; }
  .${P}-h1 { font-size: 25px; line-height: 30px; }
  .${P}-btn-hero { margin: 40px 0 20px; }
  .${P}-hero-media { width: 100%; padding: 20px 10px 0; }
  .${P}-hero-abre { border-radius: 10px; }
  .${P}-play { width: 48px; height: 48px; margin: -24px 0 0 -24px; }
  .${P}-play svg { width: 20px; height: 20px; }
  .${P}-contadores { margin-top: -170px; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; padding: 0 10px; }
  .${P}-contador { padding: 6px; min-height: 68px; border-radius: 4px; }
  .${P}-contador-l { font-size: 11px; margin-top: 2px; }
  .${P}-contador:last-child:nth-child(odd) { grid-column: 1 / -1; }
  .${P}-sec-cifras { padding: 60px 20px 40px; }
  .${P}-sec-cifras .${P}-h2-30 { font-size: 28px; line-height: 36.4px; }
  .${P}-h2-40 { font-size: 30px; line-height: 39px; }
  .${P}-sec { padding: 20px 10px 60px; }
  .${P}-enc-ciclo { padding: 30px 10px 0; }
  .${P}-pills { display: grid; grid-template-columns: repeat(2, 140px); justify-content: center; gap: 10px 20px; margin: 40px 0 50px; }
  .${P}-pill-tab:last-child:nth-child(odd) { grid-column: 1 / -1; justify-self: center; }
  .${P}-panel { grid-template-columns: minmax(0, 1fr); padding: 20px 10px; min-height: 0; }
  .${P}-panel-txt { padding: 10px 0 0; }
  .${P}-lista { columns: 1; }
  .${P}-panel-txt .${P}-btn { margin: 35px auto 0; display: flex; width: 100%; max-width: 276px; }
  .${P}-panel-vis { padding: 20px 0 10px; }
  .${P}-principios { padding: 20px 20px 140px; }
  .${P}-principios-h { font-size: 22px; line-height: 28.6px; margin: 21px 10px 30px; }
  .${P}-principios-cols { grid-template-columns: minmax(0, 1fr); gap: 20px; }
  .${P}-principio, .${P}-principio:first-child, .${P}-principio:last-child { border-left: 0; padding: 0; }
  .${P}-incluye { padding: 30px 10px 40px; }
  .${P}-tabla { margin: 30px 0 36px; padding: 16px 8px; }
  .${P}-tabla-cab, .${P}-tabla-fila { grid-template-columns: minmax(0, 1fr) 104px; gap: 8px; }
  .${P}-tabla-cab span:nth-child(2), .${P}-tabla-apps { display: none; }
  /* El carrusel: una tarjeta por vez, que se corre 0,3 s; los puntos de 10 px (#9CA3AF la elegida, #E5E7EB las otras). */
  .${P}-casos { padding: 40px 0 300px; }
  .${P}-casos-ventana { margin-top: 40px; overflow: hidden; }
  .${P}-casos-fila { display: flex; gap: 0; transition: transform .3s ease; }
  .${P}-caso-borde { flex: 0 0 100%; min-width: 100%; }
  .${P}-caso { min-height: 244px; }
  ${[0, 1, 2, 3].map((i) => `#${P}-c${i}:checked ~ .${P}-casos-ventana .${P}-casos-fila { transform: translateX(-${i * 100}%); }
  #${P}-c${i}:checked ~ .${P}-puntos .${P}-punto-${i} { background: #9CA3AF; }`).join('\n  ')}
  .${P}-puntos { display: flex; justify-content: center; gap: 8px; margin-top: 50px; }
  .${P}-punto { width: 10px; height: 10px; border-radius: 50%; background: #E5E7EB; cursor: pointer; transition: background-color .3s ease; }
  .${P}-cierre { padding: 20px 20px 0; gap: 10px; }
  .${P}-cierre-txt { padding: 20px 0 10px; }
  .${P}-cierre-vis { gap: 16px; padding: 0; height: 220px; }
  .${P}-mes { flex: 1 1 0; width: auto; max-width: 96px; }
  .${P}-integra-h { font-size: 24px; line-height: 31.2px; }
  .${P}-franja { height: 130px; }
  .${P}-franja-in { flex-direction: column; gap: 10px; padding: 0 10px; }
  .${P}-franja-t { font-size: 16px; line-height: 20.8px; text-align: center; }
  .${P}-franja-btn { min-width: 216px; height: 58px; padding: 8px 24px; }
  .${P}-pop-caja { top: 84px; }
  .${P}-salida-caja { padding: 30px 16px 20px; }
  .${P}-salida-h { font-size: 24px; line-height: 30px; }
  .${P}-salida-btn { font-size: 18px; }
  .${P}-pie { padding: 32px 20px 0; }
  .${P}-pie-cols { grid-template-columns: 1fr; gap: 0; padding: 0 0 30px; }
  .${P}-pie-col { margin-bottom: 30px; }
  .${P}-pie-col:nth-child(2) .${P}-pie-h, .${P}-pie-col:nth-child(3) .${P}-pie-h { display: none; }
  .${P}-pie-col:nth-child(2), .${P}-pie-col:nth-child(3) { margin-top: -30px; }
}

@media (prefers-reduced-motion: reduce) {
  .${P} *, .${P} *::before, .${P} *::after { animation: none !important; transition: none !important; }
}
`;

// =============================================================================
// El script (data-visor): los contadores que suben, la franja fija, la ventana del video, el video de la pestaña elegida y el
// carrusel del teléfono. Idempotente (`__listo`) y limpia su propio estado al arrancar: pulir.mjs guarda el DOM DESPUÉS de correrlo
// (docs/hallazgos-landing.md, «Video como Cherry, segunda vuelta»). Con «menos movimiento»: los números finales, sin franja que se
// prende con fundido, sin carrusel que avanza solo y los videos en su primer cuadro.
// =============================================================================
const SCRIPT = `(function(){
var P='${P}';
function trasHidratar(fn){if(!document.querySelector('script[src*="/_next/"]'))return fn();var t0=Date.now();(function mira(){var h=Object.keys(document.body).some(function(k){return k.indexOf('__reactFiber')===0||k.indexOf('__reactProps')===0;});if(h||Date.now()-t0>6000)fn();else setTimeout(mira,60);})();}
function iniciar(){
  var R=document.querySelector('.'+P);if(!R||R.__listo)return;R.__listo=1;
  var quieto=!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);
  var hayIO='IntersectionObserver' in window;
  // 1. Los contadores: del 0 al número en 2 s (su ease-out cuártico, medido cada 40 ms), cuando la tarjeta se ve a la mitad; una vez.
  var nums=[].slice.call(R.querySelectorAll('[data-fin]'));
  function fmt(n){return String(n).replace(/\\B(?=(\\d{3})+(?!\\d))/g,'.');}
  function pinta(e,n){e.textContent=(e.getAttribute('data-pre')||'')+fmt(n)+(e.getAttribute('data-suf')||'');}
  nums.forEach(function(e){pinta(e,quieto||!hayIO?+e.getAttribute('data-fin'):0);});
  if(!quieto&&hayIO){var oc=new IntersectionObserver(function(es){es.forEach(function(en){if(!en.isIntersecting)return;oc.unobserve(en.target);var e=en.target,fin=+e.getAttribute('data-fin'),t0=performance.now();(function paso(t){var k=Math.min(1,(t-t0)/2000),v=1-Math.pow(1-k,4);pinta(e,Math.round(fin*v));if(k<1)requestAnimationFrame(paso);})(t0);});},{threshold:.5});nums.forEach(function(e){oc.observe(e);});}
  // 2. La franja fija: pasada la mitad del hero, debajo de la barra del sitio.
  var fr=R.querySelector('.'+P+'-franja'),hero=R.querySelector('.'+P+'-hero');
  if(fr){fr.classList.remove(P+'-fija');}
  if(fr&&hero){
    var barra=document.querySelector('.s-solo-barra');
    var arriba=function(){var b=barra&&getComputedStyle(barra).display!=='none'?barra.getBoundingClientRect():null;R.style.setProperty('--'+P+'-arriba',(b&&b.bottom>0?Math.round(b.bottom):0)+'px');};
    var tic=false,mira=function(){tic=false;arriba();var on=window.scrollY>hero.offsetTop+hero.offsetHeight/2;fr.classList.toggle(P+'-fija',on);fr.setAttribute('aria-hidden',on?'false':'true');var a=fr.querySelector('a');if(a)a.tabIndex=on?0:-1;};
    window.addEventListener('scroll',function(){if(!tic){tic=true;requestAnimationFrame(mira);}},{passive:true});window.addEventListener('resize',mira);mira();
  }
  // 3. Las ventanas. La del video: el link de la grabación la abre; el fondo, la × o Escape la cierran (y el video para: se le saca el
  // src). La de salida: cuando el mouse sale por ARRIBA de la ventana (su «exit», con 1 s de gracia desde que carga), una sola vez.
  var pop=document.getElementById(P+'-vsl'),ifr=pop&&pop.querySelector('iframe'),sal=document.getElementById(P+'-salida');
  function abrir(x){if(!x)return;if(x===pop&&ifr&&!ifr.getAttribute('src'))ifr.setAttribute('src',ifr.getAttribute('data-src')||'');x.classList.add(P+'-abierta');}
  function cerrar(x){if(!x)return;x.classList.remove(P+'-abierta');if(x===pop&&ifr)ifr.removeAttribute('src');if(location.hash==='#'+x.id)history.replaceState(null,'',location.pathname+location.search);}
  [pop,sal].forEach(function(x){if(x)x.classList.remove(P+'-abierta');});if(ifr)ifr.removeAttribute('src');
  R.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a');if(!a)return;
    if(a.classList.contains(P+'-hero-abre')){e.preventDefault();abrir(pop);}
    else if(a.classList.contains(P+'-pop-x')||a.classList.contains(P+'-pop-fondo')){e.preventDefault();cerrar(a.closest('.'+P+'-pop'));}});
  document.addEventListener('keydown',function(e){if(e.key!=='Escape')return;[pop,sal].forEach(function(x){if(x&&x.classList.contains(P+'-abierta'))cerrar(x);});});
  if(location.hash==='#'+P+'-vsl')abrir(pop);
  var salio=false,desde=Date.now();
  if(sal&&window.matchMedia&&matchMedia('(pointer: fine)').matches){document.addEventListener('mouseout',function(e){if(salio||e.relatedTarget||e.clientY>0||Date.now()-desde<1000)return;if(pop&&pop.classList.contains(P+'-abierta'))return;salio=true;abrir(sal);});}
  // 4. Los videos: corre sólo el que se ve (en las pestañas, el de la elegida, desde el principio al cambiar).
  var vids=[].slice.call(R.querySelectorAll('video'));
  vids.forEach(function(v){v.muted=true;if(quieto){v.removeAttribute('autoplay');v.pause();}});
  function visibleV(v){return v.offsetParent!==null&&v.__ve!==false;}
  function mover(v){if(quieto)return;if(visibleV(v)){if(v.preload==='none')v.preload='auto';var p=v.play();if(p&&p.catch)p.catch(function(){});}else if(!v.paused)v.pause();}
  if(hayIO){var ov=new IntersectionObserver(function(es){es.forEach(function(en){en.target.__ve=en.isIntersecting;mover(en.target);});},{threshold:.2});vids.forEach(function(v){v.__ve=false;ov.observe(v);});}
  R.addEventListener('change',function(e){var t=e.target;if(!t||!t.classList||!t.classList.contains(P+'-radio'))return;
    if(t.name===P+'-ciclo'){vids.forEach(function(v){if(v.closest('.'+P+'-panel')){if(v.offsetParent!==null){try{v.currentTime=0;}catch(err){}}mover(v);}});}});
  // 5. El carrusel del teléfono: cada 3 s a la siguiente (y de la última a la primera), frenado con el mouse encima.
  var cr=[].slice.call(R.querySelectorAll('input[name="'+P+'-caso"]'));
  if(cr.length){cr[0].checked=true;}
  var car=R.querySelector('.'+P+'-carrusel'),encima=false;
  if(car){car.addEventListener('mouseenter',function(){encima=true;});car.addEventListener('mouseleave',function(){encima=false;});}
  if(!quieto&&cr.length&&window.matchMedia){var tel=matchMedia('(max-width: 767px)');setInterval(function(){if(!tel.matches||encima||document.hidden)return;var k=0;cr.forEach(function(r,i){if(r.checked)k=i;});cr[(k+1)%cr.length].checked=true;},3000);}
}
function arrancar(){trasHidratar(iniciar);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',arrancar);else arrancar();
})();`;
