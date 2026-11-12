// =============================================================================
// El armador de las landings de funcionalidad que copian la ESTRUCTURA de un competidor (/vsl/<slug>)
// =============================================================================
// Recibe una landing de ./tipos.ts y dibuja sus bloques EN EL ORDEN en que vienen, que es el orden de la referencia
// (la página ganadora de docs/competencia/landings-por-funcion.md). La cara es la de las 24 landings de /vsl: la misma
// cabecera, el mismo pie, la misma banda de la llamada, el caso de Mauricio y la grilla del resto de las funciones, que
// salen de app/vsl/_detalle/FeatureDetail.tsx (una cosa, un lugar). Lo nuevo de acá son las formas de sección que las 24
// no tenían (cifras, «sin / con», tarjetas, pasos y preguntas), con el mismo azul, la misma letra y la misma estrella.
//
// Server component, sin JavaScript propio: las preguntas son <details> y la animación del visual es CSS.
// =============================================================================

import type { Metadata } from 'next';
import { CSS_DETALLE, Cabecera, CasoMauricio, Check, CtaBand, Icon, Pie } from '../_detalle/FeatureDetail';
import { gridHtml } from '../_detalle/grid-landing';
import { FEATURE_VISUALS } from '../_detalle/feature-visuals';
import { Visual } from '../_detalle/Visual';
import type { Bloque, LandingCompetencia as Landing } from './tipos';
import { VisualDeLanding } from './Visuales';
import { DISENOS } from './disenos';
import { RUTA_CTA, TEXTO_CTA } from './marca';
import { BARRA_PROPIA, LANDINGS_OSCURAS } from './TemaSitio';
import { BarraGlobal } from '../_sitio/Barra';

export function metadataDeLanding(l: Landing): Metadata {
  return {
    title: l.metaTitle,
    description: l.metaDesc,
    alternates: { canonical: `/vsl/${l.slug}` },
    openGraph: { type: 'website', siteName: 'MaKo', url: `/vsl/${l.slug}`, title: l.metaTitle, description: l.metaDesc, images: [{ url: '/og-landing.jpg', width: 1200, height: 630, alt: l.metaTitle }] },
  };
}

const html = (s: string) => ({ __html: s });

function BotonCta({ clase = 'mk-btn-hero' }: { clase?: string }) {
  return <a href={RUTA_CTA} className={clase}>{TEXTO_CTA}</a>;
}

function Encabezado({ etiqueta, titulo, bajada }: { etiqueta?: string; titulo: string; bajada?: string }) {
  return (
    <div className="mk-c-enc">
      {etiqueta ? <p className="mk-section-eyebrow mk-c-etq">{etiqueta}</p> : null}
      <h2 className="mk-c-h2" dangerouslySetInnerHTML={html(titulo)} />
      {bajada ? <p className="mk-c-bajada" dangerouslySetInnerHTML={html(bajada)} /> : null}
    </div>
  );
}

