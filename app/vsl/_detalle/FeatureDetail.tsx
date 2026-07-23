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
          <a href="/vsl" className="mk-logo" aria-label="MaKo — volver a la landing">
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
              <div className="mk-vsl">
                <span className="mk-cor tl" /><span className="mk-cor tr" /><span className="mk-cor bl" /><span className="mk-cor br" />
                <PandaPlayer src={f.videoEmbed} title={`${f.name} — cómo funciona`} />
              </div>
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

        {/* ── Cómo funciona (título principal) ──────────────────────────────── */}
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
                    {g.cierre && <p className="mk-preg-cierre" dangerouslySetInnerHTML={{ __html: g.cierre }} />}
                  </>
                ) : (
                  <ul className="mk-cap-list">
                    {g.bullets.map((b, j) => (
                      <li key={j} className="mk-cap-li"><Check /><span dangerouslySetInnerHTML={{ __html: b }} /></li>
                    ))}
                  </ul>
                )}

                {g.verMas && (
                  <a href={g.verMas.href} className="mk-vermas">
                    {g.verMas.texto} <span className="mk-vermas-l">{g.verMas.label} →</span>
                  </a>
                )}
              </div>
              <div className="mk-row-media"><Panel spec={groupVisual(i)} /></div>
            </div>
          ))}
        </div>

        {f.quote && <blockquote className="mk-quote">{f.quote}</blockquote>}

        {f.nota && (
          <div className="mk-nota">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 9v4" /><path d="M12 16v.01" /><path d="M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0 -18z" /></svg>
            <span>{f.nota}</span>
          </div>
        )}

        {/* ── CTA band (siempre después de Cómo funciona) ───────────────────── */}
        <div className="mk-cta-end"><CtaBand /></div>

        {/* ── Caso Mauricio: idéntico en todas las features (como la landing) ── */}
        <CasoMauricio />

        {/* ── Resto de funcionalidades ─────────────────────────────────────── */}
        <nav className="mk-more" aria-label="Otras funcionalidades">
          <div className="mk-section-eyebrow">Explorá el resto</div>
          <div className="mk-more-grid">
            {FEATURE_ORDER.filter((s) => s !== slug).map((s) => {
              const o = FEATURES[s];
              return (
                <a key={s} href={`/vsl/${s}`} className="mk-more-card">
                  <span className="mk-more-ic"><Icon paths={o.icon} size={18} /></span>
                  <span className="mk-more-name">{o.name}</span>
                </a>
              );
            })}
          </div>
        </nav>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="mk-foot">
        <div className="mk-foot-in">
          <a href="/vsl" className="mk-logo">
            <span className="mk-logo-mark"><svg width="20" height="20" viewBox="-12 -12 24 24" aria-hidden="true"><path d="M0 -11 C1.5 -4.5 4.5 -1.5 11 0 C4.5 1.5 1.5 4.5 0 11 C-1.5 4.5 -4.5 1.5 -11 0 C-4.5 -1.5 -1.5 -4.5 0 -11 Z" fill="#F2B01E" /></svg></span>
            <span className="mk-logo-txt">MaKo</span>
          </a>
          <p className="mk-foot-tag">El software para vender High Ticket con VSL Funnel.</p>
          <div className="mk-foot-links">
            <a href="/vsl">Funcionalidades</a>
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
.mk-vsl { position: relative; aspect-ratio: 16 / 9; border-radius: 18px; overflow: hidden; background: #0B0D12; box-shadow: 0 30px 70px -32px rgba(23,26,33,.5); }
.mk-vsl iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; display: block; }

