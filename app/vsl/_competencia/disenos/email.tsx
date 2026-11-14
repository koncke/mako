// =============================================================================
// /vsl/email con el DISEÑO de la portada de beehiiv (https://www.beehiiv.com/), copiado el 11/11/2026
// =============================================================================
// Los valores (el fondo #060419 de toda la página, las tarjetas #0D0B28 con filete blanco al 6 % y radio 12, los titulares
// en mayúsculas 60/48/36 con su renglón en degradado, el texto 20/28 en #F7F5FF, el rótulo de color arriba de cada título,
// el botón de radio 6 con sus dos capas que se separan al pasar el mouse, las tarjetas por producto en filas de 2 a 1 y de
// 1 a 2, la cita centrada en su caja de borde #4E4E6C, las preguntas con su filete de 2 px a la derecha del título, la caja
// del cierre y el pie de columnas de links) se leyeron con getComputedStyle a 1440 y 390 px:
// docs/diseno/landings-competencia/email.md. De MaKo quedan el logo, el azul #2F6FED donde beehiiv pone su índigo
// (#2F39BA: los botones), el dorado donde pone su rosa (#FF5EC4: el renglón en degradado, los rótulos y las capas del
// botón), el botón de la llamada y los textos de ../email.ts.
//
// Fuentes: beehiiv usa Clash Grotesk y Satoshi (de Fontshare, no de Google Fonts). Van las de Google más parecidas:
// Archivo (variable, en 900 y al 88 % de ancho) para los titulares y Figtree para el texto.
//
// Secciones de la referencia que NO van, y por qué:
//   · La franja «Trusted by the world's top publishers…» con los logos de sus clientes, y en el hero las estrellas con
//     «4.9/5 from 28,479 customers»: clientes y contador suyos. Tampoco el segundo botón («Sign up with email»): MaKo
//     tiene un solo llamado a la acción.
//   · La imagen del hero (pantallas de su producto) → el gráfico de la landing, en una tarjeta blanca del mismo tamaño.
//   · En sus tarjetas por producto: los fondos de imagen y las capturas (media.beehiiv.com no se pudo leer desde aquí, así
//     que sus colores no se midieron), el «+» que da vuelta la tarjeta y el «Get started free →». Sus seis productos son
//     las secuencias de MaKo (la primera fila, con su gráfico) y las cuatro piezas de Email.
//   · Las tarjetas con fotos y cifras de sus clientes, los planes con precio y «The numbers tell the story»: clientes,
//     precios y contadores suyos. La cita es la de Mauricio, sin «Read the story» ni las flechas (es un solo caso).
//   · La imagen de sus integraciones → las fichas de lo que dispara una secuencia.
//   · En la caja del cierre, su «What are you waiting for?» va tal cual desde el 12/11/2026, con el botón de la llamada.
//   · En el pie: el formulario de su newsletter, sus links legales y de redes. Queda el lema de /vsl, las funciones de MaKo
//     en columnas y la estrella en el lugar de su isotipo.
// Server component sin JavaScript. Las animaciones son de CSS y se apagan con prefers-reduced-motion.
// =============================================================================

import type { PropsDiseno } from '.';
import type { Bloque } from '../tipos';
import { RUTA_CTA, CASO, EstrellaMaKo, LogoMaKo, TEXTO_CTA, html, otrasFunciones } from '../marca';
import { VisualDeLanding } from '../Visuales';
import { FEATURE_VISUALS } from '../../_detalle/feature-visuals';
import { Visual } from '../../_detalle/Visual';

type Hero = Extract<Bloque, { tipo: 'hero' }>;
type Tarjetas = Extract<Bloque, { tipo: 'tarjetas' }>;
type Filas = Extract<Bloque, { tipo: 'filas' }>;
type Logos = Extract<Bloque, { tipo: 'logos' }>;
type Preguntas = Extract<Bloque, { tipo: 'preguntas' }>;