function DibujarBloque({ b, icono }: { b: Bloque; icono: string[] }) {
  switch (b.tipo) {
    case 'hero':
      return (
        <div className="mk-hero-row mk-c-hero">
          <div className="mk-hero-text">
            <p className="mk-c-hero-etq">{b.etiqueta}</p>
            <h1 className="mk-h1" dangerouslySetInnerHTML={html(b.titulo)} />
            <p className="mk-lead" dangerouslySetInnerHTML={html(b.bajada)} />
            {b.puntos?.length ? (
              <ul className="mk-c-puntos">
                {b.puntos.map((p) => <li key={p}><Check /><span dangerouslySetInnerHTML={html(p)} /></li>)}
              </ul>
            ) : null}
            <BotonCta />
          </div>
          <div className="mk-hero-media"><div className="mk-panel mk-panel-hero mk-c-panel-hero"><VisualDeLanding visual={b.visual} /></div></div>
        </div>
      );
    case 'cifras':
      return (
        <section className="mk-c-cifras" aria-label={b.titulo ?? 'En números'}>
          {b.titulo ? <p className="mk-c-cifras-t">{b.titulo}</p> : null}
          <div className="mk-c-cifras-fila">
            {b.items.map((c) => (
              <div key={c.label} className="mk-c-cifra"><span className="mk-c-cifra-v">{c.valor}</span><span className="mk-c-cifra-l">{c.label}</span></div>
            ))}
          </div>
        </section>
      );
    case 'contraste':
      return (
        <section className="mk-c-sec mk-c-fondo">
          <Encabezado etiqueta={b.etiqueta} titulo={b.titulo} />
          <div className="mk-c-contraste">
            <div className="mk-c-lado mk-c-sin">
              <span className="mk-c-lado-r"><span className="mk-c-lado-ic mk-c-lado-ic-sin" aria-hidden="true">✕</span>Sin MaKo</span>
              <h3 className="mk-c-lado-t" dangerouslySetInnerHTML={html(b.sin.titulo)} />
              <p className="mk-c-lado-x" dangerouslySetInnerHTML={html(b.sin.texto)} />
            </div>
            <div className="mk-c-lado mk-c-con">
              <span className="mk-c-lado-r">
                <span className="mk-c-lado-ic mk-c-lado-ic-con" aria-hidden="true"><svg width="14" height="14" viewBox="-12 -12 24 24"><path d="M0 -11 C1.5 -4.5 4.5 -1.5 11 0 C4.5 1.5 1.5 4.5 0 11 C-1.5 4.5 -4.5 1.5 -11 0 C-4.5 -1.5 -1.5 -4.5 0 -11 Z" fill="#F2B01E" /></svg></span>
                Con MaKo
              </span>
              <h3 className="mk-c-lado-t" dangerouslySetInnerHTML={html(b.con.titulo)} />
              <p className="mk-c-lado-x" dangerouslySetInnerHTML={html(b.con.texto)} />
            </div>
          </div>
          {b.cta ? <div className="mk-c-cta-fila"><BotonCta clase="mk-btn-lg" /></div> : null}
        </section>
      );
    case 'tarjetas':
      return (
        <section className={`mk-c-sec${b.fondo ? ' mk-c-fondo' : ''}`}>
          <Encabezado etiqueta={b.etiqueta} titulo={b.titulo} bajada={b.bajada} />
          <div className={`mk-c-grilla mk-c-grilla-${b.columnas ?? 3}${(b.columnas ?? 3) === 3 && b.items.length % 3 ? ` mk-c-resto-${b.items.length % 3}` : ''}`}>
            {b.items.map((t) => (
              <div key={t.titulo} className="mk-c-tarjeta">
                <span className="mk-c-tarjeta-ic"><Icon paths={t.icono ?? icono} size={20} /></span>
                <h3 className="mk-c-tarjeta-t" dangerouslySetInnerHTML={html(t.titulo)} />
                <p className="mk-c-tarjeta-x" dangerouslySetInnerHTML={html(t.texto)} />
                {t.meta ? <span className="mk-c-tarjeta-m">{t.meta}</span> : null}
              </div>
            ))}
          </div>
          {b.cta ? <div className="mk-c-cta-fila"><BotonCta clase="mk-btn-lg" /></div> : null}
        </section>
      );
    case 'pasos':
      return (
        <section className={`mk-c-sec${b.fondo ? ' mk-c-fondo' : ''}`}>
          <Encabezado etiqueta={b.etiqueta} titulo={b.titulo} bajada={b.bajada} />
          <ol className="mk-c-pasos">
            {b.pasos.map((p, i) => (
              <li key={p.titulo} className="mk-c-paso">
                <span className="mk-c-paso-n">Paso {i + 1}</span>
                <h3 className="mk-c-paso-t" dangerouslySetInnerHTML={html(p.titulo)} />
                <p className="mk-c-paso-x" dangerouslySetInnerHTML={html(p.texto)} />
              </li>
            ))}
          </ol>
        </section>
      );
    case 'caso':
      return <CasoMauricio />;
    case 'preguntas':
      return (
        <section className="mk-c-sec">
          <Encabezado titulo={b.titulo} />
          <div className="mk-c-faq">
            {b.items.map((q) => (
              <details key={q.p} className="mk-c-faq-i">
                <summary><span className="mk-c-faq-p">{q.p}</span><span className="mk-c-faq-mas" aria-hidden="true" /></summary>
                <p className="mk-c-faq-r" dangerouslySetInnerHTML={html(q.r)} />
              </details>
            ))}
          </div>
        </section>
      );
    case 'filas':
      return (
        <section className={`mk-c-sec${b.fondo ? ' mk-c-fondo' : ''}`}>
          <Encabezado etiqueta={b.etiqueta} titulo={b.titulo} bajada={b.bajada} />
          <div className="mk-rows">
            {b.items.map((f, i) => (
              <div key={f.titulo} className={`mk-row ${i % 2 === 1 ? 'mk-row-rev' : ''}`}>
                <div className="mk-row-text">
                  <div className="mk-cap-head">
                    <span className="mk-cap-num">{String(i + 1).padStart(2, '0')}</span>
                    <h3 className="mk-cap-title" dangerouslySetInnerHTML={html(f.titulo)} />
                  </div>
                  <p className="mk-c-fila-x" dangerouslySetInnerHTML={html(f.texto)} />
                  {f.puntos?.length ? (
                    <ul className="mk-cap-list">
                      {f.puntos.map((p) => <li key={p} className="mk-cap-li"><Check /><span dangerouslySetInnerHTML={html(p)} /></li>)}
                    </ul>
                  ) : null}
                </div>
                <div className="mk-row-media"><div className="mk-panel"><Visual spec={FEATURE_VISUALS[b.slug]?.groups?.[f.grafico ?? i]} /></div></div>
              </div>
            ))}
          </div>
        </section>
      );
    case 'logos':
      return (
        <section className="mk-c-logos" aria-label={b.titulo}>
          <p className="mk-c-cifras-t">{b.titulo}</p>
          <ul className="mk-c-logos-fila">
            {b.items.map((l) => (
              // eslint-disable-next-line @next/next/no-img-element
              <li key={l.nombre}><img src={`/vsl-assets/logos/${l.logo}`} alt="" /><span>{l.nombre}</span></li>
            ))}
          </ul>
        </section>
      );
  }
}

