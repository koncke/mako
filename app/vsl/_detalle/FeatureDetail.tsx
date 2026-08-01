// =============================================================================
// Renderizador de las páginas de detalle por funcionalidad (/vsl/<slug>).
// =============================================================================
// Server component autocontenido. Capa position:fixed a pantalla completa que
// tapa y oculta el sidebar del layout raíz (body:has(.mk-det) aside{display:none}).
// Geist, azul #2F6FED.
//
// Estructura: hero (texto + gráfico hero) → CTA en banda → capacidades en FILAS
// ALTERNADAS (gráfico + texto, el sentido se invierte fila por fila) → quote →
// nota → CTA en banda → grid del resto → footer.
// Los gráficos (hero + uno por capacidad) salen de ./feature-visuals.ts, que usa
// la biblioteca SVG de ./Visual.tsx.

import type { Metadata } from 'next';
import { FEATURES, FEATURE_ORDER, type Feature } from './features';
import { Visual, type VisualSpec } from './Visual';
import { FEATURE_VISUALS } from './feature-visuals';
import PandaPlayer from './PandaPlayer';
import CasoCarrusel from './CasoCarrusel';
import { gridHtml } from './grid-landing';

const CALENDLY = '/vsl#beta';

export function featureMetadata(slug: string): Metadata {
  const f = FEATURES[slug];
  if (!f) return {};
  return { title: f.metaTitle, description: f.metaDesc };
}

function Icon({ paths, size = 22 }: { paths: string[]; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths.map((d, i) => (<path key={i} d={d} />))}
    </svg>
  );
}

function Check() {
  return (
    <svg className="mk-check" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l9 -10" /></svg>
  );
}

function CalIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12z" /><path d="M16 3v4" /><path d="M8 3v4" /><path d="M4 11h16" /></svg>
  );
}

// Banda de CTA reutilizable (misma para el hero y el cierre).
function CtaBand() {
  return (
    <div className="mk-cta">
      <div className="mk-cta-h">¿Lo querés andando en tu negocio?</div>
      <p className="mk-cta-p">Agenda una llamada y te mostramos MaKo con tus propios números.</p>
      <a href={CALENDLY} className="mk-btn-lg"><CalIcon />Agenda tu llamada</a>
    </div>
  );
}

function Panel({ spec, hero = false }: { spec: VisualSpec | undefined; hero?: boolean }) {
  return (
    <div className={`mk-panel ${hero ? 'mk-panel-hero' : ''}`}>
      <Visual spec={spec} />
    </div>
  );
}

// Caso de éxito de Mauricio — IDÉNTICO en todas las features (copiado de la
// landing principal /vsl #historia). Es la prueba, y la prueba es la misma para
// todo el producto: no cambia por funcionalidad.
function CasoMauricio() {
  return (
    <section className="mk-hist">
      <div className="mk-hist-head">
        <h2 className="mk-hist-h">De meses por debajo de <span className="mk-nowrap">$10k USD</span> a más de <span className="mk-mark">$70k USD</span> en tres meses.</h2>
        <p className="mk-hist-sub">Sin cambiar la oferta. Sin cambiar el funnel.</p>
      </div>
      {/* Bloque 1: video + historia + resultado */}
      <div className="mk-hist-row">
        <div className="mk-hist-vidcol">
          <div className="mk-hist-vid">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video muted autoPlay loop playsInline preload="metadata"><source src="/vsl-assets/mauricio.mp4" type="video/mp4" /></video>
            <span className="mk-hist-badge"><span className="mk-hist-dot" />Mauricio, en vivo</span>
          </div>
        </div>
        <div className="mk-hist-txt">
          <p>Mauricio no era ningún novato. Más de 20 años de trayectoria, más de 30 mil seguidores y videos con <strong>millones de vistas</strong>. <em>Desde afuera, todo parecía estar bien.</em></p>
          <p>Pero vendía por impulsos: un mes bien, dos flojos, y nunca sabía por qué. Miraba Meta por un lado, Calendly por otro, y el resto lo cargaba a mano en un Excel que rehacía cada vez.</p>
          <div className="mk-hist-result">
            El resultado: de meses por debajo de los <strong>$10k</strong> a más de <strong>$70k en tres meses</strong>, de forma consistente. 14k en abril, 20k en mayo, +40k en junio. La misma oferta. El mismo funnel. <strong>Lo único que cambió fue que empezó a decidir con datos.</strong>
          </div>
        </div>
      </div>

      {/* Bloque 2: texto a la izquierda + carrusel de fotos a la derecha */}
      <div className="mk-hist-row mk-hist-row2">
        <div className="mk-hist-txt">
          <p className="mk-hist-lead">No existe ningún método estándar que hubiera resuelto el caso de Mauricio.</p>
          {[
            { t: 'Ninguna app de marketing lo habría resuelto.', d: 'No existe una pensada para un VSL Funnel: todas le mostraban datos sueltos, nunca su negocio completo ni qué hacer con ellos.' },
            { t: 'Ningún curso de anuncios lo habría sacado adelante.', d: 'Te enseñan una fórmula que funcionó en otro negocio, no la lectura de lo que estaba pasando, en vivo, dentro del suyo.' },
            { t: 'Un media buyer le habría subido el presupuesto.', d: 'Indefinidamente, creyendo que gastar más lo arregla todo — sin ver que escalaba una campaña que nunca iba a funcionar.' },
          ].map((x) => (
            <div key={x.t} className="mk-descarte">
              <span className="mk-descarte-x" aria-hidden="true">✕</span>
              <div><span className="mk-descarte-t">{x.t}</span><span className="mk-descarte-d">{x.d}</span></div>
            </div>
          ))}
          <div className="mk-hist-check">
            <span className="mk-hist-check-ic" aria-hidden="true">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5l10 -10" /></svg>
            </span>
            <span>Lo que Mauricio necesitaba era alguien que se metiera de verdad en su negocio y tomara, con datos, las decisiones correctas para su caso.</span>
          </div>
          <p className="mk-hist-cierre">No para un caso genérico. Para el suyo. <span className="mk-hist-cierre-b">Eso es lo que hago contigo.</span></p>
        </div>
        <div className="mk-hist-carrcol"><CasoCarrusel /></div>
      </div>
    </section>
  );
}

