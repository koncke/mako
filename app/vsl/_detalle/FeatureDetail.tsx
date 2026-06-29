// =============================================================================
// Renderizador de las páginas de detalle por funcionalidad (/vsl/<slug>).
// =============================================================================
// Server component autocontenido. Replica el truco de la landing: una capa
// position:fixed a pantalla completa que tapa y oculta el sidebar del layout
// raíz (body:has(.mk-det) aside{display:none}) — sin tocar layout.tsx ni la
// /vsl. Mismo lenguaje visual: Geist, azul #2F6FED.
//
// ESTRUCTURA inspirada en las páginas de feature de VTurb (vturb.com/es/<slug>):
//   hero (headline + CTA + demo) → "cómo funciona" en filas alternadas
//   imagen/texto → testimonios → CTA final → grid de features → footer.
// Donde faltan assets (capturas, demo, testimonios) se renderizan PLACEHOLDERS;
// se reemplazan llenando `heroImg` / `group.img` / `TESTIMONIOS` en features.ts.

import type { Metadata } from 'next';
import { FEATURES, FEATURE_ORDER, TESTIMONIOS, type Feature, type Testimonio } from './features';

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

function Chevron() {
  return (
    <svg className="mk-chev" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6l-6 6" /></svg>
  );
}

// Recuadro placeholder para capturas/demos que todavía no existen.
function Placeholder({ label, kind = 'shot' }: { label: string; kind?: 'shot' | 'demo' }) {
  return (
    <div className={`mk-ph ${kind === 'demo' ? 'mk-ph-demo' : 'mk-ph-shot'}`}>
      {kind === 'demo' ? (
        <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M10 9l5 3l-5 3z" /></svg>
      ) : (
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 8h.01" /><path d="M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3z" /><path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5" /><path d="M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3" /></svg>
      )}
      <span className="mk-ph-label">{label}</span>
      <span className="mk-ph-sub">Placeholder · reemplazá con tu {kind === 'demo' ? 'demo' : 'captura'}</span>
    </div>
  );
}

function Stars() {
  return (
    <div className="mk-stars" aria-label="5 de 5">
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><path d="M12 2l3.09 6.26l6.91 1l-5 4.87l1.18 6.88l-6.18 -3.25l-6.18 3.25l1.18 -6.88l-5 -4.87l6.91 -1z" /></svg>
      ))}
    </div>
  );
}