export default function LandingCompetencia({ landing }: { landing: Landing }) {
  // Con su diseño copiado de la referencia (./disenos/<slug>.tsx), la página entera es ésa: la cara común de abajo es la de
  // las landings que todavía no lo tienen.
  const Diseno = DISENOS[landing.slug];
  // Arriba, la barra del sitio (la misma en todas las páginas, con el sol y la luna); la copiada de la referencia se oculta.
  if (Diseno) return <><BarraGlobal claro={!LANDINGS_OSCURAS.has(landing.slug)} barraPropia={BARRA_PROPIA[landing.slug]} /><Diseno landing={landing} /></>;
  return (
    <div className="mk-det">
      <style dangerouslySetInnerHTML={{ __html: CSS_DETALLE + CSS }} />
      <Cabecera />
      <main className="mk-det-main">
        <div className="mk-toprow">
          <a href="/vsl" className="mk-back">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6l6 6" /></svg>
            Todas las funcionalidades
          </a>
          <div className="mk-eyebrow mk-eyebrow-top">
            <span className="mk-eyebrow-tile"><Icon paths={landing.icono} size={20} /></span>
            <span className="mk-eyebrow-txt">{landing.nombre}</span>
          </div>
        </div>

        {landing.bloques.map((b, i) => <DibujarBloque key={`${b.tipo}-${i}`} b={b} icono={landing.icono} />)}

        <div className="mk-cta-end"><CtaBand /></div>

        <nav className="mk-more" aria-label="Otras funcionalidades">
          <h2 className="mk-more-h">Tu equipo de ventas High Ticket, en una sola app</h2>
          <div className="mk-more-grid" dangerouslySetInnerHTML={{ __html: gridHtml(landing.slug) }} />
        </nav>
      </main>
      <Pie />
    </div>
  );
}

