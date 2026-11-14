// =============================================================================
// /vsl/funnel con el DISEÑO de la portada de Hyros (https://hyros.com/), copiado el 11/11/2026
// =============================================================================
// Los valores (la sans del sistema, que es lo que Hyros dibuja; la escala 46/58/56/44/38 en peso 400–500; el crema #FAF9F5
// con el hero blanco; la píldora, el renglón resaltado en una caja de color, los botones negro y arena de radio 7, la
// ventana de la app con su barra y su pie, las tarjetas de pasos de radio 22, la ventana de cifras en cuatro columnas, los
// renglones en cajas de borde gris, la banda de modelos de negocio con sus filas translúcidas y el pie de cuatro columnas)
// se leyeron con getComputedStyle a 1440 y 390 px: docs/diseno/landings-competencia/funnel.md. De MaKo quedan el logo, el
// azul #2F6FED donde Hyros pone su violeta (#5150F6: cajas resaltadas, píldoras, números, la banda), el dorado como
// detalle (el punto de las píldoras), el botón de la llamada y los textos de ../funnel.ts.
//
// Secciones de la referencia que NO van, y por qué:
//   · La franja roja de Black Friday, su «Proven to increase ad ROI 15–20%» y la cita de Tony Robbins: oferta, cifra y
//     testimonio suyos. En la píldora va la etiqueta del hero.
//   · «Tracking $5B+ in ad spend for:» con sus nombres: va el caso de Mauricio con la misma línea y las mismas fichas (sus
//     tres meses y su video).
//   · Las escenas ilustradas de arriba de cada paso: son pantallas de su producto; la tarjeta queda con el número, el título
//     y el texto.
//   · En la ventana de cifras, sus números, sus curvas y su pie «Guaranteed or you don't pay»: la ventana lleva lo que MaKo
//     le avisa a Meta, evento por evento, sin cifras.
//   · «All / All / None», «What could you build with the Hyros MCP?» y la caja de la garantía: no hay contenido de MaKo.
//   · El cubo de «When we say any feature» y sus etiquetas: va el gráfico del recorrido de la landing; las integraciones de su
//     cara de arriba son las fichas de lo que junta MaKo, en la misma grilla girada.
//   · «Show me how →» de cada modelo de negocio (lleva a sus páginas) y las insignias del pie.
// Server component sin JavaScript. Las animaciones son de CSS y se apagan con prefers-reduced-motion.
// =============================================================================

import type { PropsDiseno } from '.';
import type { Bloque } from '../tipos';
import { RUTA_CTA, CASO, EstrellaMaKo, LogoMaKo, TEXTO_CTA, html, otrasFunciones } from '../marca';
import { VisualDeLanding } from '../Visuales';
import { FaltaAnimacion } from '../FaltaAnimacion';
import { FEATURE_VISUALS } from '../../_detalle/feature-visuals';
import { Visual } from '../../_detalle/Visual';

type Hero = Extract<Bloque, { tipo: 'hero' }>;
type Pasos = Extract<Bloque, { tipo: 'pasos' }>;
type Tarjetas = Extract<Bloque, { tipo: 'tarjetas' }>;
type Filas = Extract<Bloque, { tipo: 'filas' }>;
type Logos = Extract<Bloque, { tipo: 'logos' }>;

const ANCLA_PASOS = 'd-funnel-pasos';

function Ico({ paths, size = 24, grueso = 1.6 }: { paths?: string[]; size?: number; grueso?: number }) {
  if (!paths?.length) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={grueso} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths.map((d) => <path key={d} d={d} />)}
    </svg>
  );
}

function Puntos() {
  return <span className="d-funnel-puntos" aria-hidden="true"><i /><i /><i /></span>;
}

function Barra() {
  return (
    <header className="d-funnel-barra">
      <div className="d-funnel-cont d-funnel-barra-in">
        <LogoMaKo className="d-funnel-logo" tamano={26} />
        <div className="d-funnel-barra-der">
          <a href="/vsl" className="d-funnel-barra-link">Todas las funcionalidades</a>
          <a href={RUTA_CTA} className="d-funnel-barra-btn">{TEXTO_CTA}</a>
        </div>
      </div>
    </header>
  );
}

