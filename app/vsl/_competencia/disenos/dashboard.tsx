// =============================================================================
// /vsl/dashboard con el DISEÑO de la portada de Reportei (https://reportei.com/es/), copiado el 11/11/2026
// =============================================================================
// Los valores (Quicksand 700 en los títulos e Inter en el texto, la escala 40/32/24/18, el contenedor de 1200 px, las
// tarjetas pastel de radio 24 con su chip de color, las tarjetas de borde fino de radio 20, la banda azul con la grilla de
// canales, la banda de testimonios en tres columnas y el pie gris de cinco columnas) se leyeron con getComputedStyle a 1440
// y 390 px: docs/diseno/landings-competencia/dashboard.md. De MaKo quedan el logo, el azul #2F6FED donde Reportei pone su
// azul (botones, títulos, bandas) y el dorado donde pone su verde (las palabras resaltadas y el filete de la tarjeta del
// hero), el botón de la llamada y los textos de ../dashboard.ts. Las fuentes son las suyas (Quicksand e Inter, OFL),
// servidas desde /vsl-assets/fuentes.
//
// Secciones de la referencia que NO van, y por qué:
//   · Su insignia de GetApp y su «+10.000 clientes en 70 países»: premio y contador. En el lugar de la insignia va la
//     etiqueta del hero, con la estrella de MaKo donde va su trofeo.
//   · La caja celeste «Más de 10.000 empresas… usan Reportei» (logos de clientes, su video y su botón): no hay contenido de
//     MaKo para ella.
//   · De sus tarjetas, «Quiero saber más» (lleva a sus páginas de producto) y las capturas de las tarjetas altas: MaKo tiene
//     una sola llamada a la acción y no tiene capturas. La tarjeta ancha lleva el gráfico de ventas de la landing.
//   · Sus tarjetas «Overview» y «Reportei AI»: MaKo tiene seis piezas, que van en la ancha, las tres altas y las dos de
//     borde fino (las de Studio y MCP, sin su botón).
//   · Los sellos de Capterra y GetApp, «Conoce la herramienta» (sus pestañas), Flux, Sync y el texto de SEO con su dibujo.
//   · En la banda azul, su grilla de íconos de canales: va el gráfico del embudo (el primero de la banda en ../dashboard.ts).
//     Los otros dos gráficos de esa banda no van: el de ventas ya está en la tarjeta ancha y la banda tiene un solo visual.
//   · En la banda de testimonios, sus logos de clientes, sus fotos y su «Todos los testimonios →»: van los tres meses de
//     Mauricio en el lugar de los logos, su historia en el de las citas y su video en el lugar de la foto.
//   · En el pie, sus redes, su selector de idioma y sus columnas: va una columna con el resto de las funciones de MaKo.
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

function Ico({ paths, size = 20, grueso = 2 }: { paths?: string[]; size?: number; grueso?: number }) {
  if (!paths?.length) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={grueso} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths.map((d) => <path key={d} d={d} />)}
    </svg>
  );
}

function Barra() {
  return (
    <header className="d-dashboard-barra">
      <div className="d-dashboard-cont d-dashboard-barra-in">
        <LogoMaKo className="d-dashboard-logo" tamano={32} />
        <div className="d-dashboard-barra-der">
          <a href="/vsl" className="d-dashboard-barra-link">Todas las funcionalidades</a>
          <a href={RUTA_CTA} className="d-dashboard-barra-btn">{TEXTO_CTA}</a>
        </div>
      </div>
    </header>
  );
}

