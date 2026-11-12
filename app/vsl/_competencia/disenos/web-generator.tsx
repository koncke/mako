// =============================================================================
// /vsl/web-generator con el DISEÑO de HighLevel AI Studio (https://www.gohighlevel.com/ai-studio), copiado el 11/11/2026
// =============================================================================
// Los valores (Poppins, la barra en cápsula, el hero azul noche con la tarjeta blanca, la galería de tarjetas inclinadas
// en dos filas, los contadores entre dos rayas, las seis pestañas con su vista previa, las razones con su testimonio al
// lado, las pastillas por objetivo, las preguntas en dos columnas, la caja oscura del cierre y el pie) se leyeron con
// getComputedStyle a 1440 y 390 px: docs/diseno/landings-competencia/web-generator.md. De MaKo quedan el logo, el azul
// #2F6FED donde AI Studio pone su violeta y su azul, el dorado como detalle, el botón de la llamada y los textos.
//
// Lo de la referencia que NO va, y por qué:
//   · Su video de producto debajo del hero: no hay un video del Web Generator.
//   · La fila «✦ A launch page…» de su vista previa y el ejemplo de formulario de «Who is» («Jasmine Rivera»): son
//     ejemplos escritos por ellos; la vista previa muestra lo que dice cada pieza de MaKo.
//   · Su cadena «After they hit submit» (cita, mensaje, recordatorios): MaKo sólo afirma que lo que dejan en el
//     formulario entra a tu CRM, y eso ya lo dice la bajada de la sección.
//   · Las barras «The usual way · 3 to 6 weeks / AI Studio · Tonight»: tiempos suyos.
//   · El fondo del hero es una imagen que el proxy no deja bajar (images.leadconnectorhq.com): va su color, #07223D.
// Server component sin JavaScript: las pestañas y las pastillas son radios ocultos con :checked; la galería se mueve con CSS.
// =============================================================================

import type { PropsDiseno } from '.';
import type { Bloque } from '../tipos';
import { RUTA_CTA, CASO, LogoMaKo, TEXTO_CTA, html, otrasFunciones } from '../marca';
import { VisualDeLanding } from '../Visuales';
import { DISENOS_LANDING } from '@/lib/editor-landing/disenos-landing';
import { FUENTES, temaPorId } from '@/lib/editor-landing/temas';

type Tarjetas = Extract<Bloque, { tipo: 'tarjetas' }>;
type Hero = Extract<Bloque, { tipo: 'hero' }>;

function Ico({ paths, size = 20 }: { paths?: string[]; size?: number }) {
  if (!paths?.length) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths.map((d) => <path key={d} d={d} />)}
    </svg>
  );
}

function Boton() {
  return <a href={RUTA_CTA} className="d-wg-cta">{TEXTO_CTA}</a>;
}

function Puntos() {
  return <span className="d-wg-puntos" aria-hidden="true"><i /><i /><i /></span>;
}

function HeroWg({ b }: { b: Hero }) {
  return (
    <section className="d-wg-hero">
      <div className="d-wg-hero-in">
        <div className="d-wg-hero-txt">
          <span className="d-wg-badge">{b.etiqueta}</span>
          <h1 className="d-wg-h1" dangerouslySetInnerHTML={html(b.titulo)} />
          <p className="d-wg-hero-p" dangerouslySetInnerHTML={html(b.bajada)} />
        </div>
        <div className="d-wg-hero-card"><VisualDeLanding visual={b.visual} /></div>
      </div>
    </section>
  );
}

/** Un diseño de landing dibujado con los colores de su tema (lib/editor-landing/temas.ts) y el lugar de su video. */
function MiniDiseno({ nombre }: { nombre: string }) {
  const d = DISENOS_LANDING.find((x) => x.nombre === nombre);
  if (!d) return null;
  const t = temaPorId(d.tema);
  const tipo = FUENTES[t.fuentes.titulo.familia]?.tipo ?? 'sans';
  const fuente = tipo === 'serif' ? "Georgia, 'Times New Roman', serif" : tipo === 'mono' ? 'ui-monospace, Menlo, Consolas, monospace' : "'Poppins', Arial, sans-serif";
  const video = <span className="d-wg-mini-video"><span className="d-wg-mini-play" /></span>;
  return (
    <span className="d-wg-mini" style={{ background: t.fondo }}>
      <span className={`d-wg-mini-tarjeta${d.video === 'costado' ? ' d-wg-mini-costado' : ''}`} style={{ background: t.tarjeta.fondo, fontFamily: fuente }}>
        <span className="d-wg-mini-txt">
          <span className="d-wg-mini-h" style={{ background: t.colores.titulo }} />
          <span className="d-wg-mini-h d-wg-mini-h2" style={{ background: t.colores.titulo }} />
          <span className="d-wg-mini-x" style={{ background: t.colores.texto }} />
          {d.video !== 'centro' ? <span className="d-wg-mini-btn" style={{ background: t.colores.boton }} /> : null}
        </span>
        {d.video ? video : null}
        {d.video === 'centro' ? <span className="d-wg-mini-btn" style={{ background: t.colores.boton }} /> : null}
      </span>
    </span>
  );
}

const GIROS = [-4, 3, -2, 4, -3, 2, -4, 3, -2];

function Galeria({ b }: { b: Tarjetas }) {
  const mitad = Math.ceil(b.items.length / 2);
  const filas = [b.items.slice(0, mitad), b.items.slice(mitad)];
  return (
    <section className="d-wg-sec d-wg-galeria" id="disenos">
      <h2 className="d-wg-h2-gal" dangerouslySetInnerHTML={html(b.titulo)} />
      <div className="d-wg-filas">
        {filas.map((fila, f) => (
          <div key={f} className="d-wg-fila">
            <div className={`d-wg-pista d-wg-pista-${f}`}>
              {[0, 1].map((copia) => fila.map((it, i) => (
                <article key={`${copia}-${it.titulo}`} className="d-wg-post" style={{ transform: `rotate(${GIROS[(f * mitad + i) % GIROS.length]}deg)` }} aria-hidden={copia === 1 ? true : undefined}>
                  <MiniDiseno nombre={it.titulo} />
                  <span className="d-wg-post-pie">
                    <span className="d-wg-post-t" dangerouslySetInnerHTML={html(it.titulo)} />
                    <span className="d-wg-post-x" dangerouslySetInnerHTML={html(it.texto)} />
                  </span>
                </article>
              )))}
            </div>
          </div>
        ))}
      </div>
      <div className="d-wg-galeria-pie">
        {b.bajada ? <p className="d-wg-galeria-p" dangerouslySetInnerHTML={html(b.bajada)} /> : null}
        <Boton />
      </div>
    </section>
  );
}

