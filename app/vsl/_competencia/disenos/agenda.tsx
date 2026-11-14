// =============================================================================
// /vsl/agenda con el DISEÑO de la portada de iClosed (https://www.iclosed.io/), copiado el 11/11/2026 y otra vez FIEL el 14/11/2026
// =============================================================================
// iClosed cambió desde el 11/11 (ahora es «AI scheduler powering high-ticket sales teams»): se miró de nuevo con Chromium a 1440 y a
// 390 (capturas, video del scroll con una parada en cada sección, `getAnimations()` en cada paso, MutationObserver, hovers con su
// estilo calculado antes y después; el relevo, en la carpeta de notas de la sesión, referencias-landings/agenda/; los valores, en
// docs/diseno/landings-competencia/agenda.md). Cada sección suya es un componente de código de Framer con su CSS DENTRO del HTML: las
// medidas salen de ahí (Poppins 500 para los titulares, Inter para el resto; cortes a 1279 y 809 px).
//
// LO QUE SE MUEVE, como en iClosed (nada aparece al bajar: no tiene `appear` de Framer salvo un título que no va acá):
//   · HERO: su demo es una línea de tiempo de dos vistas con sus pestañas de arriba («Scheduler | Unified Inbox») y una pastilla negra
//     abajo («Lead captured · recovered»). La vista que se va se achica a ,97 y se apaga (500/550 ms) mientras la otra aparece (450 ms);
//     la pestaña de la vista pasa de ,5 a 1 con su borde celeste. Aquí: «CRM» (la reserva de Calendly que entra sola en «Agenda R1»)
//     y «WhatsApp» (la confirmación de la reunión, la misma vista y los mismos textos de la toma de Automations de la portada).
//   · «KEEP THE SAME FUNNELS»: las pestañas avanzan SOLAS con una barra negra de 2 px que se llena (12 s en iClosed; aquí, lo que dura
//     la grabación de la pestaña) y, a la izquierda de la tarjeta, la lista se va marcando de a un renglón (tenue ,4 → tilde verde).
//   · BANDA OSCURA: las líneas punteadas que bajan de los tres pasos corren (`stroke-dashoffset`, 1,1 s), la pastilla de abajo
//     respira (2,6 s) y cada paso sube 3 px con el borde celeste y la sombra azul al pasar el mouse (200 ms).
//   · LO QUE HACE: la demo de cada tarjeta entra cuando se ve (sube y aparece, de a una).
//   · INTEGRACIONES: dos filas de logos que corren al revés (44 s y 40 s, con el borde que se esfuma), como las suyas.
//   · Botones: `brightness(1.1)` en 150 ms (los blancos, ,94).
// Un <script data-visor> (el visor de Martín borra los demás) maneja las dos líneas de tiempo, los videos (corren sólo a la vista) y
// las apariciones. Limpia su estado al empezar (pulir.mjs guarda el DOM después de correrlo) y corre una vez (`__listo`). Sin
// JavaScript: las pestañas son radios con :checked, la lista se ve entera y los videos quedan en su primer cuadro. Con «menos
// movimiento», todo quieto.
//
// LAS PANTALLAS SON LAS DE MAKO, grabadas en el banco C:/dev/bancos-portada/banco-agenda-landing (el CRM, «Vincular evento», las
// Llamadas de Calendar, la tarjeta de la reunión y el lienzo de Automations REALES con datos de ejemplo: «Cierre Consultivo», el
// negocio ficticio de las plantillas). La grabación de la pestaña de Automations es un tramo de public/vsl-assets/sitio/automations.webm.
//
// Lo que NO se copió (no tiene contenido real de MaKo): la barra negra del anuncio, las caras con su tooltip y el «5/5 on G2» del hero,
// las tres citas, la pared de logos de clientes, la pestaña «AI Agent», «You already follow them», el contador en dólares de la banda
// oscura, «Coaches, agencies, creators», «Build on iClosed», las estrellas y el carrusel de
// reseñas (hay un solo caso, y sus dos párrafos no son citas: van quietos), el carrusel de casos con sus flechas y «Book a 5-min demo».
// Las fotos de cielo de sus demos son, aquí, degradados.
// =============================================================================

import type { PropsDiseno } from '.';
import type { Bloque } from '../tipos';
import { RUTA_CTA, CASO, LogoMaKo, TEXTO_CTA, html, otrasFunciones, TEXTO_CIERRE } from '../marca';

const c = (n: string) => `d-agenda-${n}`;
const A = '/vsl-assets/agenda';
type Tarjetas = Extract<Bloque, { tipo: 'tarjetas' }>;
type Video = { video: string; poster: string; dur: number; alt: string };

/**
 * Las dos vistas del hero, como «Scheduler» y «Unified Inbox» de iClosed (cortar.sh del banco: un tramo sin bucle; el script las
 * reproduce de a una). `pastillaEn`: cuándo entra la pastilla, en segundos del video (la tarjeta llega a los 1,4 s; la respuesta, a
 * los 3,4 s).
 */
export const VISTAS_HERO: readonly (Video & { id: string; rotulo: string; pastilla: string; pastillaEn: number })[] = [
  { id: 'crm', rotulo: 'CRM', video: `${A}/hero-crm.webm`, poster: `${A}/hero-crm.jpg`, dur: 5, pastilla: 'Agendó por Calendly · cae en Agenda R1', pastillaEn: 2.2, alt: 'El CRM de MaKo: la reserva de Tomás entra sola en la etapa Agenda R1, con su día y su hora' },
  { id: 'whatsapp', rotulo: 'WhatsApp', video: `${A}/hero-whatsapp.webm`, poster: `${A}/hero-whatsapp.jpg`, dur: 6.2, pastilla: 'Confirmó su asistencia', pastillaEn: 3.7, alt: 'El WhatsApp de Tomás: le llega la confirmación de la reunión que agendó y contesta que asiste' },
];
/** La pantalla de cada pestaña de «Mantén los mismos funnels», EN EL ORDEN de los items del primer bloque de tarjetas. */
export const PANTALLA_DE_PESTANA: readonly Video[] = [
  { video: `${A}/vincular.webm`, poster: `${A}/vincular.jpg`, dur: 11, alt: 'En el CRM, el menú de la etapa Agenda R1 abre «Vincular evento» y se marca la llamada de diagnóstico' },
  { video: `${A}/seguimiento.webm`, poster: `${A}/seguimiento.jpg`, dur: 5.6, alt: 'La automatización de la reunión agendada manda el WhatsApp y el lead confirma su asistencia' },
  { video: `${A}/llamadas.webm`, poster: `${A}/llamadas.jpg`, dur: 12, alt: 'Llamadas de venta en Calendar: se filtra por un closer y se marca que el lead asistió' },
];
/** La demo de cada tarjeta de «Todo lo que tu página de reservas debió hacer», EN EL ORDEN de sus items (fotos del banco). */
export const FOTO_DE_TARJETA: readonly { src: string; alt: string; w: number; h: number }[] = [
  { src: `${A}/foto-vincular.jpg`, alt: '«Vincular evento»: la llamada de diagnóstico es la R1 y la de cierre, la R2', w: 860, h: 403 },
  { src: `${A}/foto-tarjeta.jpg`, alt: 'La tarjeta de la reunión de Tomás: empieza en 5 minutos, lo que contestó y «Entrar a la reunión»', w: 840, h: 556 },
  { src: `${A}/foto-lienzo.jpg`, alt: 'La plantilla «Un Lead No Asistió» en el lienzo de Automations: WhatsApp, email y el aviso de MaKo', w: 900, h: 408 },
  { src: `${A}/foto-canceladas.jpg`, alt: 'Llamadas de venta, pestaña Canceladas, con la reunión cancelada', w: 1200, h: 357 },
  { src: `${A}/foto-crm.jpg`, alt: 'El tablero del CRM con las reservas en Agenda R1 y Agenda R2, cada una con su hora', w: 1300, h: 508 },
];
/** La demo de la banda oscura (en bucle, codificar-bucle.sh) y la ventana grande de «Todo tu equipo». */
export const VIDEO_RESERVAS: Video = { video: `${A}/reservas.webm`, poster: `${A}/reservas.jpg`, dur: 4.5, alt: 'Una reserva de Calendly entra sola en la etapa Agenda R1 del CRM' };
export const VIDEO_EQUIPO: Video = { video: `${A}/equipo.webm`, poster: `${A}/equipo.jpg`, dur: 11, alt: 'Llamadas de venta de todo el equipo: el filtro por persona y la asistencia marcada en la fila' };
/** La marquesina de «Se conecta con lo que ya usas» (su «Drops into the stack»): los logos de public/vsl-assets/logos/integraciones,
 *  dos filas que corren al revés (44 s y 40 s, como las suyas). */
const LOGOS_FILA: readonly (readonly string[])[] = [
  ['calendly.png', 'calcom.png', 'whatsapp.svg', 'meta.svg', 'zoom.svg', 'fathom.png'],
  ['stripe.png', 'mercadopago.svg', 'instagram.png', 'facebook.png', 'youtube.png', 'calendly.png'],
];
/** El logo de cada integración destacada, por su nombre (los items del cuarto bloque de tarjetas). */
const LOGO_DESTACADA: Readonly<Record<string, string>> = {
  Calendly: 'calendly.png', 'Cal.com': 'calcom.png', Meta: 'meta.svg', Fathom: 'fathom.png', Zoom: 'zoom.svg', WhatsApp: 'whatsapp.svg',
};
/** La pastilla de abajo de los tres pasos (su «SAME TRAFFIC. MORE PROFIT.»). */
const PASTILLA_PASOS = 'Tu misma agenda. Todo en tu CRM.';

function Icono({ d, size = 20, grosor = 1.8 }: { d: string[]; size?: number; grosor?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={grosor} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d.map((p) => <path key={p} d={p} />)}
    </svg>
  );
}
const ICONO_CRM = ['M4 5h4v14h-4z', 'M10 5h4v9h-4z', 'M16 5h4v11h-4z'];

function BotonAzul() {
  return <a href={RUTA_CTA} className={c('btn-az')}>{TEXTO_CTA} <span aria-hidden="true">→</span></a>;
}