/* Panel que envuelve cada gráfico */
.mk-panel { border-radius: 18px; background: linear-gradient(160deg,#EFF4FE,#F8FAFD); border: 1px solid #E7ECF5; padding: 18px; }
.mk-panel-hero { box-shadow: 0 24px 60px -30px rgba(47,111,237,.35); }

.mk-btn-lg { display: inline-flex; align-items: center; justify-content: center; gap: 9px; padding: 16px 30px; border-radius: 12px; background: #2F6FED; color: #fff; text-decoration: none; font-size: 15px; font-weight: 600; letter-spacing: .03em; text-transform: uppercase; box-shadow: 0 12px 26px -14px rgba(47,111,237,.5); }

.mk-section-eyebrow { font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: .08em; color: #2F6FED; margin: 0 0 10px; }
.mk-section-h { margin: 0 0 30px; font-size: 28px; line-height: 1.2; letter-spacing: -0.02em; font-weight: 600; color: #12151B; }

/* "Cómo funciona" como título principal de la sección */
.mk-como-h { margin: 72px 0 8px; font-size: 38px; line-height: 1.12; letter-spacing: -0.025em; font-weight: 600; color: #12151B; text-align: center; }

/* Filas alternadas gráfico/texto.
   Cada bloque alterna el color de fondo a TODO EL ANCHO (la banda se sale del
   contenedor con 100vw) para que se lea dónde termina una sección y empieza la
   otra. El contenido va position:relative para quedar por encima de la banda. */
.mk-rows { display: flex; flex-direction: column; gap: 0; }
.mk-row { display: flex; gap: 44px; align-items: center; position: relative; padding: 46px 0; }
.mk-row::before { content: ''; position: absolute; top: 0; bottom: 0; left: 50%; width: 100vw; transform: translateX(-50%); }
.mk-row:nth-child(odd)::before { background: #F5F8FD; }
.mk-row > * { position: relative; }
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
.mk-preg-cierre { margin: 20px 0 0; font-size: 16px; line-height: 1.6; color: #454C58; }
.mk-preg-cierre strong { font-weight: 600; color: #12151B; }

/* Puente a otra funcionalidad — SIEMPRE una línea */
.mk-vermas { display: inline-flex; align-items: baseline; gap: 8px; margin-top: 20px; font-size: 14px; color: #5B6472; text-decoration: none; }
.mk-vermas:hover .mk-vermas-l { text-decoration: underline; }
.mk-vermas-l { font-weight: 600; color: #2F6FED; white-space: nowrap; }

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

.mk-more { margin-top: 64px; }
.mk-more-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; margin-top: 14px; }
.mk-more-card { display: flex; align-items: center; gap: 10px; padding: 13px 14px; background: #fff; border: 1px solid #EAECF1; border-radius: 12px; text-decoration: none; transition: border-color .18s ease, transform .18s ease; }
.mk-more-card:hover { border-color: #BFD3F7; transform: translateY(-2px); }
.mk-more-ic { width: 32px; height: 32px; border-radius: 9px; background: #EAF1FE; color: #2F6FED; display: flex; align-items: center; justify-content: center; flex: none; }
.mk-more-name { font-size: 13.5px; font-weight: 500; line-height: 1.25; color: #12151B; }

.mk-foot { border-top: 1px solid #EEF0F3; background: #FBFCFE; margin-top: 80px; }
.mk-foot-in { max-width: 1060px; margin: 0 auto; padding: 36px 28px 44px; }
.mk-foot-tag { margin: 14px 0 18px; font-size: 14.5px; color: #5B6472; }
.mk-foot-links { display: flex; flex-wrap: wrap; gap: 18px; align-items: center; font-size: 14px; }
.mk-foot-links a { color: #2F6FED; text-decoration: none; font-weight: 500; }
.mk-foot-copy { margin-top: 22px; font-size: 13px; color: #99A1AE; }

@media (max-width: 860px) {
  .mk-hero-row, .mk-row, .mk-row-rev { flex-direction: column; gap: 24px; align-items: stretch; }
  .mk-hero-text { order: 0; }
  .mk-hist-vidcol { max-width: 320px; margin: 0 auto; }
}
@media (max-width: 768px) {
  .mk-det-main { padding: 30px 20px 30px; }
  .mk-toprow { flex-wrap: wrap; gap: 10px; }
  .mk-h1 { font-size: 31px; }
  .mk-lead { font-size: 17px; }
  .mk-lead-punch { font-size: 19px; }
  .mk-como-h { font-size: 30px; margin-top: 52px; }
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