/** Su botón: la cara de color y, debajo, dos capas que se corren al pasar el mouse. */
function Boton({ clase = '' }: { clase?: string }) {
  return (
    <a href={RUTA_CTA} className={`d-email-btn ${clase}`.trim()}>
      <span className="d-email-btn-t">{TEXTO_CTA}</span>
      <span className="d-email-btn-c2" aria-hidden="true" />
      <span className="d-email-btn-c1" aria-hidden="true" />
    </a>
  );
}

function Barra() {
  return (
    <header className="d-email-barra">
      <LogoMaKo className="d-email-logo" tamano={28} claro />
      <div className="d-email-barra-der">
        <a href="/vsl" className="d-email-barra-link">Todas las funcionalidades</a>
        <a href={RUTA_CTA} className="d-email-barra-btn">{TEXTO_CTA}</a>
      </div>
    </header>
  );
}

/** Su hero: el titular en mayúsculas con el último renglón en degradado, la bajada, el botón, la nota y la imagen a la derecha. */
function HeroD({ b }: { b: Hero }) {
  return (
    <section className="d-email-hero">
      <div className="d-email-cont d-email-hero-in">
        <div className="d-email-hero-txt">
          <h1 className="d-email-h1" dangerouslySetInnerHTML={html(b.titulo)} />
          <p className="d-email-hero-p" dangerouslySetInnerHTML={html(b.bajada)} />
          <div className="d-email-hero-btns"><Boton clase="d-email-btn-hero" /></div>
          {b.puntos?.length ? <p className="d-email-nota">{b.puntos.join('. ')}.</p> : null}
        </div>
        <div className="d-email-hero-vis">
          <div className="d-email-panel d-email-hero-panel"><VisualDeLanding visual={b.visual} /></div>
        </div>
      </div>
    </section>
  );
}