export default function FeatureDetail({ slug }: { slug: string }) {
  const f: Feature | undefined = FEATURES[slug];
  if (!f) return null;

  const cards: (Testimonio | null)[] = TESTIMONIOS.length > 0 ? TESTIMONIOS : [null, null, null];

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
        <a href="/vsl" className="mk-back">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6l6 6" /></svg>
          Todas las funcionalidades
        </a>

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <div className="mk-hero">
          <div className="mk-eyebrow">
            <span className="mk-eyebrow-tile"><Icon paths={f.icon} size={22} /></span>
            <span className="mk-eyebrow-txt">{f.name}</span>
          </div>
          <h1 className="mk-h1">{f.headline}</h1>
          <p className="mk-lead" dangerouslySetInnerHTML={{ __html: f.lead }} />
          {f.conecta && (
            <div className="mk-chips">
              {f.conecta.map((c) => (<span key={c} className="mk-chip">{c}</span>))}
            </div>
          )}
          <a href={CALENDLY} className="mk-btn-lg mk-hero-cta">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12z" /><path d="M16 3v4" /><path d="M8 3v4" /><path d="M4 11h16" /></svg>
            Agenda tu llamada
          </a>
        </div>

        {/* ── Demo del hero (placeholder hasta tener el asset) ─────────────── */}
        <div className="mk-hero-media">
          {f.heroImg ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="mk-shot" src={f.heroImg} alt={`Demo de ${f.name}`} />
          ) : (
            <Placeholder kind="demo" label={`Demo de ${f.name}`} />
          )}
        </div>

        {/* ── Cómo funciona: filas alternadas imagen/texto ─────────────────── */}
        <div className="mk-section-eyebrow">Cómo funciona</div>
        <h2 className="mk-section-h">Todo lo que {f.name} hace por vos</h2>

        <div className="mk-rows">
          {f.groups.map((g, i) => (
            <div key={g.title} className={`mk-row ${i % 2 === 1 ? 'mk-row-rev' : ''}`}>
              <div className="mk-row-text">
                <h3 className="mk-h2">{g.title}</h3>
                <ul className="mk-list">
                  {g.bullets.map((b, j) => (
                    <li key={j} className="mk-li"><Chevron /><span dangerouslySetInnerHTML={{ __html: b }} /></li>
                  ))}
                </ul>
              </div>
              <div className="mk-row-media">
                {g.img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="mk-shot" src={g.img} alt={g.title} />
                ) : (
                  <Placeholder kind="shot" label={g.title} />
                )}
              </div>
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

        {/* ── Testimonios ─────────────────────────────────────────────────── */}
        <div className="mk-section-eyebrow mk-mt">Lo que dicen</div>
        <h2 className="mk-section-h">Negocios que ya corren su funnel con MaKo</h2>
        <div className="mk-testi-grid">
          {cards.map((t, i) => (
            <div key={i} className="mk-testi">
              <Stars />
              <p className="mk-testi-quote">
                {t ? t.quote : 'Acá va un testimonio real de un cliente: el resultado concreto que tuvo usando esta función.'}
              </p>
              <div className="mk-testi-who">
                <span className="mk-testi-foto" aria-hidden="true">
                  {t && t.foto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="mk-shot" src={t.foto} alt="" />
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 0 1 6 -6h4a6 6 0 0 1 6 6v1" /></svg>
                  )}
                </span>
                <span>
                  <span className="mk-testi-name">{t ? t.nombre : 'Nombre del cliente'}</span>
                  <span className="mk-testi-rol">{t ? t.rol : 'Negocio · VSL Funnel'}</span>
                </span>
              </div>
              {!t && <span className="mk-ph-pill">Placeholder</span>}
            </div>
          ))}
        </div>

        {/* ── CTA band ─────────────────────────────────────────────────────── */}
        <div className="mk-cta">
          <div className="mk-cta-h">¿Lo querés andando en tu negocio?</div>
          <p className="mk-cta-p">Agenda una llamada y te mostramos MaKo con tus propios números.</p>
          <a href={CALENDLY} className="mk-btn-lg">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12z" /><path d="M16 3v4" /><path d="M8 3v4" /><path d="M4 11h16" /></svg>
            Agenda tu llamada
          </a>
        </div>

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
            <span className="mk-foot-ph">Redes · placeholder</span>
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

.mk-det-main { max-width: 960px; margin: 0 auto; padding: 40px 28px 40px; }

.mk-back { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 500; color: #5B6472; text-decoration: none; margin-bottom: 34px; }
.mk-back:hover { color: #2F6FED; }

.mk-hero { max-width: 720px; }
.mk-eyebrow { display: flex; align-items: center; gap: 11px; margin-bottom: 18px; }
.mk-eyebrow-tile { width: 44px; height: 44px; border-radius: 12px; background: #EAF1FE; display: flex; align-items: center; justify-content: center; color: #2F6FED; flex: none; }
.mk-eyebrow-txt { font-size: 14.5px; font-weight: 600; letter-spacing: .01em; color: #2F6FED; }
.mk-h1 { margin: 0 0 18px; font-size: 46px; line-height: 1.07; letter-spacing: -0.025em; font-weight: 600; color: #12151B; text-wrap: pretty; }
.mk-lead { margin: 0 0 24px; font-size: 19px; line-height: 1.6; color: #5B6472; }
.mk-lead strong { font-weight: 600; color: #12151B; }
.mk-lead em { font-style: italic; }
.mk-chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 26px; }
.mk-chip { font-size: 13px; font-weight: 500; color: #2F6FED; background: #EAF1FE; padding: 6px 13px; border-radius: 8px; }
.mk-btn-lg { display: inline-flex; align-items: center; justify-content: center; gap: 9px; padding: 16px 30px; border-radius: 12px; background: #2F6FED; color: #fff; text-decoration: none; font-size: 15px; font-weight: 600; letter-spacing: .03em; text-transform: uppercase; box-shadow: 0 12px 26px -14px rgba(47,111,237,.5); }
.mk-hero-cta { margin-top: 4px; }

.mk-hero-media { margin: 36px 0 8px; }

/* Placeholders */
.mk-ph { width: 100%; border: 2px dashed #C7D4EA; background: #F4F8FE; border-radius: 16px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: #7C8DA8; text-align: center; padding: 24px; }
.mk-ph-demo { aspect-ratio: 16 / 9; }
.mk-ph-shot { aspect-ratio: 4 / 3; }
.mk-ph-label { font-size: 15px; font-weight: 600; color: #4F627E; }
.mk-ph-sub { font-size: 12.5px; color: #9AA8BE; }
.mk-shot { width: 100%; border-radius: 16px; border: 1px solid #EAECF1; display: block; }

.mk-section-eyebrow { font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: .08em; color: #2F6FED; margin: 60px 0 10px; }
.mk-section-eyebrow.mk-mt { margin-top: 72px; }
.mk-section-h { margin: 0 0 8px; font-size: 28px; line-height: 1.2; letter-spacing: -0.02em; font-weight: 600; color: #12151B; }

.mk-rows { margin-top: 30px; display: flex; flex-direction: column; gap: 30px; }
.mk-row { display: flex; gap: 44px; align-items: center; }
.mk-row-rev { flex-direction: row-reverse; }
.mk-row-text { flex: 1 1 0; min-width: 0; }
.mk-row-media { flex: 1 1 0; min-width: 0; }
.mk-h2 { margin: 0 0 16px; font-size: 22px; line-height: 1.25; letter-spacing: -0.01em; font-weight: 600; color: #12151B; }
.mk-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 13px; }
.mk-li { display: flex; gap: 11px; align-items: flex-start; font-size: 16px; line-height: 1.55; color: #454C58; }
.mk-li strong { font-weight: 600; color: #12151B; }
.mk-chev { color: #2F6FED; flex: none; margin-top: 2px; }

.mk-quote { margin: 40px 0 0; padding: 4px 0 4px 18px; border-left: 3px solid #2F6FED; font-size: 18px; line-height: 1.55; font-style: italic; color: #3A4150; }

.mk-nota { display: flex; align-items: flex-start; gap: 9px; margin-top: 28px; background: #FFF7E8; border: 1px solid #F6E2B8; border-radius: 12px; padding: 13px 15px; font-size: 14px; line-height: 1.5; color: #8A5A06; }
.mk-nota svg { flex: none; margin-top: 1px; color: #C5860C; }

/* Testimonios */
.mk-testi-grid { margin-top: 26px; display: grid; grid-template-columns: repeat(3,1fr); gap: 16px; }
.mk-testi { position: relative; background: #fff; border: 1px solid #EAECF1; border-radius: 16px; padding: 22px 20px; display: flex; flex-direction: column; gap: 12px; }
.mk-stars { display: flex; gap: 2px; color: #F2A516; }
.mk-testi-quote { margin: 0; font-size: 15px; line-height: 1.55; color: #3A4150; }
.mk-testi-who { display: flex; align-items: center; gap: 11px; margin-top: auto; }
.mk-testi-foto { width: 40px; height: 40px; border-radius: 50%; background: #EAF1FE; color: #8AA0C4; display: flex; align-items: center; justify-content: center; overflow: hidden; flex: none; }
.mk-testi-foto .mk-shot { width: 100%; height: 100%; border-radius: 50%; border: none; object-fit: cover; }
.mk-testi-name { display: block; font-size: 14px; font-weight: 600; color: #12151B; }
.mk-testi-rol { display: block; font-size: 12.5px; color: #8893A4; }
.mk-ph-pill { position: absolute; top: 12px; right: 12px; font-size: 10.5px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: #7C8DA8; background: #F0F4FA; padding: 3px 7px; border-radius: 6px; }

.mk-cta { margin-top: 60px; background: linear-gradient(160deg,#EFF4FE,#F8FAFD); border: 1px solid #E3EAF6; border-radius: 22px; padding: 40px 32px; text-align: center; }
.mk-cta-h { font-size: 25px; font-weight: 600; letter-spacing: -0.01em; color: #12151B; }
.mk-cta-p { margin: 8px 0 22px; font-size: 16px; line-height: 1.55; color: #5B6472; }

.mk-more { margin-top: 64px; }
.mk-more-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; margin-top: 14px; }
.mk-more-card { display: flex; align-items: center; gap: 10px; padding: 13px 14px; background: #fff; border: 1px solid #EAECF1; border-radius: 12px; text-decoration: none; transition: border-color .18s ease, transform .18s ease; }
.mk-more-card:hover { border-color: #BFD3F7; transform: translateY(-2px); }
.mk-more-ic { width: 32px; height: 32px; border-radius: 9px; background: #EAF1FE; color: #2F6FED; display: flex; align-items: center; justify-content: center; flex: none; }
.mk-more-name { font-size: 13.5px; font-weight: 500; line-height: 1.25; color: #12151B; }

.mk-foot { border-top: 1px solid #EEF0F3; background: #FBFCFE; margin-top: 80px; }
.mk-foot-in { max-width: 960px; margin: 0 auto; padding: 36px 28px 44px; }
.mk-foot-tag { margin: 14px 0 18px; font-size: 14.5px; color: #5B6472; }
.mk-foot-links { display: flex; flex-wrap: wrap; gap: 18px; align-items: center; font-size: 14px; }
.mk-foot-links a { color: #2F6FED; text-decoration: none; font-weight: 500; }
.mk-foot-ph { color: #9AA8BE; font-size: 13px; }
.mk-foot-copy { margin-top: 22px; font-size: 13px; color: #99A1AE; }

@media (max-width: 820px) {
  .mk-row, .mk-row-rev { flex-direction: column; gap: 18px; align-items: stretch; }
  .mk-testi-grid { grid-template-columns: 1fr; }
  .mk-more-grid { grid-template-columns: repeat(2,1fr); }
}
@media (max-width: 768px) {
  .mk-det-main { padding: 30px 20px 30px; }
  .mk-h1 { font-size: 34px; }
  .mk-lead { font-size: 17.5px; }
  .mk-section-h { font-size: 24px; }
  .mk-cta { padding: 32px 22px; }
}
@media (max-width: 480px) {
  .mk-det-hdr-in { padding: 0 16px; }
  .mk-cupos { display: none; }
  .mk-h1 { font-size: 29px; }
  .mk-more-grid { grid-template-columns: 1fr; }
}
`;