/** Su hero: la píldora, el título con su segundo renglón en una caja de color, la bajada, los dos botones y la ventana de la app. */
function HeroD({ b, nombre, pasos }: { b: Hero; nombre: string; pasos?: Pasos }) {
  const [p1, p2] = b.puntos ?? [];
  return (
    <section className="d-funnel-hero">
      <div className="d-funnel-cont d-funnel-hero-in">
        <div className="d-funnel-hero-txt">
          <span className="d-funnel-pill">{b.etiqueta}</span>
          <h1 className="d-funnel-h1" dangerouslySetInnerHTML={html(b.titulo)} />
          <p className="d-funnel-sub" dangerouslySetInnerHTML={html(b.bajada)} />
          <div className="d-funnel-btns">
            <a href={RUTA_CTA} className="d-funnel-btn-osc">{TEXTO_CTA} <i aria-hidden="true">→</i></a>
            {pasos?.etiqueta ? <a href={`#${ANCLA_PASOS}`} className="d-funnel-btn-suave">{pasos.etiqueta} <i aria-hidden="true">↓</i></a> : null}
          </div>
        </div>
        <div className="d-funnel-ventana d-funnel-hero-win">
          {/* Sin la barra de ventana inventada (12/11/2026, noche): el visual es la app real o el recuadro de lo que falta. */}
          <div className="d-funnel-win-cuerpo"><VisualDeLanding visual={b.visual} /></div>
          {p1 ? <p className="d-funnel-win-pie" dangerouslySetInnerHTML={html(`${p1}.${p2 ? ` <b>${p2}.</b>` : ''}`)} /> : null}
        </div>
      </div>
    </section>
  );
}

/** Su «Tracking $5B+ in ad spend for:»: la línea centrada y las fichas. */
function Caso() {
  return (
    <section className="d-funnel-prueba">
      <p className="d-funnel-prueba-l"><span dangerouslySetInnerHTML={html(CASO.titulo)} /> {CASO.sub}</p>
      <ul className="d-funnel-chips">
        <li className="d-funnel-chip d-funnel-chip-video">
          <video muted autoPlay loop playsInline preload="metadata" aria-label={`${CASO.quien}, en video`}><source src={CASO.video} type="video/mp4" /></video>
          {CASO.quien}
        </li>
        {CASO.meses.map((m, i) => (
          <li key={m.mes} className={`d-funnel-chip${i === CASO.meses.length - 1 ? ' d-funnel-chip-marca' : ''}`}>{m.mes} {m.monto}</li>
        ))}
      </ul>
    </section>
  );
}