/** Su «Everything you need…»: rótulo y título a la izquierda, texto y botón a la derecha, y las tarjetas en filas de 2 a 1. */
function ProductoD({ b, filas }: { b: Tarjetas; filas?: Filas }) {
  const f = filas?.items[0];
  const pares: (Tarjetas['items'][number])[][] = [];
  for (let i = 0; i < b.items.length; i += 2) pares.push(b.items.slice(i, i + 2));
  return (
    <section className="d-email-sec d-email-producto">
      <div className="d-email-cont">
        <div className="d-email-cab">
          <div>
            {b.etiqueta ? <p className="d-email-rotulo">{b.etiqueta}</p> : null}
            <h2 className="d-email-h2" dangerouslySetInnerHTML={html(b.titulo)} />
          </div>
          <div className="d-email-cab-der">
            {b.bajada ? <p className="d-email-lede" dangerouslySetInnerHTML={html(b.bajada)} /> : null}
            <Boton />
          </div>
        </div>
        <div className="d-email-bento">
          {filas && f ? (
            <div className="d-email-fila d-email-fila-alta">
              <article className="d-email-card d-email-card-2 d-email-card-media">
                <div className="d-email-card-tx">
                  <h3 className="d-email-card-t" dangerouslySetInnerHTML={html(filas.titulo)} />
                  {filas.bajada ? <p className="d-email-card-p" dangerouslySetInnerHTML={html(filas.bajada)} /> : null}
                </div>
                <div className="d-email-panel d-email-card-panel" aria-hidden="true">
                  <Visual spec={FEATURE_VISUALS[filas.slug]?.groups?.[f.grafico ?? 0]} />
                </div>
              </article>
              <article className="d-email-card d-email-card-1">
                <div className="d-email-card-tx">
                  <h3 className="d-email-card-t" dangerouslySetInnerHTML={html(f.titulo)} />
                  <p className="d-email-card-p" dangerouslySetInnerHTML={html(f.texto)} />
                </div>
                {f.puntos?.length ? (
                  <ul className="d-email-subs">{f.puntos.map((p) => <li key={p} className="d-email-sub" dangerouslySetInnerHTML={html(p)} />)}</ul>
                ) : null}
              </article>
            </div>
          ) : null}
          {pares.map((par, i) => (
            // Como sus filas: la primera de producto es de 2 a 1, la siguiente de 1 a 2, y así.
            <div key={i} className={`d-email-fila${(i + (filas ? 1 : 0)) % 2 ? ' d-email-fila-inv' : ''}`}>
              {par.map((t) => (
                <article key={t.titulo} className="d-email-card">
                  <div className="d-email-card-tx">
                    <h3 className="d-email-card-t" dangerouslySetInnerHTML={html(t.titulo)} />
                    <p className="d-email-card-p" dangerouslySetInnerHTML={html(t.texto)} />
                  </div>
                </article>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Su «Trusted by names you know» (rótulo, título, texto y botón centrados) con su cita en la caja de borde. */
function ClientesD() {
  return (
    <section className="d-email-sec d-email-clientes">
      <div className="d-email-cont">
        <div className="d-email-centro">
          <p className="d-email-rotulo">Clientes</p>
          <h2 className="d-email-h2" dangerouslySetInnerHTML={html(CASO.titulo)} />
          <p className="d-email-lede">{CASO.sub}</p>
          <Boton />
        </div>
        <figure className="d-email-cita">
          {/* Su brillo: una elipse de su color de acento, desenfocada, asomando desde abajo de la caja. */}
          <svg className="d-email-cita-brillo" viewBox="0 0 1245.2 602.188" fill="none" preserveAspectRatio="none" aria-hidden="true">
            <g opacity="0.3" filter="url(#d-email-brillo)"><ellipse cx="622.6" cy="301.094" rx="372.6" ry="51.0938" fill={DORADO} /></g>
            <defs><filter id="d-email-brillo" x="0" y="0" width="1245.2" height="602.188" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB"><feGaussianBlur stdDeviation="125" /></filter></defs>
          </svg>
          <blockquote className="d-email-cita-t" dangerouslySetInnerHTML={html(CASO.historia[1])} />
          <figcaption className="d-email-cita-pie">
            <video className="d-email-cita-av" muted autoPlay loop playsInline preload="metadata" aria-label={`${CASO.quien}, en video`}>
              <source src={CASO.video} type="video/mp4" />
            </video>
            <span className="d-email-cita-n">{CASO.quien}</span>
            <span className="d-email-cita-r">{CASO.rol}</span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

/** Su «Powerful integrations»: el título a la izquierda, el botón a la derecha y, debajo, lo que conecta. */
function IntegracionesD({ b }: { b: Logos }) {
  return (
    <section className="d-email-sec d-email-integ">
      <div className="d-email-cont">
        <div className="d-email-cab d-email-cab-integ">
          <h2 className="d-email-h2" dangerouslySetInnerHTML={html(b.titulo)} />
          <div className="d-email-cab-der"><Boton /></div>
        </div>
        <ul className="d-email-logos">
          {b.items.map((l) => (
            <li key={l.nombre} className="d-email-logo-i">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <span className="d-email-logo-c"><img src={`/vsl-assets/logos/${l.logo}`} alt="" width={40} height={40} /></span>
              <span className="d-email-logo-n">{l.nombre}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Su «Have a question?»: el título a la izquierda y las preguntas a la derecha, cada una con su filete arriba. */
function PreguntasD({ b }: { b: Preguntas }) {
  return (
    <section className="d-email-sec d-email-faq">
      <div className="d-email-cont d-email-faq-in">
        <h2 className="d-email-h2 d-email-faq-h2" dangerouslySetInnerHTML={html(b.titulo)} />
        <div className="d-email-faq-l">
          {b.items.map((q) => (
            <details key={q.p} className="d-email-q">
              <summary>
                <h3 dangerouslySetInnerHTML={html(q.p)} />
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
              </summary>
              <p dangerouslySetInnerHTML={html(q.r)} />
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Su caja del cierre: su «What are you waiting for?» tal cual (12/11/2026) y el botón de la llamada. */
function Cierre() {
  return (
    <section className="d-email-cierre">
      <div className="d-email-cont">
        <div className="d-email-cierre-caja"><h2 className="d-email-h2 d-email-cierre-h">¿Empezamos?</h2><Boton /></div>
      </div>
    </section>
  );
}

function PieD({ slug }: { slug: string }) {
  return (
    <footer className="d-email-pie">
      <div className="d-email-cont">
        <div className="d-email-pie-in">
          <p className="d-email-pie-lema">El mejor software para vender High Ticket.</p>
          <div className="d-email-pie-cols">
            <p className="d-email-pie-h">Funciones de MaKo</p>
            <ul>{otrasFunciones(slug).map((x) => <li key={x.href}><a href={x.href}>{x.nombre}</a></li>)}</ul>
          </div>
        </div>
        <div className="d-email-pie-base">
          <p>© MaKo — Todos los derechos reservados.</p>
          <EstrellaMaKo size={32} />
        </div>
      </div>
    </footer>
  );
}

export default function DisenoEmail({ landing }: PropsDiseno) {
  const filas = landing.bloques.find((b): b is Filas => b.tipo === 'filas');
  return (
    <div className="d-email">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <Barra />
      <main>
        {landing.bloques.map((b, i) => {
          switch (b.tipo) {
            case 'hero': return <HeroD key={i} b={b} />;
            // Las secuencias son la primera fila de tarjetas de esta sección (su tarjeta grande de «Newsletters»).
            case 'tarjetas': return <ProductoD key={i} b={b} filas={filas ? { ...filas, slug: filas.slug || landing.slug } : undefined} />;
            case 'filas': return null;
            case 'caso': return <ClientesD key={i} />;
            case 'logos': return <IntegracionesD key={i} b={b} />;
            case 'preguntas': return <PreguntasD key={i} b={b} />;
            default: return null;
          }
        })}
        <Cierre />
      </main>
      <PieD slug={landing.slug} />
    </div>
  );
}

// Los valores salen de docs/diseno/landings-competencia/email.md (medidos el 11/11/2026). Su índigo #2F39BA → el azul de
// MaKo; su rosa #FF5EC4 → el dorado; sus rosas claros de las capas del botón y del degradado (#FFC8EB, #FFDCFF) → dorados
// claros.
const FONDO = '#060419';
const CARD = '#0D0B28';
const SUBCARD = '#1C1940';
const TEXTO = '#F7F5FF';
const GRIS = '#DDDCE8';
const GRIS2 = '#C4C2D6';
const GRIS3 = '#9393A9';
const LINEA = 'rgba(255,255,255,.06)';
const AZUL = '#2F6FED';
const DORADO = '#F2B01E';
const DORADO_CAPA = '#FBE3A6';
const DORADO_CLARO = '#FDF0CC';
const TITULAR = `font-family:'d-email-archivo',Arial,sans-serif;font-weight:900;font-stretch:88%;text-transform:uppercase`;
const CSS = `
@font-face{font-family:'d-email-archivo';src:url('/vsl-assets/fuentes/archivo/archivo-latin-wdth-wght.woff2') format('woff2');font-weight:100 900;font-stretch:62% 125%;font-display:swap}
@font-face{font-family:'d-email-figtree';src:url('/vsl-assets/fuentes/figtree/figtree-latin.woff2') format('woff2');font-weight:300 900;font-display:swap}
.d-email{background:${FONDO};color:#fff;font-family:'d-email-figtree',Arial,sans-serif;font-size:16px;line-height:24px;-webkit-font-smoothing:antialiased;overflow-x:hidden}
.d-email *{box-sizing:border-box}
:where(.d-email) :where(h1,h2,h3,p,ul,li,figure,blockquote){margin:0;padding:0}
:where(.d-email) :where(ul){list-style:none}
:where(.d-email) :where(a){text-decoration:none;color:inherit}
.d-email-cont{max-width:1440px;margin:0 auto;padding:0 128px}

/* La barra: 77 px (20 arriba y abajo, 128 a los lados), filete abajo blanco al 12 %, pegada arriba. */
.d-email-barra{position:sticky;top:0;z-index:50;display:flex;align-items:center;justify-content:space-between;padding:20px 128px;background:${FONDO};border-bottom:1px solid rgba(255,255,255,.12)}
.d-email-logo{font-family:'d-email-figtree',Arial,sans-serif}
.d-email-barra-der{display:flex;align-items:center;gap:12px}
.d-email-barra-link,.d-email-barra-btn{display:inline-flex;align-items:center;font-size:14px;line-height:20px;font-weight:600;padding:7px 12px;border-radius:6px;border:1px solid rgba(255,255,255,.2);color:#fff;transition:background-color .15s,color .15s}
.d-email-barra-link:hover{background:rgba(255,255,255,.08)}
.d-email-barra-btn{background:#fff;border-color:#fff;color:${FONDO}}
.d-email-barra-btn:hover{background:${GRIS}}

/* El botón: la cara azul de radio 6 y, debajo, las dos capas (dorado claro y dorado) que se separan 6 y 12 px al pasar el mouse. */
.d-email-btn{position:relative;display:inline-flex;transition:transform .125s ease-out}
.d-email-btn:hover{transform:scale(1.02)}
.d-email-btn-t{position:relative;z-index:10;display:inline-flex;align-items:center;justify-content:center;background:${AZUL};border:1px solid ${AZUL};border-radius:6px;padding:8px 24px;font-size:18px;line-height:28px;font-weight:700;color:#fff;white-space:nowrap;transition:transform .125s ease-out}
.d-email-btn-c1,.d-email-btn-c2{position:absolute;inset:1px;border:1px solid #0B0D2A;border-radius:6px;transition:transform .125s ease-out}
.d-email-btn-c1{background:${DORADO_CAPA}}
.d-email-btn-c2{background:${DORADO}}
.d-email-btn:hover .d-email-btn-t{transform:translate(-18px,-18px)}
.d-email-btn:hover .d-email-btn-c1{transform:translate(-12px,-12px)}
.d-email-btn:hover .d-email-btn-c2{transform:translate(-6px,-6px)}
.d-email-btn-hero .d-email-btn-t{padding:10px 24px}

/* El hero: 96 arriba y abajo; dos columnas de 576 con 32 de separación; la imagen de 634 × 475 centrada en la de la derecha. */
.d-email-hero{padding:96px 0}
.d-email-hero-in{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:32px;align-items:center}
.d-email-h1{${TITULAR};font-size:60px;line-height:60px;color:#fff}
.d-email-h1 em{font-style:normal;background:linear-gradient(to right,${DORADO_CLARO},${DORADO});-webkit-background-clip:text;background-clip:text;color:transparent}
.d-email-hero-p{margin-top:16px;max-width:512px;font-size:20px;line-height:28px;font-weight:500;color:${TEXTO}}
.d-email-hero-p strong{font-weight:700;color:#fff}
.d-email-hero-btns{margin-top:32px;display:flex;gap:16px}
.d-email-nota{margin-top:16px;font-size:14px;line-height:20px;color:#B8B8C8}
.d-email-hero-vis{position:relative;display:flex;align-items:center;justify-content:center;min-height:420px}
.d-email-panel{background:#fff;border-radius:12px;overflow:hidden}
.d-email-panel svg{display:block;width:100%;height:auto}
.d-email-hero-panel{width:min(634px,calc(100% + 58px));flex:none}

/* Las secciones: 96 arriba y abajo. El rótulo 14/20 de color, 8 px arriba del título 48/48; a la derecha el texto 20/28 y el botón. */
.d-email-sec{padding:96px 0}
.d-email-rotulo{font-size:14px;line-height:20px;font-weight:500;color:${DORADO}}
.d-email-h2{${TITULAR};font-size:48px;line-height:48px;color:#fff;margin-top:8px}
.d-email-lede{font-size:20px;line-height:28px;font-weight:500;color:#fff}
.d-email-cab{display:grid;grid-template-columns:569px 557px;justify-content:space-between;align-items:end}
.d-email-cab-der{display:flex;flex-direction:column;align-items:flex-start;gap:24px}

/* Las tarjetas: filas de 2 a 1 (y de 1 a 2) con 24 de separación; #0D0B28, filete blanco al 6 %, radio 12, 24 de aire. */
.d-email-bento{margin-top:64px;display:flex;flex-direction:column;gap:24px}
.d-email-fila{display:flex;gap:24px}
.d-email-fila > :nth-child(1){flex:2 1 0;min-width:0}
.d-email-fila > :nth-child(2){flex:1 1 0;min-width:0}
.d-email-fila-inv > :nth-child(1){flex:1 1 0}
.d-email-fila-inv > :nth-child(2){flex:2 1 0}
.d-email-fila-alta{min-height:608px}
.d-email-card{position:relative;overflow:hidden;background:${CARD};border:1px solid ${LINEA};border-radius:12px;padding:24px;transition:border-color .2s}
.d-email-card:hover{border-color:rgba(255,255,255,.14)}
.d-email-card-tx{display:flex;flex-direction:column;gap:8px}
.d-email-card-t{font-size:24px;line-height:32px;font-weight:700;color:#fff}
.d-email-card-p{font-size:18px;line-height:28px;font-weight:500;color:${TEXTO}}
.d-email-card-p strong{font-weight:700;color:#fff}
.d-email-card-panel{position:absolute;left:85px;top:155px;width:640px}
.d-email-subs{margin-top:24px;display:flex;flex-direction:column;gap:12px}
.d-email-sub{background:${SUBCARD};border-radius:12px;padding:20px 16px;font-size:14px;line-height:20px;font-weight:500;color:#fff}

/* «Trusted by names you know»: todo centrado (el texto en 770 px) y la cita en su caja de 1184 × 520, borde #4E4E6C y radio 8. */
.d-email-centro{display:flex;flex-direction:column;align-items:center;text-align:center}
.d-email-centro .d-email-h2{max-width:1000px}
.d-email-centro .d-email-lede{margin-top:12px;max-width:770px}
.d-email-centro .d-email-btn{margin-top:24px}
.d-email-cita{position:relative;isolation:isolate;overflow:hidden;margin-top:64px;min-height:520px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:80px 64px;border:1px solid #4E4E6C;border-radius:8px;background:${CARD} linear-gradient(-11.046deg,rgba(78,78,108,0) 66.952%,rgba(152,152,210,.04) 99.472%)}
.d-email-cita-brillo{position:absolute;z-index:-1;left:-.68%;top:42.9%;width:101.9%;height:136.7%;pointer-events:none}
.d-email-cita-t{max-width:755px;font-size:30px;line-height:36px;font-weight:500;color:#fff}
.d-email-cita-t strong{font-weight:500}
.d-email-cita-pie{margin-top:32px;display:flex;flex-direction:column;align-items:center}
.d-email-cita-av{width:48px;height:48px;border-radius:9999px;object-fit:cover;border:1px solid rgba(255,255,255,.12);margin-bottom:12px}
.d-email-cita-n{font-size:16px;line-height:24px;font-weight:700;color:#fff}
.d-email-cita-r{font-size:18px;line-height:28px;font-weight:500;color:${GRIS2}}

/* «Powerful integrations»: el título de 576 a la izquierda, el botón a la derecha, y a 64 px la franja de 1184 × 237. */
.d-email-cab-integ{grid-template-columns:576px auto;align-items:end}
.d-email-cab-integ .d-email-h2{margin-top:0}
.d-email-logos{margin-top:64px;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:16px;min-height:237px}
.d-email-logo-i{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;background:${CARD};border:1px solid ${LINEA};border-radius:12px;padding:24px 16px;text-align:center}
.d-email-logo-c{display:flex;align-items:center;justify-content:center;width:72px;height:72px;border-radius:16px;background:#fff}
.d-email-logo-c img{width:40px;height:40px;object-fit:contain}
.d-email-logo-n{font-size:16px;line-height:24px;font-weight:500;color:${GRIS}}

/* «Have a question?»: el título en 352 px y las preguntas en 768 a partir de x = 544; filete de 2 px #4E4E6C arriba de cada una. */
.d-email-faq-in{display:grid;grid-template-columns:352px 768px;justify-content:space-between;align-items:start}
.d-email-faq-h2{margin-top:0}
.d-email-q summary{display:flex;align-items:center;justify-content:space-between;padding:24px 16px;border-top:2px solid #4E4E6C;cursor:pointer;list-style:none;font-size:18px;line-height:28px;font-weight:500}
.d-email-q summary::-webkit-details-marker{display:none}
.d-email-q h3{padding-right:8px;font-size:20px;line-height:28px;font-weight:600;color:#fff}
.d-email-q summary svg{flex:none;color:#fff;transition:transform .3s cubic-bezier(.4,0,.2,1)}
.d-email-q[open] summary svg{transform:rotate(180deg)}
.d-email-q p{padding:0 16px 24px;font-size:20px;line-height:28px;font-weight:500;color:${TEXTO}}

/* La caja del cierre: 64 arriba y abajo, 1184 de ancho, #0D0B28 con borde del color de marca al 50 % y radio 12. */
.d-email-cierre{padding:64px 0}
.d-email-cierre-h{margin-top:0}
.d-email-cierre-caja{display:flex;flex-direction:column;gap:32px;text-align:center;align-items:center;justify-content:center;padding:97px 24px;background:${CARD};border:1px solid rgba(47,111,237,.5);border-radius:12px}

/* El pie: filete arriba, 64 de aire; el lema a la izquierda (384 px) y las columnas de links a partir de x = 624. */
.d-email-pie{border-top:1px solid ${LINEA};padding:64px 0}
.d-email-pie-in{display:grid;grid-template-columns:384px 688px;justify-content:space-between;padding-bottom:48px;border-bottom:1px solid ${LINEA}}
.d-email-pie-lema{font-size:16px;line-height:24px;font-weight:700;color:#fff}
.d-email-pie-h{font-size:14px;line-height:20px;font-weight:700;color:#fff;margin-bottom:16px}
.d-email-pie-cols ul{columns:4;column-gap:40px}
.d-email-pie-cols li{font-size:14px;line-height:20px;font-weight:500;padding-bottom:12px;break-inside:avoid}
.d-email-pie-cols a{color:${GRIS3};border-radius:6px;transition:color .15s}
.d-email-pie-cols a:hover{color:#fff}
.d-email-pie-base{display:flex;align-items:center;justify-content:space-between;padding-top:32px}
.d-email-pie-base p{font-size:14px;line-height:20px;font-weight:500;color:${GRIS2}}

/* De 1280 para abajo: 32 de aire a los lados. */
@media (max-width:1279px){
  .d-email-cont{padding:0 32px}
  .d-email-barra{padding:20px 32px}
  .d-email-cab{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:48px}
  .d-email-cab-integ{grid-template-columns:minmax(0,1fr) auto}
  .d-email-faq-in{grid-template-columns:minmax(0,1fr) minmax(0,2.2fr);gap:48px}
  .d-email-pie-in{grid-template-columns:minmax(0,1fr) minmax(0,1.8fr);gap:48px}
  .d-email-card-panel{left:48px;width:min(640px,calc(100% - 48px))}
}
/* Como su hero, que pasa a una columna debajo de 890 px. */
@media (max-width:889px){
  .d-email-hero-in{grid-template-columns:minmax(0,1fr)}
  .d-email-hero-vis{min-height:0}
  .d-email-hero-panel{width:100%}
  .d-email-pie-cols ul{columns:2}
}
/* A 390: 40 de aire en cada sección, 20 a los lados, titulares 42/44 y 36/40, todo en una columna. */
@media (max-width:767px){
  .d-email-cont{padding:0 20px}
  .d-email-barra{padding:10px 16px}
  .d-email-barra-link{display:none}
  .d-email-hero{padding:40px 0}
  .d-email-h1{font-size:42px;line-height:44px}
  .d-email-hero-p{margin-top:8px;max-width:none}
  .d-email-hero-btns{margin-top:24px}
  .d-email-hero-btns .d-email-btn{width:100%}
  .d-email-hero-btns .d-email-btn-t{width:100%}
  .d-email-hero-vis{margin-top:32px}
  .d-email-btn-t{font-size:16px;line-height:24px}
  .d-email-btn-hero .d-email-btn-t{padding:10px 24px}
  .d-email-btn:hover,.d-email-btn:hover .d-email-btn-t,.d-email-btn:hover .d-email-btn-c1,.d-email-btn:hover .d-email-btn-c2{transform:none}
  .d-email-sec{padding:40px 0}
  .d-email-h2{font-size:36px;line-height:40px}
  .d-email-lede{font-size:18px;line-height:28px}
  .d-email-cab,.d-email-cab-integ{grid-template-columns:minmax(0,1fr);gap:24px}
  .d-email-bento{margin-top:40px;gap:16px}
  .d-email-fila{flex-direction:column;gap:16px}
  .d-email-bento .d-email-fila > :nth-child(n){flex:none}
  .d-email-fila-alta{min-height:0}
  .d-email-card-t{font-size:20px;line-height:28px}
  .d-email-card-p{font-size:16px;line-height:24px}
  .d-email-card-media{padding-bottom:24px}
  .d-email-card-panel{position:static;width:auto;margin:32px -24px 0 0;border-radius:12px 0 0 12px}
  .d-email-cita{margin-top:40px;min-height:480px;padding:40px 20px}
  .d-email-cita-t{font-size:18px;line-height:28px}
  .d-email-cita-r{font-size:16px;line-height:24px}
  .d-email-cab-integ .d-email-btn,.d-email-cab-integ .d-email-btn-t{width:100%}
  .d-email-logos{margin-top:40px;grid-template-columns:minmax(0,1fr);gap:8px;min-height:0}
  .d-email-logo-i{flex-direction:row;justify-content:flex-start;padding:12px 16px}
  .d-email-logo-c{width:48px;height:48px;border-radius:12px}
  .d-email-logo-c img{width:28px;height:28px}
  .d-email-faq-in{grid-template-columns:minmax(0,1fr);gap:48px}
  .d-email-cierre{padding:40px 0}
  .d-email-cierre-caja{padding:64px 24px}
  .d-email-cierre-caja .d-email-btn,.d-email-cierre-caja .d-email-btn-t{width:100%}
  .d-email-pie{padding:40px 0}
  .d-email-pie .d-email-cont{display:flex;flex-direction:column;padding:0 16px}
  .d-email-pie-in{display:contents}
  .d-email-pie-cols{order:1}
  .d-email-pie-base{order:2;margin-top:32px;padding-top:32px;border-top:1px solid ${LINEA}}
  .d-email-pie-lema{order:3;margin-top:40px}
}
@media (prefers-reduced-motion:reduce){
  .d-email *{animation:none!important;transition:none!important}
}
`;