function Cifras({ b }: { b: Extract<Bloque, { tipo: 'cifras' }> }) {
  return (
    <section className="d-wg-sec">
      <div className="d-wg-cifras">
        {b.titulo ? <h2 className="d-wg-h2-42" dangerouslySetInnerHTML={html(b.titulo)} /> : null}
        <div className="d-wg-cifras-fila">
          {b.items.map((c) => (
            <div key={c.label} className="d-wg-cifra">
              <b className="d-wg-cifra-v">{c.valor}</b>
              <span className="d-wg-cifra-l">{c.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function QueEs({ b, visual }: { b: Tarjetas; visual: Hero['visual'] | null }) {
  return (
    <section className="d-wg-sec d-wg-quees" id="que-es">
      <div className="d-wg-cont-1110">
        <div className="d-wg-enc">
          <h2 className="d-wg-h2-46" dangerouslySetInnerHTML={html(b.titulo)} />
          {b.bajada ? <p className="d-wg-enc-p" dangerouslySetInnerHTML={html(b.bajada)} /> : null}
        </div>
        <div className="d-wg-quees-cols">
          <div className="d-wg-quees-txt">
            {b.items.map((it) => (
              <div key={it.titulo} className="d-wg-quees-i">
                <h3 dangerouslySetInnerHTML={html(it.titulo)} />
                <p dangerouslySetInnerHTML={html(it.texto)} />
              </div>
            ))}
            <Boton />
          </div>
          <div className="d-wg-quees-marco">{visual ? <VisualDeLanding visual={visual} /> : null}</div>
        </div>
      </div>
    </section>
  );
}

/** El dibujo de una página dentro de su vista previa: sin un solo texto, como el de la referencia. */
function Esquema() {
  return (
    <span className="d-wg-esq" aria-hidden="true">
      <span className="d-wg-esq-barra"><i className="d-wg-esq-logo" /><span className="d-wg-esq-links"><i /><i /><i /></span><i className="d-wg-esq-pill" /></span>
      <span className="d-wg-esq-hero"><i className="d-wg-esq-cej" /><i className="d-wg-esq-l1" /><i className="d-wg-esq-l2" /><i className="d-wg-esq-l3" /><i className="d-wg-esq-btn" /></span>
      <span className="d-wg-esq-cards"><i /><i /><i /></span>
    </span>
  );
}

function QuePuedes({ b, nombre }: { b: Tarjetas; nombre: string }) {
  return (
    <section className="d-wg-sec d-wg-puedes">
      <div className="d-wg-cont-1300">
        <div className="d-wg-enc">
          <h2 className="d-wg-h2-46" dangerouslySetInnerHTML={html(b.titulo)} />
          {b.bajada ? <p className="d-wg-enc-p" dangerouslySetInnerHTML={html(b.bajada)} /> : null}
        </div>
        <div className="d-wg-tabs">
          {b.items.map((it, i) => <input key={it.titulo} type="radio" name="d-wg-tipo" id={`d-wg-t${i}`} className="d-wg-radio" defaultChecked={i === 0} aria-label={it.titulo.replace(/<[^>]+>/g, '')} />)}
          <div className="d-wg-tabs-fila">
            {b.items.map((it, i) => (
              <label key={it.titulo} htmlFor={`d-wg-t${i}`} className={`d-wg-tab d-wg-tab-${i}`}>
                <span className="d-wg-tab-ic"><Ico paths={it.icono} /></span>
                <strong dangerouslySetInnerHTML={html(it.titulo)} />
              </label>
            ))}
          </div>
          <div className="d-wg-prev">
            <div className="d-wg-prev-barra"><Puntos /><span>{nombre}</span></div>
            <div className="d-wg-prev-cuerpo">
              {b.items.map((it, i) => (
                <div key={it.titulo} className={`d-wg-prev-pan d-wg-prev-pan-${i}`}>
                  <h4 dangerouslySetInnerHTML={html(it.titulo)} />
                  <p dangerouslySetInnerHTML={html(it.texto)} />
                </div>
              ))}
              <Esquema />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** «Why Businesses Use It»: cada razón con su testimonio al lado. Los testimonios son el caso de Mauricio. */
const TINTAS = ['#EAF1FE', '#FFF6DE', '#F1F4F8'];
const AVATARES = ['#2F6FED', '#F2B01E', '#1E293B'];

function PorQue({ b, conCaso, soloCitas = false }: { b: Tarjetas; conCaso: boolean; soloCitas?: boolean }) {
  const citas = [CASO.titulo, CASO.historia[0], CASO.resultado];
  return (
    <section className="d-wg-sec d-wg-porque">
      <div className="d-wg-cont-1080">
        {soloCitas ? null : (
          <div className="d-wg-porque-cab">
            <h2 className="d-wg-h2-44" dangerouslySetInnerHTML={html(b.titulo)} />
            <Boton />
          </div>
        )}
        <div className="d-wg-porque-grilla">
          {b.items.map((it, i) => (
            <div key={`${i}-${it.titulo}`} className="d-wg-porque-fila">
              {soloCitas ? null : <article className="d-wg-razon" style={{ ['--d-wg-tinta' as string]: TINTAS[i % 3], ['--d-wg-av' as string]: AVATARES[i % 3] }}>
                <span className="d-wg-razon-cab"><span className="d-wg-razon-ic"><Ico paths={it.icono} /></span><span className="d-wg-razon-n">{String(i + 1).padStart(2, '0')}</span></span>
                <h3 dangerouslySetInnerHTML={html(it.titulo)} />
                <p dangerouslySetInnerHTML={html(it.texto)} />
              </article>}
              {conCaso && citas[i] ? (
                <figure className="d-wg-cita" style={{ background: TINTAS[i % 3] }}>
                  {i === 0 ? (
                    <span className="d-wg-cita-video">
                      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                      <video muted autoPlay loop playsInline preload="metadata"><source src={CASO.video} type="video/mp4" /></video>
                    </span>
                  ) : <span className="d-wg-cita-c" aria-hidden="true">“</span>}
                  <blockquote dangerouslySetInnerHTML={html(citas[i])} />
                  <figcaption>
                    <span className="d-wg-cita-av" style={{ background: AVATARES[i % 3] }}>M</span>
                    <span className="d-wg-cita-por"><b>{CASO.quien}</b><span>{i === 0 ? CASO.sub : CASO.rol}</span></span>
                  </figcaption>
                </figure>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ParaQuien({ b }: { b: Tarjetas }) {
  return (
    <section className="d-wg-sec d-wg-para">
      <div className="d-wg-cont-1300">
        <div className="d-wg-enc">
          <h2 className="d-wg-h2-46" dangerouslySetInnerHTML={html(b.titulo)} />
          {b.bajada ? <p className="d-wg-enc-p d-wg-enc-p18" dangerouslySetInnerHTML={html(b.bajada)} /> : null}
        </div>
        <div className="d-wg-para-in">
          {b.items.map((it, i) => <input key={it.titulo} type="radio" name="d-wg-para" id={`d-wg-p${i}`} className="d-wg-radio" defaultChecked={i === 0} aria-label={it.titulo.replace(/<[^>]+>/g, '')} />)}
          <div className="d-wg-pills">
            {b.items.map((it, i) => <label key={it.titulo} htmlFor={`d-wg-p${i}`} className={`d-wg-pill d-wg-pill-${i}`} dangerouslySetInnerHTML={html(it.titulo)} />)}
          </div>
          <div className="d-wg-ventana">
            <div className="d-wg-ventana-barra"><Puntos /><span className="d-wg-ventana-url">hola-mako.site</span>
              {b.items.map((it, i) => it.meta ? <span key={it.titulo} className={`d-wg-ventana-chip d-wg-para-pan d-wg-para-pan-${i}`}>{it.meta}</span> : null)}
            </div>
            <div className="d-wg-ventana-cuerpo">
              {b.items.map((it, i) => (
                <div key={it.titulo} className={`d-wg-para-pan d-wg-para-pan-${i}`}>
                  <p className="d-wg-ventana-t" dangerouslySetInnerHTML={html(it.titulo)} />
                  <p className="d-wg-ventana-x" dangerouslySetInnerHTML={html(it.texto)} />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="d-wg-centro"><Boton /></div>
      </div>
    </section>
  );
}

function Preguntas({ b }: { b: Extract<Bloque, { tipo: 'preguntas' }> }) {
  return (
    <section className="d-wg-sec d-wg-faq" id="preguntas">
      <div className="d-wg-cont-1080">
        <h2 className="d-wg-h2-42" dangerouslySetInnerHTML={html(b.titulo)} />
        <div className="d-wg-faq-grilla">
          {[0, 1].map((col) => (
            <div key={col} className="d-wg-faq-col">
              {b.items.filter((_, i) => i % 2 === col).map((q, i) => (
                <details key={q.p} className="d-wg-faq-i" open={col === 0 && i === 0 ? true : undefined}>
                  <summary><span>{q.p}</span><i aria-hidden="true" /></summary>
                  <div className="d-wg-faq-r"><p dangerouslySetInnerHTML={html(q.r)} /></div>
                </details>
              ))}
            </div>
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
    <footer className="d-wg-pie">
      <div className="d-wg-pie-cols">
        {columnas.map((col, i) => (
          <nav key={i} className="d-wg-pie-col" aria-label={i === 0 ? 'Funciones de MaKo' : undefined}>
            <p className="d-wg-pie-h">{i === 0 ? 'Funciones de MaKo' : ' '}</p>
            {col.map((f) => <a key={f.href} href={f.href} className="d-wg-pie-a">{f.nombre}</a>)}
          </nav>
        ))}
        <div className="d-wg-pie-col">
          <p className="d-wg-pie-h">Contacto</p>
          <a href={RUTA_CTA} className="d-wg-pie-a">{TEXTO_CTA}</a>
        </div>
      </div>
      <div className="d-wg-pie-base">
        <p>© 2026 MaKo</p>
        <p><a href="/privacidad">Privacidad</a> | <a href="/terminos">Términos</a></p>
      </div>
    </footer>
  );
}

export default function DisenoWebGenerator({ landing }: PropsDiseno) {
  const bloques = landing.bloques;
  const hero = bloques.find((b): b is Hero => b.tipo === 'hero') ?? null;
  const tarjetas = bloques.filter((b): b is Tarjetas => b.tipo === 'tarjetas');
  let nT = 0;
  return (
    <div className="d-wg">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="d-wg-nav-fondo">
        <header className="d-wg-nav">
          <LogoMaKo className="d-wg-logo" tamano={30} claro />
          <nav className="d-wg-nav-links" aria-label="En esta página">
            <a href="#que-es">¿Qué es?</a>
            <a href="#disenos">Diseños</a>
            <a href="#preguntas">Preguntas</a>
          </nav>
          <a href={RUTA_CTA} className="d-wg-nav-cta">{TEXTO_CTA}</a>
        </header>
      </div>
      {bloques.map((b, i) => {
        switch (b.tipo) {
          case 'hero': return <HeroWg key={i} b={b} />;
          case 'cifras': return <Cifras key={i} b={b} />;
          case 'tarjetas': {
            const n = nT++;
            // El orden de web-generator.ts: los diseños (la galería), qué es, qué puedes armar, por qué (con el caso al
            // lado) y para quién.
            if (n === 0) return <Galeria key={i} b={b} />;
            if (n === 1) return <QueEs key={i} b={b} visual={hero?.visual ?? null} />;
            if (n === 2) return <QuePuedes key={i} b={b} nombre={landing.nombre} />;
            if (n === 3) return <PorQue key={i} b={b} conCaso={bloques[i + 1]?.tipo === 'caso'} />;
            return <ParaQuien key={i} b={b} />;
          }
          // El caso va dentro de «Por qué», al lado de cada razón (como sus testimonios); suelto, sólo si no viene después.
          case 'caso': return bloques[i - 1] === tarjetas[3] ? null : <PorQue key={i} b={{ tipo: 'tarjetas', titulo: '', items: [0, 1, 2].map(() => ({ titulo: '', texto: '' })) }} conCaso soloCitas />;
          case 'preguntas': return <Preguntas key={i} b={b} />;
          default: return null;
        }
      })}
      <section className="d-wg-sec d-wg-cierre-sec">
        <div className="d-wg-cierre">
          <span className="d-wg-cierre-luz1" aria-hidden="true" />
          <span className="d-wg-cierre-luz2" aria-hidden="true" />
          <Boton />
        </div>
      </section>
      <Pie slug={landing.slug} />
    </div>
  );
}

// Los valores, de getComputedStyle sobre https://www.gohighlevel.com/ai-studio a 1440 y 390
// (docs/diseno/landings-competencia/web-generator.md).
const CSS = `
@font-face { font-family: 'Poppins'; font-style: normal; font-weight: 400; font-display: swap; src: url('/vsl-assets/fuentes/poppins/poppins-400.woff2') format('woff2'); }
@font-face { font-family: 'Poppins'; font-style: normal; font-weight: 600; font-display: swap; src: url('/vsl-assets/fuentes/poppins/poppins-600.woff2') format('woff2'); }
@font-face { font-family: 'Poppins'; font-style: normal; font-weight: 700; font-display: swap; src: url('/vsl-assets/fuentes/poppins/poppins-700.woff2') format('woff2'); }

.d-wg { background: #fff; color: #111318; font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 16px; line-height: 1.3; -webkit-font-smoothing: antialiased; overflow-x: clip; }
.d-wg *, .d-wg *::before, .d-wg *::after { box-sizing: border-box; }
.d-wg a { color: inherit; }
.d-wg h2 em, .d-wg h1 em { font-style: normal; }
.d-wg-centro { text-align: center; }
.d-wg-cont-1110 { max-width: 1110px; margin: 0 auto; }
.d-wg-cont-1300 { max-width: 1300px; margin: 0 auto; }
.d-wg-cont-1080 { max-width: 1080px; margin: 0 auto; }
.d-wg-sec { padding: 20px 20px; }

/* El resaltado de sus títulos (96deg, violeta y azul): pasa a los azules de MaKo. */
.d-wg h2 em { background-image: linear-gradient(96deg, #2F6FED 0%, #5B8CF0 55%, #1F57C8 100%); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }

/* El botón: 49 de alto, 15px 34px, radio 10, 15.5px 600; al pasar el mouse, scale(1.03) y la sombra más larga. */
.d-wg-cta { display: inline-block; padding: 15px 34px; border-radius: 10px; background-image: linear-gradient(111deg, #1F57C8 -2.59%, #2F6FED 54.66%, #5B8CF0 111.92%); box-shadow: rgba(47,111,237,.85) 0 12px 26px -12px; color: #fff !important; font-size: 15.5px; font-weight: 600; letter-spacing: -0.155px; text-decoration: none; text-align: center; white-space: nowrap; transition: transform .4s cubic-bezier(0.25, 1, 0.5, 1), opacity .4s, box-shadow .4s; }
.d-wg-cta:hover { transform: scale(1.03); opacity: .92; box-shadow: rgba(47,111,237,.95) 0 18px 34px -12px; }

/* La barra: una cápsula de 1170 × 70, radio 16, rgba(111,205,255,.14), sobre #04192D. */
.d-wg-nav-fondo { background: #04192D; padding: 10px 20px; }
.d-wg-nav { max-width: 1170px; height: 70px; margin: 0 auto; padding: 8px 20px; border-radius: 16px; background: rgba(111,205,255,.14); display: flex; align-items: center; gap: 12px; }
.d-wg-logo { margin-right: auto; }
.d-wg-logo span:last-child { font-family: 'Poppins', sans-serif; }
.d-wg-nav-links { display: flex; gap: 12px; }
.d-wg-nav-links a { padding: 8px 6px; color: #fff; font-size: 15px; line-height: 19.5px; text-decoration: none; margin-left: 12px; }
.d-wg-nav-links a:hover { text-decoration: underline; }
.d-wg-nav-cta { margin-left: 24px; padding: 6px 15px; height: 44px; white-space: nowrap; display: inline-flex; align-items: center; border-radius: 10px; background-image: linear-gradient(111deg, #1F57C8 -2.59%, #2F6FED 54.66%, #5B8CF0 111.92%); color: #fff !important; font-size: 16px; font-weight: 700; text-decoration: none; transition: transform .4s cubic-bezier(0.25, 1, 0.5, 1); }
.d-wg-nav-cta:hover { transform: scale(1.03); }

/* El hero: #07223D; dos columnas de 542 con 56 entre ellas; la tarjeta blanca al 96 %, radio 26. */
.d-wg-hero { background: #07223D; padding: 120px 20px 120px; color: #fff; }
.d-wg-hero-in { max-width: 1140px; margin: 0 auto; display: grid; grid-template-columns: 542px 542px; gap: 56px; align-items: flex-start; justify-content: space-between; }
.d-wg-badge { display: inline-block; margin: 0 0 20px; padding: 12px 32px; border-radius: 9999px; background: #1C3249; border: 1px solid #86CBFA; color: #fff; font-size: 17px; font-weight: 500; line-height: 22.1px; letter-spacing: -0.085px; }
.d-wg-h1 { margin: 0 0 24px; font-size: 62px; line-height: 65.72px; font-weight: 600; letter-spacing: -2.17px; color: #F4F8FE; }
.d-wg-h1 em { font-style: normal; background-image: linear-gradient(90deg, #8DB0F4 0%, #B4CBF8 55%, #DCE7FC 100%); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
.d-wg-hero-p { margin: 0; font-size: 21px; line-height: 31.5px; font-weight: 400; letter-spacing: -0.168px; color: #EEF4FC; }
.d-wg-hero-p strong { font-weight: 600; color: #fff; }
.d-wg-hero-card { padding: 16px 16px 18px; border-radius: 26px; background: rgba(255,255,255,.96); border: 1px solid rgba(154,196,255,.35); box-shadow: rgba(7,20,40,.2) 0 1px 2px 0, rgba(7,20,40,.6) 0 34px 80px -20px; color: #12151B; }

/* La galería: dos filas de tarjetas inclinadas que corren (31,68 px entre ellas, 36 entre filas). */
.d-wg-galeria { padding: 50px 0 60px; }
.d-wg-h2-gal { margin: 0 auto; max-width: 1110px; padding: 0 20px; text-align: center; font-size: 42px; line-height: 62.4px; font-weight: 600; color: #000; }
.d-wg-h2-gal em { display: block; background-image: linear-gradient(119deg, #2F6FED 15.13%, #5B8CF0 51.44%, #1F57C8 87.75%) !important; }
.d-wg-filas { margin-top: 61px; display: flex; flex-direction: column; gap: 36px; overflow: hidden; padding: 30px 0; }
.d-wg-fila { display: flex; }
.d-wg-pista { display: flex; gap: 31.68px; width: max-content; animation: dWgCorre 60s linear infinite; }
.d-wg-pista-1 { animation-direction: reverse; margin-left: -200px; }
@keyframes dWgCorre { from { transform: translateX(0); } to { transform: translateX(calc(-50% - 15.84px)); } }
.d-wg-filas:hover .d-wg-pista { animation-play-state: paused; }
.d-wg-post { flex: none; width: 400px; border-radius: 14px; background: #fff; border: 1px solid #E7EBF1; box-shadow: rgba(16,24,40,.08) 0 10px 28px 0; overflow: hidden; display: flex; flex-direction: column; }
.d-wg-mini { display: flex; height: 210px; padding: 22px; }
.d-wg-mini-tarjeta { flex: 1; border-radius: 10px; padding: 18px; display: flex; flex-direction: column; align-items: center; gap: 10px; box-shadow: 0 6px 18px -10px rgba(0,0,0,.35); }
.d-wg-mini-txt { width: 100%; display: flex; flex-direction: column; align-items: center; gap: 7px; }
.d-wg-mini-h { display: block; width: 70%; height: 11px; border-radius: 4px; }
.d-wg-mini-h2 { width: 48%; }
.d-wg-mini-x { display: block; width: 60%; height: 5px; border-radius: 3px; opacity: .45; }
.d-wg-mini-btn { display: block; width: 70px; height: 16px; border-radius: 99px; }
.d-wg-mini-video { flex: 1; width: 62%; min-height: 54px; border-radius: 8px; background: #12151B; display: flex; align-items: center; justify-content: center; }
.d-wg-mini-play { width: 0; height: 0; border-left: 11px solid #fff; border-top: 7px solid transparent; border-bottom: 7px solid transparent; }
.d-wg-mini-costado { flex-direction: row; align-items: center; }
.d-wg-mini-costado .d-wg-mini-txt { align-items: flex-start; flex: 1; }
.d-wg-mini-costado .d-wg-mini-h { width: 90%; } .d-wg-mini-costado .d-wg-mini-h2 { width: 66%; }
.d-wg-mini-costado .d-wg-mini-video { height: 80%; width: auto; flex: 1; }
.d-wg-post-pie { display: flex; flex-direction: column; gap: 2px; padding: 14px 18px 16px; border-top: 1px solid #EDF1F6; }
.d-wg-post-t { font-size: 15px; font-weight: 600; color: #101828; }
.d-wg-post-x { font-size: 13px; line-height: 19px; color: #667085; }
.d-wg-galeria-pie { display: flex; align-items: center; justify-content: center; gap: 22px; margin: 60px 20px 0; flex-wrap: wrap; }
.d-wg-galeria-p { margin: 0; max-width: 520px; font-size: 17px; font-weight: 500; letter-spacing: -0.255px; color: #475467; }

/* Los contadores: 1110 entre dos rayas #DADADA, 80px arriba y 76 abajo; tarjetas blancas, radio 22. */
.d-wg-cifras { max-width: 1110px; margin: 0 auto; padding: 80px 0 76px; border-top: 1px solid #DADADA; border-bottom: 1px solid #DADADA; }
.d-wg-h2-42 { margin: 0; text-align: center; font-size: 42px; line-height: 50.4px; font-weight: 600; letter-spacing: -1.47px; color: #000; }
.d-wg-cifras-fila { margin-top: 59px; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 30px; }
.d-wg-cifra { padding: 26px 22px 28px; border-radius: 22px; background: #fff; border: 1px solid #E4E4E4; box-shadow: rgba(0,0,0,.05) 0 2px 10px 0; text-align: center; transition: transform .4s cubic-bezier(0.25, 1, 0.5, 1); }
.d-wg-cifra:hover { transform: translateY(-4px); }
.d-wg-cifra-v { display: block; font-size: 46px; line-height: 52.9px; font-weight: 700; letter-spacing: -0.92px; background-image: linear-gradient(90deg, #1F2630 0%, #3A3F48 55%, #6B6B70 100%); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
.d-wg-cifra-l { display: block; margin-top: 18px; font-size: 15px; line-height: 17.25px; font-weight: 500; letter-spacing: 3px; text-transform: uppercase; color: #111729; }

/* Encabezados centrados: 46/49,22 px 600, -1.84px, #101828; bajada 19/30,78 #475467 en 780. */
.d-wg-enc { max-width: 780px; margin: 0 auto; text-align: center; }
.d-wg-h2-46 { margin: 0; font-size: 46px; line-height: 50.6px; font-weight: 600; letter-spacing: -1.748px; color: #101828; }
.d-wg-enc-p { margin: 16px 0 0; font-size: 19px; line-height: 30.78px; color: #475467; }
.d-wg-enc-p strong { color: #101828; font-weight: 600; }
.d-wg-puedes .d-wg-enc, .d-wg-para .d-wg-enc { max-width: none; }
.d-wg-enc-p18 { font-size: 18px; line-height: 28.8px; max-width: 560px; margin-left: auto; margin-right: auto; }

/* ¿Qué es?: 513 px de texto a la izquierda, el marco oscuro de 543 × 362 (radio 12) a la derecha. */
.d-wg-quees { padding: 70px 20px 60px; }
.d-wg-quees-cols { margin-top: 46px; display: grid; grid-template-columns: 513px 543px; justify-content: space-between; align-items: center; }
.d-wg-quees-i { margin-bottom: 31px; }
.d-wg-quees-i h3 { margin: 0 0 9px; font-size: 19px; font-weight: 600; letter-spacing: -0.418px; color: #1F57C8; }
.d-wg-quees-i p { margin: 0; font-size: 15px; line-height: 24.9px; color: #475467; }
.d-wg-quees-i strong { color: #101828; font-weight: 600; }
.d-wg-quees-marco { border-radius: 12px; padding: 27px; background-image: linear-gradient(165deg, #101828 0%, #0B1220 100%); box-shadow: rgba(16,24,40,.06) 0 2px 6px 0, rgba(16,24,40,.8) 0 30px 64px -30px; color: #12151B; }

/* ¿Qué puedes armar?: seis pestañas de 208 × 105 (radio 14) y la vista previa de 1300 (radio 16). */
.d-wg-puedes { padding: 80px 20px 60px; }
.d-wg-radio { position: absolute; opacity: 0; width: 1px; height: 1px; pointer-events: none; }
.d-wg-tabs-fila { margin: 60px 0 26px; display: grid; grid-template-columns: repeat(7, 1fr); gap: 10px; }
.d-wg-tab { position: relative; display: flex; flex-direction: column; align-items: center; gap: 10px; min-height: 105px; padding: 16px 12px 18px; border-radius: 14px; background: #fff; border: 1px solid #E7EBF1; cursor: pointer; text-align: center; transition: border-color .25s, background .25s, transform .25s cubic-bezier(0.34, 1.56, 0.64, 1); }
.d-wg-tab:hover { transform: translateY(-2px); border-color: #C9D7F5; }
.d-wg-tab-ic { width: 42px; height: 42px; border-radius: 11px; display: flex; align-items: center; justify-content: center; background: #F8FAFD; color: #98A2B3; transition: background .3s, color .3s; }
.d-wg-tab strong { font-size: 14px; font-weight: 600; letter-spacing: -0.21px; color: #101828; line-height: 1.25; }
.d-wg-tab::after { content: ''; position: absolute; left: 50%; bottom: -1px; width: 48px; height: 3px; border-radius: 3px; background: #2F6FED; transform: translateX(-50%) scaleX(0); transition: transform .3s; }
.d-wg-prev { border-radius: 16px; background: #fff; border: 1px solid #E7EBF1; box-shadow: rgba(16,24,40,.03) 0 1px 2px 0, rgba(16,24,40,.5) 0 22px 50px -30px; overflow: hidden; }
.d-wg-prev-barra { display: flex; align-items: center; gap: 14px; padding: 11px 15px; background: #F6F8FC; border-bottom: 1px solid #EAEEF4; font-size: 11.5px; font-weight: 500; color: #7A8697; }
.d-wg-puntos { display: inline-flex; gap: 5px; }
.d-wg-puntos i { width: 9px; height: 9px; border-radius: 50%; background: #FF5F57; }
.d-wg-puntos i:nth-child(2) { background: #FEBC2E; } .d-wg-puntos i:nth-child(3) { background: #28C840; }
.d-wg-prev-cuerpo { background: #FBFCFE; padding: 34px 38px 60px; min-height: 580px; display: flex; flex-direction: column; align-items: center; }
.d-wg-prev-pan { display: none; text-align: center; max-width: 620px; }
.d-wg-prev-pan h4 { margin: 0; font-size: 27px; line-height: 32.4px; font-weight: 600; letter-spacing: -0.702px; color: #101828; }
.d-wg-prev-pan p { margin: 8px 0 0; font-size: 14.5px; line-height: 23.2px; color: #475467; }
.d-wg-prev-pan strong { color: #101828; font-weight: 600; }
.d-wg-esq { margin-top: 40px; width: 100%; max-width: 780px; border-radius: 13px; background: #fff; border: 1px solid #E7EBF1; box-shadow: rgba(16,24,40,.5) 0 10px 30px -18px; overflow: hidden; display: flex; flex-direction: column; }
.d-wg-esq i { display: block; }
.d-wg-esq-barra { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid #F2F4F8; }
.d-wg-esq-logo { width: 18px; height: 18px; border-radius: 5px; background: #2F6FED; }
.d-wg-esq-links { display: flex; gap: 8px; margin-left: auto; }
.d-wg-esq-links i { width: 28px; height: 5px; border-radius: 3px; background: #E4E7EC; }
.d-wg-esq-pill { width: 44px; height: 22px; border-radius: 99px; background: #2F6FED; }
.d-wg-esq-hero { display: flex; flex-direction: column; gap: 12px; padding: 34px 30px 28px; background: #EAF1FE; }
.d-wg-esq-cej { width: 60px; height: 6px; border-radius: 3px; background: #2F6FED; }
.d-wg-esq-l1 { width: 66%; height: 21px; border-radius: 6px; background: rgba(16,24,40,.17); }
.d-wg-esq-l2 { width: 44%; height: 21px; border-radius: 6px; background: rgba(16,24,40,.17); }
.d-wg-esq-l3 { width: 57%; height: 6px; border-radius: 3px; background: rgba(16,24,40,.1); }
.d-wg-esq-btn { width: 116px; height: 29px; border-radius: 8px; background: #2F6FED; margin-top: 8px; }
.d-wg-esq-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; padding: 12px 22px 14px; }
.d-wg-esq-cards i { height: 45px; border-radius: 8px; background: #F7F9FC; border: 1px solid #EEF1F6; }
${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `#d-wg-t${i}:checked ~ .d-wg-tabs-fila .d-wg-tab-${i} { background: #EAF1FE; border-color: #2F6FED; box-shadow: rgba(16,24,40,.03) 0 1px 2px 0, rgba(16,24,40,.5) 0 12px 28px -20px; }
#d-wg-t${i}:checked ~ .d-wg-tabs-fila .d-wg-tab-${i} .d-wg-tab-ic { background: #2F6FED; color: #fff; }
#d-wg-t${i}:checked ~ .d-wg-tabs-fila .d-wg-tab-${i}::after { transform: translateX(-50%) scaleX(1); }
#d-wg-t${i}:focus-visible ~ .d-wg-tabs-fila .d-wg-tab-${i} { outline: 2px solid #2F6FED; outline-offset: 3px; }
#d-wg-t${i}:checked ~ .d-wg-prev .d-wg-prev-pan-${i} { display: block; animation: dWgEntra .4s ease both; }
#d-wg-p${i}:checked ~ .d-wg-pills .d-wg-pill-${i} { background: #2F6FED; border-color: transparent; color: #fff; box-shadow: #2F6FED 0 10px 22px -10px; }
#d-wg-p${i}:focus-visible ~ .d-wg-pills .d-wg-pill-${i} { outline: 2px solid #2F6FED; outline-offset: 3px; }
#d-wg-p${i}:checked ~ .d-wg-ventana .d-wg-para-pan-${i} { display: block; animation: dWgEntra .4s ease both; }
#d-wg-p${i}:checked ~ .d-wg-ventana .d-wg-ventana-chip.d-wg-para-pan-${i} { display: inline-block; }`).join('\n')}
@keyframes dWgEntra { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }

/* Por qué: la cabecera con el botón a la derecha; filas de 611 + 453 con 16 entre ellas. */
.d-wg-porque { padding: 80px 20px 60px; }
.d-wg-porque-cab { display: flex; align-items: center; justify-content: space-between; gap: 24px; margin-bottom: 40px; }
.d-wg-h2-44 { margin: 0; font-size: 44px; line-height: 48.4px; font-weight: 600; letter-spacing: -1.54px; color: #0F1D2E; }
.d-wg-porque-grilla { display: flex; flex-direction: column; gap: 16px; }
.d-wg-porque-fila { display: grid; grid-template-columns: 611fr 453fr; gap: 16px; }
.d-wg-porque-fila:only-child, .d-wg-porque-fila > :only-child { grid-column: 1 / -1; }
.d-wg-razon { position: relative; padding: 26px 26px 24px; border-radius: 20px; background: #fff; border: 1px solid #E5EAF2; box-shadow: rgba(15,29,46,.03) 0 1px 2px 0; transition: transform .55s cubic-bezier(0.34, 1.56, 0.64, 1), border-color .3s; }
.d-wg-razon::before { content: ''; position: absolute; top: -1px; left: 26px; width: 48px; height: 3px; border-radius: 0 0 3px 3px; background: var(--d-wg-av); }
.d-wg-razon:hover { border-color: #C9D7F5; transform: translateY(-2px); }
.d-wg-razon-cab { display: flex; justify-content: space-between; align-items: flex-start; }
.d-wg-razon-ic { width: 42px; height: 42px; border-radius: 12px; background: var(--d-wg-tinta); color: #0F1D2E; display: flex; align-items: center; justify-content: center; }
.d-wg-razon-n { font-size: 11.5px; font-weight: 700; letter-spacing: 1.15px; color: #C3CCDA; }
.d-wg-razon h3 { margin: 18px 0 10px; font-size: 21px; line-height: 26.25px; font-weight: 600; letter-spacing: -0.504px; color: #0F1D2E; }
.d-wg-razon p { margin: 0; font-size: 14.5px; line-height: 23.78px; letter-spacing: -0.0725px; color: #55637A; }
.d-wg-razon strong { color: #0F1D2E; font-weight: 600; }
.d-wg-cita { margin: 0; padding: 26px; border-radius: 20px; border: 1px solid transparent; display: flex; flex-direction: column; justify-content: center; }
.d-wg-cita-c { font-size: 40px; line-height: 1; color: #98A2B3; height: 26px; }
.d-wg-cita blockquote { margin: 0 0 22px; font-size: 17px; line-height: 24.65px; font-weight: 500; letter-spacing: -0.34px; color: #0F1D2E; }
.d-wg-cita blockquote strong { font-weight: 600; }
.d-wg-cita figcaption { display: flex; align-items: center; gap: 11px; }
.d-wg-cita-av { width: 34px; height: 34px; border-radius: 50%; color: #fff; display: inline-flex; align-items: center; justify-content: center; font-size: 11.5px; font-weight: 700; letter-spacing: .23px; flex: none; }
.d-wg-cita-por { display: flex; flex-direction: column; }
.d-wg-cita-por b { font-size: 12.5px; font-weight: 600; color: #0F1D2E; }
.d-wg-cita-por span { font-size: 12px; color: #667085; }
.d-wg-cita-video { display: block; height: 140px; margin-bottom: 18px; border-radius: 12px; overflow: hidden; background: #0B1220; }
.d-wg-cita-video video { width: 100%; height: 100%; object-fit: cover; display: block; }

/* ¿Para quién?: pastillas de 38 de alto (radio 9999, 10px 20px, 13.5px 500) y la ventana de 552 (radio 20). */
.d-wg-para { padding: 80px 20px 60px; }
.d-wg-pills { margin: 32px auto 56px; display: flex; flex-wrap: wrap; justify-content: center; gap: 9px; max-width: 1000px; }
.d-wg-pill { display: inline-flex; align-items: center; height: 38px; padding: 10px 20px; border-radius: 9999px; background: #fff; border: 1px solid #E7EBF1; color: #475467; font-size: 13.5px; font-weight: 500; letter-spacing: -0.135px; cursor: pointer; transition: color .25s, border-color .25s, background .25s, transform .25s cubic-bezier(0.34, 1.56, 0.64, 1); }
.d-wg-pill:hover { transform: translateY(-1px); border-color: #C9D7F5; }
.d-wg-ventana { max-width: 552px; margin: 0 auto; border-radius: 20px; background: #fff; border: 1px solid #E7EBF1; box-shadow: rgba(16,24,40,.03) 0 1px 2px 0, rgba(16,24,40,.5) 0 24px 54px -30px; overflow: hidden; }
.d-wg-ventana-barra { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: #F8FAFD; border-bottom: 1px solid #EDF1F7; }
.d-wg-ventana-url { font-size: 11.5px; color: #7A8697; margin-right: auto; }
.d-wg-ventana-chip { display: none; padding: 4px 11px; border-radius: 9999px; background: #E8F6EF; color: #0F7A45; font-size: 10px; font-weight: 700; letter-spacing: .4px; }
.d-wg-ventana-cuerpo { padding: 26px 26px 30px; min-height: 200px; }
.d-wg-para-pan { display: none; }
.d-wg-ventana-t { margin: 0 0 10px; font-size: 17px; font-weight: 600; letter-spacing: -0.34px; color: #101828; }
.d-wg-ventana-x { margin: 0; font-size: 14px; line-height: 22px; color: #475467; }
.d-wg-para .d-wg-centro { margin-top: 40px; }

/* Preguntas: dos columnas de 533 con 14 entre ellas; cada una #EFF4FE, radio 14; la abierta con borde azul. */
.d-wg-faq { padding: 80px 20px 60px; }
.d-wg-faq-grilla { margin-top: 35px; display: grid; grid-template-columns: 1fr 1fr; gap: 14px; align-items: start; }
.d-wg-faq-col { display: flex; flex-direction: column; gap: 14px; }
.d-wg-faq-i { border-radius: 14px; background: #EFF4FE; border: 1px solid transparent; overflow: hidden; transition: border-color .25s; }
.d-wg-faq-i[open] { border-color: rgba(47,111,237,.35); }
.d-wg-faq-i:hover { border-color: rgba(47,111,237,.28); }
.d-wg-faq-i summary { list-style: none; display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 18px 20px; font-size: 15.5px; line-height: 21.7px; font-weight: 500; letter-spacing: -0.155px; color: #101828; cursor: pointer; }
.d-wg-faq-i summary::-webkit-details-marker { display: none; }
.d-wg-faq-i summary i { position: relative; flex: none; width: 12px; height: 12px; }
.d-wg-faq-i summary i::before, .d-wg-faq-i summary i::after { content: ''; position: absolute; left: 0; top: 5px; width: 12px; height: 2px; border-radius: 2px; background: #101828; transition: transform .25s; }
.d-wg-faq-i summary i::after { transform: rotate(90deg); }
.d-wg-faq-i[open] summary i::after { transform: rotate(0deg); }
.d-wg-faq-r { padding: 0 20px 20px; }
.d-wg-faq-r p { margin: 0; font-size: 14.5px; line-height: 23.925px; color: #56616F; }
.d-wg-faq-r a { color: #1F57C8; }

/* El cierre: caja de 1040, #0C1322, radio 28, con sus dos luces (arriba a la izquierda y abajo a la derecha). */
.d-wg-cierre-sec { padding: 60px 20px 60px; }
.d-wg-cierre { position: relative; max-width: 1040px; margin: 0 auto; padding: 56px 40px 48px; border-radius: 28px; background: #0C1322; border: 1px solid rgba(255,255,255,.08); overflow: hidden; display: flex; flex-direction: column; align-items: center; gap: 22px; }
.d-wg-cierre-luz1 { position: absolute; left: -139px; top: -239px; width: 520px; height: 520px; border-radius: 50%; background-image: radial-gradient(circle, rgba(47,111,237,.32) 0%, rgba(0,0,0,0) 62%); }
.d-wg-cierre-luz2 { position: absolute; right: -159px; bottom: -279px; width: 560px; height: 560px; border-radius: 50%; background-image: radial-gradient(circle, rgba(242,176,30,.18) 0%, rgba(0,0,0,0) 60%); }
.d-wg-cierre .d-wg-cta { position: relative; box-shadow: rgba(47,111,237,.75) 0 14px 30px -10px; }

/* El pie: #07223D, 40px 20px 0; títulos de 17 en mayúsculas, links #6482A2 de 15; el © a la izquierda y lo legal a la derecha. */
.d-wg-pie { background: #07223D; color: #fff; padding: 40px 20px 0; }
.d-wg-pie-cols { max-width: 1150px; margin: 0 auto; padding: 14px 5px 40px; display: grid; grid-template-columns: 321px 299px 289px 1fr; }
.d-wg-pie-col { display: flex; flex-direction: column; align-items: flex-start; }
.d-wg-pie-h { margin: 0 0 21px; font-size: 17px; line-height: 22.1px; font-weight: 400; text-transform: uppercase; }
.d-wg-pie-a { font-size: 15px; line-height: 19.5px; padding: 5px 0; color: #6482A2 !important; text-decoration: none; }
.d-wg-pie-a:hover { color: #fff !important; }
.d-wg-pie-base { max-width: 1170px; margin: 0 auto; border-top: 2px solid #fff; padding: 15px 0 5px; display: flex; justify-content: space-between; align-items: center; gap: 12px; font-size: 14px; line-height: 18.2px; }
.d-wg-pie-base p { margin: 0 0 24px 344px; }
.d-wg-pie-base p + p { margin: 0 0 24px; }
.d-wg-pie-base a { text-decoration: none; }

@media (max-width: 1200px) {
  .d-wg-hero-in { grid-template-columns: 1fr 1fr; gap: 40px; }
  .d-wg-quees-cols { grid-template-columns: 1fr 1fr; gap: 40px; }
  .d-wg-tabs-fila { grid-template-columns: repeat(3, 1fr); }
  .d-wg-pie-base p { margin-left: 0; }
}

/* 390: lo medido en su versión de teléfono. */
@media (max-width: 767px) {
  .d-wg-nav-fondo { padding: 10px; }
  .d-wg-nav { height: 60px; padding: 8px 10px; }
  .d-wg-nav-links { display: none; }
  .d-wg-nav-cta { height: 36px; font-size: 14px; padding: 6px 12px; margin-left: 0; }
  .d-wg-hero { padding: 40px 20px 60px; }
  .d-wg-hero-in { grid-template-columns: 1fr; gap: 40px; }
  .d-wg-hero-txt { text-align: center; }
  .d-wg-badge { font-size: 14px; line-height: 18.2px; padding: 12px 32px; }
  .d-wg-h1 { font-size: 34px; line-height: 36.04px; letter-spacing: -1.19px; }
  .d-wg-hero-p { font-size: 16px; line-height: 24px; letter-spacing: -0.128px; }
  .d-wg-hero-card { padding: 12px; }
  .d-wg-galeria { padding: 50px 0 40px; }
  .d-wg-h2-gal { font-size: 42px; line-height: 49.4px; }
  .d-wg-post { width: 300px; }
  .d-wg-mini { height: 170px; padding: 16px; }
  .d-wg-galeria-pie { flex-direction: column; gap: 14px; }
  .d-wg-galeria-pie .d-wg-cta { width: 298px; }
  .d-wg-galeria-p { text-align: center; }
  .d-wg-cifras { padding: 50px 10px 50px; }
  .d-wg-h2-42 { font-size: 28px; line-height: 33.6px; letter-spacing: -0.98px; }
  .d-wg-cifras-fila { grid-template-columns: 1fr; gap: 20px; margin-top: 40px; }
  .d-wg-cifra-l { font-size: 13.5px; line-height: 15.525px; letter-spacing: 2.16px; }
  .d-wg-h2-46 { font-size: 28px; line-height: 30.8px; letter-spacing: -1.064px; }
  .d-wg-quees .d-wg-h2-46 { font-size: 32.76px; line-height: 35.05px; letter-spacing: -1.31px; }
  .d-wg-enc-p { font-size: 15px; line-height: 24px; }
  .d-wg-quees { padding: 60px 26px 40px; }
  .d-wg-quees-cols { grid-template-columns: 1fr; gap: 30px; }
  .d-wg-quees-i h3 { font-size: 17.5px; }
  .d-wg-quees-i p { font-size: 14.5px; line-height: 24.07px; }
  .d-wg-quees-marco { padding: 14px; }
  .d-wg-puedes { padding: 60px 16px 40px; }
  .d-wg-tabs-fila { grid-template-columns: repeat(2, 1fr); margin: 40px 0 20px; }
  .d-wg-prev-cuerpo { padding: 24px 16px 30px; min-height: 0; }
  .d-wg-prev-pan h4 { font-size: 21px; line-height: 25.2px; letter-spacing: -0.546px; }
  .d-wg-porque { padding: 60px 24px 40px; }
  .d-wg-porque-cab { flex-direction: column; align-items: flex-start; }
  .d-wg-h2-44 { font-size: 31.98px; line-height: 35.18px; letter-spacing: -1.12px; }
  .d-wg-porque-fila { grid-template-columns: 1fr; }
  .d-wg-razon p { font-size: 13.5px; line-height: 22.14px; }
  .d-wg-para { padding: 60px 18px 40px; }
  .d-wg-pill { height: 35px; padding: 9px 15px; font-size: 12.5px; }
  .d-wg-faq { padding: 60px 16px 40px; }
  .d-wg-faq-grilla { grid-template-columns: 1fr; }
  .d-wg-faq-i summary { font-size: 14.5px; line-height: 20.3px; }
  .d-wg-cierre { padding: 40px 20px 36px; }
  .d-wg-pie-cols { grid-template-columns: 1fr; padding: 0 0 20px; }
  .d-wg-pie-col { margin-bottom: 26px; }
  .d-wg-pie-col:nth-child(2) .d-wg-pie-h, .d-wg-pie-col:nth-child(3) .d-wg-pie-h { display: none; }
  .d-wg-pie-col:nth-child(2), .d-wg-pie-col:nth-child(3) { margin-top: -26px; }
  .d-wg-pie-base { flex-direction: column; text-align: center; }
  .d-wg-pie-base p { margin: 10px 0; }
}

@media (prefers-reduced-motion: reduce) {
  .d-wg *, .d-wg *::before, .d-wg *::after { animation: none !important; transition: none !important; }
  .d-wg-pista { flex-wrap: wrap; width: auto; justify-content: center; margin-left: 0; }
}
`;
