// =============================================================================
// /vsl/crm con el DISEÑO de la portada de GoHighLevel (https://www.gohighlevel.com/), copiado el 11/11/2026
// =============================================================================
// Los valores (Poppins, la escala de títulos, el degradado del hero, las tarjetas de los contadores, las pestañas del ciclo,
// las cajas de 1170 px con radio 25 y 50, la sección oscura de casos y el pie de cuatro columnas) se leyeron con
// getComputedStyle a 1440 y 390 px: docs/diseno/landings-competencia/crm.md. De MaKo quedan el logo, el azul #2F6FED donde
// GoHighLevel pone su cian, el dorado como detalle (el pill y la pestaña activa), el botón de la llamada y los textos.
//
// Secciones de la referencia que NO van, y por qué:
//   · «We're in the business of helping you grow» con su caja de premios: los premios son suyos. Su título queda para el
//     título de las cifras de MaKo («En el CRM de Mauricio, en nueve días»), que en su lugar va justo debajo de los números.
//   · «Join the movement» (su comunidad), «Everything you need… even on the go» (su app), «See Our Pricing» (sus precios) e
//     «Integrates With Your Favorite Tools» (logos): la landing de MaKo no tiene ese contenido.
//   · La tarjeta de testimonio dentro de la caja de principios: la prueba de MaKo es el caso de Mauricio, más abajo.
//   · El fondo de la caja de principios es una imagen que el proxy no deja bajar (images.leadconnectorhq.com): el texto
//     es blanco, así que va el azul noche de su hero.
// Server component sin JavaScript: las pestañas son radios ocultos con :checked.
// =============================================================================

import type { PropsDiseno } from '.';
import type { Bloque, Item } from '../tipos';
import { RUTA_CTA, CASO, EstrellaMaKo, LogoMaKo, TEXTO_CTA, html, otrasFunciones } from '../marca';
import { VisualDeLanding } from '../Visuales';
import { FEATURE_VISUALS } from '../../_detalle/feature-visuals';
import { Visual } from '../../_detalle/Visual';

type Tarjetas = Extract<Bloque, { tipo: 'tarjetas' }>;
type TarjetaItem = Tarjetas['items'][number];

function Ico({ paths, size = 24 }: { paths?: string[]; size?: number }) {
  if (!paths?.length) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths.map((d) => <path key={d} d={d} />)}
    </svg>
  );
}

function Flecha() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="M13 6l6 6l-6 6" /></svg>;
}

/** Su botón oscuro (#011D38, 16px 40px, radio 10) con el brillo que cruza al pasar el mouse. */
function BotonOscuro({ claro = false }: { claro?: boolean }) {
  return <a href={RUTA_CTA} data-tema-fijo="" className={`d-crm-btn ${claro ? 'd-crm-btn-claro' : 'd-crm-btn-oscuro'}`}>{TEXTO_CTA}</a>;
}

function Hero({ b }: { b: Extract<Bloque, { tipo: 'hero' }> }) {
  return (
    <div className="d-crm-hero-fila">
      <div className="d-crm-hero-txt">
        <p className="d-crm-pill"><span className="d-crm-pill-ic"><EstrellaMaKo size={16} /></span>{b.etiqueta}</p>
        <h1 className="d-crm-h1" dangerouslySetInnerHTML={html(b.titulo)} />
        <p className="d-crm-hero-p" dangerouslySetInnerHTML={html(b.bajada)} />
        <a href={RUTA_CTA} data-tema-fijo="" className="d-crm-btn-hero">{TEXTO_CTA}<span className="d-crm-btn-hero-ic"><Flecha /></span></a>
      </div>
      <div className="d-crm-hero-media"><VisualDeLanding visual={b.visual} /></div>
    </div>
  );
}

function Cifras({ b }: { b: Extract<Bloque, { tipo: 'cifras' }> }) {
  return (
    <>
      <div className="d-crm-contadores" aria-label="En números">
        {b.items.map((c) => (
          <div key={c.label} className="d-crm-contador">
            <span className="d-crm-contador-v d-crm-grad" data-tema-fijo="">{c.valor}</span>
            <span className="d-crm-contador-l">{c.label}</span>
          </div>
        ))}
      </div>
      {b.titulo ? (
        <section className="d-crm-sec d-crm-sec-cifras">
          <h2 className="d-crm-h2-30 d-crm-grad d-crm-centro" dangerouslySetInnerHTML={html(b.titulo)} />
        </section>
      ) : null}
    </>
  );
}

/** Los colores de cada pestaña de su ciclo (Capture amarillo, Nurture azul, Close verde, Evangelize celeste, Reactivate
 *  crema): el amarillo pasa al dorado de MaKo y el azul al de MaKo. */
