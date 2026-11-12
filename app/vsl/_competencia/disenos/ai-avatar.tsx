// =============================================================================
// /vsl/ai-avatar con el DISEÑO de la página de HeyGen para anuncios UGC (copiado el 11/11/2026)
// =============================================================================
// Referencia: https://www.heygen.com/es-mx/business/marketing/ugc-video-ads — los valores medidos con getComputedStyle a
// 1440 y a 390 px están en docs/diseno/landings-competencia/ai-avatar.md. Se copió la página entera: la barra flotante con
// su borde en degradado, la miga de pan, el hero de dos columnas con el titular gigante, la banda gris redondeada con las
// tarjetas negras de números, los encabezados de sección con el botón a la derecha, las dos tarjetas «Sin / Con», las filas
// alternadas dentro de tarjetas crema con radio 80, los pasos con su pastilla «Paso N», la grilla de casos de uso, la
// tarjeta de testimonio con el video a la derecha, las preguntas en tarjetas grises a la derecha del título, la banda final
// con su degradado y el pie negro con columnas.
// Fuentes: HeyGen usa «ABC Solar Display» (títulos) y «TT Norms Pro» (texto), las dos de pago; acá van Gabarito y Figtree
// (Google Fonts, OFL), las más parecidas, servidas desde /vsl-assets/fuentes/.
// De MaKo: el logo, el azul #2F6FED donde HeyGen pone su cian (botones, pastillas, la miga activa, los tildes), el dorado
// en el borde de la barra, el caso de Mauricio en la tarjeta de testimonio y las otras funciones en las columnas del pie.
// Lo que NO se copió, y por qué:
//   · Sus logos de clientes (la cinta de la banda gris), su sección de reseñas de G2 (estrellas, 10X / 5X / 40 %, insignias)
//     y su fila «4.8 · 1,300+ reviews»: son prueba social y premios de HeyGen.
//   · Las flechas y los puntos del carrusel de testimonios: hay un solo caso, el de Mauricio.
//   · «Explora más soluciones» (tres columnas de links): las otras funciones de MaKo van en el pie, como pide el molde.
//   · Las imágenes de las tarjetas «Sin / Con» (un esquema de tiempos y una captura de su app): MaKo no tiene una pieza
//     que diga eso. Las capturas de las filas: en su lugar va el ícono de cada capacidad, en el mismo panel de color.
//   · El selector de idioma, las redes sociales del pie y el «Contactar a ventas»: en su lugar, «Funcionalidades».
// Server component sin JavaScript: animaciones sólo con CSS, apagadas con prefers-reduced-motion.
// =============================================================================

import type { PropsDiseno } from '.';
import { Icon } from '../../_detalle/FeatureDetail';
import { RUTA_CTA, CASO, LogoMaKo, TEXTO_CTA, html, otrasFunciones, TEXTO_CIERRE } from '../marca';
import type { Bloque } from '../tipos';
import { VisualDeLanding } from '../Visuales';

type Hero = Extract<Bloque, { tipo: 'hero' }>;

function Flecha() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="M13 18l6 -6" /><path d="M13 6l6 6" /></svg>;
}

function Tilde() {
  return <svg className="d-ai-avatar-tilde" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg>;
}

function Boton({ flecha = false, clase = '' }: { flecha?: boolean; clase?: string }) {
  return <a href={RUTA_CTA} className={`d-ai-avatar-btn ${clase}`}>{TEXTO_CTA}{flecha ? <Flecha /> : null}</a>;
}

/** La miga de pan de HeyGen (arriba del hero y arriba del pie): el último paso, en el color de marca. */
function Miga({ hero, nombre, oscura = false }: { hero: Hero | undefined; nombre: string; oscura?: boolean }) {
  return (
    <nav className={`d-ai-avatar-miga${oscura ? ' d-ai-avatar-miga-osc' : ''}`} aria-label="Ruta">
      <a href="/">Inicio</a><span aria-hidden="true">→</span>
      <a href="/vsl">Funcionalidades</a><span aria-hidden="true">→</span>
      <span>{nombre}</span>
      {hero ? <><span aria-hidden="true">→</span><span className="d-ai-avatar-miga-act">{hero.etiqueta}</span></> : null}
    </nav>
  );
}

/** El encabezado de cada sección de HeyGen: el título enorme, su bajada debajo y el botón abajo a la derecha. */
function Cabeza({ titulo, bajada, comoTitulo = true }: { titulo: string; bajada?: string; comoTitulo?: boolean }) {
  return (
    <div className="d-ai-avatar-cabeza">
      <div>
        {comoTitulo ? <h2 className="d-ai-avatar-h2" dangerouslySetInnerHTML={html(titulo)} /> : <h2 className="d-ai-avatar-h2">{titulo}</h2>}
        {bajada ? <p className="d-ai-avatar-cabeza-p" dangerouslySetInnerHTML={html(bajada)} /> : null}
      </div>
      <Boton />
    </div>
  );
}