function Barra({ links }: { links: { href: string; t: string }[] }) {
  return (
    <header className={c('barra')}>
      <div className={c('barra-in')}>
        <LogoMaKo className={c('logo')} tamano={26} />
        <nav className={c('nav')} aria-label="Secciones">
          {links.map((l) => <a key={l.href} href={l.href}>{l.t}</a>)}
        </nav>
        <div className={c('barra-der')}>
          <a href="/login" className={c('login')}>Iniciar sesión</a>
          <a href={RUTA_CTA} className={c('btn-barra')}>{TEXTO_CTA}</a>
        </div>
        <details className={c('menu')}>
          <summary aria-label="Menú"><Icono d={['M4 7h16', 'M4 12h16', 'M4 17h16']} size={22} grosor={2} /></summary>
          <div className={c('menu-panel')}>
            {links.map((l) => <a key={l.href} href={l.href}>{l.t}</a>)}
            <a href="/login">Iniciar sesión</a>
          </div>
        </details>
      </div>
    </header>
  );
}

/** El escenario del hero (660 × 477 en iClosed, medido en `cqw` para que se achique igual): el cielo, las dos pestañas, la ventana de
 *  vidrio con sus dos vistas y la pastilla. Se ve igual en los dos modos (`data-tema-fijo`), como su foto. */
function Escenario() {
  return (
    <div className={c('esc-caja')}>
      <div className={c('esc')} data-tema-fijo="">
        <div className={c('esc-tabs')} aria-hidden="true">
          {VISTAS_HERO.map((v, i) => (
            <span key={v.id} className={c('esc-tabw')}>
              {i > 0 ? <span className={c('esc-div')} /> : null}
              <span className={`${c('chip')}${i === 0 ? ` ${c('chip-on')}` : ''}`}>
                {v.id === 'whatsapp'
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src="/vsl-assets/logos/integraciones/whatsapp.svg" alt="" width={16} height={16} />
                  : <Icono d={ICONO_CRM} size={16} grosor={1.8} />}
                {v.rotulo}
              </span>
            </span>
          ))}
        </div>
        <div className={c('esc-ventana')}>
          <div className={c('esc-panel')}>
            {VISTAS_HERO.map((v, i) => (
              <div key={v.id} className={`${c('vista')}${i === 0 ? ` ${c('vista-on')}` : ''}`} data-pastilla={v.pastilla} data-pastilla-en={v.pastillaEn} data-dur={v.dur}>
                <video className={c('vista-vid')} src={v.video} poster={v.poster} muted playsInline preload="metadata" aria-label={v.alt} width={960} height={600} />
              </div>
            ))}
          </div>
        </div>
        <div className={c('pastilla-fila')} aria-hidden="true">
          <div className={c('pastilla')}><span className={c('pastilla-punto')} /><span className={c('pastilla-t')}>{VISTAS_HERO[0].pastilla}</span></div>
        </div>
      </div>
    </div>
  );
}

function Hero({ b }: { b: Extract<Bloque, { tipo: 'hero' }> }) {
  return (
    <section className={c('hero')}>
      <div className={c('hero-in')}>
        <div className={c('hero-grid')}>
          <div className={c('hero-copy')}>
            <p className={c('hero-etq')}>{b.etiqueta}</p>
            <div className={c('hero-txt')}>
              <h1 className={c('h1')} dangerouslySetInnerHTML={html(b.titulo)} />
              <p className={c('hero-p')} dangerouslySetInnerHTML={html(b.bajada)} />
            </div>
            <div className={c('hero-cta')}>
              <BotonAzul />
              <p className={c('hero-chico')}>{TEXTO_CIERRE}</p>
            </div>
          </div>
          <div className={c('hero-vis')}><Escenario /></div>
        </div>
      </div>
    </section>
  );
}

const TILDE = <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#03543F" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg>;
const TENUE = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth={1.8} aria-hidden="true"><circle cx="12" cy="12" r="8" /></svg>;

/** «Keep the same funnels…»: el titular, la fila de pestañas de borde a borde con su barra que se llena, y la tarjeta blanca sobre
 *  gris con la lista que se marca a la izquierda y la grabación a la derecha. */
