// =============================================================================
// /vsl/script — Ads Analyst con el DISEÑO de la portada de Gethookd (https://www.gethookd.ai/, leída el 11/11/2026)
// =============================================================================
// Copiado de la referencia, con los valores leídos del navegador a 1440 y 390 px (docs/diseno/landings-competencia/script.md):
// la barra blanca de 82 px con su botón de 9 px de radio, el hero centrado con la grilla de 76 px enmascarada y el halo
// lila, el titular de 63 px con la palabra en degradado que corre, los chips de 41 px, la tira de logos con su rótulo de
// 12 px espaciado, la tarjeta «Ask your AI» (26 px de radio, grilla de 90 px, la fila de tarjetas que entran y la caja del
// chat con su chip y su botón redondo), «Two ways to run it» (las dos cabezas con el «o» en el medio, las dos columnas de
// tarjetas con su imagen de 364 px y la línea punteada, y la banda «Both routes end in the same place»), las preguntas
// en dos columnas sobre fondo gris con acordeones, el cierre oscuro y el pie de columnas. La letra es la de la referencia:
// Inter con su eje óptico (Gethookd la sirve renombrada como «GetHookd»), en public/vsl-assets/fuentes/inter/.
//
// De MaKo: el logo, el azul #2F6FED donde Gethookd pone su azul (#3352FF) y la estrella dorada, el botón de la llamada
// donde la referencia pone «Start a 7-Day Trial», los textos de app/vsl/_competencia/script.ts y los links del pie.
// Lo que se sacó de la referencia, y por qué:
//   · La píldora «Trusted by Mark Builds Brands… and 100,000+ users», el contador de anuncios de sus chips, los logos de
//     sus clientes, «Find the store before you find the product», los precios y la letra chica de la prueba gratis: son
//     suyos o de uso. En el lugar de los logos va el caso de Mauricio, con la forma de la tira (su rótulo y sus nombres).
//   · La fila «Works with your AI» con los íconos de Claude, ChatGPT y compañía: MaKo no se conecta a esas IA.
//   · Las insignias de plan («Every plan», «Team and Agency plans») y la barra pegajosa de cada columna: no hay planes aquí.
//   · Las dos tiras de anuncios que corren detrás del cierre: son anuncios de otros.
// Donde Gethookd pone el video de su app (la imagen de cada tarjeta de las columnas), van los gráficos de Ads Analyst de
// app/vsl/_detalle/feature-visuals.ts; el visual de la portada (el embudo «Del play al cierre») va en la tarjeta del paso 3,
// porque el hero de la referencia no lleva imagen.
// =============================================================================

import type { ReactNode } from 'react';
import type { PropsDiseno } from '.';
import type { Bloque } from '../tipos';
import { RUTA_CTA, CASO, EstrellaMaKo, LogoMaKo, TEXTO_CTA, html, otrasFunciones, TEXTO_CIERRE } from '../marca';
import { VisualDeLanding } from '../Visuales';
import { FaltaAnimacion } from '../FaltaAnimacion';
import { Visual } from '../../_detalle/Visual';
import { FEATURE_VISUALS } from '../../_detalle/feature-visuals';

const P = 'd-script';

type De<T extends Bloque['tipo']> = Extract<Bloque, { tipo: T }>;

function Flecha({ size = 15 }: { size?: number }) {
  return (
    <svg className={`${P}-flecha`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14" /><path d="M13 6l6 6l-6 6" />
    </svg>
  );
}

function Icono({ d, size = 14 }: { d?: string[]; size?: number }) {
  if (!d?.length) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d.map((p, i) => <path key={i} d={p} />)}
    </svg>
  );
}