/** Su «How it works»: la píldora, el título con su caja, la bajada y tres tarjetas numeradas. */
function PasosD({ b }: { b: Pasos }) {
  return (
    <section id={ANCLA_PASOS} className="d-funnel-pasos">
      <div className="d-funnel-cont">
        {b.etiqueta ? <p className="d-funnel-pill-blanca"><i aria-hidden="true" />{b.etiqueta}</p> : null}
        <h2 className="d-funnel-h2-grande" dangerouslySetInnerHTML={html(b.titulo)} />
        {b.bajada ? <p className="d-funnel-lede" dangerouslySetInnerHTML={html(b.bajada)} /> : null}
        <ol className="d-funnel-pasos-g">
          {b.pasos.map((p, i) => (
            <li key={p.titulo} className="d-funnel-paso">
              <span className="d-funnel-paso-n">{String(i + 1).padStart(2, '0')}</span>
              <h3 className="d-funnel-paso-t" dangerouslySetInnerHTML={html(p.titulo)} />
              <p className="d-funnel-paso-s" dangerouslySetInnerHTML={html(p.texto)} />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** Su «Brands that add Hyros see»: el ícono, el título, la bajada y, donde va su ventana, la pantalla real de MaKo. */
function Cifras({ b, icono }: { b: Tarjetas; icono: string[] }) {
  return (
    <section className="d-funnel-cifras">
      <div className="d-funnel-cont">
        <span className="d-funnel-cifras-ic"><Ico paths={icono} size={64} grueso={1.1} /><i aria-hidden="true" /></span>
        <h2 className="d-funnel-h2" dangerouslySetInnerHTML={html(b.titulo)} />
        {b.bajada ? <p className="d-funnel-lede" dangerouslySetInnerHTML={html(b.bajada)} /> : null}
        {/* Va la pantalla real de los eventos (12/11/2026: la ventana dibujada a mano se sacó). */}
        <div className="d-funnel-cifras-falta"><FaltaAnimacion que="La pantalla real de los eventos que Funnel manda a Meta." /></div>
      </div>
    </section>
  );
}

/** Su «When we say any feature»: la píldora, los renglones en cajas y, a la derecha, el visual con su nota. */
function Renglones({ b }: { b: Filas }) {
  const primero = b.items[0];
  return (
    <section className="d-funnel-renglones">
      <div className="d-funnel-cont d-funnel-renglones-in">
        <div className="d-funnel-renglones-txt">
          {b.etiqueta ? <p className="d-funnel-pill-gris">{b.etiqueta}</p> : null}
          <h2 className="d-funnel-cajas" dangerouslySetInnerHTML={html(b.titulo)} />
          <div className="d-funnel-lista">
            {b.items.map((f) => (
              <div key={f.titulo} className="d-funnel-lista-i">
                <h3 dangerouslySetInnerHTML={html(f.titulo)} />
                <p dangerouslySetInnerHTML={html(f.texto)} />
                {f.puntos?.length ? <ul>{f.puntos.map((p) => <li key={p} dangerouslySetInnerHTML={html(p)} />)}</ul> : null}
              </div>
            ))}
          </div>
        </div>
        <div className="d-funnel-renglones-media">
          {b.bajada ? <p className="d-funnel-nota"><i aria-hidden="true" /><span dangerouslySetInnerHTML={html(b.bajada)} /></p> : null}
          {primero ? <div className="d-funnel-ventana d-funnel-renglones-win" aria-hidden="true"><Visual spec={FEATURE_VISUALS[b.slug]?.groups?.[primero.grafico ?? 0]} /></div> : null}
        </div>
      </div>
    </section>
  );
}

/** La cara de arriba de su cubo: las integraciones en baldosas, en la misma grilla girada, con MaKo en la del centro. */
function Integraciones({ b }: { b: Logos }) {
  // La del centro de la grilla de 3 × 3 (la quinta) es la de MaKo, como su baldosa de color en el centro del cubo.
  const medio = Math.min(4, b.items.length);
  const baldosas = [...b.items.slice(0, medio), null, ...b.items.slice(medio)];
  return (
    <section className="d-funnel-integ" aria-label={b.titulo}>
      <p className="d-funnel-integ-t" dangerouslySetInnerHTML={html(b.titulo)} />
      <div className="d-funnel-cubo">
        <ul className="d-funnel-cubo-g">
          {baldosas.map((l, i) => l
            // eslint-disable-next-line @next/next/no-img-element
            ? <li key={l.nombre} className="d-funnel-baldosa"><img src={`/vsl-assets/logos/${l.logo}`} alt="" width={30} height={30} /><span>{l.nombre}</span></li>
            : <li key={`mako-${i}`} className="d-funnel-baldosa d-funnel-baldosa-mako"><EstrellaMaKo size={34} /></li>)}
        </ul>
      </div>
    </section>
  );
}

/** Su banda «See how Hyros Works. Pick your business model.»: el título a la izquierda y las filas translúcidas a la derecha. */
function Modelos({ b }: { b: Tarjetas }) {
  return (
    <section className="d-funnel-modelos">
      <div className="d-funnel-cont d-funnel-modelos-in">
        <div>
          {b.etiqueta ? <p className="d-funnel-modelos-k">{b.etiqueta}</p> : null}
          <h2 className="d-funnel-modelos-h2" dangerouslySetInnerHTML={html(b.titulo)} />
          {b.bajada ? <p className="d-funnel-modelos-b" dangerouslySetInnerHTML={html(b.bajada)} /> : null}
        </div>
        <ul className="d-funnel-modelos-l">
          {b.items.map((t, i) => (
            <li key={t.titulo} className="d-funnel-modelo">
              <i className="d-funnel-modelo-n">{String(i + 1).padStart(2, '0')}</i>
              <span className="d-funnel-modelo-ic"><Ico paths={t.icono} size={28} grueso={1.8} /></span>
              <span className="d-funnel-modelo-tx">
                <span className="d-funnel-modelo-t" dangerouslySetInnerHTML={html(t.titulo)} />
                <span className="d-funnel-modelo-s" dangerouslySetInnerHTML={html(t.texto)} />
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function PieD({ slug }: { slug: string }) {
  return (
    <footer className="d-funnel-pie">
      <div className="d-funnel-cont">
        <div className="d-funnel-pie-in">
          <div className="d-funnel-pie-marca">
            <LogoMaKo tamano={26} />
            <p>El mejor software para vender High Ticket.</p>
          </div>
          <div className="d-funnel-pie-cols">
            <p className="d-funnel-pie-h">Funciones de MaKo</p>
            <ul>{otrasFunciones(slug).map((f) => <li key={f.href}><a href={f.href}>{f.nombre}</a></li>)}</ul>
          </div>
        </div>
        <div className="d-funnel-pie-base"><p>© MaKo — Todos los derechos reservados.</p></div>
      </div>
    </footer>
  );
}

export default function DisenoFunnel({ landing }: PropsDiseno) {
  const pasos = landing.bloques.find((b): b is Pasos => b.tipo === 'pasos');
  let tarjetasVistas = 0;
  return (
    <div className="d-funnel">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <Barra />
      <main>
        {landing.bloques.map((b, i) => {
          switch (b.tipo) {
            case 'hero': return <HeroD key={i} b={b} nombre={landing.nombre} pasos={pasos} />;
            case 'caso': return <Caso key={i} />;
            case 'pasos': return <PasosD key={i} b={b} />;
            // La primera grilla de tarjetas es la ventana de cifras («Brands that add Hyros see»); la segunda, la banda de
            // modelos de negocio («Pick your business model»): las dos en el orden de la referencia.
            case 'tarjetas': return tarjetasVistas++ === 0 ? <Cifras key={i} b={b} icono={landing.icono} /> : <Modelos key={i} b={b} />;
            case 'filas': return <Renglones key={i} b={{ ...b, slug: b.slug || landing.slug }} />;
            case 'logos': return <Integraciones key={i} b={b} />;
            default: return null;
          }
        })}
      </main>
      <PieD slug={landing.slug} />
    </div>
  );
}

// Los valores salen de docs/diseno/landings-competencia/funnel.md (medidos el 11/11/2026). Su violeta #5150F6 → el azul de
// MaKo; sus tintes del violeta (#EEEEFB, #CFCEFF, #D3D2FF, #A5A4FA) → los mismos tintes del azul.
const AZUL = '#2F6FED';
const AZUL_OSC = '#1F57C8';
const TINTE = '#EAF0FD';
const DORADO = '#F2B01E';
const TINTA = '#1F1E1D';
const GRIS = '#55534E';
const LINEA = 'rgba(31,30,29,.11)';
const CSS = `
.d-funnel{background:#FAF9F5;color:${TINTA};font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:normal;-webkit-font-smoothing:antialiased;overflow-x:hidden}
.d-funnel *{box-sizing:border-box}
:where(.d-funnel) :where(h1,h2,h3,p,ul,ol,li){margin:0;padding:0}
:where(.d-funnel) :where(ul,ol){list-style:none}
:where(.d-funnel) :where(a){text-decoration:none;color:inherit}
:where(.d-funnel) :where(i,em,b){font-style:normal}
.d-funnel-cont{max-width:1180px;margin:0 auto;padding:0 32px}
.d-funnel-marca{color:${AZUL}!important}

/* La barra: 56 px sobre el crema, el logo a la izquierda, «Login» con borde y «Book Demo» negro, los dos de radio 6. */
.d-funnel-barra-in{height:56px;display:flex;align-items:center;justify-content:space-between}
.d-funnel-logo{font-family:Helvetica,Arial,sans-serif}
.d-funnel-barra-der{display:flex;align-items:center;gap:8px}
.d-funnel-barra-link{font-size:12.5px;line-height:12.5px;color:rgba(31,30,29,.85);padding:7px 11px;border:1px solid rgba(31,30,29,.16);border-radius:6px;transition:background .15s,border-color .15s}
.d-funnel-barra-link:hover{background:#fff;border-color:rgba(31,30,29,.3)}
.d-funnel-barra-btn{font-size:12.5px;line-height:12.5px;color:#fff;background:${TINTA};padding:8px 11px;border-radius:6px;transition:background .15s}
.d-funnel-barra-btn:hover{background:#3a3835}

/* El hero: blanco con su filete de arriba, 72 px arriba y 84 abajo; el texto en 516 px y la ventana de 608 a la derecha. */
.d-funnel-hero{background:#fff;border-top:1px solid ${LINEA};padding:72px 0 0}
.d-funnel-hero .d-funnel-cont{padding:0}
.d-funnel-hero-in{display:grid;grid-template-columns:516px minmax(0,608px);justify-content:space-between;align-items:center;column-gap:56px}
.d-funnel-pill{display:inline-block;font-size:12.5px;line-height:16.25px;font-weight:500;letter-spacing:.125px;color:${AZUL};background:${TINTE};border-radius:999px;padding:7px 13px}
.d-funnel-h1{margin-top:17px;font-size:46px;line-height:48.3px;font-weight:400;letter-spacing:-.46px;color:${TINTA}}
.d-funnel-h1 em,.d-funnel-h2-grande em{display:inline-block;color:#fff;background:${AZUL};padding:.03em .24em .09em;margin:.1em 0 0;border-radius:.2em;line-height:1.08;white-space:nowrap}
.d-funnel-sub{margin-top:20px;font-size:18px;line-height:27.9px;color:${GRIS}}
.d-funnel-sub strong{font-weight:400;color:${TINTA}}
.d-funnel-btns{margin-top:27px;display:flex;flex-wrap:wrap;gap:12px}
.d-funnel-btn-osc,.d-funnel-btn-suave{display:inline-flex;align-items:center;gap:8px;font-size:15.5px;line-height:15.5px;padding:15px 22px;border-radius:7px;transition:background .2s,transform .2s}
.d-funnel-btn-osc{background:${TINTA};color:#fff}
.d-funnel-btn-osc i{font-size:12px;color:#9DBBF7;transition:transform .2s}
.d-funnel-btn-osc:hover{background:#3a3835}
.d-funnel-btn-osc:hover i{transform:translateX(3px)}
.d-funnel-btn-suave{background:#EAE8E0;color:rgba(31,30,29,.9)}
.d-funnel-btn-suave i{font-size:12px;color:rgba(31,30,29,.5)}
.d-funnel-btn-suave:hover{background:#E0DDD2}
.d-funnel-ventana{background:#fff;border:1px solid ${LINEA};border-radius:14px;overflow:hidden}
.d-funnel-hero-win{box-shadow:rgba(31,30,29,.45) 0 30px 60px -36px;animation:d-funnel-entra .8s ease-out both}
@keyframes d-funnel-entra{from{transform:translateY(16px)}to{transform:none}}
.d-funnel-win-barra{position:relative;height:36px;display:flex;align-items:center;justify-content:center;padding:0 18px;border-bottom:1px solid ${LINEA};font-size:11.5px;color:#5E5D59}
.d-funnel-puntos{position:absolute;left:18px;top:50%;transform:translateY(-50%);display:flex;gap:6px}
.d-funnel-puntos i{width:8px;height:8px;border-radius:50%;background:#E3E1DA}
.d-funnel-win-cuerpo{background:#FCFBF8}
.d-funnel-win-cuerpo .mk-vsl-slot{position:relative}
.d-funnel-win-cuerpo .mk-vsl{position:relative;width:100%;aspect-ratio:16/9;background:#000}
.d-funnel-win-cuerpo .mk-vsl iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.d-funnel-win-cuerpo .mk-cor,.d-funnel-win-cuerpo .mk-vsl-x{display:none}
.d-funnel-win-cuerpo > svg,.d-funnel-win-cuerpo > div > svg{display:block;width:100%;height:auto}
.d-funnel-win-pie{border-top:1px solid ${LINEA};padding:12px 18px 14px;font-size:12.5px;line-height:18px;color:${GRIS}}
.d-funnel-win-pie b{font-weight:400;color:${AZUL}}

/* La prueba («Tracking $5B+ in ad spend for:»): la línea de 13 px centrada y las fichas blancas de radio 10. */
.d-funnel-prueba{background:#fff;padding:64px 32px 84px;text-align:center}
.d-funnel-prueba-l{max-width:1180px;margin:0 auto;font-size:13px;line-height:20px;color:${GRIS}}
.d-funnel-chips{margin-top:14px;display:flex;flex-wrap:wrap;justify-content:center;gap:8px}
.d-funnel-chip{display:inline-flex;align-items:center;gap:8px;font-size:13px;line-height:15px;color:rgba(31,30,29,.75);background:#fff;border:1px solid ${LINEA};border-radius:10px;padding:9px 15px;transition:border-color .2s,transform .2s}
.d-funnel-chip:hover{border-color:rgba(31,30,29,.3);transform:translateY(-1px)}
.d-funnel-chip-marca{color:${AZUL}}
.d-funnel-chip-video{padding:4px 15px 4px 4px}
.d-funnel-chip-video video{width:46px;height:26px;border-radius:6px;object-fit:cover;background:${TINTA};display:block}

/* «How it works»: el tinte de la marca, 88 px arriba y 96 abajo; el título de 58 px y tres tarjetas de 348 con 28 de separación. */
.d-funnel-pasos{background:${TINTE};padding:88px 0 96px;text-align:center}
.d-funnel-pill-blanca{display:inline-flex;align-items:center;gap:7px;font-size:11px;letter-spacing:1.54px;text-transform:uppercase;color:${AZUL};background:#fff;border-radius:999px;padding:7px 14px 7px 10px}
.d-funnel-pill-blanca i{width:7px;height:7px;border-radius:50%;background:${DORADO}}
.d-funnel-h2-grande{max-width:1100px;margin:22px auto 0;font-size:58px;line-height:63.8px;font-weight:400;letter-spacing:-1.16px;color:${TINTA}}
.d-funnel-lede{max-width:560px;margin:18px auto 0;font-size:18px;line-height:27px;color:${GRIS};text-align:center}
.d-funnel-pasos-g{margin:72px auto 0;max-width:1100px;display:grid;grid-template-columns:repeat(3,348px);justify-content:center;gap:28px;text-align:left}
.d-funnel-paso{background:#fff;border:1px solid ${LINEA};border-radius:22px;box-shadow:rgba(31,30,29,.12) 0 24px 60px 0;padding:24px 29px 34px;transition:transform .3s ease}
.d-funnel-paso:hover{transform:translateY(-4px)}
.d-funnel-paso-n{display:block;font-size:30px;line-height:30px;color:${AZUL}}
.d-funnel-paso-t{margin-top:12px;font-size:23px;line-height:27.6px;font-weight:400;letter-spacing:-.23px;color:${TINTA}}
.d-funnel-paso-s{margin-top:10px;font-size:15px;line-height:23.25px;color:${GRIS}}

/* «Brands that add Hyros see»: el crema, el ícono de 96 × 72, el título de 56/500 y la ventana de 980 en cuatro columnas. */
.d-funnel-cifras{padding:96px 0 104px;text-align:center}
.d-funnel-cifras-ic{position:relative;display:inline-flex;align-items:center;justify-content:center;width:96px;height:72px;color:${TINTA}}
.d-funnel-cifras-ic i{position:absolute;right:18px;top:12px;width:8px;height:8px;border-radius:50%;background:${AZUL}}
.d-funnel-h2{margin-top:22px;font-size:56px;line-height:61.6px;font-weight:500;letter-spacing:-.672px;color:${TINTA}}
.d-funnel-cifras .d-funnel-lede{font-size:17px;line-height:27.2px}
.d-funnel-cifras-falta{max-width:980px;margin:40px auto 0;text-align:left}
.d-funnel-cifras-win{max-width:980px;margin:40px auto 0;box-shadow:rgba(31,30,29,.05) 0 10px 30px 0;border-radius:12px;text-align:left}
.d-funnel-cifras-win .d-funnel-win-barra{height:35px;background:#FCFBF8;color:#7A7873}
.d-funnel-cifras-g{display:grid;grid-template-columns:repeat(4,1fr)}
.d-funnel-cifra{padding:26px 24px 30px 25px;border-left:1px solid ${LINEA}}
.d-funnel-cifra:first-child{border-left:0}
.d-funnel-cifra-k{font-size:10.5px;letter-spacing:1.05px;text-transform:uppercase;color:#8B8984;line-height:14px}
.d-funnel-cifra-v{margin-top:10px;font-size:38px;line-height:39.9px;font-weight:400;letter-spacing:-.57px;color:${TINTA}}
.d-funnel-cifra-l{margin-top:16px;font-size:12.5px;line-height:18px;color:${GRIS}}

/* «When we say any feature»: la píldora gris, los renglones en cajas de borde #9A988F y radio 8, y el visual a la derecha. */
.d-funnel-renglones{padding:40px 0 64px}
.d-funnel-renglones-in{display:grid;grid-template-columns:minmax(0,440px) minmax(0,600px);justify-content:space-between;align-items:center;column-gap:48px}
.d-funnel-pill-gris{display:inline-block;font-size:10.5px;line-height:11px;letter-spacing:1.47px;text-transform:uppercase;color:#6B6963;background:#FBFAF6;border:1px solid #9A988F;border-radius:8px;padding:7px 12px}
.d-funnel-cajas{margin-top:14px;display:flex;flex-direction:column;align-items:flex-start;gap:7px;font-size:38px;line-height:39.9px;font-weight:500;letter-spacing:-.38px;color:${TINTA}}
.d-funnel-cajas > *{display:inline-block;font-weight:500;background:#FBFAF6;border:1px solid #9A988F;border-radius:8px;padding:8px 18px 10px;transition:transform .2s ease}
.d-funnel-cajas > *:hover{transform:translateX(4px)}
.d-funnel-cajas strong{color:${AZUL}}
.d-funnel-cajas em{color:#fff;background:${AZUL};border-color:${AZUL_OSC}}
.d-funnel-lista{margin-top:40px;display:flex;flex-direction:column;gap:28px}
.d-funnel-lista-i h3{font-size:19px;line-height:24.7px;font-weight:500;letter-spacing:-.19px;color:${TINTA}}
.d-funnel-lista-i p,.d-funnel-lista-i li{margin-top:6px;font-size:15px;line-height:24px;letter-spacing:-.15px;color:#5E5D59}
.d-funnel-lista-i p strong{font-weight:500;color:${TINTA}}
.d-funnel-lista-i ul{margin-top:6px}
.d-funnel-lista-i li{margin-top:2px;padding-left:16px;position:relative}
.d-funnel-lista-i li::before{content:'';position:absolute;left:2px;top:10px;width:5px;height:5px;border-radius:50%;background:${AZUL}}
.d-funnel-renglones-media{position:relative;padding-top:56px}
.d-funnel-nota{position:absolute;top:0;right:0;z-index:1;display:flex;gap:8px;align-items:flex-start;max-width:300px;background:#fff;border:1px solid #9A988F;border-radius:10px;padding:12px 14px;font-size:14px;line-height:18px;font-weight:600;color:${TINTA}}
.d-funnel-nota i{flex:none;margin-top:6px;width:6px;height:6px;border-radius:50%;background:${AZUL}}
.d-funnel-renglones-win{box-shadow:rgba(31,30,29,.45) 0 30px 60px -36px;padding:12px}

/* La cara de arriba de su cubo: las baldosas blancas con borde, giradas en isométrico, con la del centro en el color de marca. */
.d-funnel-integ{padding:8px 32px 120px;text-align:center}
.d-funnel-integ-t{font-size:10.5px;letter-spacing:1.6px;text-transform:uppercase;color:${TINTA}}
.d-funnel-cubo{height:330px;display:flex;align-items:center;justify-content:center;perspective:none}
.d-funnel-cubo-g{display:grid;grid-template-columns:repeat(3,104px);gap:14px;transform:rotateX(55deg) rotateZ(-45deg)}
.d-funnel-baldosa{height:104px;background:#FBFAF6;border:1px solid #9A988F;border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;box-shadow:0 6px 0 #E2DFD5;transition:transform .25s ease}
.d-funnel-baldosa:hover{transform:translateZ(10px) translateY(-6px)}
.d-funnel-baldosa img{width:30px;height:30px;object-fit:contain}
.d-funnel-baldosa span{font-size:9.5px;letter-spacing:1.4px;text-transform:uppercase;color:${TINTA}}
.d-funnel-baldosa-mako{background:${AZUL};border-color:${AZUL_OSC};box-shadow:0 6px 0 ${AZUL_OSC}}

/* «Pick your business model»: la banda del color de marca, 92 px arriba y 100 abajo, y las filas translúcidas de radio 16. */
.d-funnel-modelos{background:${AZUL};padding:92px 0 100px}
.d-funnel-modelos-in{display:grid;grid-template-columns:minmax(0,458px) minmax(0,658px);justify-content:space-between;align-items:center;column-gap:48px}
.d-funnel-modelos-k{font-size:10.5px;letter-spacing:1.47px;text-transform:uppercase;color:#CFDDFB;margin-bottom:14px}
.d-funnel-modelos-h2{font-size:44px;line-height:48.4px;font-weight:500;letter-spacing:-.528px;color:#fff}
.d-funnel-modelos-h2 em{color:#C9DAFB}
.d-funnel-modelos-b{margin-top:16px;font-size:16px;line-height:24px;color:rgba(255,255,255,.8)}
.d-funnel-modelos-l{display:flex;flex-direction:column;gap:12px}
.d-funnel-modelo{display:flex;align-items:center;gap:18px;min-height:92px;background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.3);border-radius:16px;padding:15px 18px 15px 20px;transition:background .2s}
.d-funnel-modelo:hover{background:rgba(255,255,255,.16)}
.d-funnel-modelo-n{font-size:11px;letter-spacing:1.1px;color:#C9DAFB;width:14px}
.d-funnel-modelo-ic{flex:none;width:60px;height:60px;border-radius:12px;background:#fff;color:${AZUL};display:inline-flex;align-items:center;justify-content:center}
.d-funnel-modelo-tx{display:flex;flex-direction:column;gap:4px}
.d-funnel-modelo-t{font-size:23px;line-height:26.45px;font-weight:500;letter-spacing:-.115px;color:#fff}
.d-funnel-modelo-s{font-size:14px;line-height:20.3px;color:rgba(255,255,255,.8)}

/* El pie: el filete de arriba, 40 px de aire, la columna del logo y las de links de 176 (encabezado 12.5 y links 13/26). */
.d-funnel-pie{padding-bottom:48px}
.d-funnel-pie-in{border-top:1px solid ${LINEA};padding:40px 32px 36px;display:grid;grid-template-columns:314px 1fr}
.d-funnel-pie-marca p{margin-top:16px;max-width:220px;font-size:13.5px;line-height:20.25px;color:${GRIS}}
.d-funnel-pie-h{font-size:12.5px;color:${TINTA};margin-bottom:12px}
.d-funnel-pie-cols ul{columns:4 176px;column-gap:33px}
.d-funnel-pie-cols li{font-size:13px;line-height:26px;break-inside:avoid}
.d-funnel-pie-cols a{color:${GRIS};transition:color .15s}
.d-funnel-pie-cols a:hover{color:${TINTA}}
.d-funnel-pie-base{margin:0 32px;border-top:1px solid ${LINEA};padding-top:18px}
.d-funnel-pie-base p{font-size:12.5px;color:${GRIS}}

@media (max-width:1244px){
  .d-funnel-hero .d-funnel-cont{padding:0 32px}
}
@media (max-width:1100px){
  .d-funnel-hero-in,.d-funnel-renglones-in,.d-funnel-modelos-in{grid-template-columns:minmax(0,1fr);row-gap:48px}
  .d-funnel-pasos-g{grid-template-columns:minmax(0,1fr);max-width:560px}
  .d-funnel-pie-cols ul{columns:3 150px}
}
/* A 390 px (su versión de teléfono): todo en una columna a 20 px del borde, la ventana debajo del texto y los botones a lo ancho. */
@media (max-width:767px){
  .d-funnel-cont,.d-funnel-hero .d-funnel-cont{padding:0 20px}
  .d-funnel-barra-in{height:50px}
  .d-funnel-barra-link{display:none}
  .d-funnel-hero{padding-top:48px}
  .d-funnel-hero-in{row-gap:24px}
  .d-funnel-pill{font-size:12px;line-height:15.6px}
  .d-funnel-h1{font-size:31.88px;line-height:33.47px;letter-spacing:-.32px}
  .d-funnel-sub{margin-top:8px;font-size:16px;line-height:24px}
  .d-funnel-btns{order:2;flex-direction:column;gap:10px;margin-top:0}
  .d-funnel-hero-txt{display:contents}
  .d-funnel-hero-in{display:flex;flex-direction:column;align-items:stretch}
  .d-funnel-pill{align-self:flex-start}
  .d-funnel-hero-win{order:1}
  .d-funnel-btn-osc,.d-funnel-btn-suave{justify-content:center}
  .d-funnel-btns{order:3}
  .d-funnel-prueba{padding:40px 20px 56px}
  .d-funnel-chip{font-size:12.5px;padding:8px 12px}
  .d-funnel-chip-video{padding:3px 12px 3px 3px}
  .d-funnel-pasos{padding:56px 0 64px}
  .d-funnel-h2-grande{font-size:38px;line-height:41.8px;letter-spacing:-.76px}
  .d-funnel-h2-grande em{white-space:normal}
  .d-funnel-lede{font-size:16px;line-height:24px}
  .d-funnel-pasos-g{margin-top:40px;gap:20px}
  .d-funnel-paso{padding:24px 23px 30px}
  .d-funnel-paso-t{font-size:21px;line-height:25.2px;letter-spacing:-.21px}
  .d-funnel-cifras{padding:64px 0 72px}
  .d-funnel-h2{font-size:36px;line-height:39.6px;letter-spacing:-.432px}
  .d-funnel-cifras .d-funnel-lede{font-size:15.5px;line-height:24.8px}
  .d-funnel-cifras-g{grid-template-columns:repeat(2,minmax(0,1fr))}
  .d-funnel-cifra{padding:20px 16px 22px 16px}
  .d-funnel-cifra:nth-child(odd){border-left:0}
  .d-funnel-cifra:nth-child(n+3){border-top:1px solid ${LINEA}}
  .d-funnel-cifra-v{font-size:30px;line-height:31.5px;letter-spacing:-.45px}
  .d-funnel-cajas{font-size:30px;line-height:31.5px;letter-spacing:-.3px}
  .d-funnel-cajas > *{padding:6px 14px 8px}
  .d-funnel-renglones-media{padding-top:0}
  .d-funnel-nota{position:static;max-width:none;margin-bottom:16px}
  .d-funnel-integ{padding:0 20px 72px}
  .d-funnel-cubo{height:300px}
  .d-funnel-cubo-g{grid-template-columns:repeat(3,76px);gap:10px}
  .d-funnel-baldosa{height:76px;gap:4px}
  .d-funnel-baldosa img{width:22px;height:22px}
  .d-funnel-baldosa span{font-size:7.5px;letter-spacing:.8px}
  .d-funnel-modelos{padding:64px 0 72px}
  .d-funnel-modelos-in > div:first-child{text-align:center}
  .d-funnel-modelos-h2{font-size:30px;line-height:33px;letter-spacing:-.36px}
  .d-funnel-modelo{gap:12px;padding:14px 14px 14px 12px}
  .d-funnel-modelo-n{display:none}
  .d-funnel-modelo-ic{width:48px;height:48px}
  .d-funnel-modelo-t{font-size:19px;line-height:21.85px}
  .d-funnel-modelo-s{font-size:12.5px;line-height:18.1px}
  .d-funnel-pie-in{grid-template-columns:minmax(0,1fr);padding:32px 0 28px;row-gap:28px}
  .d-funnel-pie-cols ul{columns:2 150px;column-gap:20px}
  .d-funnel-pie-base{margin:0}
}
@media (prefers-reduced-motion:reduce){
  .d-funnel *{animation:none!important;transition:none!important}
  .d-funnel-paso:hover,.d-funnel-chip:hover,.d-funnel-cajas > *:hover,.d-funnel-baldosa:hover{transform:none}
}
`;
