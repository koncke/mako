// =============================================================================
// /vsl/ads — Marketing CoPilot con el DISEÑO de la portada de Master Ads (https://masterads.ai/, leída el 11/11/2026)
// =============================================================================
// Copiado de la referencia, con los valores leídos del navegador a 1440 y 390 px (docs/diseno/landings-competencia/ads.md):
// la barra blanca de 64 px con sus dos píldoras, el hero sobre el fondo «fog» con la etiqueta en píldora, el titular de 60 px
// en Space Grotesk, la burbuja «¿Con qué arrancamos?» que respira, la caja de cuatro opciones que se encienden por turno y el
// botón en píldora con su anillo; «Inteligencia artificial, atención humana» en dos columnas con el marco oscuro de 18 px de
// radio; la banda oscura con las cinco tarjetas translúcidas; el reporte (ícono arriba, titular de 36 px y el tablero con su
// barra oscura, su columna de íconos y sus pestañas); el agente de WhatsApp (rótulo, titular, preguntas en tarjetas y el
// teléfono con sus globos); «Se conecta con» en tarjetas de 176 × 112; la banda oscura de «Pensado para…» y el pie mínimo.
// Las letras son las de la referencia (Space Grotesk para los titulares, IBM Plex Sans para el resto), en
// public/vsl-assets/fuentes/.
//
// De MaKo: el logo, el azul #2F6FED donde Master Ads pone su verde de acción (#14794C) y la estrella dorada donde pone su
// rayo. Su paleta entera es de marca (el verde bosque #0E3B2D de los botones y los marcos, el verde profundo #0A2E23 de las
// bandas, la menta #E3F3EA y el «fog» #F3F9F6): pasa a la misma familia en el azul de MaKo, con la misma luminosidad, así
// que las bandas siguen oscuras y los fondos claros siguen claros.
// Lo que se sacó de la referencia, y por qué:
//   · Las cifras del tablero de ejemplo (gasto, ventas, ROAS) y su pestaña de tiendas: son de su demo. En el tablero van los
//     dos gráficos del reporte de MaKo (app/_detalle/feature-visuals.ts → 'ads'), con el rótulo «Datos de ejemplo» que la
//     referencia ya pone.
//   · Las integraciones que MaKo no tiene (Google, TikTok, LinkedIn, Sheets…) y el carrusel: van sólo los tres logos de la
//     landing, quietos.
//   · El precio del cierre («por sólo US$ 29 al mes»): en su lugar va el botón de la llamada.
//   · La captura de su videollamada (atención humana): en el marco va el visual de la portada de MaKo (lo que le pides y la
//     decisión que te propone), que el hero de la referencia no lleva.
//   · Los íconos de redes del pie: en su lugar, los links a las otras funciones de MaKo y a lo legal.
// =============================================================================

import type { ReactNode } from 'react';
import type { PropsDiseno } from '.';
import type { Bloque } from '../tipos';
import { CALENDLY, EstrellaMaKo, LogoMaKo, TEXTO_CTA, html, otrasFunciones } from '../marca';
import { VisualDeLanding } from '../Visuales';
import { Visual } from '../../_detalle/Visual';
import { FEATURE_VISUALS } from '../../_detalle/feature-visuals';

const P = 'd-ads';
type De<T extends Bloque['tipo']> = Extract<Bloque, { tipo: T }>;

function Icono({ d, size = 16, clase }: { d?: string[]; size?: number; clase?: string }) {
  if (!d?.length) return null;
  return (
    <svg className={clase} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d.map((p, i) => <path key={i} d={p} />)}
    </svg>
  );
}

const ICONO = {
  chat: ['M14 9a2 2 0 0 1 -2 2h-6l-4 4v-10a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2z', 'M18 9h2a2 2 0 0 1 2 2v11l-4 -4h-6a2 2 0 0 1 -2 -2v-1'],
  pregunta: ['M21 15a2 2 0 0 1 -2 2h-12l-4 4v-14a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2z'],
  persona: ['M12 8m-5 0a5 5 0 1 0 10 0a5 5 0 1 0 -10 0', 'M3 21a9 9 0 0 1 14 -6'],
  mano: ['M18 11v-5a2 2 0 0 0 -4 0', 'M14 10v-6a2 2 0 0 0 -4 0v2', 'M10 10.5v-4.5a2 2 0 0 0 -4 0v8', 'M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1 -8 8h-2c-2.8 0 -4.5 -.86 -6 -2.34l-3.6 -3.6a2 2 0 0 1 2.83 -2.82l1.77 1.76'],
  tablero: ['M4 4h6v8h-6z', 'M4 16h6v4h-6z', 'M14 12h6v8h-6z', 'M14 4h6v4h-6z'],
  barras: ['M3 3v18h18', 'M8 17v-4', 'M13 17v-8', 'M18 17v-6'],
  reloj: ['M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0', 'M12 7v5l3 2'],
  lineas: ['M4 6h16', 'M4 12h10', 'M4 18h14'],
  campana: ['M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6', 'M9 17v1a3 3 0 0 0 6 0v-1'],
};

