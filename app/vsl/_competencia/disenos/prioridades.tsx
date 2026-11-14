// =============================================================================
// /vsl/prioridades con el DISEÑO de la portada de Motion (https://www.usemotion.com/), copiado el 11/11/2026
// =============================================================================
// Los valores (Albert Sans en los títulos e Inter en el texto, la escala 88 / 60 / 48 / 34 / 20, el contenedor de 1200, el
// degradado del hero, la tarjeta del hero con sus casillas, las dos columnas «normal / con IA», los acordeones de las
// funciones con su borde azul de 4 px y la ventana de producto sobre el celeste, la tarjeta azul del caso, los renglones
// celestes de «Why…», el panel gris de integraciones, el cierre con el título degradado y el pie) se leyeron con
// getComputedStyle a 1440 y 390 px: docs/diseno/landings-competencia/prioridades.md. Las dos letras son de Google Fonts (OFL),
// bajadas a public/vsl-assets/fuentes/albert-sans/ e inter/ (Motion las carga de fonts.bunny.net: son las mismas).
// De MaKo quedan el logo, el azul #2F6FED en los botones, los bordes de los acordeones y la tarjeta del caso (Motion usa su
// azul #3E63DD, casi el mismo), los azules de MaKo donde Motion pone su degradado rosa-violeta (las palabras resaltadas del
// titular y el borde de la columna «con IA»: el dorado mezclado con el azul se ensucia), el botón de la llamada, el caso de
// Mauricio y los textos.
//
// Secciones de la referencia que NO van, y por qué:
//   · «Voted #1 hottest product by Amplitude» (su premio), «Over 1 million top performers» con sus logos, «Motion is built for
//     individuals and teams» con sus cuatro citas, «What Individual Users say», las fotos de «Teams & Businesses», «1 person or
//     1,000-person team», «Motion replaces…» con los logos de otras apps, «Enterprise Grade Security» con sus sellos y los
//     logos de prensa: son premios, contadores, testimonios, sellos o logos suyos (la regla de /vsl).
//   · «AI Calendar Assistant» y «AI Workflows Builder»: MaKo no lo hace (ver la cabecera de ../prioridades.ts).
//   · «Add your ideas… whether at or away from desk» (sus capturas en computadora y teléfono) y «Robust API…»: la landing de
//     MaKo no trae ese contenido; lo del teléfono y Calendar va en «Por qué tu plan vive adentro de MaKo».
//   · La nota «Start your free trial. Cancel in 1 click.» debajo de cada botón (MaKo no vende con prueba gratis), el campo de
//     email del hero en el teléfono y las flechas del carrusel.
// Server component, sin JavaScript: los acordeones son <details name> (uno abierto a la vez) y la ventana de producto vive
// ADENTRO de cada uno, como en el teléfono de Motion; en la computadora se ubica en la columna de al lado, así que se ve la
// del que está abierto. Las animaciones son CSS y se apagan con prefers-reduced-motion.
// =============================================================================

import type { PropsDiseno } from '.';
import type { Bloque, Item } from '../tipos';
import { RUTA_CTA, CASO, LogoMaKo, TEXTO_CTA, html, otrasFunciones, TEXTO_CIERRE } from '../marca';
import { VisualDeLanding } from '../Visuales';
import { FEATURE_VISUALS } from '../../_detalle/feature-visuals';
import { Visual } from '../../_detalle/Visual';
import { FaltaAnimacion } from '../FaltaAnimacion';

type B<T extends Bloque['tipo']> = Extract<Bloque, { tipo: T }>;

function Ico({ paths, size = 16, grosor = 2 }: { paths?: string[]; size?: number; grosor?: number }) {
  if (!paths?.length) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={grosor} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths.map((d) => <path key={d} d={d} />)}
    </svg>
  );
}