/** Su hero: el título de dos tonos, el texto, la píldora celeste, el botón y, a la derecha, la captura sobre su fondo celeste. */
function HeroD({ b }: { b: Hero }) {
  return (
    <section className="d-dashboard-hero">
      <div className="d-dashboard-cont d-dashboard-hero-in">
        <h1 className="d-dashboard-h1" dangerouslySetInnerHTML={html(b.titulo)} />
        <div className="d-dashboard-hero-media" aria-hidden="true">
          <span className="d-dashboard-hero-fondo" />
          <div className="d-dashboard-hero-tarjeta"><VisualDeLanding visual={b.visual} /></div>
        </div>
        <div className="d-dashboard-hero-txt">
          <p dangerouslySetInnerHTML={html(b.bajada)} />
          {b.puntos?.length ? <p dangerouslySetInnerHTML={html(b.puntos.map((p) => `${p}.`).join(' '))} /> : null}
        </div>
        <p className="d-dashboard-pill"><EstrellaMaKo size={16} /><span>{b.etiqueta}</span></p>
        <a href={RUTA_CTA} className="d-dashboard-btn d-dashboard-hero-btn">{TEXTO_CTA}</a>
      </div>
    </section>
  );
}

/** Su franja «Integración con más de 50 plataformas:»: el rótulo gris a la izquierda y los íconos de 24 px a la derecha. */
function Franja({ b }: { b: Logos }) {
  return (
    <section className="d-dashboard-franja" aria-label={b.titulo}>
      <div className="d-dashboard-cont d-dashboard-franja-in">
        <p className="d-dashboard-franja-t"><span dangerouslySetInnerHTML={html(b.titulo)} />:</p>
        <ul className="d-dashboard-franja-ics">
          {b.items.map((l) => (
            // eslint-disable-next-line @next/next/no-img-element
            <li key={l.nombre} title={l.nombre}><img src={`/vsl-assets/logos/${l.logo}`} alt={l.nombre} width={24} height={24} /></li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Sus tarjetas pastel: el tono de cada una (fondo, rótulo, título) es el de su tarjeta en la referencia. */
const TONOS = ['verde', 'naranja', 'gris', 'lila'] as const;

function Tarjeta({ t, tono, ancha }: { t: Tarjetas['items'][number]; tono: string; ancha?: { slug: string; grafico: number } }) {
  const txt = (
    <div className="d-dashboard-card-txt">
      <div className="d-dashboard-card-rot">
        <span className="d-dashboard-chip"><Ico paths={t.icono} size={18} /></span>
        <h3 className="d-dashboard-card-r" dangerouslySetInnerHTML={html(t.titulo)} />
      </div>
      <p className="d-dashboard-card-t" dangerouslySetInnerHTML={html(t.texto)} />
    </div>
  );
  if (!ancha) return <div className={`d-dashboard-card d-dashboard-alta d-dashboard-t-${tono}`}>{txt}</div>;
  return (
    <div className={`d-dashboard-card d-dashboard-ancha d-dashboard-t-${tono}`}>
      <div className="d-dashboard-ancha-img"><div className="d-dashboard-panel"><Visual spec={FEATURE_VISUALS[ancha.slug]?.groups?.[ancha.grafico]} /></div></div>
      {txt}
    </div>
  );
}

/** «¡Deja de perder tiempo…!» y sus tarjetas: una ancha con captura, tres altas y las dos de borde fino (Studio y MCP). */
function TarjetasD({ b }: { b: Tarjetas }) {
  const [ancha, ...resto] = b.items;
  const altas = resto.slice(0, 3);
  const finas = resto.slice(3);
  return (
    <section className="d-dashboard-sec-cards">
      <div className="d-dashboard-cont">
        <h2 className="d-dashboard-h2" dangerouslySetInnerHTML={html(b.titulo)} />
        {b.bajada ? <p className="d-dashboard-h2-bajada" dangerouslySetInnerHTML={html(b.bajada)} /> : null}
        <div className="d-dashboard-cards">
          {ancha ? <Tarjeta t={ancha} tono="verde" ancha={{ slug: 'dashboard', grafico: 2 }} /> : null}
          {altas.length ? <div className="d-dashboard-altas">{altas.map((t, i) => <Tarjeta key={t.titulo} t={t} tono={TONOS[i + 1]} />)}</div> : null}
        </div>
        {finas.length ? (
          <div className="d-dashboard-finas">
            {finas.map((t, i) => (
              <article key={t.titulo} className={`d-dashboard-fina d-dashboard-fina-${i % 2 ? 'verde' : 'celeste'}`}>
                <div className="d-dashboard-fina-marca"><Ico paths={t.icono} size={32} grueso={1.6} /><h3 dangerouslySetInnerHTML={html(t.titulo)} /></div>
                <p className="d-dashboard-fina-t" dangerouslySetInnerHTML={html(t.texto)} />
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** Su banda azul «Los indicadores de todos tus canales en una sola pantalla»: el título y el texto a la izquierda, el visual a la derecha. */
function Banda({ b }: { b: Filas }) {
  const primero = b.items[0];
  return (
    <section className="d-dashboard-banda">
      <div className="d-dashboard-cont d-dashboard-banda-in">
        <div className="d-dashboard-banda-txt">
          {b.etiqueta ? <p className="d-dashboard-banda-etq">{b.etiqueta}</p> : null}
          <h2 className="d-dashboard-banda-h2" dangerouslySetInnerHTML={html(b.titulo)} />
          {b.bajada ? <p className="d-dashboard-banda-p" dangerouslySetInnerHTML={html(b.bajada)} /> : null}
          {b.items.map((f) => (
            <p key={f.titulo} className="d-dashboard-banda-p"><strong dangerouslySetInnerHTML={html(`${f.titulo}.`)} /> <span dangerouslySetInnerHTML={html(f.texto)} /></p>
          ))}
        </div>
        {primero ? (
          <div className="d-dashboard-banda-media" aria-hidden="true">
            <div className="d-dashboard-panel"><Visual spec={FEATURE_VISUALS[b.slug]?.groups?.[primero.grafico ?? 0]} /></div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** Su banda de testimonios: el título chico, la línea en negrita y tres columnas (logo, cita, persona). */
function Caso() {
  const citas = [...CASO.historia, CASO.resultado];
  return (
    <section className="d-dashboard-testi">
      <div className="d-dashboard-testi-in">
        <h2 className="d-dashboard-testi-h" dangerouslySetInnerHTML={html(CASO.titulo)} />
        <p className="d-dashboard-testi-sub">{CASO.sub}</p>
        <div className="d-dashboard-testi-cols">
          {citas.map((c, i) => (
            <div key={i} className="d-dashboard-testi-col">
              <p className="d-dashboard-testi-mes"><span>{CASO.meses[i]?.mes}</span> {CASO.meses[i]?.monto}</p>
              <blockquote className="d-dashboard-testi-q" dangerouslySetInnerHTML={html(c)} />
              {i === citas.length - 1 ? (
                <div className="d-dashboard-testi-quien">
                  <video className="d-dashboard-testi-av" muted autoPlay loop playsInline preload="metadata" aria-label={`${CASO.quien}, en video`}><source src={CASO.video} type="video/mp4" /></video>
                  <div><p className="d-dashboard-testi-n">{CASO.quien}</p><p className="d-dashboard-testi-r">{CASO.rol}</p></div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PieD({ slug, linea }: { slug: string; linea: string }) {
  return (
    <footer className="d-dashboard-pie">
      <div className="d-dashboard-pie-in">
        <div className="d-dashboard-pie-marca"><LogoMaKo tamano={32} /></div>
        <div className="d-dashboard-pie-cols">
          <p className="d-dashboard-pie-h">Funciones de MaKo</p>
          <ul>{otrasFunciones(slug).map((f) => <li key={f.href}><a href={f.href}>{f.nombre}</a></li>)}</ul>
        </div>
      </div>
      <div className="d-dashboard-pie-base"><p>{linea}</p></div>
    </footer>
  );
}

function DibujarBloque({ b, slug }: { b: Bloque; slug: string }) {
  switch (b.tipo) {
    case 'hero': return <HeroD b={b} />;
    case 'logos': return <Franja b={b} />;
    case 'tarjetas': return <TarjetasD b={b} />;
    case 'filas': return <Banda b={{ ...b, slug: b.slug || slug }} />;
    case 'caso': return <Caso />;
    default: return null;
  }
}

export default function DisenoDashboard({ landing }: PropsDiseno) {
  return (
    <div className="d-dashboard">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <Barra />
      <main>
        {landing.bloques.map((b, i) => <DibujarBloque key={i} b={b} slug={landing.slug} />)}
      </main>
      <PieD slug={landing.slug} linea={landing.metaDesc} />
    </div>
  );
}

// Los valores salen de docs/diseno/landings-competencia/dashboard.md (medidos el 11/11/2026).
const AZUL = '#2F6FED';
const AZUL_OSC = '#1F57C8';
const DORADO = '#F2B01E';
const CSS = `
@font-face{font-family:'Quicksand';font-style:normal;font-weight:700;font-display:swap;src:url('/vsl-assets/fuentes/quicksand/quicksand-latin-700.woff2') format('woff2')}
@font-face{font-family:'Inter';font-style:normal;font-weight:100 900;font-display:swap;src:url('/vsl-assets/fuentes/inter/inter-latin-var.woff2') format('woff2')}
.d-dashboard{background:#fff;color:#212B30;font-family:'Inter',system-ui,sans-serif;font-size:18px;line-height:1.2;-webkit-font-smoothing:antialiased;overflow-x:hidden}
.d-dashboard *{box-sizing:border-box}
:where(.d-dashboard) :where(h1,h2,h3,p,ul,blockquote){margin:0;padding:0}
:where(.d-dashboard) :where(ul){list-style:none}
:where(.d-dashboard) :where(a){text-decoration:none}
.d-dashboard em{font-style:normal;color:${DORADO}}
.d-dashboard-cont{max-width:1200px;margin:0 auto}

/* La barra: 80 px (10 de aire arriba y la fila de 70), el logo a 10 px del borde del contenedor, «Entrar» y el botón a la derecha. */
.d-dashboard-barra{background:#fff;padding-top:10px}
.d-dashboard-barra-in{height:70px;display:flex;align-items:center;justify-content:space-between}
.d-dashboard-logo{margin-left:10px;font-family:'Inter',sans-serif}
.d-dashboard-barra-der{display:flex;align-items:center;gap:19px}
.d-dashboard-barra-link{font-size:18px;font-weight:700;line-height:21.6px;color:${AZUL};padding:13px 18px;border-radius:2px;transition:color .2s linear}
.d-dashboard-barra-link:hover{color:${AZUL_OSC}}
.d-dashboard-barra-btn,.d-dashboard-btn{display:inline-block;background:${AZUL};color:#fff;font-size:18px;font-weight:700;line-height:21.4px;padding:13px 18px;border-radius:12px;transition:background .2s linear,transform .2s linear,box-shadow .2s linear}
.d-dashboard-barra-btn:hover,.d-dashboard-btn:hover{background:${AZUL_OSC};box-shadow:0 6px 16px rgba(47,111,237,.28)}
.d-dashboard-btn{font-weight:500;line-height:21.6px}

/* El hero: 100 px arriba y 40 abajo; el texto en una columna de 504 px con 24 de separación, la captura de 660 px a la derecha. */
.d-dashboard-hero{padding:100px 0 40px}
.d-dashboard-hero-in{display:grid;grid-template-columns:504px 660px;column-gap:36px;row-gap:24px;grid-template-areas:'h1 media' 'txt media' 'pill media' 'btn media' 'resto media';grid-template-rows:auto auto auto auto 1fr;align-items:start}
.d-dashboard-h1{grid-area:h1;font-family:'Quicksand',sans-serif;font-size:40px;line-height:52px;font-weight:700;letter-spacing:-.2px;color:${AZUL_OSC}}
.d-dashboard-hero-txt{grid-area:txt;font-size:17px;line-height:22.1px;font-weight:500;color:#455A64}
.d-dashboard-hero-txt p+p{margin-top:22px}
.d-dashboard-hero-txt strong{font-weight:700}
.d-dashboard-pill{grid-area:pill;justify-self:start;display:inline-flex;align-items:center;gap:8px;background:#EAF4FF;color:${AZUL};font-size:16px;line-height:21.6px;font-weight:500;padding:8px 12px;border-radius:12px}
.d-dashboard-hero-btn{grid-area:btn;justify-self:start}
.d-dashboard-hero-media{grid-area:media;position:relative;margin-top:-24px;aspect-ratio:660/583;width:100%}
.d-dashboard-hero-fondo{position:absolute;left:7.6%;top:5.5%;width:85.3%;height:78.7%;background:#E3EEFC;border-radius:24px}
.d-dashboard-hero-tarjeta{position:absolute;left:14.5%;top:13.2%;width:82.4%;background:#fff;border-top:4px solid ${DORADO};border-radius:8px;box-shadow:0 5px 16px rgba(5,15,36,.18);padding:10px;animation:d-dashboard-sube .7s ease-out both}
.d-dashboard-hero-tarjeta > *{max-width:100%}
@keyframes d-dashboard-sube{from{transform:translateY(14px)}to{transform:none}}

/* La franja «Integración con más de 50 plataformas:»: rótulo de 14 px en mayúsculas y los íconos de 24 px cada 42. */
.d-dashboard-franja{padding:20px 0 80px}
.d-dashboard-franja-in{display:flex;align-items:center;gap:24px}
.d-dashboard-franja-t{font-size:14px;line-height:18.2px;font-weight:800;text-transform:uppercase;color:#78909C;flex:none}
.d-dashboard-franja-ics{display:flex;flex-wrap:wrap;gap:20px 18px}
.d-dashboard-franja-ics li{width:24px;height:24px;transition:transform .2s ease}
.d-dashboard-franja-ics li:hover{transform:scale(1.15)}
.d-dashboard-franja-ics img{width:24px;height:24px;object-fit:contain;display:block}

/* «¡Deja de perder tiempo…!»: 120 px arriba, el título centrado de 32 px y las tarjetas pastel de radio 24 con 40 de separación. */
.d-dashboard-sec-cards{padding:120px 0 56px}
.d-dashboard-h2{max-width:792px;margin:0 auto;text-align:center;font-family:'Quicksand',sans-serif;font-size:32px;line-height:41.6px;font-weight:700;letter-spacing:-.2px;color:${AZUL_OSC}}
.d-dashboard-h2-bajada{max-width:792px;margin:16px auto 0;text-align:center;font-size:17px;line-height:22.1px;font-weight:500;color:#455A64}
.d-dashboard-cards{margin-top:80px;display:flex;flex-direction:column;gap:40px}
.d-dashboard-card{border-radius:24px;overflow:hidden;transition:transform .3s ease,box-shadow .3s ease}
.d-dashboard-card:hover{transform:translateY(-4px);box-shadow:0 10px 24px rgba(5,15,36,.08)}
.d-dashboard-ancha{display:grid;grid-template-columns:1fr 1fr;column-gap:40px;padding:0 40px;min-height:330px;align-items:center}
.d-dashboard-ancha-img{align-self:end;padding-top:40px}
.d-dashboard-ancha-img .d-dashboard-panel{width:387px;max-width:100%;border-radius:12px 12px 0 0;margin-left:-7px}
.d-dashboard-altas{display:grid;grid-template-columns:repeat(3,1fr);gap:40px}
.d-dashboard-alta{padding:40px}
.d-dashboard-card-rot{display:flex;align-items:center;gap:16px}
.d-dashboard-chip{flex:none;width:31px;height:32px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;color:#fff}
.d-dashboard-card-r{font-family:'Quicksand',sans-serif;font-size:18px;line-height:23.4px;font-weight:700;letter-spacing:-.2px}
.d-dashboard-card-t{margin-top:24px;font-family:'Quicksand',sans-serif;font-size:24px;line-height:28.8px;font-weight:700;letter-spacing:-.2px}
.d-dashboard-ancha .d-dashboard-card-txt{max-width:365px;padding:40px 0}
.d-dashboard-t-verde{background:#EEFBF2}.d-dashboard-t-verde .d-dashboard-chip{background:#0A9B38}.d-dashboard-t-verde .d-dashboard-card-r{color:#0A9B38}.d-dashboard-t-verde .d-dashboard-card-t{color:#0A782D}
.d-dashboard-t-naranja{background:#FFF2EE}.d-dashboard-t-naranja .d-dashboard-chip{background:#D14D24}.d-dashboard-t-naranja .d-dashboard-card-r{color:#D14D24}.d-dashboard-t-naranja .d-dashboard-card-t{color:#A33C1C}
.d-dashboard-t-gris{background:#F4F6FA}.d-dashboard-t-gris .d-dashboard-chip{background:#00449D}.d-dashboard-t-gris .d-dashboard-card-r{color:#00449D}.d-dashboard-t-gris .d-dashboard-card-t{color:#00449D}
.d-dashboard-t-lila{background:#F6F1FA}.d-dashboard-t-lila .d-dashboard-chip{background:#954CDC}.d-dashboard-t-lila .d-dashboard-card-r{color:#954CDC}.d-dashboard-t-lila .d-dashboard-card-t{color:#6E35A7}
.d-dashboard-panel{background:#fff;border-radius:12px;box-shadow:0 5px 16px rgba(5,15,36,.12);padding:6px;overflow:hidden}
.d-dashboard-panel > svg{display:block;width:100%;height:auto}

/* Las de borde fino (Studio y MCP): dos columnas de 588 con 24 de separación, 32 de aire, radio 20 y borde de 1 px. */
.d-dashboard-finas{margin-top:152px;display:grid;grid-template-columns:1fr 1fr;gap:24px}
.d-dashboard-fina{padding:32px;border-radius:20px;border:1px solid;transition:transform .3s ease,box-shadow .3s ease}
.d-dashboard-fina:hover{transform:translateY(-4px);box-shadow:0 10px 24px rgba(5,15,36,.08)}
.d-dashboard-fina-celeste{background:#F4F8FF;border-color:#DCE6F4}
.d-dashboard-fina-verde{background:#EEFBF2;border-color:#D8EFDF}
.d-dashboard-fina-marca{display:flex;align-items:center;gap:12px;margin-bottom:20px;color:${AZUL_OSC}}
.d-dashboard-fina-marca h3{font-size:18px;line-height:21.6px;font-weight:700}
.d-dashboard-fina-t{font-family:'Quicksand',sans-serif;font-size:28px;line-height:35px;font-weight:700;color:${AZUL_OSC}}

/* La banda azul: 110 px arriba y abajo, el título blanco de 32 px con su resaltado y el texto celeste de 16 px. */
.d-dashboard-banda{background:${AZUL_OSC};padding:110px 0}
.d-dashboard-banda-in{display:grid;grid-template-columns:376px 1fr;column-gap:100px;align-items:center;padding:0 10px}
.d-dashboard-banda-etq{font-size:14px;line-height:18.2px;font-weight:800;text-transform:uppercase;color:#BAD2F1;margin-bottom:12px}
.d-dashboard-banda-h2{max-width:316px;font-family:'Quicksand',sans-serif;font-size:32px;line-height:38.4px;font-weight:700;letter-spacing:-.2px;color:#fff;margin-bottom:24px}
.d-dashboard-banda-p{font-size:16px;line-height:20.8px;font-weight:500;color:#BAD2F1}
.d-dashboard-banda-p+.d-dashboard-banda-p{margin-top:12px}
.d-dashboard-banda-p strong{color:#fff;font-weight:700}
.d-dashboard-banda-media{justify-self:center;width:100%;max-width:520px}
.d-dashboard-banda-media .d-dashboard-panel{border-radius:16px;box-shadow:none;padding:8px}

/* La banda de testimonios: azul, 62 px arriba y abajo, 880 px de ancho, tres columnas. */
.d-dashboard-testi{background:${AZUL};padding:62px 0}
.d-dashboard-testi-in{max-width:880px;margin:0 auto;color:#fff}
.d-dashboard-testi-h{text-align:center;font-family:'Quicksand',sans-serif;font-size:20px;line-height:24px;font-weight:700}
.d-dashboard-testi-sub{margin-top:20px;text-align:center;font-size:20px;line-height:26px;font-weight:700}
.d-dashboard-testi-cols{margin-top:64px;display:grid;grid-template-columns:repeat(3,1fr);gap:40px;align-items:start}
.d-dashboard-testi-col{padding:0 10px}
.d-dashboard-testi-mes{font-family:'Quicksand',sans-serif;font-size:36px;line-height:51px;font-weight:700;color:#fff}
.d-dashboard-testi-mes span{font-family:'Inter',sans-serif;font-size:16px;font-weight:500;color:rgba(255,255,255,.65);margin-right:6px}
.d-dashboard-testi-q{margin-top:35px;font-size:18px;line-height:21.6px;font-weight:500}
.d-dashboard-testi-q strong{font-weight:800}
.d-dashboard-testi-quien{margin-top:24px;display:flex;align-items:center;gap:4px}
.d-dashboard-testi-av{width:64px;height:64px;border-radius:100px;object-fit:cover;flex:none;margin-right:12px;background:#1F57C8}
.d-dashboard-testi-n{font-size:18px;line-height:21.6px;font-weight:700}
.d-dashboard-testi-r{font-size:16px;line-height:19.2px;font-weight:500;color:rgba(255,255,255,.45)}

/* El pie: gris #F9FAFB, 60 px arriba, la columna del logo y las de links de 206 px (Inter 18/600 y 16/25.6), y la base de 92. */
.d-dashboard-pie{background:#F9FAFB}
.d-dashboard-pie-in{max-width:1160px;margin:0 auto;padding:60px 0 56px;display:grid;grid-template-columns:240px 1fr}
.d-dashboard-pie-h{font-size:18px;line-height:23.4px;font-weight:600;color:#212B30;margin-bottom:12px}
.d-dashboard-pie-cols ul{columns:4 206px;column-gap:32px}
.d-dashboard-pie-cols li{font-size:16px;line-height:25.6px;margin-bottom:6px;break-inside:avoid}
.d-dashboard-pie-cols a{color:#212B30;transition:color .2s linear}
.d-dashboard-pie-cols a:hover{color:${AZUL}}
.d-dashboard-pie-base{border-top:1px solid #ECEFF1;padding:21px 24px 50px;text-align:center}
.d-dashboard-pie-base p{font-size:14px;line-height:21px;color:#212B30}

/* Entre 1240 y 768 px el contenedor deja 24 de aire a los lados. */
@media (max-width:1240px){
  .d-dashboard-cont,.d-dashboard-pie-in{padding-left:24px;padding-right:24px}
  .d-dashboard-hero-in{grid-template-columns:minmax(0,504fr) minmax(0,660fr)}
  .d-dashboard-banda-in{grid-template-columns:minmax(0,376px) minmax(0,1fr);column-gap:48px}
  .d-dashboard-testi-in{padding:0 24px}
}
/* A 390 px (su versión de teléfono): barra de 70 con el botón como link azul, la captura entre el título y el texto, todo en una columna. */
@media (max-width:767px){
  .d-dashboard-barra{padding-top:0}
  .d-dashboard-cont{padding-left:24px;padding-right:24px}
  .d-dashboard-barra .d-dashboard-cont{padding-left:0;padding-right:16px}
  .d-dashboard-barra-in{height:70px}
  .d-dashboard-barra-link{display:none}
  .d-dashboard-barra-btn{background:none;color:${AZUL};padding:0;font-weight:500;line-height:21.6px}
  .d-dashboard-barra-btn:hover{background:none;box-shadow:none}
  .d-dashboard-hero{padding:64px 0 40px}
  .d-dashboard-hero-in{grid-template-columns:minmax(0,1fr);grid-template-areas:'h1' 'media' 'txt' 'pill' 'btn';grid-template-rows:none;row-gap:24px}
  .d-dashboard-h1{font-size:32px;line-height:41.6px}
  .d-dashboard-hero-media{margin:0 -24px;width:auto}
  .d-dashboard-hero-txt{font-size:16px;line-height:20.8px}
  .d-dashboard-hero-txt p+p{margin-top:20.8px}
  .d-dashboard-pill{justify-self:stretch;justify-content:center;text-align:center}
  .d-dashboard-franja{padding:56px 0 64px}
  .d-dashboard-franja-in{flex-direction:column;align-items:flex-start;gap:24px}
  .d-dashboard-franja-t{font-size:15px;line-height:19.5px}
  .d-dashboard-franja-ics{gap:20px}
  .d-dashboard-sec-cards{padding:64px 0 36px}
  .d-dashboard-h2{text-align:left;font-size:24px;line-height:31.2px}
  .d-dashboard-h2-bajada{text-align:left;font-size:16px;line-height:20.8px}
  .d-dashboard-cards{margin-top:48px;gap:24px}
  .d-dashboard-ancha{display:flex;flex-direction:column-reverse;align-items:stretch;padding:24px 24px 0;min-height:0}
  .d-dashboard-ancha .d-dashboard-card-txt{padding:0 0 24px;max-width:none}
  .d-dashboard-ancha-img{padding-top:0;align-self:stretch;min-width:0}
  .d-dashboard-ancha-img .d-dashboard-panel{width:100%;margin-left:0}
  .d-dashboard-altas{grid-template-columns:minmax(0,1fr);gap:24px}
  .d-dashboard-alta{padding:24px}
  .d-dashboard-card-r{font-size:16px;line-height:20.8px}
  .d-dashboard-card-t{margin-top:20px;font-size:20px;line-height:24px}
  .d-dashboard-finas{margin-top:44px;grid-template-columns:minmax(0,1fr);gap:24px;margin-left:-4px;margin-right:-4px}
  .d-dashboard-fina{padding:25px}
  .d-dashboard-fina-t{font-size:26px;line-height:32.5px}
  .d-dashboard-banda{padding:96px 0}
  .d-dashboard-banda-in{grid-template-columns:minmax(0,1fr);row-gap:48px;padding:0 24px}
  .d-dashboard-banda-h2{max-width:none}
  .d-dashboard-testi-h{font-size:18.24px;line-height:21.9px;padding:0 10px}
  .d-dashboard-testi-sub{padding:0 10px}
  .d-dashboard-testi-cols{grid-template-columns:minmax(0,1fr);gap:56px;margin-top:48px;padding:0 10px}
  .d-dashboard-testi-mes{text-align:center}
  .d-dashboard-testi-quien{flex-direction:column;align-items:flex-start}
  .d-dashboard-testi-av{align-self:center;margin:0 0 10px}
  .d-dashboard-pie-in{grid-template-columns:minmax(0,1fr);padding:40px 16px 48px;row-gap:32px}
  .d-dashboard-pie-marca{justify-self:center}
  .d-dashboard-pie-cols ul{columns:1}
}
@media (prefers-reduced-motion:reduce){
  .d-dashboard *{animation:none!important;transition:none!important}
  .d-dashboard-card:hover,.d-dashboard-fina:hover,.d-dashboard-franja-ics li:hover{transform:none}
}
`;