function Chev() {
  return (
    <svg className={`${P}-chev`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6l6 -6" /></svg>
  );
}

/** El botón principal (el «Start a 7-Day Trial for $0» de la referencia). */
function Cta({ clase = '' }: { clase?: string }) {
  return <a href={RUTA_CTA} className={`${P}-cta ${clase}`}>{TEXTO_CTA}<Flecha /></a>;
}

// ── La barra ─────────────────────────────────────────────────────────────────
function Barra() {
  const otras = otrasFunciones('script');
  return (
    <header className={`${P}-nav`}>
      <div className={`${P}-wrap ${P}-navin`}>
        <LogoMaKo className={`${P}-brand`} tamano={34} />
        <nav className={`${P}-navlinks`} aria-label="Funciones de MaKo">
          <div className={`${P}-dd`}>
            <span tabIndex={0} className={`${P}-dd-btn`}>Funciones<Chev /></span>
            <div className={`${P}-dd-list`}>
              {otras.map((o) => <a key={o.href} href={o.href}>{o.nombre}</a>)}
            </div>
          </div>
        </nav>
        <div className={`${P}-navright`}>
          <a href="/login" className={`${P}-login`}>Iniciar sesión</a>
          <a href={RUTA_CTA} className={`${P}-navcta`}>{TEXTO_CTA}<Flecha /></a>
          <details className={`${P}-burger`}>
            <summary aria-label="Menú">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></svg>
            </summary>
            <div className={`${P}-burger-list`}>
              {otras.map((o) => <a key={o.href} href={o.href}>{o.nombre}</a>)}
              <a href="/login">Iniciar sesión</a>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}

// ── El hero, la tira del caso y la tarjeta «Pregúntale a MaKo» (en la referencia, las tres viven en la misma sección) ─
const ICONOS_CHIPS = [
  ['M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4', 'M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4'],
  ['M3 17l6 -6l4 4l8 -8', 'M14 7l7 0l0 7'],
];

function Hero({ b }: { b: De<'hero'> }) {
  return (
    <div className={`${P}-wrap ${P}-hero-copy`}>
      <div className={`${P}-eyebrow`} dangerouslySetInnerHTML={html(b.etiqueta)} />
      <h1 className={`${P}-h1`} dangerouslySetInnerHTML={html(b.titulo)} />
      <p className={`${P}-hero-sub`} dangerouslySetInnerHTML={html(b.bajada)} />
      <div className={`${P}-hero-actions`}><Cta /></div>
      {b.puntos?.length ? (
        <div className={`${P}-hero-stats`}>
          {b.puntos.map((p, i) => (
            <span key={p} className={`${P}-hero-stat`}>
              <i><Icono d={ICONOS_CHIPS[i % ICONOS_CHIPS.length]} size={13} /></i>
              <span dangerouslySetInnerHTML={html(p)} />
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** El caso de Mauricio con la forma de la tira de logos de la referencia: el rótulo espaciado y los «nombres» en gris. */
function Caso() {
  return (
    <section className={`${P}-logos`}>
      <p className={`${P}-logos-kicker`}>
        <span>{CASO.quien} · </span>
        <span dangerouslySetInnerHTML={html(CASO.titulo)} />
      </p>
      <div className={`${P}-logos-track`}>
        {CASO.meses.map((m) => (
          <span key={m.mes} className={`${P}-logo`}><b>{m.monto}</b>{m.mes}</span>
        ))}
      </div>
    </section>
  );
}

function Pregunta({ b }: { b: De<'tarjetas'> }) {
  return (
    <section className={`${P}-ask`}>
      <div className={`${P}-ask-head`}>
        <div>
          {b.etiqueta ? <div className={`${P}-access`}>[ {b.etiqueta} ]</div> : null}
          <h2 className={`${P}-ask-h2`} dangerouslySetInnerHTML={html(b.titulo)} />
          {b.bajada ? <p className={`${P}-ask-copy`} dangerouslySetInnerHTML={html(b.bajada)} /> : null}
        </div>
        <a href={RUTA_CTA} className={`${P}-learn`}>{TEXTO_CTA}</a>
      </div>
      <div className={`${P}-iface`}>
        <FaltaAnimacion que="El chat de Ads Analyst respondiendo, tal cual es." />
      </div>
    </section>
  );
}

// ── «Dos formas»: las dos cabezas, las dos columnas y la banda del final ─────
const VISUALES = FEATURE_VISUALS.script;

function Grafico({ i }: { i?: number }) {
  const spec = typeof i === 'number' ? VISUALES?.groups?.[i] : undefined;
  if (!spec) return null;
  return <div className={`${P}-shot`}><Visual spec={spec} /></div>;
}

/** La imagen de cada paso de MaKo. La caja para pedirle a MaKo va grabada de la app: hasta tenerla, el recuadro de lo que
 *  falta (12/11/2026: la caja dibujada a mano se sacó). */
function ImagenPaso({ i, visual }: { i: number; visual: De<'hero'>['visual'] | undefined }) {
  if (i === 0) {
    return (
      <div className={`${P}-dm ${P}-dm-oscuro`}>
        <div className={`${P}-conecta`}>
          <span className={`${P}-conecta-t`}><img src="/vsl-assets/logos/meta.png" alt="" width={34} height={34} /></span>
          <span className={`${P}-conecta-l`}><i /></span>
          <span className={`${P}-conecta-t ${P}-conecta-m`}><EstrellaMaKo size={30} /></span>
        </div>
      </div>
    );
  }
  if (i === 1) {
    return (
      <div className={`${P}-dm ${P}-dm-negro`}>
        <div className={`${P}-falta`}><FaltaAnimacion que="La caja para pedirle a MaKo, tal cual es." /></div>
      </div>
    );
  }
  return (
    <div className={`${P}-dm ${P}-dm-claro`}>
      {visual ? <div className={`${P}-shot ${P}-shot-claro`}><VisualDeLanding visual={visual} /></div> : null}
      <div className={`${P}-falta ${P}-falta-chica`}><FaltaAnimacion que="La caja para pedirle a MaKo, tal cual es." /></div>
    </div>
  );
}

function DosFormas({ t, f, p, visual }: { t: De<'tarjetas'>; f: De<'filas'>; p: De<'pasos'>; visual: De<'hero'>['visual'] | undefined }) {
  const [app, mako] = t.items;
  return (
    <section className={`${P}-band`}>
      <div className={`${P}-wrap`}>
        {t.etiqueta ? <div className={`${P}-kicker ${P}-rv`}>{t.etiqueta}</div> : null}
        <h2 className={`${P}-h2 ${P}-rv`} dangerouslySetInnerHTML={html(t.titulo)} />
        {t.bajada ? <p className={`${P}-lede ${P}-rv`} dangerouslySetInnerHTML={html(t.bajada)} /> : null}
        <div className={`${P}-sx`}>
          <header className={`${P}-way ${P}-way-app`}>
            {app?.meta ? <span className={`${P}-wt`}>{app.meta}</span> : null}
            <h3 dangerouslySetInnerHTML={html(app?.titulo ?? f.titulo)} />
            {app ? <p dangerouslySetInnerHTML={html(app.texto)} /> : null}
            <ul>{f.items.map((it) => <li key={it.titulo} dangerouslySetInnerHTML={html(it.titulo)} />)}</ul>
          </header>
          <span className={`${P}-or`}>o</span>
          <header className={`${P}-way ${P}-way-mako`}>
            {mako?.meta ? <span className={`${P}-wt`}>{mako.meta}</span> : null}
            <h3 dangerouslySetInnerHTML={html(mako?.titulo ?? p.titulo)} />
            {mako ? <p dangerouslySetInnerHTML={html(mako.texto)} /> : null}
            <ul>{p.pasos.map((it) => <li key={it.titulo} dangerouslySetInnerHTML={html(it.titulo)} />)}</ul>
          </header>
          {/* Las columnas no repiten su título: son las dos cabezas de arriba (como en la referencia). */}
          <div className={`${P}-col ${P}-col-app`}>
            {f.items.map((it) => (
              <div key={it.titulo} className={`${P}-demo`}>
                <div className={`${P}-dm ${P}-dm-app`}>
                  <Grafico i={it.grafico} />
                  {f.etiqueta ? <span className={`${P}-tag`}>{f.etiqueta}</span> : null}
                </div>
                <div className={`${P}-dc`}>
                  <h4 dangerouslySetInnerHTML={html(it.titulo)} />
                  <p dangerouslySetInnerHTML={html(it.texto)} />
                  {it.puntos?.length ? <ul className={`${P}-mini`}>{it.puntos.map((pt) => <li key={pt} dangerouslySetInnerHTML={html(pt)} />)}</ul> : null}
                </div>
              </div>
            ))}
          </div>
          <div className={`${P}-spine`} aria-hidden="true" />
          <div className={`${P}-col ${P}-col-mako`}>
            {p.pasos.map((it, i) => (
              <div key={it.titulo} className={`${P}-demo`}>
                <div className={`${P}-dmwrap`}>
                  <ImagenPaso i={i} visual={visual} />
                  {p.etiqueta ? <span className={`${P}-tag ${P}-tag-ag`}>{p.etiqueta}</span> : null}
                </div>
                <div className={`${P}-dc`}>
                  <span className={`${P}-step`}><i>{i + 1}</i></span>
                  <h4 dangerouslySetInnerHTML={html(it.titulo)} />
                  <p dangerouslySetInnerHTML={html(it.texto)} />
                </div>
              </div>
            ))}
          </div>
        </div>
        {p.bajada ? (
          <div className={`${P}-finish`}>
            <p dangerouslySetInnerHTML={html(p.bajada)} />
            <Cta />
          </div>
        ) : null}
      </div>
    </section>
  );
}

// ── Las preguntas, el cierre y el pie ────────────────────────────────────────
function Preguntas({ b }: { b: De<'preguntas'> }) {
  return (
    <section className={`${P}-band ${P}-alt`}>
      <div className={`${P}-wrap ${P}-faq2`}>
        <div className={`${P}-faq2-left`}>
          <h2 className={`${P}-h2`} dangerouslySetInnerHTML={html(b.titulo)} />
          <p><a href={RUTA_CTA}>{TEXTO_CTA}</a></p>
        </div>
        <div className={`${P}-faq2-right`}>
          {b.items.map((q) => (
            <details key={q.p}>
              <summary><span dangerouslySetInnerHTML={html(q.p)} /><Chev /></summary>
              <p className={`${P}-ans`} dangerouslySetInnerHTML={html(q.r)} />
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/** El cierre: el texto es el de la banda de la llamada de todas las landings de /vsl (app/vsl/_detalle/FeatureDetail.tsx). */
function Cierre() {
  return (
    <section className={`${P}-closer`}>
      <div className={`${P}-wrap ${P}-closer-in`}>
        <h2>¿Lo quieres funcionando <span className={`${P}-q`}>en tu negocio?</span></h2>
        <p>{TEXTO_CIERRE}</p>
        <a href={RUTA_CTA} className={`${P}-cta ${P}-cta-big`}>{TEXTO_CTA}<Flecha size={16} /></a>
      </div>
    </section>
  );
}

function PieDePagina() {
  const otras = otrasFunciones('script');
  return (
    <footer className={`${P}-foot`}>
      <div className={`${P}-wrap`}>
        <div className={`${P}-foot-top`}>
          <div>
            <LogoMaKo className={`${P}-brand`} tamano={36} />
            <p className={`${P}-foot-tag`}>El mejor software para vender High Ticket.</p>
          </div>
          <div className={`${P}-foot-col`}>
            <p className={`${P}-foot-h`}>Mapa del sitio</p>
            <a href="/">Funcionalidades</a>
            <a href={RUTA_CTA}>{TEXTO_CTA}</a>
          </div>
        </div>
        <div className={`${P}-foot-more`}>
          <p className={`${P}-foot-h`}>Más de MaKo</p>
          <div className={`${P}-foot-grid`}>
            {otras.map((o) => <a key={o.href} href={o.href}>{o.nombre}</a>)}
          </div>
        </div>
        <div className={`${P}-foot-bottom`}>
          <a href="/privacidad">Privacidad</a>
          <a href="/terminos">Términos</a>
        </div>
      </div>
    </footer>
  );
}

export default function DisenoScript({ landing }: PropsDiseno) {
  const bl = landing.bloques;
  const heroB = bl.find((b): b is De<'hero'> => b.tipo === 'hero');
  const partes: ReactNode[] = [];
  // La referencia mete el hero, la tira de logos y «Ask your AI» en la misma sección (con su grilla y su halo).
  const cabeza: ReactNode[] = [];
  let i = 0;
  while (i < bl.length) {
    const b = bl[i];
    const n1 = bl[i + 1];
    const n2 = bl[i + 2];
    if (b.tipo === 'tarjetas' && b.columnas === 2 && n1?.tipo === 'filas' && n2?.tipo === 'pasos') {
      partes.push(<DosFormas key={i} t={b} f={n1} p={n2} visual={heroB?.visual} />);
      i += 3;
      continue;
    }
    const enCabeza = partes.length === 0;
    let nodo: ReactNode = null;
    switch (b.tipo) {
      case 'hero': nodo = <Hero key={i} b={b} />; break;
      case 'caso': nodo = <Caso key={i} />; break;
      case 'tarjetas': nodo = enCabeza ? <Pregunta key={i} b={b} /> : null; break;
      case 'preguntas': nodo = <Preguntas key={i} b={b} />; break;
      default: nodo = null;
    }
    if (enCabeza) cabeza.push(nodo); else partes.push(nodo);
    i += 1;
  }
  return (
    <div className={P}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <Barra />
      <main>
        <section className={`${P}-hero`}>{cabeza}</section>
        {partes}
        <Cierre />
      </main>
      <PieDePagina />
    </div>
  );
}

// Los valores salen de getComputedStyle sobre https://www.gethookd.ai/ a 1440 y 390 px (11/11/2026). El azul de la
// referencia (#3352FF) va como el de MaKo (#2F6FED); sus tintes (#EDF0FF, #EEF1FF, #F5F7FF, #CCD4FF, #D3DAF7, #9FB0FF),
// como los mismos tintes del azul de MaKo.
const CSS = `
@font-face { font-family: 'd-script-inter'; src: url('/vsl-assets/fuentes/inter/inter-latin-opsz-var.woff2') format('woff2'); font-weight: 100 900; font-style: normal; font-display: swap; }
.d-script { --az: #2F6FED; --az-o: #1F57C8; --az-t: #EAF1FE; --az-t2: #F4F7FE; --az-b: #C9D9FB; --tinta: #061523; --tinta2: #0B1A27; --gris: #52616E; --gris2: #5F6D7A; --gris3: #6F7781; --linea: #E2E6EA;
  background: #fff; color: var(--tinta); font-family: 'd-script-inter', Inter, Arial, sans-serif; font-size: 16px; line-height: normal; -webkit-font-smoothing: antialiased; overflow-x: clip; }
.d-script *, .d-script *::before, .d-script *::after { box-sizing: border-box; }
.d-script :where(h1, h2, h3, h4, p, ul) { margin: 0; padding: 0; }
.d-script :where(ul) { list-style: none; }
.d-script :where(a) { color: inherit; text-decoration: none; }
.d-script-wrap { max-width: 1240px; margin: 0 auto; }
.d-script-flecha { flex: none; }

/* ── Barra: 82 px, blanca al 98 %, filete #EEF0F2 ── */
.d-script-nav { position: relative; z-index: 20; background: rgba(255,255,255,.98); border-bottom: 1px solid #EEF0F2; }
.d-script-navin { height: 81px; display: flex; align-items: center; justify-content: space-between; gap: 24px; }
.d-script-brand { flex: none; }
.d-script-navlinks { display: flex; align-items: center; gap: 34px; position: absolute; left: 50%; transform: translateX(-50%); }
.d-script-dd { position: relative; }
.d-script-dd-btn { display: inline-flex; align-items: center; gap: 5px; background: none; border: 0; padding: 0; cursor: pointer; font: inherit; font-size: 15px; font-weight: 650; line-height: 21px; color: #6F7781; transition: color .15s; }
.d-script-dd-btn .d-script-chev { width: 12px; height: 12px; transition: transform .15s; }
.d-script-dd:hover .d-script-dd-btn, .d-script-dd:focus-within .d-script-dd-btn { color: var(--tinta); }
.d-script-dd:hover .d-script-chev, .d-script-dd:focus-within .d-script-chev { transform: rotate(180deg); }
.d-script-dd-list { position: absolute; top: calc(100% + 14px); left: 50%; transform: translateX(-50%); width: 560px; display: none; grid-template-columns: 1fr 1fr; gap: 2px; padding: 10px; background: #fff; border: 1px solid #E3E8EC; border-radius: 14px; box-shadow: 0 18px 40px rgba(6,21,35,.12); }
.d-script-dd-list::before { content: ''; position: absolute; left: 0; right: 0; top: -16px; height: 16px; }
.d-script-dd:hover .d-script-dd-list, .d-script-dd:focus-within .d-script-dd-list { display: grid; }
.d-script-dd-list a { padding: 9px 12px; border-radius: 9px; font-size: 14px; font-weight: 600; color: #34414D; }
.d-script-dd-list a:hover, .d-script-dd-list a:focus-visible { background: #F5F7F9; color: var(--tinta); }
.d-script-navright { display: flex; align-items: center; gap: 24px; }
.d-script-login { font-size: 16px; font-weight: 650; line-height: 22.4px; color: #6F7781; transition: color .15s; }
.d-script-login:hover { color: var(--tinta); }
.d-script-navcta, .d-script-cta { display: inline-flex; align-items: center; justify-content: center; gap: 10px; height: 50px; padding: 0 19px; border-radius: 9px; background: var(--az); color: #fff !important; font-size: 14px; font-weight: 800; line-height: 16.8px; box-shadow: 0 10px 24px rgba(47,111,237,.18); transition: background .2s, transform .2s; white-space: nowrap; }
.d-script-navcta:hover, .d-script-cta:hover { background: var(--az-o); transform: translateY(-1px); }
.d-script-burger { display: none; position: relative; }
.d-script-burger summary { list-style: none; cursor: pointer; width: 40px; height: 40px; display: grid; place-items: center; border: 1px solid #E3E8EC; border-radius: 10px; color: var(--tinta); }
.d-script-burger summary::-webkit-details-marker { display: none; }
.d-script-burger-list { position: absolute; right: 0; top: calc(100% + 8px); width: 260px; max-height: 70vh; overflow: auto; background: #fff; border: 1px solid #E3E8EC; border-radius: 14px; box-shadow: 0 18px 40px rgba(6,21,35,.12); padding: 8px; display: flex; flex-direction: column; }
.d-script-burger-list a { padding: 10px 12px; border-radius: 9px; font-size: 15px; font-weight: 600; color: #34414D; }

/* ── Hero: padding 76/72, grilla de 76 px enmascarada y halo lila arriba ── */
.d-script-hero { position: relative; padding: 76px 0 72px; background: #fff; overflow: hidden; }
.d-script-hero::before { content: ''; position: absolute; inset: 0; pointer-events: none;
  background-image: linear-gradient(rgba(47,111,237,.055) 1px, transparent 1px), linear-gradient(90deg, rgba(47,111,237,.055) 1px, transparent 1px);
  background-size: 76px 76px; background-position: center top;
  -webkit-mask-image: radial-gradient(78% 62% at 50% 34%, #000 30%, transparent 78%); mask-image: radial-gradient(78% 62% at 50% 34%, #000 30%, transparent 78%); }
.d-script-hero::after { content: ''; position: absolute; left: 50%; top: -197px; width: 1180px; height: 780px; transform: translateX(-50%); pointer-events: none;
  background: radial-gradient(rgba(47,111,237,.13), rgba(120,140,255,.07) 42%, transparent 70%); }
.d-script-hero > * { position: relative; z-index: 1; }
.d-script-hero-copy { max-width: 1392px; padding: 0 24px; text-align: center; animation: d-script-sube .7s cubic-bezier(.2,.7,.2,1) both; }
.d-script-eyebrow { font-size: 17px; font-weight: 800; letter-spacing: -0.005em; color: var(--az); }
.d-script-h1 { margin: 12px auto 0; max-width: 640px; font-size: 63.36px; font-weight: 600; line-height: 1; letter-spacing: -0.06em; color: var(--tinta); }
.d-script-h1 strong { font-weight: 600; color: transparent; -webkit-background-clip: text; background-clip: text; padding: 0 .04em;
  background-image: linear-gradient(100deg, #2F6FED 0%, #6E8FF8 20%, #00B3FF 40%, #6E8FF8 60%, #2F6FED 80%, #2F6FED 100%); background-size: 250% 100%; animation: d-script-hl 3s linear infinite; }
.d-script-hero-sub { margin: 20px auto 0; max-width: 850px; font-size: 24.768px; font-weight: 540; line-height: 34.6752px; color: #354351; }
.d-script-hero-sub strong { font-weight: 700; color: var(--tinta); }
.d-script-hero-actions { margin-top: 28px; display: flex; justify-content: center; gap: 12px; }
.d-script-hero-actions .d-script-cta { height: 52px; padding: 0 23px; gap: 11px; font-size: 16px; }
.d-script-hero-stats { margin-top: 28px; display: flex; justify-content: center; flex-wrap: wrap; gap: 8px; }
.d-script-hero-stat { display: flex; align-items: center; gap: 9px; padding: 8px 15px 8px 9px; border-radius: 13px; background: rgba(255,255,255,.7); border: 1px solid rgba(16,38,64,.08); font-size: 13.5px; font-weight: 600; letter-spacing: -0.005em; color: #5B6B7B; transition: border-color .2s, transform .2s; }
.d-script-hero-stat:hover { border-color: rgba(47,111,237,.22); transform: translateY(-1px); }
.d-script-hero-stat i { flex: none; width: 23px; height: 23px; border-radius: 8px; background: var(--az-t); color: var(--az); display: grid; place-items: center; }

/* ── La tira (en la referencia, «Trusted by teams at» y los logos al 50 %) ── */
.d-script-logos { padding: 30px 24px 34px; background: transparent; border-bottom: 1px solid var(--linea); text-align: center; }
.d-script-logos-kicker { font-size: 12px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; color: var(--gris2); line-height: 1.35; }
.d-script-logos-track { margin-top: 20px; display: flex; justify-content: center; align-items: center; gap: 60px; flex-wrap: wrap; }
.d-script-logo { display: inline-flex; align-items: baseline; gap: 10px; opacity: .5; font-size: 30px; font-weight: 700; letter-spacing: -0.04em; color: var(--tinta); transition: opacity .2s; }
.d-script-logo b { font-weight: 800; }
.d-script-logo:hover { opacity: .8; }

/* ── «Ask your AI»: 1120 de ancho, radio 26, grilla de 90 px, sombra 0 24 80 ── */
.d-script-ask { position: relative; max-width: 1120px; margin: 52px auto 0; padding: 56px 56px 56px; border-radius: 26px; border: 1px solid #DCE2E7; overflow: hidden;
  background-color: #fff; background-image: linear-gradient(rgba(47,111,237,.055) 1px, transparent 1px), linear-gradient(90deg, rgba(47,111,237,.055) 1px, transparent 1px); background-size: 90px 90px;
  box-shadow: 0 24px 80px rgba(6,21,35,.12); }
.d-script-ask::before { content: ''; position: absolute; left: 18%; right: 18%; top: 28%; bottom: 3%; pointer-events: none; background: radial-gradient(circle, rgba(47,111,237,.09), transparent 70%); }
.d-script-ask > * { position: relative; }
.d-script-ask-head { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 40px; align-items: end; }
.d-script-access { display: flex; align-items: center; gap: 10px; min-height: 23px; font-size: 11px; font-weight: 820; letter-spacing: .1em; text-transform: uppercase; color: var(--az); }
.d-script-ask-h2 { margin-top: 14px; font-size: 70px; font-weight: 700; line-height: .98; letter-spacing: -0.055em; color: var(--tinta); }
.d-script-ask-copy { margin-top: 13px; max-width: 660px; font-size: 17px; line-height: 25.84px; color: var(--gris); }
.d-script-ask-copy strong { color: var(--tinta); }
.d-script-learn { display: inline-flex; align-items: center; justify-content: center; height: 48px; padding: 0 20px; border-radius: 12px; background: #F2F4F6; color: #1D2B37; font-size: 14px; font-weight: 800; transition: transform .2s, background-color .2s; white-space: nowrap; }
.d-script-learn:hover { background: #E9EDF0; transform: translateY(-1px); }
.d-script-iface { max-width: 820px; margin: 112px auto 0; }
.d-script-cards { display: flex; justify-content: center; align-items: stretch; gap: 10px; min-height: 178px; }
.d-script-acard { flex: 1 1 0; min-width: 0; max-width: 262px; display: flex; flex-direction: column; background: #fff; border: 1px solid #E3E7EB; border-radius: 14px; box-shadow: 0 14px 34px rgba(6,21,35,.13);
  animation: d-script-carta .42s cubic-bezier(.2,.75,.2,1) both; }
.d-script-acard-brand { display: flex; align-items: center; gap: 7px; padding: 10px 12px 8px; border-bottom: 1px solid #EEF1F4; }
.d-script-acard-logo { flex: none; width: 20px; height: 20px; border-radius: 50%; background: var(--az-t); color: var(--az); display: grid; place-items: center; }
.d-script-acard-name { font-size: 12px; font-weight: 750; color: #101F2E; }
.d-script-acard-body { padding: 10px 12px 13px; font-size: 13px; line-height: 19px; color: var(--gris); }
.d-script-acard-body strong { color: var(--tinta); }
.d-script-prompt { margin-top: 20px; display: flex; align-items: center; gap: 12px; padding: 18px 18px 18px 20px; min-height: 104px; background: #fff; border: 1px solid #DCE2E7; border-radius: 20px; box-shadow: 0 18px 38px rgba(6,21,35,.1); }
.d-script-chip { flex: none; display: inline-flex; align-items: center; gap: 7px; padding: 8px 10px; border-radius: 999px; background: var(--az-t); color: var(--az-o); font-size: 11px; font-weight: 850; }
.d-script-type { flex: 1; min-width: 0; display: flex; align-items: center; height: 24px; }
.d-script-cursor { display: inline-block; width: 2px; height: 18px; background: var(--az); animation: d-script-cursor .72s steps(1) infinite; }
.d-script-submit { flex: none; width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; background: var(--az); color: #fff; font-size: 23px; font-weight: 800; line-height: 23px; box-shadow: 0 8px 20px rgba(47,111,237,.25); }

/* ── Bandas: padding 96, contenedor 1240, rótulo 11 px, h2 56 px ── */
.d-script-band { padding: 96px 0; background: #fff; }
.d-script-kicker { font-size: 11px; font-weight: 850; letter-spacing: .14em; text-transform: uppercase; color: var(--az); }
.d-script-h2 { margin-top: 12px; max-width: 900px; font-size: 56px; font-weight: 700; line-height: 57.12px; letter-spacing: -0.05em; color: var(--tinta); }
.d-script-lede { margin-top: 16px; max-width: 720px; font-size: 18px; line-height: 28.44px; color: var(--gris); }
.d-script-rv { animation: d-script-sube .7s cubic-bezier(.2,.7,.2,1) both; }
.d-script-sx { position: relative; margin-top: 44px; display: grid; grid-template-columns: minmax(0, 1fr) 56px minmax(0, 1fr); column-gap: 0; row-gap: 24px; align-items: start; }
.d-script-way { grid-row: 1; align-self: stretch; display: flex; flex-direction: column; padding: 30px 28px; background: #fff; border: 1px solid #E0E5EA; border-radius: 18px; box-shadow: 0 12px 32px rgba(6,21,35,.06); }
.d-script-way-app { grid-column: 1; }
.d-script-way-mako { grid-column: 3; }
.d-script-wt { font-size: 10.5px; font-weight: 850; letter-spacing: .13em; text-transform: uppercase; color: var(--az); }
.d-script-way h3 { margin-top: 14px; font-size: 26px; font-weight: 700; line-height: 1.2; letter-spacing: -0.035em; color: var(--tinta); }
.d-script-way p { margin-top: 10px; font-size: 16px; line-height: 24.8px; color: var(--gris2); }
.d-script-way ul { margin-top: 18px; }
.d-script-way li, .d-script-mini li { position: relative; padding-left: 24px; margin-bottom: 11px; font-size: 15.5px; line-height: 23.25px; color: #2B3A47; }
.d-script-way li::before, .d-script-mini li::before { content: ''; position: absolute; left: 0; top: 7px; width: 12px; height: 6px; border-left: 2px solid var(--az); border-bottom: 2px solid var(--az); transform: rotate(-45deg); }
.d-script-or { grid-column: 2; grid-row: 1; align-self: center; justify-self: center; width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; background: #fff; border: 1px solid #DFE4EA; box-shadow: 0 8px 22px rgba(6,21,35,.1); font-size: 11px; font-weight: 850; letter-spacing: .1em; text-transform: uppercase; color: var(--gris2); }
.d-script-col { grid-row: 2; display: flex; flex-direction: column; gap: 24px; }
.d-script-col-app { grid-column: 1; }
.d-script-col-mako { grid-column: 3; }
.d-script-spine { grid-column: 2; grid-row: 2; justify-self: center; align-self: stretch; width: 0; border-left: 2px dashed #CFDDF9; }
.d-script-demo { position: relative; overflow: hidden; background: #fff; border: 1px solid #E3E8EC; border-radius: 18px; box-shadow: 0 10px 30px rgba(11,26,39,.06); transition: transform .25s, box-shadow .25s; }
.d-script-demo:hover { transform: translateY(-2px); box-shadow: 0 16px 38px rgba(11,26,39,.09); }
.d-script-dmwrap { position: relative; }
.d-script-dm { position: relative; height: 364px; overflow: hidden; display: flex; align-items: center; justify-content: center; }
.d-script-dm-app { align-items: flex-start; padding-top: 26px; background: radial-gradient(120% 90% at 90% 0%, #6FA3FF 0%, rgba(111,163,255,0) 45%), radial-gradient(90% 70% at 0% 100%, #1D5FD6 0%, rgba(29,95,214,0) 65%), linear-gradient(160deg, #2E6CE6 0%, #173F94 45%, #0F1C27 100%) #0F1C27; }
.d-script-dm-app .d-script-shot { width: 86%; max-width: none; border-radius: 12px 12px 0 0; padding: 12px 12px 0; box-shadow: 0 -2px 40px rgba(0,0,0,.35); }
.d-script-dm-oscuro { background: #0F1C27; }
.d-script-dm-negro { background: #141414; }
.d-script-dm-claro { background: #fff; flex-direction: column; gap: 14px; padding: 18px 30px; border-bottom: 1px solid #EEF1F4; }
.d-script-shot { width: 78%; max-width: 420px; padding: 10px; border-radius: 12px; background: #fff; box-shadow: 0 20px 50px rgba(0,0,0,.35); }
.d-script-shot svg { display: block; }
.d-script-shot-claro { width: 72%; max-width: 330px; padding: 6px; box-shadow: 0 12px 30px rgba(6,21,35,.13); border: 1px solid #E3E7EB; }
.d-script-tag { display: none; position: absolute; left: 10px; top: 10px; padding: 5px 8px; border-radius: 7px; background: rgba(11,26,39,.84); color: #fff; font-size: 9.5px; font-weight: 850; line-height: 11.4px; letter-spacing: .07em; text-transform: uppercase; }
.d-script-tag-ag { background: rgba(47,111,237,.94); }
.d-script-dc { padding: 18px 20px 20px; }
.d-script-step { display: inline-flex; align-items: center; gap: 10px; }
.d-script-step i { width: 24px; height: 24px; border-radius: 8px; background: var(--az); color: #fff; display: grid; place-items: center; font-style: normal; font-size: 12px; font-weight: 850; }
.d-script-dc h4 { margin-top: 10px; font-size: 21px; font-weight: 700; line-height: 24.78px; letter-spacing: -0.03em; color: var(--tinta); }
.d-script-dc h4:first-child { margin-top: 6px; }
.d-script-dc p { margin-top: 6px; font-size: 16px; line-height: 24px; color: var(--gris); }
.d-script-dc p strong { color: var(--tinta); }
.d-script-mini { margin-top: 14px; }
.d-script-mini li { font-size: 14.5px; line-height: 21px; margin-bottom: 8px; }
/* la conexión (paso 1) */
.d-script-conecta { display: flex; align-items: center; gap: 0; }
.d-script-conecta-t { width: 84px; height: 84px; border-radius: 22px; display: grid; place-items: center; background: #fff; box-shadow: 0 14px 34px rgba(0,0,0,.35); }
.d-script-conecta-m { background: #1A1712; border: 1px solid rgba(255,255,255,.12); }
.d-script-conecta-l { position: relative; width: 120px; height: 2px; background: repeating-linear-gradient(90deg, rgba(255,255,255,.35) 0 6px, transparent 6px 12px); }
.d-script-conecta-l i { position: absolute; top: -4px; left: 0; width: 10px; height: 10px; border-radius: 50%; background: var(--az); box-shadow: 0 0 0 4px rgba(47,111,237,.25); animation: d-script-viaja 2.4s ease-in-out infinite; }
/* el chat oscuro (paso 2) */
.d-script-pide { width: 78%; display: flex; flex-direction: column; align-items: center; gap: 22px; }
.d-script-pide-h { display: inline-flex; align-items: center; gap: 10px; color: #F2F2F2; font-size: 28px; font-weight: 600; letter-spacing: -0.03em; }
.d-script-pide-caja { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 14px 14px 18px; border-radius: 14px; background: #262626; border: 1px solid #3A3A3A; color: #E8E8E8; font-size: 14px; }
.d-script-pide-send { flex: none; width: 30px; height: 30px; border-radius: 9px; background: var(--az); color: #fff; display: grid; place-items: center; font-weight: 800; }
/* la caja del paso 3 */
.d-script-falta { width: 88%; border-radius: 14px; background: #fff; }
.d-script-falta .mk-falta { min-height: 0; }
.d-script-falta-chica .mk-falta { aspect-ratio: auto; padding: 10px 14px; gap: 2px; }
.d-script-falta-chica .mk-falta-t { font-size: 14px; }
.d-script-sxprompt { width: 88%; display: flex; align-items: center; gap: 12px; padding: 0 9px 0 12px; height: 62px; background: #fff; border: 1px solid #DCE2E7; border-radius: 17.7px; box-shadow: 0 11.8px 29.5px rgba(6,21,35,.1); }
.d-script-submit-sm { width: 41px; height: 41px; font-size: 20px; }
/* la banda del final: #F5F7FF con filete #CCD4FF, radio 18 */
.d-script-finish { position: relative; margin-top: 45px; display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 24px 26px; border-radius: 18px; background: var(--az-t2); border: 1px solid var(--az-b); }
.d-script-finish::before, .d-script-finish::after { content: ''; position: absolute; top: -45px; width: 2px; height: 44px; background: linear-gradient(rgba(47,111,237,0), var(--az)); }
.d-script-finish::before { left: calc((100% - 104px) / 4); }
.d-script-finish::after { right: calc((100% - 104px) / 4); }
.d-script-finish p { max-width: 660px; font-size: 19px; font-weight: 750; line-height: 26.6px; letter-spacing: -0.02em; color: var(--tinta2); }
.d-script-finish .d-script-cta { height: 52px; padding: 0 23px; gap: 11px; font-size: 16px; }

/* ── Preguntas: fondo #F7F9FA, dos columnas 480 / 690 con 70 de separación ── */
.d-script-alt { background: #F7F9FA; border-top: 1px solid #E7EBEE; border-bottom: 1px solid #E7EBEE; }
.d-script-faq2 { display: grid; grid-template-columns: 480px minmax(0, 1fr); gap: 70px; align-items: start; }
.d-script-faq2-left .d-script-h2 { margin-top: 0; }
.d-script-faq2-left p { margin-top: 17px; font-size: 16px; line-height: 25.6px; color: var(--gris2); }
.d-script-faq2-left a { font-weight: 750; color: var(--az); text-decoration: underline; text-underline-offset: 3px; }
.d-script-faq2-right details { border-top: 1px solid var(--linea); }
.d-script-faq2-right details:last-child { border-bottom: 1px solid var(--linea); }
.d-script-faq2-right summary { list-style: none; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 22px 0; font-size: 18px; font-weight: 700; letter-spacing: -0.02em; color: var(--tinta2); transition: color .15s; }
.d-script-faq2-right summary::-webkit-details-marker { display: none; }
.d-script-faq2-right summary:hover { color: var(--az); }
.d-script-faq2-right .d-script-chev { flex: none; color: var(--tinta2); transition: transform .25s; }
.d-script-faq2-right details[open] .d-script-chev { transform: rotate(180deg); color: var(--az); }
.d-script-ans { padding: 0 40px 22px 0; font-size: 16px; line-height: 26.56px; color: var(--gris); }
.d-script-ans strong { color: var(--tinta2); }

/* ── El cierre: #0B1A27, h2 60 px blanco con la segunda parte en el tinte del azul ── */
.d-script-closer { position: relative; padding: 120px 24px 132px; background: #0B1A27; text-align: center; overflow: hidden; }
.d-script-closer::before { content: ''; position: absolute; inset: 0; pointer-events: none; background-image: linear-gradient(rgba(255,255,255,.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.04) 1px, transparent 1px); background-size: 76px 76px; -webkit-mask-image: radial-gradient(60% 70% at 50% 50%, #000 20%, transparent 75%); mask-image: radial-gradient(60% 70% at 50% 50%, #000 20%, transparent 75%); }
.d-script-closer-in { position: relative; max-width: 860px; }
.d-script-closer h2 { font-size: 60px; font-weight: 700; line-height: 61.2px; letter-spacing: -0.05em; color: #fff; }
.d-script-q { display: block; color: #2F6FED; } /* era #9DBDF6: celeste sobre gris claro, contraste 2 a 1 (14/11) */
.d-script-closer p { margin: 16px auto 0; max-width: 620px; font-size: 19px; line-height: 29.45px; color: #B7C3CE; }
.d-script-cta-big { margin-top: 30px; height: 56px; padding: 18px 30px; border-radius: 12px; font-size: 17px; font-weight: 700; box-shadow: 0 0 0 6px rgba(47,111,237,.18), 0 18px 40px rgba(47,111,237,.35); }

/* ── Pie: filete arriba, padding 56/34, columnas 571 / 295 ── */
.d-script-foot { background: #fff; border-top: 1px solid var(--linea); padding: 56px 0 34px; }
.d-script-foot-top { display: grid; grid-template-columns: 571px 295px; gap: 40px; }
.d-script-foot-tag { margin-top: 31px; max-width: 460px; font-size: 19px; font-weight: 500; line-height: 28.5px; color: var(--tinta); }
.d-script-foot-col { display: flex; flex-direction: column; gap: 14px; }
.d-script-foot-h { font-size: 14px; font-weight: 500; line-height: 19.6px; color: #687886; margin-bottom: 8px; }
.d-script-foot-col a, .d-script-foot-grid a { font-size: 18px; font-weight: 500; line-height: 25.2px; color: var(--tinta); transition: color .15s; }
.d-script-foot-col a:hover, .d-script-foot-grid a:hover, .d-script-foot-bottom a:hover { color: var(--az); }
.d-script-foot-more { margin-top: 64px; }
.d-script-foot-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px 40px; }
.d-script-foot-bottom { margin-top: 44px; padding-top: 26px; border-top: 1px solid var(--linea); display: flex; gap: 18px; }
.d-script-foot-bottom a { font-size: 15px; font-weight: 500; line-height: 21px; color: var(--tinta); }

@keyframes d-script-hl { 0% { background-position: 0% 0; } 100% { background-position: -250% 0; } }
@keyframes d-script-sube { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
@keyframes d-script-carta { from { opacity: 0; transform: translateY(26px) scale(.9); } to { opacity: 1; transform: none; } }
@keyframes d-script-cursor { 0%, 48% { opacity: 1; } 49%, 100% { opacity: 0; } }
@keyframes d-script-viaja { 0% { left: 0; } 50% { left: calc(100% - 10px); } 100% { left: 0; } }

/* ── Mediano: las columnas siguen, más angostas ── */
@media (max-width: 1290px) {
  .d-script-wrap { padding: 0 24px; }
  .d-script-hero-copy { padding: 0 24px; }
  .d-script-ask { margin-left: 24px; margin-right: 24px; }
  .d-script-faq2 { grid-template-columns: minmax(0, 0.7fr) minmax(0, 1fr); }
  .d-script-foot-top { grid-template-columns: minmax(0, 1fr) 295px; }
}

/* ── Teléfono (medido a 390): barra de 70, márgenes de 14, titulares de 34 ── */
@media (max-width: 820px) {
  .d-script-wrap { padding: 0 14px; }
  .d-script-navin { height: 69px; gap: 8px; }
  .d-script-navlinks, .d-script-login { display: none; }
  .d-script-navright { gap: 6px; }
  .d-script-navcta { height: 40px; padding: 0 9px; gap: 5px; font-size: 10px; line-height: 12px; }
  .d-script-navcta .d-script-flecha { width: 11px; height: 11px; }
  .d-script-burger { display: block; }
  .d-script-hero { padding: 55px 0 48px; }
  .d-script-hero-copy { padding: 0 14px; }
  .d-script-eyebrow { max-width: 320px; margin: 0 auto; font-size: 15px; line-height: 21px; }
  .d-script-h1 { margin-top: 12px; font-size: 34px; line-height: 35.02px; letter-spacing: -0.055em; }
  .d-script-hero-sub { margin-top: 17px; font-size: 18px; line-height: 26.1px; }
  .d-script-hero-actions { margin-top: 24px; }
  .d-script-hero-actions .d-script-cta { width: 100%; max-width: 360px; }
  .d-script-hero-stats { margin-top: 20px; gap: 6px; }
  .d-script-hero-stat { padding: 6px 11px 6px 7px; gap: 7px; border-radius: 11px; font-size: 12px; }
  .d-script-hero-stat i { width: 20px; height: 20px; border-radius: 7px; }
  .d-script-logos { padding: 34px 14px; }
  .d-script-logos-track { margin-top: 18px; gap: 20px; }
  .d-script-logo { font-size: 19px; gap: 6px; }
  .d-script-ask { margin: 36px 10px 0; padding: 28px 20px 30px; border-radius: 19px; }
  .d-script-ask-head { grid-template-columns: minmax(0, 1fr); gap: 18px; }
  .d-script-ask-h2 { font-size: 42px; line-height: 41.16px; letter-spacing: -0.055em; }
  .d-script-ask-copy { font-size: 15px; line-height: 22.8px; }
  .d-script-learn { height: 42px; justify-self: start; }
  .d-script-iface { margin-top: 32px; }
  .d-script-cards { flex-direction: column; }
  .d-script-acard { max-width: none; }
  .d-script-prompt { padding: 14px; gap: 8px; min-height: 94px; }
  .d-script-cards { min-height: 0; }
  .d-script-submit { width: 39px; height: 39px; }
  .d-script-band { padding: 64px 0; }
  .d-script-h2 { font-size: 34px; line-height: 34.68px; letter-spacing: -0.05em; }
  .d-script-lede { font-size: 18px; }
  .d-script-sx { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); column-gap: 10px; row-gap: 16px; margin-top: 40px; }
  .d-script-way { padding: 18px 16px; }
  .d-script-way-app { grid-column: 1; }
  .d-script-way-mako { grid-column: 2; }
  .d-script-way h3 { margin-top: 10px; font-size: 18px; line-height: 20.7px; }
  .d-script-way p { font-size: 13.5px; line-height: 19.575px; }
  .d-script-way ul { display: none; }
  .d-script-wt { font-size: 9px; }
  .d-script-or { grid-column: 1 / 3; width: 34px; height: 34px; font-size: 9.5px; position: relative; z-index: 2; }
  .d-script-spine { display: none; }
  .d-script-col { grid-column: 1 / 3; gap: 16px; }
  .d-script-col-app { grid-row: 2; }
  .d-script-col-mako { grid-row: 3; }
  .d-script-dm { height: 222px; }
  .d-script-dm-claro { padding: 12px 16px; gap: 10px; }
  .d-script-shot { width: 70%; padding: 6px; }
  .d-script-shot-claro { width: 46%; }
  .d-script-tag { display: block; }
  .d-script-dc { padding: 14px 16px 16px; }
  .d-script-dc h4 { font-size: 19px; line-height: 22.42px; letter-spacing: -0.03em; }
  .d-script-conecta-t { width: 64px; height: 64px; border-radius: 18px; }
  .d-script-conecta-l { width: 80px; }
  .d-script-pide { width: 86%; gap: 16px; }
  .d-script-pide-h { font-size: 22px; }
  .d-script-sxprompt { height: 44px; border-radius: 11px; gap: 7px; padding: 0 6px 0 7px; }
  .d-script-sxprompt .d-script-chip { padding: 4px 6px; font-size: 9px; gap: 4px; }
  .d-script-submit-sm { width: 25px; height: 25px; font-size: 12px; }
  .d-script-finish { flex-direction: column; align-items: stretch; gap: 24px; padding: 22px 20px; margin-top: 24px; }
  .d-script-finish::before, .d-script-finish::after { display: none; }
  .d-script-finish .d-script-cta { width: 100%; }
  .d-script-faq2 { grid-template-columns: minmax(0, 1fr); gap: 26px; }
  .d-script-closer { padding: 120px 14px; }
  .d-script-closer h2 { font-size: 34px; line-height: 34.68px; letter-spacing: -0.05em; }
  .d-script-foot-top { grid-template-columns: minmax(0, 1fr); gap: 34px; }
  .d-script-foot-tag { font-size: 17px; line-height: 25.5px; }
  .d-script-foot-col a, .d-script-foot-grid a { font-size: 17px; line-height: 23.8px; }
  .d-script-foot-more { margin-top: 34px; }
  .d-script-foot-grid { grid-template-columns: minmax(0, 1fr); gap: 14px; }
}

@media (prefers-reduced-motion: reduce) {
  .d-script *, .d-script *::before, .d-script *::after { animation: none !important; transition: none !important; }
}
`;