const CSS = `
/* ── Lo propio de las landings que copian a un competidor ──────────────── */
.mk-c-hero { margin-top: 6px; }
.mk-c-hero-etq { margin: 0 0 14px; display: inline-flex; padding: 6px 12px; border-radius: 999px; background: #EAF1FE; color: #2F6FED; font-size: 13px; font-weight: 600; letter-spacing: .01em; }
.mk-c-hero .mk-h1 { font-size: 44px; }
.mk-c-hero .mk-btn-hero { margin-top: 24px; }
.mk-c-puntos { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.mk-c-puntos li { display: flex; gap: 9px; align-items: center; font-size: 14.5px; line-height: 1.5; color: #5B6472; }
.mk-c-puntos .mk-check { margin-top: 0; }
.mk-c-panel-hero { padding: 26px 22px; }

/* Cifras */
.mk-c-cifras { margin: 56px 0 0; padding: 26px 0; border-top: 1px solid #EEF0F3; border-bottom: 1px solid #EEF0F3; }
.mk-c-cifras-t { margin: 0 0 18px; text-align: center; font-size: 14px; font-weight: 600; color: #5B6472; }
.mk-c-cifras-fila { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 16px; }
.mk-c-cifra { display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; }
.mk-c-cifra-v { font-size: 34px; line-height: 1.1; font-weight: 700; letter-spacing: -0.03em; color: #12151B; font-variant-numeric: tabular-nums; }
.mk-c-cifra-l { font-size: 14px; line-height: 1.4; color: #5B6472; max-width: 200px; }

/* Secciones */
.mk-c-sec { position: relative; margin-top: 76px; }
.mk-c-fondo { padding: 60px 0 64px; }
.mk-c-fondo::before { content: ''; position: absolute; inset: 0; left: 50%; width: 100vw; transform: translateX(-50%); background: #F5F8FD; border-top: 1px solid #EDF1F7; border-bottom: 1px solid #EDF1F7; }
.mk-c-fondo > * { position: relative; }
.mk-c-enc { text-align: center; max-width: 760px; margin: 0 auto 36px; }
.mk-c-etq { margin-top: 0 !important; }
.mk-c-h2 { margin: 0; font-size: 36px; line-height: 1.14; letter-spacing: -0.025em; font-weight: 600; color: #12151B; text-wrap: balance; }
.mk-c-bajada { margin: 14px 0 0; font-size: 17px; line-height: 1.6; color: #5B6472; }
.mk-c-bajada strong { color: #12151B; font-weight: 600; }
.mk-c-cta-fila { margin-top: 32px; display: flex; justify-content: center; }

/* Sin / Con */
.mk-c-contraste { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
.mk-c-lado { border-radius: 18px; padding: 26px 26px 28px; background: #fff; border: 1px solid #E7ECF5; }
.mk-c-con { border-color: #CFDDFB; box-shadow: 0 22px 50px -30px rgba(47,111,237,.45); }
.mk-c-lado-r { display: inline-flex; align-items: center; gap: 8px; font-size: 12.5px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: #5B6472; }
.mk-c-con .mk-c-lado-r { color: #2F6FED; }
.mk-c-lado-ic { width: 24px; height: 24px; border-radius: 7px; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; }
.mk-c-lado-ic-sin { background: #FCEBEC; color: #DC2626; }
.mk-c-lado-ic-con { background: #1A1712; }
.mk-c-lado-t { margin: 14px 0 10px; font-size: 20px; line-height: 1.3; letter-spacing: -0.01em; font-weight: 600; color: #12151B; }
.mk-c-lado-x { margin: 0; font-size: 15.5px; line-height: 1.65; color: #4A515E; }
.mk-c-lado-x strong { color: #12151B; font-weight: 600; }

/* Tarjetas */
.mk-c-grilla { display: grid; gap: 16px; }
.mk-c-grilla-3 { grid-template-columns: repeat(3, 1fr); }
.mk-c-grilla-2 { grid-template-columns: repeat(2, 1fr); }
/* La última fila incompleta va centrada: con 5 tarjetas en 3 columnas, el hueco a la derecha se leía como una que falta. */
.mk-c-grilla-3.mk-c-resto-1, .mk-c-grilla-3.mk-c-resto-2 { grid-template-columns: repeat(6, 1fr); }
.mk-c-resto-1 > *, .mk-c-resto-2 > * { grid-column: span 2; }
.mk-c-resto-2 > :nth-last-child(2) { grid-column: 2 / span 2; }
.mk-c-resto-1 > :last-child { grid-column: 3 / span 2; }
/* Dos franjas de fondo seguidas (un bloque con fondo y el caso) se tocan: con el margen quedaba una raya blanca entre las dos. */
.mk-c-fondo + .mk-c-fondo, .mk-c-fondo + .mk-hist, .mk-hist + .mk-c-fondo { margin-top: 0; }
.mk-c-tarjeta { display: flex; flex-direction: column; gap: 10px; padding: 24px 22px; border-radius: 16px; background: #fff; border: 1px solid #E7ECF5; transition: transform .22s ease, box-shadow .22s ease; }
.mk-c-tarjeta:hover { transform: translateY(-2px); box-shadow: 0 18px 40px -24px rgba(16,19,25,.22); }
.mk-c-tarjeta-ic { width: 40px; height: 40px; border-radius: 11px; background: #EAF1FE; color: #2F6FED; display: flex; align-items: center; justify-content: center; }
.mk-c-tarjeta-t { margin: 4px 0 0; font-size: 17px; line-height: 1.3; letter-spacing: -0.01em; font-weight: 600; color: #12151B; }
.mk-c-tarjeta-x { margin: 0; font-size: 14.5px; line-height: 1.6; color: #5B6472; }
.mk-c-tarjeta-x strong { color: #12151B; font-weight: 600; }
.mk-c-tarjeta-m { margin-top: auto; padding-top: 6px; font-size: 12.5px; font-weight: 500; color: #8A93A2; font-variant-numeric: tabular-nums; }

/* Filas con gráfico y fila de logos */
.mk-c-fila-x { margin: 0 0 14px; font-size: 16px; line-height: 1.65; color: #4A515E; }
.mk-c-fila-x strong { color: #12151B; font-weight: 600; }
.mk-c-logos { margin: 48px 0 0; }
.mk-c-logos-fila { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; justify-content: center; gap: 12px 26px; }
.mk-c-logos-fila li { display: inline-flex; align-items: center; gap: 9px; font-size: 15px; font-weight: 600; color: #2E3646; }
.mk-c-logos-fila img { width: 28px; height: 28px; object-fit: contain; }

/* Pasos */
.mk-c-pasos { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; counter-reset: paso; }
.mk-c-paso { position: relative; padding: 24px 22px 26px; border-radius: 16px; background: #fff; border: 1px solid #E7ECF5; }
.mk-c-paso-n { display: inline-flex; padding: 5px 11px; border-radius: 8px; background: #2F6FED; color: #fff; font-size: 12.5px; font-weight: 600; letter-spacing: .02em; }
.mk-c-paso-t { margin: 16px 0 8px; font-size: 19px; line-height: 1.3; font-weight: 600; letter-spacing: -0.01em; color: #12151B; }
.mk-c-paso-x { margin: 0; font-size: 15px; line-height: 1.62; color: #4A515E; }
.mk-c-paso-x strong { color: #12151B; font-weight: 600; }

/* Preguntas */
.mk-c-faq { max-width: 820px; margin: 0 auto; display: flex; flex-direction: column; gap: 10px; }
.mk-c-faq-i { border-radius: 14px; background: #fff; border: 1px solid #E7ECF5; }
.mk-c-faq-i summary { list-style: none; cursor: pointer; padding: 18px 20px; }
.mk-c-faq-i summary::-webkit-details-marker { display: none; }
.mk-c-faq-i summary > span { display: inline; }
.mk-c-faq-p { font-size: 16px; font-weight: 600; color: #12151B; }
.mk-c-faq-mas { float: right; position: relative; width: 14px; height: 14px; margin-top: 4px; margin-left: 12px; }
.mk-c-faq-mas::before, .mk-c-faq-mas::after { content: ''; position: absolute; left: 0; top: 6px; width: 14px; height: 2px; border-radius: 2px; background: #2F6FED; transition: transform .2s ease; }
.mk-c-faq-mas::after { transform: rotate(90deg); }
.mk-c-faq-i[open] .mk-c-faq-mas::after { transform: rotate(0deg); }
.mk-c-faq-r { margin: 0; padding: 0 20px 18px; font-size: 15px; line-height: 1.65; color: #4A515E; }
.mk-c-faq-r strong { color: #12151B; font-weight: 600; }

/* Visual de AI Avatar */
.mk-c-av { display: flex; align-items: center; justify-content: center; gap: 14px; }
.mk-c-av-foto { flex: none; width: 128px; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 16px 10px; border-radius: 16px; background: #fff; border: 1px solid #E3EAF6; text-align: center; }
.mk-c-av-foto-cara { width: 64px; height: 64px; border-radius: 50%; background: #EAF1FE; color: #2F6FED; display: flex; align-items: center; justify-content: center; }
.mk-c-av-foto-t { font-size: 14px; font-weight: 600; color: #12151B; }
.mk-c-av-foto-d { font-size: 12px; line-height: 1.35; color: #6B7280; }
.mk-c-av-flecha { flex: none; color: #2F6FED; }
.mk-c-av-escenas { display: flex; align-items: center; justify-content: center; }
.mk-c-av-tel { position: relative; z-index: 2; flex: none; width: 216px; aspect-ratio: 9 / 16; padding: 7px; border-radius: 30px; background: #12151B; box-shadow: 0 28px 60px -30px rgba(16,19,25,.6); }
.mk-c-av-tel-lado { display: none; }
.mk-c-av-escena { position: relative; width: 100%; height: 100%; overflow: hidden; border-radius: 24px; background: linear-gradient(170deg, #3A3F4A 0%, #1D2027 100%); }
.mk-c-av-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.mk-c-av-escena::after { content: ''; position: absolute; inset: 0; z-index: 1; background: linear-gradient(to top, rgba(0,0,0,.62), transparent 44%); pointer-events: none; }
.mk-c-av-pill { position: absolute; top: 12px; left: 12px; z-index: 2; max-width: calc(100% - 64px); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 5px 9px; border-radius: 999px; background: rgba(16,19,25,.55); color: #fff; font-size: 10.5px; font-weight: 600; backdrop-filter: blur(4px); }
.mk-c-av-dur { position: absolute; top: 17px; right: 12px; z-index: 2; font-size: 10.5px; font-weight: 600; font-variant-numeric: tabular-nums; color: rgba(255,255,255,.85); }
.mk-c-av-sub { position: absolute; left: 12px; right: 12px; bottom: 16px; z-index: 2; margin: 0; text-align: center; font-size: 13px; line-height: 1.38; font-weight: 700; color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,.55); }
.mk-c-av-sub span { animation-name: mkCavPalabra; animation-iteration-count: infinite; animation-timing-function: steps(1, end); }
@keyframes mkCavPalabra { 0% { color: #fff; } 6% { color: #F2B01E; } 18%, 100% { color: #fff; } }
@media (prefers-reduced-motion: reduce) { .mk-c-av-sub span { animation: none; } }

@media (max-width: 960px) {
  .mk-c-grilla-3, .mk-c-pasos, .mk-c-grilla-3.mk-c-resto-1, .mk-c-grilla-3.mk-c-resto-2 { grid-template-columns: repeat(2, 1fr); }
  .mk-c-resto-1 > *, .mk-c-resto-2 > *, .mk-c-resto-2 > :nth-last-child(2), .mk-c-resto-1 > :last-child { grid-column: auto; }
  .mk-c-cifras-fila { row-gap: 24px; }
}
@media (max-width: 768px) {
  .mk-c-hero .mk-h1 { font-size: 31px; }
  .mk-c-h2 { font-size: 27px; }
  .mk-c-sec { margin-top: 56px; }
  .mk-c-fondo { padding: 44px 0 48px; }
  .mk-c-contraste, .mk-c-grilla-2, .mk-c-grilla-3, .mk-c-grilla-3.mk-c-resto-1, .mk-c-grilla-3.mk-c-resto-2, .mk-c-pasos { grid-template-columns: 1fr; }
  .mk-c-cifra-v { font-size: 28px; }
}
@media (max-width: 480px) {
  .mk-c-hero .mk-h1 { font-size: 28px; }
  .mk-c-av { gap: 8px; }
  .mk-c-av-foto { width: 96px; padding: 12px 6px; }
  .mk-c-av-foto-cara { width: 48px; height: 48px; }
  .mk-c-av-tel { width: 170px; }
  .mk-c-av-sub { font-size: 11.5px; }
}
`;
