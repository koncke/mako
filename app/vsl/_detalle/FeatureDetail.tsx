// =============================================================================
// Renderizador de las páginas de detalle por funcionalidad (/vsl/<slug>).
// =============================================================================
// Server component autocontenido. Replica el truco de la landing: una capa
// position:fixed a pantalla completa que tapa y oculta el sidebar del layout
// raíz (body:has(.mk-det) aside{display:none}) — sin tocar layout.tsx ni la
// /vsl. Mismo lenguaje visual: Geist, azul #2F6FED, headline punchy + bullets.

import type { Metadata } from 'next';
import { FEATURES, FEATURE_ORDER, type Feature } from './features';

const CALENDLY = '/vsl#beta';

export function featureMetadata(slug: string): Metadata {
  const f = FEATURES[slug];
  if (!f) return {};
  return { title: f.metaTitle, description: f.metaDesc };
}

function Icon({ paths, size = 22 }: { paths: string[]; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

function Chevron() {
  return (
    <svg
      className="mk-chev"
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 6l6 6l-6 6" />
    </svg>
  );
}

export default function FeatureDetail({ slug }: { slug: string }) {
  const f: Feature | undefined = FEATURES[slug];
  if (!f) return null;

  return (
    <div className="mk-det">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="mk-det-hdr">
        <div className="mk-det-hdr-in">
          <a href="/vsl" className="mk-logo" aria-label="MaKo — volver a la landing">
            <span className="mk-logo-mark">
              <svg width="20" height="20" viewBox="-12 -12 24 24" aria-hidden="true">
                <path
                  d="M0 -11 C1.5 -4.5 4.5 -1.5 11 0 C4.5 1.5 1.5 4.5 0 11 C-1.5 4.5 -4.5 1.5 -11 0 C-4.5 -1.5 -1.5 -4.5 0 -11 Z"
                  fill="#F2B01E"
                />
              </svg>
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
        <div className="mk-eyebrow">
          <span className="mk-eyebrow-tile"><Icon paths={f.icon} size={22} /></span>
          <span className="mk-eyebrow-txt">{f.name}</span>
        </div>
        <h1 className="mk-h1">{f.headline}</h1>
        <p className="mk-lead" dangerouslySetInnerHTML={{ __html: f.lead }} />

        {f.conecta && (
          <div className="mk-chips">
            {f.conecta.map((c) => (
              <span key={c} className="mk-chip">{c}</span>
            ))}
          </div>
        )}

        {/* ── Grupos de capacidades ────────────────────────────────────── */}
        <div className="mk-groups">
          {f.groups.map((g) => (
            <section key={g.title} className="mk-group">
              <h2 className="mk-h2">{g.title}</h2>
              <ul className="mk-list">
                {g.bullets.map((b, i) => (
                  <li key={i} className="mk-li">
                    <Chevron />
                    <span dangerouslySetInnerHTML={{ __html: b }} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        {f.quote && <blockquote className="mk-quote">{f.quote}</blockquote>}

        {f.nota && (
          <div className="mk-nota">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 9v4" /><path d="M12 16v.01" /><path d="M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0 -18z" /></svg>
            <span>{f.nota}</span>
          </div>
        )}

        {/* ── CTA band ─────────────────────────────────────────────────── */}
        <div className="mk-cta">
          <div className="mk-cta-h">¿Lo querés andando en tu negocio?</div>
          <p className="mk-cta-p">Agenda una llamada y te mostramos MaKo con tus propios números.</p>
          <a href={CALENDLY} className="mk-btn-lg">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12z" /><path d="M16 3v4" /><path d="M8 3v4" /><path d="M4 11h16" /></svg>
            Agenda tu llamada
          </a>
        </div>

        {/* ── Resto de funcionalidades ─────────────────────────────────── */}
        <nav className="mk-more" aria-label="Otras funcionalidades">
          <div className="mk-more-h">Explorá el resto</div>
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

.mk-det-hdr {
  position: sticky; top: 0; z-index: 40;
  background: rgba(255,255,255,.9);
  backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
  border-bottom: 1px solid #EEF0F3;
}
.mk-det-hdr-in {
  max-width: 1120px; margin: 0 auto; padding: 0 28px; height: 64px;
  display: flex; align-items: center; justify-content: space-between;
}
.mk-logo { display: flex; align-items: center; gap: 8px; text-decoration: none; }
.mk-logo-mark {
  width: 36px; height: 36px; border-radius: 10px; background: #1A1712;
  display: flex; align-items: center; justify-content: center; flex: none;
}
.mk-logo-txt {
  font-weight: 700; font-size: 26px; letter-spacing: -0.02em;
  background: linear-gradient(110deg,#171A21 0%,#171A21 40%,#F2A516 50%,#171A21 60%,#171A21 100%);
  background-size: 240% 100%; -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent; animation: mkText 5s ease-in-out infinite;
}
.mk-hdr-right { display: flex; align-items: center; gap: 14px; }
.mk-cupos { font-size: 13.5px; font-weight: 700; color: #DC2626; letter-spacing: .01em; }
.mk-btn-sm {
  display: inline-flex; align-items: center; gap: 8px; padding: 9px 18px;
  border-radius: 10px; background: #2F6FED; color: #fff; text-decoration: none;
  font-size: 14px; font-weight: 600;
}

.mk-det-main { max-width: 760px; margin: 0 auto; padding: 40px 28px 96px; }

.mk-back {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 14px; font-weight: 500; color: #5B6472; text-decoration: none;
  margin-bottom: 30px;
}
.mk-back:hover { color: #2F6FED; }

.mk-eyebrow { display: flex; align-items: center; gap: 11px; margin-bottom: 18px; }
.mk-eyebrow-tile {
  width: 44px; height: 44px; border-radius: 12px; background: #EAF1FE;
  display: flex; align-items: center; justify-content: center; color: #2F6FED; flex: none;
}
.mk-eyebrow-txt { font-size: 14.5px; font-weight: 600; letter-spacing: .01em; color: #2F6FED; }

.mk-h1 {
  margin: 0 0 18px; font-size: 42px; line-height: 1.1; letter-spacing: -0.025em;
  font-weight: 600; color: #12151B; text-wrap: pretty;
}
.mk-lead { margin: 0 0 26px; font-size: 19px; line-height: 1.6; color: #5B6472; max-width: 660px; }
.mk-lead strong { font-weight: 600; color: #12151B; }
.mk-lead em { font-style: italic; }

.mk-chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 8px; }
.mk-chip {
  font-size: 13px; font-weight: 500; color: #2F6FED; background: #EAF1FE;
  padding: 6px 13px; border-radius: 8px;
}

.mk-groups { margin-top: 18px; display: flex; flex-direction: column; gap: 34px; }
.mk-group { border-top: 1px solid #EEF0F3; padding-top: 26px; }
.mk-h2 {
  margin: 0 0 16px; font-size: 20px; line-height: 1.3; letter-spacing: -0.01em;
  font-weight: 600; color: #12151B;
}
.mk-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 13px; }
.mk-li { display: flex; gap: 11px; align-items: flex-start; font-size: 16px; line-height: 1.55; color: #454C58; }
.mk-li strong { font-weight: 600; color: #12151B; }
.mk-chev { color: #2F6FED; flex: none; margin-top: 2px; }

.mk-quote {
  margin: 34px 0 0; padding: 4px 0 4px 18px; border-left: 3px solid #2F6FED;
  font-size: 17px; line-height: 1.55; font-style: italic; color: #3A4150;
}

.mk-nota {
  display: flex; align-items: flex-start; gap: 9px; margin-top: 28px;
  background: #FFF7E8; border: 1px solid #F6E2B8; border-radius: 12px;
  padding: 13px 15px; font-size: 14px; line-height: 1.5; color: #8A5A06;
}
.mk-nota svg { flex: none; margin-top: 1px; color: #C5860C; }

.mk-cta {
  margin-top: 48px; background: linear-gradient(160deg,#EFF4FE,#F8FAFD);
  border: 1px solid #E3EAF6; border-radius: 22px; padding: 36px 32px; text-align: center;
}
.mk-cta-h { font-size: 23px; font-weight: 600; letter-spacing: -0.01em; color: #12151B; }
.mk-cta-p { margin: 8px 0 22px; font-size: 16px; line-height: 1.55; color: #5B6472; }
.mk-btn-lg {
  display: inline-flex; align-items: center; justify-content: center; gap: 9px;
  padding: 16px 30px; border-radius: 12px; background: #2F6FED; color: #fff;
  text-decoration: none; font-size: 15px; font-weight: 600; letter-spacing: .03em;
  text-transform: uppercase; box-shadow: 0 12px 26px -14px rgba(47,111,237,.5);
}

.mk-more { margin-top: 56px; border-top: 1px solid #EEF0F3; padding-top: 30px; }
.mk-more-h { font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; color: #99A1AE; margin-bottom: 16px; }
.mk-more-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; }
.mk-more-card {
  display: flex; align-items: center; gap: 10px; padding: 13px 14px;
  background: #fff; border: 1px solid #EAECF1; border-radius: 12px;
  text-decoration: none; transition: border-color .18s ease, transform .18s ease;
}
.mk-more-card:hover { border-color: #BFD3F7; transform: translateY(-2px); }
.mk-more-ic {
  width: 32px; height: 32px; border-radius: 9px; background: #EAF1FE; color: #2F6FED;
  display: flex; align-items: center; justify-content: center; flex: none;
}
.mk-more-name { font-size: 13.5px; font-weight: 500; line-height: 1.25; color: #12151B; }

@media (max-width: 768px) {
  .mk-det-main { padding: 30px 20px 72px; }
  .mk-h1 { font-size: 33px; }
  .mk-lead { font-size: 17.5px; }
  .mk-more-grid { grid-template-columns: repeat(2,1fr); }
  .mk-cta { padding: 30px 22px; }
}
@media (max-width: 480px) {
  .mk-det-hdr-in { padding: 0 16px; }
  .mk-cupos { display: none; }
  .mk-h1 { font-size: 28px; }
  .mk-more-grid { grid-template-columns: 1fr; }
}
`;
