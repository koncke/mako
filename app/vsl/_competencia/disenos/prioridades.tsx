// =============================================================================
// /vsl/prioridades con el DISEÑO de la portada de Motion (https://www.usemotion.com/), copiado el 11/11/2026 y vuelto a mirar
// el 14/11/2026 (noche) para que la copia sea fiel en lo que se MUEVE
// =============================================================================
// Los valores (Albert Sans en los títulos e Inter en el texto, la escala 88 / 60 / 48 / 34 / 20, el contenedor de 1200, el
// degradado del hero, la tarjeta del hero con sus casillas, las dos columnas «normal / con IA», los acordeones de las
// funciones, la tarjeta azul del caso, los renglones celestes de «Why…», el panel gris de integraciones, el cierre con el
// título degradado y el pie) se leyeron con getComputedStyle a 1440 y 390 px: docs/diseno/landings-competencia/prioridades.md.
// El relevo del 14/11 (capturas, video, hovers medidos antes y después): carpeta de notas, referencias-landings/prioridades/.
//
// LO QUE SE MUEVE EN MOTION, Y CÓMO VA ACÁ (medido con getAnimations, el MutationObserver y su JavaScript, que es chico):
//   · El fondo del hero se corre solo: `bg-subtle-shift` 12 s ease-in-out infinito, el degradado al 200 % de 0 % a 100 % y vuelta.
//   · La tarjeta del hero: cada casilla (un checkbox) cambia el video de la derecha por el suyo (su script pone `video.src`).
//     Sin ninguna marcada corre uno general. Acá: cada vista del Plan con su pantalla, y sin marcar, «Re-priorizar todo».
//   · Los acordeones de cada función son RADIOS (uno abierto a la vez) y su pantalla vive en la columna de al lado, PEGADA
//     (`position: sticky; top: 112px`); al tocar un renglón la pantalla se cambia de golpe (su script copia el HTML) y el texto
//     abre sin animar. Lo único con transición son los colores (150 ms) y la flecha que gira. Acá es CSS (`:has(:checked)`), sin JS.
//   · Los hovers medidos: el botón sólo aclara (`brightness(1.05)`, 150 ms); la casilla del hero pasa su contorno al azul; el
//     renglón del acordeón pasa su borde a 4 px, su fondo al 2 % y su título a tinta; la tarjeta del caso crece al 102 %; los
//     links del pie pasan al azul. Los renglones de «Why…», las baldosas de integraciones y las columnas NO tienen hover.
//   · Sus videos arrancan solos, sin sonido y en bucle, recién al verse. Acá igual (el `<script data-visor>` de abajo).
// De MaKo quedan el logo, el azul #2F6FED, el caso de Mauricio, los textos y las PANTALLAS: el Plan real grabado en el banco
// C:/dev/bancos-portada/banco-plan-landing (TodoBoard con el negocio ficticio «Cierre Consultivo»), en public/vsl-assets/prioridades/.
//
// Secciones de la referencia que NO van, y por qué:
//   · «Voted #1 hottest product by Amplitude» (su premio), «Over 1 million top performers» con sus logos, «Motion is built for
//     individuals and teams» con sus cuatro citas, «What Individual Users say» (su carrusel; sus flechas mueven 1 px: casi no se
//     mueven), «1 person or 1,000-person team», «Motion replaces…» con los logos de otras apps, «Enterprise Grade Security» con
//     sus sellos y los logos de prensa: son premios, contadores, testimonios, sellos o logos suyos (la regla de /vsl).
//   · «AI Calendar Assistant» y «AI Workflows Builder»: MaKo no lo hace (ver la cabecera de ../prioridades.ts).
//   · «Add your ideas… whether at or away from desk» (sus capturas en computadora y teléfono) y «Robust API…»: lo del teléfono y
//     Calendar va en «Por qué…».
//   · La nota «Start your free trial. Cancel in 1 click.» debajo de cada botón, el campo de email del hero en el teléfono y la
//     ventana de prueba que abre su botón (un cuestionario de «cuántos son en tu equipo»): el botón de MaKo lleva a empezar.
// =============================================================================

import type { PropsDiseno } from '.';
import type { Bloque, Item } from '../tipos';
import { RUTA_CTA, CASO, LogoMaKo, TEXTO_CTA, html, otrasFunciones, TEXTO_CIERRE } from '../marca';
import { FaltaAnimacion } from '../FaltaAnimacion';

type B<T extends Bloque['tipo']> = Extract<Bloque, { tipo: T }>;