function Cta({ clase = '' }: { clase?: string }) {
  return <a href={CALENDLY} className={`${P}-cta ${clase}`}>{TEXTO_CTA}</a>;
}

// ── La barra ─────────────────────────────────────────────────────────────────
function Barra() {
  return (
    <header className={`${P}-nav`}>
      <div className={`${P}-navin`}>
        <LogoMaKo className={`${P}-brand`} tamano={32} />
        <div className={`${P}-navright`}>
          <a href="/login" className={`${P}-pill ${P}-pill-claro`}>Iniciar sesión</a>
          <a href={CALENDLY} className={`${P}-pill ${P}-pill-oscuro`}>{TEXTO_CTA}</a>
        </div>
      </div>
    </header>
  );
}

// ── El hero y «¿Con qué arrancamos?» (en la referencia, la misma sección) ────
function Hero({ b }: { b: De<'hero'> }) {
  return (
    <>
      <span className={`${P}-badge`} dangerouslySetInnerHTML={html(b.etiqueta)} />
      <h1 className={`${P}-h1`} dangerouslySetInnerHTML={html(b.titulo)} />
      <p className={`${P}-hero-p`} dangerouslySetInnerHTML={html(b.bajada)} />
    </>
  );
}

function Arrancamos({ b }: { b: De<'tarjetas'> }) {
  return (
    <div className={`${P}-arranca`}>
      <div className={`${P}-burbuja-fila`}>
        <span className={`${P}-rayo`}><EstrellaMaKo size={16} /></span>
        <span className={`${P}-burbuja`} dangerouslySetInnerHTML={html(b.titulo)} />
      </div>
      <div className={`${P}-opciones`}>
        {b.items.map((it) => (
          <div key={it.titulo} className={`${P}-opcion`}>
            <span className={`${P}-opcion-t`}><Icono d={it.icono} size={16} /><span dangerouslySetInnerHTML={html(it.titulo)} /></span>
            <span className={`${P}-opcion-x`} dangerouslySetInnerHTML={html(it.texto)} />
          </div>
        ))}
      </div>
      {b.cta ? <div className={`${P}-cta-fila`}><Cta clase={`${P}-respira`} /></div> : null}
    </div>
  );
}

// ── «Inteligencia artificial…»: texto a la izquierda, el marco oscuro a la derecha ─
function Atencion({ b, visual }: { b: De<'tarjetas'>; visual: De<'hero'>['visual'] | undefined }) {
  return (
    <section className={`${P}-sec ${P}-bg`}>
      <div className={`${P}-wrap ${P}-dos`}>
        <div className={`${P}-dos-txt`}>
          <h2 className={`${P}-h2`} dangerouslySetInnerHTML={html(b.titulo)} />
          {b.bajada ? <p className={`${P}-lede`} dangerouslySetInnerHTML={html(b.bajada)} /> : null}
          <ul className={`${P}-lista`}>
            {b.items.map((it) => (
              <li key={it.titulo}>
                <span className={`${P}-lista-i`}><Icono d={it.icono} size={16} /></span>
                <span><strong dangerouslySetInnerHTML={html(it.titulo)} /> <span dangerouslySetInnerHTML={html(it.texto)} /></span>
              </li>
            ))}
          </ul>
          <div className={`${P}-dos-cta`}><Cta /></div>
        </div>
        <div className={`${P}-marco`}>
          <div className={`${P}-marco-in`}>{visual ? <VisualDeLanding visual={visual} /> : null}</div>
        </div>
      </div>
    </section>
  );
}

// ── Las bandas oscuras de tarjetas («lo de siempre», «pensado para…») ────────
function BandaOscura({ b, cierre = false }: { b: De<'tarjetas'>; cierre?: boolean }) {
  const n = b.items.length;
  return (
    <section className={`${P}-sec ${P}-deep`}>
      <div className={`${P}-wrap`}>
        <div className={`${P}-centro`}>
          <h2 className={`${P}-h2 ${P}-h2-claro`} dangerouslySetInnerHTML={html(b.titulo)} />
          {b.bajada ? <p className={`${P}-lede ${P}-lede-claro`} dangerouslySetInnerHTML={html(b.bajada)} /> : null}
        </div>
        <div className={`${P}-cards ${n >= 5 ? `${P}-cards-5` : `${P}-cards-3`}`}>
          {b.items.map((it) => (
            <div key={it.titulo} className={`${P}-card`}>
              {it.icono ? <Icono d={it.icono} size={20} clase={`${P}-card-i`} /> : null}
              <h3 dangerouslySetInnerHTML={html(it.titulo)} />
              <p dangerouslySetInnerHTML={html(it.texto)} />
            </div>
          ))}
        </div>
        {cierre ? <div className={`${P}-cierre`}><Cta /></div> : null}
      </div>
    </section>
  );
}