const CHEVRON = ['M6 9l6 6l6 -6'];
const CHECK = ['M5 12l5 5l10 -10'];
const CRUZ = ['M18 6l-12 12', 'M6 6l12 12'];
/** Los íconos de las cuatro vistas del Plan, para las casillas de la tarjeta del hero. */
const VISTAS: Record<string, string[]> = {
  Prioridades: ['M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0', 'M12 12m-5 0a5 5 0 1 0 10 0a5 5 0 1 0 -10 0', 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0'],
  Tareas: ['M3.5 5.5l1.5 1.5l2.5 -2.5', 'M3.5 11.5l1.5 1.5l2.5 -2.5', 'M3.5 17.5l1.5 1.5l2.5 -2.5', 'M11 6l9 0', 'M11 12l9 0', 'M11 18l9 0'],
  Proyectos: ['M4 4h4v16h-4z', 'M10 4h4v10h-4z', 'M16 4h4v6h-4z'],
  Recurrentes: ['M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4', 'M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4'],
};

/** Su botón azul: 48 px, 12 20, radio 8, el degradado de arriba abajo y la sombra con el filo blanco adentro. */
function Boton({ ancho = false }: { ancho?: boolean }) {
  return <a href={RUTA_CTA} className={`d-prioridades-btn${ancho ? ' d-prioridades-btn-ancho' : ''}`}>{TEXTO_CTA}</a>;
}

function Hero({ b }: { b: B<'hero'> }) {
  const [tarjeta = '', nota] = b.puntos ?? [];
  const [titulo, lista = ''] = tarjeta.split(':');
  const vistas = lista.split(/,\s*|\s+y\s+/).map((v) => v.trim()).filter(Boolean);
  return (
    <header className="d-prioridades-hero">
      <div className="d-prioridades-w d-prioridades-hero-in">
        <p className="d-prioridades-etq">{b.etiqueta}</p>
        <h1 className="d-prioridades-h1" dangerouslySetInnerHTML={html(b.titulo)} />
        <p className="d-prioridades-bajada" dangerouslySetInnerHTML={html(b.bajada)} />
        <div className="d-prioridades-hero-cta"><Boton /></div>
        <div className="d-prioridades-hcard">
          <div className="d-prioridades-hcard-izq">
            <h2 className="d-prioridades-hcard-t" dangerouslySetInnerHTML={html(titulo)} />
            <ul className="d-prioridades-casillas">
              {vistas.map((v) => (
                <li key={v}><span className="d-prioridades-casilla-i"><Ico paths={VISTAS[v]} size={16} /></span><span>{v}</span></li>
              ))}
            </ul>
            <div className="d-prioridades-hcard-cta"><Boton /></div>
            {nota ? <p className="d-prioridades-nota" dangerouslySetInnerHTML={html(nota)} /> : null}
          </div>
          <div className="d-prioridades-hcard-vis"><div className="d-prioridades-ventana"><VisualDeLanding visual={b.visual} /></div></div>
        </div>
      </div>
    </header>
  );
}

/** «Stop using tech from the pre-AI era»: la columna gris de lo de siempre y la columna con el borde degradado. */
function Contraste({ b }: { b: B<'contraste'> }) {
  const lado = (it: Item, bueno: boolean) => (
    <div className={`d-prioridades-col ${bueno ? 'd-prioridades-col-bien' : 'd-prioridades-col-mal'}`}>
      <h3 className="d-prioridades-col-t" dangerouslySetInnerHTML={html(it.titulo)} />
      <ul className="d-prioridades-col-in">
        {it.texto.split(/<br\s*\/?>/).map((r) => (
          <li key={r}><span className="d-prioridades-col-ico"><Ico paths={bueno ? CHECK : CRUZ} size={10} grosor={3.2} /></span><p dangerouslySetInnerHTML={html(r)} /></li>
        ))}
      </ul>
    </div>
  );
  return (
    <section className="d-prioridades-s d-prioridades-contraste">
      <div className="d-prioridades-w">
        <h2 className="d-prioridades-h2" dangerouslySetInnerHTML={html(b.titulo)} />
        {b.etiqueta ? <p className="d-prioridades-sub" dangerouslySetInnerHTML={html(b.etiqueta)} /> : null}
        <div className="d-prioridades-cols">{lado(b.sin, false)}{lado(b.con, true)}</div>
        <div className="d-prioridades-cta-c"><Boton /></div>
      </div>
    </section>
  );
}

// ── Las ventanas de producto de las funciones que no tienen gráfico propio en FEATURE_VISUALS: va la pantalla real del Plan de
//    cada cosa. Hasta tener la grabación, el recuadro que dice qué va (12/11/2026: los dibujos a mano se sacaron).
function MockReunion() {
  return <FaltaAnimacion que="El borrador de una reunión en el Plan, tal cual es." />;
}

function MockTablero() {
  return <FaltaAnimacion que="El tablero del Plan con las tareas puntuadas, tal cual es." />;
}

function MockArchivos() {
  return <FaltaAnimacion que="Subir archivos al Plan y ver las tareas que salen." />;
}

function MockProductividad() {
  return <FaltaAnimacion que="La hoja Productividad del Dashboard, tal cual es." />;
}

type Acordeon = { id: string; titulo: string; bajada?: string; items: { titulo: string; texto: string; puntos?: string[] }[]; visuales: React.ReactNode[]; derecha: boolean };

/** «AI Task Planner» y las demás: el título de 60 px, el acordeón (el abierto con su borde de 4 px y su celeste) y la ventana. */
function Funcion({ a }: { a: Acordeon }) {
  return (
    <section className="d-prioridades-funcion" id={a.id}>
      <div className="d-prioridades-w">
        <h2 className="d-prioridades-h2-f" dangerouslySetInnerHTML={html(a.titulo)} />
        {a.bajada ? <p className="d-prioridades-sub d-prioridades-sub-f" dangerouslySetInnerHTML={html(a.bajada)} /> : null}
        <div className={`d-prioridades-fg${a.derecha ? ' d-prioridades-fg-der' : ''}`}>
          <div className="d-prioridades-acc">
            {a.items.map((it, i) => (
              <details key={it.titulo} name={a.id} open={i === 0} className="d-prioridades-acc-i">
                <summary><h3 dangerouslySetInnerHTML={html(it.titulo)} /><Ico paths={CHEVRON} size={18} grosor={2} /></summary>
                <div className="d-prioridades-acc-p">
                  <p dangerouslySetInnerHTML={html(it.texto)} />
                  {it.puntos?.map((p) => <p key={p} dangerouslySetInnerHTML={html(p)} />)}
                </div>
                <div className="d-prioridades-vis-i"><div className="d-prioridades-ventana">{a.visuales[i] ?? a.visuales[0]}</div></div>
              </details>
            ))}
          </div>
        </div>
        <div className="d-prioridades-cta-c"><Boton /></div>
      </div>
    </section>
  );
}

/** «What Teams & Businesses say about Motion»: su tarjeta con la foto arriba y el panel azul, con el caso de Mauricio. */
function Caso() {
  return (
    <section className="d-prioridades-s d-prioridades-caso">
      <div className="d-prioridades-w">
        <h2 className="d-prioridades-h2-m" dangerouslySetInnerHTML={html(CASO.titulo)} />
        <article className="d-prioridades-caso-card">
          <video className="d-prioridades-caso-video" muted autoPlay loop playsInline preload="metadata"><source src={CASO.video} type="video/mp4" /></video>
          <div className="d-prioridades-caso-azul">
            <h3>{CASO.sub}</h3>
            {CASO.historia.map((h) => <p key={h} dangerouslySetInnerHTML={html(h)} />)}
            <p dangerouslySetInnerHTML={html(CASO.resultado)} />
            <div className="d-prioridades-caso-quien"><b>{CASO.quien}</b><span>{CASO.rol}</span></div>
          </div>
        </article>
      </div>
    </section>
  );
}

/** «Why Motion's all-in-one platform is better…»: el título con su botón a la izquierda y los renglones celestes. */
function PorQue({ b }: { b: B<'tarjetas'> }) {
  return (
    <section className="d-prioridades-s d-prioridades-porque">
      <div className="d-prioridades-w d-prioridades-porque-g">
        <div>
          <h2 className="d-prioridades-h2-l" dangerouslySetInnerHTML={html(b.titulo)} />
          <Boton />
        </div>
        <ul className="d-prioridades-porque-l">
          {b.items.map((it) => (
            <li key={it.titulo}><span className="d-prioridades-porque-ico"><Ico paths={CHECK} size={11} grosor={3.4} /></span><p><b dangerouslySetInnerHTML={html(it.titulo + '.')} /> <span dangerouslySetInnerHTML={html(it.texto)} /></p></li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** «Pass data between your favorite tools»: el panel gris de radio 32 con las baldosas blancas de 94 px. */
function Logos({ b }: { b: B<'logos'> }) {
  return (
    <section className="d-prioridades-s d-prioridades-logos">
      <div className="d-prioridades-w">
        <h2 className="d-prioridades-h2-m">{b.titulo}</h2>
        <div className="d-prioridades-logos-panel">
          <ul>
            {b.items.map((l) => (
              // eslint-disable-next-line @next/next/no-img-element
              <li key={l.nombre}><span className="d-prioridades-logo-b"><img src={`/vsl-assets/logos/${l.logo}`} alt="" /></span><span className="d-prioridades-logo-n">{l.nombre}</span></li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Pie({ slug }: { slug: string }) {
  const otras = otrasFunciones(slug);
  const n = Math.ceil(otras.length / 3);
  const cols = [0, 1, 2].map((c) => otras.slice(n * c, n * (c + 1)));
  return (
    <footer className="d-prioridades-pie">
      <div className="d-prioridades-w d-prioridades-pie-g">
        <div className="d-prioridades-pie-marca"><LogoMaKo tamano={36} /><p>El mejor software para vender High Ticket.</p></div>
        {cols.map((col, i) => (
          <nav key={i} aria-label={i === 0 ? 'Funciones de MaKo' : undefined}>
            <h6 aria-hidden={i > 0 || undefined}>{i === 0 ? 'Funciones' : ' '}</h6>
            <ul>{col.map((o) => <li key={o.href}><a href={o.href}>{o.nombre}</a></li>)}</ul>
          </nav>
        ))}
      </div>
      <p className="d-prioridades-pie-copy">© MaKo — Todos los derechos reservados.</p>
    </footer>
  );
}

export default function DisenoPrioridades({ landing }: PropsDiseno) {
  const bl = landing.bloques;
  // Las funciones de Motion, en su orden, con lo que la landing de MaKo trae: la de «filas» con sus gráficos, y las otras con
  // su ventana. Las tarjetas son, en orden: proyectos, notas, avance y «por qué» (la última no es una función: es «Why…»).
  let nTarjetas = 0;
  let nFuncion = 0;
  const salida = bl.map((b, i) => {
    const k = `${b.tipo}-${i}`;
    switch (b.tipo) {
      case 'hero': return <Hero key={k} b={b} />;
      case 'contraste': return <Contraste key={k} b={b} />;
      case 'caso': return <Caso key={k} />;
      case 'logos': return <Logos key={k} b={b} />;
      case 'filas': {
        const derecha = nFuncion++ % 2 === 1;
        const visuales = b.items.map((f, j) => <Visual key={j} spec={FEATURE_VISUALS[b.slug]?.groups?.[f.grafico ?? j]} />);
        return <Funcion key={k} a={{ id: 'prioriza', titulo: b.titulo, bajada: b.bajada, items: b.items, visuales, derecha }} />;
      }
      case 'pasos': {
        const derecha = nFuncion++ % 2 === 1;
        const items = b.pasos.map((p, j) => ({ titulo: `${j + 1}. ${p.titulo}`, texto: p.texto }));
        return <Funcion key={k} a={{ id: 'reuniones', titulo: b.titulo, bajada: b.bajada, items, visuales: [<MockReunion key="r" />], derecha }} />;
      }
      case 'tarjetas': {
        const n = nTarjetas++;
        if (b.columnas === 2) return <PorQue key={k} b={b} />;
        const derecha = nFuncion++ % 2 === 1;
        const visual = n === 0 ? <MockTablero /> : n === 1 ? <MockArchivos /> : <MockProductividad />;
        const id = n === 0 ? 'proyectos' : n === 1 ? 'notas' : 'avance';
        return <Funcion key={k} a={{ id, titulo: b.titulo, bajada: b.bajada, items: b.items, visuales: [visual], derecha }} />;
      }
      default: return null;
    }
  });
  return (
    <div className="d-prioridades">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <nav className="d-prioridades-nav" aria-label="Secciones">
        <div className="d-prioridades-w d-prioridades-nav-in">
          <LogoMaKo tamano={32} />
          <ul className="d-prioridades-nav-l">
            <li><a href="#prioriza">Prioridades</a></li>
            <li><a href="#proyectos">Proyectos</a></li>
            <li><a href="#reuniones">Reuniones</a></li>
            <li><a href="#avance">Avance</a></li>
          </ul>
          <Boton />
        </div>
      </nav>
      <main>
        {salida}
        <section className="d-prioridades-cierre">
          <div className="d-prioridades-w">
            <h2 className="d-prioridades-cierre-h">¿Lo quieres funcionando en tu negocio?</h2>
            <div className="d-prioridades-cta-c"><Boton /></div>
            <p className="d-prioridades-nota d-prioridades-nota-c">{TEXTO_CIERRE}</p>
          </div>
        </section>
      </main>
      <Pie slug={landing.slug} />
    </div>
  );
}

const CSS = `
@font-face { font-family: 'Albert Sans'; src: url('/vsl-assets/fuentes/albert-sans/albert-sans-latin.woff2') format('woff2'); font-weight: 100 900; font-style: normal; font-display: swap; }
@font-face { font-family: 'Inter'; src: url('/vsl-assets/fuentes/inter/inter-latin-var.woff2') format('woff2'); font-weight: 100 900; font-style: normal; font-display: swap; }
.d-prioridades { background: #fff; color: #000; font-family: 'Inter', ui-sans-serif, system-ui, sans-serif; font-size: 16px; line-height: 24px; -webkit-font-smoothing: antialiased; overflow-x: clip; }
:where(.d-prioridades) *, :where(.d-prioridades) *::before, :where(.d-prioridades) *::after { box-sizing: border-box; }
:where(.d-prioridades) :where(p, h1, h2, h3, h4, h5, h6, ul, ol) { margin: 0; padding: 0; }
:where(.d-prioridades) :where(ul, ol) { list-style: none; }
:where(.d-prioridades) a { color: inherit; }
.d-prioridades-w { width: 100%; max-width: 1264px; margin: 0 auto; padding: 0 32px; }

/* Títulos: Albert Sans 600 */
.d-prioridades-h1, .d-prioridades-h2, .d-prioridades-h2-f, .d-prioridades-h2-m, .d-prioridades-h2-l, .d-prioridades-hcard-t, .d-prioridades-col-t, .d-prioridades-acc-i h3, .d-prioridades-caso-azul h3, .d-prioridades-cierre-h, .d-prioridades-etq { font-family: 'Albert Sans', 'Inter', sans-serif; font-weight: 600; }
.d-prioridades-h2 { font-size: 34px; line-height: 46.75px; letter-spacing: -0.3px; text-align: center; color: #000; text-wrap: balance; }
.d-prioridades-h2-f { font-size: 60px; line-height: 75px; letter-spacing: -0.3px; text-align: center; color: #000; text-wrap: balance; }
.d-prioridades-h2-m { font-size: 48px; line-height: 60px; letter-spacing: -0.3px; text-align: center; color: #000; text-wrap: balance; }
.d-prioridades-h2-l { font-size: 34px; line-height: 46.75px; letter-spacing: -0.3px; color: #000; margin-bottom: 32px; }
.d-prioridades-sub { margin-top: 16px; text-align: center; font-size: 16px; line-height: 24px; color: #495161; }
.d-prioridades-sub-f { margin-top: -40px; margin-bottom: 64px; font-size: 18px; line-height: 28px; }
.d-prioridades-h1 em, .d-prioridades-hcard-t em { font-style: normal; }

/* Botón: 48 px, 12 20, radio 8, 16/600 blanco, el degradado de arriba abajo y su sombra */
.d-prioridades-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 48px; padding: 12px 20px; border-radius: 8px; background: #2F6FED linear-gradient(#5B8EF5 0%, #2F6FED 100%); color: #fff; font-size: 16px; line-height: 24px; font-weight: 600; text-decoration: none; white-space: nowrap; box-shadow: 0 2px 5px rgba(0,0,0,.2), inset 0 0 0 1px rgba(0,0,0,.1), inset 0 2px 0 rgba(255,255,255,.2); transition: filter .2s, transform .2s, box-shadow .2s; }
.d-prioridades-btn:hover { filter: brightness(1.06); transform: translateY(-1px); box-shadow: 0 6px 16px rgba(47,111,237,.3), inset 0 0 0 1px rgba(0,0,0,.1), inset 0 2px 0 rgba(255,255,255,.2); }
.d-prioridades-cta-c { display: flex; justify-content: center; margin-top: 32px; }
.d-prioridades-nota { margin-top: 16px; font-size: 14px; line-height: 20px; color: #495161; }

/* Barra: 96 de alto (24 0), el logo a la izquierda, los links (12 de relleno, 16/500 #475467) y el botón a la derecha */
.d-prioridades-nav { position: absolute; top: 0; left: 0; right: 0; z-index: 20; padding: 24px 0; }
.d-prioridades-nav-in { display: flex; align-items: center; gap: 16px; }
.d-prioridades-nav-in > a:first-child { margin-right: auto; color: #101828 !important; }
.d-prioridades-nav-l { display: flex; }
.d-prioridades-nav-l a { display: inline-flex; padding: 12px; font-size: 16px; line-height: 24px; font-weight: 500; color: #475467; text-decoration: none; transition: color .2s; }
.d-prioridades-nav-l a:hover { color: #101828; }

/* Hero: el degradado de 125°, 96 arriba, todo centrado; h1 88 / 96,8, -2,2 px */
.d-prioridades-hero { padding: 96px 0 80px; background: linear-gradient(125deg, rgba(47,111,237,.05), rgba(242,176,30,.05), rgba(47,111,237,.08), rgba(242,176,30,.05), rgba(47,111,237,.05)); }
.d-prioridades-hero-in { display: flex; flex-direction: column; align-items: center; text-align: center; }
.d-prioridades-etq { margin-top: 87px; font-size: 16px; line-height: 32px; letter-spacing: -0.4px; color: transparent; background: linear-gradient(#5B8EF5 0%, #2F6FED 100%); -webkit-background-clip: text; background-clip: text; }
.d-prioridades-h1 { margin-top: 9px; max-width: 783px; font-size: 88px; line-height: 96.8px; letter-spacing: -2.2px; color: #000; animation: d-prioridades-sube .8s cubic-bezier(.16,1,.3,1) both; }
.d-prioridades-h1 em { color: transparent; background: linear-gradient(80.74deg, #7FA6F7 9.74%, #2F6FED 93.68%); -webkit-background-clip: text; background-clip: text; }
.d-prioridades-bajada { margin-top: 24px; max-width: 900px; font-size: 18px; line-height: 28px; color: #495161; }
.d-prioridades-bajada strong { color: #101828; font-weight: 600; }
.d-prioridades-hero-cta { margin-top: 40px; }
/* La tarjeta: 1200, 32 de relleno, radio 12, su sombra azulada; a la izquierda el título de 24 y las casillas, a la derecha la ventana de 736 × 522 */
.d-prioridades-hcard { margin-top: 76px; width: 100%; display: grid; grid-template-columns: minmax(0, 368fr) minmax(0, 736fr); gap: 32px; padding: 32px; border-radius: 12px; background: #fff; box-shadow: 0 -4px 80px rgba(47,111,237,.05), 0 2px 32px rgba(47,111,237,.14), inset 0 0 0 1px #F1F2F4; text-align: left; }
.d-prioridades-hcard-izq { display: flex; flex-direction: column; align-items: center; }
.d-prioridades-hcard-t { align-self: stretch; font-size: 24px; line-height: 32px; letter-spacing: -0.6px; color: #000; }
.d-prioridades-casillas { margin-top: 32px; align-self: stretch; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.d-prioridades-casillas li { height: 80px; padding: 12px; border-radius: 8px; border: 1px solid #EDEFF0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; font-size: 14px; line-height: 20px; font-weight: 500; color: #495161; transition: border-color .2s, transform .2s; }
.d-prioridades-casillas li:hover { border-color: #C9D8FA; transform: translateY(-1px); }
.d-prioridades-casilla-i { width: 28px; height: 28px; border-radius: 4px; background: #EEF5FF; color: #2F6FED; display: inline-flex; align-items: center; justify-content: center; }
.d-prioridades-hcard-cta { margin-top: 32px; }
.d-prioridades-hcard-izq .d-prioridades-nota { text-align: center; }
.d-prioridades-hcard-vis { min-height: 522px; border-radius: 8px; overflow: hidden; display: flex; }
.d-prioridades-hcard-vis .d-prioridades-ventana { flex: 1; border-radius: 8px; }

/* La ventana de producto: el celeste de Motion (#E5F5FF → #DFEDFF), radio 12, y la app en blanco adentro */
.d-prioridades-ventana { display: flex; align-items: center; justify-content: center; padding: 40px 44px; border-radius: 12px; background: linear-gradient(135deg, #E5F5FF 0%, #D9EFFF 50%, #DFEDFF 100%); }
.d-prioridades-ventana > * { width: 100%; max-width: 560px; border-radius: 8px; background: #fff; box-shadow: 0 1px 2px rgba(16,24,40,.06), 0 12px 32px rgba(61,98,208,.12); overflow: hidden; }
.d-prioridades-ventana svg { display: block; width: 100%; height: auto; }

/* «Stop using tech…»: dos columnas de 588 con 24 de espacio; la gris #F0F4F8 y la del degradado, radio 24, 0 8 8 */
.d-prioridades-s { padding: 64px 0; }
.d-prioridades-contraste { padding-top: 80px; background: linear-gradient(#EEF5FF 0%, #fff 200px); }
.d-prioridades-cols { margin-top: 32px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; }
.d-prioridades-col { display: flex; flex-direction: column; padding: 0 8px 8px; border-radius: 24px; }
.d-prioridades-col-mal { background: #F0F4F8; }
.d-prioridades-col-bien { background: linear-gradient(122deg, #8FB2F8 0%, #5B8EF5 35%, #2F6FED 72%, #1F57C8 100%); }
.d-prioridades-col-t { padding: 16px 0; text-align: center; font-size: 20px; line-height: 28px; color: #6F7788; }
.d-prioridades-col-bien .d-prioridades-col-t { color: #fff; }
.d-prioridades-col-in { flex: 1; padding: 24px; border-radius: 16px; background: #fff; }
.d-prioridades-col-in li { display: flex; gap: 12px; margin-bottom: 16px; }
.d-prioridades-col-in li:last-child { margin-bottom: 0; }
.d-prioridades-col-in p { font-size: 16px; line-height: 24px; color: #495161; }
.d-prioridades-col-in strong { color: #000; font-weight: 600; }
.d-prioridades-col-ico { flex: none; margin-top: 5px; width: 14px; height: 14px; border-radius: 9999px; display: inline-flex; align-items: center; justify-content: center; }
.d-prioridades-col-mal .d-prioridades-col-ico { background: rgba(71,84,103,.5); color: #fff; }
.d-prioridades-col-bien .d-prioridades-col-ico { background: #CDF0DD; color: #17A34A; }

/* Las funciones: 128 entre una y otra; título 60 / 75 con 64 abajo; grilla 461 / 691 con 48 */
.d-prioridades-funcion { padding: 104px 0 24px; }
.d-prioridades-funcion .d-prioridades-h2-f { margin-bottom: 64px; }
/* La columna del acordeón mide 460,8 de 1200 (38,4 %) y la ventana del abierto se ubica en los otros 691,2, a 48 */
.d-prioridades-fg { position: relative; min-height: 487px; }
.d-prioridades-acc { display: flex; flex-direction: column; width: 38.4%; }
.d-prioridades-fg-der .d-prioridades-acc { margin-left: auto; }
.d-prioridades-acc-i { border-left: 1px solid rgba(16,24,40,.1); padding-left: 3px; border-radius: 0 12px 12px 0; transition: background-color .3s; }
.d-prioridades-acc-i[open] { border-left: 4px solid #2F6FED; padding-left: 0; background: #F1F7FF; }
.d-prioridades-acc-i summary { list-style: none; display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; padding: 24px; cursor: pointer; color: #848B97; }
.d-prioridades-acc-i[open] summary { padding-bottom: 12px; color: #101828; }
.d-prioridades-acc-i summary::-webkit-details-marker { display: none; }
.d-prioridades-acc-i summary:hover { color: #475467; }
.d-prioridades-acc-i h3 { font-size: 20px; line-height: 28px; color: inherit; }
.d-prioridades-acc-i summary svg { flex: none; margin-top: 5px; transition: transform .3s; }
.d-prioridades-acc-i[open] summary svg { transform: rotate(180deg); }
.d-prioridades-acc-p { padding: 0 24px 24px; display: flex; flex-direction: column; gap: 12px; }
.d-prioridades-acc-p p { font-size: 14px; line-height: 20px; color: #495161; }
.d-prioridades-acc-p strong { color: #101828; font-weight: 600; }
.d-prioridades-vis-i { position: absolute; top: 0; left: calc(38.4% + 48px); right: 0; animation: d-prioridades-aparece .45s ease both; }
.d-prioridades-fg-der .d-prioridades-vis-i { left: 0; right: calc(38.4% + 48px); }
.d-prioridades-vis-i .d-prioridades-ventana { min-height: 487px; }

/* Las ventanas propias */
.d-prioridades-mock { padding: 18px 20px 20px; font-size: 13px; line-height: 18px; color: #101828; text-align: left; }
.d-prioridades-mock-cab { display: flex; align-items: center; gap: 8px; padding-bottom: 12px; border-bottom: 1px solid #EEF0F3; font-size: 15px; }
.d-prioridades-mock-pt { width: 8px; height: 8px; border-radius: 50%; background: #2F6FED; }
.d-prioridades-mock-l { margin-top: 10px; display: flex; flex-direction: column; }
.d-prioridades-mock-l li { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid #F2F4F7; }
.d-prioridades-mock-l li > span:nth-child(2) { flex: 1; }
.d-prioridades-mock-l i { font-style: normal; padding: 2px 8px; border-radius: 9999px; background: #EEF5FF; color: #2F6FED; font-size: 11px; line-height: 16px; font-weight: 600; white-space: nowrap; }
.d-prioridades-mock-l i.d-prioridades-mock-i-gris { background: #F2F4F7; color: #667085; }
.d-prioridades-mock-cb { width: 16px; height: 16px; flex: none; border-radius: 4px; border: 1.5px solid #2F6FED; background: #2F6FED; box-shadow: inset 0 0 0 3px #fff; }
.d-prioridades-mock-cb-off { border-color: #D0D5DD; background: #fff; }
.d-prioridades-mock-gris { color: #98A2B3; text-decoration: line-through; }
.d-prioridades-mock-pie { margin-top: 14px; display: flex; justify-content: flex-end; }
.d-prioridades-mock-b { padding: 6px 14px; border-radius: 6px; background: #2F6FED; color: #fff; font-weight: 600; }
.d-prioridades-mock-tab { margin-top: 14px; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.d-prioridades-mock-col { min-height: 220px; padding: 8px; border-radius: 8px; background: #F7F8FB; display: flex; flex-direction: column; gap: 8px; }
.d-prioridades-mock-col p { font-size: 11.5px; line-height: 16px; font-weight: 600; color: #475467; }
.d-prioridades-mock-card { display: flex; flex-direction: column; gap: 6px; padding: 8px; border-radius: 6px; background: #fff; box-shadow: 0 1px 2px rgba(16,24,40,.08); font-size: 11.5px; line-height: 15px; }
.d-prioridades-mock-card-ok { color: #98A2B3; text-decoration: line-through; }
.d-prioridades-mock-card i { align-self: flex-start; font-style: normal; text-decoration: none; padding: 1px 6px; border-radius: 9999px; font-size: 10px; font-weight: 600; background: #EEF5FF; color: #2F6FED; }
.d-prioridades-mock-card i[data-p="Alta"] { background: #FDECEC; color: #C2383F; }
.d-prioridades-mock-card i[data-p="Baja"] { background: #E9F8EF; color: #157F46; }
.d-prioridades-mock-chips { margin-top: 14px; display: flex; flex-wrap: wrap; gap: 8px; }
.d-prioridades-mock-chips span { padding: 6px 10px; border-radius: 6px; border: 1px dashed #B9CBF5; background: #F5F8FF; color: #344054; font-weight: 500; }
.d-prioridades-mock-sub { margin-top: 16px; font-size: 12px; color: #667085; font-weight: 600; }
.d-prioridades-mock-barras { margin-top: 14px; display: flex; flex-direction: column; gap: 14px; }
.d-prioridades-mock-barras li { display: grid; grid-template-columns: 96px 1fr; align-items: center; gap: 12px; }
.d-prioridades-mock-barras i { display: block; height: 10px; border-radius: 9999px; background: #EEF2F7; overflow: hidden; }
.d-prioridades-mock-barras b { display: block; height: 100%; border-radius: 9999px; background: linear-gradient(90deg, #5B8EF5, #2F6FED); transform-origin: left; animation: d-prioridades-llena 1.2s .2s cubic-bezier(.16,1,.3,1) both; }
.d-prioridades-mock-tags { margin-top: 18px; display: flex; flex-wrap: wrap; gap: 8px; }
.d-prioridades-mock-tags span { padding: 4px 10px; border-radius: 9999px; background: #FEF6E4; color: #93600A; font-size: 11.5px; font-weight: 600; }
.d-prioridades-mock-tags span + span { background: #E9F8EF; color: #157F46; }

/* El caso: la tarjeta de «Teams & Businesses» (la imagen y el panel azul, radio 12), a lo ancho */
.d-prioridades-caso { padding-top: 104px; }
.d-prioridades-caso-card { margin-top: 64px; display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); border-radius: 12px; overflow: hidden; transition: transform .3s, box-shadow .3s; }
.d-prioridades-caso-card:hover { transform: translateY(-2px); box-shadow: 0 16px 40px rgba(47,111,237,.18); }
.d-prioridades-caso-video { display: block; width: 100%; height: 100%; aspect-ratio: 16 / 9; object-fit: cover; background: #0B1220; }
.d-prioridades-caso-azul { display: flex; flex-direction: column; gap: 12px; padding: 24px; background: linear-gradient(to right bottom, #5B8EF5 0%, #2F6FED 100%); color: #fff; }
.d-prioridades-caso-azul h3 { font-size: 24px; line-height: 32px; letter-spacing: -0.6px; margin-bottom: 4px; }
.d-prioridades-caso-azul p { font-size: 14px; line-height: 22.75px; }
.d-prioridades-caso-azul strong { font-weight: 700; }
.d-prioridades-caso-quien { margin-top: auto; padding-top: 24px; display: flex; flex-direction: column; font-size: 14px; line-height: 20px; }
.d-prioridades-caso-quien b { font-size: 16px; line-height: 24px; font-weight: 600; }

/* «Why…»: grilla 494 / 658 con 48; renglones #EEF5FF, 16 de relleno, 8 entre ellos, el tilde azul */
.d-prioridades-porque-g { display: grid; grid-template-columns: minmax(0, 493.7fr) minmax(0, 658.3fr); gap: 48px; align-items: start; }
.d-prioridades-porque-l { display: flex; flex-direction: column; gap: 8px; }
.d-prioridades-porque-l li { display: flex; gap: 12px; padding: 16px; border-radius: 6px; background: #EEF5FF; font-size: 16px; line-height: 24px; color: #101828; transition: background-color .2s; }
.d-prioridades-porque-l li:hover { background: #E3EEFF; }
.d-prioridades-porque-l b { font-weight: 600; }
.d-prioridades-porque-ico { flex: none; margin-top: 3px; width: 18px; height: 18px; border-radius: 9999px; background: #2F6FED; color: #fff; display: inline-flex; align-items: center; justify-content: center; }

/* Integraciones: el panel #F7F8FB de radio 32 y las baldosas blancas de 94 (16 de relleno, radio 8, su sombra azul) */
.d-prioridades-logos-panel { margin-top: 48px; padding: 64px 32px; border-radius: 32px; background: #F7F8FB; }
.d-prioridades-logos-panel ul { display: flex; flex-wrap: wrap; justify-content: center; gap: 40px; }
.d-prioridades-logos-panel li { width: 160px; display: flex; flex-direction: column; align-items: center; gap: 12px; }
.d-prioridades-logo-b { width: 94px; height: 94px; padding: 16px; border-radius: 8px; background: #fff; box-shadow: 0 2.34px 14.02px rgba(61,98,208,.06); display: flex; align-items: center; justify-content: center; transition: transform .25s; }
.d-prioridades-logos-panel li:hover .d-prioridades-logo-b { transform: translateY(-3px); }
.d-prioridades-logo-b img { width: 62px; height: 62px; object-fit: contain; }
.d-prioridades-logo-n { text-align: center; font-size: 14px; line-height: 20px; font-weight: 500; color: #475467; }

/* Cierre: 96 32 sobre el celeste que sube; el título de 64 / 80, 700, con el degradado azul */
.d-prioridades-cierre { padding: 96px 0; text-align: center; background: linear-gradient(#EEF5FF 0%, #fff 50%); }
.d-prioridades-cierre-h { max-width: 1000px; margin: 0 auto; font-size: 64px; line-height: 80px; letter-spacing: -1.92px; font-weight: 700; color: transparent; background: linear-gradient(#5B8EF5 0%, #2F6FED 100%); -webkit-background-clip: text; background-clip: text; text-wrap: balance; }
.d-prioridades-nota-c { text-align: center; }

/* Pie: 96 32, el celeste arriba; la marca y tres columnas de 267 (encabezado 16/600, links 16 con 8 0) */
.d-prioridades-pie { padding: 96px 0; background: linear-gradient(#EEF5FF 0%, #fff 120px); }
.d-prioridades-pie-g { display: grid; grid-template-columns: minmax(0, 400fr) repeat(3, minmax(0, 267fr)); gap: 24px; }
.d-prioridades-pie-marca > a { color: #101828 !important; }
.d-prioridades-pie-marca p { margin-top: 16px; max-width: 280px; font-size: 14px; line-height: 20px; color: #495161; }
.d-prioridades-pie h6 { min-height: 24px; margin-bottom: 16px; font-size: 16px; line-height: 24px; font-weight: 600; color: #101828; }
.d-prioridades-pie nav a { display: block; padding: 8px 0; font-size: 16px; line-height: 24px; color: #495161; text-decoration: none; transition: color .2s; }
.d-prioridades-pie nav a:hover { color: #2F6FED; }
.d-prioridades-pie-copy { max-width: 1264px; margin: 40px auto 0; padding: 0 32px; font-size: 14px; line-height: 20px; color: #667085; }

@keyframes d-prioridades-sube { 0% { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
@keyframes d-prioridades-aparece { 0% { opacity: 0; } to { opacity: 1; } }
@keyframes d-prioridades-llena { 0% { transform: scaleX(0); } to { transform: scaleX(1); } }

@media (max-width: 1023px) {
  .d-prioridades-nav-l { display: none; }
  .d-prioridades-hcard { grid-template-columns: minmax(0, 1fr); }
  .d-prioridades-hcard-vis { order: -1; min-height: 0; }
  .d-prioridades-fg { min-height: 0; }
  .d-prioridades-acc { width: 100%; }
  .d-prioridades-vis-i, .d-prioridades-fg-der .d-prioridades-vis-i { position: static; padding: 0 16px 16px; }
  .d-prioridades-vis-i .d-prioridades-ventana { min-height: 0; }
  .d-prioridades-mock-tab { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .d-prioridades-mock-col { min-height: 0; }
  .d-prioridades-porque-g { grid-template-columns: minmax(0, 1fr); }
  .d-prioridades-pie-g { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .d-prioridades-pie-marca { grid-column: 1 / -1; }
}

/* 390: 16 a los lados, h1 31,2, títulos 28 / 38,5, el botón del hero a lo ancho, todo en una columna */
@media (max-width: 767px) {
  .d-prioridades-w { padding: 0 16px; }
  .d-prioridades-nav { padding: 24px 0; }
  .d-prioridades-nav-in > a:first-child > span:last-child { display: none; }
  .d-prioridades-hero { padding-bottom: 48px; }
  .d-prioridades-etq { margin-top: 24px; max-width: 280px; }
  .d-prioridades-h1 { margin-top: 8px; max-width: 300px; font-size: 31.2px; line-height: 34.32px; letter-spacing: -0.78px; }
  .d-prioridades-bajada { max-width: 300px; }
  .d-prioridades-hero-cta { margin-top: 32px; width: 100%; }
  .d-prioridades-hero-cta .d-prioridades-btn { width: 100%; }
  .d-prioridades-hcard { margin-top: 32px; padding: 0 16px 24px; gap: 24px; }
  .d-prioridades-hcard-vis { margin: 0 -16px; }
  .d-prioridades-hcard-vis .d-prioridades-ventana { border-radius: 12px 12px 0 0; padding: 24px 16px; }
  .d-prioridades-hcard-t { text-align: center; font-size: 20px; line-height: 28px; }
  .d-prioridades-h2, .d-prioridades-h2-l { font-size: 28px; line-height: 38.5px; }
  .d-prioridades-h2-f, .d-prioridades-h2-m { font-size: 28px; line-height: 38.5px; }
  .d-prioridades-funcion { padding: 72px 0 16px; }
  .d-prioridades-funcion .d-prioridades-h2-f { margin-bottom: 32px; }
  .d-prioridades-sub-f { margin-top: -16px; margin-bottom: 32px; font-size: 16px; line-height: 24px; }
  .d-prioridades-cols { grid-template-columns: minmax(0, 1fr); gap: 8px; }
  .d-prioridades-col { border-radius: 12px; }
  .d-prioridades-acc-i summary { padding: 24px 24px 24px 28px; }
  .d-prioridades-acc-p { padding: 0 24px 24px 28px; }
  .d-prioridades-ventana { padding: 24px 16px; }
  .d-prioridades-caso { padding-top: 72px; }
  .d-prioridades-caso-card { margin-top: 32px; grid-template-columns: minmax(0, 1fr); }
  .d-prioridades-caso-video { aspect-ratio: 389 / 215; height: auto; }
  .d-prioridades-caso-azul { padding: 16px; }
  .d-prioridades-porque-g { gap: 24px; }
  .d-prioridades-logos-panel { margin-top: 32px; padding: 40px 16px; border-radius: 24px; }
  .d-prioridades-logos-panel ul { gap: 24px; }
  .d-prioridades-logos-panel li { width: 120px; }
  .d-prioridades-cierre { padding: 72px 0; }
  .d-prioridades-cierre-h { font-size: 40px; line-height: 48px; letter-spacing: -1.2px; }
  .d-prioridades-pie { padding: 64px 0; }
  .d-prioridades-pie-g { grid-template-columns: minmax(0, 1fr); gap: 32px; }
  .d-prioridades-pie h6[aria-hidden] { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  .d-prioridades *, .d-prioridades *::before, .d-prioridades *::after { animation: none !important; transition: none !important; }
}
`;