function Pestanas({ b }: { b: Tarjetas }) {
  const n = c('tab');
  return (
    <section className={c('tabs')} id={c('embudo')}>
      <h2 className={`${c('h2')} ${c('tabs-h2')}`} dangerouslySetInnerHTML={html(b.titulo)} />
      {b.bajada ? <p className={c('enc-p')} dangerouslySetInnerHTML={html(b.bajada)} /> : null}
      <div className={c('tabs-caja')}>
        {b.items.map((_, i) => (
          <input key={i} type="radio" name={n} id={`${n}-${i}`} className={`${c('tab-in')} ${c(`tab-in-${i}`)}`} defaultChecked={i === 0} />
        ))}
        <div className={c('tab-banda')} data-tema-fijo="">
          <div className={c('tab-fila')}>
            {b.items.map((t, i) => (
              <label key={t.titulo} htmlFor={`${n}-${i}`} className={`${c('tab-l')} ${c(`tab-l-${i}`)}`}>
                <span dangerouslySetInnerHTML={html(t.titulo)} />
                <span className={c('prog')} aria-hidden="true" />
              </label>
            ))}
          </div>
        </div>
        <div className={c('tab-area')}>
          {b.items.map((t, i) => {
            const p = PANTALLA_DE_PESTANA[i];
            return (
              <div key={t.titulo} className={`${c('panel')} ${c(`panel-${i}`)}`} data-dur={p?.dur ?? 10}>
                <div className={c('panel-copy')}>
                  <div className={c('panel-head')}>
                    <h3 className={c('panel-h3')} dangerouslySetInnerHTML={html(t.titulo)} />
                    <p className={c('panel-p')} dangerouslySetInnerHTML={html(t.texto)} />
                  </div>
                  {t.puntos?.length ? (
                    <ul className={c('chks')}>
                      {t.puntos.map((pt, k) => {
                        const [tit, desc] = pt.split('|');
                        return (
                          <li key={pt} className={c('chk')}>
                            <span className={c('chk-col')}>
                              <span className={c('chk-ic')}><span className={c('chk-tenue')}>{TENUE}</span><span className={c('chk-si')}>{TILDE}</span></span>
                              {k < t.puntos!.length - 1 ? <span className={c('chk-linea')} /> : null}
                            </span>
                            <span className={c('chk-txt')}>
                              <span className={c('chk-t')}>{tit}</span>
                              {desc ? <span className={c('chk-d')}>{desc}</span> : null}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </div>
                <div className={c('panel-demo')}>
                  {p ? (
                    <div className={c('panel-win')}>
                      <video className={c('panel-vid')} src={p.video} poster={p.poster} muted playsInline preload="metadata" aria-label={p.alt} width={960} height={600} />
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/** La banda azul noche: el texto a la izquierda, la demo sobre su cielo a la derecha, los tres pasos con su «+», las líneas
 *  punteadas que bajan y la pastilla. Igual en los dos modos (`data-tema-fijo`), como en iClosed. */
function Oscura({ b }: { b: Extract<Bloque, { tipo: 'pasos' }> }) {
  return (
    <section className={c('osc')} id={c('conecta')} data-tema-fijo="">
      <div className={c('osc-in')}>
        <div className={c('osc-top')}>
          <div className={c('osc-copy')}>
            {b.etiqueta ? <p className={c('ceja-osc')}>{b.etiqueta}</p> : null}
            <h2 className={c('osc-h2')} dangerouslySetInnerHTML={html(b.titulo)} />
            {b.bajada ? <p className={c('osc-p')} dangerouslySetInnerHTML={html(b.bajada)} /> : null}
            <a href={RUTA_CTA} className={c('btn-bl')}>{TEXTO_CTA} <span aria-hidden="true">→</span></a>
          </div>
          <div className={c('osc-vis')}>
            <div className={c('osc-glass')}>
              <div className={c('osc-marca')}><LogoMaKo className={c('osc-logo')} tamano={18} claro /></div>
              <div className={c('osc-card')}>
                <video className={c('osc-vid')} src={VIDEO_RESERVAS.video} poster={VIDEO_RESERVAS.poster} muted loop playsInline preload="metadata" data-bucle="" aria-label={VIDEO_RESERVAS.alt} width={960} height={600} />
              </div>
            </div>
          </div>
        </div>
        <div className={c('osc-bottom')}>
          <ol className={c('pasos')}>
            {b.pasos.map((p, i) => (
              <li key={p.titulo} className={c('paso-w')}>
                {i > 0 ? <span className={c('mas')} aria-hidden="true">+</span> : null}
                <div className={c('paso')}>
                  <span className={c('paso-n')}>{String(i + 1).padStart(2, '0')}</span>
                  <div className={c('paso-txt')}>
                    <h3 className={c('paso-h3')} dangerouslySetInnerHTML={html(p.titulo)} />
                    <p className={c('paso-p')} dangerouslySetInnerHTML={html(p.texto)} />
                  </div>
                </div>
              </li>
            ))}
          </ol>
          <div className={c('conectores')} aria-hidden="true">
            <svg className={c('con-izq')} preserveAspectRatio="none" viewBox="0 0 429.816 68.4854" fill="none"><path className={c('raya')} d="M0.5 0V38.8379C0.5 47.6745 7.66344 54.8379 16.5 54.8379H415.669C423.206 54.8379 429.316 60.9481 429.316 68.4854" stroke="#76A9FA" strokeDasharray="6 6" /></svg>
            <svg className={c('con-der')} preserveAspectRatio="none" viewBox="0 0 441.768 68.4854" fill="none"><path className={c('raya')} d="M0.5 0V38.8379C0.5 47.6745 7.66344 54.8379 16.5 54.8379H427.621C435.158 54.8379 441.268 60.9481 441.268 68.4854" stroke="#76A9FA" strokeDasharray="6 6" /></svg>
            <svg className={c('con-med')} preserveAspectRatio="none" viewBox="0 0 5.7735 98.3955" fill="none"><path className={c('raya')} d="M2.88675 0V90.3955" stroke="#76A9FA" strokeDasharray="6 6" /><path d="M2.88675 98.3955L5.7735 93.3955H0L2.88675 98.3955Z" fill="#76A9FA" /></svg>
          </div>
          <div className={c('pild-fila')}><div className={c('pild')}><span className={c('pild-t')}>{PASTILLA_PASOS}</span></div></div>
        </div>
      </div>
    </section>
  );
}

/** «Everything your booking page should've done all along»: tres tarjetas arriba y dos más anchas abajo, cada una con su demo. */
function Producto({ b }: { b: Tarjetas }) {
  const filas = [b.items.slice(0, 3), b.items.slice(3)];
  return (
    <section className={c('prod')} id={c('hace')}>
      <div className={c('prod-head')}>
        {b.etiqueta ? <p className={c('ceja')}>{b.etiqueta}</p> : null}
        <h2 className={c('h2')} dangerouslySetInnerHTML={html(b.titulo)} />
        {b.bajada ? <p className={c('enc-p')} dangerouslySetInnerHTML={html(b.bajada)} /> : null}
      </div>
      <div className={c('prod-grid')}>
        {filas.map((fila, f) => (fila.length ? (
          <div key={f} className={c('prod-fila')}>
            {fila.map((t, k) => {
              const foto = FOTO_DE_TARJETA[f * 3 + k];
              return (
                <div key={t.titulo} className={`${c('pcard')} ${c(f === 0 ? 'pcard-sm' : 'pcard-md')}`}>
                  <div className={c('pcard-demo')} data-aparece="" style={{ ['--d' as string]: `${k * 120}ms` }}>
                    {foto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className={c('pcard-img')} src={foto.src} alt={foto.alt} width={foto.w} height={foto.h} loading="lazy" decoding="async" />
                    ) : null}
                  </div>
                  <div className={c('pcard-copy')}>
                    <h3 className={c('pcard-h3')} dangerouslySetInnerHTML={html(t.titulo)} />
                    <p className={c('pcard-p')} dangerouslySetInnerHTML={html(t.texto)} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : null))}
      </div>
      {b.cta ? <div className={c('cta-fila')}><BotonAzul /></div> : null}
    </section>
  );
}

/** «Your whole team, closing in one inbox»: el titular y la ventana grande sobre el cielo, con las Llamadas de Calendar. */
function Equipo({ b }: { b: Tarjetas }) {
  return (
    <section className={c('eq')} id={c('equipo')}>
      <div className={c('eq-head')}>
        <h2 className={c('h2')} dangerouslySetInnerHTML={html(b.titulo)} />
        {b.bajada ? <p className={c('enc-p')} dangerouslySetInnerHTML={html(b.bajada)} /> : null}
      </div>
      <div className={c('eq-cielo')} data-tema-fijo="">
        <div className={c('eq-vidrio')}>
          <video className={c('eq-vid')} src={VIDEO_EQUIPO.video} poster={VIDEO_EQUIPO.poster} muted loop playsInline preload="metadata" data-bucle="" aria-label={VIDEO_EQUIPO.alt} width={960} height={600} />
        </div>
      </div>
    </section>
  );
}

/** «Drops into the stack you already have»: el titular con su botón, dos filas de logos que corren al revés y las destacadas. */
function Integraciones({ b }: { b: Tarjetas }) {
  return (
    <section className={c('int')} id={c('integraciones')}>
      <div className={c('int-head')}>
        {b.etiqueta ? <p className={c('ceja')}>{b.etiqueta}</p> : null}
        <h2 className={c('h2')} dangerouslySetInnerHTML={html(b.titulo)} />
        {b.bajada ? <p className={c('enc-p')} dangerouslySetInnerHTML={html(b.bajada)} /> : null}
        {b.cta ? <a href={RUTA_CTA} className={c('btn-az-md')}>{TEXTO_CTA}</a> : null}
      </div>
      <div className={c('int-filas')} aria-hidden="true">
        {LOGOS_FILA.map((fila, f) => (
          <div key={f} className={`${c('int-fila')}${f === 1 ? ` ${c('int-fila-rev')}` : ''}`}>
            <div className={c('int-cinta')}>
              {[0, 1, 2, 3].map((vez) => (
                <div key={vez} className={c('int-pasada')}>
                  {fila.map((src, k) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <span key={`${src}-${k}`} className={c('int-tile')}><img src={`/vsl-assets/logos/integraciones/${src}`} alt="" width={44} height={44} loading="lazy" decoding="async" /></span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className={c('int-tira')}>
        <ul className={c('int-grid')}>
          {b.items.map((t) => (
            <li key={t.titulo} className={c('int-celda')}>
              <span className={c('int-marca')}>
                {LOGO_DESTACADA[t.titulo] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/vsl-assets/logos/integraciones/${LOGO_DESTACADA[t.titulo]}`} alt="" width={26} height={26} />
                ) : null}
                <span className={c('int-nombre')} dangerouslySetInnerHTML={html(t.titulo)} />
              </span>
              <p className={c('int-texto')} dangerouslySetInnerHTML={html(t.texto)} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** «Proof, in their own words» + «The lift, measured in cold dollars», con el caso de Mauricio (el único: sin carrusel). */
function Caso() {
  return (
    <>
      <section className={c('pr')} id={c('resultados')}>
        <div className={c('pr-head')}>
          <p className={c('ceja')}>Lo que dicen los números</p>
          <h2 className={c('pr-h2')} dangerouslySetInnerHTML={html(CASO.titulo)} />
          <p className={c('enc-p')}>{CASO.sub}</p>
        </div>
        <div className={c('pr-cards')}>
          {CASO.historia.map((h) => (
            <article key={h} className={c('pr-card')}>
              <p className={c('pr-q')} dangerouslySetInnerHTML={html(h)} />
              <div className={c('pr-autor')}>
                <span className={c('pr-ava')} aria-hidden="true">{CASO.quien.charAt(0)}</span>
                <span className={c('pr-quien')}><span className={c('pr-n')}>{CASO.quien}</span><span className={c('pr-r')}>{CASO.rol}</span></span>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className={c('lift-sec')}>
        <article className={c('lift')} data-tema-fijo="">
          <video className={c('lift-vid')} muted autoPlay loop playsInline preload="metadata" aria-label={`${CASO.quien}, en un escenario`}><source src={CASO.video} type="video/mp4" /></video>
          <div className={c('lift-velo')} aria-hidden="true" />
          <div className={c('lift-panel')}>
            <div className={c('lift-cifras')}>
              {CASO.meses.map((m) => (
                <div key={m.mes} className={c('lift-c')}><span className={c('lift-v')}>{m.monto}</span><span className={c('lift-l')}>{m.mes}</span></div>
              ))}
            </div>
          </div>
          <div className={c('lift-cita')}>
            <p className={c('lift-q')} dangerouslySetInnerHTML={html(CASO.resultado)} />
            <div className={c('lift-quien')}><span className={c('lift-n')}>{CASO.quien}</span><span className={c('lift-r')}>{CASO.rol}</span></div>
          </div>
        </article>
      </section>
    </>
  );
}

/** La banda final oscura (su «Turn your scheduler into a profit maximizer»), con el texto de la banda de todas las landings. */
function Cierre() {
  return (
    <section className={c('cierre')} data-tema-fijo="">
      <div className={c('cierre-in')}>
        <p className={c('ceja-osc')}>Tu agenda, conectada</p>
        <h2 className={c('cierre-h2')}>¿Lo quieres funcionando <em>en tu negocio?</em></h2>
        <p className={c('cierre-p')}>{TEXTO_CIERRE}</p>
        <a href={RUTA_CTA} className={`${c('btn-bl')} ${c('btn-bl-glow')}`}>{TEXTO_CTA} <span aria-hidden="true">→</span></a>
      </div>
    </section>
  );
}

function Pie({ slug, metaDesc }: { slug: string; metaDesc: string }) {
  const otras = otrasFunciones(slug);
  const mitad = Math.ceil(otras.length / 2);
  return (
    <footer className={c('pie')}>
      <div className={c('pie-in')}>
        <div className={c('pie-marca')}>
          <LogoMaKo className={c('pie-logo')} tamano={28} claro />
          <p className={c('pie-desc')}>{metaDesc}</p>
          <a href={RUTA_CTA} className={c('pie-btn')}>{TEXTO_CTA} <span aria-hidden="true">→</span></a>
        </div>
        <div className={c('pie-cols')}>
          <div className={c('pie-col')}>
            <p className={c('pie-h')}>Funciones</p>
            <ul>{otras.slice(0, mitad).map((o) => <li key={o.href}><a href={o.href}>{o.nombre}</a></li>)}</ul>
          </div>
          <div className={c('pie-col')}>
            <p className={c('pie-h')} aria-hidden="true">&nbsp;</p>
            <ul>{otras.slice(mitad).map((o) => <li key={o.href}><a href={o.href}>{o.nombre}</a></li>)}</ul>
          </div>
          <div className={c('pie-col')}>
            <p className={c('pie-h')}>Legal</p>
            <ul>
              <li><a href="/privacidad">Privacidad</a></li>
              <li><a href="/terminos">Términos del servicio</a></li>
              <li><a href="/aup">Política de uso aceptable</a></li>
            </ul>
          </div>
        </div>
      </div>
      <p className={c('pie-copy')}>© 2026 MaKo</p>
    </footer>
  );
}

export default function DisenoAgenda({ landing }: PropsDiseno) {
  const bloques = landing.bloques;
  const tarjetas = bloques.filter((b): b is Tarjetas => b.tipo === 'tarjetas');
  const links: { href: string; t: string }[] = [];
  if (bloques.some((b) => b.tipo === 'pasos')) links.push({ href: `#${c('conecta')}`, t: 'Cómo se conecta' });
  if (tarjetas[1]) links.push({ href: `#${c('hace')}`, t: 'Lo que hace' });
  if (tarjetas[2]) links.push({ href: `#${c('equipo')}`, t: 'Tu equipo' });
  if (bloques.some((b) => b.tipo === 'caso')) links.push({ href: `#${c('resultados')}`, t: 'Resultados' });
  return (
    <div className={c('raiz')}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <Barra links={links} />
      <main>
        {bloques.map((b, i) => {
          switch (b.tipo) {
            case 'hero': return <Hero key={i} b={b} />;
            case 'tarjetas': {
              const k = tarjetas.indexOf(b);
              if (k === 0) return <Pestanas key={i} b={b} />;
              if (k === 1) return <Producto key={i} b={b} />;
              if (k === 2) return <Equipo key={i} b={b} />;
              return <Integraciones key={i} b={b} />;
            }
            case 'pasos': return <Oscura key={i} b={b} />;
            case 'caso': return <Caso key={i} />;
            default: return null;
          }
        })}
        <Cierre />
      </main>
      <Pie slug={landing.slug} metaDesc={landing.metaDesc} />
      <script data-visor="" dangerouslySetInnerHTML={{ __html: SCRIPT }} />
    </div>
  );
}

// Los valores, de los <style> de cada sección de www.iclosed.io (14/11/2026; docs/diseno/landings-competencia/agenda.md). Sus cortes
// son por contenedor a 1279 y 809 px; aquí, por ancho de ventana (las secciones van de borde a borde).
const CSS = `
@font-face{font-family:'DAg Poppins';src:url('/vsl-assets/fuentes/poppins/poppins-500.woff2') format('woff2');font-weight:500;font-style:normal;font-display:swap}
@font-face{font-family:'DAg Poppins';src:url('/vsl-assets/fuentes/poppins/poppins-600.woff2') format('woff2');font-weight:600;font-style:normal;font-display:swap}
@font-face{font-family:'DAg Inter';src:url('/vsl-assets/fuentes/inter/inter-latin-var.woff2') format('woff2');font-weight:100 900;font-style:normal;font-display:swap}
.a-raiz{--az:#2F6FED;--azo:#1F57C8;--cel:#76A9FA;--noche:#020418;--tinta:#0A0D14;--t2:#111928;--g4:#9CA3AF;--g5:#6B7280;--g6:#4B5563;--borde:#E5E7EB;--fp:'DAg Poppins',-apple-system,BlinkMacSystemFont,sans-serif;--fi:'DAg Inter',-apple-system,BlinkMacSystemFont,sans-serif;background:#fff;color:var(--t2);font-family:var(--fi);font-size:16px;line-height:1.5;-webkit-font-smoothing:antialiased;overflow-x:clip}
:where(.a-raiz) *,:where(.a-raiz) *::before,:where(.a-raiz) *::after{box-sizing:border-box}
:where(.a-raiz) a{color:inherit;text-decoration:none}
:where(.a-raiz) :where(h1,h2,h3,p,ul,ol){margin:0;padding:0}
:where(.a-raiz) :where(ul,ol){list-style:none}
:where(.a-raiz) :where(img,video){display:block;max-width:100%}
.a-h2{font-family:var(--fp);font-size:36px;line-height:1.4;font-weight:500;letter-spacing:-.4px;color:var(--tinta);text-wrap:balance}
.a-h2 em{display:block;font-style:normal;color:var(--az)}
.a-enc-p{margin:0 auto;max-width:812px;font-size:18px;line-height:28px;letter-spacing:-.04px;color:var(--noche)}
.a-enc-p strong{font-weight:600}
.a-ceja{font-size:14px;line-height:20px;font-weight:500;letter-spacing:.84px;text-transform:uppercase;color:var(--az)}
.a-ceja-osc{display:flex;align-items:center;gap:10px;font-size:12px;line-height:16px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--cel)}
.a-ceja-osc::before{content:'';width:18px;height:1px;background:var(--cel)}
.a-btn-az{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-width:203px;height:54px;padding:0 22px;border-radius:8px;border:1px solid var(--az);background:var(--az);color:#fff;font-size:16px;line-height:24px;font-weight:600;letter-spacing:-.1px;white-space:nowrap;box-shadow:inset 0 1px 4px 1px rgba(255,255,255,.24),inset 0 4px 16px 1px rgba(255,255,255,.2);transition:filter 150ms ease}
.a-btn-az:hover{filter:brightness(1.1)}
.a-btn-az:active{filter:brightness(.96)}
.a-btn-bl{display:inline-flex;align-items:center;gap:8px;height:44px;padding:0 20px;border-radius:8px;background:#fff;color:#04072A;font-size:15px;font-weight:600;white-space:nowrap;transition:filter 150ms ease}
.a-btn-bl:hover{filter:brightness(.94)}
.a-btn-bl-glow{box-shadow:0 12px 40px -12px rgba(118,169,250,.45)}
.a-cta-fila{display:flex;justify-content:center;margin-top:56px}

/* Barra (escondida: va la del sitio) */
.a-barra{position:sticky;top:0;z-index:30;background:#fff;border-bottom:1px solid #F2F2F2}
.a-barra-in{height:64px;max-width:1440px;margin:0 auto;padding:0 40px;display:flex;align-items:center;gap:24px}
.a-logo{font-family:var(--fi);flex:none}
.a-nav{flex:1;display:flex;justify-content:center;gap:2px}
.a-nav a{padding:8px 16px;font-size:14px;line-height:22px;letter-spacing:-.14px;color:#31353F;border-radius:8px}
.a-barra-der{display:flex;align-items:center;gap:16px;flex:none}
.a-login{padding:8px 16px;font-size:15px;line-height:24px;color:#31353F}
.a-btn-barra{display:inline-flex;align-items:center;height:36px;padding:0 24px;border-radius:8px;background:var(--az);color:#fff;font-size:14px}
.a-menu{display:none;position:relative}
.a-menu summary{list-style:none;cursor:pointer;display:flex;padding:6px;color:var(--noche)}
.a-menu summary::-webkit-details-marker{display:none}
.a-menu-panel{position:absolute;right:0;top:calc(100% + 14px);width:230px;background:#fff;border:1px solid var(--borde);border-radius:8px;padding:8px;display:flex;flex-direction:column}
.a-menu-panel a{padding:10px 12px;font-size:15px;color:#31353F;border-radius:6px}

/* Hero (icnhap): contenedor 1440 con 40 de margen, copia de 676 y la demo de 660 × 477 */
.a-hero{position:relative;background:#fff}
.a-hero::after{content:'';position:absolute;left:0;right:0;bottom:0;height:1px;background:var(--borde)}
.a-hero-in{max-width:1440px;margin:0 auto;padding:0 40px}
.a-hero-grid{display:flex;align-items:center;justify-content:center;gap:24px;padding-block:64px}
.a-hero-copy{flex:none;width:676px;display:flex;flex-direction:column;justify-content:center;gap:24px}
.a-hero-etq{font-size:14px;line-height:20px;font-weight:500;text-transform:uppercase;color:var(--g5)}
.a-hero-txt{display:flex;flex-direction:column;gap:16px;width:540px;letter-spacing:-.4px}
.a-h1{font-family:var(--fp);font-size:40px;line-height:1.4;font-weight:500;color:var(--tinta)}
.a-h1 em{display:block;font-style:normal}
.a-hero-p{font-size:18px;line-height:28px;font-weight:500;color:var(--g6)}
.a-hero-p strong{font-weight:600;color:var(--tinta)}
.a-hero-cta{display:flex;flex-direction:column;align-items:flex-start;gap:16px}
.a-hero-chico{max-width:540px;font-size:14px;line-height:16px;letter-spacing:-.28px;color:var(--g5)}
.a-hero-vis{flex:1 0 0;min-width:0}
.a-esc-caja{width:100%;max-width:660px;margin-inline:auto;container-type:inline-size}
.a-esc{position:relative;width:100cqw;height:calc(100cqw * 477 / 660);border-radius:8px;overflow:hidden;background:radial-gradient(120% 90% at 50% 0%,#F4F9FF 0%,#E3EEFC 55%,#CFE0F7 100%)}
.a-esc::before{content:'';position:absolute;inset:0;background:radial-gradient(60% 40% at 15% 85%,rgba(255,255,255,.75),transparent 70%),radial-gradient(50% 35% at 88% 70%,rgba(255,255,255,.6),transparent 70%)}
.a-esc-tabs{position:absolute;top:calc(100cqw * 32 / 660);left:50%;translate:-50% 0;display:flex;align-items:center;z-index:3}
.a-esc-tabw{display:flex;align-items:center}
.a-esc-div{width:calc(100cqw * 19.2 / 660);height:1px;background:#D9D9D9}
.a-chip{display:inline-flex;align-items:center;gap:7px;height:calc(100cqw * 32 / 660);padding-inline:calc(100cqw * 10.8 / 660);border:1px solid var(--borde);border-radius:8px;background:#fff;font-size:calc(100cqw * 14 / 660);line-height:1;font-weight:500;color:var(--t2);white-space:nowrap;opacity:.5;transition:opacity 420ms ease}
.a-chip img,.a-chip svg{width:calc(100cqw * 16 / 660);height:calc(100cqw * 16 / 660);color:var(--az)}
.a-chip-on{opacity:1;border-width:2px;border-color:var(--cel);padding-inline:calc(100cqw * 9.8 / 660)}
.a-esc-ventana{position:absolute;left:50%;translate:-50% 0;top:calc(100cqw * 96 / 660);width:calc(100cqw * 595 / 660);padding:calc(100cqw * 13 / 660) calc(100cqw * 13 / 660) calc(100cqw * 60 / 660);border:1px solid rgba(255,255,255,.5);border-radius:8px;background:rgba(255,255,255,.2);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);box-shadow:0 0 42.8px 0 rgba(43,47,65,.17),inset 0 0 0 2px rgba(255,255,255,.3);z-index:2}
.a-esc-panel{position:relative;aspect-ratio:16/10;border-radius:8px;background:#F9FAFB;box-shadow:0 2px 10px 0 rgba(16,24,40,.06);overflow:hidden}
.a-vista{position:absolute;inset:0;opacity:0;visibility:hidden;transition:opacity 450ms ease,transform 500ms cubic-bezier(.2,.8,.2,1),visibility 0s linear 500ms}
.a-vista-on{opacity:1;visibility:visible;transform:none;transition:opacity 450ms ease,transform 500ms cubic-bezier(.2,.8,.2,1),visibility 0s linear 0s}
.a-vista-cerrando{opacity:0;transform:scale(.97);transform-origin:32% 42%;transition:opacity 500ms ease,transform 550ms cubic-bezier(.4,0,.2,1),visibility 0s linear 550ms}
.a-vista-vid{width:100%;height:100%;object-fit:cover}
.a-pastilla-fila{position:absolute;left:0;right:0;bottom:calc(100cqw * 24 / 660);display:flex;justify-content:center;pointer-events:none;z-index:4}
.a-pastilla{display:inline-flex;align-items:center;gap:8.4px;padding:calc(100cqw * 7.2 / 660) calc(100cqw * 14.4 / 660);border-radius:999px;background:#04072A;box-shadow:0 12px 26px -10px rgba(16,24,40,.5);white-space:nowrap;opacity:0;transform:translateY(8px);transition:opacity 360ms ease,transform 360ms ease}
.a-pastilla-on{opacity:1;transform:none}
.a-pastilla-punto{width:7.2px;height:7.2px;border-radius:3.6px;background:#31C48D}
.a-pastilla-t{font-size:calc(100cqw * 13.2 / 660);font-weight:600;letter-spacing:-.12px;color:#fff}
/* Sin JavaScript (o con «menos movimiento»): la primera vista con su pastilla. */
.a-raiz:not([data-agenda-js]) .a-pastilla{opacity:1;transform:none}

/* Pestañas (icpt + icptq) */
.a-tabs{display:flex;flex-direction:column;align-items:center;padding-top:120px;background:#fff}
.a-tabs-h2{margin-bottom:40px;padding:0 20px;text-align:center}
.a-tabs > .a-enc-p{margin-bottom:40px;padding:0 20px;text-align:center}
.a-tabs-caja{width:100%}
.a-tab-in{position:absolute;opacity:0;width:1px;height:1px;pointer-events:none}
.a-tab-banda{width:100%;border-block:1px solid var(--borde)}
.a-tab-fila{max-width:1440px;margin:0 auto;display:flex;align-items:stretch;height:56px;padding-top:1px}
.a-tab-l{position:relative;flex:1 1 0;min-width:0;display:flex;align-items:center;justify-content:center;padding:0 12px;text-align:center;font-size:14px;line-height:20px;font-weight:500;letter-spacing:-.084px;color:#737373;cursor:pointer;border-right:1px solid rgba(4,7,42,.05)}
.a-tab-l:last-child{border-right:0}
.a-prog{position:absolute;left:0;bottom:0;height:2px;width:0;background:#000;pointer-events:none;z-index:1}
.a-tab-in-0:checked ~ .a-tab-banda .a-tab-l-0,.a-tab-in-1:checked ~ .a-tab-banda .a-tab-l-1,.a-tab-in-2:checked ~ .a-tab-banda .a-tab-l-2,.a-tab-in-3:checked ~ .a-tab-banda .a-tab-l-3{background:#FAFAFA;color:#000;cursor:default}
.a-tab-in-0:checked ~ .a-tab-banda .a-tab-l-0::before,.a-tab-in-1:checked ~ .a-tab-banda .a-tab-l-1::before,.a-tab-in-2:checked ~ .a-tab-banda .a-tab-l-2::before,.a-tab-in-3:checked ~ .a-tab-banda .a-tab-l-3::before{content:'';position:absolute;inset-inline:0;bottom:0;height:2px;background:#E5E5E5}
.a-tab-in:focus-visible ~ .a-tab-banda .a-tab-fila{outline:2px solid var(--az);outline-offset:-2px}
html[data-sitio-modo="oscuro"] .a-tab-banda{border-color:#2A2F3A}
html[data-sitio-modo="oscuro"] .a-tab-l{color:#8E95A3;border-color:#2A2F3A}
html[data-sitio-modo="oscuro"] .a-tab-in-0:checked ~ .a-tab-banda .a-tab-l-0,html[data-sitio-modo="oscuro"] .a-tab-in-1:checked ~ .a-tab-banda .a-tab-l-1,html[data-sitio-modo="oscuro"] .a-tab-in-2:checked ~ .a-tab-banda .a-tab-l-2,html[data-sitio-modo="oscuro"] .a-tab-in-3:checked ~ .a-tab-banda .a-tab-l-3{background:#1A1E27;color:#fff}
html[data-sitio-modo="oscuro"] .a-tab-in-0:checked ~ .a-tab-banda .a-tab-l-0::before,html[data-sitio-modo="oscuro"] .a-tab-in-1:checked ~ .a-tab-banda .a-tab-l-1::before,html[data-sitio-modo="oscuro"] .a-tab-in-2:checked ~ .a-tab-banda .a-tab-l-2::before,html[data-sitio-modo="oscuro"] .a-tab-in-3:checked ~ .a-tab-banda .a-tab-l-3::before{background:#3A4050}
html[data-sitio-modo="oscuro"] .a-prog{background:#fff}
.a-tab-area{position:relative;min-height:680px;display:flex;align-items:center;justify-content:center;background:#F9FAFB;padding:100px 20px}
.a-panel{display:none;width:1144px;max-width:100%;height:480px;background:#fff;border:1px solid var(--borde);border-radius:4px;padding:16px 24px;filter:drop-shadow(0 0 6px rgba(0,0,0,.12));align-items:flex-start;gap:46px}
.a-tab-in-0:checked ~ .a-tab-area .a-panel-0,.a-tab-in-1:checked ~ .a-tab-area .a-panel-1,.a-tab-in-2:checked ~ .a-tab-area .a-panel-2,.a-tab-in-3:checked ~ .a-tab-area .a-panel-3{display:flex}
.a-panel-copy{width:501px;flex:0 0 auto;align-self:stretch;padding:7.7px;display:flex;flex-direction:column;gap:23px}
.a-panel-head{display:flex;flex-direction:column;gap:11.5px}
.a-panel-h3{font-family:var(--fi);font-size:18px;font-weight:500;line-height:normal;letter-spacing:-.36px;color:#171717}
.a-panel-p{font-size:16px;line-height:23.04px;letter-spacing:-.24px;color:#31353F}
.a-chks{display:flex;flex-direction:column}
.a-chk{display:flex;align-items:flex-start;gap:6px;transition:opacity .45s ease}
.a-chk-col{align-self:stretch;display:flex;flex-direction:column;align-items:center;gap:2px;padding-top:1px}
.a-chk-ic{position:relative;width:20px;height:20px;flex:none}
.a-chk-tenue,.a-chk-si{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;transition:opacity .4s ease,transform .4s ease}
.a-chk-si{border-radius:27.5px;background:#DEF7EC}
.a-chk-tenue{opacity:0;transform:scale(.55)}
.a-chk-linea{flex:1;width:1px;min-height:10px;background:#D9D9D9}
.a-chk-txt{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;padding-bottom:14px}
.a-chk-t{font-size:14px;font-weight:600;line-height:20px;color:var(--t2)}
.a-chk-d{font-size:14px;font-weight:500;line-height:20px;color:var(--g5)}
/* Con el script: tenue (,4), y se marca de a un renglón (el marcado ,7; el actual, 1). */
.a-raiz[data-agenda-js] .a-chk{opacity:.4}
.a-raiz[data-agenda-js] .a-chk .a-chk-tenue{opacity:1;transform:none}
.a-raiz[data-agenda-js] .a-chk .a-chk-si{opacity:0;transform:scale(.55)}
.a-raiz[data-agenda-js] .a-chk.a-chk-on{opacity:.7}
.a-raiz[data-agenda-js] .a-chk.a-chk-on.a-chk-ahora{opacity:1}
.a-raiz[data-agenda-js] .a-chk.a-chk-on .a-chk-tenue{opacity:0;transform:scale(.55)}
.a-raiz[data-agenda-js] .a-chk.a-chk-on .a-chk-si{opacity:1;transform:none}
.a-panel-demo{flex:1 1 0;min-width:0;align-self:stretch;border-radius:4px 0 0 4px;overflow:hidden;position:relative;display:flex;align-items:center;padding:22px 0 22px 22px;background:#EBF5FF}
.a-panel-win{flex:none;width:620px;border-radius:8px;overflow:hidden;background:#fff;border:1px solid #DCE6F5;box-shadow:0 0 42.8px 0 rgba(43,47,65,.17),0 1px 2px 0 rgba(196,196,215,.25)}
.a-panel-vid{width:100%;aspect-ratio:16/10;object-fit:cover}

/* Banda oscura (icft) */
.a-osc{position:relative;background:var(--noche);border-top:1px solid rgba(255,255,255,.06);padding:88px 0;overflow-x:clip}
.a-osc::before{content:'';position:absolute;inset:0;pointer-events:none;background:radial-gradient(640px 420px at 74% 18%,rgba(47,111,237,.14),transparent 70%),radial-gradient(520px 340px at 12% 6%,rgba(118,169,250,.08),transparent 70%),radial-gradient(560px 300px at 50% 100%,rgba(47,111,237,.1),transparent 72%)}
.a-osc::after{content:'';position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(rgba(255,255,255,.14) 1px,transparent 1px);background-size:26px 26px;opacity:.16;-webkit-mask-image:radial-gradient(900px 620px at 70% 20%,#000 0%,transparent 74%);mask-image:radial-gradient(900px 620px at 70% 20%,#000 0%,transparent 74%)}
.a-osc-in{position:relative;z-index:1;width:100%;max-width:1440px;margin-inline:auto;display:flex;flex-direction:column;align-items:center;gap:64px}
.a-osc-top{display:flex;align-items:center;gap:64px;width:100%;padding-inline:40px}
.a-osc-copy{flex:1 1 0;min-width:0;max-width:520px}
.a-osc-h2{margin-top:20px;font-family:var(--fp);font-size:40px;line-height:1.25;font-weight:500;letter-spacing:-.4px;color:#fff}
.a-osc-h2 em{display:block;font-style:normal;color:var(--cel)}
.a-osc-p{margin-top:18px;max-width:400px;font-size:16px;line-height:26px;color:#AAB1C2}
.a-osc-copy .a-btn-bl{margin-top:28px}
.a-osc-vis{position:relative;flex:0 1 658px;min-width:0;max-width:658px;aspect-ratio:658/430;border-radius:12px;overflow:hidden;margin-left:auto;background:linear-gradient(180deg,#3E5F96 0%,#7FA0CF 55%,#C9D8EC 100%)}
.a-osc-vis::before{content:'';position:absolute;inset:0;background:radial-gradient(70% 45% at 20% 25%,rgba(255,255,255,.35),transparent 70%),radial-gradient(60% 40% at 85% 40%,rgba(255,255,255,.25),transparent 70%)}
.a-osc-glass{position:absolute;left:6%;right:6%;bottom:0;top:14%;padding:12px 12px 0;border-radius:12px 12px 0 0;background:rgba(255,255,255,.22);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.4);border-bottom:none;display:flex;flex-direction:column}
.a-osc-marca{display:flex;align-items:center;justify-content:center;padding-bottom:10px;color:#fff}
.a-osc-logo{font-family:var(--fi)}
.a-osc-card{flex:1;min-height:0;border-radius:8px 8px 0 0;background:#fff;overflow:hidden}
.a-osc-vid{width:100%;aspect-ratio:16/10;object-fit:cover;object-position:top}
.a-osc-bottom{width:100%;display:flex;flex-direction:column;align-items:flex-start}
.a-pasos{display:flex;align-items:center;gap:16px;height:240px;width:100%;padding:0 32px}
.a-paso-w{flex:1 0 0;min-width:1px;max-width:476px;align-self:stretch;display:flex;align-items:center;gap:16px}
.a-paso{flex:1;align-self:stretch;position:relative;border:1px solid rgba(255,255,255,.09);border-radius:14px;padding:24px 20px;display:flex;flex-direction:column;gap:12px;align-items:flex-start;background:linear-gradient(180deg,rgba(255,255,255,.055) 0%,rgba(255,255,255,.018) 100%);transition:transform 200ms ease,border-color 200ms ease,box-shadow 200ms ease}
.a-paso::before{content:'';position:absolute;top:0;left:14px;right:14px;height:1px;background:linear-gradient(90deg,transparent,rgba(118,169,250,.55),transparent)}
.a-paso:hover{transform:translateY(-3px);border-color:rgba(118,169,250,.38);box-shadow:0 16px 48px -16px rgba(47,111,237,.4)}
.a-mas{display:grid;place-items:center;width:24px;height:24px;flex-shrink:0;opacity:.45;color:#fff;font-size:16px}
.a-paso-n{font-family:var(--fp);font-weight:600;font-size:44px;line-height:1.4;background:linear-gradient(180deg,rgba(255,255,255,.55) 0%,rgba(255,255,255,.06) 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:rgba(255,255,255,.3)}
.a-paso-txt{display:flex;flex-direction:column;gap:4px}
.a-paso-h3{font-family:var(--fi);font-weight:600;font-size:20px;line-height:1.4;color:#fff}
.a-paso-p{font-size:15px;line-height:25px;color:#AAB1C2}
.a-paso-p strong{color:#fff;font-weight:600}
.a-conectores{position:relative;width:100%;height:100px;overflow:hidden}
.a-con-izq{position:absolute;left:15.64%;top:1.5px;width:33.58%;height:68.5px;overflow:visible}
.a-con-der{position:absolute;left:49.14%;top:1.5px;width:34.51%;height:68.5px;transform:scaleX(-1);overflow:visible}
.a-con-med{position:absolute;left:48.98%;top:1px;width:5.77px;height:98.4px;overflow:visible}
.a-raya{stroke:#5F96F8;animation:a-raya 1.1s linear infinite}
.a-pild-fila{height:74px;display:flex;align-items:center;justify-content:center;width:100%}
.a-pild{height:100%;max-width:420px;border:1px solid rgba(118,169,250,.45);border-radius:14px;padding:20px 28px;display:flex;align-items:center;justify-content:center;background:linear-gradient(223deg,rgba(47,111,237,.12) 10%,rgba(255,255,255,.04) 100%);box-shadow:0 0 32px rgba(47,111,237,.28),inset 0 0 24px rgba(47,111,237,.14);animation:a-respira 2.6s ease-in-out infinite}
.a-pild-t{font-weight:600;font-size:18px;line-height:26px;letter-spacing:.06em;text-transform:uppercase;color:#fff;white-space:nowrap}

/* Lo que hace (icpb): tres de 440 arriba, dos de 416 abajo, 24 entre ellas */
.a-prod{display:flex;flex-direction:column;padding:100px 40px;background:#fff}
.a-prod-head{display:flex;flex-direction:column;align-items:center;gap:16px;text-align:center}
.a-prod-head .a-h2{max-width:812px}
.a-prod-grid{width:100%;max-width:1360px;margin:56px auto 0}
.a-prod-fila{display:flex;align-items:stretch;gap:24px}
.a-prod-fila + .a-prod-fila{margin-top:24px}
.a-pcard{position:relative;flex:1 1 0;min-width:0;display:flex;flex-direction:column;gap:24px;padding:25px;border:1px solid var(--borde);border-radius:6px;background:linear-gradient(163deg,#ECF2FC 0%,#FAFBFE 100%);overflow:hidden}
.a-pcard-sm{min-height:440px}
.a-pcard-md{min-height:416px}
.a-pcard-demo{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;transition:opacity 450ms ease var(--d,0ms),transform 450ms cubic-bezier(.2,.8,.2,1) var(--d,0ms)}
.a-raiz[data-agenda-js] .a-pcard-demo:not(.a-en-vista){opacity:0;transform:translateY(14px)}
.a-pcard-img{width:auto;max-width:100%;max-height:250px;border-radius:8px;border:1px solid #DCE3EE;background:#fff;box-shadow:0 0 42.8px 0 rgba(43,47,65,.12),0 1px 2px 0 rgba(196,196,215,.25);object-fit:cover;object-position:top}
.a-pcard-md .a-pcard-img{max-height:236px}
.a-pcard-copy{display:flex;flex-direction:column;gap:3.6px}
.a-pcard-h3{font-family:var(--fp);font-weight:500;font-size:18px;line-height:1.2;letter-spacing:-.4px;color:var(--t2)}
.a-pcard-p{font-size:16px;line-height:28px;font-weight:500;letter-spacing:-.04px;color:var(--g5)}

/* Todo tu equipo (icui) */
.a-eq{display:flex;flex-direction:column;align-items:center;padding:100px 20px 0;background:#fff}
.a-eq-head{width:100%;max-width:812px;display:flex;flex-direction:column;gap:16px;text-align:center}
.a-eq-cielo{width:100%;max-width:1200px;margin-top:40px;padding:24px 24px 0;border-radius:8px 8px 0 0;overflow:hidden;background:linear-gradient(180deg,#2F4E80 0%,#5F86BD 45%,#AFC6E4 100%)}
.a-eq-vidrio{border-radius:8px 8px 0 0;background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.4);border-bottom:0;padding:10px 10px 0}
.a-eq-vid{width:100%;aspect-ratio:16/10;object-fit:cover;object-position:top;border-radius:6px 6px 0 0;background:#fff;max-height:640px}

/* Integraciones (icint) */
.a-int{display:flex;flex-direction:column;align-items:center;gap:72px;padding-block:100px;background:#fff}
.a-int-head{display:flex;flex-direction:column;align-items:center;gap:16px;width:904px;max-width:100%;padding-inline:40px;text-align:center}
.a-btn-az-md{display:inline-flex;align-items:center;justify-content:center;min-width:144px;height:40px;padding:0 16px;border-radius:8px;border:1px solid var(--az);background:var(--az);color:#fff;font-size:14px;line-height:20px;font-weight:600;letter-spacing:-.1px;white-space:nowrap;box-shadow:inset 0 1px 4px 1px rgba(255,255,255,.24),inset 0 4px 16px 1px rgba(255,255,255,.2);transition:filter 150ms ease}
.a-btn-az-md:hover{filter:brightness(1.1)}
.a-int-filas{display:flex;flex-direction:column;gap:10px;width:100%;max-width:1440px;padding-inline:40px;overflow:hidden}
.a-int-fila{height:76px;overflow:hidden;-webkit-mask-image:linear-gradient(90deg,transparent 0%,#000 6%,#000 94%,transparent 100%);mask-image:linear-gradient(90deg,transparent 0%,#000 6%,#000 94%,transparent 100%)}
.a-int-cinta{display:flex;width:max-content;animation:a-cinta 44s linear infinite}
.a-int-fila-rev .a-int-cinta{animation-name:a-cinta-rev;animation-duration:40s}
.a-int-pasada{display:flex;gap:10px;padding-right:10px}
.a-int-tile{display:flex;align-items:center;justify-content:center;flex:none;width:76px;height:76px;padding:4px;border-radius:12px;background:#fff;border:1px solid #EEF0F3;filter:drop-shadow(0 .869px .869px rgba(10,12,18,.05))}
.a-int-tile img{width:44px;height:44px;object-fit:contain}
.a-int-tira{width:100%;border-top:1px solid var(--borde);border-bottom:1px solid var(--borde);padding-inline:20px}
.a-int-grid{display:flex;align-items:stretch;justify-content:center;width:100%;max-width:1440px;margin-inline:auto}
.a-int-celda{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;flex:1 0 0;min-width:0;padding:24px 20px}
.a-int-celda + .a-int-celda{border-left:1px solid #EFEFF1}
.a-int-marca{display:flex;align-items:center;justify-content:center;gap:8px;min-height:32px}
.a-int-marca img{width:26px;height:26px;object-fit:contain}
.a-int-nombre{font-family:var(--fp);font-size:18px;font-weight:500;letter-spacing:-.3px;color:var(--t2)}
.a-int-texto{font-size:14px;line-height:20px;font-weight:500;letter-spacing:-.14px;text-align:center;color:#737373}

/* Prueba (ictt) y el caso (iccs) */
.a-pr{display:flex;flex-direction:column;align-items:center;gap:72px;padding:100px 40px;background:#fff;border-top:1px solid var(--borde)}
.a-pr-head{width:100%;max-width:812px;display:flex;flex-direction:column;align-items:center;gap:16px;text-align:center}
.a-pr-h2{font-family:var(--fp);font-size:40px;line-height:52px;font-weight:500;letter-spacing:-.4px;color:#171717;text-wrap:balance}
.a-pr-cards{display:flex;justify-content:center;gap:24px;flex-wrap:wrap}
.a-pr-card{width:380px;min-height:226px;padding:20px;display:flex;flex-direction:column;justify-content:space-between;gap:20px;background:#F9FAFB;border:1px solid #E6E7EA;border-radius:8px}
.a-pr-q{font-size:18px;line-height:28px;font-weight:500;letter-spacing:-.198px;color:var(--t2)}
.a-pr-q strong{font-weight:600;text-decoration:underline;text-decoration-color:var(--cel);text-decoration-thickness:3px;text-underline-offset:4px}
.a-pr-autor{display:flex;align-items:center;gap:12px}
.a-pr-ava{width:48px;height:48px;flex:none;border-radius:4px;display:flex;align-items:center;justify-content:center;background:#E1EFFE;color:var(--az);font-size:17px;font-weight:600}
.a-pr-quien{display:flex;flex-direction:column;min-width:0}
.a-pr-n{font-size:18px;line-height:24px;font-weight:500;letter-spacing:-.27px;color:#171717}
.a-pr-r{font-size:14px;line-height:20px;font-weight:500;color:#404040}
.a-lift-sec{padding:0 40px 100px;background:#fff}
.a-lift{position:relative;width:100%;max-width:1008px;height:480px;margin:0 auto;border-radius:8px;overflow:hidden;background:var(--noche);color:#fff}
.a-lift-vid{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center 30%}
.a-lift-velo{position:absolute;inset:0;background:rgba(2,4,24,.5)}
.a-lift-panel{position:absolute;left:24px;top:24px;bottom:24px;width:254px;padding:24px;border-radius:8px;background:linear-gradient(148deg,rgba(255,255,255,.14) 0%,rgba(255,255,255,.05) 26%,rgba(255,255,255,0) 58%),rgba(2,4,24,.52);box-shadow:rgba(255,255,255,.24) 0 1px 0 0 inset,rgba(255,255,255,.09) 0 0 0 1px;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.a-lift-cifras{display:flex;flex-direction:column;gap:32px}
.a-lift-c{display:flex;flex-direction:column;gap:8px}
.a-lift-v{font-size:36px;line-height:1.2;font-weight:600;letter-spacing:-.36px}
.a-lift-l{font-size:16px;line-height:20px;font-weight:500;letter-spacing:-.24px}
.a-lift-cita{position:absolute;left:302px;right:24px;bottom:24px;display:flex;flex-direction:column;gap:16px}
.a-lift-q{font-size:20px;line-height:30px;font-weight:500;letter-spacing:-.3px}
.a-lift-q strong{font-weight:600}
.a-lift-quien{display:flex;flex-direction:column;gap:2px}
.a-lift-n{font-size:18px;line-height:24px;font-weight:500;letter-spacing:-.27px}
.a-lift-r{font-size:16px;line-height:24px;font-weight:500;letter-spacing:-.176px;color:rgba(255,255,255,.85)}

/* Cierre (icuic) */
.a-cierre{position:relative;padding-block:96px;background:linear-gradient(180deg,#0A1329 0%,#05091A 100%);border-top:1px solid rgba(255,255,255,.06);border-bottom:1px solid rgba(255,255,255,.06);overflow:hidden}
.a-cierre::before{content:'';position:absolute;inset:0;pointer-events:none;background:radial-gradient(620px 380px at 50% 0%,rgba(47,111,237,.18),transparent 70%),radial-gradient(520px 320px at 82% 100%,rgba(118,169,250,.08),transparent 70%)}
.a-cierre::after{content:'';position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(rgba(255,255,255,.14) 1px,transparent 1px);background-size:26px 26px;opacity:.14;-webkit-mask-image:radial-gradient(760px 480px at 50% 40%,#000 0%,transparent 74%);mask-image:radial-gradient(760px 480px at 50% 40%,#000 0%,transparent 74%)}
.a-cierre-in{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;gap:18px;max-width:1440px;margin-inline:auto;padding-inline:40px;text-align:center}
.a-cierre-h2{max-width:760px;text-wrap:balance;font-family:var(--fp);font-size:40px;line-height:1.25;font-weight:500;letter-spacing:-.4px;color:#fff}
.a-cierre-h2 em{font-style:normal;color:var(--cel)}
.a-cierre-p{max-width:560px;font-size:18px;line-height:28px;letter-spacing:-.27px;color:#C3C9D6}
.a-cierre .a-btn-bl{margin-top:10px}

/* Pie (escondido en el sitio: va el del sitio) */
.a-pie{background:var(--noche);padding:100px 40px 80px;color:#fff}
.a-pie-in{max-width:1360px;margin:0 auto;display:flex;justify-content:space-between;gap:48px}
.a-pie-marca{max-width:573px}
.a-pie-logo{font-family:var(--fi)}
.a-pie-desc{margin:20px 0 32px;max-width:360px;font-size:14px;line-height:22px;color:#D5D7DA}
.a-pie-btn{display:inline-flex;align-items:center;gap:6px;height:48px;padding:0 24px;border-radius:8px;background:#fff;color:var(--noche);font-size:14px}
.a-pie-cols{display:grid;grid-template-columns:repeat(3,auto);gap:96px}
.a-pie-h{font-size:14px;line-height:20px;font-weight:500;color:#fff;margin-bottom:16px}
.a-pie-col ul{display:flex;flex-direction:column;gap:16px}
.a-pie-col a{font-size:14px;line-height:22px;color:#A3A3A3;transition:color .15s}
.a-pie-col a:hover{color:#fff}
.a-pie-copy{max-width:1360px;margin:80px auto 0;font-size:12px;line-height:16px;color:#737373}

@keyframes a-raya{to{stroke-dashoffset:-12}}
@keyframes a-cinta{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@keyframes a-cinta-rev{from{transform:translateX(-50%)}to{transform:translateX(0)}}
@keyframes a-respira{0%,100%{box-shadow:0 0 26px rgba(47,111,237,.22),inset 0 0 20px rgba(47,111,237,.12)}50%{box-shadow:0 0 44px rgba(47,111,237,.42),inset 0 0 28px rgba(47,111,237,.2)}}

@media (max-width:1279px){
  .a-hero-grid{flex-direction:column;gap:48px;padding-block:56px}
  .a-hero-copy{width:100%;max-width:640px;align-items:center}
  .a-hero-txt{width:100%;text-align:center}
  .a-h1{font-size:36px}
  .a-hero-etq{text-align:center}
  .a-hero-cta{align-items:center}
  .a-hero-chico{text-align:center}
  .a-hero-vis{flex:none;width:100%}
  .a-tabs{padding-top:72px}
  .a-tabs-h2{font-size:30px;margin-bottom:32px}
  .a-tab-area{min-height:0;align-items:flex-start;padding:48px 24px}
  .a-panel{height:auto;flex-direction:column;gap:24px}
  .a-panel-copy{width:100%;padding:4px}
  .a-panel-demo{flex:none;width:100%;align-self:auto;border-radius:4px;padding:22px}
  .a-panel-win{width:100%}
  .a-osc{padding:56px 0}
  .a-osc-in{gap:40px}
  .a-osc-top{flex-direction:column;gap:32px}
  .a-osc-copy{max-width:640px;text-align:center}
  .a-osc-copy .a-ceja-osc{justify-content:center}
  .a-osc-p{margin-inline:auto}
  .a-osc-h2{font-size:32px}
  .a-osc-vis{flex:none;width:100%;margin-inline:auto}
  .a-pasos{flex-direction:column;align-items:center;height:auto;gap:12px}
  .a-paso-w{flex:none;width:100%;max-width:640px;flex-direction:column;align-self:auto;gap:12px}
  .a-paso{width:100%}
  .a-conectores{display:none}
  .a-pild-fila{margin-top:24px;height:auto}
  .a-pild{height:auto;padding:18px 24px}
  .a-prod{padding:72px 20px}
  .a-prod-head .a-h2{max-width:640px;font-size:32px}
  .a-prod-grid{margin-top:40px;max-width:588px}
  .a-prod-fila{flex-direction:column;gap:20px}
  .a-prod-fila + .a-prod-fila{margin-top:20px}
  .a-pcard{flex:0 0 auto}
  .a-int{gap:48px;padding-block:72px}
  .a-int-grid{flex-wrap:wrap}
  .a-int-celda{flex:1 0 44%}
  .a-int-celda + .a-int-celda{border-left:0}
  .a-int-celda:nth-child(even){border-left:1px solid #EFEFF1}
  .a-int-celda:nth-child(n + 3){border-top:1px solid #EFEFF1}
  .a-pr{gap:56px;padding:72px 20px}
  .a-pr-h2{font-size:32px;line-height:44px}
  .a-lift{max-width:820px;height:440px}
  .a-lift-panel{width:240px}
  .a-lift-cita{left:288px}
  .a-lift-q{font-size:18px;line-height:27px}
  .a-cierre{padding-block:72px}
  .a-cierre-h2{font-size:34px}
  .a-pie-in{flex-direction:column}
  .a-pie-cols{gap:48px}
}
@media (max-width:900px){
  .a-nav,.a-login{display:none}
  .a-menu{display:block}
  .a-barra-der{margin-left:auto}
}
@media (max-width:809px){
  .a-hero-in{padding-inline:20px}
  .a-hero-grid{gap:36px;padding-block:40px}
  .a-h1{font-size:28px}
  .a-h1 em{display:inline}
  .a-hero-p{font-size:16px;line-height:26px}
  .a-hero-etq{font-size:12px}
  .a-btn-az{width:100%;max-width:260px;min-width:0}
  .a-h2{font-size:28px;line-height:1.4}
  .a-tabs{padding-top:48px}
  .a-tabs-h2{font-size:24px}
  .a-tabs-h2 em{display:inline}
  .a-tab-fila{height:auto;display:grid;grid-template-columns:1fr 1fr}
  .a-tab-l{height:48px;border-bottom:1px solid rgba(0,0,0,.05)}
  .a-tab-l:nth-child(2n){border-right:0}
  .a-tab-l:last-child:nth-child(odd){grid-column:1 / -1}
  .a-tab-area{padding:24px}
  .a-panel{padding:16px}
  .a-panel-p{font-size:14px;line-height:23px}
  .a-panel-demo{padding:12px}
  .a-osc-top{padding-inline:20px}
  .a-osc-h2{font-size:28px}
  .a-osc-h2 em{display:inline}
  .a-pasos{padding:0 20px}
  .a-pild-fila{padding:0 20px}
  .a-pild-t{font-size:15px;white-space:normal;text-align:center}
  .a-prod{padding:56px 20px}
  .a-prod-head{gap:12px}
  .a-prod-head .a-h2{font-size:28px}
  .a-prod-head .a-h2 em{display:inline}
  .a-pcard{gap:20px;padding:20px;min-height:0}
  .a-pcard-h3{font-size:17px}
  .a-pcard-p{font-size:15px;line-height:24px}
  .a-cta-fila{margin-top:40px}
  .a-eq{padding-top:56px}
  .a-eq-head .a-h2 em{display:inline}
  .a-eq-cielo{padding:12px 12px 0}
  .a-eq-vidrio{padding:6px 6px 0}
  .a-enc-p{font-size:16px;line-height:26px}
  .a-int{gap:36px;padding-block:56px}
  .a-int-head{padding-inline:20px}
  .a-int-head .a-h2 em{display:inline}
  .a-int-filas{padding-inline:20px}
  .a-int-celda{flex:1 0 100%;border-left:0 !important}
  .a-int-celda + .a-int-celda{border-top:1px solid #EFEFF1}
  .a-pr{gap:40px;padding:56px 20px}
  .a-pr-h2{font-size:26px;line-height:36px}
  .a-pr-card{width:100%}
  .a-lift-sec{padding:0 20px 56px}
  .a-lift{height:420px}
  .a-lift-panel{top:auto;left:12px;right:12px;bottom:12px;width:auto;padding:20px}
  .a-lift-cifras{flex-direction:row;justify-content:space-between;gap:12px}
  .a-lift-v{font-size:28px}
  .a-lift-cita{left:20px;right:20px;top:20px;bottom:auto}
  .a-lift-q{font-size:16px;line-height:24px}
  .a-lift-quien{display:none}
  .a-cierre{padding-block:64px}
  .a-cierre-in{padding-inline:20px}
  .a-cierre-h2{font-size:26px}
  .a-cierre-p{font-size:16px;line-height:26px}
  .a-barra-in{padding:0 20px;gap:12px}
  .a-btn-barra{padding:0 16px}
  .a-pie{padding:64px 20px 48px}
  .a-pie-cols{grid-template-columns:repeat(2,minmax(0,1fr));gap:32px}
  .a-pie-cols .a-pie-col:nth-child(2) .a-pie-h{display:none}
  .a-pie-copy{margin-top:48px}
}
@media (prefers-reduced-motion:reduce){
  .a-raiz *,.a-raiz *::before,.a-raiz *::after{animation:none !important;transition:none !important}
}
`.replace(/\.a-/g, '.d-agenda-').replace(/\ba-(raya|respira|cinta-rev|cinta)\b/g, 'd-agenda-$1');

// =============================================================================
// El script (data-visor): las dos líneas de tiempo de iClosed y los videos.
//   · HERO: corre la vista (su video desde 0), la pastilla entra a su segundo, y al terminar el video (+1,2 s) la vista se achica y se
//     apaga mientras entra la otra; las pestañas de arriba siguen a la vista. Sólo mientras el escenario se ve.
//   · PESTAÑAS: la elegida corre su video desde 0, su barra se llena en lo que dura y la lista se marca de a un renglón; al terminar,
//     pasa sola a la siguiente. Tocar otra la arranca ahí. Sólo mientras la sección se ve.
//   · Los videos en bucle (banda oscura, equipo) corren sólo a la vista; las demos de «Lo que hace» entran al verse.
// Idempotente (`__listo`) y limpia lo que pudo dejar puesto (pulir.mjs guarda el DOM después de correrlo). Con «menos movimiento»:
// todo quieto, en el primer cuadro.
// =============================================================================
const SCRIPT = `(function(){
var P='d-agenda-';
function trasHidratar(fn){if(!document.querySelector('script[src*="/_next/"]'))return fn();var t0=Date.now();(function mira(){var h=Object.keys(document.body).some(function(k){return k.indexOf('__reactFiber')===0||k.indexOf('__reactProps')===0;});if(h||Date.now()-t0>6000)fn();else setTimeout(mira,60);})();}
function cada(r,s){return [].slice.call(r.querySelectorAll(s));}
function jugar(v){if(!v)return;v.muted=true;var p=v.play();if(p&&p.catch)p.catch(function(){});}
function iniciar(){
  var R=document.querySelector('.'+P+'raiz');if(!R||R.__listo)return;R.__listo=1;
  var quieto=!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);
  cada(R,'.'+P+'en-vista').forEach(function(e){e.classList.remove(P+'en-vista');});
  cada(R,'.'+P+'chk').forEach(function(e){e.classList.remove(P+'chk-on',P+'chk-ahora');});
  cada(R,'.'+P+'prog').forEach(function(e){e.style.transition='none';e.style.width='0';});
  cada(R,'.'+P+'vista').forEach(function(e,i){e.classList.remove(P+'vista-cerrando');e.classList.toggle(P+'vista-on',i===0);});
  cada(R,'.'+P+'chip').forEach(function(e,i){e.classList.toggle(P+'chip-on',i===0);});
  cada(R,'.'+P+'pastilla').forEach(function(e){e.classList.remove(P+'pastilla-on');});
  cada(R,'video').forEach(function(v){v.muted=true;if(quieto){v.removeAttribute('autoplay');v.pause();}});
  if(quieto||!('IntersectionObserver' in window)){R.removeAttribute('data-agenda-js');return;}
  R.setAttribute('data-agenda-js','');
  var obV=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting)jugar(e.target);else e.target.pause();});},{threshold:.25});
  cada(R,'video[data-bucle]').forEach(function(v){v.pause();obV.observe(v);});
  var obA=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add(P+'en-vista');obA.unobserve(e.target);}});},{threshold:.3});
  cada(R,'[data-aparece]').forEach(function(e){obA.observe(e);});
  var esc=R.querySelector('.'+P+'esc');
  if(esc){
    var vistas=cada(esc,'.'+P+'vista'),chips=cada(esc,'.'+P+'chip'),pil=esc.querySelector('.'+P+'pastilla'),pilT=esc.querySelector('.'+P+'pastilla-t');
    var h={i:0,t:[],vivo:false};
    var limpiar=function(){h.t.forEach(clearTimeout);h.t=[];};
    var pasar;
    var correr=function(i){
      limpiar();h.i=i;var v=vistas[i],vid=v.querySelector('video');
      pil.classList.remove(P+'pastilla-on');
      h.t.push(setTimeout(function(){pilT.textContent=v.getAttribute('data-pastilla');},360));
      try{vid.currentTime=0;}catch(e){}jugar(vid);
      h.t.push(setTimeout(function(){pil.classList.add(P+'pastilla-on');},(+v.getAttribute('data-pastilla-en'))*1000));
      var d=(vid.duration&&isFinite(vid.duration)?vid.duration:+v.getAttribute('data-dur'))*1000;
      h.t.push(setTimeout(function(){pasar((i+1)%vistas.length);},d+1200));
    };
    pasar=function(n){
      var viejo=vistas[h.i];
      viejo.classList.add(P+'vista-cerrando');viejo.classList.remove(P+'vista-on');
      vistas[n].classList.remove(P+'vista-cerrando');vistas[n].classList.add(P+'vista-on');
      chips.forEach(function(c,j){c.classList.toggle(P+'chip-on',j===n);});
      correr(n);
      h.t.push(setTimeout(function(){viejo.classList.remove(P+'vista-cerrando');viejo.querySelector('video').pause();},560));
    };
    pilT.textContent=vistas[0].getAttribute('data-pastilla');
    new IntersectionObserver(function(es){es.forEach(function(e){
      if(e.isIntersecting&&!h.vivo){h.vivo=true;correr(h.i);}
      else if(!e.isIntersecting&&h.vivo){h.vivo=false;limpiar();vistas.forEach(function(v){v.querySelector('video').pause();});}
    });},{threshold:.35}).observe(esc);
  }
  var caja=R.querySelector('.'+P+'tabs-caja');
  if(caja){
    var radios=cada(caja,'.'+P+'tab-in'),labels=cada(caja,'.'+P+'tab-l'),paneles=cada(caja,'.'+P+'panel');
    var t={t:[],vivo:false};
    var limpiarT=function(){t.t.forEach(clearTimeout);t.t=[];};
    var actual=function(){for(var i=0;i<radios.length;i++)if(radios[i].checked)return i;return 0;};
    var correrT=function(i){
      limpiarT();radios[i].checked=true;
      labels.forEach(function(l){var p=l.querySelector('.'+P+'prog');p.style.transition='none';p.style.width='0';});
      paneles.forEach(function(p,j){var v=p.querySelector('video');if(v&&j!==i)v.pause();});
      var pan=paneles[i],vid=pan.querySelector('video');
      var d=(vid&&vid.duration&&isFinite(vid.duration)?vid.duration:+pan.getAttribute('data-dur'))*1000;
      if(vid){try{vid.currentTime=0;}catch(e){}jugar(vid);}
      var prog=labels[i].querySelector('.'+P+'prog');void prog.offsetWidth;prog.style.transition='width '+d+'ms linear';prog.style.width='100%';
      var items=cada(pan,'.'+P+'chk');
      items.forEach(function(x){x.classList.remove(P+'chk-on',P+'chk-ahora');});
      items.forEach(function(x,k){t.t.push(setTimeout(function(){items.forEach(function(y,m){y.classList.toggle(P+'chk-on',m<=k);y.classList.toggle(P+'chk-ahora',m===k);});},400+k*d/items.length));});
      t.t.push(setTimeout(function(){correrT((i+1)%radios.length);},d));
    };
    radios.forEach(function(r,i){r.addEventListener('change',function(){if(r.checked&&t.vivo)correrT(i);});});
    new IntersectionObserver(function(es){es.forEach(function(e){
      if(e.isIntersecting&&!t.vivo){t.vivo=true;correrT(actual());}
      else if(!e.isIntersecting&&t.vivo){t.vivo=false;limpiarT();paneles.forEach(function(p){var v=p.querySelector('video');if(v)v.pause();});}
    });},{threshold:.3}).observe(caja);
  }
}
function arrancar(){trasHidratar(iniciar);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',arrancar);else arrancar();
})();`;