function DibujarBloque({ b, hero, icono, n }: { b: Bloque; hero: Hero | undefined; icono: string[]; n: number }) {
  switch (b.tipo) {
    case 'hero':
      return (
        <section className="d-ai-avatar-hero">
          <div className="d-ai-avatar-hero-in">
            <div className="d-ai-avatar-hero-txt">
              <Miga hero={b} nombre="AI Avatar" />
              <h1 className="d-ai-avatar-h1" dangerouslySetInnerHTML={html(b.titulo)} />
              <div className="d-ai-avatar-hero-baja">
                <p className="d-ai-avatar-hero-p" dangerouslySetInnerHTML={html(b.bajada)} />
                {b.puntos?.length ? (
                  <ul className="d-ai-avatar-checks">
                    {b.puntos.map((p) => <li key={p}><Tilde /><span dangerouslySetInnerHTML={html(p)} /></li>)}
                  </ul>
                ) : null}
              </div>
              <a href={RUTA_CTA} className="d-ai-avatar-btn d-ai-avatar-btn-negro">{TEXTO_CTA}<Flecha /></a>
            </div>
            <div className="d-ai-avatar-hero-media"><div className="d-ai-avatar-video"><VisualDeLanding visual={b.visual} /></div></div>
          </div>
        </section>
      );
    case 'cifras':
      return (
        <section className="d-ai-avatar-banda" aria-label={b.titulo ?? 'En números'}>
          <ul className="d-ai-avatar-cifras">
            {b.items.map((c) => (
              <li key={c.label}><span className="d-ai-avatar-cifra-v">{c.valor}</span><span className="d-ai-avatar-cifra-l">{c.label}</span></li>
            ))}
          </ul>
          {b.titulo ? <p className="d-ai-avatar-banda-pie"><span>{b.titulo}</span></p> : null}
        </section>
      );
    case 'contraste':
      return (
        <section className="d-ai-avatar-sec">
          {/* HeyGen: «El reto del marketing» como título y una frase debajo. La etiqueta del bloque es ese título corto. */}
          {b.etiqueta ? <Cabeza titulo={b.etiqueta} bajada={b.titulo} comoTitulo={false} /> : <Cabeza titulo={b.titulo} />}
          <div className="d-ai-avatar-reto">
            <div className="d-ai-avatar-reto-c">
              <span className="d-ai-avatar-pil">Sin MaKo</span>
              <h3 className="d-ai-avatar-h3" dangerouslySetInnerHTML={html(b.sin.titulo)} />
              <p className="d-ai-avatar-reto-p" dangerouslySetInnerHTML={html(b.sin.texto)} />
            </div>
            <div className="d-ai-avatar-reto-c">
              <span className="d-ai-avatar-pil">Con MaKo</span>
              <h3 className="d-ai-avatar-h3" dangerouslySetInnerHTML={html(b.con.titulo)} />
              <p className="d-ai-avatar-reto-p" dangerouslySetInnerHTML={html(b.con.texto)} />
            </div>
          </div>
        </section>
      );
    case 'tarjetas':
      // HeyGen tiene dos secciones de tarjetas: primero las filas alternadas de capacidades y, después de los pasos, la
      // grilla de tres columnas «Diseñado para todas tus necesidades». La primera tarjeta de la landing va a las filas.
      if (n > 0) {
        return (
          <section className="d-ai-avatar-sec">
            <Cabeza titulo={b.titulo} bajada={b.bajada} />
            <div className="d-ai-avatar-usos">
              {b.items.map((t) => (
                <div key={t.titulo} className="d-ai-avatar-uso">
                  <span className="d-ai-avatar-uso-ic"><Icon paths={t.icono ?? icono} size={30} /></span>
                  <h3 className="d-ai-avatar-uso-t" dangerouslySetInnerHTML={html(t.titulo)} />
                  <p className="d-ai-avatar-uso-p" dangerouslySetInnerHTML={html(t.texto)} />
                </div>
              ))}
            </div>
          </section>
        );
      }
      return (
        <section className="d-ai-avatar-sec">
          <Cabeza titulo={b.titulo} bajada={b.bajada} />
          <div className="d-ai-avatar-filas">
            {b.items.map((t, i) => (
              <div key={t.titulo} className={`d-ai-avatar-fila${i % 2 ? ' d-ai-avatar-fila-inv' : ''}`}>
                <div className={`d-ai-avatar-panel d-ai-avatar-panel-${i % 3}`}>
                  <span className="d-ai-avatar-panel-ic"><Icon paths={t.icono ?? icono} size={64} /></span>
                </div>
                <div className="d-ai-avatar-fila-txt">
                  <div>
                    <h3 className="d-ai-avatar-fila-h" dangerouslySetInnerHTML={html(t.titulo)} />
                    <p className="d-ai-avatar-fila-p" dangerouslySetInnerHTML={html(t.texto)} />
                  </div>
                  <Boton flecha />
                </div>
              </div>
            ))}
          </div>
        </section>
      );
    case 'pasos':
      return (
        <section className="d-ai-avatar-sec">
          <Cabeza titulo={b.titulo} bajada={b.bajada} />
          <ol className="d-ai-avatar-pasos">
            {b.pasos.map((p, i) => (
              <li key={p.titulo} className={`d-ai-avatar-paso${i % 2 ? ' d-ai-avatar-paso-inv' : ''}`}>
                {/* La foto inclinada de HeyGen: acá, la pieza del visual de AI Avatar que corresponde a ese paso. */}
                <div className={`d-ai-avatar-paso-img d-ai-avatar-paso-img-${i + 1}`} aria-hidden="true">
                  {hero ? <div className="d-ai-avatar-paso-pieza"><VisualDeLanding visual={hero.visual} /></div> : null}
                </div>
                <div className="d-ai-avatar-paso-txt">
                  <span className="d-ai-avatar-paso-n">Paso {i + 1}</span>
                  <h3 className="d-ai-avatar-paso-h" dangerouslySetInnerHTML={html(p.titulo)} />
                  <p className="d-ai-avatar-paso-p" dangerouslySetInnerHTML={html(p.texto)} />
                  <Boton />
                </div>
              </li>
            ))}
          </ol>
        </section>
      );
    case 'caso':
      return (
        <section className="d-ai-avatar-testi">
          <div className="d-ai-avatar-testi-in">
            <h2 className="d-ai-avatar-testi-h" dangerouslySetInnerHTML={html(CASO.titulo)} />
            <p className="d-ai-avatar-testi-sub">{CASO.sub}</p>
            <div className="d-ai-avatar-testi-c">
              <div className="d-ai-avatar-testi-txt">
                <span className="d-ai-avatar-testi-n">{CASO.quien}</span>
                {CASO.historia.map((h) => <p key={h} className="d-ai-avatar-testi-q" dangerouslySetInnerHTML={html(h)} />)}
                <p className="d-ai-avatar-testi-q" dangerouslySetInnerHTML={html(CASO.resultado)} />
                <span className="d-ai-avatar-testi-a">{CASO.quien}, {CASO.rol}</span>
              </div>
              <div className="d-ai-avatar-testi-vid">
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video muted autoPlay loop playsInline controls preload="metadata"><source src={CASO.video} type="video/mp4" /></video>
              </div>
            </div>
          </div>
        </section>
      );
    case 'preguntas':
      return (
        <section className="d-ai-avatar-faq">
          <h2 className="d-ai-avatar-faq-h" dangerouslySetInnerHTML={html(b.titulo)} />
          <div className="d-ai-avatar-faq-l">
            {b.items.map((q) => (
              <div key={q.p} className="d-ai-avatar-faq-i">
                <h3 className="d-ai-avatar-faq-p">{q.p}</h3>
                <p className="d-ai-avatar-faq-r" dangerouslySetInnerHTML={html(q.r)} />
              </div>
            ))}
          </div>
        </section>
      );
    case 'filas':
    case 'logos':
      // AI Avatar no tiene estos bloques (HeyGen tampoco los tiene en esta página).
      return null;
  }
}