// ── El reporte: el tablero de la referencia con los gráficos de MaKo ─────────
const VIS = FEATURE_VISUALS.ads;

function Reporte({ b, pestanas }: { b: De<'filas'>; pestanas: string[] }) {
  return (
    <section className={`${P}-sec ${P}-blanco`}>
      <div className={`${P}-wrap`}>
        <div className={`${P}-centro`}>
          <span className={`${P}-pide`} aria-hidden="true">
            <Icono d={ICONO.persona} size={40} clase={`${P}-pide-p`} />
            <Icono d={ICONO.mano} size={24} clase={`${P}-pide-m`} />
          </span>
          <h2 className={`${P}-h2c`} dangerouslySetInnerHTML={html(b.titulo)} />
          {b.bajada ? <p className={`${P}-lede`} dangerouslySetInnerHTML={html(b.bajada)} /> : null}
        </div>
        <div className={`${P}-tablero`}>
          <div className={`${P}-tab-barra`}>
            <EstrellaMaKo size={16} />
            <strong>MaKo</strong>
            <span className={`${P}-tab-sep`}>/</span>
            <span className={`${P}-tab-donde`}>Marketing CoPilot</span>
            <Icono d={ICONO.campana} size={16} clase={`${P}-tab-campana`} />
          </div>
          <div className={`${P}-tab-cuerpo`}>
            <div className={`${P}-tab-lado`} aria-hidden="true">
              {[ICONO.tablero, ICONO.barras, ICONO.reloj, ICONO.lineas, ICONO.persona].map((d, i) => <Icono key={i} d={d} size={16} />)}
            </div>
            <div className={`${P}-tab-main`}>
              <div className={`${P}-tab-tit`}>
                <h3>Marketing CoPilot</h3>
                <span className={`${P}-tab-ej`}>Datos de ejemplo</span>
              </div>
              {pestanas.length ? (
                <div className={`${P}-tab-pest`}>
                  {pestanas.map((t, i) => <span key={t} className={i === 2 ? `${P}-tab-act` : undefined}>{t}</span>)}
                </div>
              ) : null}
              <div className={`${P}-tab-graficos`}>
                {b.items.map((it) => {
                  const spec = typeof it.grafico === 'number' ? VIS?.groups?.[it.grafico] : undefined;
                  return (
                    <div key={it.titulo} className={`${P}-tab-g`}>
                      <h4 dangerouslySetInnerHTML={html(it.titulo)} />
                      <div className={`${P}-tab-svg`}>{spec ? <Visual spec={spec} /> : null}</div>
                      <p dangerouslySetInnerHTML={html(it.texto)} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        <div className={`${P}-cta-fila`}><Cta clase={`${P}-respira`} /></div>
      </div>
    </section>
  );
}

// ── El agente de WhatsApp: preguntas a la izquierda, el teléfono a la derecha ─
function Whatsapp({ b }: { b: De<'tarjetas'> }) {
  return (
    <section className={`${P}-sec ${P}-bg`}>
      <div className={`${P}-wrap ${P}-wa`}>
        <div>
          {b.etiqueta ? <span className={`${P}-eyebrow`} dangerouslySetInnerHTML={html(b.etiqueta)} /> : null}
          <h2 className={`${P}-h2 ${P}-wa-h2`} dangerouslySetInnerHTML={html(b.titulo)} />
          {b.bajada ? <p className={`${P}-lede ${P}-wa-lede`} dangerouslySetInnerHTML={html(b.bajada)} /> : null}
          <div className={`${P}-chips`}>
            {b.items.map((it) => (
              <div key={it.titulo} className={`${P}-chip`}><Icono d={ICONO.pregunta} size={16} /><span dangerouslySetInnerHTML={html(it.titulo)} /></div>
            ))}
          </div>
        </div>
        <div className={`${P}-tel-wrap`}>
          <span className={`${P}-tel-wa`} aria-hidden="true"><img src="/vsl-assets/logos/whatsapp.png" alt="" width={22} height={22} /></span>
          <div className={`${P}-tel`}>
            <div className={`${P}-tel-in`}>
              <div className={`${P}-tel-cab`}>
                <span className={`${P}-tel-av`}><EstrellaMaKo size={16} /></span>
                <div><p className={`${P}-tel-nom`}>MaKo</p><p className={`${P}-tel-est`}>en línea</p></div>
              </div>
              <div className={`${P}-tel-msgs`}>
                {b.items.map((it) => (
                  <div key={it.titulo} className={`${P}-tel-par`}>
                    <div className={`${P}-glob ${P}-glob-yo`} dangerouslySetInnerHTML={html(it.titulo)} />
                    <div className={`${P}-glob ${P}-glob-mako`} dangerouslySetInnerHTML={html(it.texto)} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Logos({ b }: { b: De<'logos'> }) {
  return (
    <section className={`${P}-logos`}>
      <h2 className={`${P}-logos-t`} dangerouslySetInnerHTML={html(b.titulo)} />
      <ul className={`${P}-logos-fila`}>
        {b.items.map((l) => (
          <li key={l.logo}><img src={`/vsl-assets/logos/${l.logo}`} alt={l.nombre} height={48} /><span>{l.nombre}</span></li>
        ))}
      </ul>
    </section>
  );
}

function Pie() {
  const otras = otrasFunciones('ads');
  return (
    <footer className={`${P}-foot`}>
      <div className={`${P}-wrap`}>
        <LogoMaKo className={`${P}-brand`} tamano={28} />
        <nav className={`${P}-foot-links`} aria-label="Otras funciones de MaKo">
          {otras.map((o) => <a key={o.href} href={o.href}>{o.nombre}</a>)}
        </nav>
        <div className={`${P}-foot-bottom`}>
          <p>© MaKo — Todos los derechos reservados.</p>
          <div><a href="/privacidad">Privacidad</a><a href="/terminos">Términos</a></div>
        </div>
      </div>
    </footer>
  );
}

export default function DisenoAds({ landing }: PropsDiseno) {
  const bl = landing.bloques;
  const heroB = bl.find((b): b is De<'hero'> => b.tipo === 'hero');
  // Las pestañas del tablero son las piezas del CoPilot (el bloque de las cinco tarjetas).
  const piezas = bl.find((b): b is De<'tarjetas'> => b.tipo === 'tarjetas' && b.items.length >= 5);
  const pestanas = piezas ? piezas.items.map((i) => i.titulo) : [];
  const ultimaTarjetas = bl.reduce((k, b, i) => (b.tipo === 'tarjetas' ? i : k), -1);

  const cabeza: ReactNode[] = [];
  const resto: ReactNode[] = [];
  let tarjetasVistas = 0;
  bl.forEach((b, i) => {
    switch (b.tipo) {
      case 'hero': cabeza.push(<Hero key={i} b={b} />); break;
      case 'tarjetas': {
        tarjetasVistas += 1;
        if (tarjetasVistas === 1 && resto.length === 0) { cabeza.push(<Arrancamos key={i} b={b} />); break; }
        if (tarjetasVistas === 2) { resto.push(<Atencion key={i} b={b} visual={heroB?.visual} />); break; }
        if (b.etiqueta && /whatsapp/i.test(b.etiqueta)) { resto.push(<Whatsapp key={i} b={b} />); break; }
        resto.push(<BandaOscura key={i} b={b} cierre={i === ultimaTarjetas} />);
        break;
      }
      case 'filas': resto.push(<Reporte key={i} b={b} pestanas={pestanas} />); break;
      case 'logos': resto.push(<Logos key={i} b={b} />); break;
      default: break;
    }
  });

  return (
    <div className={P}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <Barra />
      <main>
        <section className={`${P}-hero`}><div className={`${P}-hero-in`}>{cabeza}</div></section>
        {resto}
      </main>
      <Pie />
    </div>
  );
}

// Los valores salen de getComputedStyle sobre https://masterads.ai/ a 1440 y 390 px (11/11/2026). Sus variables:
// --ma-deep #0A2E23, --ma-forest #0E3B2D, --ma-brand #146C43, --ma-action #14794C, --ma-action-hover #105E3B, --ma-mist
// #E3F3EA, --ma-fog #F3F9F6, --background #F5F8F6, --border #D7E3DC, --foreground #12241D, --muted-foreground #52645B. Aquí,
// la misma familia en el azul de MaKo (misma luminosidad, el tono del azul): ver la tabla de docs/diseno/landings-competencia/ads.md.
const CSS = `
@font-face { font-family: 'd-ads-grotesk'; src: url('/vsl-assets/fuentes/space-grotesk/space-grotesk-latin-var.woff2') format('woff2'); font-weight: 300 700; font-style: normal; font-display: swap; }
@font-face { font-family: 'd-ads-plex'; src: url('/vsl-assets/fuentes/ibm-plex-sans/ibm-plex-sans-latin-var.woff2') format('woff2'); font-weight: 100 700; font-style: normal; font-display: swap; }
.d-ads { --deep: #0A1C3D; --forest: #0E2650; --brand: #1F57C8; --action: #2F6FED; --action-h: #1F57C8; --mist: #E4ECFC; --fog: #F3F6FC; --bgc: #F5F7FA; --borde: #D7DFEC; --tinta: #12192A; --gris: #525D6E;
  background: var(--bgc); color: var(--tinta); font-family: 'd-ads-plex', 'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif; font-size: 16px; line-height: 24px; -webkit-font-smoothing: antialiased; overflow-x: clip; }
.d-ads *, .d-ads *::before, .d-ads *::after { box-sizing: border-box; }
.d-ads :where(h1, h2, h3, h4, p, ul) { margin: 0; padding: 0; }
.d-ads :where(ul) { list-style: none; }
.d-ads :where(a) { color: inherit; text-decoration: none; }
.d-ads-wrap { max-width: 1152px; margin: 0 auto; padding: 0 24px; }

/* ── Barra: 64 + filete, logo a la izquierda, dos píldoras a la derecha ── */
.d-ads-nav { background: #fff; border-bottom: 1px solid var(--borde); }
.d-ads-navin { max-width: 1152px; margin: 0 auto; height: 64px; padding: 0 24px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.d-ads-brand { flex: none; }
.d-ads-brand > span:last-child { font-family: 'd-ads-grotesk', sans-serif; }
.d-ads-navright { display: flex; align-items: center; gap: 12px; }
.d-ads-pill { display: inline-flex; align-items: center; justify-content: center; padding: 10px 20px; border-radius: 999px; font-size: 14px; font-weight: 600; line-height: 20px; transition: background-color .15s, color .15s, border-color .15s; white-space: nowrap; }
.d-ads .d-ads-pill-claro { height: 42px; background: var(--bgc); border: 1px solid var(--borde); color: var(--tinta); box-shadow: 0 1px 3px rgba(0,0,0,.1), 0 1px 2px -1px rgba(0,0,0,.1); }
.d-ads .d-ads-pill-claro:hover { background: var(--fog); }
.d-ads .d-ads-pill-oscuro { height: 40px; background: var(--action); color: #fff; }
.d-ads .d-ads-pill-oscuro:hover { background: var(--action-h); }

/* ── Hero: fondo fog, padding 96 / 24, contenedor de 896 ── */
.d-ads-hero { background: var(--fog); }
.d-ads-hero-in { max-width: 896px; margin: 0 auto; padding: 96px 24px; text-align: center; }
.d-ads-badge { display: inline-flex; align-items: center; padding: 6px 16px; border-radius: 999px; background: var(--mist); color: var(--forest); font-size: 14px; font-weight: 500; line-height: 20px; }
.d-ads-h1 { margin-top: 24px; font-family: 'd-ads-grotesk', sans-serif; font-size: 60px; font-weight: 700; line-height: 60px; letter-spacing: -0.025em; color: var(--tinta); }
.d-ads-hero-p { margin: 20px auto 0; max-width: 672px; font-size: 18px; line-height: 28px; color: var(--gris); }
.d-ads-hero-p strong { color: var(--tinta); font-weight: 600; }
.d-ads-arranca { max-width: 576px; margin: 48px auto 0; text-align: left; }
.d-ads-burbuja-fila { display: flex; align-items: center; gap: 12px; }
.d-ads-rayo { flex: none; width: 36px; height: 36px; border-radius: 999px; background: #1A1712; display: flex; align-items: center; justify-content: center; }
.d-ads-burbuja { display: inline-flex; align-items: center; padding: 10px 20px; border-radius: 999px; background: var(--action); color: #fff; font-size: 14px; font-weight: 500; line-height: 20px; transform-origin: 0 center; animation: d-ads-respira 2.8s cubic-bezier(.4,0,.2,1) infinite; }
.d-ads-opciones { margin-top: 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 16px; background: #fff; border: 1px solid var(--borde); border-radius: 18px; }
.d-ads-opcion { display: flex; flex-direction: column; gap: 4px; padding: 12px 16px; border-radius: 10px; background: var(--bgc); border: 1px solid var(--borde); color: var(--tinta); animation: d-ads-luz 8s ease-in-out infinite; }
.d-ads-opcion:nth-child(2) { animation-delay: 2s; }
.d-ads-opcion:nth-child(3) { animation-delay: 4s; }
.d-ads-opcion:nth-child(4) { animation-delay: 6s; }
.d-ads-opcion-t { display: inline-flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 500; line-height: 20px; }
.d-ads-opcion-t svg { flex: none; }
.d-ads-opcion-x { padding-left: 24px; font-size: 12.5px; line-height: 17px; opacity: .78; }
.d-ads-opcion-x strong { font-weight: 600; }
.d-ads-cta-fila { margin-top: 40px; display: flex; justify-content: center; }
.d-ads-cta { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 16px 32px; border-radius: 999px; background: var(--action); color: #fff !important; font-size: 16px; font-weight: 600; line-height: 24px; box-shadow: 0 0 0 9px rgba(47,111,237,.086); transition: background-color .15s; white-space: nowrap; }
.d-ads-cta:hover { background: var(--action-h); }
.d-ads-respira { animation: d-ads-respira 2.8s cubic-bezier(.4,0,.2,1) infinite; }

/* ── Secciones: padding 96 / 24, contenedor de 1152 ── */
.d-ads-sec { padding: 96px 0; }
.d-ads-bg { background: var(--bgc); }
.d-ads-blanco { background: #fff; }
.d-ads-deep { background: var(--deep); }
.d-ads-h2 { font-family: 'd-ads-grotesk', sans-serif; font-size: 48px; font-weight: 700; line-height: 48px; letter-spacing: -0.025em; color: var(--tinta); }
.d-ads-h2-claro { color: #fff; }
.d-ads-lede { margin-top: 20px; font-size: 18px; line-height: 28px; color: var(--gris); }
.d-ads-lede-claro { margin-top: 16px; color: rgba(255,255,255,.72); }
.d-ads-centro { text-align: center; }
.d-ads-dos { display: grid; grid-template-columns: 446.66fr 625.34fr; gap: 32px; align-items: center; }
.d-ads-dos-txt .d-ads-lede { max-width: 448px; }
.d-ads-lista { margin-top: 24px; display: flex; flex-direction: column; gap: 14px; max-width: 448px; }
.d-ads-lista li { display: flex; gap: 12px; font-size: 15px; line-height: 22px; color: var(--gris); }
.d-ads-lista strong { color: var(--tinta); font-weight: 600; }
.d-ads-lista-i { flex: none; width: 32px; height: 32px; border-radius: 10px; background: var(--mist); color: var(--brand); display: flex; align-items: center; justify-content: center; }
.d-ads-dos-cta { margin-top: 32px; }
.d-ads-marco { padding: 10px; border-radius: 18px; background: var(--forest); box-shadow: 0 20px 60px -20px rgba(70,90,230,.35); }
.d-ads-marco-in { border-radius: 14px; background: var(--fog); padding: 32px 36px; min-height: 343px; display: flex; flex-direction: column; justify-content: center; }
/* las tarjetas translúcidas de las bandas oscuras */
.d-ads-cards { margin-top: 48px; display: grid; gap: 16px; }
.d-ads-cards-5 { grid-template-columns: repeat(5, minmax(0, 1fr)); }
.d-ads-cards-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.d-ads-card { padding: 20px; border-radius: 18px; background: rgba(255,255,255,.05); box-shadow: 0 0 0 1px rgba(255,255,255,.1); transition: background-color .2s; }
.d-ads-card:hover { background: rgba(255,255,255,.08); }
.d-ads-cards-3 .d-ads-card { padding: 24px; }
.d-ads-card-i { display: block; color: #fff; }
.d-ads-card h3 { margin-top: 12px; font-size: 14px; font-weight: 600; line-height: 20px; color: #fff; }
.d-ads-cards-3 .d-ads-card h3 { margin-top: 0; font-size: 16px; line-height: 24px; }
.d-ads-card p { margin-top: 6px; font-size: 14px; line-height: 20px; color: rgba(255,255,255,.72); }
.d-ads-cards-3 .d-ads-card p { margin-top: 8px; }
.d-ads-card p strong { color: #fff; font-weight: 600; }
.d-ads-cierre { margin-top: 56px; display: flex; justify-content: center; }
/* el reporte */
.d-ads-pide { position: relative; display: block; margin: 0 auto; width: 48px; height: 48px; color: var(--forest); }
.d-ads-pide-p { position: absolute; left: 0; bottom: 0; }
.d-ads-pide-m { position: absolute; right: 0; top: 0; }
.d-ads-h2c { margin-top: 20px; font-family: 'd-ads-grotesk', sans-serif; font-size: 36px; font-weight: 700; line-height: 40px; color: var(--tinta); }
.d-ads-blanco .d-ads-lede { margin-top: 16px; }
.d-ads-tablero { margin-top: 40px; overflow: hidden; background: #fff; border: 1px solid var(--borde); border-radius: 10px; box-shadow: 0 24px 48px -16px rgba(10,28,61,.18); }
.d-ads-tab-barra { height: 56px; display: flex; align-items: center; gap: 12px; padding: 0 20px; background: var(--deep); color: #fff; font-size: 14px; line-height: 20px; }
.d-ads-tab-barra strong { font-weight: 600; }
.d-ads-tab-sep { font-size: 16px; color: rgba(255,255,255,.72); }
.d-ads-tab-donde { color: rgba(255,255,255,.72); }
.d-ads-tab-campana { margin-left: auto; }
.d-ads-tab-cuerpo { display: flex; }
.d-ads-tab-lado { flex: none; width: 56px; padding: 24px 0; background: var(--fog); border-right: 1px solid var(--borde); display: flex; flex-direction: column; align-items: center; gap: 28px; color: var(--gris); }
.d-ads-tab-lado svg:first-child { color: var(--action); }
.d-ads-tab-main { flex: 1; min-width: 0; padding: 28px; }
.d-ads-tab-tit { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.d-ads-tab-tit h3 { font-family: 'd-ads-grotesk', sans-serif; font-size: 20px; font-weight: 700; line-height: 28px; }
.d-ads-tab-ej { padding: 4px 12px; border-radius: 999px; background: var(--mist); color: var(--brand); font-size: 12px; font-weight: 600; line-height: 16px; }
.d-ads-tab-pest { margin-top: 20px; display: flex; flex-wrap: wrap; gap: 20px; border-bottom: 1px solid var(--borde); font-size: 14px; line-height: 20px; color: var(--gris); }
.d-ads-tab-pest span { padding-bottom: 12px; }
.d-ads-tab-pest .d-ads-tab-act { margin-bottom: -1px; border-bottom: 2px solid var(--action); color: var(--tinta); font-weight: 600; }
.d-ads-tab-graficos { margin-top: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.d-ads-tab-g { padding: 20px; border: 1px solid var(--borde); border-radius: 10px; }
.d-ads-tab-g h4 { font-size: 14px; font-weight: 600; line-height: 20px; }
.d-ads-tab-svg { margin-top: 20px; }
.d-ads-tab-svg svg { display: block; }
.d-ads-tab-g p { margin-top: 12px; font-size: 12px; line-height: 16px; color: var(--gris); }
.d-ads-tab-g p strong { color: var(--tinta); font-weight: 600; }
/* el agente de WhatsApp */
.d-ads-wa { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: center; }
.d-ads-eyebrow { display: block; font-size: 12px; font-weight: 600; line-height: 16px; letter-spacing: .1em; text-transform: uppercase; color: var(--brand); }
.d-ads-wa-h2 { margin-top: 12px; }
.d-ads-wa-lede { max-width: 448px; }
.d-ads-chips { margin-top: 32px; display: flex; flex-direction: column; gap: 12px; }
.d-ads-chip { max-width: 448px; display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 14px; background: #fff; border: 1px solid var(--borde); box-shadow: 0 1px 3px rgba(0,0,0,.1), 0 1px 2px -1px rgba(0,0,0,.1); font-size: 14px; line-height: 20px; color: var(--tinta); }
.d-ads-chip svg { flex: none; color: var(--action); }
.d-ads-tel-wrap { position: relative; width: 100%; max-width: 300px; margin: 0 auto; }
.d-ads-tel-wa { position: absolute; right: -12px; top: -12px; z-index: 1; width: 40px; height: 40px; border-radius: 999px; background: #25D366; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,.15); }
.d-ads-tel-wa img { filter: brightness(0) invert(1); }
.d-ads-tel { padding: 12px; border-radius: 32px; background: var(--forest); box-shadow: 0 20px 60px -20px rgba(70,90,230,.35); }
.d-ads-tel-in { overflow: hidden; border-radius: 24px; background: #ECE5DD; min-height: 416px; }
.d-ads-tel-cab { display: flex; align-items: center; gap: 10px; padding: 12px 16px; background: var(--deep); }
.d-ads-tel-av { width: 32px; height: 32px; border-radius: 999px; background: #1A1712; display: flex; align-items: center; justify-content: center; }
.d-ads-tel-nom { font-size: 14px; font-weight: 600; line-height: 20px; color: #fff; }
.d-ads-tel-est { font-size: 12px; line-height: 16px; color: rgba(255,255,255,.7); }
.d-ads-tel-msgs { padding: 24px 16px 40px; display: flex; flex-direction: column; gap: 12px; }
.d-ads-tel-par { display: flex; flex-direction: column; gap: 12px; }
.d-ads-glob { max-width: 85%; padding: 10px 14px; font-size: 14px; line-height: 20px; color: var(--tinta); box-shadow: 0 1px 2px rgba(0,0,0,.08); }
.d-ads-glob-yo { margin-left: auto; background: #DCF8C6; border-radius: 14px 6px 14px 14px; }
.d-ads-glob-mako { background: #fff; border-radius: 6px 14px 14px; }
.d-ads-glob strong { font-weight: 600; }
/* «Se conecta con» */
.d-ads-logos { padding: 40px 16px; background: var(--fog); border-top: 1px solid var(--borde); border-bottom: 1px solid var(--borde); }
.d-ads-logos-t { text-align: center; font-family: 'd-ads-grotesk', sans-serif; font-size: 18px; font-weight: 600; line-height: 28px; color: var(--tinta); }
.d-ads-logos-fila { margin-top: 24px; display: flex; justify-content: center; flex-wrap: wrap; gap: 12px; }
.d-ads-logos-fila li { width: 176px; height: 112px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; background: #fff; border: 1px solid var(--borde); border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,.1), 0 1px 2px -1px rgba(0,0,0,.1); }
.d-ads-logos-fila img { height: 40px; width: auto; max-width: 134px; object-fit: contain; }
.d-ads-logos-fila span { font-size: 12px; font-weight: 600; color: var(--gris); }
/* el pie */
.d-ads-foot { background: #fff; padding: 40px 0; }
.d-ads-foot .d-ads-brand { font-size: 18px; }
.d-ads-foot-links { margin-top: 24px; display: flex; flex-wrap: wrap; gap: 10px 24px; font-size: 14px; line-height: 20px; color: var(--gris); }
.d-ads-foot-links a:hover, .d-ads-foot-bottom a:hover { color: var(--action); }
.d-ads-foot-bottom { margin-top: 24px; padding-top: 24px; border-top: 1px solid var(--borde); display: flex; align-items: center; justify-content: space-between; gap: 16px; font-size: 14px; line-height: 20px; color: var(--gris); }
.d-ads-foot-bottom div { display: flex; gap: 16px; }

@keyframes d-ads-respira { 0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(47,111,237,.35); } 45% { transform: scale(1.1); box-shadow: 0 0 0 12px rgba(47,111,237,0); } }
@keyframes d-ads-luz { 0%, 25%, 100% { background-color: var(--bgc); color: var(--tinta); border-color: var(--borde); } 5%, 20% { background-color: var(--action); color: #fff; border-color: var(--action); } }

/* ── Teléfono (medido a 390): márgenes de 16, titulares de 36 y 30, todo en una columna ── */
@media (max-width: 860px) {
  .d-ads-wrap { padding: 0 16px; }
  .d-ads-navin { padding: 0 12px; gap: 6px; }
  .d-ads-navright { gap: 6px; }
  .d-ads-pill { padding: 6px 12px; font-size: 12px; line-height: 16px; }
  .d-ads .d-ads-pill-claro { height: 31px; }
  .d-ads .d-ads-pill-oscuro { height: 29px; }
  .d-ads-hero-in { padding: 64px 16px; }
  .d-ads-h1 { font-size: 36px; line-height: 40px; letter-spacing: -0.025em; }
  .d-ads-hero-p { margin-top: 20px; font-size: 16px; line-height: 24px; }
  .d-ads-arranca { margin-top: 48px; }
  .d-ads-opciones { grid-template-columns: 1fr; }
  .d-ads-sec { padding: 64px 0; }
  .d-ads-h2 { font-size: 30px; line-height: 36px; letter-spacing: -0.025em; }
  .d-ads-lede { font-size: 16px; line-height: 24px; }
  .d-ads-dos { grid-template-columns: 1fr; gap: 48px; text-align: center; }
  .d-ads-dos-txt .d-ads-lede, .d-ads-lista { margin-left: auto; margin-right: auto; }
  .d-ads-lista { text-align: left; }
  .d-ads-marco-in { padding: 20px 16px; min-height: 0; }
  .d-ads-cards-5, .d-ads-cards-3 { grid-template-columns: 1fr; }
  .d-ads-h2c { font-size: 30px; line-height: 36px; }
  .d-ads-tab-lado { display: none; }
  .d-ads-tab-main { padding: 16px; }
  .d-ads-tab-pest { gap: 14px; }
  .d-ads-tab-graficos { grid-template-columns: 1fr; }
  .d-ads-wa { grid-template-columns: 1fr; gap: 48px; }
  .d-ads-foot-bottom { flex-direction: column; align-items: flex-start; }
  .d-ads-logos-fila { flex-wrap: nowrap; gap: 10px; }
  .d-ads-logos-fila li { width: calc((100% - 20px) / 3); max-width: 176px; height: 96px; }
  .d-ads-logos-fila img { height: 32px; }
}

@media (prefers-reduced-motion: reduce) {
  .d-ads *, .d-ads *::before, .d-ads *::after { animation: none !important; transition: none !important; }
}
`;
