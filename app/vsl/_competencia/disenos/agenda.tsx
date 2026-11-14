// =============================================================================
// /vsl/agenda con el DISEÑO de la portada de iClosed (https://www.iclosed.io/), copiado el 11/11/2026
// =============================================================================
// La página entera es la de iClosed: la barra blanca con el botón azul, el hero en dos columnas enmarcado por las líneas
// grises de los costados, con la demo sobre su caja celeste; el titular centrado con su segunda línea en azul y la fila de
// pestañas de borde a borde con su panel blanco sobre gris; la banda azul noche con el texto a la izquierda, la demo a la
// derecha y las tres tarjetas «01 / 02 / 03»; la grilla de tarjetas con degradado celeste (tres arriba, dos abajo); la
// ventana grande sobre el degradado; la prueba con sus tarjetas y la tarjeta oscura de cifras; la banda final oscura con el
// botón blanco y el pie azul noche. Los valores (Poppins + Inter, escala, colores, contenedores, espacios, radios,
// sombras) se midieron con getComputedStyle a 1440 y a 390 px y viven en docs/diseno/landings-competencia/agenda.md.
//
// De MaKo: el logo, el azul #2F6FED donde iClosed pone su azul (#0236C2 en los botones, #1C64F2 en las palabras
// resaltadas), el celeste de sus títulos sobre oscuro queda, el botón de la llamada donde iClosed pone «Start for free»,
// el caso de Mauricio en «Proof, in their own words» y «The lift, measured in cold dollars» (su video de fondo en la
// tarjeta oscura), y el resto de las funciones en las columnas del pie. La banda final lleva el texto de la banda de la
// llamada de todas las landings de /vsl («¿Lo quieres funcionando en tu negocio?»).
// Lo que se sacó (no tiene contenido real de MaKo): la barra negra del anuncio, sus tres citas con foto y su fila de logos
// de clientes, «You already follow them» (sus creadores), «Coaches, agencies, creators», «Drops into the stack you already
// have», «Build on iClosed», «Book a 5-min demo», las estrellas, el G2, el «7-day free trial», el lema «Same traffic. More
// profit.» entre las tarjetas y el carrusel de casos (va una sola tarjeta, la de Mauricio). Las fotos de cielo de sus demos
// son, acá, un degradado azul.
// Server component sin JavaScript: las pestañas son radios con :checked, el menú del teléfono es un <details>, las
// animaciones son CSS (se apagan con «reducir movimiento»).
// =============================================================================

import type { PropsDiseno } from '.';
import type { Bloque } from '../tipos';
import { RUTA_CTA, CASO, LogoMaKo, TEXTO_CTA, html, otrasFunciones, TEXTO_CIERRE } from '../marca';
import { VisualDeLanding } from '../Visuales';

const c = (n: string) => `d-agenda-${n}`;
type Tarjetas = Extract<Bloque, { tipo: 'tarjetas' }>;

function Icono({ d, size = 20, grosor = 1.8 }: { d: string[]; size?: number; grosor?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={grosor} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d.map((p) => <path key={p} d={p} />)}
    </svg>
  );
}

/** La «demo» de una tarjeta o una pestaña: el ícono de la pieza en su tarjetita blanca (iClosed pone ahí una captura suya). */
function DemoIcono({ d }: { d: string[] }) {
  return <div className={c('dico')}><span className={c('dico-ic')}><Icono d={d} size={26} grosor={1.7} /></span></div>;
}

function BotonAzul({ grande = true }: { grande?: boolean }) {
  return <a href={RUTA_CTA} className={`${c('btn-az')}${grande ? '' : ` ${c('btn-az-ch')}`}`}>{TEXTO_CTA} <span aria-hidden="true">→</span></a>;
}

function Barra({ links }: { links: { href: string; t: string }[] }) {
  return (
    <header className={c('barra')}>
      <div className={c('barra-in')}>
        <LogoMaKo className={c('logo')} tamano={26} />
        <nav className={c('nav')} aria-label="Secciones">
          {links.map((l) => <a key={l.href} href={l.href}>{l.t}</a>)}
        </nav>
        <div className={c('barra-der')}>
          <a href="/login" className={c('login')}>Iniciar sesión</a>
          <a href={RUTA_CTA} className={c('btn-barra')}>{TEXTO_CTA}</a>
        </div>
        <details className={c('menu')}>
          <summary aria-label="Menú"><Icono d={['M4 7h16', 'M4 12h16', 'M4 17h16']} size={22} grosor={2} /></summary>
          <div className={c('menu-panel')}>
            {links.map((l) => <a key={l.href} href={l.href}>{l.t}</a>)}
            <a href="/login">Iniciar sesión</a>
          </div>
        </details>
      </div>
    </header>
  );
}

function Hero({ b }: { b: Extract<Bloque, { tipo: 'hero' }> }) {
  return (
    <section className={c('hero')}>
      <div className={c('hero-marco')}>
        <div className={c('hero-txt')}>
          <p className={c('hero-etq')}>{b.etiqueta}</p>
          <h1 className={c('h1')} dangerouslySetInnerHTML={html(b.titulo)} />
          <p className={c('hero-p')} dangerouslySetInnerHTML={html(b.bajada)} />
          <BotonAzul />
          {b.puntos?.length ? <p className={c('hero-chico')}>{b.puntos.join(' · ')}</p> : null}
        </div>
        <div className={c('hero-demo')}>
          <div className={c('hero-demo-in')}><VisualDeLanding visual={b.visual} /></div>
        </div>
      </div>
    </section>
  );
}