export default function DisenoAiAvatar({ landing }: PropsDiseno) {
  const hero = landing.bloques.find((b): b is Hero => b.tipo === 'hero');
  const otras = otrasFunciones(landing.slug);
  // Las columnas del pie de HeyGen, de a tres links por columna.
  const columnas: { nombre: string; href: string }[][] = [];
  for (let i = 0; i < otras.length; i += 3) columnas.push(otras.slice(i, i + 3));
  return (
    <div className="d-ai-avatar">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <header className="d-ai-avatar-barra">
        <div className="d-ai-avatar-barra-in">
          <LogoMaKo className="d-ai-avatar-logo" tamano={34} />
          <span className="d-ai-avatar-barra-sep" aria-hidden="true" />
          <span className="d-ai-avatar-barra-nombre">{landing.nombre}</span>
          <div className="d-ai-avatar-barra-der">
            <a href="/vsl" className="d-ai-avatar-btn d-ai-avatar-btn-gris">Funcionalidades</a>
            <a href={RUTA_CTA} className="d-ai-avatar-btn">{TEXTO_CTA}<Flecha /></a>
          </div>
        </div>
      </header>

      <main>
        {landing.bloques.map((b, i) => <DibujarBloque key={`${b.tipo}-${i}`} b={b} hero={hero} icono={landing.icono} n={landing.bloques.slice(0, i).filter((x) => x.tipo === b.tipo).length} />)}

        <section className="d-ai-avatar-final">
          <div className="d-ai-avatar-final-c">
            <h2 className="d-ai-avatar-final-h">¿Lo quieres andando en tu negocio?</h2>
            <p className="d-ai-avatar-final-p">{TEXTO_CIERRE}</p>
            <Boton />
            {hero?.puntos?.length ? (
              <ul className="d-ai-avatar-final-checks">
                {hero.puntos.map((p) => <li key={p}><Tilde /><span dangerouslySetInnerHTML={html(p)} /></li>)}
              </ul>
            ) : null}
          </div>
        </section>
      </main>

      <footer className="d-ai-avatar-pie">
        <div className="d-ai-avatar-pie-in">
          <Miga hero={hero} nombre={landing.nombre} oscura />
          <div className="d-ai-avatar-pie-grid">
            <div className="d-ai-avatar-pie-logo"><LogoMaKo tamano={44} claro /></div>
            <div className="d-ai-avatar-pie-cols">
              {columnas.map((col, i) => (
                <div key={i} className="d-ai-avatar-pie-col">
                  <h3 className="d-ai-avatar-pie-t">{i === 0 ? 'Funcionalidades' : ' '}</h3>
                  <ul>{col.map((f) => <li key={f.href}><a href={f.href}>{f.nombre}</a></li>)}</ul>
                </div>
              ))}
            </div>
          </div>
          <div className="d-ai-avatar-pie-base">© MaKo — Todos los derechos reservados.</div>
        </div>
      </footer>
    </div>
  );
}

