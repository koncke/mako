// =============================================================================
// /vsl/cobranza con el DISEÑO de la portada de Rebill (https://www.rebill.com/es), copiado el 11/11/2026
// =============================================================================
// La página entera es la de Rebill, que es OSCURA: la barra azul noche con el botón blanco de borde degradado, el hero que
// baja del azul noche a su azul, con el titular de 64 px en dos tonos y la demo a la derecha; la sección de cifras con su
// titular centrado y las tres tarjetas translúcidas; «Conexiones locales» con sus piezas (texto con la línea azul a la
// izquierda y la captura a la derecha); «Integración simple» sobre gris carbón con su pila de tarjetas (la activa negra, las
// otras apagadas); «Historias de clientes» sobre gris claro con su tarjeta blanca de imagen y cifra; las preguntas en
// tarjetas altas sobre negro; el cierre azul y el pie azul noche de columnas. Los valores se midieron con getComputedStyle a
// 1440 y a 390 px y viven en docs/diseno/landings-competencia/cobranza.md.
//
// Fuente: Rebill usa SF Pro Display (de Apple, no se puede servir); va Inter, la de Google Fonts más parecida, con los mismos
// tamaños, pesos (300 / 400 / 500) y tracking.
// De MaKo: el logo, el azul #2F6FED donde Rebill pone su azul #0056F6 (el final de sus degradados, las cifras, los botones
// azules, la línea de cada pieza), el botón de la llamada donde Rebill pone «Empezar ahora» / «Activar cuenta ahora», el
// caso de Mauricio en «Historias de clientes», el visual de la landing donde Rebill muestra sus capturas y el resto de las
// funciones en las columnas del pie. El cierre lleva el texto de la banda de la llamada de todas las landings de /vsl.
// Lo que se sacó (no tiene contenido real de MaKo): la tira de logos de clientes bajo el hero, el «Hablar con un experto»,
// los íconos de cada pieza, las capturas de código de «Integración simple» (la pila de tarjetas va a la derecha), los puntos
// del carrusel de historias (hay una sola), «Respaldado por» con sus logos, los íconos sociales y el selector de idioma.
// La foto del fondo de cada tarjeta de cifras es un brillo azul abajo, en el mismo lugar. El hero de Rebill no tiene ceja:
// la `etiqueta` del bloque no se dibuja.
// Server component sin JavaScript: el menú del teléfono y las preguntas son <details>; la tarjeta activa de la pila cambia
// al pasar el mouse (CSS); las animaciones se apagan con «reducir movimiento».
// =============================================================================

import type { PropsDiseno } from '.';
import type { Bloque } from '../tipos';
import { RUTA_CTA, CASO, LogoMaKo, TEXTO_CTA, html, otrasFunciones, TEXTO_CIERRE } from '../marca';
import { VisualDeLanding } from '../Visuales';
import { Visual } from '../../_detalle/Visual';
import { FEATURE_VISUALS } from '../../_detalle/feature-visuals';

const c = (n: string) => `d-cobranza-${n}`;

function Chevron() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6l-6 6" /></svg>;
}

function BotonBlanco({ clase = '' }: { clase?: string }) {
  return <a href={RUTA_CTA} className={`${c('btn-bl')} ${clase}`}><span>{TEXTO_CTA}</span><Chevron /></a>;
}

function Barra({ links }: { links: { href: string; t: string }[] }) {
  return (
    <header className={c('barra')}>
      <div className={c('barra-in')}>
        <LogoMaKo className={c('logo')} tamano={30} claro />
        <nav className={c('nav')} aria-label="Secciones">
          {links.map((l) => <a key={l.href} href={l.href}>{l.t}</a>)}
        </nav>
        <div className={c('barra-der')}>
          <a href="/login" className={c('login')}>Iniciar sesión</a>
          <a href={RUTA_CTA} className={c('btn-barra')}><span>{TEXTO_CTA}</span><Chevron /></a>
        </div>
        <details className={c('menu')}>
          <summary aria-label="Menú"><span /><span /><span /></summary>
          <div className={c('menu-panel')}>
            {links.map((l) => <a key={l.href} href={l.href}>{l.t}</a>)}
            <a href="/login">Iniciar sesión</a>
            <a href={RUTA_CTA} className={c('menu-cta')}>{TEXTO_CTA}</a>
          </div>
        </details>
      </div>
    </header>
  );
}