/** «Keep the same funnels…»: el titular, la fila de pestañas de borde a borde y el panel blanco sobre gris. */
function Pestanas({ b, icono }: { b: Tarjetas; icono: string[] }) {
  const n = c('tab');
  return (
    <section className={c('tabs')} id={c('embudo')}>
      <div className={c('enc')}>
        <h2 className={c('h2')} dangerouslySetInnerHTML={html(b.titulo)} />
        {b.bajada ? <p className={c('enc-p')} dangerouslySetInnerHTML={html(b.bajada)} /> : null}
      </div>
      <div className={c('tabs-caja')}>
        {b.items.map((_, i) => (
          <input key={i} type="radio" name={n} id={`${n}-${i}`} className={`${c('tab-in')} ${c(`tab-in-${i}`)}`} defaultChecked={i === 0} />
        ))}
        <div className={c('tab-fila')} style={{ gridTemplateColumns: `repeat(${b.items.length}, minmax(0, 1fr))` }}>
          {b.items.map((t, i) => <label key={t.titulo} htmlFor={`${n}-${i}`} className={`${c('tab-l')} ${c(`tab-l-${i}`)}`} dangerouslySetInnerHTML={html(t.titulo)} />)}
        </div>
        <div className={c('tab-area')}>
          {b.items.map((t, i) => (
            <div key={t.titulo} className={`${c('panel')} ${c(`panel-${i}`)}`}>
              <div className={c('panel-txt')}>
                <h3 className={c('panel-h3')} dangerouslySetInnerHTML={html(t.titulo)} />
                <p className={c('panel-p')} dangerouslySetInnerHTML={html(t.texto)} />
              </div>
              <div className={c('panel-demo')}><DemoIcono d={t.icono ?? icono} /></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** La banda azul noche: texto a la izquierda, demo a la derecha, y las tres tarjetas numeradas. */
function Oscura({ b, visual }: { b: Extract<Bloque, { tipo: 'pasos' }>; visual?: Extract<Bloque, { tipo: 'hero' }>['visual'] }) {
  return (
    <section className={c('osc')} id={c('conecta')}>
      <div className={c('osc-in')}>
        <div className={c('osc-fila')}>
          <div className={c('osc-txt')}>
            {b.etiqueta ? <p className={c('ceja-osc')}>{b.etiqueta}</p> : null}
            <h2 className={`${c('h2')} ${c('osc-h2')}`} dangerouslySetInnerHTML={html(b.titulo)} />
            {b.bajada ? <p className={c('osc-p')} dangerouslySetInnerHTML={html(b.bajada)} /> : null}
            <a href={RUTA_CTA} className={c('btn-bl')}>{TEXTO_CTA} <span aria-hidden="true">→</span></a>
          </div>
          {visual ? (
            <div className={c('osc-demo')}>
              <div className={c('osc-demo-vid')}><div className={c('osc-demo-bl')}><VisualDeLanding visual={visual} /></div></div>
            </div>
          ) : null}
        </div>
        <ol className={c('pasos')}>
          {b.pasos.map((p, i) => (
            <li key={p.titulo} className={c('paso')}>
              {i > 0 ? <span className={c('mas')} aria-hidden="true">+</span> : null}
              <span className={c('paso-n')}>{String(i + 1).padStart(2, '0')}</span>
              <h3 className={c('paso-h3')} dangerouslySetInnerHTML={html(p.titulo)} />
              <p className={c('paso-p')} dangerouslySetInnerHTML={html(p.texto)} />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** «Everything your booking page should've done all along»: tres tarjetas arriba y dos abajo, con su demo. */
function Producto({ b, icono }: { b: Tarjetas; icono: string[] }) {
  return (
    <section className={c('prod')} id={c('hace')}>
      {b.etiqueta ? <p className={c('ceja')}>{b.etiqueta}</p> : null}
      <div className={c('enc')}>
        <h2 className={c('h2')} dangerouslySetInnerHTML={html(b.titulo)} />
        {b.bajada ? <p className={c('enc-p')} dangerouslySetInnerHTML={html(b.bajada)} /> : null}
      </div>
      <div className={c('prod-grid')}>
        {b.items.map((t, i) => (
          <div key={t.titulo} className={`${c('pcard')}${b.items.length === 5 && i >= 3 ? ` ${c('pcard-ancha')}` : ''}`}>
            <div className={c('pcard-demo')}><DemoIcono d={t.icono ?? icono} /></div>
            <h3 className={c('pcard-h3')} dangerouslySetInnerHTML={html(t.titulo)} />
            <p className={c('pcard-p')} dangerouslySetInnerHTML={html(t.texto)} />
          </div>
        ))}
      </div>
      <div className={c('cta-fila')}><BotonAzul /></div>
    </section>
  );
}

/** «Your whole team, closing in one inbox»: el titular y la ventana grande sobre el degradado, partida en tres paneles. */
function Equipo({ b, icono }: { b: Tarjetas; icono: string[] }) {
  return (
    <section className={c('eq')} id={c('equipo')}>
      {b.etiqueta ? <p className={c('ceja')}>{b.etiqueta}</p> : null}
      <div className={c('enc')}>
        <h2 className={c('h2')} dangerouslySetInnerHTML={html(b.titulo)} />
        {b.bajada ? <p className={`${c('enc-p')} ${c('eq-p')}`} dangerouslySetInnerHTML={html(b.bajada)} /> : null}
      </div>
      <div className={c('eq-cielo')}>
        <div className={c('eq-vidrio')}>
          <div className={c('eq-ventana')}>
            {b.items.map((t, i) => (
              <div key={t.titulo} className={`${c('eq-panel')} ${c(`eq-panel-${i}`)}`}>
                <span className={c('eq-ic')}><Icono d={t.icono ?? icono} size={18} /></span>
                <h3 className={c('eq-h3')} dangerouslySetInnerHTML={html(t.titulo)} />
                <p className={c('eq-txt')} dangerouslySetInnerHTML={html(t.texto)} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/** «Proof, in their own words» + «The lift, measured in cold dollars», con el caso de Mauricio. */
function Caso() {
  const autor = (
    <div className={c('pr-autor')}>
      <span className={c('pr-ava')} aria-hidden="true">{CASO.quien.charAt(0)}</span>
      <span className={c('pr-quien')}><span className={c('pr-n')}>{CASO.quien}</span><span className={c('pr-r')}>{CASO.rol}</span></span>
    </div>
  );
  return (
    <section className={c('pr')} id={c('resultados')}>
      <div className={c('enc')}>
        <h2 className={`${c('h2')} ${c('pr-h2')}`} dangerouslySetInnerHTML={html(CASO.titulo)} />
        <p className={c('enc-p')}>{CASO.sub}</p>
      </div>
      <div className={c('pr-cards')}>
        {CASO.historia.map((h) => (
          <article key={h} className={c('pr-card')}>
            <p className={c('pr-q')} dangerouslySetInnerHTML={html(h)} />
            {autor}
          </article>
        ))}
      </div>
      <article className={c('lift')}>
        <video className={c('lift-vid')} muted autoPlay loop playsInline preload="metadata"><source src={CASO.video} type="video/mp4" /></video>
        <div className={c('lift-velo')} aria-hidden="true" />
        <div className={c('lift-cifras')}>
          {CASO.meses.map((m) => (
            <div key={m.mes} className={c('lift-c')}><span className={c('lift-v')}>{m.monto}</span><span className={c('lift-l')}>{m.mes}</span></div>
          ))}
        </div>
        <div className={c('lift-cita')}>
          <p className={c('lift-q')} dangerouslySetInnerHTML={html(CASO.resultado)} />
          <span className={c('lift-n')}>{CASO.quien}</span>
          <span className={c('lift-r')}>{CASO.rol}</span>
        </div>
      </article>
    </section>
  );
}

/** La banda final oscura, con el texto de la banda de la llamada de todas las landings de /vsl. */
function Cierre() {
  return (
    <section className={c('cierre')}>
      <h2 className={`${c('h2')} ${c('cierre-h2')}`}>¿Lo quieres funcionando <em>en tu negocio?</em></h2>
      <p className={c('cierre-p')}>{TEXTO_CIERRE}</p>
      <a href={RUTA_CTA} className={`${c('btn-bl')} ${c('btn-bl-glow')}`}>{TEXTO_CTA} <span aria-hidden="true">→</span></a>
    </section>
  );
}

function Pie({ slug, metaDesc }: { slug: string; metaDesc: string }) {
  const otras = otrasFunciones(slug);
  const mitad = Math.ceil(otras.length / 2);
  return (
    <footer className={c('pie')}>
      <div className={c('pie-in')}>
        <div className={c('pie-marca')}>
          <LogoMaKo className={c('pie-logo')} tamano={28} claro />
          <p className={c('pie-desc')}>{metaDesc}</p>
          <a href={RUTA_CTA} className={c('pie-btn')}>{TEXTO_CTA} <span aria-hidden="true">→</span></a>
        </div>
        <div className={c('pie-cols')}>
          <div className={c('pie-col')}>
            <p className={c('pie-h')}>Funciones</p>
            <ul>{otras.slice(0, mitad).map((o) => <li key={o.href}><a href={o.href}>{o.nombre}</a></li>)}</ul>
          </div>
          <div className={c('pie-col')}>
            <p className={c('pie-h')} aria-hidden="true">&nbsp;</p>
            <ul>{otras.slice(mitad).map((o) => <li key={o.href}><a href={o.href}>{o.nombre}</a></li>)}</ul>
          </div>
          <div className={c('pie-col')}>
            <p className={c('pie-h')}>Legal</p>
            <ul>
              <li><a href="/privacidad">Privacidad</a></li>
              <li><a href="/terminos">Términos del servicio</a></li>
              <li><a href="/aup">Política de uso aceptable</a></li>
            </ul>
          </div>
        </div>
      </div>
      <p className={c('pie-copy')}>© 2026 MaKo</p>
    </footer>
  );
}

export default function DisenoAgenda({ landing }: PropsDiseno) {
  const bloques = landing.bloques;
  const hero = bloques.find((b) => b.tipo === 'hero') as Extract<Bloque, { tipo: 'hero' }> | undefined;
  const tarjetas = bloques.filter((b): b is Tarjetas => b.tipo === 'tarjetas');
  const links: { href: string; t: string }[] = [];
  if (bloques.some((b) => b.tipo === 'pasos')) links.push({ href: `#${c('conecta')}`, t: 'Cómo se conecta' });
  if (tarjetas[1]) links.push({ href: `#${c('hace')}`, t: 'Lo que hace' });
  if (tarjetas[2]) links.push({ href: `#${c('equipo')}`, t: 'Tu equipo' });
  if (bloques.some((b) => b.tipo === 'caso')) links.push({ href: `#${c('resultados')}`, t: 'Resultados' });
  return (
    <div className={c('raiz')}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <Barra links={links} />
      <main>
        {bloques.map((b, i) => {
          switch (b.tipo) {
            case 'hero': return <Hero key={i} b={b} />;
            case 'tarjetas': {
              const k = tarjetas.indexOf(b);
              if (k === 0) return <Pestanas key={i} b={b} icono={landing.icono} />;
              if (k === 1) return <Producto key={i} b={b} icono={landing.icono} />;
              return <Equipo key={i} b={b} icono={landing.icono} />;
            }
            case 'pasos': return <Oscura key={i} b={b} visual={hero?.visual} />;
            case 'caso': return <Caso key={i} />;
            default: return null;
          }
        })}
        <Cierre />
      </main>
      <Pie slug={landing.slug} metaDesc={landing.metaDesc} />
    </div>
  );
}

// Los valores, medidos en www.iclosed.io el 11/11/2026 (docs/diseno/landings-competencia/agenda.md).
const CSS = `
@font-face{font-family:'DAg Poppins';src:url('/vsl-assets/fuentes/poppins/poppins-500.woff2') format('woff2');font-weight:500;font-style:normal;font-display:swap}
@font-face{font-family:'DAg Poppins';src:url('/vsl-assets/fuentes/poppins/poppins-600.woff2') format('woff2');font-weight:600;font-style:normal;font-display:swap}
@font-face{font-family:'DAg Inter';src:url('/vsl-assets/fuentes/inter/inter-latin-var.woff2') format('woff2');font-weight:100 900;font-style:normal;font-display:swap}
.a-raiz{--az:#2F6FED;--azo:#1F57C8;--cel:#76A9FA;--noche:#020418;--tinta:#0A0D14;--t2:#111928;--gris:#6B7280;--gris2:#4B5563;--borde:#E5E7EB;--fp:'DAg Poppins',-apple-system,BlinkMacSystemFont,sans-serif;--fi:'DAg Inter',-apple-system,BlinkMacSystemFont,sans-serif;background:#fff;color:var(--t2);font-family:var(--fi);font-size:16px;line-height:24px;-webkit-font-smoothing:antialiased;overflow-x:clip}
:where(.a-raiz) *,:where(.a-raiz) *::before,:where(.a-raiz) *::after{box-sizing:border-box}
:where(.a-raiz) a{color:inherit;text-decoration:none}
:where(.a-raiz) :where(h1,h2,h3,p,ul,ol){margin:0;padding:0}
:where(.a-raiz) :where(ul,ol){list-style:none}
:where(.a-raiz) :where(img,video){display:block}
.a-h2{font-family:var(--fp);font-size:36px;line-height:1.4;font-weight:500;letter-spacing:-.4px;color:var(--tinta);text-wrap:balance}
.a-h2 em{display:block;font-style:normal;color:var(--az)}
.a-enc{max-width:812px;margin:0 auto;padding:0 20px;text-align:center}
.a-enc-p{margin:14px auto 0;max-width:640px;font-size:18px;line-height:28px;letter-spacing:-.04px;color:var(--noche)}
.a-enc-p strong{font-weight:600}
.a-ceja{text-align:center;margin-bottom:16px;font-size:14px;line-height:20px;font-weight:500;letter-spacing:.06em;text-transform:uppercase;color:var(--az)}
.a-ceja-osc{display:flex;align-items:center;gap:10px;margin-bottom:20px;font-size:12px;line-height:16px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--cel)}
.a-ceja-osc::before{content:'';width:16px;height:1px;background:var(--cel)}
.a-btn-az{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:54px;padding:0 24px;border-radius:8px;border:1px solid var(--azo);background:var(--az);color:#fff;font-size:16px;line-height:24px;font-weight:600;letter-spacing:-.1px;box-shadow:rgba(255,255,255,.24) 0 1px 4px 1px inset,rgba(255,255,255,.2) 0 4px 16px 1px;transition:background .2s,transform .2s}
.a-btn-az:hover{background:var(--azo);transform:translateY(-1px)}
.a-btn-bl{display:inline-flex;align-items:center;gap:6px;height:44px;padding:0 20px;border-radius:8px;background:#fff;color:#04072A;font-size:15px;line-height:22.5px;font-weight:600;transition:transform .2s,box-shadow .2s}
.a-btn-bl:hover{transform:translateY(-1px)}
.a-btn-bl-glow{box-shadow:rgba(118,169,250,.45) 0 12px 40px -12px}
.a-cta-fila{text-align:center;margin-top:48px}

/* Barra */
.a-barra{position:sticky;top:0;z-index:30;background:#fff;border-bottom:1px solid #F2F2F2}
.a-barra-in{height:64px;max-width:1440px;margin:0 auto;padding:0 40px;display:flex;align-items:center;gap:24px}
.a-logo{font-family:var(--fi);flex:none}
.a-nav{flex:1;display:flex;justify-content:center;gap:2px}
.a-nav a{padding:8px 16px;font-size:14px;line-height:22px;letter-spacing:-.14px;color:#31353F;border-radius:8px;transition:color .15s,background .15s}
.a-nav a:hover{color:var(--noche);background:#F9FAFB}
.a-barra-der{display:flex;align-items:center;gap:16px;flex:none}
.a-login{padding:8px 16px;font-size:15px;line-height:24px;letter-spacing:-.15px;color:#31353F;transition:color .15s}
.a-login:hover{color:var(--noche)}
.a-btn-barra{display:inline-flex;align-items:center;height:36px;padding:0 24px;border-radius:8px;background:var(--az);color:#fff;font-size:14px;line-height:22px;letter-spacing:-.14px;transition:background .2s}
.a-btn-barra:hover{background:var(--azo)}
.a-menu{display:none;position:relative}
.a-menu summary{list-style:none;cursor:pointer;display:flex;padding:6px;color:var(--noche)}
.a-menu summary::-webkit-details-marker{display:none}
.a-menu-panel{position:absolute;right:0;top:calc(100% + 14px);width:230px;background:#fff;border:1px solid var(--borde);border-radius:8px;padding:8px;display:flex;flex-direction:column;box-shadow:0 16px 32px -16px rgba(2,4,24,.3)}
.a-menu-panel a{padding:10px 12px;font-size:15px;color:#31353F;border-radius:6px}
.a-menu-panel a:hover{background:#F9FAFB}

/* Hero */
.a-hero{background:#fff}
.a-hero-marco{position:relative;max-width:1376px;margin:0 auto;min-height:602px;padding:61px 8px 63px;border-left:1px solid var(--borde);border-right:1px solid var(--borde);border-bottom:1px solid var(--borde);display:grid;grid-template-columns:minmax(0,540px) minmax(0,660px);justify-content:space-between;align-items:start}
.a-hero-txt{padding-top:20px;animation:a-entra .8s cubic-bezier(.16,1,.3,1) both}
.a-hero-etq{margin-bottom:24px;font-size:14px;line-height:20px;font-weight:500;text-transform:uppercase;color:var(--gris)}
.a-h1{font-family:var(--fp);font-size:40px;line-height:56px;font-weight:500;letter-spacing:-.4px;color:var(--tinta)}
.a-hero-p{margin:16px 0 24px;font-size:18px;line-height:28px;font-weight:500;letter-spacing:-.4px;color:var(--gris2)}
.a-hero-p strong{font-weight:600;color:var(--tinta)}
.a-hero-chico{margin-top:16px;font-size:14px;line-height:16px;letter-spacing:-.28px;color:var(--gris)}
.a-hero-demo{height:477px;border-radius:8px;background:#EBF5FF;display:flex;align-items:center;justify-content:center;padding:32px 24px;overflow:hidden;animation:a-entra .8s cubic-bezier(.16,1,.3,1) .12s both}
.a-hero-demo-in{width:100%;max-width:560px}

/* Pestañas */
.a-tabs{padding-top:120px;background:#fff}
.a-tabs-caja{margin-top:40px}
.a-tab-in{position:absolute;opacity:0;width:1px;height:1px;pointer-events:none}
.a-tab-fila{display:grid;border-top:1px solid var(--borde);border-bottom:1px solid var(--borde)}
.a-tab-l{display:flex;align-items:center;justify-content:center;height:55px;padding:0 16px;text-align:center;font-size:14px;line-height:20px;font-weight:500;letter-spacing:-.084px;color:#737373;cursor:pointer;border-right:1px solid var(--borde);transition:color .2s,background .2s}
.a-tab-l:last-child{border-right:0}
.a-tab-l:hover{color:#000}
.a-tab-in-0:checked ~ .a-tab-fila .a-tab-l-0,.a-tab-in-1:checked ~ .a-tab-fila .a-tab-l-1,.a-tab-in-2:checked ~ .a-tab-fila .a-tab-l-2,.a-tab-in-3:checked ~ .a-tab-fila .a-tab-l-3{background:#FAFAFA;color:#000}
.a-tab-in:focus-visible ~ .a-tab-fila{outline:2px solid var(--az);outline-offset:-2px}
.a-tab-area{background:#F9FAFB;padding:100px 20px}
.a-panel{display:none;max-width:1144px;min-height:480px;margin:0 auto;background:#fff;border:1px solid var(--borde);border-radius:4px;padding:16px 0 16px 24px;grid-template-columns:minmax(0,1fr) minmax(0,547px);gap:40px;align-items:start;animation:a-aparece .4s ease both}
.a-tab-in-0:checked ~ .a-tab-area .a-panel-0,.a-tab-in-1:checked ~ .a-tab-area .a-panel-1,.a-tab-in-2:checked ~ .a-tab-area .a-panel-2,.a-tab-in-3:checked ~ .a-tab-area .a-panel-3{display:grid}
.a-panel-txt{padding:8px 9px 0;max-width:486px}
.a-panel-h3{font-family:var(--fp);font-size:18px;line-height:1.3;font-weight:500;letter-spacing:-.36px;color:#171717;margin-bottom:12px}
.a-panel-p{font-size:16px;line-height:23.04px;letter-spacing:-.24px;color:#31353F}
.a-panel-p strong{font-weight:600;color:#171717}
.a-panel-demo .a-dico{padding:34px}
.a-panel-demo .a-dico-ic{width:88px;height:88px;border-radius:18px}
.a-panel-demo .a-dico-ic svg{width:40px;height:40px}
.a-panel-demo{align-self:stretch;min-height:446px;border-radius:4px 0 0 4px;background:#EBF5FF;display:flex;align-items:center;justify-content:center;padding:22px}
.a-dico{background:#fff;border-radius:8px;padding:22px;box-shadow:rgba(43,47,65,.17) 0 0 42.8px 0,rgba(196,196,215,.25) 0 1px 2px 0;transition:transform .3s}
.a-pcard:hover .a-dico{transform:translateY(-4px)}
.a-dico-ic{width:56px;height:56px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:#EAF1FE;color:var(--az)}

/* Banda oscura */
.a-osc{position:relative;background:var(--noche);border-top:1px solid rgba(255,255,255,.06);border-bottom:1px solid rgba(255,255,255,.06);padding:88px 0;overflow:hidden}
.a-osc::before{content:'';position:absolute;inset:0;background:radial-gradient(60% 50% at 75% 20%,rgba(47,111,237,.22),transparent 70%),radial-gradient(50% 40% at 50% 100%,rgba(47,111,237,.16),transparent 70%);pointer-events:none}
.a-osc-in{position:relative;max-width:1440px;margin:0 auto;padding:0 32px}
.a-osc-fila{display:grid;grid-template-columns:minmax(0,528px) minmax(0,660px);justify-content:space-between;align-items:center;padding:0 8px}
.a-osc-h2{font-size:40px;line-height:50px;color:#fff}
.a-osc-h2 em{color:var(--cel)}
.a-osc-p{margin:18px 0 28px;max-width:400px;font-size:16px;line-height:26px;color:#AAB1C2}
.a-osc-demo{height:430px;border-radius:12px;padding:18px;background:linear-gradient(180deg,#3E5F96 0%,#7FA0CF 55%,#C9D8EC 100%);display:flex;align-items:flex-end;justify-content:center;overflow:hidden}
.a-osc-demo-vid{width:100%;max-width:580px;border-radius:12px 12px 0 0;background:rgba(255,255,255,.22);padding:12px 12px 0}
.a-osc-demo-bl{background:#fff;border-radius:8px 8px 0 0;padding:28px 20px}
.a-pasos{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:56px;margin-top:88px}
.a-paso{position:relative;min-height:240px;border-radius:14px;border:1px solid rgba(255,255,255,.09);background:linear-gradient(180deg,rgba(255,255,255,.055) 0%,rgba(255,255,255,.02) 100%);padding:24px 20px;transition:border-color .3s,background .3s}
.a-paso:hover{border-color:rgba(118,169,250,.35)}
.a-mas{position:absolute;left:-34px;top:50%;transform:translateY(-50%);color:rgba(255,255,255,.35);font-size:18px}
.a-paso-n{display:block;font-family:var(--fp);font-size:44px;line-height:61.6px;font-weight:600;color:transparent;background:linear-gradient(180deg,rgba(255,255,255,.55) 0%,rgba(255,255,255,.06) 100%);-webkit-background-clip:text;background-clip:text;margin-bottom:12px}
.a-paso-h3{font-size:20px;line-height:28px;font-weight:600;color:#fff;margin-bottom:6px}
.a-paso-p{font-size:15px;line-height:25px;color:#AAB1C2}
.a-paso-p strong{color:#fff;font-weight:600}

/* Producto */
.a-prod{padding:100px 40px 120px;background:#fff}
.a-prod-grid{max-width:1360px;margin:48px auto 0;display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:24px}
.a-pcard{grid-column:span 2;display:flex;flex-direction:column;min-height:0;border-radius:6px;border:1px solid var(--borde);background:linear-gradient(163deg,#ECF2FC 0%,#FAFBFE 100%);padding:25px}
.a-pcard-ancha{grid-column:span 3}
/* Sin la caja alta con un solo ícono en el medio (se veía sin terminar: el Cerebro, 14/11/2026): el ícono arriba, chico. */
.a-pcard-demo{flex:none;min-height:0;display:flex;align-items:center;justify-content:flex-start;margin-bottom:18px}
.a-pcard-h3{font-family:var(--fp);font-size:18px;line-height:21.6px;font-weight:500;letter-spacing:-.4px;color:var(--t2);margin-bottom:8px}
.a-pcard-p{font-size:16px;line-height:28px;font-weight:500;letter-spacing:-.04px;color:var(--gris)}
.a-pcard-p strong{color:var(--t2);font-weight:600}

/* Equipo */
.a-eq{padding:100px 0 0;background:#fff;border-top:1px solid #F2F2F2}
.a-eq-p{max-width:812px}
.a-eq-cielo{max-width:1200px;margin:56px auto 0;padding:56px 24px 0;border-radius:12px 12px 0 0;background:linear-gradient(180deg,#3E5F96 0%,#7FA0CF 45%,#C9D8EC 100%)}
.a-eq-vidrio{max-width:1152px;margin:0 auto;border-radius:8px 8px 0 0;background:rgba(255,255,255,.2);padding:10px 10px 0}
.a-eq-ventana{display:grid;grid-template-columns:260px minmax(0,1fr) 288px;min-height:380px;background:#fff;border-radius:8px 8px 0 0;overflow:hidden;text-align:left}
.a-eq-panel{padding:24px 20px;font-size:14px;line-height:20px;color:#111827}
.a-eq-panel-1{background:#F9FAFB;border-left:1px solid var(--borde);border-right:1px solid var(--borde)}
.a-eq-ic{width:32px;height:32px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;background:#EAF1FE;color:var(--az);margin-bottom:14px}
.a-eq-h3{font-family:var(--fp);font-size:16px;line-height:22px;font-weight:500;letter-spacing:-.3px;color:var(--t2);margin-bottom:6px}
.a-eq-txt{font-size:14px;line-height:22px;color:var(--gris)}

/* Prueba */
.a-pr{padding:100px 20px;background:#fff;border-top:1px solid #F2F2F2}
.a-pr-h2{font-size:40px;line-height:52px;color:#171717;max-width:760px;margin:0 auto}
.a-pr-cards{max-width:1008px;margin:48px auto 0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}
.a-pr-card{display:flex;flex-direction:column;justify-content:space-between;gap:20px;border-radius:8px;border:1px solid var(--borde);background:#F9FAFB;padding:24px}
.a-pr-q{font-size:16px;line-height:24px;font-weight:500;letter-spacing:-.176px;color:#171717}
.a-pr-q strong{font-weight:600;text-decoration:underline;text-decoration-color:var(--az);text-underline-offset:4px}
.a-pr-autor{display:flex;align-items:center;gap:12px}
.a-pr-ava{width:36px;height:36px;flex:none;border-radius:4px;display:flex;align-items:center;justify-content:center;background:#EAF1FE;color:var(--az);font-weight:600;font-size:14px}
.a-pr-quien{display:flex;flex-direction:column}
.a-pr-n{font-size:16px;line-height:22px;font-weight:500;color:#171717}
.a-pr-r{font-size:14px;line-height:20px;color:var(--gris)}
.a-lift{position:relative;max-width:1008px;min-height:480px;margin:40px auto 0;border-radius:8px;background:var(--noche);overflow:hidden;display:grid;grid-template-columns:254px minmax(0,1fr);gap:24px;padding:24px;color:#fff}
.a-lift-vid{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.55}
.a-lift-velo{position:absolute;inset:0;background:linear-gradient(90deg,rgba(2,4,24,.85) 0%,rgba(2,4,24,.35) 55%,rgba(2,4,24,.75) 100%)}
.a-lift-cifras{position:relative;display:flex;flex-direction:column;gap:28px;border-radius:8px;padding:24px;background:linear-gradient(148deg,rgba(255,255,255,.14) 0%,rgba(255,255,255,.05) 26%,rgba(255,255,255,0) 58%),rgba(2,4,24,.52);box-shadow:rgba(255,255,255,.24) 0 1px 0 0 inset,rgba(255,255,255,.09) 0 0 0 1px;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.a-lift-c{display:flex;flex-direction:column;gap:2px}
.a-lift-v{font-family:var(--fi);font-size:36px;line-height:44px;font-weight:600;letter-spacing:-.5px}
.a-lift-l{font-size:16px;line-height:20px;font-weight:500;letter-spacing:-.24px}
.a-lift-cita{position:relative;align-self:end;display:flex;flex-direction:column;gap:2px;padding:0 0 4px}
.a-lift-q{margin-bottom:16px;font-size:20px;line-height:30px;font-weight:500;letter-spacing:-.3px}
.a-lift-q strong{font-weight:600}
.a-lift-n{font-size:18px;line-height:24px;font-weight:500;letter-spacing:-.27px}
.a-lift-r{font-size:14px;line-height:20px;color:rgba(255,255,255,.8)}

/* Cierre */
.a-cierre{padding:96px 20px;text-align:center;background:linear-gradient(180deg,#0A1329 0%,#05091A 100%);border-top:1px solid rgba(255,255,255,.06);position:relative;overflow:hidden}
.a-cierre::before{content:'';position:absolute;inset:0;background:radial-gradient(40% 60% at 50% 0%,rgba(47,111,237,.25),transparent 70%);pointer-events:none}
.a-cierre-h2{position:relative;font-size:40px;line-height:50px;color:#fff;max-width:760px;margin:0 auto}
.a-cierre-h2 em{display:inline;color:var(--cel)}
.a-cierre-p{position:relative;margin:20px auto 32px;max-width:560px;font-size:18px;line-height:28px;letter-spacing:-.27px;color:#C3C9D6}
.a-cierre .a-btn-bl{position:relative}

/* Pie */
.a-pie{background:var(--noche);padding:100px 40px 80px;color:#fff}
.a-pie-in{max-width:1360px;margin:0 auto;display:flex;justify-content:space-between;gap:48px}
.a-pie-marca{max-width:573px}
.a-pie-logo{font-family:var(--fi)}
.a-pie-desc{margin:20px 0 32px;max-width:360px;font-size:14px;line-height:22px;letter-spacing:-.14px;color:#D5D7DA}
.a-pie-btn{display:inline-flex;align-items:center;gap:6px;height:48px;padding:0 24px;border-radius:8px;background:#fff;color:var(--noche);font-size:14px;line-height:22px;letter-spacing:-.14px;transition:transform .2s}
.a-pie-btn:hover{transform:translateY(-1px)}
.a-pie-cols{display:grid;grid-template-columns:repeat(3,auto);gap:96px}
.a-pie-h{font-size:14px;line-height:20px;font-weight:500;letter-spacing:-.14px;color:#fff;margin-bottom:16px}
.a-pie-col ul{display:flex;flex-direction:column;gap:16px}
.a-pie-col a{font-size:14px;line-height:22px;letter-spacing:-.14px;color:#A3A3A3;transition:color .15s}
.a-pie-col a:hover{color:#fff}
.a-pie-copy{max-width:1360px;margin:80px auto 0;font-size:12px;line-height:16px;color:#737373}

@keyframes a-entra{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
@keyframes a-aparece{from{opacity:0}to{opacity:1}}

@media (max-width:1180px){
  .a-hero-marco{grid-template-columns:minmax(0,1fr);gap:40px;padding:48px 24px}
  .a-osc-fila{grid-template-columns:minmax(0,1fr);gap:48px}
  .a-pie-in{flex-direction:column}
  .a-pie-cols{gap:48px}
}
@media (max-width:900px){
  .a-nav,.a-login{display:none}
  .a-menu{display:block}
  .a-barra-der{margin-left:auto}
  .a-prod-grid{grid-template-columns:minmax(0,1fr)}
  .a-pcard,.a-pcard-ancha{grid-column:auto}
  .a-pasos{grid-template-columns:minmax(0,1fr);gap:40px}
  .a-mas{left:50%;top:-28px;transform:translateX(-50%)}
  .a-eq-ventana{grid-template-columns:minmax(0,1fr)}
  .a-eq-panel-1{border:0;border-top:1px solid var(--borde);border-bottom:1px solid var(--borde)}
  .a-pr-cards{grid-template-columns:minmax(0,1fr)}
  .a-lift{grid-template-columns:minmax(0,1fr)}
  .a-panel{grid-template-columns:minmax(0,1fr);padding:16px}
  .a-panel-demo{min-height:240px;border-radius:4px}
}
@media (max-width:640px){
  .a-barra-in{padding:0 20px;gap:12px}
  .a-btn-barra{padding:0 16px}
  .a-hero-marco{border:0;border-bottom:1px solid var(--borde);padding:40px 20px 48px;text-align:center}
  .a-hero-etq{font-size:12px;margin-bottom:20px}
  .a-h1{font-size:28px;line-height:39.2px}
  .a-hero-p{font-size:16px;line-height:26px}
  .a-hero-demo{height:auto;padding:20px 12px}
  .a-h2{font-size:28px;line-height:39.2px}
  .a-h2 em{display:inline}
  .a-osc-h2,.a-cierre-h2,.a-pr-h2{font-size:26px;line-height:32.5px}
  .a-tabs{padding-top:80px}
  .a-tab-fila{grid-template-columns:repeat(2,minmax(0,1fr)) !important}
  .a-tab-l{height:48px;border-bottom:1px solid var(--borde)}
  .a-tab-l:nth-child(2n){border-right:0}
  .a-tab-area{padding:40px 20px}
  .a-osc{padding:64px 0}
  .a-osc-in{padding:0 20px}
  .a-osc-fila{padding:0;text-align:center}
  .a-ceja-osc{justify-content:center}
  .a-osc-p{margin-left:auto;margin-right:auto}
  .a-osc-demo{height:auto;padding:14px}
  .a-pasos{margin-top:56px}
  .a-paso{min-height:0}
  .a-prod{padding:64px 20px 80px}
  .a-pcard-demo{min-height:0}
  .a-eq{padding-top:64px}
  .a-eq-cielo{margin-top:40px;padding:28px 12px 0;border-radius:0}
  .a-pr{padding:64px 20px}
  .a-lift{padding:16px}
  .a-lift-cifras{flex-direction:row;flex-wrap:wrap;gap:16px 28px}
  .a-lift-v{font-size:28px;line-height:34px}
  .a-lift-q{font-size:17px;line-height:26px}
  .a-cierre{padding:64px 20px}
  .a-cierre-p{font-size:16px;line-height:26px}
  .a-pie{padding:64px 20px 48px}
  .a-pie-cols{grid-template-columns:repeat(2,minmax(0,1fr));gap:32px}
  .a-pie-cols .a-pie-col:nth-child(2) .a-pie-h{display:none}
  .a-pie-copy{margin-top:48px}
}
@media (prefers-reduced-motion:reduce){
  .a-raiz *,.a-raiz *::before,.a-raiz *::after{animation:none !important;transition:none !important}
}
`.replace(/\.a-/g, '.d-agenda-').replace(/\ba-(entra|aparece)\b/g, 'd-agenda-$1');