function Ico({ paths, size = 16, grosor = 2, className }: { paths?: string[]; size?: number; grosor?: number; className?: string }) {
  if (!paths?.length) return null;
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={grosor} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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

// ── LAS PANTALLAS. Grabadas del Plan real (banco-plan-landing; cada video arranca en su primer cuadro y su póster ES ese cuadro).
type Medio = { tipo: 'video'; src: string; poster: string; que: string } | { tipo: 'foto'; src: string; que: string } | { tipo: 'falta'; que: string };
const DIR = '/vsl-assets/prioridades';
const V = (n: string, que: string): Medio => ({ tipo: 'video', src: `${DIR}/${n}.webm`, poster: `${DIR}/${n}.jpg`, que });
const FOTO = (n: string, que: string): Medio => ({ tipo: 'foto', src: `${DIR}/${n}.jpg`, que });
const FALTA = (que: string): Medio => ({ tipo: 'falta', que });

/** La tarjeta del hero: sin casilla marcada corre «Re-priorizar todo»; cada casilla, su vista. */
export const HERO_INICIAL: Medio = V('repriorizar', 'Re-priorizar todo: MaKo puntúa cada tarea del tablero y deja su razón');
export const PANTALLA_DE_VISTA: Record<string, Medio> = {
  Prioridades: V('prioridades', 'La vista Prioridades: el objetivo principal y las cinco que van primero'),
  Tareas: V('tablero', 'El tablero por estado: una tarea pasa de Por iniciar a En proceso'),
  Proyectos: FOTO('proyectos', 'La vista Proyectos, cada uno con su avance'),
  Recurrentes: FOTO('recurrentes', 'La vista Recurrentes: lo que se repite, aparte'),
};
/** Cada acordeón (por su id) con la pantalla de cada renglón, en orden. Uno que no tiene la suya usa la primera. */
export const PANTALLAS_DE_FUNCION: Record<string, Medio[]> = {
  prioriza: [HERO_INICIAL, PANTALLA_DE_VISTA.Prioridades, V('a-mano', 'La prioridad a mano: el número que pones, MaKo no lo vuelve a tocar')],
  proyectos: [PANTALLA_DE_VISTA.Tareas, FOTO('por-proyecto', 'El tablero filtrado por un proyecto'), PANTALLA_DE_VISTA.Recurrentes],
  reuniones: [FALTA('El borrador de una reunión en el Plan, tal cual es.')],
  notas: [FALTA('Subir archivos al Plan y ver las tareas que salen.')],
  avance: [FALTA('La hoja Productividad del Dashboard, tal cual es.')],
};

function Pantalla({ m, primera = false }: { m: Medio; primera?: boolean }) {
  if (m.tipo === 'falta') return <FaltaAnimacion que={m.que} />;
  // eslint-disable-next-line @next/next/no-img-element
  if (m.tipo === 'foto') return <img className="d-prioridades-pantalla" src={m.src} alt={m.que} loading="lazy" decoding="async" />;
  // Arranca el script (al verse, como Motion: `data-lazy`); sin JavaScript, el primero arranca solo.
  return <video className="d-prioridades-pantalla" src={m.src} poster={m.poster} aria-label={m.que} muted loop playsInline autoPlay={primera} preload={primera ? 'metadata' : 'none'} data-pr-video="" />;
}

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
        <div className="d-prioridades-hcard" id="d-prioridades-hcard">
          <div className="d-prioridades-hcard-vis">
            <div className="d-prioridades-hm" data-hm="" data-activo="">
              <Pantalla m={HERO_INICIAL} primera />
            </div>
            {vistas.map((v) => PANTALLA_DE_VISTA[v] ? <div key={v} className="d-prioridades-hm" data-hm={v}><Pantalla m={PANTALLA_DE_VISTA[v]} /></div> : null)}
          </div>
          <div className="d-prioridades-hcard-izq">
            <h2 className="d-prioridades-hcard-t" dangerouslySetInnerHTML={html(titulo)} />
            {/* data-tema-fijo: la casilla marcada cambia su contorno con :checked, y el sol y la luna lee los colores UNA vez al
                cargar (la dejaría congelada); su modo oscuro va escrito abajo con html[data-sitio-modo="oscuro"]. */}
            <div className="d-prioridades-casillas" data-tema-fijo="">
              {vistas.map((v) => (
                <label key={v} className="d-prioridades-casilla" data-vista={v}>
                  <input type="checkbox" className="d-prioridades-oculto" aria-label={`Ver ${v}`} />
                  <span className="d-prioridades-casilla-i"><Ico paths={VISTAS[v]} size={16} /></span>
                  <span className="d-prioridades-casilla-n">{v}</span>
                  <span className="d-prioridades-casilla-c"><Ico paths={CHECK} size={10} grosor={3.4} /></span>
                </label>
              ))}
            </div>
            <div className="d-prioridades-hcard-cta"><Boton /></div>
            {nota ? <p className="d-prioridades-nota" dangerouslySetInnerHTML={html(nota)} /> : null}
          </div>
        </div>
      </div>
    </header>
  );
}

/** «Stop using tech from the pre-AI era»: la columna gris de lo de siempre y la columna con el borde degradado. Cada renglón
 *  es «Título: texto» (su h4 en negrita y su p gris, como «Normal Task Manager / Endless lists…»). */