export default function FeatureDetail({ slug }: { slug: string }) {
  const f: Feature | undefined = FEATURES[slug];
  if (!f) return null;
  const vis = FEATURE_VISUALS[slug];
  const groupVisual = (i: number): VisualSpec | undefined => vis?.groups?.[i];

  return (
    <div className="mk-det">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="mk-det-hdr">
        <div className="mk-det-hdr-in">
          <a href="/" className="mk-logo" aria-label="MaKo — volver a la landing">
            <span className="mk-logo-mark">
              <svg width="20" height="20" viewBox="-12 -12 24 24" aria-hidden="true"><path d="M0 -11 C1.5 -4.5 4.5 -1.5 11 0 C4.5 1.5 1.5 4.5 0 11 C-1.5 4.5 -4.5 1.5 -11 0 C-4.5 -1.5 -1.5 -4.5 0 -11 Z" fill="#F2B01E" /></svg>
            </span>
            <span className="mk-logo-txt">MaKo</span>
          </a>
          <div className="mk-hdr-right">
            <span className="mk-cupos">Solo 5 cupos</span>
            <a href={CALENDLY} className="mk-btn-sm">Agenda tu llamada</a>
          </div>
        </div>
      </header>

      <main className="mk-det-main">
        {/* Fila de volver: link a la izquierda, nombre de la feature a la DERECHA
            (a la misma altura), para que no compita con el h1 del hero. */}
        <div className="mk-toprow">
          <a href={`/vsl#feat-${slug}`} className="mk-back">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6l6 6" /></svg>
            Todas las funcionalidades
          </a>
          <div className="mk-eyebrow mk-eyebrow-top">
            <span className="mk-eyebrow-tile"><Icon paths={f.icon} size={20} /></span>
            <span className="mk-eyebrow-txt">{f.name}</span>
          </div>
        </div>

        {/* ── Hero: texto + CTA · video (o gráfico) ─────────────────────────── */}
        {f.videoEmbed ? (
          <div className="mk-hero-row mk-hero-v">
            <div className="mk-hero-text">
              <h1 className="mk-h1">{f.headline}</h1>
              <p className="mk-lead mk-lead-punch" dangerouslySetInnerHTML={{ __html: f.lead }} />
              <a href={CALENDLY} className="mk-btn-hero"><CalIcon />Agenda tu llamada</a>
              <p className="mk-hero-nota">Diagnóstico gratuito de tu VSL Funnel</p>
            </div>
            <div className="mk-hero-media">
              {/* El recuadro (.mk-vsl), las esquinas y el flotante con su botón
                  de cerrar los arma PandaPlayer: necesita el hueco en el flujo
                  para no dar un salto cuando el video pasa a flotar. */}
              <PandaPlayer src={f.videoEmbed} title={`${f.name} — cómo funciona`} />
            </div>
          </div>
        ) : (
          <div className="mk-hero-row">
            <div className="mk-hero-text">
              <h1 className="mk-h1">{f.headline}</h1>
              <p className="mk-lead" dangerouslySetInnerHTML={{ __html: f.lead }} />
              {f.conecta && (
                <div className="mk-chips">
                  {f.conecta.map((c) => (<span key={c} className="mk-chip">{c}</span>))}
                </div>
              )}
            </div>
            <div className="mk-hero-media">
              <Panel spec={vis?.hero} hero />
            </div>
          </div>
        )}

        {!f.videoEmbed && <CtaBand />}

        {/* ── Cómo funciona: título + filas, todo sobre el fondo de la sección ── */}
        <section className="mk-como">
          <h2 className="mk-como-h">Cómo funciona</h2>
          <div className="mk-rows">
            {f.groups.map((g, i) => (
              <div key={g.title} className={`mk-row ${i % 2 === 1 ? 'mk-row-rev' : ''}`}>
                <div className="mk-row-text">
                  <div className="mk-cap-head">
                    <span className="mk-cap-num">{String(i + 1).padStart(2, '0')}</span>
                    <h3 className="mk-cap-title">{g.title}</h3>
                  </div>

                  {/* Bloque de preguntas incómodas: logo + app + pregunta */}
                  {g.preguntas ? (
                    <>
                      {g.preguntaLead && <p className="mk-preg-lead">{g.preguntaLead}</p>}
                      <ul className="mk-preg-list">
                        {g.preguntas.map((p, j) => (
                          <li key={j} className="mk-preg">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={`/vsl-assets/logos/${p.logo}`} alt="" className="mk-preg-logo" />
                            <div className="mk-preg-body">
                              <span className="mk-preg-app">{p.app}</span>
                              <span className="mk-preg-q">{p.q}</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <ul className="mk-cap-list">
                      {g.bullets.map((b, j) => (
                        <li key={j} className="mk-cap-li"><Check /><span dangerouslySetInnerHTML={{ __html: b }} /></li>
                      ))}
                    </ul>
                  )}

                  {/* Cierre destacado como card — vale para cualquier tipo de bloque */}
                  {g.cierre && (
                    <div className="mk-cierre">
                      <span className="mk-cierre-star" aria-hidden="true">
                        <svg width="18" height="18" viewBox="-12 -12 24 24"><path d="M0 -11 C1.5 -4.5 4.5 -1.5 11 0 C4.5 1.5 1.5 4.5 0 11 C-1.5 4.5 -4.5 1.5 -11 0 C-4.5 -1.5 -1.5 -4.5 0 -11 Z" fill="#F2B01E" /></svg>
                      </span>
                      <span dangerouslySetInnerHTML={{ __html: g.cierre }} />
                    </div>
                  )}

                  {/* El CTA se repite al cierre de cada bloque: es el momento en
                      que el visitante acaba de entender el valor. */}
                  <div><a href={CALENDLY} className="mk-btn-sec"><CalIcon />Agenda tu llamada</a></div>

                  {g.verMas && (
                    <div className="mk-vermas-wrap">
                      <a href={g.verMas.href} className="mk-vermas">
                        {g.verMas.texto} <span className="mk-vermas-l">{g.verMas.label} →</span>
                      </a>
                    </div>
                  )}
                </div>
                <div className="mk-row-media"><Panel spec={groupVisual(i)} /></div>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA band (siempre después de Cómo funciona) ───────────────────── */}
        <div className="mk-cta-end"><CtaBand /></div>

        {/* ── Caso Mauricio: idéntico en todas las features (como la landing) ── */}
        <CasoMauricio />

        {/* ── Explorá el resto: mismas cards que la landing principal.
            La feature ACTUAL aparece marcada "Tú estás aquí" y no es clickeable. */}
        <nav className="mk-more" aria-label="Otras funcionalidades">
          <h2 className="mk-more-h">Todo lo que tu VSL Funnel necesita, en una sola app</h2>
          {/* Las cards salen TAL CUAL de la landing principal (ver grid-landing.ts):
              mismos colores de marca y misma card oscura de MaKo, sin copia paralela. */}
          <div className="mk-more-grid" dangerouslySetInnerHTML={{ __html: gridHtml(slug) }} />
          {/* El visitante ya vio TODO el producto: el mejor momento para pedirle
              la llamada. Mismo bloque que en la landing principal. */}
          <div className="mk-more-cta"><CtaBand /></div>
        </nav>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="mk-foot">
        <div className="mk-foot-in">
          <a href="/" className="mk-logo">
            <span className="mk-logo-mark"><svg width="20" height="20" viewBox="-12 -12 24 24" aria-hidden="true"><path d="M0 -11 C1.5 -4.5 4.5 -1.5 11 0 C4.5 1.5 1.5 4.5 0 11 C-1.5 4.5 -4.5 1.5 -11 0 C-4.5 -1.5 -1.5 -4.5 0 -11 Z" fill="#F2B01E" /></svg></span>
            <span className="mk-logo-txt">MaKo</span>
          </a>
          <p className="mk-foot-tag">El software para vender High Ticket con VSL Funnel.</p>
          <div className="mk-foot-links">
            <a href="/">Funcionalidades</a>
            <a href={CALENDLY}>Agenda tu llamada</a>
          </div>
          <div className="mk-foot-copy">© MaKo — Todos los derechos reservados.</div>
        </div>
      </footer>
    </div>
  );
}

const CSS = `
body:has(.mk-det) aside { display: none !important; }

.mk-det {
  position: fixed; inset: 0; z-index: 100;
  overflow-y: auto; overflow-x: hidden;
  background: #FFFFFF; color: #171A21;
  font-family: 'Geist', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
}
.mk-det * { box-sizing: border-box; }
.mk-det ::selection { background: rgba(47,111,237,.15); }

@keyframes mkText { 0% { background-position: 130% 0 } 55%,100% { background-position: -30% 0 } }

.mk-det-hdr { position: sticky; top: 0; z-index: 40; background: rgba(255,255,255,.9); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border-bottom: 1px solid #EEF0F3; }
.mk-det-hdr-in { max-width: 1120px; margin: 0 auto; padding: 0 28px; height: 64px; display: flex; align-items: center; justify-content: space-between; }
.mk-logo { display: flex; align-items: center; gap: 8px; text-decoration: none; }
.mk-logo-mark { width: 36px; height: 36px; border-radius: 10px; background: #1A1712; display: flex; align-items: center; justify-content: center; flex: none; }
.mk-logo-txt { font-weight: 700; font-size: 26px; letter-spacing: -0.02em; background: linear-gradient(110deg,#171A21 0%,#171A21 40%,#F2A516 50%,#171A21 60%,#171A21 100%); background-size: 240% 100%; -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; animation: mkText 5s ease-in-out infinite; }
.mk-hdr-right { display: flex; align-items: center; gap: 14px; }
.mk-cupos { font-size: 13.5px; font-weight: 700; color: #DC2626; letter-spacing: .01em; }
.mk-btn-sm { display: inline-flex; align-items: center; gap: 8px; padding: 9px 18px; border-radius: 10px; background: #2F6FED; color: #fff; text-decoration: none; font-size: 14px; font-weight: 600; }

.mk-det-main { max-width: 1060px; margin: 0 auto; padding: 40px 28px 40px; }

.mk-toprow { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 30px; }
.mk-back { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 500; color: #5B6472; text-decoration: none; }
.mk-back:hover { color: #2F6FED; }
.mk-eyebrow-top { margin-bottom: 0; }
.mk-eyebrow-top .mk-eyebrow-tile { width: 34px; height: 34px; border-radius: 9px; }

/* Hero: texto + gráfico */
.mk-hero-row { display: flex; gap: 44px; align-items: center; }
.mk-hero-text { flex: 1 1 0; min-width: 0; }
.mk-hero-media { flex: 1 1 0; min-width: 0; }
.mk-eyebrow { display: flex; align-items: center; gap: 11px; margin-bottom: 18px; }
.mk-eyebrow-tile { width: 44px; height: 44px; border-radius: 12px; background: #EAF1FE; display: flex; align-items: center; justify-content: center; color: #2F6FED; flex: none; }
.mk-eyebrow-txt { font-size: 14.5px; font-weight: 600; letter-spacing: .01em; color: #2F6FED; }
.mk-h1 { margin: 0 0 18px; font-size: 40px; line-height: 1.1; letter-spacing: -0.025em; font-weight: 600; color: #12151B; text-wrap: pretty; }
.mk-lead { margin: 0 0 22px; font-size: 18px; line-height: 1.6; color: #48505E; }
.mk-lead strong { font-weight: 600; color: #12151B; }
.mk-lead em { font-style: italic; }
.mk-lead code, .mk-cap-li code { font-family: 'Geist Mono', ui-monospace, SFMono-Regular, monospace; font-size: .86em; background: #EEF2F7; color: #33405A; padding: 1px 5px; border-radius: 5px; overflow-wrap: anywhere; }
.mk-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.mk-chip { font-size: 13px; font-weight: 500; color: #2F6FED; background: #EAF1FE; padding: 6px 13px; border-radius: 8px; }

/* Hero con mini-VSL: mismo layout que la landing (texto + CTA · video).
   El video pesa más que el texto — es lo que engancha. */
.mk-hero-v { align-items: center; }
.mk-hero-v .mk-hero-text { flex: 0 1 400px; min-width: 280px; }
.mk-hero-v .mk-hero-media { flex: 1.25 1 540px; min-width: 340px; }
.mk-hero-v .mk-h1 { font-size: 44px; }
.mk-hero-v .mk-lead { margin-bottom: 30px; }
/* Subtítulo impactante: grande, el gatillo en color, sin explicar de más. */
.mk-lead-punch { font-size: 21px; line-height: 1.5; color: #48505E; }
.mk-lead-punch strong { color: #2F6FED; font-weight: 700; }
.mk-btn-hero { display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; max-width: 420px; padding: 17px 30px; border-radius: 12px; background: #2F6FED; color: #fff; text-decoration: none; font-size: 16px; font-weight: 600; letter-spacing: .03em; text-transform: uppercase; box-shadow: 0 16px 34px -14px rgba(47,111,237,.55); }
.mk-hero-nota { margin: 13px 0 0; font-size: 14px; color: #98A0AC; }
/* El "slot" guarda el hueco del video en el flujo: cuando el player pasa a
   flotar (position:fixed) la página no da un salto. */
.mk-vsl-slot { position: relative; aspect-ratio: 16 / 9; }
.mk-vsl { position: absolute; inset: 0; border-radius: 18px; overflow: hidden; background: #0B0D12; box-shadow: 0 30px 70px -32px rgba(23,26,33,.5); }
.mk-vsl iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; display: block; }

/* Picture-in-Picture propio: el video sigue al scroll en una esquina. */
.mk-vsl-pip { position: fixed; inset: auto 24px 24px auto; width: min(360px, 34vw); height: auto; aspect-ratio: 16 / 9;
  z-index: 60; border-radius: 14px; box-shadow: 0 26px 60px -18px rgba(11,13,18,.55); animation: mkPipIn .22s ease-out; }
@keyframes mkPipIn { from { opacity: 0; transform: translateY(14px) scale(.96); } to { opacity: 1; transform: none; } }
.mk-vsl-pip .mk-cor { display: none; }
.mk-vsl-x { position: absolute; top: 8px; right: 8px; z-index: 2; width: 30px; height: 30px; display: grid; place-items: center;
  border: 0; border-radius: 50%; cursor: pointer; color: #fff; background: rgba(12,15,22,.72); backdrop-filter: blur(3px);
  box-shadow: 0 2px 10px rgba(0,0,0,.35); transition: background .15s, transform .15s; }
.mk-vsl-x:hover { background: rgba(12,15,22,.92); transform: scale(1.08); }
@media (max-width: 860px) { .mk-vsl-pip { inset: auto 12px 12px auto; width: min(260px, 56vw); } }

/* Panel que envuelve cada gráfico */
.mk-panel { border-radius: 18px; background: linear-gradient(160deg,#EFF4FE,#F8FAFD); border: 1px solid #E7ECF5; padding: 18px; }
.mk-panel-hero { box-shadow: 0 24px 60px -30px rgba(47,111,237,.35); }

.mk-btn-lg { display: inline-flex; align-items: center; justify-content: center; gap: 9px; padding: 16px 30px; border-radius: 12px; background: #2F6FED; color: #fff; text-decoration: none; font-size: 15px; font-weight: 600; letter-spacing: .03em; text-transform: uppercase; box-shadow: 0 12px 26px -14px rgba(47,111,237,.5); }

.mk-section-eyebrow { font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: .08em; color: #2F6FED; margin: 0 0 10px; }
.mk-section-h { margin: 0 0 30px; font-size: 28px; line-height: 1.2; letter-spacing: -0.02em; font-weight: 600; color: #12151B; }

/* Sección "Cómo funciona": título + filas, TODO sobre un fondo propio (banda a
   todo el ancho) que la separa del hero. El título vive dentro de esta banda. */
.mk-como { position: relative; margin-top: 68px; padding: 56px 0 60px; }
.mk-como::before { content: ''; position: absolute; inset: 0; left: 50%; width: 100vw; transform: translateX(-50%); background: #F5F8FD; border-top: 1px solid #EDF1F7; border-bottom: 1px solid #EDF1F7; }
.mk-como > * { position: relative; }
.mk-como-h { margin: 0 0 36px; font-size: 38px; line-height: 1.12; letter-spacing: -0.025em; font-weight: 600; color: #12151B; text-align: center; }

/* Filas gráfico/texto, separadas por un divisor fino (el fondo lo pone .mk-como).
   align-items: stretch + la media que llena su columna → el gráfico/animación
   del costado se ADAPTA a la altura del texto, sin quedar chico con aire arriba
   y abajo. */
.mk-rows { display: flex; flex-direction: column; gap: 0; }
.mk-row { display: flex; gap: 44px; align-items: stretch; padding: 40px 0; }
.mk-row + .mk-row { border-top: 1px solid #E5EBF4; }
.mk-row-text { display: flex; flex-direction: column; justify-content: center; }
.mk-row-media { display: flex; }
.mk-row-media .mk-panel { flex: 1; display: flex; align-items: center; justify-content: center; }
.mk-row-rev { flex-direction: row-reverse; }
.mk-row-text { flex: 1 1 0; min-width: 0; }
.mk-row-media { flex: 1 1 0; min-width: 0; }
.mk-cap-head { display: flex; align-items: center; gap: 13px; margin-bottom: 16px; }
.mk-cap-num { flex: none; width: 32px; height: 32px; border-radius: 9px; background: #EAF1FE; color: #2F6FED; font-family: 'Geist Mono', ui-monospace, monospace; font-size: 13px; font-weight: 600; display: flex; align-items: center; justify-content: center; }
.mk-cap-title { margin: 0; font-size: 20px; line-height: 1.25; letter-spacing: -0.01em; font-weight: 600; color: #12151B; }
.mk-cap-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
.mk-cap-li { display: flex; gap: 11px; align-items: flex-start; font-size: 15.5px; line-height: 1.6; color: #454C58; }
.mk-cap-li strong { font-weight: 600; color: #12151B; }
.mk-cap-li em { font-style: italic; }
.mk-check { color: #2F6FED; flex: none; margin-top: 2px; }

/* Bloque de preguntas incómodas: logo + app + pregunta */
.mk-preg-lead { margin: 0 0 16px; font-size: 16px; font-weight: 600; color: #12151B; }
.mk-preg-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
.mk-preg { display: flex; align-items: center; gap: 13px; padding: 12px 14px; border-radius: 13px; background: #fff; border: 1px solid #E7ECF5; }
.mk-preg-logo { width: 30px; height: 30px; object-fit: contain; flex: none; }
.mk-preg-body { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.mk-preg-app { font-size: 12px; font-weight: 700; letter-spacing: .02em; color: #2F6FED; text-transform: uppercase; }
.mk-preg-q { font-size: 15px; line-height: 1.45; color: #2E3646; }
/* Cierre destacado como card (no párrafo): dorado suave, con la estrella MaKo */
.mk-cierre { display: flex; gap: 12px; margin-top: 14px; padding: 15px 17px; border-radius: 14px; background: linear-gradient(135deg, #FFF8EC, #FEFCF6); border: 1px solid #F2E2BC; font-size: 15.5px; line-height: 1.55; color: #4A4133; }
.mk-cierre-star { flex: none; width: 32px; height: 32px; border-radius: 9px; background: #1A1712; display: flex; align-items: center; justify-content: center; }
.mk-cierre strong { font-weight: 700; color: #12151B; }

/* Puente a otra funcionalidad. display:inline a propósito: si el texto se va a
   dos líneas, el link azul queda pegado al final de la frase, como en un párrafo
   normal — no empujado a la derecha en su propia columna. */
.mk-vermas { display: inline; font-size: 14px; line-height: 1.55; color: #5B6472; text-decoration: none; }
.mk-vermas-wrap { margin-top: 18px; }
.mk-vermas:hover .mk-vermas-l { text-decoration: underline; }
.mk-vermas-l { font-weight: 600; color: #2F6FED; white-space: nowrap; }

/* CTA al cierre de cada bloque de "Cómo funciona": el mismo botón del hero y
   SIEMPRE al ancho de la sección (no del contenido). */
.mk-btn-sec { display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; margin-top: 24px; padding: 16px 28px; border-radius: 12px; background: #2F6FED; color: #fff; text-decoration: none; font-size: 15px; font-weight: 600; letter-spacing: .03em; text-transform: uppercase; box-shadow: 0 14px 30px -14px rgba(47,111,237,.55); }

/* Esquinas del marco: blancas sobre imagen oscura (video del caso), oscuras
   sobre el mini-VSL (fondo blanco) que se las comía. */
.mk-cor { position: absolute; width: 20px; height: 20px; border: 2px solid rgba(255,255,255,.75); z-index: 2; }
.mk-vsl .mk-cor { border-color: rgba(23,26,33,.28); }
.mk-cor.tl { top: 9px; left: 9px; border-right: 0; border-bottom: 0; }
.mk-cor.tr { top: 9px; right: 9px; border-left: 0; border-bottom: 0; }
.mk-cor.bl { bottom: 9px; left: 9px; border-right: 0; border-top: 0; }
.mk-cor.br { bottom: 9px; right: 9px; border-left: 0; border-top: 0; }

/* Caso Mauricio (idéntico a la landing principal) */
.mk-hist { margin: 76px 0 0; padding: 68px 0; position: relative; }
.mk-hist::before { content: ''; position: absolute; inset: 0; left: 50%; width: 100vw; transform: translateX(-50%); background: #F5F7FA; border-top: 1px solid #EEF0F3; border-bottom: 1px solid #EEF0F3; }
.mk-hist > * { position: relative; }
.mk-hist-head { text-align: center; max-width: 860px; margin: 0 auto 48px; }
.mk-hist-h { margin: 0; font-size: 33px; line-height: 1.22; letter-spacing: -0.025em; font-weight: 600; color: #12151B; text-wrap: balance; }
.mk-nowrap { white-space: nowrap; }
.mk-mark { background: linear-gradient(transparent 55%, rgba(47,111,237,.2) 55%); }
.mk-hist-sub { margin: 15px 0 0; font-size: 18px; font-weight: 500; color: #5B6472; }
.mk-hist-row { display: flex; flex-wrap: wrap; gap: 44px; align-items: flex-start; }
.mk-hist-vidcol { flex: 1 1 300px; min-width: 260px; max-width: 380px; }
.mk-hist-vid { position: relative; aspect-ratio: 4 / 5; border-radius: 18px; overflow: hidden; background: #101319; box-shadow: 0 24px 50px -28px rgba(16,19,25,.45); }
.mk-hist-vid video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.mk-hist-badge { position: absolute; top: 13px; left: 13px; display: inline-flex; align-items: center; gap: 7px; padding: 6px 11px; border-radius: 999px; background: rgba(16,19,25,.5); backdrop-filter: blur(6px); font-family: 'Geist Mono', monospace; font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: rgba(236,239,244,.9); }
.mk-hist-dot { width: 6px; height: 6px; border-radius: 50%; background: #ED6A5E; }
.mk-hist-txt { flex: 1 1 440px; min-width: 300px; display: flex; flex-direction: column; gap: 15px; }
.mk-hist-txt p { margin: 0; font-size: 16.5px; line-height: 1.68; color: #4A515E; }
.mk-hist-txt strong { font-weight: 600; color: #12151B; }
.mk-hist-txt em { font-style: italic; }
.mk-hist-result { margin-top: 4px; padding: 20px 22px; border-radius: 14px; background: #fff; border-left: 3px solid #2F6FED; box-shadow: 0 16px 40px -26px rgba(47,111,237,.45); font-size: 16.5px; line-height: 1.6; color: #2E3646; }
.mk-hist-result strong { color: #12151B; font-weight: 600; }
/* Segundo bloque del caso: texto + descartes (por qué nada estándar servía) */
.mk-hist-row2 { margin-top: 56px; align-items: flex-start; }
.mk-hist-lead { font-size: 21px !important; line-height: 1.35 !important; font-weight: 600 !important; color: #12151B !important; }
.mk-descarte { display: flex; gap: 12px; align-items: flex-start; padding: 14px 16px; border-radius: 13px; background: #fff; border: 1px solid #E7ECF5; }
.mk-descarte-x { flex: none; width: 24px; height: 24px; border-radius: 7px; background: #FCEBEC; color: #DC2626; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; }
.mk-descarte-t { display: block; font-size: 14.5px; font-weight: 600; color: #12151B; }
.mk-descarte-d { display: block; font-size: 13.5px; line-height: 1.5; color: #5B6472; margin-top: 2px; }
.mk-hist-check { display: flex; gap: 11px; align-items: flex-start; margin-top: 6px; }
.mk-hist-check-ic { flex: none; width: 26px; height: 26px; border-radius: 50%; background: #EAF1FE; color: #2F6FED; display: flex; align-items: center; justify-content: center; margin-top: 1px; }
.mk-hist-check span:last-child { font-size: 16px; line-height: 1.56; color: #12151B; font-weight: 500; }
.mk-hist-cierre { margin: 8px 0 0 !important; font-size: 18.5px !important; line-height: 1.5 !important; font-weight: 600 !important; color: #12151B !important; }
.mk-hist-cierre-b { color: #2F6FED; }

/* Carrusel de fotos del caso (igual que la landing) */
.mk-hist-carrcol { flex: 1 1 330px; min-width: 280px; max-width: 400px; }
.mk-carr { position: relative; aspect-ratio: 3 / 4; border-radius: 18px; overflow: hidden; background: #101319; box-shadow: 0 24px 50px -28px rgba(16,19,25,.45); }
.mk-carr-track { display: flex; width: 100%; height: 100%; transition: transform .55s cubic-bezier(.4,0,.2,1); }
.mk-carr-track img { flex: 0 0 100%; width: 100%; height: 100%; object-fit: cover; object-position: center; display: block; }
.mk-carr-fade { position: absolute; left: 0; right: 0; bottom: 0; height: 96px; background: linear-gradient(transparent, rgba(16,19,25,.5)); pointer-events: none; }
.mk-carr-btn { position: absolute; top: 50%; transform: translateY(-50%); width: 38px; height: 38px; border-radius: 50%; border: none; background: rgba(255,255,255,.92); display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 6px 16px rgba(0,0,0,.25); color: #101319; }
.mk-carr-prev { left: 12px; } .mk-carr-next { right: 12px; }
.mk-carr-dots { position: absolute; left: 0; right: 0; bottom: 14px; display: flex; justify-content: center; gap: 7px; }
.mk-carr-dot { width: 7px; height: 7px; border-radius: 50%; border: none; padding: 0; cursor: pointer; background: rgba(255,255,255,.45); }
.mk-carr-dot.on { background: #fff; width: 18px; border-radius: 999px; }

.mk-quote { max-width: 820px; margin: 44px auto 0; padding: 6px 0 6px 20px; border-left: 3px solid #2F6FED; font-size: 19px; line-height: 1.5; font-style: italic; font-weight: 500; color: #2E3646; }

.mk-nota { max-width: 820px; margin: 26px auto 0; display: flex; align-items: flex-start; gap: 9px; background: #FFF7E8; border: 1px solid #F6E2B8; border-radius: 12px; padding: 13px 15px; font-size: 14px; line-height: 1.5; color: #8A5A06; }
.mk-nota svg { flex: none; margin-top: 1px; color: #C5860C; }

.mk-cta { background: linear-gradient(160deg,#EFF4FE,#F8FAFD); border: 1px solid #E3EAF6; border-radius: 22px; padding: 40px 32px; text-align: center; }
.mk-cta-h { font-size: 25px; font-weight: 600; letter-spacing: -0.01em; color: #12151B; }
.mk-cta-p { margin: 8px 0 22px; font-size: 16px; line-height: 1.55; color: #5B6472; }
.mk-hero-row + .mk-cta { margin-top: 40px; }
.mk-cta-end { margin-top: 64px; }
.mk-section-eyebrow { margin-top: 64px; }
.mk-section-eyebrow-solo { margin-bottom: 22px; }
.mk-hero-row + .mk-cta + .mk-section-eyebrow { margin-top: 64px; }

/* "Explorá el resto": CALCADO de la grilla de la landing principal
   (4 columnas · gap 16 · card 28/26 · min-height 206 · tile 46 · hook 14/1.55) */
.mk-more { margin-top: 84px; }
.mk-more-h { margin: 0 0 40px; font-size: 36px; line-height: 1.15; letter-spacing: -0.03em; font-weight: 600; color: #12151B; text-align: center; text-wrap: balance; }
.mk-more-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 16px; }
.mk-more-cta { margin-top: 26px; }
/* Las cards traen su estilo inline desde la landing; acá van el hover, la
   flecha del pie y el estado de "la actual". */
.mk-more-grid > a:hover { transform: translateY(-3px); box-shadow: 0 20px 44px -22px rgba(16,19,25,.26); }
.mk-more-grid > a { position: relative; }
.mk-more-grid > a::after { content: '→'; margin-top: auto; padding-top: 14px; align-self: flex-end; font-size: 17px; font-weight: 600; color: #2F6FED; transition: transform .22s ease; }
.mk-more-grid > a:hover::after { transform: translateX(4px); }
.mk-more-grid > a.mk-feature-mako::after { color: #fff; }   /* card oscura */

/* La actual: borde que gira alrededor de la card para que se vea dónde estás.
   El truco es un conic-gradient rotando detrás, recortado a un anillo de 2px. */
@property --mk-ang { syntax: '<angle>'; initial-value: 0deg; inherits: false; }
@keyframes mkGira { to { --mk-ang: 360deg; } }
@keyframes mkGiraFallback { to { transform: rotate(360deg); } }
/* SIN isolation ni transform acá: crearían un contexto de apilado y el z-index:-1
   del anillo dejaría de irse detrás del fondo blanco de la card (se pinta encima
   y tapa el texto). */
.mk-more-grid > div[aria-current] { cursor: default; }
.mk-more-grid > div[aria-current]::before {
  content: ''; position: absolute; inset: -2px; border-radius: 14px; z-index: -1;
  background: conic-gradient(from var(--mk-ang), transparent 0deg, transparent 250deg, #7FA9F7 300deg, #2F6FED 340deg, #2F6FED 360deg);
  animation: mkGira 2.8s linear infinite;
}
/* Navegadores sin @property: el gradiente no puede animarse, así que gira el
   elemento entero (mismo efecto, sin quedarse en un borde estático). */
@supports not (background: conic-gradient(from var(--mk-ang), red, blue)) {
  .mk-more-grid > div[aria-current]::before {
    inset: -40%; border-radius: 0;
    background: conic-gradient(transparent 0deg, transparent 250deg, #7FA9F7 300deg, #2F6FED 360deg);
    animation: mkGiraFallback 2.8s linear infinite;
  }
  .mk-more-grid > div[aria-current] { overflow: hidden; border-radius: 12px; }
  .mk-more-grid > div[aria-current]::after { content: ''; position: absolute; inset: 2px; border-radius: 10px; background: #fff; z-index: -1; }
}

.mk-foot { border-top: 1px solid #EEF0F3; background: #FBFCFE; margin-top: 80px; }
.mk-foot-in { max-width: 1060px; margin: 0 auto; padding: 36px 28px 44px; }
.mk-foot-tag { margin: 14px 0 18px; font-size: 14.5px; color: #5B6472; }
.mk-foot-links { display: flex; flex-wrap: wrap; gap: 18px; align-items: center; font-size: 14px; }
.mk-foot-links a { color: #2F6FED; text-decoration: none; font-weight: 500; }
.mk-foot-copy { margin-top: 22px; font-size: 13px; color: #99A1AE; }

@media (max-width: 860px) {
  .mk-hero-row, .mk-row, .mk-row-rev, .mk-hist-row, .mk-hist-row2 { flex-direction: column; gap: 24px; align-items: stretch; }
  .mk-hero-text { order: 0; }
  .mk-hist-vidcol { max-width: 320px; margin: 0 auto; }
}
@media (max-width: 768px) {
  .mk-det-main { padding: 30px 20px 30px; }
  .mk-toprow { flex-wrap: wrap; gap: 10px; }
  .mk-h1 { font-size: 31px; }
  .mk-lead { font-size: 17px; }
  .mk-lead-punch { font-size: 19px; }
  .mk-como-h { font-size: 30px; }
  .mk-more-h { font-size: 25px; }
  .mk-hist-h { font-size: 27px; }
  .mk-section-h { font-size: 24px; }
  .mk-cta { padding: 32px 22px; }
  .mk-more-grid { grid-template-columns: repeat(2,1fr); }
}
@media (max-width: 480px) {
  .mk-det-hdr-in { padding: 0 16px; }
  .mk-cupos { display: none; }
  .mk-h1 { font-size: 28px; }
  .mk-more-grid { grid-template-columns: 1fr; }
}
`;
