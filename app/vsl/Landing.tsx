'use client';

// =============================================================================
// Landing de venta de MaKo (/vsl) — VSL arriba + funcionalidades abajo
// =============================================================================
// Página "suelta" (sin el sidebar de la app): se renderiza como una capa fija a
// pantalla completa por encima del layout raíz, sin tocar layout.tsx ni Sidebar.
// Reusa la identidad de marca (MakoBrand) y los tokens de diseño de globals.css.

import { useState } from 'react';
import { MakoLogo, MakoStar, MakoWord } from '@/app/_components/MakoBrand';
import { content, CTA_HREF, VSL } from './content';

const MONO = "'Geist Mono', monospace";

// CTA principal: dorado sobre oscuro. `to` por defecto baja al bloque de agenda.
function Cta({
  children,
  size = 'lg',
  to = '#agenda',
}: {
  children: React.ReactNode;
  size?: 'sm' | 'lg';
  to?: string;
}) {
  return (
    <a className={`vsl-cta vsl-cta-${size}`} href={to}>
      <MakoStar size={size === 'lg' ? 17 : 14} color="#171511" />
      {children}
    </a>
  );
}

function Eyebrow({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return <div className={dark ? 'vsl-eyebrow vsl-eyebrow-dark' : 'vsl-eyebrow'}>{children}</div>;
}

export default function Landing() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="vsl-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* ── Nav ───────────────────────────────────────────────────────────── */}
      <header className="vsl-nav">
        <div className="vsl-wrap vsl-nav-inner">
          <div className="vsl-brand">
            <MakoLogo size={34} animate={false} />
            <div>
              <div className="vsl-brand-name">
                <MakoWord base="#F3F0E7">MaKo</MakoWord>
              </div>
              <div className="vsl-brand-sub">Marketing OS</div>
            </div>
          </div>
          <Cta size="sm">Agendá tu demo</Cta>
        </div>
      </header>

      {/* ── Hero + VSL ────────────────────────────────────────────────────── */}
      <section className="vsl-hero">
        <div className="vsl-wrap vsl-hero-inner">
          <Eyebrow dark>{content.hero.eyebrow}</Eyebrow>
          <h1 className="vsl-h1" dangerouslySetInnerHTML={{ __html: content.hero.headlineHtml }} />
          <p className="vsl-sub">{content.hero.subhead}</p>

          {/* Reproductor del VSL: si VSL.embedUrl está vacío, muestra placeholder */}
          <div className="vsl-player">
            {VSL.embedUrl ? (
              <iframe
                className="vsl-iframe"
                src={VSL.embedUrl}
                title="MaKo VSL"
                allow="accelerated-destination; autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <>
                <div className="vsl-play" aria-hidden>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="#171511">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
                <div className="vsl-player-label">Tu VSL va acá</div>
              </>
            )}
          </div>

          <div className="vsl-hero-cta">
            <Cta size="lg">{content.hero.ctaPrimary}</Cta>
          </div>

          <div className="vsl-trust">
            {content.hero.trustBar.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── 01 · Problema ─────────────────────────────────────────────────── */}
      <section className="vsl-sec">
        <div className="vsl-wrap">
          <div className="vsl-sec-head">
            <Eyebrow>{content.problema.eyebrow}</Eyebrow>
            <h2 className="vsl-h2">{content.problema.heading}</h2>
          </div>
          <div className="vsl-prob-grid">
            {content.problema.dolores.map((d) => (
              <div key={d.title} className="vsl-prob">
                <h3>{d.title}</h3>
                <p>{d.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 02 · Qué es MaKo ──────────────────────────────────────────────── */}
      <section className="vsl-sec vsl-quees">
        <div className="vsl-wrap">
          <Eyebrow>{content.queEs.eyebrow}</Eyebrow>
          <h2 className="vsl-h2 vsl-quees-h">{content.queEs.heading}</h2>
          <p className="vsl-quees-body">{content.queEs.body}</p>
        </div>
      </section>

      {/* ── Funcionalidades ───────────────────────────────────────────────── */}
      <section className="vsl-sec">
        <div className="vsl-wrap">
          <div className="vsl-sec-head">
            <Eyebrow>Funcionalidades</Eyebrow>
            <h2 className="vsl-h2">Todo lo que MaKo hace por tu negocio.</h2>
          </div>

          {content.featureCategories.map((cat) => (
            <div key={cat.category} className="vsl-cat">
              <div className="vsl-cat-head">
                <span className="vsl-cat-eyebrow">{cat.eyebrow}</span>
                <h3 className="vsl-cat-title">{cat.category}</h3>
              </div>
              <div className="vsl-feat-grid">
                {cat.items.map((f) => (
                  <div key={f.name} className="vsl-feat">
                    <span className="vsl-feat-glyph">{f.glyph}</span>
                    <div className="vsl-feat-name">{f.name}</div>
                    <div className="vsl-feat-head">{f.benefitHeadline}</div>
                    <p className="vsl-feat-desc">{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 03 · Cómo funciona ────────────────────────────────────────────── */}
      <section className="vsl-sec vsl-como">
        <div className="vsl-wrap">
          <div className="vsl-sec-head">
            <Eyebrow>{content.como.eyebrow}</Eyebrow>
            <h2 className="vsl-h2">{content.como.heading}</h2>
          </div>
          <div className="vsl-steps">
            {content.como.pasos.map((p) => (
              <div key={p.n} className="vsl-step">
                <div className="vsl-step-n">{p.n}</div>
                <h3>{p.title}</h3>
                <p>{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 04 · Resultados ───────────────────────────────────────────────── */}
      <section className="vsl-sec">
        <div className="vsl-wrap">
          <div className="vsl-sec-head">
            <Eyebrow>{content.resultados.eyebrow}</Eyebrow>
            <h2 className="vsl-h2">{content.resultados.heading}</h2>
          </div>
          <div className="vsl-kpis">
            {content.resultados.kpis.map((k) => (
              <div key={k.label} className="vsl-kpi">
                <div className="vsl-kpi-v">{k.value}</div>
                <div className="vsl-kpi-l">{k.label}</div>
              </div>
            ))}
          </div>
          <p className="vsl-nota">{content.resultados.nota}</p>
        </div>
      </section>

      {/* ── ¿Es para vos? ─────────────────────────────────────────────────── */}
      <section className="vsl-sec vsl-paravos">
        <div className="vsl-wrap">
          <div className="vsl-sec-head vsl-center">
            <h2 className="vsl-h2">{content.esParaVos.heading}</h2>
          </div>
          <div className="vsl-two">
            <div className="vsl-col vsl-col-si">
              <div className="vsl-col-tag vsl-tag-si">Es para vos si…</div>
              {content.esParaVos.siList.map((s) => (
                <div key={s} className="vsl-li">
                  <span className="vsl-ic vsl-ic-si">✓</span>
                  <span>{s}</span>
                </div>
              ))}
            </div>
            <div className="vsl-col vsl-col-no">
              <div className="vsl-col-tag vsl-tag-no">No es para vos si…</div>
              {content.esParaVos.noList.map((s) => (
                <div key={s} className="vsl-li">
                  <span className="vsl-ic vsl-ic-no">✕</span>
                  <span>{s}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────────────── */}
      <section className="vsl-sec">
        <div className="vsl-wrap">
          <div className="vsl-sec-head vsl-center">
            <Eyebrow>Preguntas</Eyebrow>
            <h2 className="vsl-h2">Lo que solés preguntar antes de empezar.</h2>
          </div>
          <div className="vsl-faq">
            {content.faq.map((item, i) => {
              const open = openFaq === i;
              return (
                <div key={item.q} className="vsl-faq-item">
                  <button
                    type="button"
                    className="vsl-faq-q"
                    aria-expanded={open}
                    onClick={() => setOpenFaq(open ? null : i)}
                  >
                    <span>{item.q}</span>
                    <span className={open ? 'vsl-faq-ic vsl-faq-ic-open' : 'vsl-faq-ic'}>+</span>
                  </button>
                  {open && <p className="vsl-faq-a">{item.a}</p>}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── CTA final ─────────────────────────────────────────────────────── */}
      <section className="vsl-sec" id="agenda">
        <div className="vsl-wrap">
          <div className="vsl-final">
            <Eyebrow dark>Último paso</Eyebrow>
            <h2 className="vsl-final-h">{content.ctaFinal.heading}</h2>
            <p className="vsl-final-sub">{content.ctaFinal.sub}</p>
            <div className="vsl-hero-cta">
              <Cta size="lg" to={CTA_HREF}>
                {content.ctaFinal.cta}
              </Cta>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="vsl-footer">
        <div className="vsl-wrap vsl-footer-inner">
          <div className="vsl-brand">
            <MakoLogo size={30} animate={false} />
            <div className="vsl-brand-name vsl-footer-name">MaKo</div>
          </div>
          <p className="vsl-footer-tag">{content.footer.tagline}</p>
          <p className="vsl-footer-cr">{content.footer.copyright}</p>
        </div>
      </footer>
    </div>
  );
}

// =============================================================================
// Estilos (scoped con prefijo .vsl-). Inline para fidelidad y para no depender
// de utilidades; incluye media queries, hover y keyframes.
// =============================================================================
const CSS = `
.vsl-root {
  position: fixed; inset: 0; z-index: 100;
  overflow-y: auto; overflow-x: hidden;
  background: var(--bg); color: var(--ink);
  font-family: 'Geist', system-ui, sans-serif;
  scroll-behavior: smooth;
  -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
}
.vsl-root *, .vsl-root *::before, .vsl-root *::after { box-sizing: border-box; }
.vsl-wrap { width: 100%; max-width: 1080px; margin: 0 auto; padding: 0 24px; }

/* ── Nav ── */
.vsl-nav {
  position: sticky; top: 0; z-index: 40;
  background: rgba(20,18,14,.72);
  backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
  border-bottom: 1px solid rgba(255,255,255,.07);
}
.vsl-nav-inner { display: flex; align-items: center; justify-content: space-between; height: 64px; }
.vsl-brand { display: flex; align-items: center; gap: 11px; }
.vsl-brand-name { font-size: 22px; font-weight: 700; letter-spacing: -.02em; line-height: 1; color: #F3F0E7; }
.vsl-brand-sub { font-family: ${MONO}; font-size: 9.5px; letter-spacing: .14em; text-transform: uppercase; color: var(--sidebar-text); margin-top: 4px; }

/* ── CTA ── */
.vsl-cta {
  display: inline-flex; align-items: center; gap: 9px;
  border: none; cursor: pointer; text-decoration: none;
  font-family: 'Geist', system-ui, sans-serif; font-weight: 600; letter-spacing: .02em;
  background: linear-gradient(135deg, #F6D365 0%, #EF9F27 100%); color: #171511;
  box-shadow: 0 8px 24px rgba(239,159,39,.32);
  transition: transform .15s ease, box-shadow .15s ease; white-space: nowrap;
}
.vsl-cta:hover { transform: translateY(-2px); box-shadow: 0 14px 32px rgba(239,159,39,.45); }
.vsl-cta-sm { padding: 10px 16px; font-size: 13px; border-radius: 11px; }
.vsl-cta-lg { padding: 16px 30px; font-size: 16px; border-radius: 14px; }

/* ── Hero ── */
.vsl-hero { position: relative; background: #171511; color: #F3F0E7; overflow: hidden; }
.vsl-hero::before {
  content: ''; position: absolute; inset: 0; pointer-events: none;
  background:
    radial-gradient(58% 46% at 50% -4%, rgba(240,198,10,.22), transparent 70%),
    radial-gradient(38% 36% at 86% 24%, rgba(200,135,12,.14), transparent 70%),
    radial-gradient(34% 34% at 12% 70%, rgba(246,211,101,.08), transparent 70%);
}
.vsl-hero-inner { position: relative; padding: 60px 0 78px; text-align: center; }
.vsl-h1 {
  font-size: clamp(33px, 5.2vw, 60px); font-weight: 600; letter-spacing: -.025em;
  line-height: 1.05; margin: 18px auto 0; max-width: 17ch; color: #F6F3EC;
}
.vsl-h1 em { font-style: normal; color: #F0C60A; text-shadow: 0 0 34px rgba(240,198,10,.35); }
.vsl-sub { font-size: clamp(15px, 1.7vw, 19px); line-height: 1.55; color: #C5BFB1; max-width: 60ch; margin: 22px auto 0; }
.vsl-hero-cta { margin-top: 30px; display: flex; justify-content: center; }
.vsl-trust { margin-top: 30px; display: flex; flex-wrap: wrap; gap: 11px 20px; justify-content: center; }
.vsl-trust span { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: #A8A296; }
.vsl-trust span::before { content: ''; width: 5px; height: 5px; border-radius: 2px; background: var(--accent-soft); flex: none; }

/* ── Reproductor VSL ── */
.vsl-player {
  position: relative; margin: 40px auto 0; max-width: 760px; aspect-ratio: 16 / 9;
  border-radius: 18px; overflow: hidden; border: 1px solid rgba(246,211,101,.20);
  background: linear-gradient(160deg, #25221B 0%, #14120E 100%);
  box-shadow: 0 34px 90px rgba(0,0,0,.55);
  display: flex; align-items: center; justify-content: center; cursor: pointer;
}
.vsl-player::before { content: ''; position: absolute; inset: 0; background: radial-gradient(50% 60% at 50% 44%, rgba(240,198,10,.12), transparent 70%); }
.vsl-iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
.vsl-play {
  position: relative; width: 78px; height: 78px; border-radius: 999px;
  background: linear-gradient(135deg, #F6D365, #EF9F27); padding-left: 4px;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 10px 44px rgba(240,198,10,.5); animation: vslPulse 2.6s ease-in-out infinite;
}
@keyframes vslPulse { 0%,100% { box-shadow: 0 10px 44px rgba(240,198,10,.5); } 50% { box-shadow: 0 10px 60px rgba(240,198,10,.78); } }
.vsl-player-label { position: absolute; bottom: 16px; left: 0; right: 0; text-align: center; font-family: ${MONO}; font-size: 10.5px; letter-spacing: .16em; text-transform: uppercase; color: #8A8578; }

/* ── Secciones ── */
.vsl-sec { padding: 74px 0; }
.vsl-sec-head { max-width: 720px; }
.vsl-center { margin-left: auto; margin-right: auto; text-align: center; }
.vsl-eyebrow { font-family: ${MONO}; font-size: 11.5px; letter-spacing: .16em; text-transform: uppercase; color: var(--accent); }
.vsl-eyebrow-dark { color: #F0C60A; }
.vsl-h2 { font-size: clamp(26px, 3.6vw, 42px); font-weight: 600; letter-spacing: -.02em; line-height: 1.12; margin: 14px 0 0; }

/* ── Problema ── */
.vsl-prob-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-top: 38px; }
.vsl-prob { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 26px; }
.vsl-prob h3 { font-size: 18px; font-weight: 600; letter-spacing: -.01em; margin: 0 0 8px; }
.vsl-prob p { font-size: 14.5px; line-height: 1.55; color: var(--dim); margin: 0; }

/* ── Qué es ── */
.vsl-quees { background: var(--surface-2); border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
.vsl-quees-h { max-width: 22ch; }
.vsl-quees-body { font-size: clamp(16px, 1.7vw, 19px); line-height: 1.6; color: var(--dim); max-width: 62ch; margin: 22px 0 0; }

/* ── Funcionalidades ── */
.vsl-cat { margin-top: 48px; }
.vsl-cat-head { display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; padding-bottom: 4px; border-bottom: 1px solid var(--border); margin-bottom: 22px; }
.vsl-cat-title { font-size: 21px; font-weight: 600; letter-spacing: -.01em; margin: 0; }
.vsl-cat-eyebrow { font-family: ${MONO}; font-size: 10.5px; letter-spacing: .14em; text-transform: uppercase; color: var(--faint); order: 2; }
.vsl-feat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.vsl-feat { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 24px; transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease; }
.vsl-feat:hover { transform: translateY(-3px); box-shadow: 0 16px 40px rgba(23,21,17,.10); border-color: var(--border-strong); }
.vsl-feat-glyph { display: inline-flex; align-items: center; justify-content: center; width: 46px; height: 46px; border-radius: 13px; background: var(--surface-2); border: 1px solid var(--border); font-size: 23px; }
.vsl-feat-name { font-family: ${MONO}; font-size: 10.5px; letter-spacing: .12em; text-transform: uppercase; color: var(--faint); margin-top: 16px; }
.vsl-feat-head { font-size: 17px; font-weight: 600; letter-spacing: -.01em; margin: 6px 0 9px; }
.vsl-feat-desc { font-size: 13.5px; line-height: 1.56; color: var(--dim); margin: 0; }

/* ── Cómo funciona ── */
.vsl-como { background: var(--surface-2); border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
.vsl-steps { display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; margin-top: 40px; }
.vsl-step { position: relative; }
.vsl-step-n { font-family: ${MONO}; font-size: 13px; font-weight: 600; color: var(--accent); }
.vsl-step h3 { font-size: 17px; font-weight: 600; letter-spacing: -.01em; margin: 12px 0 8px; }
.vsl-step p { font-size: 13.5px; line-height: 1.55; color: var(--dim); margin: 0; }

/* ── Resultados (KPIs) ── */
.vsl-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: rgba(255,255,255,.07); border: 1px solid #2A261E; border-radius: 18px; overflow: hidden; margin-top: 40px; }
.vsl-kpi { background: #171511; padding: 30px 22px; text-align: center; }
.vsl-kpi-v { font-size: clamp(26px, 3.2vw, 38px); font-weight: 600; letter-spacing: -.02em; color: #F0C60A; }
.vsl-kpi-l { font-size: 12.5px; line-height: 1.45; color: #A8A296; margin-top: 11px; }
.vsl-nota { font-size: 13px; line-height: 1.55; color: var(--faint); margin: 18px 0 0; max-width: 64ch; }

/* ── ¿Es para vos? ── */
.vsl-paravos { background: var(--surface-2); border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
.vsl-two { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-top: 38px; }
.vsl-col { border-radius: 18px; padding: 28px; border: 1px solid var(--border); background: var(--surface); }
.vsl-col-tag { font-family: ${MONO}; font-size: 11px; letter-spacing: .12em; text-transform: uppercase; font-weight: 600; padding-bottom: 14px; }
.vsl-tag-si { color: var(--good); }
.vsl-tag-no { color: var(--faint); }
.vsl-li { display: flex; gap: 12px; align-items: flex-start; padding: 12px 0; border-top: 1px solid var(--border); font-size: 14.5px; line-height: 1.5; color: var(--ink); }
.vsl-ic { flex: none; width: 21px; height: 21px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; margin-top: 1px; }
.vsl-ic-si { background: var(--good-bg); color: var(--good); }
.vsl-ic-no { background: var(--bad-bg); color: var(--bad); }
.vsl-col-no .vsl-li { color: var(--dim); }

/* ── FAQ ── */
.vsl-faq { margin: 36px auto 0; max-width: 800px; }
.vsl-faq-item { border-bottom: 1px solid var(--border); }
.vsl-faq-q { width: 100%; text-align: left; background: none; border: none; cursor: pointer; padding: 21px 0; display: flex; align-items: center; justify-content: space-between; gap: 18px; font-family: inherit; font-size: 16.5px; font-weight: 600; letter-spacing: -.01em; color: var(--ink); }
.vsl-faq-ic { flex: none; font-size: 22px; font-weight: 400; color: var(--accent); transition: transform .2s ease; line-height: 1; }
.vsl-faq-ic-open { transform: rotate(45deg); }
.vsl-faq-a { font-size: 14.5px; line-height: 1.62; color: var(--dim); margin: 0; padding: 0 36px 22px 0; max-width: 72ch; }

/* ── CTA final ── */
.vsl-final { position: relative; overflow: hidden; background: #171511; color: #F3F0E7; border-radius: 26px; padding: clamp(44px, 6vw, 76px) 28px; text-align: center; }
.vsl-final::before { content: ''; position: absolute; inset: 0; pointer-events: none; background: radial-gradient(50% 70% at 50% 0%, rgba(240,198,10,.20), transparent 70%), radial-gradient(40% 50% at 86% 100%, rgba(200,135,12,.14), transparent 70%); }
.vsl-final > * { position: relative; }
.vsl-final-h { font-size: clamp(26px, 3.6vw, 42px); font-weight: 600; letter-spacing: -.02em; line-height: 1.12; margin: 14px auto 0; max-width: 20ch; color: #F6F3EC; }
.vsl-final-sub { font-size: clamp(15px, 1.6vw, 18px); line-height: 1.55; color: #C5BFB1; max-width: 58ch; margin: 18px auto 0; }

/* ── Footer ── */
.vsl-footer { border-top: 1px solid var(--border); padding: 44px 0 56px; }
.vsl-footer-inner { display: flex; flex-direction: column; align-items: flex-start; gap: 16px; }
.vsl-footer-name { color: var(--ink); }
.vsl-footer-tag { font-size: 13.5px; line-height: 1.55; color: var(--dim); max-width: 56ch; margin: 0; }
.vsl-footer-cr { font-family: ${MONO}; font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: var(--faint); margin: 0; }

/* ── Responsive ── */
@media (max-width: 880px) {
  .vsl-feat-grid { grid-template-columns: repeat(2, 1fr); }
  .vsl-steps { grid-template-columns: repeat(2, 1fr); row-gap: 30px; }
  .vsl-kpis { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 620px) {
  .vsl-wrap { padding: 0 18px; }
  .vsl-sec { padding: 56px 0; }
  .vsl-hero-inner { padding: 44px 0 60px; }
  .vsl-prob-grid, .vsl-feat-grid, .vsl-two { grid-template-columns: 1fr; }
  .vsl-brand-sub { display: none; }
  .vsl-cta-lg { padding: 15px 24px; font-size: 15px; }
}
`;