function Contraste({ b }: { b: B<'contraste'> }) {
  const lado = (it: Item, bueno: boolean) => (
    <div className={`d-prioridades-col ${bueno ? 'd-prioridades-col-bien' : 'd-prioridades-col-mal'}`}>
      <h3 className="d-prioridades-col-t" dangerouslySetInnerHTML={html(it.titulo)} />
      <ul className="d-prioridades-col-in">
        {it.texto.split(/<br\s*\/?>/).map((r) => {
          const i = r.indexOf(': ');
          const [t, p] = i > 0 ? [r.slice(0, i), r.slice(i + 2)] : ['', r];
          return (
            <li key={r}>
              <span className="d-prioridades-col-ico"><Ico paths={bueno ? CHECK : CRUZ} size={8} grosor={3.6} /></span>
              <div>{t ? <h4 dangerouslySetInnerHTML={html(t)} /> : null}<p dangerouslySetInnerHTML={html(p)} /></div>
            </li>
          );
        })}
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

type Acordeon = { id: string; titulo: string; bajada?: string; items: { titulo: string; texto: string; puntos?: string[] }[]; derecha: boolean };

/** «AI Task Planner» y las demás: el título de 60 px y la grilla 2fr | 3fr (o 3fr | 2fr) con la pantalla PEGADA en su columna. */
function Funcion({ a }: { a: Acordeon }) {
  const medios = PANTALLAS_DE_FUNCION[a.id] ?? [];
  const medio = (i: number) => medios[i] ?? medios[0];
  return (
    <section className="d-prioridades-funcion" id={a.id}>
      <div className="d-prioridades-w">
        <h2 className="d-prioridades-h2-f" dangerouslySetInnerHTML={html(a.titulo)} />
        {a.bajada ? <p className="d-prioridades-sub d-prioridades-sub-f" dangerouslySetInnerHTML={html(a.bajada)} /> : null}
        <div className={`d-prioridades-fg${a.derecha ? ' d-prioridades-fg-der' : ''}`}>
          <div className="d-prioridades-fg-media" aria-hidden="true">
            <div className="d-prioridades-fg-pega">
              {a.items.map((it, i) => <div key={it.titulo} className="d-prioridades-marco d-prioridades-fg-m">{medio(i) ? <Pantalla m={medio(i)!} primera={i === 0} /> : null}</div>)}
            </div>
          </div>
          {/* data-tema-fijo: el renglón abierto cambia con :checked (ver la nota de las casillas del hero). */}
          <ul className="d-prioridades-acc" data-tema-fijo="">
            {a.items.map((it, i) => (
              <li key={it.titulo} className="d-prioridades-acc-i">
                <label className="d-prioridades-acc-l">
                  <input type="radio" name={`d-prioridades-${a.id}`} defaultChecked={i === 0} className="d-prioridades-oculto" />
                  <h3 dangerouslySetInnerHTML={html(it.titulo)} />
                  <Ico className="d-prioridades-acc-f" paths={CHEVRON} size={20} grosor={2} />
                </label>
                <div className="d-prioridades-acc-p">
                  <p dangerouslySetInnerHTML={html(it.texto)} />
                  {it.puntos?.map((p) => <p key={p} dangerouslySetInnerHTML={html(p)} />)}
                  <div className="d-prioridades-marco d-prioridades-acc-m">{medio(i) ? <Pantalla m={medio(i)!} /> : null}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="d-prioridades-cta-c d-prioridades-cta-f"><Boton /></div>
      </div>
    </section>
  );
}

/** «What Teams & Businesses say about Motion»: su tarjeta (la imagen arriba y el panel azul), con el caso de Mauricio. */
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
        <div className="d-prioridades-porque-izq">
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
  // Las funciones de Motion, en su orden, con lo que la landing de MaKo trae: la de «filas», la de «pasos» (las reuniones) y las
  // tarjetas, que son, en orden: proyectos, notas, avance y «por qué» (la última no es una función: es «Why…»).
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
        return <Funcion key={k} a={{ id: 'prioriza', titulo: b.titulo, bajada: b.bajada, items: b.items, derecha }} />;
      }
      case 'pasos': {
        const derecha = nFuncion++ % 2 === 1;
        const items = b.pasos.map((p, j) => ({ titulo: `${j + 1}. ${p.titulo}`, texto: p.texto }));
        return <Funcion key={k} a={{ id: 'reuniones', titulo: b.titulo, bajada: b.bajada, items, derecha }} />;
      }
      case 'tarjetas': {
        const n = nTarjetas++;
        if (b.columnas === 2) return <PorQue key={k} b={b} />;
        const derecha = nFuncion++ % 2 === 1;
        const id = n === 0 ? 'proyectos' : n === 1 ? 'notas' : 'avance';
        return <Funcion key={k} a={{ id, titulo: b.titulo, bajada: b.bajada, items: b.items, derecha }} />;
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
      <script data-visor="" dangerouslySetInnerHTML={{ __html: SCRIPT }} />
    </div>
  );
}

// Los videos y la tarjeta del hero. Un <script data-visor> (el visor de Martín borra los demás). Como Motion: cada video arranca
// recién cuando se ve (InlineVideo.astro: un IntersectionObserver) y se frena al salir; uno escondido (display: none) no «se ve»,
// así que al abrir otro renglón del acordeón arranca el suyo solo. La casilla marcada del hero muestra su pantalla (la ÚLTIMA que
// se marcó, como su `l(t.dataset.featureVideoUrl)`); desmarcarla no cambia nada (en Motion tampoco). Con «menos movimiento»,
// nada arranca solo (queda el póster). Limpia su estado antes de empezar: pulir.mjs guarda el DOM con lo que puso.
const SCRIPT = `(function(){
var raiz=document.querySelector('.d-prioridades');if(!raiz||raiz.dataset.prVivo)return;raiz.dataset.prVivo='1';
var quieto=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
var vids=[].slice.call(raiz.querySelectorAll('video[data-pr-video]'));
if('IntersectionObserver' in window){
  var io=new IntersectionObserver(function(es){es.forEach(function(e){var v=e.target;
    if(e.isIntersecting&&!quieto){if(v.preload==='none')v.preload='auto';var p=v.play();if(p&&p.catch)p.catch(function(){});}
    else if(!v.paused)v.pause();});},{threshold:0.15});
  vids.forEach(function(v){v.pause();io.observe(v);});
}
var hc=document.getElementById('d-prioridades-hcard');if(!hc)return;
var capas=[].slice.call(hc.querySelectorAll('[data-hm]'));
capas.forEach(function(c){c.removeAttribute('data-activo');});
var ini=hc.querySelector('[data-hm=""]');if(ini)ini.setAttribute('data-activo','');
hc.querySelectorAll('.d-prioridades-casilla input').forEach(function(i){i.checked=false;
  i.addEventListener('change',function(){if(!i.checked)return;var v=i.closest('label').getAttribute('data-vista');
    var c=hc.querySelector('[data-hm="'+v+'"]');if(!c)return;
    capas.forEach(function(x){x.removeAttribute('data-activo');});c.setAttribute('data-activo','');
    var vd=c.querySelector('video');if(vd&&!quieto){vd.preload='auto';try{vd.currentTime=0;}catch(e){}var p=vd.play();if(p&&p.catch)p.catch(function(){});}});});
})();`;

const CSS = `
@font-face { font-family: 'Albert Sans'; src: url('/vsl-assets/fuentes/albert-sans/albert-sans-latin.woff2') format('woff2'); font-weight: 100 900; font-style: normal; font-display: swap; }
@font-face { font-family: 'Inter'; src: url('/vsl-assets/fuentes/inter/inter-latin-var.woff2') format('woff2'); font-weight: 100 900; font-style: normal; font-display: swap; }
.d-prioridades { background: #fff; color: #000; font-family: 'Inter', ui-sans-serif, system-ui, sans-serif; font-size: 16px; line-height: 24px; -webkit-font-smoothing: antialiased; overflow-x: clip; }
:where(.d-prioridades) *, :where(.d-prioridades) *::before, :where(.d-prioridades) *::after { box-sizing: border-box; }
:where(.d-prioridades) :where(p, h1, h2, h3, h4, h5, h6, ul, ol) { margin: 0; padding: 0; }
:where(.d-prioridades) :where(ul, ol) { list-style: none; }
:where(.d-prioridades) a { color: inherit; }
.d-prioridades-w { width: 100%; max-width: 1264px; margin: 0 auto; padding: 0 32px; }
/* Su «gtfo»: el input existe (se enfoca y se lee) pero no se ve. */
.d-prioridades-oculto { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; border: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; opacity: 0; }

/* Títulos: Albert Sans 600 */
.d-prioridades-h1, .d-prioridades-h2, .d-prioridades-h2-f, .d-prioridades-h2-m, .d-prioridades-h2-l, .d-prioridades-hcard-t, .d-prioridades-col-t, .d-prioridades-acc-i h3, .d-prioridades-caso-azul h3, .d-prioridades-cierre-h, .d-prioridades-etq { font-family: 'Albert Sans', 'Inter', sans-serif; font-weight: 600; }
.d-prioridades-h2 { font-size: 34px; line-height: 46.75px; letter-spacing: -0.3px; text-align: center; color: #000; text-wrap: balance; }
.d-prioridades-h2-f { font-size: 60px; line-height: 75px; letter-spacing: -0.3px; text-align: center; color: #000; text-wrap: balance; }
.d-prioridades-h2-m { font-size: 48px; line-height: 60px; letter-spacing: -0.3px; text-align: center; color: #000; text-wrap: balance; }
.d-prioridades-h2-l { font-size: 34px; line-height: 46.75px; letter-spacing: -0.3px; color: #000; margin-bottom: 32px; }
.d-prioridades-sub { margin-top: 16px; text-align: center; font-size: 16px; line-height: 24px; color: #495161; text-wrap: balance; }
.d-prioridades-sub-f { margin-top: -40px; margin-bottom: 64px; font-size: 18px; line-height: 28px; }
.d-prioridades-h1 em, .d-prioridades-hcard-t em { font-style: normal; }

/* Botón: 48 px, 12 20, radio 8, 16/600 blanco, el degradado de arriba abajo y su sombra. Su hover SÓLO aclara (brightness 1.05,
   150 ms, medido): no sube ni cambia la sombra. */
.d-prioridades-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 48px; padding: 12px 20px; border-radius: 8px; background: #2F6FED linear-gradient(#5B8EF5 0%, #2F6FED 100%); color: #fff; font-size: 16px; line-height: 24px; font-weight: 600; text-decoration: none; white-space: nowrap; box-shadow: 0 2px 5px rgba(0,0,0,.2), inset 0 0 0 1px rgba(0,0,0,.1), inset 0 2px 0 rgba(255,255,255,.2); transition: color .15s cubic-bezier(.4,0,.2,1), background-color .15s cubic-bezier(.4,0,.2,1), filter .15s cubic-bezier(.4,0,.2,1); }
.d-prioridades-btn:hover, .d-prioridades-btn:focus-visible { filter: brightness(1.05); }
.d-prioridades-cta-c { display: flex; justify-content: center; margin-top: 40px; }
.d-prioridades-cta-f { margin-top: 32px; }
.d-prioridades-nota { margin-top: 16px; font-size: 14px; line-height: 20px; color: #495161; }

/* Barra: 96 de alto (24 0). En la página se esconde: va la del sitio (BARRA_PROPIA en TemaSitio.tsx). */
.d-prioridades-nav { position: absolute; top: 0; left: 0; right: 0; z-index: 20; padding: 24px 0; }
.d-prioridades-nav-in { display: flex; align-items: center; gap: 16px; }
.d-prioridades-nav-in > a:first-child { margin-right: auto; color: #101828 !important; }
.d-prioridades-nav-l { display: flex; }
.d-prioridades-nav-l a { display: inline-flex; padding: 12px; font-size: 16px; line-height: 24px; font-weight: 500; color: #475467; text-decoration: none; }

/* Hero: el degradado de 125° al 200 % que se corre solo (bg-subtle-shift, 12 s); 96 arriba, todo centrado; h1 88 / 96,8, -2,2 px */
.d-prioridades-hero { padding: 96px 0 80px; background-image: linear-gradient(125deg, rgba(47,111,237,.05) 0%, rgba(242,176,30,.05) 25%, rgba(47,111,237,.08) 50%, rgba(242,176,30,.05) 75%, rgba(47,111,237,.05) 100%); background-size: 200% 200%; animation: d-prioridades-fondo 12s ease-in-out infinite; }
.d-prioridades-hero-in { display: flex; flex-direction: column; align-items: center; text-align: center; }
.d-prioridades-etq { margin-top: 87px; font-size: 16px; line-height: 32px; letter-spacing: -0.4px; color: transparent; background: linear-gradient(#5B8EF5 0%, #2F6FED 100%); -webkit-background-clip: text; background-clip: text; }
.d-prioridades-h1 { margin-top: 9px; max-width: 783px; font-size: 88px; line-height: 96.8px; letter-spacing: -2.2px; color: #000; text-wrap: balance; }
.d-prioridades-h1 em { color: transparent; background: linear-gradient(80.74deg, #7FA6F7 9.74%, #2F6FED 93.68%); -webkit-background-clip: text; background-clip: text; }
.d-prioridades-bajada { margin-top: 24px; max-width: 900px; font-size: 18px; line-height: 28px; color: #495161; text-wrap: balance; }
.d-prioridades-bajada strong { color: #101828; font-weight: 600; }
.d-prioridades-hero-cta { margin-top: 40px; }
/* La tarjeta: 1200, 32 de relleno, radio 12, su sombra azulada; grilla 1fr | 2fr con 32: a la izquierda el título de 24 y las
   casillas, a la derecha la pantalla (1015 / 720, contain). */
.d-prioridades-hcard { margin-top: 76px; width: 100%; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 2fr); gap: 32px; padding: 32px; border-radius: 12px; background: #fff; box-shadow: 0 -4px 80px rgba(47,111,237,.05), 0 2px 32px rgba(47,111,237,.14), inset 0 0 0 1px #F1F2F4; text-align: left; }
.d-prioridades-hcard-vis { grid-column: 2; grid-row: 1; position: relative; aspect-ratio: 1015 / 720; border-radius: 8px; overflow: hidden; }
.d-prioridades-hcard-izq { grid-column: 1; grid-row: 1; display: flex; flex-direction: column; }
.d-prioridades-hm { position: absolute; inset: 0; display: none; }
.d-prioridades-hm[data-activo] { display: block; }
.d-prioridades-hm .d-prioridades-pantalla { width: 100%; height: 100%; object-fit: contain; object-position: center; }
.d-prioridades-hcard-t { margin-bottom: 24px; font-size: 24px; line-height: 32px; letter-spacing: -0.6px; color: #000; }
.d-prioridades-casillas { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
/* Cada casilla: contorno de 1 px gris al 20 %, radio 8, 12 de relleno; con el mouse o el foco el contorno pasa al azul (150 ms);
   marcada, 2 px y el cuadradito de arriba a la derecha con el degradado y su tilde. */
.d-prioridades-casilla { position: relative; display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 12px; border-radius: 8px; outline: 1px solid #DADDE1; cursor: pointer; transition: all .15s cubic-bezier(.4,0,.2,1); }
.d-prioridades-casilla:hover, .d-prioridades-casilla:focus-within, .d-prioridades-casilla:has(:checked) { outline-color: #2F6FED; }
.d-prioridades-casilla:has(:checked) { outline-width: 2px; }
.d-prioridades-casilla-i { width: 28px; height: 28px; border-radius: 4px; background: #EEF5FF; color: #2F6FED; display: inline-flex; align-items: center; justify-content: center; }
.d-prioridades-casilla-n { font-size: 14px; line-height: 20px; font-weight: 500; color: #495161; text-align: center; }
.d-prioridades-casilla-c { position: absolute; top: 8px; right: 8px; width: 16px; height: 16px; border-radius: 4px; border: 1px solid #DADDE1; color: transparent; display: flex; align-items: center; justify-content: center; }
.d-prioridades-casilla:has(:checked) .d-prioridades-casilla-c { border-color: transparent; background: linear-gradient(#5B8EF5, #2F6FED); color: #fff; }
.d-prioridades-hcard-cta { margin-top: 24px; display: flex; justify-content: center; }
.d-prioridades-hcard-izq .d-prioridades-nota { text-align: center; }
html[data-sitio-modo="oscuro"] .d-prioridades-casilla { outline-color: #3A404B; }
html[data-sitio-modo="oscuro"] .d-prioridades-casilla:hover, html[data-sitio-modo="oscuro"] .d-prioridades-casilla:focus-within, html[data-sitio-modo="oscuro"] .d-prioridades-casilla:has(:checked) { outline-color: #5B8EF5; }
html[data-sitio-modo="oscuro"] .d-prioridades-casilla-i { background: rgba(91,142,245,.16); color: #8FB2F8; }
html[data-sitio-modo="oscuro"] .d-prioridades-casilla-n { color: #C3C8D2; }
html[data-sitio-modo="oscuro"] .d-prioridades-casilla-c { border-color: #3A404B; }

/* Las pantallas de las funciones van en el celeste de Motion (#E5F5FF → #DFEDFF, radio 12), con la app adentro desde arriba a la
   izquierda y cortada abajo, como sus videos (1220 × 864). */
.d-prioridades-marco { position: relative; aspect-ratio: 1220 / 864; border-radius: 12px; overflow: hidden; padding: 6% 0 0 6%; background: linear-gradient(135deg, #E5F5FF 0%, #D9EFFF 50%, #DFEDFF 100%); }
.d-prioridades-marco > .d-prioridades-pantalla { display: block; width: 100%; height: 100%; object-fit: cover; object-position: left top; border-radius: 10px 0 0 0; background: #fff; box-shadow: 0 1px 2px rgba(16,24,40,.06), 0 12px 32px rgba(61,98,208,.14); }
.d-prioridades-marco > .mk-falta { height: 100%; }

/* «Stop using tech…»: dos columnas de 588 con 24 de espacio; la gris #F0F4F8 y la del degradado, radio 24, 0 8 8 */
.d-prioridades-s { padding: 64px 0; }
.d-prioridades-contraste { padding-top: 80px; background: linear-gradient(#EEF5FF 0%, #fff 200px); }
.d-prioridades-contraste .d-prioridades-h2 { margin-bottom: 32px; }
.d-prioridades-cols { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; }
.d-prioridades-col { display: flex; flex-direction: column; padding: 0 8px 8px; border-radius: 24px; }
.d-prioridades-col-mal { background: #F0F4F8; }
.d-prioridades-col-bien { background: linear-gradient(122deg, #8FB2F8 0%, #5B8EF5 34%, #2F6FED 75%, #1F57C8 100%); }
.d-prioridades-col-t { padding: 16px 0; text-align: center; font-size: 20px; line-height: 28px; color: #6F7788; }
.d-prioridades-col-bien .d-prioridades-col-t { color: #fff; }
.d-prioridades-col-in { flex: 1; display: flex; flex-direction: column; gap: 16px; padding: 24px; border-radius: 16px; background: #fff; }
.d-prioridades-col-in li { display: flex; gap: 12px; }
.d-prioridades-col-in h4 { font-size: 16px; line-height: 24px; font-weight: 600; color: #101828; }
.d-prioridades-col-in p { font-size: 16px; line-height: 24px; color: #495161; }
.d-prioridades-col-ico { flex: none; margin-top: 5px; width: 14px; height: 14px; border-radius: 9999px; display: inline-flex; align-items: center; justify-content: center; }
.d-prioridades-col-mal .d-prioridades-col-ico { background: #A4A8B0; color: #fff; }
.d-prioridades-col-bien .d-prioridades-col-ico { background: #CDF0DD; color: #17A34A; }

/* Las funciones: 128 entre una y otra; título 60 / 75 con 64 abajo; grilla 2fr | 3fr con 48 (la pantalla a la derecha) o 3fr | 2fr */
.d-prioridades-funcion { padding: 128px 0 0; }
.d-prioridades-funcion .d-prioridades-h2-f { margin-bottom: 64px; }
.d-prioridades-fg { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 3fr); gap: 48px; align-items: start; }
.d-prioridades-fg-der { grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); }
.d-prioridades-fg-media { grid-column: 2; grid-row: 1; align-self: stretch; }
.d-prioridades-fg-der .d-prioridades-fg-media { grid-column: 1; }
.d-prioridades-acc { grid-column: 1; grid-row: 1; display: flex; flex-direction: column; }
.d-prioridades-fg-der .d-prioridades-acc { grid-column: 2; }
/* La pantalla PEGADA a 112 px mientras se baja por su acordeón (sticky top-28). Se ve la del renglón abierto. */
.d-prioridades-fg-pega { position: sticky; top: 112px; }
.d-prioridades-fg-m { display: none; }
${[1, 2, 3, 4, 5, 6].map((n) => `.d-prioridades-fg:has(> .d-prioridades-acc > li:nth-child(${n}) input:checked) .d-prioridades-fg-m:nth-child(${n})`).join(',\n')} { display: block; }
.d-prioridades-acc-m { display: none; }
/* El renglón: borde izquierdo de 1 px y 3 de relleno; con el mouse, borde de 4 px, fondo al 2 % y el título en tinta (150 ms);
   abierto, el borde azul de 4 px, el celeste y el texto (sin animar la altura: abre de golpe, medido). */
.d-prioridades-acc-i { border-left: 1px solid #E7E8EB; padding-left: 3px; border-radius: 0 12px 12px 0; transition: color .15s cubic-bezier(.4,0,.2,1), background-color .15s cubic-bezier(.4,0,.2,1), border-color .15s cubic-bezier(.4,0,.2,1); }
.d-prioridades-acc-i:hover, .d-prioridades-acc-i:focus-within { border-left-width: 4px; padding-left: 0; }
.d-prioridades-acc-i:not(:has(:checked)):hover { background-color: rgba(16,24,40,.02); }
.d-prioridades-acc-i:has(:checked) { border-left: 4px solid #2F6FED; padding-left: 0; background-color: #F1F7FF; }
.d-prioridades-acc-l { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 24px; cursor: pointer; }
.d-prioridades-acc-i:has(:checked) .d-prioridades-acc-l { padding-bottom: 12px; }
.d-prioridades-acc-i h3 { font-size: 20px; line-height: 28px; color: #848B97; transition: color .15s cubic-bezier(.4,0,.2,1); }
.d-prioridades-acc-i:hover h3, .d-prioridades-acc-i:focus-within h3, .d-prioridades-acc-i:has(:checked) h3 { color: #101828; }
.d-prioridades-acc-f { flex: none; width: 20px; height: 20px; opacity: .4; color: #101828; transition: transform .15s cubic-bezier(.4,0,.2,1); }
.d-prioridades-acc-i:has(:checked) .d-prioridades-acc-f { transform: rotate(180deg); }
.d-prioridades-acc-p { display: none; padding: 0 24px 24px; flex-direction: column; gap: 12px; }
.d-prioridades-acc-i:has(:checked) .d-prioridades-acc-p { display: flex; }
.d-prioridades-acc-p p { font-size: 14px; line-height: 20px; color: #495161; }
.d-prioridades-acc-p strong { color: #101828; font-weight: 600; }
html[data-sitio-modo="oscuro"] .d-prioridades-acc-i { border-left-color: #2E333C; }
html[data-sitio-modo="oscuro"] .d-prioridades-acc-i:not(:has(:checked)):hover { background-color: rgba(255,255,255,.03); }
html[data-sitio-modo="oscuro"] .d-prioridades-acc-i:has(:checked) { border-left-color: #5B8EF5; background-color: rgba(91,142,245,.12); }
html[data-sitio-modo="oscuro"] .d-prioridades-acc-i h3 { color: #8E95A2; }
html[data-sitio-modo="oscuro"] .d-prioridades-acc-i:hover h3, html[data-sitio-modo="oscuro"] .d-prioridades-acc-i:focus-within h3, html[data-sitio-modo="oscuro"] .d-prioridades-acc-i:has(:checked) h3 { color: #F1F3F7; }
html[data-sitio-modo="oscuro"] .d-prioridades-acc-f { color: #F1F3F7; }
html[data-sitio-modo="oscuro"] .d-prioridades-acc-p p { color: #B7BDC8; }
html[data-sitio-modo="oscuro"] .d-prioridades-acc-p strong { color: #F1F3F7; }

/* El caso: la tarjeta de «Teams & Businesses» (la imagen y el panel azul, radio 12), a lo ancho. Con el mouse crece al 102 %
   (scale, 150 ms), como las suyas: no sube ni cambia la sombra. */
.d-prioridades-caso { padding-top: 128px; }
.d-prioridades-caso-card { margin-top: 48px; display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); border-radius: 12px; overflow: hidden; transition: scale .15s cubic-bezier(.4,0,.2,1); }
.d-prioridades-caso-card:hover { scale: 1.02; }
.d-prioridades-caso-video { display: block; width: 100%; height: 100%; aspect-ratio: 16 / 9; object-fit: cover; background: #0B1220; }
.d-prioridades-caso-azul { display: flex; flex-direction: column; gap: 12px; padding: 16px; background: linear-gradient(to right bottom, #5B8EF5 0%, #2F6FED 100%); color: #fff; }
.d-prioridades-caso-azul h3 { font-size: 24px; line-height: 32px; letter-spacing: -0.6px; margin-bottom: 4px; }
.d-prioridades-caso-azul p { font-size: 14px; line-height: 22.75px; }
.d-prioridades-caso-azul strong { font-weight: 700; }
.d-prioridades-caso-quien { margin-top: auto; padding-top: 24px; display: flex; flex-direction: column; font-size: 14px; line-height: 20px; }
.d-prioridades-caso-quien b { font-size: 16px; line-height: 24px; font-weight: 500; }

/* «Why…»: grilla .75fr | 1fr con 48; renglones #EEF5FF, 16 de relleno, 8 entre ellos, el tilde azul. Sin hover (medido). */
.d-prioridades-porque-g { display: grid; grid-template-columns: minmax(0, .75fr) minmax(0, 1fr); gap: 48px; align-items: start; }
.d-prioridades-porque-l { display: flex; flex-direction: column; gap: 8px; }
.d-prioridades-porque-l li { display: flex; gap: 12px; padding: 16px; border-radius: 8px; background: #EEF5FF; font-size: 16px; line-height: 24px; color: #101828; }
.d-prioridades-porque-l b { font-weight: 600; }
.d-prioridades-porque-ico { flex: none; margin-top: 1px; width: 20px; height: 20px; border-radius: 9999px; background: #2F6FED; color: #fff; display: inline-flex; align-items: center; justify-content: center; }

/* Integraciones: el panel #F7F8FB de radio 32 y las baldosas blancas de 94 (16 de relleno, radio 8, su sombra azul). Sin hover. */
.d-prioridades-logos-panel { margin-top: 48px; padding: 32px 32px 64px; border-radius: 32px; background: #F7F8FB; }
.d-prioridades-logos-panel ul { display: flex; flex-wrap: wrap; justify-content: center; gap: 40px; }
.d-prioridades-logos-panel li { width: 160px; display: flex; flex-direction: column; align-items: center; gap: 12px; }
.d-prioridades-logo-b { width: 94px; height: 94px; padding: 16px; border-radius: 8px; background: #fff; box-shadow: 0 2.34px 14.02px rgba(61,98,208,.06); display: flex; align-items: center; justify-content: center; }
.d-prioridades-logo-b img { width: 62px; height: 62px; object-fit: contain; }
.d-prioridades-logo-n { text-align: center; font-size: 14px; line-height: 20px; font-weight: 500; color: #475467; }

/* Cierre: 96 32 sobre el celeste que sube; el título de 64 / 80, 700, con el degradado azul */
.d-prioridades-cierre { padding: 96px 0; text-align: center; background: linear-gradient(#EEF5FF 0%, #fff 50%); }
.d-prioridades-cierre-h { max-width: 1000px; margin: 0 auto; font-size: 64px; line-height: 80px; letter-spacing: -1.92px; font-weight: 700; color: transparent; background: linear-gradient(#5B8EF5 0%, #2F6FED 100%); -webkit-background-clip: text; background-clip: text; text-wrap: balance; }
.d-prioridades-nota-c { text-align: center; }

/* Pie: 96 32, el celeste arriba; la marca y tres columnas (encabezado 16/600, links 16 con 8 0, al azul con el mouse: sin transición) */
.d-prioridades-pie { padding: 96px 0; background: linear-gradient(#EEF5FF 0%, #fff 120px); }
.d-prioridades-pie-g { display: grid; grid-template-columns: minmax(0, 400fr) repeat(3, minmax(0, 267fr)); gap: 24px; }
.d-prioridades-pie-marca > a { color: #101828 !important; }
.d-prioridades-pie-marca p { margin-top: 16px; max-width: 280px; font-size: 14px; line-height: 20px; color: #495161; }
.d-prioridades-pie h6 { min-height: 24px; margin-bottom: 16px; font-size: 16px; line-height: 24px; font-weight: 600; color: #101828; }
.d-prioridades-pie nav a { display: block; padding: 8px 0; font-size: 16px; line-height: 24px; color: #495161; text-decoration: none; }
.d-prioridades-pie nav a:hover { color: #2F6FED; }
.d-prioridades-pie-copy { max-width: 1264px; margin: 40px auto 0; padding: 0 32px; font-size: 14px; line-height: 20px; color: #667085; }

@keyframes d-prioridades-fondo { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } to { background-position: 0% 50%; } }

/* Hasta 1023 (su lg): las pantallas pasan ADENTRO del renglón abierto, debajo de su texto (mt-6), y la de la tarjeta del hero arriba. */
@media (max-width: 1023px) {
  .d-prioridades-nav-l { display: none; }
  .d-prioridades-hcard { grid-template-columns: minmax(0, 1fr); }
  .d-prioridades-hcard-vis, .d-prioridades-hcard-izq { grid-column: 1; grid-row: auto; }
  .d-prioridades-hcard-t { text-align: center; }
  .d-prioridades-fg, .d-prioridades-fg-der { grid-template-columns: minmax(0, 1fr); }
  .d-prioridades-fg-media { display: none; }
  .d-prioridades-acc, .d-prioridades-fg-der .d-prioridades-acc { grid-column: 1; }
  .d-prioridades-acc-m { display: block; margin-top: 12px; }
  .d-prioridades-porque-g { grid-template-columns: minmax(0, 1fr); }
  .d-prioridades-pie-g { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .d-prioridades-pie-marca { grid-column: 1 / -1; }
}

/* 390: 16 a los lados, h1 31,2, títulos 28 / 38,5, todo en una columna */
@media (max-width: 767px) {
  .d-prioridades-w { padding: 0 16px; }
  .d-prioridades-nav-in > a:first-child > span:last-child { display: none; }
  .d-prioridades-hero { padding-bottom: 48px; }
  .d-prioridades-etq { margin-top: 24px; max-width: 280px; }
  .d-prioridades-h1 { margin-top: 8px; max-width: 320px; font-size: 31.2px; line-height: 34.32px; letter-spacing: -0.78px; }
  .d-prioridades-bajada { max-width: 330px; }
  .d-prioridades-hero-cta { margin-top: 32px; width: 100%; }
  .d-prioridades-hero-cta .d-prioridades-btn { width: 100%; }
  .d-prioridades-hcard { margin-top: 32px; padding: 24px; gap: 32px; border-radius: 8px; }
  .d-prioridades-hcard-t { font-size: 24px; line-height: 32px; }
  .d-prioridades-h2, .d-prioridades-h2-l { font-size: 28px; line-height: 38.5px; }
  .d-prioridades-h2-l { text-align: center; }
  .d-prioridades-porque-izq { display: flex; flex-direction: column; align-items: center; }
  .d-prioridades-h2-f, .d-prioridades-h2-m { font-size: 28px; line-height: 38.5px; }
  .d-prioridades-funcion { padding-top: 96px; }
  .d-prioridades-funcion .d-prioridades-h2-f { margin-bottom: 32px; }
  .d-prioridades-sub-f { margin-top: -16px; margin-bottom: 32px; font-size: 16px; line-height: 24px; }
  .d-prioridades-cols { grid-template-columns: minmax(0, 1fr); gap: 8px; }
  .d-prioridades-col { border-radius: 12px; }
  .d-prioridades-col-in { border-radius: 8px; }
  .d-prioridades-caso { padding-top: 96px; }
  .d-prioridades-caso-card { margin-top: 32px; grid-template-columns: minmax(0, 1fr); }
  .d-prioridades-caso-video { aspect-ratio: 389 / 215; height: auto; }
  .d-prioridades-porque-g { gap: 24px; }
  .d-prioridades-logos-panel { margin-top: 32px; padding: 32px 16px 40px; border-radius: 8px; }
  .d-prioridades-logos-panel ul { gap: 24px; }
  .d-prioridades-logos-panel li { width: 120px; }
  .d-prioridades-cierre { padding: 72px 0; }
  .d-prioridades-cierre-h { font-size: 32px; line-height: 36px; letter-spacing: -1px; }
  .d-prioridades-pie { padding: 64px 0; }
  .d-prioridades-pie-g { grid-template-columns: minmax(0, 1fr); gap: 32px; }
  .d-prioridades-pie h6[aria-hidden] { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  .d-prioridades *, .d-prioridades *::before, .d-prioridades *::after { animation: none !important; transition: none !important; }
}
`;