const CSS = `
@font-face { font-family: 'DAvGabarito'; src: url('/vsl-assets/fuentes/gabarito/gabarito-latin-var.woff2') format('woff2'); font-weight: 400 900; font-style: normal; font-display: swap; }
@font-face { font-family: 'DAvFigtree'; src: url('/vsl-assets/fuentes/figtree/figtree-latin.woff2') format('woff2'); font-weight: 300 900; font-style: normal; font-display: swap; }

.d-ai-avatar { --d-av-tit: 'DAvGabarito', 'DAvFigtree', Arial, Helvetica, sans-serif; --d-av-txt: 'DAvFigtree', Arial, Helvetica, sans-serif;
  --d-av-azul: #2F6FED; --d-av-azul-claro: #E4EDFD; --d-av-dorado: #F2B01E; --d-av-tinta: #171717;
  background: #fff; color: #171717; font-family: var(--d-av-txt); font-size: 16px; line-height: 24px; overflow-x: clip; }
.d-ai-avatar *, .d-ai-avatar *::before, .d-ai-avatar *::after { box-sizing: border-box; }
/* El reseteo va con :where() para no pisar las clases de abajo */
.d-ai-avatar :where(a) { color: inherit; }
.d-ai-avatar :where(h1, h2, h3, p, ul, ol) { margin: 0; padding: 0; }
.d-ai-avatar :where(ul, ol) { list-style: none; }
.d-ai-avatar strong { font-weight: 700; }

/* Botones: 40 px de alto, radio 12, 18 px / 700, -0.36 px */
.d-ai-avatar-btn { display: inline-flex; align-items: center; gap: 6px; height: 40px; padding: 0 16px; border-radius: 12px; background: var(--d-av-azul); color: #fff; font-family: var(--d-av-txt); font-size: 18px; font-weight: 700; letter-spacing: -0.36px; line-height: 27px; text-decoration: none; white-space: nowrap; flex: none; transition: background-color .2s ease, transform .2s ease; }
.d-ai-avatar-btn:hover { background: #1F57C8; }
.d-ai-avatar-btn:active { transform: scale(.98); }
.d-ai-avatar-btn-negro { background: #000; color: #6E9BF5; }
.d-ai-avatar-btn-negro:hover { background: #1A1A1A; }
.d-ai-avatar-btn-gris { background: #D9D9D9; color: #000; }
.d-ai-avatar-btn-gris:hover { background: #CACACA; }

/* La barra: una caja flotante de 1272 px, radio 28, blanca al 70 % con el borde en degradado */
.d-ai-avatar-barra { position: sticky; top: 0; z-index: 30; padding: 16px 84px 0; }
.d-ai-avatar-barra-in { max-width: 1272px; margin: 0 auto; display: flex; align-items: center; gap: 16px; padding: 16px 32px; border-radius: 28px; background: rgba(255,255,255,.7); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1.5px solid transparent;
  background-image: linear-gradient(rgba(255,255,255,.92), rgba(255,255,255,.92)), linear-gradient(90deg, #2F6FED 0%, #9DB9F6 55%, #F2B01E 100%); background-origin: border-box; background-clip: padding-box, border-box; }
.d-ai-avatar-logo span:last-child { font-family: var(--d-av-tit); font-weight: 900 !important; }
.d-ai-avatar-barra-sep { width: 1px; height: 24px; background: #D9D9D9; }
.d-ai-avatar-barra-nombre { font-size: 18px; font-weight: 500; letter-spacing: -0.18px; color: #262626; }
.d-ai-avatar-barra-der { margin-left: auto; display: flex; align-items: center; gap: 8px; }

/* Miga de pan: ABC Solar 15 px; acá Gabarito */
.d-ai-avatar-miga { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 6px; font-family: var(--d-av-tit); font-size: 15px; line-height: 22.5px; font-weight: 700; color: #000; }
.d-ai-avatar-miga a { text-decoration: none; }
.d-ai-avatar-miga a:hover { text-decoration: underline; }
.d-ai-avatar-miga-act { color: var(--d-av-azul); }
.d-ai-avatar-miga-osc { color: #fff; }
.d-ai-avatar-miga-osc .d-ai-avatar-miga-act { color: #fff; }

/* Hero: dos columnas de 583 px a partir de x = 100 */
.d-ai-avatar-hero { padding: 74px 100px 100px; }
.d-ai-avatar-hero-in { max-width: 1240px; margin: 0 auto; display: grid; grid-template-columns: 583px 583px; justify-content: space-between; align-items: center; }
.d-ai-avatar-hero-txt { display: flex; flex-direction: column; align-items: flex-start; gap: 30px; }
.d-ai-avatar-h1 { font-family: var(--d-av-tit); font-size: 68px; line-height: 72px; font-weight: 900; letter-spacing: -0.04em; word-spacing: -0.03em; color: #1A1A1A; margin-top: -2px; }
.d-ai-avatar-hero-baja { display: flex; flex-direction: column; gap: 30px; }
.d-ai-avatar-hero-p { font-size: 18px; line-height: 23.4px; font-weight: 450; letter-spacing: -0.36px; color: #171717; }
.d-ai-avatar-hero-p strong { font-weight: 700; }
.d-ai-avatar-checks { display: flex; flex-direction: column; gap: 10px; }
.d-ai-avatar-checks li, .d-ai-avatar-final-checks li { display: flex; align-items: center; gap: 8px; padding: 5px 0; font-size: 16px; line-height: 24px; }
.d-ai-avatar-tilde { flex: none; color: var(--d-av-azul); }
.d-ai-avatar-video { position: relative; overflow: hidden; border-radius: 24px; background: #000; padding: 40px 24px; display: flex; align-items: center; justify-content: center; min-height: 460px; }

/* El visual de AI Avatar (sus clases viven en LandingCompetencia; acá van con el marco de HeyGen) */
.d-ai-avatar .mk-c-av { display: flex; align-items: center; justify-content: center; gap: 14px; }
.d-ai-avatar .mk-c-av-foto { flex: none; width: 128px; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 16px 10px; border-radius: 16px; background: #fff; border: 1px solid #E3EAF6; text-align: center; }
.d-ai-avatar .mk-c-av-foto-cara { width: 64px; height: 64px; border-radius: 50%; background: var(--d-av-azul-claro); color: var(--d-av-azul); display: flex; align-items: center; justify-content: center; }
.d-ai-avatar .mk-c-av-foto-t { font-size: 14px; font-weight: 600; color: #12151B; line-height: 1.3; }
.d-ai-avatar .mk-c-av-foto-d { font-size: 12px; line-height: 1.35; color: #6B7280; }
.d-ai-avatar .mk-c-av-flecha { flex: none; color: #6E9BF5; display: inline-flex; }
/* Las escenas: la principal al frente y las otras dos abiertas en abanico detrás, como tres anuncios del mismo avatar */
.d-ai-avatar .mk-c-av-escenas { display: flex; align-items: center; justify-content: center; }
.d-ai-avatar .mk-c-av-tel { position: relative; z-index: 2; flex: none; width: 216px; aspect-ratio: 9 / 16; padding: 7px; border-radius: 30px; background: #22252C; box-shadow: 0 28px 60px -30px rgba(16,19,25,.6); }
.d-ai-avatar .mk-c-av-tel-lado { z-index: 1; width: 172px; }
.d-ai-avatar .mk-c-av-escenas > .mk-c-av-tel-lado:first-child { margin-right: -46px; transform: rotate(-7deg) translateY(14px); }
.d-ai-avatar .mk-c-av-escenas > .mk-c-av-tel-lado:last-child { margin-left: -46px; transform: rotate(7deg) translateY(14px); }
.d-ai-avatar .mk-c-av-escena { position: relative; width: 100%; height: 100%; overflow: hidden; border-radius: 24px; background: linear-gradient(170deg, #3A3F4A 0%, #1D2027 100%); }
.d-ai-avatar .mk-c-av-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.d-ai-avatar .mk-c-av-escena::after { content: ''; position: absolute; inset: 0; z-index: 1; background: linear-gradient(to top, rgba(0,0,0,.62), transparent 44%); pointer-events: none; }
.d-ai-avatar .mk-c-av-tel-lado .mk-c-av-escena::after { background: linear-gradient(to top, rgba(0,0,0,.45), rgba(0,0,0,.18) 50%); }
.d-ai-avatar .mk-c-av-pill { position: absolute; top: 12px; left: 12px; z-index: 2; max-width: calc(100% - 64px); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 5px 9px; border-radius: 999px; background: rgba(16,19,25,.55); color: #fff; font-size: 10.5px; line-height: 1.3; font-weight: 600; }
.d-ai-avatar .mk-c-av-tel-lado .mk-c-av-pill { max-width: calc(100% - 50px); }
/* El de la derecha queda medio tapado por el principal: su nombre va contra su borde derecho, que es el que se ve. */
.d-ai-avatar .mk-c-av-escenas > .mk-c-av-tel-lado:last-child .mk-c-av-pill { left: auto; right: 12px; }
.d-ai-avatar .mk-c-av-dur { position: absolute; top: 17px; right: 12px; z-index: 2; font-size: 10.5px; line-height: 1.3; font-weight: 600; font-variant-numeric: tabular-nums; color: rgba(255,255,255,.85); }
/* En el hero van sólo las escenas, un poco más grandes: el marco negro de HeyGen es el video de un creador */
.d-ai-avatar-video .mk-c-av-foto, .d-ai-avatar-video .mk-c-av-flecha { display: none; }
.d-ai-avatar-video .mk-c-av-tel { width: 236px; }
.d-ai-avatar-video .mk-c-av-tel-lado { width: 184px; }
.d-ai-avatar .mk-c-av-sub { position: absolute; left: 12px; right: 12px; bottom: 16px; z-index: 2; margin: 0; text-align: center; font-size: 13px; line-height: 1.38; font-weight: 700; color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,.55); }
.d-ai-avatar .mk-c-av-sub span { animation-name: dAvPalabra; animation-iteration-count: infinite; animation-timing-function: steps(1, end); }
@keyframes dAvPalabra { 0% { color: #fff; } 6% { color: #F2B01E; } 18%, 100% { color: #fff; } }

/* La banda gris de los números: ancho completo, radio 70, padding 100 / 28 */
.d-ai-avatar-banda { background: #F2F2F2; border-radius: 70px; padding: 100px 28px; }
.d-ai-avatar-cifras { display: flex; gap: 20px; max-width: 1384px; margin: 0 auto; }
.d-ai-avatar-cifras li { flex: 1 1 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 24px; border-radius: 24px; background: #1A1A1A; color: #fff; text-align: center; min-height: 122px; }
.d-ai-avatar-cifra-v { font-family: var(--d-av-tit); font-size: 44px; line-height: 44px; font-weight: 900; letter-spacing: -0.01em; font-variant-numeric: tabular-nums; }
.d-ai-avatar-cifra-l { font-size: 18px; line-height: 22px; font-weight: 500; letter-spacing: -0.18px; }
.d-ai-avatar-banda-pie { max-width: 1384px; margin: 40px auto 0; display: flex; align-items: center; gap: 12px; font-size: 16px; line-height: 24px; color: #171717; }
.d-ai-avatar-banda-pie::after { content: ''; flex: 1; height: 1px; background: rgba(0,0,0,.12); }

/* Secciones: padding 120 / 20, encabezado con el título de 60 px y el botón abajo a la derecha */
.d-ai-avatar-sec { padding: 120px 20px; max-width: 1440px; margin: 0 auto; }
.d-ai-avatar-cabeza { display: flex; align-items: flex-end; justify-content: space-between; gap: 40px; margin-bottom: 75px; }
.d-ai-avatar-h2 { font-family: var(--d-av-tit); font-size: 60px; line-height: 63px; font-weight: 900; letter-spacing: -0.04em; word-spacing: -0.03em; color: #171717; max-width: 780px; }
.d-ai-avatar-cabeza-p { margin-top: 30px; max-width: 600px; font-size: 18px; line-height: 25.2px; letter-spacing: -0.16px; color: #171717; }

/* «Sin / Con»: dos tarjetas de 690 px con borde negro al 10 %, radio 22, padding 30 */
.d-ai-avatar-reto { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: -40px; }
.d-ai-avatar-reto-c { display: flex; flex-direction: column; gap: 40px; padding: 30px; border-radius: 22px; border: 1px solid rgba(0,0,0,.1); }
.d-ai-avatar-pil { align-self: flex-start; padding: 10px 15px; border-radius: 999px; border: 1px solid rgba(0,0,0,.1); font-size: 14px; line-height: 14px; margin-bottom: -20px; }
.d-ai-avatar-h3 { font-family: var(--d-av-tit); font-size: 40px; line-height: 40px; font-weight: 900; letter-spacing: -0.04em; word-spacing: -0.03em; color: #171717; }
.d-ai-avatar-reto-p { font-size: 16px; line-height: 22.4px; letter-spacing: -0.16px; color: #333; }

/* Filas: tarjetas crema #FDFBF9 de 1400 px, radio 80, padding 50, 75 px entre una y otra */
.d-ai-avatar-filas { display: flex; flex-direction: column; gap: 75px; }
.d-ai-avatar-fila { display: grid; grid-template-columns: 1fr 1fr; gap: 50px; padding: 50px; border-radius: 80px; background: #FDFBF9; transition: transform .3s ease; }
.d-ai-avatar-fila-inv .d-ai-avatar-panel { order: 2; }
.d-ai-avatar-panel { min-height: 406px; border-radius: 60px; display: flex; align-items: center; justify-content: center; }
.d-ai-avatar-panel-0 { background: #DCE8FD; }
.d-ai-avatar-panel-1 { background: #FBEFD3; }
.d-ai-avatar-panel-2 { background: #EDF0F5; }
.d-ai-avatar-panel-ic { width: 140px; height: 140px; border-radius: 32px; background: #fff; color: var(--d-av-azul); display: flex; align-items: center; justify-content: center; box-shadow: 0 24px 50px -24px rgba(16,19,25,.28); transition: transform .35s ease; }
.d-ai-avatar-fila:hover .d-ai-avatar-panel-ic { transform: translateY(-6px) rotate(-3deg); }
.d-ai-avatar-fila-txt { display: flex; flex-direction: column; justify-content: space-between; align-items: flex-start; gap: 30px; }
.d-ai-avatar-fila-h { font-family: var(--d-av-tit); font-size: 50px; line-height: 60px; font-weight: 900; letter-spacing: -0.04em; word-spacing: -0.03em; color: #000; }
.d-ai-avatar-fila-p { margin-top: 30px; font-size: 16px; line-height: 22.4px; letter-spacing: -0.16px; color: #171717; }

/* Pasos: tarjetas crema de 450 px, radio 80, la imagen de un lado y el texto del otro */
.d-ai-avatar-pasos { display: flex; flex-direction: column; gap: 50px; }
.d-ai-avatar-paso { display: grid; grid-template-columns: 625px 1fr; gap: 50px; min-height: 450px; border-radius: 80px; background: #FDFBF9; overflow: hidden; }
.d-ai-avatar-paso-inv { grid-template-columns: 1fr 625px; }
.d-ai-avatar-paso-inv .d-ai-avatar-paso-img { order: 2; }
.d-ai-avatar-paso-img { position: relative; display: flex; align-items: center; justify-content: center; min-height: 450px; }
.d-ai-avatar-paso-pieza { transform: rotate(-9deg); transition: transform .4s ease; }
.d-ai-avatar-paso:hover .d-ai-avatar-paso-pieza { transform: rotate(-5deg) scale(1.02); }
.d-ai-avatar-paso-img-1 .mk-c-av-flecha, .d-ai-avatar-paso-img-1 .mk-c-av-escenas { display: none; }
.d-ai-avatar-paso-img-1 .d-ai-avatar-paso-pieza { transform: rotate(-9deg) scale(1.7); }
.d-ai-avatar-paso:hover .d-ai-avatar-paso-img-1 .d-ai-avatar-paso-pieza { transform: rotate(-5deg) scale(1.74); }
/* Paso 2 («Elige tu escena»): las tres escenas en abanico, casi derechas. Paso 3: tu foto → el anuncio, sin las de los lados. */
.d-ai-avatar-paso-img-2 .mk-c-av-foto, .d-ai-avatar-paso-img-2 .mk-c-av-flecha { display: none; }
.d-ai-avatar-paso-img-2 .d-ai-avatar-paso-pieza { transform: rotate(-3deg); }
.d-ai-avatar-paso:hover .d-ai-avatar-paso-img-2 .d-ai-avatar-paso-pieza { transform: rotate(-1deg) scale(1.02); }
.d-ai-avatar-paso-img-3 .mk-c-av-tel-lado { display: none; }
.d-ai-avatar-paso-img-3 .d-ai-avatar-paso-pieza { transform: rotate(-4deg) scale(.92); }
.d-ai-avatar-paso-txt { display: flex; flex-direction: column; align-items: flex-start; justify-content: center; gap: 10px; padding: 20px 50px; }
.d-ai-avatar-paso-n { padding: 6px 12px; border-radius: 80px; background: var(--d-av-azul-claro); color: var(--d-av-azul); font-family: var(--d-av-tit); font-size: 15px; line-height: 22.5px; font-weight: 700; }
.d-ai-avatar-paso-h { font-family: var(--d-av-tit); font-size: 30px; line-height: 37.5px; font-weight: 900; letter-spacing: -0.01em; color: #171717; }
.d-ai-avatar-paso-p { font-size: 16px; line-height: 22.4px; letter-spacing: -0.16px; color: #171717; }
.d-ai-avatar-paso-p strong { font-weight: 700; }

/* Casos de uso: grilla de 3 columnas de 411 px, ícono de 36, título de 24 px */
.d-ai-avatar-usos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 75px 80px; }
.d-ai-avatar-uso { display: flex; flex-direction: column; }
.d-ai-avatar-uso-ic { width: 36px; height: 36px; color: #171717; display: flex; align-items: center; justify-content: flex-start; }
.d-ai-avatar-uso-ic svg { stroke-width: 1.6; }
.d-ai-avatar-uso-t { margin-top: 13px; font-family: var(--d-av-tit); font-size: 24px; line-height: 32px; font-weight: 700; letter-spacing: -0.01em; color: #171717; }
.d-ai-avatar-uso-p { margin-top: 13px; font-size: 16px; line-height: 22.4px; font-weight: 450; letter-spacing: -0.16px; color: #171717; }

/* Testimonio: título de 70 px y una tarjeta de 1208 px, radio 40, con el video a la derecha */
.d-ai-avatar-testi { padding: 120px 20px 100px; }
.d-ai-avatar-testi-in { max-width: 1208px; margin: 0 auto; }
.d-ai-avatar-testi-h { max-width: 842px; font-family: var(--d-av-tit); font-size: 70px; line-height: 77px; font-weight: 900; letter-spacing: -0.04em; word-spacing: -0.03em; color: #12151B; }
.d-ai-avatar-testi-sub { margin-top: 20px; max-width: 600px; font-size: 18px; line-height: 23.4px; font-weight: 500; letter-spacing: -0.45px; color: rgba(22,22,22,.7); }
.d-ai-avatar-testi-c { margin-top: 70px; display: grid; grid-template-columns: 482px 1fr; border-radius: 40px; border: 1px solid rgba(0,0,0,.2); background: #fff; overflow: hidden; }
.d-ai-avatar-testi-txt { padding: 50px; display: flex; flex-direction: column; }
.d-ai-avatar-testi-n { font-size: 24px; line-height: 30px; font-weight: 800; letter-spacing: -0.6px; color: #171717; margin-bottom: 20px; }
.d-ai-avatar-testi-q { font-size: 14px; line-height: 20px; color: #3B4252; margin-bottom: 12px; }
.d-ai-avatar-testi-q strong { color: #171717; }
.d-ai-avatar-testi-a { margin-top: 8px; padding-top: 4px; font-size: 14px; line-height: 20px; color: #3B4252; }
.d-ai-avatar-testi-vid { position: relative; background: #000; min-height: 254px; }
.d-ai-avatar-testi-vid video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }

/* Preguntas: el título a la izquierda (40 px) y las tarjetas grises #F2F2F2 de 745 px a la derecha */
.d-ai-avatar-faq { max-width: 1360px; margin: 0 auto; padding: 120px 71px; display: grid; grid-template-columns: 1fr 745px; gap: 0; }
.d-ai-avatar-faq-h { max-width: 350px; font-family: var(--d-av-tit); font-size: 40px; line-height: 40px; font-weight: 900; letter-spacing: 0.4px; color: #333; align-self: start; }
.d-ai-avatar-faq-l { display: flex; flex-direction: column; gap: 20px; }
.d-ai-avatar-faq-i { padding: 30px 30px 40px; border-radius: 20px; background: #F2F2F2; }
.d-ai-avatar-faq-p { font-size: 18px; line-height: 25.2px; font-weight: 500; letter-spacing: -0.14px; color: #000; }
.d-ai-avatar-faq-r { margin-top: 20px; font-size: 16px; line-height: 22.4px; letter-spacing: -0.14px; color: #333; }

/* La banda final: ancho completo, radio 40, el degradado de un lado; el pie negro asoma debajo de las esquinas */
.d-ai-avatar-final { background: linear-gradient(#fff calc(100% - 50px), #000 calc(100% - 50px)); }
.d-ai-avatar-final-c { border-radius: 40px; padding: 100px 130px; text-align: center; display: flex; flex-direction: column; align-items: center;
  background: linear-gradient(97deg, #6E9BF5 0%, #8FB2F7 16%, #C9D9FB 19.6%, #F4E4C6 20.4%, #FBFAF8 21.6%, #FBFAF8 100%); }
.d-ai-avatar-final-h { max-width: 550px; font-family: var(--d-av-tit); font-size: 60px; line-height: 60px; font-weight: 900; letter-spacing: -0.04em; word-spacing: -0.03em; color: #171717; }
.d-ai-avatar-final-p { max-width: 550px; padding: 20px 0 30px; font-size: 16px; line-height: 22.4px; color: #12151B; }
.d-ai-avatar-final-checks { margin-top: 20px; display: flex; flex-wrap: wrap; justify-content: center; gap: 6px 32px; }
.d-ai-avatar-final-checks li { font-size: 18px; }

/* Pie negro: la miga, el logo a la izquierda y columnas de 146 px con su título en mayúsculas */
.d-ai-avatar-pie { background: #000; color: #fff; padding: 12px 84px 62px; }
.d-ai-avatar-pie-in { max-width: 1272px; margin: 0 auto; }
.d-ai-avatar-pie-grid { margin-top: 40px; display: grid; grid-template-columns: 213px 1fr; }
.d-ai-avatar-pie-logo { padding-top: 2px; }
.d-ai-avatar-pie-logo span:last-child { font-family: var(--d-av-tit); font-weight: 900 !important; }
.d-ai-avatar-pie-cols { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px 6px; }
.d-ai-avatar-pie-t { min-height: 21px; font-size: 14px; line-height: 21px; font-weight: 700; letter-spacing: 0.35px; text-transform: uppercase; color: #fff; white-space: nowrap; }
.d-ai-avatar-pie-col ul { margin-top: 4px; display: flex; flex-direction: column; gap: 2px; }
.d-ai-avatar-pie-col a { font-size: 14px; line-height: 24px; color: rgba(255,255,255,.72); text-decoration: none; transition: color .2s ease; }
.d-ai-avatar-pie-col a:hover { color: #fff; }
.d-ai-avatar-pie-base { margin-top: 70px; padding-top: 50px; border-top: 1px solid #333; font-size: 14px; line-height: 21px; font-weight: 700; color: rgba(255,255,255,.95); }

/* Entrada: las tarjetas suben un poco al cargar (sin arrancar invisibles) */
@keyframes dAvSube { from { transform: translateY(14px); } to { transform: none; } }
.d-ai-avatar-hero-txt, .d-ai-avatar-hero-media { animation: dAvSube .7s cubic-bezier(.2,.7,.2,1) both; }
.d-ai-avatar-hero-media { animation-delay: .08s; }
@media (prefers-reduced-motion: reduce) {
  .d-ai-avatar *, .d-ai-avatar *::before, .d-ai-avatar *::after { animation: none !important; transition: none !important; }
}

/* Tablet */
@media (max-width: 1200px) {
  .d-ai-avatar-hero { padding: 49px 40px 90px; }
  .d-ai-avatar-hero-in { grid-template-columns: 1fr 1fr; gap: 48px; }
  .d-ai-avatar-barra { padding: 16px 20px 0; }
  .d-ai-avatar-paso, .d-ai-avatar-paso-inv { grid-template-columns: 1fr 1fr; }
  .d-ai-avatar-faq { grid-template-columns: 1fr 1.6fr; gap: 40px; padding: 120px 40px; }
  .d-ai-avatar-pie { padding: 12px 40px 62px; }
  .d-ai-avatar-pie-cols { grid-template-columns: repeat(3, 1fr); row-gap: 28px; }
}

/* Teléfono: una columna, con los tamaños medidos a 390 px */
@media (max-width: 860px) {
  .d-ai-avatar-barra { padding: 0; }
  .d-ai-avatar-barra-in { padding: 14px 16px; border-radius: 0; gap: 10px; border: 0; background: rgba(255,255,255,.92); }
  .d-ai-avatar-barra-sep, .d-ai-avatar-barra-nombre, .d-ai-avatar-btn-gris { display: none; }
  .d-ai-avatar-hero { padding: 40px 20px 60px; }
  .d-ai-avatar-hero-in { grid-template-columns: 1fr; gap: 48px; }
  .d-ai-avatar-h1 { font-size: 40px; line-height: 48px; }
  .d-ai-avatar-video { min-height: 0; padding: 28px 12px; }
  .d-ai-avatar-banda { border-radius: 40px; padding: 40px 20px; }
  .d-ai-avatar-cifras { flex-direction: column; gap: 16px; }
  .d-ai-avatar-banda-pie { justify-content: center; text-align: center; }
  .d-ai-avatar-banda-pie::after { display: none; }
  .d-ai-avatar-sec { padding: 100px 20px 60px; }
  .d-ai-avatar-cabeza { flex-direction: column; align-items: flex-start; gap: 30px; margin-bottom: 50px; padding: 0 15px; }
  .d-ai-avatar-h2 { font-size: 44px; line-height: 46px; }
  .d-ai-avatar-cabeza-p { font-size: 16px; line-height: 22.4px; }
  .d-ai-avatar-reto { grid-template-columns: 1fr; margin-top: 0; }
  .d-ai-avatar-reto-c { padding: 30px 20px; }
  .d-ai-avatar-h3 { font-size: 36px; line-height: 38px; }
  .d-ai-avatar-filas { gap: 40px; }
  .d-ai-avatar-fila { grid-template-columns: 1fr; gap: 40px; padding: 40px 20px 20px; border-radius: 48px; }
  .d-ai-avatar-fila .d-ai-avatar-panel, .d-ai-avatar-fila-inv .d-ai-avatar-panel { order: 2; min-height: 240px; border-radius: 44px; }
  .d-ai-avatar-panel-ic { width: 110px; height: 110px; border-radius: 26px; }
  .d-ai-avatar-fila-h { font-size: 44px; line-height: 52.8px; }
  .d-ai-avatar-pasos { gap: 40px; }
  .d-ai-avatar-paso, .d-ai-avatar-paso-inv { grid-template-columns: 1fr; gap: 0; border-radius: 48px; }
  .d-ai-avatar-paso-img, .d-ai-avatar-paso-inv .d-ai-avatar-paso-img { order: 0; min-height: 380px; }
  .d-ai-avatar-paso-txt { padding: 0 10px 30px; }
  .d-ai-avatar-paso-img-3 .d-ai-avatar-paso-pieza { transform: rotate(-4deg) scale(.78); }
  .d-ai-avatar-usos { grid-template-columns: 1fr; gap: 50px; }
  .d-ai-avatar-uso-t { font-size: 18px; line-height: 32px; }
  .d-ai-avatar-testi { padding: 60px 20px 80px; }
  .d-ai-avatar-testi-h { font-size: 35px; line-height: 38.5px; }
  .d-ai-avatar-testi-sub { font-size: 16px; line-height: 20.8px; letter-spacing: -0.4px; }
  .d-ai-avatar-testi-c { grid-template-columns: 1fr; margin-top: 40px; border-radius: 30px; }
  .d-ai-avatar-testi-txt { padding: 20px 16px 24px; }
  .d-ai-avatar-testi-vid { min-height: 0; aspect-ratio: 848 / 480; }
  .d-ai-avatar-faq { grid-template-columns: 1fr; gap: 50px; padding: 100px 20px; }
  .d-ai-avatar-faq-h { font-size: 30px; line-height: 30px; padding: 0 15px; }
  .d-ai-avatar-faq-i { padding: 30px 30px 40px; }
  .d-ai-avatar-faq-r { font-size: 14px; line-height: 19.6px; }
  .d-ai-avatar-final-c { padding: 100px 30px; border-radius: 40px; background: linear-gradient(100deg, #6E9BF5 0%, #8FB2F7 6%, #C9D9FB 9%, #FBFAF8 13%, #FBFAF8 100%); }
  .d-ai-avatar-final-h { font-size: 32px; line-height: 32px; }
  .d-ai-avatar-final-checks { flex-direction: column; align-items: flex-start; }
  .d-ai-avatar-pie { padding: 12px 20px 60px; }
  .d-ai-avatar-pie-grid { grid-template-columns: 1fr; gap: 40px; }
  .d-ai-avatar-pie-cols { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 560px) {
  /* El abanico entra en el ancho del teléfono: 116 + 150 + 116 − 2 × 42 ≈ 300 px. La duración se va para que entre el nombre. */
  .d-ai-avatar .mk-c-av-tel, .d-ai-avatar-video .mk-c-av-tel { width: 150px; padding: 5px; border-radius: 22px; }
  .d-ai-avatar .mk-c-av-tel-lado, .d-ai-avatar-video .mk-c-av-tel-lado { width: 116px; }
  .d-ai-avatar .mk-c-av-escena { border-radius: 18px; }
  .d-ai-avatar .mk-c-av-escenas > .mk-c-av-tel-lado:first-child { margin-right: -42px; transform: rotate(-7deg) translateY(10px); }
  .d-ai-avatar .mk-c-av-escenas > .mk-c-av-tel-lado:last-child { margin-left: -42px; transform: rotate(7deg) translateY(10px); }
  .d-ai-avatar .mk-c-av-pill { top: 8px; left: 8px; max-width: calc(100% - 16px); padding: 4px 7px; font-size: 9px; }
  /* A este tamaño, de los de los lados se ve un tercio: sin su nombre, y sin la duración del principal. */
  .d-ai-avatar .mk-c-av-tel-lado .mk-c-av-pill, .d-ai-avatar .mk-c-av-dur { display: none; }
  .d-ai-avatar .mk-c-av-sub { left: 8px; right: 8px; bottom: 10px; font-size: 11px; }
}
@media (max-width: 420px) {
  .d-ai-avatar-btn { font-size: 16px; padding: 0 13px; }
  .d-ai-avatar .mk-c-av { gap: 8px; }
  .d-ai-avatar .mk-c-av-foto { width: 96px; padding: 12px 6px; }
  .d-ai-avatar .mk-c-av-foto-cara { width: 48px; height: 48px; }
  .d-ai-avatar-final-checks li { font-size: 16px; }
}
`;