const COLORES_PESTANA = ['#F2B01E', '#2F6FED', '#17D94B', '#6FCDFF', '#FFEEA3'];

function Ciclo({ b }: { b: Tarjetas }) {
  return (
    <section className="d-crm-sec d-crm-sec-ciclo">
      <div className="d-crm-enc-ciclo">
        <h2 className="d-crm-h2-40 d-crm-grad d-crm-centro" dangerouslySetInnerHTML={html(b.titulo)} />
        {b.bajada ? <p className="d-crm-sub d-crm-centro" dangerouslySetInnerHTML={html(b.bajada)} /> : null}
      </div>
      <div className="d-crm-tabs">
        {b.items.map((t, i) => <input key={t.titulo} type="radio" name="d-crm-ciclo" id={`d-crm-t${i}`} className={`d-crm-radio d-crm-radio-${i}`} defaultChecked={i === 0} aria-label={t.meta ?? t.titulo} />)}
        <div className="d-crm-pills" role="presentation">
          {b.items.map((t, i) => (
            <label key={t.titulo} htmlFor={`d-crm-t${i}`} data-tema-fijo="" className={`d-crm-pill-tab d-crm-pill-tab-${i}`} style={{ ['--d-crm-c' as string]: COLORES_PESTANA[i % COLORES_PESTANA.length] }}>
              <span>{t.meta ?? t.titulo}</span>
            </label>
          ))}
        </div>
        <div className="d-crm-panel">
          <div className="d-crm-panel-txt">
            {b.items.map((t, i) => (
              <div key={t.titulo} className={`d-crm-pan d-crm-pan-${i}`}>
                <span className="d-crm-pan-ic" style={{ ['--d-crm-c' as string]: COLORES_PESTANA[i % COLORES_PESTANA.length] }}><Ico paths={t.icono} size={26} /></span>
                <h3 className="d-crm-h2-30 d-crm-grad" dangerouslySetInnerHTML={html(t.titulo)} />
                <p className="d-crm-pan-p" dangerouslySetInnerHTML={html(t.texto)} />
              </div>
            ))}
            <BotonOscuro />
          </div>
          <div className="d-crm-panel-vis"><Visual spec={FEATURE_VISUALS.crm?.groups?.[1]} /></div>
        </div>
      </div>
    </section>
  );
}