function Hero({ b }: { b: Extract<Bloque, { tipo: 'hero' }> }) {
  return (
    <section className={c('hero')}>
      <div className={c('hero-in')}>
        <div className={c('hero-txt')}>
          <h1 className={c('h1')} dangerouslySetInnerHTML={html(b.titulo)} />
          <div className={c('hero-p')}>
            <p dangerouslySetInnerHTML={html(b.bajada)} />
            {b.puntos?.length ? <p>{b.puntos.join(' · ')}</p> : null}
          </div>
          <div className={c('hero-btns')}><BotonBlanco /></div>
        </div>
        <div className={c('hero-demo')}><div className={c('hero-demo-in')}><VisualDeLanding visual={b.visual} /></div></div>
      </div>
    </section>
  );
}

function Cifras({ b }: { b: Extract<Bloque, { tipo: 'cifras' }> }) {
  return (
    <section className={c('cif')}>
      {b.titulo ? <h2 className={`${c('h2')} ${c('cif-h2')}`}>{b.titulo}</h2> : null}
      <div className={c('cif-grid')}>
        {b.items.map((it) => (
          <div key={it.label} className={c('cif-card')}>
            <p className={c('cif-t')}><strong>{it.valor}</strong> {it.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/** «Conexiones locales.»: el titular centrado y cada pieza con su línea azul a la izquierda y la captura a la derecha. */
function Piezas({ b }: { b: Extract<Bloque, { tipo: 'filas' }> }) {
  return (
    <section className={c('pz')} id={c('cobra')}>
      <div className={c('pz-enc')}>
        <h2 className={`${c('h2')} ${c('pz-h2')}`} dangerouslySetInnerHTML={html(b.titulo)} />
        {b.etiqueta ? <p className={c('pz-sub')}>{b.etiqueta}</p> : null}
        {b.bajada ? <p className={c('pz-p')} dangerouslySetInnerHTML={html(b.bajada)} /> : null}
      </div>
      <div className={c('pz-lista')}>
        {b.items.map((f, i) => (
          <div key={f.titulo} className={c('pz-fila')}>
            <div className={c('pz-txt')}>
              <h3 className={c('pz-h3')} dangerouslySetInnerHTML={html(f.titulo)} />
              <p className={c('pz-x')} dangerouslySetInnerHTML={html(f.texto)} />
              {f.puntos?.length ? <ul className={c('pz-puntos')}>{f.puntos.map((p) => <li key={p} dangerouslySetInnerHTML={html(p)} />)}</ul> : null}
            </div>
            <div className={c('pz-cap')}>
              <div className={c('pz-cap-in')}><Visual spec={FEATURE_VISUALS[b.slug]?.groups?.[f.grafico ?? i]} /></div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** «Integración simple. Resultado profesional.»: el titular a la izquierda y la pila de tarjetas (la activa negra). */
function Pila({ b, primero, id }: { b: Extract<Bloque, { tipo: 'tarjetas' }>; primero: boolean; id?: string }) {
  return (
    <section className={`${c('int')}${primero ? '' : ` ${c('int-2')}`}`} id={id}>
      <div className={c('int-in')}>
        <div className={c('int-txt')}>
          <h2 className={`${c('h2')} ${c('int-h2')}`} dangerouslySetInnerHTML={html(b.titulo)} />
          {b.bajada ? <p className={c('int-p')} dangerouslySetInnerHTML={html(b.bajada)} /> : null}
          {primero ? <BotonBlanco /> : null}
        </div>
        <div className={c('pila')}>
          {b.items.map((t) => (
            <div key={t.titulo} className={c('pcard')}>
              <h3 className={c('pcard-t')} dangerouslySetInnerHTML={html(t.titulo)} />
              <p className={c('pcard-x')} dangerouslySetInnerHTML={html(t.texto)} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** «Historias de clientes»: el titular y la tarjeta blanca de imagen y cifra, con el caso de Mauricio. */
function Caso() {
  const ultimo = CASO.meses[CASO.meses.length - 1];
  return (
    <section className={c('his')} id={c('caso')}>
      <h2 className={`${c('h2')} ${c('his-h2')}`} dangerouslySetInnerHTML={html(CASO.titulo)} />
      <p className={c('his-p')}>{CASO.sub}</p>
      <article className={c('his-card')}>
        <div className={c('his-vid')}><video muted autoPlay loop playsInline preload="metadata"><source src={CASO.video} type="video/mp4" /></video></div>
        <div className={c('his-dat')}>
          <p className={c('his-cifra')}>{ultimo.monto}</p>
          <p className={c('his-lab')}>{ultimo.mes} · {CASO.quien}, {CASO.rol.charAt(0).toLowerCase() + CASO.rol.slice(1)}</p>
          <p className={c('his-res')} dangerouslySetInnerHTML={html(CASO.resultado)} />
          <ul className={c('his-lista')}>
            {CASO.meses.map((m) => <li key={m.mes}><span className={c('his-pt')} aria-hidden="true" />{m.mes}<strong>{m.monto}</strong></li>)}
          </ul>
          <a href={RUTA_CTA} className={c('btn-az')}>{TEXTO_CTA}<Chevron /></a>
        </div>
      </article>
    </section>
  );
}

function Preguntas({ b }: { b: Extract<Bloque, { tipo: 'preguntas' }> }) {
  return (
    <section className={c('faq')} id={c('preguntas')}>
      <div className={c('faq-in')}>
        <h2 className={`${c('h2')} ${c('faq-h2')}`} dangerouslySetInnerHTML={html(b.titulo)} />
        <BotonBlanco />
        <div className={c('faq-fila')}>
          {b.items.map((q) => (
            <details key={q.p} className={c('faq-card')}>
              <summary><span className={c('faq-q')}>{q.p}</span><span className={c('faq-mas')} aria-hidden="true">+</span></summary>
              <p className={c('faq-r')} dangerouslySetInnerHTML={html(q.r)} />
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/** El cierre azul, con el texto de la banda de la llamada de todas las landings de /vsl. */
function Cierre() {
  return (
    <section className={c('cierre')}>
      <div className={c('cierre-in')}>
        <h2 className={`${c('h2')} ${c('cierre-h2')}`}>¿Lo quieres andando <em>en tu negocio?</em></h2>
        <p className={c('cierre-p')}>{TEXTO_CIERRE}</p>
        <BotonBlanco />
      </div>
    </section>
  );
}

function Pie({ slug }: { slug: string }) {
  const otras = otrasFunciones(slug);
  const n = Math.ceil(otras.length / 3);
  const cols = [otras.slice(0, n), otras.slice(n, n * 2), otras.slice(n * 2)];
  return (
    <footer className={c('pie')}>
      <div className={c('pie-in')}>
        <LogoMaKo className={c('pie-logo')} tamano={30} claro />
        <div className={c('pie-cols')}>
          {cols.map((col, i) => (
            <div key={i} className={c('pie-col')}>
              <p className={c('pie-h')} aria-hidden={i > 0 ? true : undefined}>{i === 0 ? 'Funciones' : ' '}</p>
              <ul>{col.map((o) => <li key={o.href}><a href={o.href}>{o.nombre}</a></li>)}</ul>
            </div>
          ))}
          <div className={c('pie-col')}>
            <p className={c('pie-h')}>Legal</p>
            <ul>
              <li><a href="/terminos">Términos del servicio</a></li>
              <li><a href="/privacidad">Privacidad</a></li>
              <li><a href="/aup">Política de uso aceptable</a></li>
            </ul>
          </div>
        </div>
      </div>
      <p className={c('pie-copy')}>© 2026 MaKo. Todos los derechos reservados.</p>
    </footer>
  );
}

export default function DisenoCobranza({ landing }: PropsDiseno) {
  const bloques = landing.bloques;
  const tarjetas = bloques.filter((b) => b.tipo === 'tarjetas');
  const links: { href: string; t: string }[] = [];
  if (bloques.some((b) => b.tipo === 'filas')) links.push({ href: `#${c('cobra')}`, t: 'Cómo cobras' });
  if (tarjetas.length) links.push({ href: `#${c('pasarelas')}`, t: 'Pasarelas' });
  if (bloques.some((b) => b.tipo === 'caso')) links.push({ href: `#${c('caso')}`, t: 'Historia' });
  if (bloques.some((b) => b.tipo === 'preguntas')) links.push({ href: `#${c('preguntas')}`, t: 'Preguntas' });
  return (
    <div className={c('raiz')}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <Barra links={links} />
      <main>
        {bloques.map((b, i) => {
          switch (b.tipo) {
            case 'hero': return <Hero key={i} b={b} />;
            case 'cifras': return <Cifras key={i} b={b} />;
            case 'filas': return <Piezas key={i} b={b} />;
            case 'tarjetas': {
              const k = tarjetas.indexOf(b);
              return <Pila key={i} b={b} primero={k === 0} id={k === 0 ? c('pasarelas') : undefined} />;
            }
            case 'caso': return <Caso key={i} />;
            case 'preguntas': return <Preguntas key={i} b={b} />;
            default: return null;
          }
        })}
        <Cierre />
      </main>
      <Pie slug={landing.slug} />
    </div>
  );
}

// Los valores, medidos en www.rebill.com/es el 11/11/2026 (docs/diseno/landings-competencia/cobranza.md).
const CSS = `
@font-face{font-family:'DCo Inter';src:url('/vsl-assets/fuentes/inter/inter-latin-var.woff2') format('woff2');font-weight:100 900;font-style:normal;font-display:swap}
.k-raiz{--az:#2F6FED;--azm:#1B3E8F;--noche:#000919;--barra:#000C24;--lbl:#CCDEFF;--lbl2:#E5EEFF;--f:'DCo Inter',-apple-system,BlinkMacSystemFont,Arial,sans-serif;background:var(--barra);color:#333;font-family:var(--f);font-size:14px;line-height:20px;-webkit-font-smoothing:antialiased;overflow-x:clip}
:where(.k-raiz) *,:where(.k-raiz) *::before,:where(.k-raiz) *::after{box-sizing:border-box}
:where(.k-raiz) a{color:inherit;text-decoration:none}
:where(.k-raiz) :where(h1,h2,h3,p,ul,ol){margin:0;padding:0}
:where(.k-raiz) :where(ul,ol){list-style:none}
:where(.k-raiz) :where(img,video){display:block}
.k-h2{font-size:64px;line-height:70.4px;font-weight:500;letter-spacing:-.64px;color:var(--lbl2)}
.k-h2 em,.k-h1 em{font-style:normal;color:var(--lbl)}
.k-btn-bl{display:inline-flex;align-items:center;gap:8px;padding:10px 16px;border-radius:8px;background:#fff;color:#1F315C;font-size:16px;line-height:20px;font-weight:500;letter-spacing:-.2px;transition:transform .2s,box-shadow .2s}
.k-btn-bl svg{transition:transform .2s}
.k-btn-bl:hover{box-shadow:0 8px 24px -10px rgba(47,111,237,.8)}
.k-btn-bl:hover svg,.k-btn-barra:hover svg,.k-btn-az:hover svg{transform:translateX(3px)}
.k-btn-az{display:inline-flex;align-items:center;gap:8px;align-self:flex-start;padding:8px 20px;border-radius:8px;background:var(--az);color:#fff;font-size:20px;line-height:24px;font-weight:500;letter-spacing:-.2px;transition:background .2s}
.k-btn-az svg{transition:transform .2s}
.k-btn-az:hover{background:#1F57C8}

/* Barra */
.k-barra{position:sticky;top:0;z-index:30;background:var(--barra)}
.k-barra-in{height:72px;max-width:1440px;margin:0 auto;padding:0 72px;display:flex;align-items:center;gap:24px}
.k-logo{flex:none}
.k-nav{flex:1;display:flex;justify-content:flex-end;padding-right:96px}
.k-nav a{padding:8px 16px;font-size:18px;line-height:20px;font-weight:300;color:#fff;transition:color .15s}
.k-nav a:hover{color:var(--lbl)}
.k-barra-der{display:flex;align-items:center;gap:16px;flex:none}
.k-login{padding:8px 0;font-size:18px;line-height:20px;letter-spacing:-.2px;color:#fff}
.k-btn-barra{display:inline-flex;align-items:center;gap:10px;padding:8px 14px;border-radius:8px;border:3px solid transparent;background:linear-gradient(#fff,#fff) padding-box,linear-gradient(135deg,#5B8FF2,#fff,#2F6FED) border-box;color:#1F315C;font-size:18px;line-height:20px;letter-spacing:-.2px}
.k-btn-barra svg{transition:transform .2s}
.k-menu{display:none;position:relative;margin-left:auto}
.k-menu summary{list-style:none;cursor:pointer;width:40px;height:40px;display:flex;flex-direction:column;justify-content:center;gap:5px;padding:0 9px}
.k-menu summary::-webkit-details-marker{display:none}
.k-menu summary span{display:block;height:2px;background:#fff;border-radius:2px}
.k-menu-panel{position:absolute;right:0;top:calc(100% + 16px);width:240px;background:var(--barra);border:1px solid rgba(255,255,255,.14);border-radius:10px;padding:8px;display:flex;flex-direction:column}
.k-menu-panel a{padding:10px 12px;font-size:16px;font-weight:300;color:#fff}
.k-menu-panel .k-menu-cta{margin-top:6px;background:#fff;color:#1F315C;border-radius:8px;font-weight:500;text-align:center}

/* Hero */
.k-hero{background:linear-gradient(var(--noche) 20.73%,var(--azm) 71.22%,var(--az) 99.99%);min-height:810px}
.k-hero-in{max-width:1440px;margin:0 auto;padding:80px 72px 120px;display:grid;grid-template-columns:minmax(0,632px) minmax(0,560px);justify-content:space-between;align-items:start}
.k-hero-txt{animation:k-entra .9s cubic-bezier(.16,1,.3,1) both}
.k-hero-etq{margin-bottom:16px;font-size:16px;line-height:20px;font-weight:500;letter-spacing:.32px;color:var(--lbl)}
.k-h1{font-size:64px;line-height:70.4px;font-weight:500;letter-spacing:-.64px;color:#fff;text-wrap:balance}
.k-hero-p{margin-top:24px;display:flex;flex-direction:column;gap:25px;font-size:18px;line-height:25.56px;font-weight:300;letter-spacing:.36px;color:#fff}
.k-hero-p strong{font-weight:500}
.k-hero-btns{margin-top:24px;display:flex;gap:24px}
.k-hero-demo{padding-top:24px;animation:k-entra .9s cubic-bezier(.16,1,.3,1) .15s both}
.k-hero-demo-in{background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 30px 60px -30px rgba(0,9,25,.8),0 0 0 1px rgba(255,255,255,.12)}

/* Cifras */
.k-cif{background:linear-gradient(var(--az),var(--azm) 30%,var(--noche) 92%);padding:144px 72px 120px;text-align:center}
.k-cif-h2{max-width:960px;margin:0 auto}
.k-cif-grid{max-width:1296px;margin:190px auto 0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;text-align:left}
.k-cif-card{position:relative;isolation:isolate;overflow:hidden;min-height:500px;border-radius:10px;background:rgba(0,0,0,.5);padding:40px 32px;transition:background .3s,transform .3s}
.k-cif-card::after{content:'';position:absolute;left:0;right:0;bottom:0;height:54%;z-index:-1;background:radial-gradient(90% 85% at 50% 100%,rgba(47,111,237,.42),rgba(47,111,237,0) 72%);transition:opacity .3s}
.k-cif-card:hover::after{opacity:.7}
.k-cif-card:hover{background:rgba(0,0,0,.62);transform:translateY(-4px)}
.k-cif-t{font-size:24px;line-height:33.6px;font-weight:300;letter-spacing:.48px;color:#fff}
.k-cif-t strong{font-weight:500}

/* Piezas */
.k-pz{background:var(--noche);padding:120px 72px 160px}
.k-pz-enc{max-width:960px;margin:0 auto;text-align:center}
.k-pz-sub{margin-top:18px;font-size:24px;line-height:28.8px;color:var(--lbl2)}
.k-pz-p{margin:18px auto 0;max-width:768px;font-size:20px;line-height:28.4px;font-weight:300;color:#fff}
.k-pz-lista{max-width:1296px;margin:120px auto 0;display:flex;flex-direction:column;gap:120px}
.k-pz-fila{display:grid;grid-template-columns:minmax(0,420px) minmax(0,817px);justify-content:space-between;align-items:center}
.k-pz-txt{border-left:1px solid var(--az);padding:4px 0 4px 16px}
.k-pz-h3{font-size:22px;line-height:29px;font-weight:400;color:#fff;margin-bottom:12px}
.k-pz-x{font-size:18px;line-height:28px;font-weight:300;color:#fff}
.k-pz-x strong{font-weight:500}
.k-pz-puntos{margin-top:16px;display:flex;flex-direction:column;gap:10px}
.k-pz-puntos li{position:relative;padding-left:18px;font-size:16px;line-height:24px;font-weight:300;color:var(--lbl2)}
.k-pz-puntos li::before{content:'';position:absolute;left:0;top:10px;width:6px;height:6px;border-radius:50%;background:var(--az)}
.k-pz-cap{aspect-ratio:858/700;display:flex;align-items:center;justify-content:center;border-radius:16px;background:radial-gradient(70% 60% at 50% 40%,rgba(47,111,237,.22),transparent 72%)}
.k-pz-cap-in{width:76%;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 40px 80px -40px rgba(0,0,0,.9),0 0 0 1px rgba(255,255,255,.1);transition:transform .4s cubic-bezier(.16,1,.3,1)}
.k-pz-fila:hover .k-pz-cap-in{transform:translateY(-6px)}

/* Integración (la pila) */
.k-int{background:#0E0F11;padding:120px 72px 40px}
.k-int-2{padding:80px 72px 140px}
.k-int-in{max-width:1296px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,560px);gap:64px;align-items:start}
.k-int-h2{font-weight:400;color:#fff}
.k-int-2 .k-int-h2{font-size:48px;line-height:56px}
.k-int-p{margin:24px 0 32px;max-width:520px;font-size:20px;line-height:28px;font-weight:300;color:#fff}
.k-pila{display:flex;flex-direction:column;gap:16px}
.k-pcard{border-radius:10px;border:1px solid #2D2D2D;background:#0E0F11;padding:18px 18px 36px;color:#D8DADF;opacity:.45;transition:opacity .3s,background .3s,padding .3s,box-shadow .3s}
.k-pcard:first-child{background:#000;opacity:1;padding:36px 18px 50px;box-shadow:#1E2025 0 0 6.8px 1px}
.k-pila:hover .k-pcard{background:#0E0F11;opacity:.45;padding:18px 18px 36px;box-shadow:none}
.k-pila:hover .k-pcard:hover{background:#000;opacity:1;padding:36px 18px 50px;box-shadow:#1E2025 0 0 6.8px 1px}
.k-pcard-t{font-size:20px;line-height:28px;font-weight:400;letter-spacing:.4px;margin-bottom:12px}
.k-pcard-x{font-size:16px;line-height:24px;font-weight:300;letter-spacing:.32px}

/* Historias */
.k-his{background:#FAFAFA;padding:80px 72px 120px;text-align:center}
.k-his-h2{max-width:900px;margin:0 auto;color:#001131}
.k-his-p{margin:18px auto 0;max-width:690px;font-size:20px;line-height:28px;letter-spacing:.4px;color:#333}
.k-his-card{max-width:1100px;margin:64px auto 0;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);background:#fff;border-radius:8.8px;overflow:hidden;text-align:left;box-shadow:0 1px 2px rgba(0,17,49,.04)}
.k-his-vid{background:#000919;min-height:100%}
.k-his-vid video{width:100%;height:100%;object-fit:cover}
.k-his-dat{display:flex;flex-direction:column;padding:40px}
.k-his-cifra{font-size:38px;line-height:38px;font-weight:500;color:var(--az)}
.k-his-lab{margin-top:16px;font-size:16px;line-height:20px;color:#000}
.k-his-res{margin-top:24px;font-size:16px;line-height:24px;color:#333}
.k-his-res strong{font-weight:500;color:#000}
.k-his-lista{margin:24px 0 32px;display:flex;flex-direction:column;gap:10px}
.k-his-lista li{display:flex;align-items:center;gap:12px;font-size:16px;line-height:20px;color:#000}
.k-his-lista strong{margin-left:auto;font-weight:500}
.k-his-pt{width:16px;height:16px;border-radius:4px;background:#EAF1FE;box-shadow:inset 0 0 0 4px #fff,inset 0 0 0 16px var(--az)}

/* Preguntas */
.k-faq{background:#000;padding:96px 72px}
.k-faq-in{max-width:1296px;margin:0 auto}
.k-faq-h2{font-weight:400;color:#fff;margin-bottom:16px}
.k-faq-fila{margin-top:48px;display:flex;gap:16px;align-items:stretch}
.k-faq-card{flex:1 1 0;min-width:0;min-height:480px;border:1px solid #788191;border-radius:8px;padding:32px;transition:flex-grow .4s,border-color .3s}
.k-faq-card:hover{border-color:var(--lbl)}
.k-faq-card[open]{flex-grow:1.6;background:linear-gradient(180deg,rgba(47,111,237,.16),rgba(47,111,237,0) 70%)}
.k-faq-card summary{list-style:none;cursor:pointer;display:flex;justify-content:space-between;gap:16px}
.k-faq-card summary::-webkit-details-marker{display:none}
.k-faq-q{font-size:31px;line-height:37.2px;font-weight:300;color:var(--lbl2);transition:font-size .3s,line-height .3s}
.k-faq-card[open] .k-faq-q{font-size:22px;line-height:28px}
.k-faq-mas{flex:none;font-size:28px;line-height:32px;font-weight:300;color:var(--lbl);transition:transform .3s}
.k-faq-card[open] .k-faq-mas{transform:rotate(45deg)}
.k-faq-r{margin-top:28px;font-size:18px;line-height:26px;font-weight:500;color:#fff}

/* Cierre */
.k-cierre{background:linear-gradient(var(--az),#020C22 86.16%);padding:112px 72px 160px}
.k-cierre-in{max-width:1296px;margin:0 auto}
.k-cierre-h2{font-weight:400;color:#fff;max-width:760px}
.k-cierre-p{margin:20px 0 32px;max-width:560px;font-size:20px;line-height:28px;font-weight:300;color:#fff}

/* Pie */
.k-pie{background:var(--barra);padding:80px 72px 56px}
.k-pie-in{max-width:1296px;margin:0 auto;display:grid;grid-template-columns:166px minmax(0,1fr);gap:0}
.k-pie-cols{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:24px}
.k-pie-h{font-size:16px;line-height:24px;font-weight:500;color:#fff;margin-bottom:8px}
.k-pie-col a{display:block;padding:8px 0;font-size:16px;line-height:20px;font-weight:300;color:#E0E0E0;transition:color .15s}
.k-pie-col a:hover{color:#fff}
.k-pie-copy{max-width:1296px;margin:96px auto 0;text-align:right;font-size:14px;line-height:21px;font-weight:300;color:#E0E0E0}

@keyframes k-entra{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}

@media (max-width:1180px){
  .k-hero-in,.k-int-in{grid-template-columns:minmax(0,1fr);gap:48px}
  .k-pz-fila{grid-template-columns:minmax(0,1fr);gap:32px}
  .k-pie-in{grid-template-columns:minmax(0,1fr);gap:40px}
}
@media (max-width:991.98px){
  .k-nav,.k-barra-der{display:none}
  .k-menu{display:block}
  .k-cif-grid{grid-template-columns:minmax(0,1fr)}
  .k-cif-card{min-height:416px}
  .k-faq-fila{flex-direction:column}
  .k-faq-card{flex:none;min-height:135px}
  .k-faq-card[open]{flex-grow:0}
  .k-his-card{grid-template-columns:minmax(0,1fr)}
  .k-his-vid{aspect-ratio:848/480}
}
@media (max-width:640px){
  .k-barra-in{height:64px;padding:0 16px}
  .k-h1{font-size:40px;line-height:44px;letter-spacing:-.4px}
  .k-h2{font-size:36px;line-height:39.6px;letter-spacing:-.36px}
  .k-int-2 .k-int-h2{font-size:32px;line-height:36px}
  .k-hero{min-height:0}
  .k-hero-in{padding:80px 16px 72px}
  .k-hero-btns .k-btn-bl{width:100%;justify-content:center}
  .k-cif{padding:96px 16px 64px}
  .k-cif-grid{margin-top:96px}
  .k-cif-card{padding:20px;min-height:416px}
  .k-cif-t{font-size:18px;line-height:25.2px;letter-spacing:.36px}
  .k-pz{padding:64px 16px 80px}
  .k-pz-sub{font-size:20px}
  .k-pz-p{font-size:16px;line-height:24px}
  .k-pz-lista{margin-top:56px;gap:64px}
  .k-pz-h3{font-size:20px;line-height:26px}
  .k-pz-x{font-size:16px;line-height:24px}
  .k-pz-cap{aspect-ratio:auto;padding:12px 0}
  .k-pz-cap-in{width:100%}
  .k-int{padding:64px 16px 24px}
  .k-int-2{padding:40px 16px 80px}
  .k-int-p{font-size:16px;line-height:24px}
  .k-pcard,.k-pcard:first-child,.k-pila:hover .k-pcard,.k-pila:hover .k-pcard:hover{opacity:1;padding:24px 20px;background:#000}
  .k-pcard-t{font-size:18px;line-height:26px}
  .k-his{padding:64px 16px 80px}
  .k-his-p{font-size:16px;line-height:24px}
  .k-his-dat{padding:24px}
  .k-faq{padding:96px 16px}
  .k-faq-card{flex:none;min-height:135px;padding:40px 22px 32px}
  .k-faq-card[open]{flex-grow:0}
  .k-faq-q{font-size:20px;line-height:24px}
  .k-faq-card[open] .k-faq-q{font-size:18px;line-height:24px}
  .k-faq-r{font-size:16px;line-height:24px}
  .k-cierre{padding:72px 16px 96px}
  .k-cierre-p{font-size:16px;line-height:24px}
  .k-cierre .k-btn-bl{width:100%;justify-content:center}
  .k-pie{padding:56px 16px 40px}
  .k-pie-cols{grid-template-columns:minmax(0,1fr);gap:0}
  .k-pie-cols .k-pie-col:nth-child(2) .k-pie-h,.k-pie-cols .k-pie-col:nth-child(3) .k-pie-h{display:none}
  .k-pie-cols .k-pie-col:last-child{margin-top:40px}
  .k-pie-copy{margin-top:48px;text-align:left}
}
@media (prefers-reduced-motion:reduce){
  .k-raiz *,.k-raiz *::before,.k-raiz *::after{animation:none !important;transition:none !important}
}
`.replace(/\.k-/g, '.d-cobranza-').replace(/\bk-entra\b/g, 'd-cobranza-entra');