function Principios({ b }: { b: Tarjetas }) {
  return (
    <section className="d-crm-sec d-crm-sec-caja">
      <div className="d-crm-principios">
        <h2 className="d-crm-principios-h" dangerouslySetInnerHTML={html(b.titulo)} />
        <div className="d-crm-principios-cols">
          {b.items.map((t: Item) => (
            <div key={t.titulo} className="d-crm-principio">
              <p className="d-crm-principio-t" dangerouslySetInnerHTML={html(t.titulo)} />
              <p className="d-crm-principio-x" dangerouslySetInnerHTML={html(t.texto)} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Incluye({ b }: { b: Tarjetas }) {
  return (
    <section className="d-crm-sec d-crm-sec-caja">
      <div className="d-crm-incluye">
        <h2 className="d-crm-h2-40 d-crm-grad-claro d-crm-centro" dangerouslySetInnerHTML={html(b.titulo)} />
        <ul className="d-crm-incluye-grilla">
          {b.items.map((t: TarjetaItem) => (
            <li key={t.titulo} className="d-crm-incluye-i">
              <span className="d-crm-incluye-ic"><Ico paths={t.icono} size={22} /></span>
              <span className="d-crm-incluye-t" dangerouslySetInnerHTML={html(t.titulo)} />
              <span className="d-crm-incluye-x" dangerouslySetInnerHTML={html(t.texto)} />
            </li>
          ))}
        </ul>
        <div className="d-crm-centro"><BotonOscuro claro /></div>
      </div>
    </section>
  );
}

function BloqueTarjetas({ b, i }: { b: Tarjetas; i: number }) {
  // El orden de crm.ts: el ciclo (pestañas), los principios (la caja oscura) y lo que incluye (la caja con el degradado).
  if (i === 0) return <Ciclo b={b} />;
  if (i === 1) return <Principios b={b} />;
  return <Incluye b={b} />;
}

function Autor() {
  return (
    <span className="d-crm-autor">
      <span className="d-crm-autor-av" aria-hidden="true">M</span>
      <span className="d-crm-autor-n">{CASO.quien}</span>
    </span>
  );
}

/** «Discover More Success Stories!» con el caso de Mauricio: la sección oscura, la fila de tarjetas y la caja del cierre. */
function Caso() {
  const max = Math.max(...CASO.meses.map((m) => Number(m.monto.replace(/[^0-9]/g, ''))));
  return (
    <>
      <section className="d-crm-casos">
        <div className="d-crm-cont">
          <h2 className="d-crm-h2-40 d-crm-grad-claro d-crm-centro" dangerouslySetInnerHTML={html(CASO.titulo)} />
          <div className="d-crm-casos-fila">
            <div className="d-crm-caso-borde">
              <div className="d-crm-caso d-crm-caso-video">
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video muted autoPlay loop playsInline preload="metadata"><source src={CASO.video} type="video/mp4" /></video>
                <div className="d-crm-caso-pie"><Autor /><span className="d-crm-caso-rol">{CASO.rol}</span></div>
              </div>
            </div>
            {[...CASO.historia, CASO.resultado].map((t) => (
              <div key={t} className="d-crm-caso-borde">
                <div className="d-crm-caso">
                  <p className="d-crm-caso-x" dangerouslySetInnerHTML={html(t)} />
                  <Autor />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <div className="d-crm-cierre-banda">
        <div className="d-crm-cierre">
          <div className="d-crm-cierre-txt">
            <h2 className="d-crm-h2-40 d-crm-grad">{CASO.sub}</h2>
            <BotonOscuro />
          </div>
          <div className="d-crm-cierre-vis" aria-label="Lo que vendió Mauricio, mes a mes">
            {CASO.meses.map((m) => (
              <div key={m.mes} className="d-crm-mes">
                <span className="d-crm-mes-v">{m.monto}</span>
                <span className="d-crm-mes-barra" style={{ height: `${Math.round((Number(m.monto.replace(/[^0-9]/g, '')) / max) * 100)}%` }} />
                <span className="d-crm-mes-l">{m.mes}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function Pie({ slug }: { slug: string }) {
  const otras = otrasFunciones(slug);
  const porColumna = Math.ceil(otras.length / 3);
  const columnas = [0, 1, 2].map((c) => otras.slice(c * porColumna, (c + 1) * porColumna));
  return (
    <footer className="d-crm-pie">
      <div className="d-crm-pie-cols">
        {columnas.map((col, i) => (
          <nav key={i} className="d-crm-pie-col" aria-label={i === 0 ? 'Funciones de MaKo' : undefined}>
            <p className="d-crm-pie-h">{i === 0 ? 'Funciones de MaKo' : '\u00a0'}</p>
            {col.map((f) => <a key={f.href} href={f.href} className="d-crm-pie-a">{f.nombre}</a>)}
          </nav>
        ))}
        <div className="d-crm-pie-col">
          <p className="d-crm-pie-h">Contacto</p>
          <a href={RUTA_CTA} className="d-crm-pie-a">{TEXTO_CTA}</a>
        </div>
      </div>
      <div className="d-crm-pie-base">
        <p>© 2026 MaKo</p>
        <p><a href="/privacidad">Privacidad</a> | <a href="/terminos">Términos</a></p>
      </div>
    </footer>
  );
}

export default function DisenoCrm({ landing }: PropsDiseno) {
  const bloques = landing.bloques;
  let nTarjetas = 0;
  const hero = bloques.find((b) => b.tipo === 'hero');
  return (
    <div className="d-crm">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="d-crm-arriba">
        <header className="d-crm-barra">
          <div className="d-crm-barra-in">
            <LogoMaKo className="d-crm-logo" tamano={34} claro />
            <div className="d-crm-barra-btns">
              <a href="/login" className="d-crm-btn-login">Entrar</a>
              <a href={RUTA_CTA} className="d-crm-btn-barra">{TEXTO_CTA}</a>
            </div>
          </div>
        </header>
        <div className="d-crm-hero">
          {hero && hero.tipo === 'hero' ? <Hero b={hero} /> : null}
        </div>
      </div>
      {bloques.map((b, i) => {
        switch (b.tipo) {
          case 'hero': return null;
          case 'cifras': return <Cifras key={i} b={b} />;
          case 'tarjetas': return <BloqueTarjetas key={i} b={b} i={nTarjetas++} />;
          case 'caso': return <Caso key={i} />;
          default: return null;
        }
      })}
      <Pie slug={landing.slug} />
    </div>
  );
}

// Los valores, de getComputedStyle sobre https://www.gohighlevel.com/ a 1440 y 390 (docs/diseno/landings-competencia/crm.md).
const CSS = `
@font-face { font-family: 'Poppins'; font-style: normal; font-weight: 400; font-display: swap; src: url('/vsl-assets/fuentes/poppins/poppins-400.woff2') format('woff2'); }
@font-face { font-family: 'Poppins'; font-style: normal; font-weight: 600; font-display: swap; src: url('/vsl-assets/fuentes/poppins/poppins-600.woff2') format('woff2'); }
@font-face { font-family: 'Poppins'; font-style: normal; font-weight: 700; font-display: swap; src: url('/vsl-assets/fuentes/poppins/poppins-700.woff2') format('woff2'); }

.d-crm { background: #fff; color: #000; font-family: 'Poppins', Arial, sans-serif; font-size: 16px; line-height: 1.3; -webkit-font-smoothing: antialiased; overflow-x: clip; }
.d-crm *, .d-crm *::before, .d-crm *::after { box-sizing: border-box; }
.d-crm a { color: inherit; }
.d-crm-cont { width: 100%; max-width: 1170px; margin: 0 auto; padding: 0 10px; }
.d-crm-centro { text-align: center; }
.d-crm-grad { background-image: linear-gradient(90deg, #03101D 0.13%, #958D8D 109.5%); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: #03101D; }
.d-crm-grad-claro { background-image: linear-gradient(90deg, #FFFFFF 0.13%, #958D8D 109.5%); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: #fff; }
.d-crm-h2-40 { margin: 0; font-size: 40px; line-height: 52px; font-weight: 700; }
.d-crm-h2-30 { margin: 0; font-size: 30px; line-height: 39px; font-weight: 700; }
.d-crm-sub { margin: 10px auto 0; font-size: 16px; line-height: 20.8px; color: #575757; max-width: 760px; }
.d-crm-sub strong, .d-crm-pan-p strong { color: #03101D; font-weight: 600; }

/* La barra: #03101C, 146 de alto, el logo a la izquierda y dos botones de 40 de alto, radio 10. */
.d-crm-barra { background: #03101C; padding: 50px 0 0; height: 146px; }
.d-crm-barra-in { max-width: 1170px; margin: 0 auto; padding: 0 20px 0 10px; display: flex; align-items: center; justify-content: space-between; gap: 16px; height: 40px; }
.d-crm-logo span:last-child { font-family: 'Poppins', Arial, sans-serif; }
.d-crm-barra-btns { display: flex; gap: 20px; }
.d-crm-btn-login, .d-crm-btn-barra { display: inline-flex; align-items: center; height: 40px; border-radius: 10px; font-size: 14px; font-weight: 600; text-decoration: none; transition: .3s cubic-bezier(0.4, 0, 0.2, 1); }
.d-crm-btn-login { padding: 10px 32px; color: #fff !important; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.19); }
.d-crm-btn-barra { padding: 10px 20px; color: #fff !important; background: #2F6FED; border: 1px solid #2F6FED; }
.d-crm-btn-login:hover, .d-crm-btn-barra:hover, .d-crm-btn-hero:hover { transform: translateY(-2px); box-shadow: rgba(47,111,237,.19) 0 20px 25px -5px, rgba(47,111,237,.19) 0 10px 10px -5px; }

/* El hero: el degradado de 0deg que baja del azul noche al celeste y se apaga en blanco (azules pasados a los de MaKo). */
.d-crm-hero { background-image: linear-gradient(0deg, rgba(255,255,255,0) 11.84%, #A9C4F8 27.88%, #2F6FED 36.97%, #1F57C8 47.01%, #01264C 56.81%, #01162A 69.88%, #03101D 76.79%); padding: 10px 0 230px; }
.d-crm-hero-fila { display: flex; align-items: center; margin-top: 40px; padding: 10px 0 10px 5px; min-height: 612px; }
.d-crm-hero-txt { flex: 0 0 50%; padding: 10px 60px 10px max(20px, calc((100vw - 1170px) / 2)); display: flex; flex-direction: column; align-items: flex-start; }
.d-crm-pill { margin: 0 0 20px; display: inline-flex; align-items: center; position: relative; padding: 10px 20px 10px 40px; border-radius: 75px; border: 1px solid #8DE1FF; background: rgba(250,250,250,.07); color: #fff; font-size: 14px; font-weight: 500; line-height: 18.2px; }
.d-crm-pill-ic { position: absolute; left: 16px; top: 50%; transform: translateY(-50%); display: flex; }
.d-crm-h1 { margin: 0 0 20px; font-size: 48px; line-height: 57.6px; font-weight: 700; color: #fff; }
.d-crm-hero-p { margin: 0; font-size: 16px; line-height: 20.8px; color: #fff; }
.d-crm-hero-p strong { font-weight: 600; }
/* Los botones van fijos en los dos modos (data-tema-fijo): azul de MaKo con letra blanca y en UNA línea. En oscuro, el degradado
   azul → blanco con letra oscura quedaba azul sobre azul (el Cerebro, 14/11/2026). */
.d-crm-btn-hero { margin: 20px 0; display: inline-flex; align-items: center; gap: 18px; padding: 10px 10px 10px 20px; border-radius: 10px; background: #2F6FED; color: #fff !important; white-space: nowrap; font-size: 15px; font-weight: 600; text-decoration: none; transition: .3s cubic-bezier(0.4, 0, 0.2, 1); }
.d-crm-btn-hero-ic { width: 24px; height: 24px; border-radius: 5px; background: rgba(255,255,255,.2); color: #fff; display: inline-flex; align-items: center; justify-content: center; }
.d-crm-hero-media { flex: 1 1 50%; align-self: stretch; display: flex; align-items: center; min-width: 0; }
.d-crm-hero-media .mk-vsl-slot { position: relative; aspect-ratio: 16 / 9; width: 100%; }
.d-crm-hero-media .mk-vsl { position: absolute; inset: 0; border-radius: 15px 0 0 15px; overflow: hidden; background: #0B0D12; box-shadow: 0 30px 70px -32px rgba(0,0,0,.6); }
.d-crm-hero-media .mk-vsl iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; display: block; }
.d-crm-hero-media .mk-cor, .d-crm-hero-media .mk-vsl-x { display: none; }

/* Los contadores: tarjetas de 124 de alto, fondo blanco al 31 %, radio 15, sombra 0 0 5px, número de 30 con degradado. */
.d-crm-contadores { position: relative; max-width: 1170px; margin: -160px auto 0; padding: 0 10px; display: flex; gap: 25px; }
.d-crm-contador { flex: 1 1 0; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px 16px; min-height: 124px; border-radius: 15px; background: rgba(255,255,255,.31); box-shadow: rgba(0,0,0,.25) 0 0 5.08px 0; text-align: center; }
.d-crm-contador-v { font-size: 30px; line-height: 36px; font-weight: 700; }
/* Las cifras, fijas: oscuras en el claro y blancas en el oscuro (con el degradado de la referencia, en oscuro casi no se leían). */
html[data-sitio-modo="oscuro"] .d-crm-contador-v { background-image: linear-gradient(90deg, #FFFFFF 0%, #AFC6F7 110%); color: #fff; }
/* En oscuro la tarjeta blanca al 31 % cae sobre el brillo azul del hero: letra blanca sobre celeste. Vidrio oscuro (14/11). */
html[data-sitio-modo="oscuro"] .d-crm-contador { background: rgba(6,12,30,.62); box-shadow: inset 0 0 0 1px rgba(255,255,255,.14); }
.d-crm-contador-l { margin-top: 8px; font-size: 14px; line-height: 1.2; color: #03101C; text-transform: uppercase; }

/* Secciones */
.d-crm-sec { padding: 20px 10px 60px; }
.d-crm-sec-cifras { padding: 85px 10px 60px; }
.d-crm-sec-cifras h2 { max-width: 1150px; margin: 0 auto; }
.d-crm-sec-ciclo { padding: 40px 10px 100px; }
.d-crm-enc-ciclo { max-width: 565px; margin: 0 auto; padding: 10px 0; }
.d-crm-enc-ciclo .d-crm-sub { max-width: 565px; }

/* Las pestañas del ciclo: 140×34, gris, radio 5; la activa, con el degradado y el brillo de su color. */
.d-crm-tabs { max-width: 1170px; margin: 0 auto; }
.d-crm-radio { position: absolute; opacity: 0; width: 1px; height: 1px; pointer-events: none; }
.d-crm-pills { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px 20px; margin: 40px 0 40px; }
.d-crm-pill-tab { position: relative; width: 140px; height: 34px; display: inline-flex; align-items: center; justify-content: center; border-radius: 5px; background: rgba(237,237,237,.53); border: 1px solid rgba(212,212,212,.38); color: #03101D; font-size: 14px; font-weight: 600; cursor: pointer; transition: .4s; }
.d-crm-pill-tab span { position: relative; z-index: 1; }
.d-crm-pill-tab::before { content: ''; position: absolute; inset: -1px; border-radius: 5px; border: 1px solid var(--d-crm-c); background-image: linear-gradient(89deg, var(--d-crm-c) -17.03%, #FFFFFF 119.64%); box-shadow: 0 0 30px 0 color-mix(in srgb, var(--d-crm-c) 60%, transparent); opacity: 0; transition: opacity .4s; }
.d-crm-pill-tab:hover::before { opacity: 1; }
.d-crm-pan { display: none; }
${[0, 1, 2, 3, 4, 5].map((i) => `#d-crm-t${i}:checked ~ .d-crm-pills .d-crm-pill-tab-${i}::before { opacity: 1; }
#d-crm-t${i}:checked ~ .d-crm-panel .d-crm-pan-${i} { display: block; animation: dCrmEntra .4s ease both; }
#d-crm-t${i}:focus-visible ~ .d-crm-pills .d-crm-pill-tab-${i} { outline: 2px solid #2F6FED; outline-offset: 3px; }`).join('\n')}
@keyframes dCrmEntra { from { opacity: .4; transform: translateY(6px); } to { opacity: 1; transform: none; } }

/* El panel: caja #F6F6F6 de 1170, radio 25, borde 1px, 20px 40px; texto a la izquierda y el visual a la derecha. */
.d-crm-panel { display: grid; grid-template-columns: 529px 1fr; gap: 30px; align-items: start; padding: 20px 40px; min-height: 543px; border-radius: 25px; background: #F6F6F6; border: 1px solid rgba(201,201,201,.23); }
.d-crm-panel-txt { padding: 10px 0 10px 10px; }
.d-crm-pan-ic { width: 50px; height: 50px; border-radius: 12px; display: flex; align-items: center; justify-content: center; margin-bottom: 10px; color: #03101D; background: color-mix(in srgb, var(--d-crm-c) 28%, #fff); }
.d-crm-pan h3 { margin-bottom: 20px; }
.d-crm-pan-p { margin: 0; font-size: 16px; line-height: 20.8px; color: #575757; max-width: 519px; }
.d-crm-panel-txt .d-crm-btn { margin-top: 40px; }
.d-crm-panel-vis { align-self: center; border-radius: 14px; overflow: hidden; background: #fff; }

/* Los botones de bloque: 52 de alto, 16px 40px, radio 10, 15px 500. El oscuro brilla al pasar el mouse. */
.d-crm-btn { position: relative; overflow: hidden; display: inline-flex; align-items: center; justify-content: center; height: 52px; padding: 16px 32px; white-space: nowrap; border-radius: 10px; font-size: 15px; font-weight: 600; text-decoration: none; transition: all .3s; }
.d-crm-btn-oscuro { background: #2F6FED; border: 1px solid #2F6FED; color: #fff !important; }
.d-crm-btn-oscuro::after { content: ''; position: absolute; top: 0; bottom: 0; left: -60%; width: 40%; background: linear-gradient(120deg, rgba(255,255,255,0), rgba(255,255,255,.65), rgba(255,255,255,0)); transform: skewX(-20deg); transition: left .6s; }
.d-crm-btn-oscuro:hover { box-shadow: rgba(107,178,255,.47) 0 0 10px 2px; }
.d-crm-btn-oscuro:hover::after { left: 130%; }
.d-crm-btn-claro { background: #fff; border: 1px solid #011D38; color: #021221 !important; }
.d-crm-btn-claro:hover { box-shadow: rgba(107,178,255,.47) 0 0 10px 2px; }

/* Los principios: caja de 1170, radio 50, borde rgba(201,201,201,.6), 60px 40px; título blanco de 30 (600), tres columnas. */
.d-crm-sec-caja { padding: 20px 10px 60px; }
.d-crm-principios { max-width: 1170px; margin: 0 auto; padding: 60px 40px; border-radius: 50px; border: 1px solid rgba(201,201,201,.6); background: radial-gradient(120% 90% at 50% 0%, #01264C 0%, #03101D 70%); color: #fff; }
.d-crm-principios-h { margin: 21px auto 30px; max-width: 1038px; text-align: center; font-size: 30px; line-height: 39px; font-weight: 600; }
.d-crm-principios-cols { display: grid; grid-template-columns: repeat(3, 267px); justify-content: space-between; max-width: 1028px; margin: 0 auto; }
.d-crm-principio-t { margin: 0 0 9px; font-size: 16px; line-height: 20.8px; font-weight: 600; text-transform: uppercase; }
.d-crm-principio-x { margin: 0; font-size: 15px; line-height: 19.5px; }
.d-crm-principio-x strong { font-weight: 600; }

/* Lo que incluye: caja de 1170 con el degradado radial desde la esquina (blanco, celeste, azul, noche), radio 25. */
.d-crm-incluye { max-width: 1170px; margin: 0 auto; padding: 40px 20px 60px; border-radius: 25px; background-image: radial-gradient(1154px 232px at -72px -156px, #FFFFFF 36.98%, #C9DAFB 50.43%, #2F6FED 65.68%, #1F57C8 76.55%, #01264C 88.57%, #03101D 100%); }
.d-crm-incluye h2 { padding: 21px 0 0; }
.d-crm-incluye-grilla { list-style: none; margin: 40px auto 48px; padding: 0; max-width: 894px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 30px 30px; }
.d-crm-incluye-i { display: flex; flex-direction: column; gap: 6px; color: #fff; }
.d-crm-incluye-ic { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.19); margin-bottom: 6px; }
.d-crm-incluye-t { font-size: 16px; line-height: 20.8px; font-weight: 600; }
.d-crm-incluye-x { font-size: 15px; line-height: 19.5px; color: rgba(255,255,255,.75); }

/* Los casos: banda #03101D con 300 abajo; tarjetas de 265 con borde blanco al 20 %, radio 20 y el degradado a negro. */
.d-crm-casos { background: #03101D; padding: 50px 0 360px; color: #fff; }
.d-crm-casos h2 { max-width: 1150px; margin: 0 auto; }
.d-crm-casos-fila { display: grid; grid-template-columns: repeat(4, 265px); justify-content: space-between; max-width: 1150px; margin: 90px auto 0; }
.d-crm-caso-borde { border-radius: 20px; padding: 1px; background-image: linear-gradient(rgba(0,0,0,0) 0%, rgba(135,136,138,.58) 100%); }
.d-crm-caso { position: relative; height: 100%; min-height: 268px; display: flex; flex-direction: column; justify-content: space-between; gap: 20px; padding: 30px; border-radius: 20px; border: 1px solid rgba(255,255,255,.2); background-image: linear-gradient(rgba(0,0,0,0) 0%, #000 100%); box-shadow: rgba(0,0,0,.1) 0 4px 6px 0; transition: transform .2s, box-shadow .2s; overflow: hidden; }
.d-crm-caso:hover { transform: translateY(-4px); }
.d-crm-caso-x { margin: 0; font-size: 15px; line-height: 24px; color: #fff; }
.d-crm-caso-x strong { font-weight: 600; }
.d-crm-autor { display: inline-flex; align-items: center; gap: 16px; }
.d-crm-autor-av { width: 60px; height: 60px; flex: none; border-radius: 50%; border: 2px solid #E5E7EB; background: #2F6FED; color: #fff; display: inline-flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 700; }
.d-crm-autor-n { font-size: 14px; font-weight: 600; color: #fff; }
.d-crm-caso-video { justify-content: flex-end; padding: 0; }
.d-crm-caso-video video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.d-crm-caso-video::after { content: ''; position: absolute; inset: 0; background-image: linear-gradient(rgba(0,0,0,0) 40%, #000 100%); }
.d-crm-caso-pie { position: relative; z-index: 1; padding: 30px; display: flex; flex-direction: column; gap: 10px; }
.d-crm-caso-rol { font-size: 13px; line-height: 16.9px; color: rgba(255,255,255,.75); }

/* La caja del cierre, montada sobre el final de la banda oscura (1170, radio 25, 40px 0 0 40px). */
.d-crm-cierre-banda { display: flow-root; background: #F9FBFC; padding: 0 10px 60px; }
.d-crm-cierre { position: relative; max-width: 1170px; margin: -300px auto 0; min-height: 340px; padding: 40px 40px 0 40px; border-radius: 25px; display: grid; grid-template-columns: 449px 1fr; gap: 40px; background: linear-gradient(180deg, #FFFFFF 0%, #EAF1FE 100%); box-shadow: rgba(107,178,255,.12) 0 3px 34px 0; }
.d-crm-cierre-txt { padding: 10px 0 40px; }
.d-crm-cierre-txt .d-crm-btn { margin-top: 40px; }
.d-crm-cierre-vis { display: flex; align-items: flex-end; justify-content: center; gap: 28px; height: 300px; padding: 0 20px; }
.d-crm-mes { display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 8px; height: 100%; width: 96px; }
.d-crm-mes-v { font-size: 22px; font-weight: 700; color: #03101D; }
.d-crm-mes-barra { width: 100%; max-height: 210px; border-radius: 12px 12px 0 0; background: linear-gradient(180deg, #2F6FED, #1F57C8); }
.d-crm-mes:last-child .d-crm-mes-barra { background: linear-gradient(180deg, #F2B01E, #E09A0B); }
.d-crm-mes-l { font-size: 14px; color: #575757; padding-bottom: 14px; }

/* El pie: #07223D, cuatro columnas con su título de 17 en mayúsculas, links de 15 cada 29, la raya blanca de 2 y el © al centro. */
.d-crm-pie { background: #07223D; color: #fff; padding: 32px 20px 0; }
.d-crm-pie-cols { max-width: 1150px; margin: 0 auto; padding: 25px 5px 40px; display: grid; grid-template-columns: 321px 299px 289px 1fr; }
.d-crm-pie-col { display: flex; flex-direction: column; align-items: flex-start; }
.d-crm-pie-h { margin: 0 0 21px; font-size: 17px; line-height: 22.1px; font-weight: 400; text-transform: uppercase; min-height: 22px; }
.d-crm-pie-a { font-size: 15px; line-height: 19.5px; padding: 5px 0; text-decoration: none; }
.d-crm-pie-a:hover { text-decoration: underline; }
.d-crm-pie-base { max-width: 1170px; margin: 0 auto; border-top: 2px solid #fff; padding: 15px 0 5px; text-align: center; font-size: 13px; line-height: 16.9px; }
.d-crm-pie-base p { margin: 48px 0 10px; }
.d-crm-pie-base p + p { margin: 0 0 26px; }
.d-crm-pie-base a { text-decoration: none; }

@media (max-width: 1190px) {
  .d-crm-panel { grid-template-columns: 1fr 1fr; }
  .d-crm-casos-fila { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 30px; }
  .d-crm-principios-cols { grid-template-columns: repeat(3, 1fr); gap: 30px; }
}

/* 390: lo que medimos en su versión de teléfono. */
@media (max-width: 767px) {
  .d-crm-barra { padding: 10px; height: 102px; }
  .d-crm-barra-in { padding: 20px 10px 0; height: auto; }
  .d-crm-barra-btns { display: none; }
  .d-crm-hero { padding: 10px 10px 360px; }
  .d-crm-hero-fila { flex-direction: column; margin-top: 10px; padding: 10px 0; min-height: 0; }
  .d-crm-hero-txt { flex: none; width: 100%; padding: 10px 10px; align-items: center; text-align: center; }
  .d-crm-h1 { font-size: 32px; line-height: 38.4px; }
  .d-crm-btn-hero { margin: 40px 0 20px; }
  .d-crm-hero-media { width: 100%; padding: 20px 0 0; }
  .d-crm-hero-media .mk-vsl { border-radius: 15px; }
  .d-crm-contadores { margin-top: -300px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px 20px; padding: 0 10px; }
  .d-crm-contador { padding: 6px; min-height: 68px; border-radius: 4px; }
  .d-crm-contador-l { font-size: 11px; margin-top: 2px; }
  .d-crm-contador:last-child:nth-child(odd) { grid-column: 1 / -1; }
  .d-crm-sec-cifras { padding: 80px 20px 60px; }
  .d-crm-sec-cifras .d-crm-h2-30 { font-size: 28px; line-height: 36.4px; }
  .d-crm-h2-40 { font-size: 30px; line-height: 39px; }
  .d-crm-sec { padding: 20px 10px 60px; }
  .d-crm-pills { display: grid; grid-template-columns: repeat(2, 140px); justify-content: center; gap: 10px 20px; margin: 40px 0 50px; }
  .d-crm-pill-tab { font-size: 15px; }
  .d-crm-pill-tab:last-child:nth-child(odd) { grid-column: 1 / -1; justify-self: center; }
  .d-crm-panel { grid-template-columns: 1fr; padding: 20px 10px; gap: 20px; }
  .d-crm-panel-txt { padding: 70px 11px 0; }
  .d-crm-panel-txt .d-crm-btn { margin: 40px auto 0; display: flex; width: 263px; }
  .d-crm-principios { padding: 20px 10px 40px; }
  .d-crm-principios-h { font-size: 22px; line-height: 28.6px; margin: 21px 20px 30px; }
  .d-crm-principios-cols { grid-template-columns: 1fr; gap: 20px; padding: 0 10px; }
  .d-crm-incluye { padding: 30px 10px 40px; }
  .d-crm-incluye-grilla { grid-template-columns: 1fr; gap: 24px; margin: 30px 10px 36px; }
  .d-crm-casos { padding: 40px 0 300px; }
  .d-crm-casos-fila { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; gap: 20px; margin-top: 40px; padding-bottom: 20px; }
  .d-crm-caso-borde { flex: 0 0 100%; scroll-snap-align: center; }
  .d-crm-caso { min-height: 244px; }
  .d-crm-cierre { grid-template-columns: minmax(0, 1fr); padding: 20px 20px 0; gap: 10px; }
  .d-crm-mes { flex: 1 1 0; width: auto; max-width: 96px; }
  .d-crm-cierre-vis { gap: 16px; padding: 0; }
  .d-crm-cierre .d-crm-h2-40 { font-size: 40px; line-height: 52px; }
  .d-crm-cierre-txt { padding: 0 0 10px; }
  .d-crm-cierre-vis { height: 220px; }
  .d-crm-pie { padding: 32px 20px 0; }
  .d-crm-pie-cols { grid-template-columns: 1fr; gap: 0; padding: 0 0 30px; }
  .d-crm-pie-col { margin-bottom: 30px; }
  .d-crm-pie-col:nth-child(2) .d-crm-pie-h, .d-crm-pie-col:nth-child(3) .d-crm-pie-h { display: none; }
  .d-crm-pie-col:nth-child(2), .d-crm-pie-col:nth-child(3) { margin-top: -30px; }
}

@media (prefers-reduced-motion: reduce) {
  .d-crm *, .d-crm *::before, .d-crm *::after { animation: none !important; transition: none !important; }
}
`;
