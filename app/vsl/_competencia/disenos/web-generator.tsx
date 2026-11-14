// =============================================================================
// /vsl/web-generator con el DISEÑO de HighLevel AI Studio (https://www.gohighlevel.com/ai-studio), copiado el 11/11/2026 y
// rehecho el 14/11/2026 contra su versión de hoy, con sus animaciones
// =============================================================================
// Referencia releída el 14/11/2026 con Chromium a 1440 × 900 y 390 × 844: capturas por sección, videos de lo que se mueve, estilos
// y hovers, y su CSS y sus scripts (vienen dentro del HTML: se bajó con curl). El relevo: side-session-notes/…/referencias-landings/
// web-generator/ (relevo.md). Los valores: docs/diseno/landings-competencia/web-generator.md. Martín, 14/11/2026: «quiero que te
// concentres en que la copia salga muy fiel a todas las animaciones y cosas que tiene la landing original… los videos que tienen,
// las animaciones, los hover, todo, absolutamente todo».
//
// Lo copiado, en su orden, con sus movimientos (todos los suyos: las duraciones, las curvas y los umbrales salen de sus scripts):
//   · el hero azul noche en dos columnas: la cejilla en cápsula, el titular con su segunda línea en degradado y, a la derecha, la
//     TARJETA DEL CONSTRUCTOR: la caja de pedido redonda, cuatro tarjetas para elegir y, al verse, el pedido que se escribe solo
//     (34 ms por letra) y la ventana que se arma (barra de progreso, el barrido de luz, el lavado de color, el destello al terminar
//     y la pastilla verde que salta). «Arma otra:» con sus chips;
//   · la galería que se ARMA CON EL SCROLL: la sección queda fija (sticky) mientras las ocho tarjetas pasan de desparramadas y
//     giradas a su lugar (el 68 % del recorrido) y después corren en dos filas en sentidos contrarios (38 px/s, arranque de 900 ms);
//   · los contadores entre dos rayas que cuentan al verse (1,6 s, ease-out cúbico) y crecen al 103 % con el mouse;
//   · «¿Qué es?» con el DESLIZADOR antes/después: el borde de papel rasgado naranja, las chispas al arrastrar y el barrido de
//     entrada (de 96 % a 47 % en 1,5 s); se arrastra, se toca o se mueve con las flechas;
//   · «¿Qué puede armar?»: la lista a la izquierda con su barra de progreso (5,4 s por tipo, se pausa con el mouse encima) y la
//     ventana a la derecha, donde el pedido se escribe (19 ms por letra) y las piezas aparecen una por una;
//   · «Por qué»: el título con el botón a la derecha, las razones y las citas que entran escalonadas (100 ms) y el borde de color al
//     pasar el mouse;
//   · «¿Para quién?»: las pastillas (9 s cada una), el formulario que se llena solo, el botón que se aprieta, la tarjeta del lead
//     que sale y el cable que se dibuja hasta lo que pasa después;
//   · las preguntas en dos columnas (la primera abierta), la caja oscura del cierre con su pedido y el pie.
// De MaKo: el logo, el azul #2F6FED donde AI Studio pone su violeta, el dorado como detalle, los textos y TODO lo que se ve adentro
// de los marcos, que es REAL (nada dibujado):
//   · las landings: lo que arma Web Generator con cada diseño y cada objetivo (`landingDesde`), llenadas con los textos de un negocio
//     inventado por objetivo (rellenos.mts, escritos a mano: ningún corchete a la vista), dibujadas con su render público y
//     fotografiadas en el banco C:/dev/bancos-portada/banco-web-generator-landing (generar.mts + capturar.mjs), sin IA ni base;
//   · su video de producto: el Panel REAL de Web Generator (Inicio) grabado en ese banco (panel/): diseño → objetivo → la landing;
//   · la réplica: la grabación de «Replicar» de la portada (public/vsl-assets/sitio/replicar.webm), con su póster en el primer cuadro;
//   · los pedidos que se escriben: los ejemplos que la caja de MaKo escribe sola (EJEMPLOS_CAJA, app/web-generator/crear/tipo.ts) y
//     los objetivos de las plantillas (lib/editor-landing/plantillas.ts); los campos del formulario y su botón, los de cada plantilla.
// Lo que NO va, y por qué: ver la cabecera de ../web-generator.ts y docs/diseno/landings-competencia/web-generator.md (su mascota,
// sus publicaciones de usuarios, sus barras «3 a 6 semanas / esta noche», sus testimonios y su cadena de cuatro
// pasos después del formulario: MaKo sólo afirma que el lead entra a tu CRM).
// Server component: lo que se mueve va en un <script data-visor> (el visor de Martín borra los demás) que empieza limpiando su propio
// estado (pulir.mjs guarda el DOM después de correrlo). Sin JavaScript: las pestañas y las pastillas son radios con su <label>, las
// preguntas son <details>, los contadores ya dicen su número y la galería queda armada.
// =============================================================================

import type { PropsDiseno } from '.';
import type { Bloque } from '../tipos';
import { RUTA_CTA, CASO, LogoMaKo, TEXTO_CTA, TEXTO_CIERRE, html, otrasFunciones } from '../marca';
import { DISENOS_LANDING } from '@/lib/editor-landing/disenos-landing';
import { PLANTILLAS } from '@/lib/editor-landing/plantillas';
import type { CampoFormulario, JsonNodo } from '@/lib/editor-landing/doc';

type Tarjetas = Extract<Bloque, { tipo: 'tarjetas' }>;
type Hero = Extract<Bloque, { tipo: 'hero' }>;

const A = '/vsl-assets/web-generator';
/** La grabación de «Replicar» (la de la portada); el póster es su PRIMER cuadro, para que el video empalme al arrancar. */
export const GRABACION_REPLICA = { video: '/vsl-assets/sitio/replicar.webm', poster: `${A}/replicar-poster.jpg` };
/** El Panel de Web Generator grabado (banco-web-generator-landing/panel/grabar.mjs), en bucle con codificar-bucle.sh. */
export const GRABACION_PANEL = { video: `${A}/panel.webm`, poster: `${A}/panel.jpg` };

const nombreDiseno = (id: string) => DISENOS_LANDING.find((d) => d.id === id)?.nombre ?? id;
const descDiseno = (id: string) => DISENOS_LANDING.find((d) => d.id === id)?.descripcion ?? '';
const nombreObjetivo = (id: string) => PLANTILLAS.find((p) => p.id === id)?.nombre ?? id;

/** Las cuatro tarjetas del constructor del hero y los chips de «Arma otra:»: los diseños de Web Generator, con la miniatura que
 *  dibuja su Panel (la primera sección con el copy de «Agenda una llamada»). */
const DISENOS_HERO = ['claro-clasico', 'oscuro-moderno', 'audaz', 'calido'] as const;
const DISENOS_CHIPS = ['mako', 'minimal', 'tecnologico', 'fresco', 'editorial'] as const;
/** Lo que la caja de MaKo escribe sola y lo que lee al pegar un link (app/web-generator/crear/caja-modos.ts). */
const PEDIDO_REPLICA = 'acquisition.com';

/** Las ocho tarjetas de la galería: cada una, una landing distinta (diseño × objetivo), con el ancho (vw) y la proporción de la
 *  tarjeta de la referencia que ocupa (su `--w` y su `--ar`). Arriba van de derecha a izquierda; abajo, al revés. */
export const GALERIA: readonly { diseno: string; objetivo: string; w: number; ar: number }[][] = [
  [
    { diseno: 'claro-clasico', objetivo: 'agenda-llamada', w: 21.3, ar: 1.1206 },
    { diseno: 'oscuro-moderno', objetivo: 'webinar', w: 32.9, ar: 2.3619 },
    { diseno: 'audaz', objetivo: 'venta-directa', w: 33.0, ar: 2.7989 },
    { diseno: 'minimal', objetivo: 'lead-magnet', w: 26.5, ar: 1.1786 },
  ],
  [
    { diseno: 'calido', objetivo: 'curso-programa', w: 20.1, ar: 1.3344 },
    { diseno: 'tecnologico', objetivo: 'app-software', w: 27.6, ar: 1.2752 },
    { diseno: 'fresco', objetivo: 'servicio-local', w: 28.8, ar: 1.2767 },
    { diseno: 'editorial', objetivo: 'consultoria', w: 27.6, ar: 1.2784 },
  ],
];
const fotoGaleria = (g: { diseno: string; objetivo: string }) => `${A}/galeria/${g.diseno}--${g.objetivo}.jpg`;
/** El marco de color de cada tarjeta (en la referencia viene pintado en la imagen: amarillo, verde, azul, naranja, rojo). */
const MARCOS = ['#F2B01E', '#2F6FED', '#12151B', '#5B8CF0', '#2F6FED', '#F2B01E', '#5B8CF0', '#12151B'];

/** «¿Qué puede armar?»: en el orden de los items de ../web-generator.ts, lo que se escribe en la barra de pedido y lo que se ve.
 *  Los pedidos son los ejemplos de la caja de MaKo o el objetivo de la plantilla, tal cual. */
const PUEDES: readonly { pedido: string; foto?: string; video?: boolean; pro?: boolean; acento: [string, string] }[] = [
  { pedido: 'Una landing para agendar una llamada de diagnóstico', foto: `${A}/puedes/pagina.jpg`, acento: ['#2F6FED', '#EAF1FE'] },
  { pedido: PEDIDO_REPLICA, video: true, pro: true, acento: ['#1F57C8', '#E8EFFD'] },
  { pedido: 'Quiz con diagnóstico: contestan unas preguntas y reciben su resultado', foto: `${A}/puedes/quiz.jpg`, acento: ['#C98A06', '#FFF6DE'] },
  { pedido: 'Una guía gratis a cambio del correo', foto: `${A}/puedes/formulario.jpg`, acento: ['#0F766E', '#E9F7F5'] },
  { pedido: 'Agenda una llamada: para servicios que se venden en una llamada', foto: `${A}/puedes/agenda.jpg`, acento: ['#2F6FED', '#EAF1FE'] },
  { pedido: 'El pitch de mi negocio para inversionistas', foto: `${A}/puedes/presentacion.jpg`, acento: ['#1E293B', '#F1F4F8'] },
  { pedido: 'Venta directa: un producto con su precio', foto: `${A}/puedes/pago.jpg`, acento: ['#C98A06', '#FFF6DE'] },
];

/** «Por qué»: el color de cada razón (su `--a` y su `--a-soft`), el de su cita y el de su avatar. */
const ACENTOS_PORQUE: readonly [string, string][] = [['#2F6FED', '#EAF1FE'], ['#C98A06', '#FFF6DE'], ['#1E293B', '#F1F4F8']];

/** «¿Para quién?»: el formulario REAL de cada plantilla (sus tres primeros campos y su botón), con un ejemplo de quien lo llena. */
type Formulario = { campos: CampoFormulario[]; boton: string };
function formularioDe(nodo: JsonNodo | undefined): Formulario | null {
  if (!nodo || typeof nodo !== 'object') return null;
  if (nodo.type === 'formulario') {
    const a = nodo.attrs as { campos?: CampoFormulario[]; boton?: string } | undefined;
    return a?.campos?.length ? { campos: a.campos, boton: a.boton ?? 'Enviar' } : null;
  }
  for (const h of nodo.content ?? []) { const f = formularioDe(h); if (f) return f; }
  return null;
}
const PERSONAS = [
  { nombre: 'Laura Gómez', correo: 'laura.gomez@correo.com', tel: '+52 55 1234 5678' },
  { nombre: 'Diego Ramírez', correo: 'diego.ramirez@correo.com', tel: '+57 300 555 0192' },
  { nombre: 'Sofía Martínez', correo: 'sofia.mtz@correo.com', tel: '+54 9 11 5555 0134' },
  { nombre: 'Andrés López', correo: 'andres.lopez@correo.com', tel: '+56 9 5555 0178' },
  { nombre: 'Camila Torres', correo: 'camila.torres@correo.com', tel: '+51 999 555 012' },
  { nombre: 'Mateo Herrera', correo: 'mateo.herrera@correo.com', tel: '+34 600 555 019' },
];
function ejemplo(c: CampoFormulario, i: number): string {
  const p = PERSONAS[i % PERSONAS.length];
  if (c.tipo === 'nombre') return p.nombre;
  if (c.tipo === 'email') return p.correo;
  if (c.tipo === 'telefono') return p.tel;
  if (c.tipo === 'empresa') return 'Estudio ' + p.nombre.split(' ')[1];
  if (c.opciones?.length) return c.opciones[0];
  return 'Quiero ordenar mis ventas';
}
const ACENTOS_PARA: readonly [string, string][] = [['#2F6FED', '#EAF1FE'], ['#C98A06', '#FFF6DE'], ['#0F766E', '#E9F7F5'], ['#1E293B', '#F1F4F8'], ['#1F57C8', '#E8EFFD'], ['#B45309', '#FEF3E7']];

function Ico({ paths, size = 20 }: { paths?: string[]; size?: number }) {
  if (!paths?.length) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths.map((d) => <path key={d} d={d} />)}
    </svg>
  );
}
const CHISPA = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2.5c.6 4.6 2.9 6.9 7.5 7.5-4.6.6-6.9 2.9-7.5 7.5-.6-4.6-2.9-6.9-7.5-7.5 4.6-.6 6.9-2.9 7.5-7.5Z" fill="currentColor" /><path d="M19 15.5c.25 1.6 1 2.35 2.5 2.5-1.5.25-2.25 1-2.5 2.5-.25-1.5-1-2.25-2.5-2.5 1.5-.15 2.25-.9 2.5-2.5Z" fill="currentColor" opacity=".6" /></svg>
);
const FLECHA_ARRIBA = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5" /><path d="M6 11l6-6 6 6" /></svg>;
const TILDE = <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 10.5l4 4 8-9" /></svg>;

function Boton({ clase = '' }: { clase?: string }) {
  return <a href={RUTA_CTA} className={`d-wg-cta ${clase}`}>{TEXTO_CTA}</a>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero: el texto y la tarjeta del constructor
// ─────────────────────────────────────────────────────────────────────────────
function HeroWg({ b }: { b: Hero }) {
  return (
    // `data-tema-fijo`: el sol y la luna llevaba cada parada del degradado al modo y en el claro quedaba claro arriba y oscuro abajo.
    // El claro del hero va aparte (html[data-sitio-modo="claro"], abajo).
    <section className="d-wg-hero" data-tema-fijo="">
      <div className="d-wg-ais" id="d-wg-ais">
        <div className="d-wg-ais-head">
          <span className="d-wg-badge">{b.etiqueta}</span>
          <h1 className="d-wg-h1" dangerouslySetInnerHTML={html(b.titulo)} />
          <p className="d-wg-sub" dangerouslySetInnerHTML={html(b.bajada)} />
        </div>
        <div className="d-wg-demo" data-tema-fijo="">
          <div className="d-wg-prompt">
            <span className="d-wg-spark">{CHISPA}</span>
            <input className="d-wg-input" id="d-wg-input" type="text" placeholder="¿Qué quieres crear?" aria-label="Describe la landing que quieres crear o pega el link de una que ya funciona" autoComplete="off" />
            <a href={RUTA_CTA} className="d-wg-send" aria-label="Crearla en MaKo">{FLECHA_ARRIBA}</a>
          </div>
          <div className="d-wg-gal4" id="d-wg-gal4">
            {DISENOS_HERO.map((id) => (
              <a key={id} href={RUTA_CTA} className="d-wg-gcard" data-diseno={id} data-nombre={nombreDiseno(id)}>
                <span className="d-wg-gprev"><img src={`${A}/mini/${id}.jpg`} alt="" width={320} height={200} loading="lazy" decoding="async" /></span>
                <span className="d-wg-glabel">{nombreDiseno(id)} <span>{descDiseno(id)}</span></span>
              </a>
            ))}
          </div>
          <div className="d-wg-retry" id="d-wg-retry">
            <span className="d-wg-retry-l">Arma otra:</span>
            {/* Cada chip lleva su miniatura escondida (no se baja: `lazy` y sin mostrar), de donde la toma el script al armarla. */}
            {[...DISENOS_CHIPS, DISENOS_HERO[0]].map((id) => <a key={id} href={RUTA_CTA} className="d-wg-chip" data-diseno={id} data-nombre={nombreDiseno(id)}>{nombreDiseno(id)}<img src={`${A}/mini/${id}.jpg`} alt="" width={320} height={200} loading="lazy" hidden /></a>)}
          </div>
          <div className="d-wg-stagewrap">
            <div className="d-wg-frame" id="d-wg-frame">
              <div className="d-wg-chrome">
                <span className="d-wg-lights" aria-hidden="true"><i /><i /><i /></span>
                <span className="d-wg-url">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
                  <b id="d-wg-url">{PEDIDO_REPLICA}</b>
                </span>
                <span className="d-wg-status">
                  <span className="d-wg-spin" />
                  <span id="d-wg-status-t" />
                  <span className="d-wg-done" id="d-wg-done">{TILDE}<span id="d-wg-done-t">Lista para editar</span></span>
                </span>
              </div>
              <div className="d-wg-progress"><i id="d-wg-bar" /></div>
              <div className="d-wg-site" id="d-wg-site">
                <span className="d-wg-wash" />
                <span className="d-wg-beam" />
                <span className="d-wg-pro" id="d-wg-pro">Con MaKo Pro</span>
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video className="d-wg-pieza d-wg-site-video" id="d-wg-site-video" src={GRABACION_REPLICA.video} poster={GRABACION_REPLICA.poster} muted playsInline preload="none" aria-label="Grabado en MaKo: Replicar lee la landing de acquisition.com sección por sección" />
                <img className="d-wg-pieza d-wg-site-img" id="d-wg-site-img" alt="" width={1280} height={800} decoding="async" />
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Su video de producto (1080 de ancho, radio 20, corre solo y sin sonido): el Panel REAL de Web Generator grabado en el banco
          (C:/dev/bancos-portada/banco-web-generator-landing/panel): se elige un diseño, sale «¿De qué quieres crearla?», se elige el
          objetivo y aparece la landing. El póster es su primer cuadro. */}
      <div className="d-wg-hero-video" data-tema-fijo="">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video src={GRABACION_PANEL.video} poster={GRABACION_PANEL.poster} muted loop playsInline preload="none" data-a-la-vista="" aria-label="Grabado en MaKo: en el Panel de Web Generator se elige el diseño Cálido, el objetivo «Curso o programa» y aparece la landing" />
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// La galería que se arma con el scroll
// ─────────────────────────────────────────────────────────────────────────────
function partirBajada(s?: string): [string, string] {
  if (!s) return ['', ''];
  const i = s.lastIndexOf('. ', s.length - 3);
  return i > 0 ? [s.slice(0, i + 1), s.slice(i + 2)] : [s, ''];
}

function Galeria({ b }: { b: Tarjetas }) {
  const [sub, linea] = partirBajada(b.bajada);
  return (
    <section className="d-wg-galeria" id="disenos">
      <div className="d-wg-gal-head">
        <div className="d-wg-entra-caja"><h2 className="d-wg-h2-gal d-wg-entra d-wg-entra-sube" dangerouslySetInnerHTML={html(b.titulo)} /></div>
        {sub ? <p className="d-wg-gal-sub d-wg-entra d-wg-entra-funde"><em dangerouslySetInnerHTML={html(sub)} /></p> : null}
      </div>
      <div className="d-wg-proof" id="d-wg-proof">
        <div className="d-wg-proof-stage">
          <div className="d-wg-rows" id="d-wg-rows">
            {GALERIA.map((fila, f) => (
              <div key={f} className={`d-wg-row d-wg-row-${f === 0 ? 'arriba' : 'abajo'}`}>
                <div className="d-wg-track" data-dir={f === 0 ? '-1' : '1'}>
                  {fila.map((g, k) => (
                    <article key={g.diseno + g.objetivo} className="d-wg-card" style={{ ['--w' as string]: g.w, ['--ar' as string]: g.ar, ['--marco' as string]: MARCOS[(f * 4 + k) % MARCOS.length] }} data-tema-fijo="">
                      <img className="d-wg-card-img" src={fotoGaleria(g)} alt={`Una landing de Web Generator: «${nombreObjetivo(g.objetivo)}» con el diseño ${nombreDiseno(g.diseno)}`} width={640} height={Math.round(640 / g.ar)} loading="lazy" decoding="async" />
                      <span className="d-wg-card-tab">{nombreDiseno(g.diseno)} · {nombreObjetivo(g.objetivo)}</span>
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="d-wg-pwc">
        {linea ? <p className="d-wg-pwc-line" dangerouslySetInnerHTML={html(linea)} /> : null}
        <Boton />
      </div>
    </section>
  );
}

function Cifras({ b }: { b: Extract<Bloque, { tipo: 'cifras' }> }) {
  return (
    <section className="d-wg-hst" id="d-wg-hst">
      <div className="d-wg-hst-shell">
        {b.titulo ? <h2 className="d-wg-hst-title" dangerouslySetInnerHTML={html(b.titulo)} /> : null}
        <div className="d-wg-hst-grid" style={{ ['--n' as string]: b.items.length }}>
          {b.items.map((c) => (
            <div key={c.label} className="d-wg-hst-card">
              <b className="d-wg-hst-num" data-to={/^\d+$/.test(c.valor) ? c.valor : undefined}>{c.valor}</b>
              <span className="d-wg-hst-lab">{c.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ¿Qué es?: el texto y el deslizador antes/después
// ─────────────────────────────────────────────────────────────────────────────
/** El «antes»: la pregunta de MaKo al crear desde un diseño y el objetivo elegido; el «después»: la landing que sale. */
const QUEES = { objetivo: 'agenda-llamada', diseno: 'claro-clasico', foto: `${A}/quees-despues.jpg` };

function QueEs({ b }: { b: Tarjetas }) {
  const obj = PLANTILLAS.find((p) => p.id === QUEES.objetivo);
  return (
    <section className="d-wg-wis" id="que-es">
      <div className="d-wg-wis-shell">
        <div className="d-wg-wis-head">
          <h2 className="d-wg-wis-title" dangerouslySetInnerHTML={html(b.titulo)} />
          {b.bajada ? <p className="d-wg-wis-lede" dangerouslySetInnerHTML={html(b.bajada)} /> : null}
        </div>
        <div className="d-wg-wis-grid">
          <div className="d-wg-wis-copy">
            {b.items.map((it) => (
              <div key={it.titulo} className="d-wg-wis-block">
                <h3 dangerouslySetInnerHTML={html(it.titulo)} />
                <p dangerouslySetInnerHTML={html(it.texto)} />
              </div>
            ))}
            <div className="d-wg-wis-cta"><Boton /></div>
          </div>
          <div className="d-wg-wis-side">
            <div className="d-wg-rv" id="d-wg-rv" data-tema-fijo="">
              <div className="d-wg-rv-layer d-wg-rv-after" aria-hidden="true">
                <img className="d-wg-rv-img" src={QUEES.foto} alt="" draggable={false} loading="lazy" decoding="async" />
              </div>
              <div className="d-wg-rv-layer d-wg-rv-before" aria-hidden="true">
                <div className="d-wg-rv-card">
                  <div className="d-wg-rv-q">¿De qué quieres crearla?</div>
                  <div className="d-wg-rv-opt"><b>{obj?.nombre}</b><span>{obj?.descripcion}</span></div>
                  <div className="d-wg-rv-row">
                    <span className="d-wg-rv-ic"><svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.4}><path d="M6 2.2v7.6M2.2 6h7.6" strokeLinecap="round" /></svg></span>
                    <span className="d-wg-rv-tools">
                      <span className="d-wg-rv-dis">Diseño: {nombreDiseno(QUEES.diseno)}</span>
                      <span className="d-wg-rv-send"><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.6}><path d="M6 10V2.4M2.6 5.6 6 2.2l3.4 3.4" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
                    </span>
                  </div>
                </div>
              </div>
              <canvas className="d-wg-rv-sparkles" />
              <svg className="d-wg-rv-edge" aria-hidden="true"><path /></svg>
              <div className="d-wg-rv-divider"><span className="d-wg-rv-bloom" /></div>
              <span className="d-wg-rv-handle" role="slider" tabIndex={0} aria-label="Antes y después: arrástralo" aria-valuemin={5} aria-valuemax={95} aria-valuenow={47}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 4 2 8l4 4M10 4l4 4-4 4" /></svg>
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ¿Qué puede armar?: la lista y la ventana
// ─────────────────────────────────────────────────────────────────────────────
/** El rótulo corto de cada pestaña (en la referencia: «Landing pages», «Multi-step surveys»…), en el orden de los items. */
const TABS = ['Páginas completas', 'Réplicas', 'Quiz', 'Formularios', 'Agenda', 'Presentaciones', 'Botón de pago'];

function QuePuedes({ b }: { b: Tarjetas }) {
  return (
    <section className="d-wg-wcb" id="d-wg-wcb">
      <div className="d-wg-wcb-shell">
        <div className="d-wg-wcb-head">
          <h2 className="d-wg-wcb-title" dangerouslySetInnerHTML={html(b.titulo)} />
          {b.bajada ? <p className="d-wg-wcb-sub" dangerouslySetInnerHTML={html(b.bajada)} /> : null}
        </div>
        <div className="d-wg-explorer">
          {b.items.map((it, i) => <input key={it.titulo} type="radio" name="d-wg-tipo" id={`d-wg-t${i}`} className="d-wg-radio" defaultChecked={i === 0} aria-label={it.titulo.replace(/<[^>]+>/g, '')} />)}
          <div className="d-wg-list" id="d-wg-list">
            {b.items.map((it, i) => {
              const x = PUEDES[i] ?? PUEDES[0];
              return (
                <label key={it.titulo} htmlFor={`d-wg-t${i}`} className={`d-wg-option d-wg-option-${i}`} data-i={i} style={{ ['--acc' as string]: x.acento[0], ['--soft' as string]: x.acento[1] }}>
                  <span className="d-wg-option-ic"><Ico paths={it.icono} size={21} /></span>
                  <span className="d-wg-option-copy"><strong>{TABS[i] ?? it.titulo.replace(/<[^>]+>/g, '')}</strong></span>
                  <span className="d-wg-prog" />
                </label>
              );
            })}
          </div>
          <div className="d-wg-wcb-stage" id="d-wg-wcb-stage" data-tema-fijo="">
            <div className="d-wg-window">
              <div className="d-wg-wcb-chrome">
                <span className="d-wg-lights" aria-hidden="true"><i /><i /><i /></span>
                <span className="d-wg-wcb-chrome-t">Web Generator · vista previa</span>
                <span className="d-wg-wcb-done" id="d-wg-wcb-done">{TILDE}<span>Lista</span></span>
              </div>
              <div className="d-wg-promptbar">
                <span className="d-wg-wcb-spark">{CHISPA}</span>
                <span id="d-wg-wcb-prompt">{PUEDES[0].pedido}</span><span className="d-wg-caret" />
              </div>
              <div className="d-wg-wcb-content">
                {b.items.map((it, i) => {
                  const x = PUEDES[i] ?? PUEDES[0];
                  return (
                    <div key={it.titulo} className={`d-wg-project d-wg-project-${i}`} data-prompt={x.pedido} style={{ ['--acc' as string]: x.acento[0], ['--soft' as string]: x.acento[1] }}>
                      <h4 className="d-wg-po" dangerouslySetInnerHTML={html(it.titulo)} />
                      <p className="d-wg-po" dangerouslySetInnerHTML={html(it.texto)} />
                      <div className="d-wg-po d-wg-shot">
                        {x.pro ? <span className="d-wg-shot-pro">Con MaKo Pro</span> : null}
                        {x.video
                          // eslint-disable-next-line jsx-a11y/media-has-caption
                          ? <video src={GRABACION_REPLICA.video} poster={GRABACION_REPLICA.poster} muted loop playsInline preload="none" aria-label="Grabado en MaKo: Replicar lee una landing que ya funciona, sección por sección" />
                          : <img src={x.foto} alt={`Lo que arma Web Generator: ${it.titulo.replace(/<[^>]+>/g, '')}`} loading="lazy" decoding="async" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Por qué: las razones y, al lado de cada una, el caso de Mauricio
// ─────────────────────────────────────────────────────────────────────────────
function PorQue({ b, conCaso }: { b: Tarjetas; conCaso: boolean }) {
  const citas = [CASO.titulo, CASO.historia[0], CASO.resultado];
  return (
    <section className="d-wg-why" id="d-wg-why">
      <div className="d-wg-why-shell">
        <div className="d-wg-why-head">
          <h2 className="d-wg-why-title" dangerouslySetInnerHTML={html(b.titulo)} />
          <div className="d-wg-why-cta"><Boton /></div>
        </div>
        <div className="d-wg-why-grid">
          {b.items.map((it, i) => {
            const [a, s] = ACENTOS_PORQUE[i % 3];
            const estilo = { ['--a' as string]: a, ['--a-soft' as string]: s };
            return [
              <article key={`r${i}`} className="d-wg-why-card" style={estilo}>
                <div className="d-wg-why-top"><span className="d-wg-why-ic"><Ico paths={it.icono} /></span><span className="d-wg-why-num">{String(i + 1).padStart(2, '0')}</span></div>
                <h3 dangerouslySetInnerHTML={html(it.titulo)} />
                <p dangerouslySetInnerHTML={html(it.texto)} />
              </article>,
              conCaso && citas[i] ? (
                <figure key={`c${i}`} className="d-wg-why-quote" style={estilo}>
                  <span className="d-wg-why-mark" aria-hidden="true">“</span>
                  <blockquote dangerouslySetInnerHTML={html(citas[i])} />
                  <figcaption><span className="d-wg-why-av" aria-hidden="true">M</span><span className="d-wg-why-by"><b>{CASO.quien}</b><i>{i === 0 ? CASO.sub : CASO.rol}</i></span></figcaption>
                </figure>
              ) : null,
            ];
          })}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ¿Para quién?: las pastillas, el formulario que se llena y lo que pasa después
// ─────────────────────────────────────────────────────────────────────────────
function ParaQuien({ b }: { b: Tarjetas }) {
  const items = b.items
    .map((it) => { const p = PLANTILLAS.find((x) => x.nombre === it.titulo.replace(/<[^>]+>/g, '')); return p ? { it, p, f: formularioDe(p.contenido().paginas[0]?.doc as JsonNodo | undefined) } : null; })
    .filter((x): x is { it: (typeof b.items)[number]; p: (typeof PLANTILLAS)[number]; f: Formulario } => !!x && !!x.f);
  return (
    <section className="d-wg-cir" id="d-wg-cir">
      <div className="d-wg-cir-shell">
        <div className="d-wg-cir-head">
          <h2 className="d-wg-cir-title" dangerouslySetInnerHTML={html(b.titulo)} />
          {b.bajada ? <p className="d-wg-cir-sub" dangerouslySetInnerHTML={html(b.bajada)} /> : null}
        </div>
        <div className="d-wg-cir-in">
          {items.map(({ it }, i) => <input key={it.titulo} type="radio" name="d-wg-para" id={`d-wg-p${i}`} className="d-wg-radio" defaultChecked={i === 0} aria-label={it.titulo.replace(/<[^>]+>/g, '')} />)}
          <div className="d-wg-cir-chips" id="d-wg-cir-chips">
            {items.map(({ it }, i) => <label key={it.titulo} htmlFor={`d-wg-p${i}`} className={`d-wg-cir-chip d-wg-cir-chip-${i}`} data-i={i} style={{ ['--chip' as string]: ACENTOS_PARA[i % ACENTOS_PARA.length][0] }} dangerouslySetInnerHTML={html(it.titulo)} />)}
          </div>
          <div className="d-wg-cir-stage" id="d-wg-cir-stage" data-tema-fijo="">
            <div className="d-wg-cir-left">
              {items.map(({ it, p, f }, i) => {
                const [acc, soft] = ACENTOS_PARA[i % ACENTOS_PARA.length];
                const campos = f.campos.slice(0, 3);
                const quien = PERSONAS[i % PERSONAS.length].nombre;
                return (
                  <div key={it.titulo} className={`d-wg-cir-browser d-wg-cir-pan d-wg-cir-pan-${i}`} data-i={i} style={{ ['--acc' as string]: acc, ['--soft' as string]: soft }}>
                    <div className="d-wg-cir-chrome">
                      <span className="d-wg-lights" aria-hidden="true"><i /><i /><i /></span>
                      <span className="d-wg-cir-url">hola-mako.site/{p.id}</span>
                      <span className="d-wg-cir-live">Publicada</span>
                    </div>
                    <div className="d-wg-cir-form">
                      <p className="d-wg-cir-form-t">{p.nombre}</p>
                      {campos.map((c, k) => (
                        <div key={c.id ?? k} className="d-wg-cir-field" data-valor={ejemplo(c, i)}>
                          <span className="d-wg-cir-field-lab">{c.etiqueta}</span>
                          <span className="d-wg-cir-field-val">{ejemplo(c, i)}</span>
                        </div>
                      ))}
                      <div className="d-wg-cir-submit">{f.boton}</div>
                    </div>
                    <div className="d-wg-cir-packet"><span className="d-wg-cir-packet-av">{quien[0]}</span><span className="d-wg-cir-packet-copy"><b>{quien.split(' ')[0]} {quien.split(' ')[1]?.[0]}.</b><i>Nuevo lead</i></span></div>
                  </div>
                );
              })}
            </div>
            <svg className="d-wg-cir-wire" id="d-wg-cir-wire" aria-hidden="true">
              <path className="d-wg-cir-track" id="d-wg-cir-t0" />
              <path className="d-wg-cir-live" id="d-wg-cir-w0" />
              <circle className="d-wg-cir-pulse" id="d-wg-cir-d0" r="4" />
            </svg>
            <div className="d-wg-cir-chain">
              <p className="d-wg-cir-chain-lab">Después de enviar</p>
              <div className="d-wg-cir-node" id="d-wg-cir-node">
                <span className="d-wg-cir-node-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" /></svg></span>
                <span className="d-wg-cir-node-copy"><b>Entra a tu CRM como lead</b><i>Con lo que dejó en el formulario</i></span>
                <span className="d-wg-cir-node-num">01</span>
                <span className="d-wg-cir-node-tick">{TILDE}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="d-wg-cir-cta"><Boton /></div>
      </div>
    </section>
  );
}

function Preguntas({ b }: { b: Extract<Bloque, { tipo: 'preguntas' }> }) {
  return (
    <section className="d-wg-faq" id="preguntas">
      <div className="d-wg-faq-shell">
        <div className="d-wg-faq-head"><h2 className="d-wg-faq-title" dangerouslySetInnerHTML={html(b.titulo)} /></div>
        <div className="d-wg-faq-list">
          {b.items.map((q, i) => (
            <details key={q.p} className="d-wg-faq-item" open={i === 0 ? true : undefined}>
              <summary><span>{q.p}</span><span className="d-wg-faq-chev" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg></span></summary>
              <div className="d-wg-faq-a"><p dangerouslySetInnerHTML={html(q.r)} /></div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function Cierre() {
  return (
    <section className="d-wg-ctaf">
      <div className="d-wg-ctaf-shell">
        <div className="d-wg-ctaf-card">
          <span className="d-wg-ctaf-glow d-wg-ctaf-glow-a" aria-hidden="true" />
          <span className="d-wg-ctaf-glow d-wg-ctaf-glow-b" aria-hidden="true" />
          <div className="d-wg-ctaf-inner">
            <h2 className="d-wg-ctaf-title">Arma tu landing con <em>Web Generator</em></h2>
            <p className="d-wg-ctaf-sub">{TEXTO_CIERRE}</p>
            <a href={RUTA_CTA} className="d-wg-ctaf-prompt" data-tema-fijo="">
              <span className="d-wg-ctaf-spark">{CHISPA}</span>
              <span className="d-wg-ctaf-prompt-t">Una landing para agendar una llamada de diagnóstico…</span>
              <span className="d-wg-ctaf-go">{FLECHA_ARRIBA}</span>
            </a>
            <a href={RUTA_CTA} className="d-wg-ctaf-btn">{TEXTO_CTA}</a>
          </div>
        </div>
      </div>
    </section>
  );
}

function Pie({ slug }: { slug: string }) {
  const otras = otrasFunciones(slug);
  const porColumna = Math.ceil(otras.length / 3);
  const columnas = [0, 1, 2].map((c) => otras.slice(c * porColumna, (c + 1) * porColumna));
  return (
    <footer className="d-wg-pie">
      <div className="d-wg-pie-cols">
        {columnas.map((col, i) => (
          <nav key={i} className="d-wg-pie-col" aria-label={i === 0 ? 'Funciones de MaKo' : undefined}>
            <p className="d-wg-pie-h">{i === 0 ? 'Funciones de MaKo' : ' '}</p>
            {col.map((f) => <a key={f.href} href={f.href} className="d-wg-pie-a">{f.nombre}</a>)}
          </nav>
        ))}
        <div className="d-wg-pie-col">
          <p className="d-wg-pie-h">Contacto</p>
          <a href={RUTA_CTA} className="d-wg-pie-a">{TEXTO_CTA}</a>
        </div>
      </div>
      <div className="d-wg-pie-base">
        <p>© 2026 MaKo</p>
        <p><a href="/privacidad">Privacidad</a> | <a href="/terminos">Términos</a></p>
      </div>
    </footer>
  );
}

export default function DisenoWebGenerator({ landing }: PropsDiseno) {
  const bloques = landing.bloques;
  const tarjetas = bloques.filter((b): b is Tarjetas => b.tipo === 'tarjetas');
  let nT = 0;
  return (
    <div className="d-wg">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="d-wg-nav-fondo">
        <header className="d-wg-nav">
          <LogoMaKo className="d-wg-logo" tamano={30} claro />
          <nav className="d-wg-nav-links" aria-label="En esta página">
            <a href="#que-es">¿Qué es?</a>
            <a href="#disenos">Diseños</a>
            <a href="#preguntas">Preguntas</a>
          </nav>
          <a href={RUTA_CTA} className="d-wg-nav-cta">{TEXTO_CTA}</a>
        </header>
      </div>
      {bloques.map((b, i) => {
        switch (b.tipo) {
          case 'hero': return <HeroWg key={i} b={b} />;
          case 'cifras': return <Cifras key={i} b={b} />;
          case 'tarjetas': {
            const n = nT++;
            // El orden de web-generator.ts: los diseños (la galería), qué es, qué puede armar, por qué (con el caso al lado) y
            // para quién.
            if (n === 0) return <Galeria key={i} b={b} />;
            if (n === 1) return <QueEs key={i} b={b} />;
            if (n === 2) return <QuePuedes key={i} b={b} />;
            if (n === 3) return <PorQue key={i} b={b} conCaso={bloques[i + 1]?.tipo === 'caso'} />;
            return <ParaQuien key={i} b={b} />;
          }
          // El caso va dentro de «Por qué», al lado de cada razón (como sus testimonios).
          case 'caso': return bloques[i - 1] === tarjetas[3] ? null : <PorQue key={i} b={{ tipo: 'tarjetas', titulo: '', items: [] }} conCaso />;
          case 'preguntas': return <Preguntas key={i} b={b} />;
          default: return null;
        }
      })}
      <Cierre />
      <Pie slug={landing.slug} />
      <script data-visor="" dangerouslySetInnerHTML={{ __html: SCRIPT }} />
    </div>
  );
}

// Los valores salen del CSS de la referencia (viene dentro de su HTML) y de getComputedStyle a 1440 y 390
// (docs/diseno/landings-competencia/web-generator.md). Sus violetas pasan al azul de MaKo.
const GRAD = 'linear-gradient(96deg, #2F6FED 0%, #5B8CF0 55%, #1F57C8 100%)';
const GRAD_BOTON = 'linear-gradient(111deg, #1F57C8 -2.59%, #2F6FED 54.66%, #5B8CF0 111.92%)';
const ESPIRAL = 'cubic-bezier(0.34, 1.56, 0.64, 1)';
const SUAVE = 'cubic-bezier(0.25, 1, 0.5, 1)';
const CSS = `
@font-face { font-family: 'Poppins'; font-style: normal; font-weight: 400; font-display: swap; src: url('/vsl-assets/fuentes/poppins/poppins-400.woff2') format('woff2'); }
@font-face { font-family: 'Poppins'; font-style: normal; font-weight: 600; font-display: swap; src: url('/vsl-assets/fuentes/poppins/poppins-600.woff2') format('woff2'); }
@font-face { font-family: 'Poppins'; font-style: normal; font-weight: 700; font-display: swap; src: url('/vsl-assets/fuentes/poppins/poppins-700.woff2') format('woff2'); }

.d-wg { background: #fff; color: #101828; font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 16px; line-height: 1.3; -webkit-font-smoothing: antialiased; overflow-x: clip; }
.d-wg *, .d-wg *::before, .d-wg *::after { box-sizing: border-box; }
.d-wg a { color: inherit; }
/* Sin peso (:where): así el margen de cada clase gana (el «margin: 16px auto 0» de una bajada). */
:where(.d-wg) :where(h1, h2, h3, h4, p, figure, blockquote) { margin: 0; }
.d-wg h2 em, .d-wg h1 em { font-style: normal; }
.d-wg-radio { position: absolute; opacity: 0; width: 1px; height: 1px; pointer-events: none; }
.d-wg-lights { display: flex; gap: 6px; flex: none; }
.d-wg-lights i { width: 10px; height: 10px; border-radius: 50%; display: block; background: #FF5F57; }
.d-wg-lights i:nth-child(2) { background: #FEBC2E; } .d-wg-lights i:nth-child(3) { background: #28C840; }

/* El botón de todas las secciones: 15px 34px, radio 10, 15.5px 600; con el mouse, al 92 %, scale(1.03) y la sombra más larga. */
.d-wg-cta { display: inline-block; padding: 15px 34px; border-radius: 10px; background-image: ${GRAD_BOTON}; box-shadow: 0 12px 26px -12px rgba(47,111,237,.85); color: #fff !important; font-size: 15.5px; font-weight: 600; letter-spacing: -.01em; text-decoration: none; text-align: center; white-space: nowrap; transition: transform .4s ${SUAVE}, opacity .4s ease, box-shadow .4s ease; }
@media (hover: hover) and (pointer: fine) { .d-wg-cta:hover { opacity: .92; transform: translateY(0) scale(1.03); box-shadow: 0 18px 34px -12px rgba(47,111,237,.95); } }
.d-wg-cta:focus-visible { outline: 2px solid #2F6FED; outline-offset: 3px; }

/* La barra: una cápsula de 1170 × 70, radio 16, rgba(111,205,255,.14), sobre #04192D. */
.d-wg-nav-fondo { background: #04192D; padding: 10px 20px; }
.d-wg-nav { max-width: 1170px; height: 70px; margin: 0 auto; padding: 8px 20px; border-radius: 16px; background: rgba(111,205,255,.14); display: flex; align-items: center; gap: 12px; }
.d-wg-logo { margin-right: auto; }
.d-wg-logo span:last-child { font-family: 'Poppins', sans-serif; }
.d-wg-nav-links { display: flex; gap: 12px; }
.d-wg-nav-links a { padding: 8px 6px; color: #fff; font-size: 15px; line-height: 19.5px; text-decoration: underline; text-underline-offset: 4px; text-decoration-thickness: 1.5px; margin-left: 12px; transition: opacity .15s ease; }
.d-wg-nav-links a:hover { opacity: .8; }
.d-wg-nav-cta { margin-left: 24px; padding: 6px 15px; height: 44px; white-space: nowrap; display: inline-flex; align-items: center; border-radius: 10px; background-image: ${GRAD_BOTON}; color: #fff !important; font-size: 16px; font-weight: 700; text-decoration: none; transition: transform .4s ${SUAVE}; }
.d-wg-nav-cta:hover { transform: scale(1.03); }

/* El hero: el azul noche que se aclara hasta el blanco detrás del video (muestreado de su imagen de fondo, en % del alto); dos
   columnas (1fr 1fr, 3.5em entre ellas) en 1140. */
.d-wg-hero { background-color: #04192C; background-image: linear-gradient(180deg, #04192C 0%, #04192C 35%, #03264C 45.6%, #02396F 56%, #055CAB 66%, #0092E2 76%, #51B9EE 81%, #ADE1F9 86%, #E1F5FF 91%, #fff 96%); padding: 30px 20px 100px; color: #fff; }
html[data-sitio-modo="oscuro"] .d-wg-hero { background-image: linear-gradient(180deg, #04192C 0%, #04192C 35%, #03264C 45.6%, #02396F 56%, #055CAB 66%, #0092E2 76%, #2B7FB8 81%, #1B3C4F 86%, #0E1219 91%, #090A0E 96%); }
html[data-sitio-modo="claro"] .d-wg-hero { background-color: #F4F8FE; background-image: linear-gradient(180deg, #E8F0FE 0%, #EDF3FE 40%, #F3F7FF 70%, #fff 96%); color: #101828; }
html[data-sitio-modo="claro"] .d-wg-badge { background: #fff; color: #101828; }
html[data-sitio-modo="claro"] .d-wg-h1 { color: #101828; }
html[data-sitio-modo="claro"] .d-wg-h1 em { background-image: ${GRAD}; }
html[data-sitio-modo="claro"] .d-wg-sub { color: #475467; }
html[data-sitio-modo="claro"] .d-wg-sub strong { color: #101828; }
.d-wg-hero-video { max-width: 1080px; margin: 120px auto 0; border-radius: 20px; overflow: hidden; background: #0B1220; box-shadow: 0 30px 60px -30px rgba(7,20,40,.45); }
.d-wg-hero-video video { display: block; width: 100%; height: auto; aspect-ratio: 16 / 10; object-fit: cover; }
.d-wg-ais { max-width: 1140px; margin: 0 auto; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 3.5em; align-items: flex-start; }
.d-wg-ais-head { text-align: start; margin-bottom: 24px; }
.d-wg-badge { display: inline-block; margin-bottom: 20px; padding: 12px 32px; border-radius: 9999px; border: 1px solid #86CBFA; background: #1C3249; color: #fff; font-size: clamp(14px, 1.7vw, 17px); font-weight: 500; letter-spacing: -0.005em; line-height: 1.3; }
.d-wg-h1 { color: #F4F8FE; font-size: clamp(34px, 5.4vw, 62px); font-weight: 600; line-height: 1.06; letter-spacing: -0.035em; }
.d-wg-h1 em { display: block; background-image: linear-gradient(90deg, #8DB0F4 0%, #B4CBF8 55%, #DCE7FC 100%); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent; }
.d-wg-sub { margin: 16px auto 0; max-width: 860px; color: #EEF4FC; font-size: clamp(16px, 2vw, 21px); line-height: 1.5; letter-spacing: -0.008em; }
.d-wg-sub strong { font-weight: 600; color: #fff; }

/* La tarjeta del constructor: blanca al 96 %, radio 26, 16px 16px 18px; la raya de luz arriba. */
.d-wg-demo { position: relative; border-radius: 26px; background: rgba(255,255,255,.96); -webkit-backdrop-filter: blur(16px); backdrop-filter: blur(16px); border: 1px solid rgba(154,196,255,.35); box-shadow: 0 1px 2px rgba(7,20,40,.2), 0 34px 80px -20px rgba(7,20,40,.6); padding: 16px 16px 18px; color: #101828; }
.d-wg-demo::before { content: ''; position: absolute; top: 0; left: 10%; right: 10%; height: 1px; background: linear-gradient(90deg, transparent, rgba(47,111,237,.7), rgba(91,140,240,.55), transparent); }
.d-wg-prompt { display: flex; align-items: center; gap: 11px; padding: 6px 6px 6px 16px; border-radius: 9999px; border: 1.5px solid #E1E8F2; background: #fff; box-shadow: 0 1px 2px rgba(16,24,40,.04); transition: border-color .25s ease, box-shadow .25s ease; }
.d-wg-prompt:focus-within { border-color: rgba(47,111,237,.6); box-shadow: 0 0 0 4px rgba(47,111,237,.12); }
.d-wg-spark { flex: none; color: #2F6FED; display: grid; place-items: center; }
.d-wg-input { flex: 1; min-width: 0; border: 0; outline: none; background: transparent; color: #101828; font-family: inherit; font-size: 15.5px; letter-spacing: -0.01em; padding: 11px 0; }
.d-wg-input::placeholder { color: #98A2B3; }
.d-wg-send { flex: none; width: 46px; height: 46px; border-radius: 9999px; background-image: ${GRAD}; color: #fff !important; display: grid; place-items: center; box-shadow: 0 6px 16px rgba(47,111,237,.35); transition: transform .25s ${ESPIRAL}, box-shadow .25s ease; }
@media (hover: hover) and (pointer: fine) { .d-wg-send:hover { transform: scale(1.08); box-shadow: 0 8px 22px rgba(47,111,237,.5); } }
.d-wg-send:active { transform: scale(.94); }
.d-wg-gal4 { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-top: 12px; }
.d-wg-ais.is-live .d-wg-gal4 { display: none; }
.d-wg-gal4.is-leaving { animation: dWgGalSale .26s ease both; }
@keyframes dWgGalSale { to { opacity: 0; transform: translateY(8px) scale(.98); } }
.d-wg-gcard { display: block; padding: 10px 10px 12px; border: 1.5px solid #E7EDF5; border-radius: 16px; background: #fff; text-align: left; text-decoration: none; cursor: pointer; transition: border-color .25s ease, transform .3s ${ESPIRAL}, box-shadow .3s ease; -webkit-tap-highlight-color: transparent; }
@media (hover: hover) and (pointer: fine) { .d-wg-gcard:hover { border-color: rgba(47,111,237,.5); transform: translateY(-3px); box-shadow: 0 14px 30px -10px rgba(31,70,130,.25); } }
.d-wg-gcard:active { transform: scale(.97); }
.d-wg-gprev { display: block; border-radius: 10px; overflow: hidden; border: 1px solid rgba(16,24,40,.06); background: #EEF2F8; aspect-ratio: 16 / 10; }
.d-wg-gprev img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: top; }
.d-wg-glabel { display: block; margin-top: 9px; color: #344054; font-size: 12.5px; font-weight: 600; letter-spacing: -0.01em; line-height: 1.3; }
.d-wg-glabel span { display: block; margin-top: 1px; color: #98A2B3; font-size: 10.5px; font-weight: 400; }
.d-wg-retry { display: none; align-items: center; flex-wrap: wrap; gap: 7px; margin: 12px 0 14px; }
.d-wg-ais.is-live .d-wg-retry { display: flex; }
.d-wg-retry-l { color: #98A2B3; font-size: 11.5px; font-weight: 500; margin-right: 3px; }
.d-wg-chip { padding: 6px 13px; border-radius: 9999px; border: 1px solid #E1E8F2; background: #F7FAFD; color: #475467 !important; font-size: 12px; font-weight: 500; text-decoration: none; cursor: pointer; transition: border-color .25s ease, color .25s ease, transform .25s ${ESPIRAL}, background .25s ease; }
@media (hover: hover) and (pointer: fine) { .d-wg-chip:hover { border-color: rgba(47,111,237,.5); color: #2F6FED !important; background: #F2F8FF; transform: translateY(-1px); } }
.d-wg-chip.is-on { border-color: rgba(47,111,237,.5); color: #2F6FED !important; background: #F2F8FF; }
.d-wg-stagewrap { display: none; }
.d-wg-ais.is-live .d-wg-stagewrap { display: block; animation: dWgStageEntra .55s ${ESPIRAL} both; }
@keyframes dWgStageEntra { from { opacity: 0; transform: translateY(18px) scale(.98); } to { opacity: 1; transform: none; } }
.d-wg-frame { position: relative; border: 1px solid #E1E8F2; border-radius: 18px; background: #fff; overflow: hidden; box-shadow: 0 10px 28px rgba(16,24,40,.07); transition: box-shadow .5s ease; }
.d-wg-frame.is-done { box-shadow: 0 10px 28px rgba(16,24,40,.07), 0 0 0 1.5px rgba(47,111,237,.4), 0 0 40px -8px rgba(47,111,237,.55); }
.d-wg-frame::after { content: ''; position: absolute; inset: 0; z-index: 6; background: linear-gradient(115deg, transparent 30%, rgba(255,255,255,.5) 50%, transparent 70%); transform: translateX(-120%); pointer-events: none; }
.d-wg-frame.is-done::after { animation: dWgDestello .9s ease .1s both; }
@keyframes dWgDestello { from { transform: translateX(-120%); } to { transform: translateX(120%); } }
.d-wg-chrome { display: flex; align-items: center; gap: 12px; padding: 10px 14px; background: #F7F9FC; border-bottom: 1px solid #EDF1F6; }
.d-wg-url { flex: 1; max-width: 340px; margin: 0 auto; display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 5px 14px; border-radius: 8px; background: #fff; border: 1px solid #E9EDF3; color: #667085; font-size: 11.5px; white-space: nowrap; overflow: hidden; }
.d-wg-url svg { flex: none; color: #98A2B3; }
.d-wg-url b { font-weight: 400; overflow: hidden; text-overflow: ellipsis; }
.d-wg-status { flex: none; display: inline-flex; align-items: center; justify-content: flex-end; gap: 7px; min-width: 150px; color: #667085; font-size: 11px; font-weight: 500; white-space: nowrap; }
.d-wg-spin { width: 11px; height: 11px; flex: none; border: 2px solid #D8E6FF; border-top-color: #2F6FED; border-radius: 50%; opacity: 0; }
.d-wg-ais.is-building .d-wg-spin { opacity: 1; animation: dWgGira .8s linear infinite; }
@keyframes dWgGira { to { transform: rotate(360deg); } }
.d-wg-done { display: none; align-items: center; gap: 6px; padding: 3px 11px; border-radius: 9999px; background: #E8F7EE; color: #16803E; font-size: 10.5px; font-weight: 600; }
.d-wg-done.is-shown { display: inline-flex; animation: dWgPop .5s ${ESPIRAL} both; }
@keyframes dWgPop { from { opacity: 0; transform: scale(.6); } to { opacity: 1; transform: scale(1); } }
.d-wg-progress { height: 2.5px; background: #EDF1F6; }
.d-wg-progress i { display: block; height: 100%; width: 0; background-image: ${GRAD}; }
.d-wg-site { position: relative; aspect-ratio: 16 / 9; background: #fff; overflow: hidden; }
.d-wg-wash { position: absolute; inset: 0; z-index: 0; background: #EAF1FE; clip-path: circle(0% at 50% 0%); transition: clip-path 1s ${SUAVE}; pointer-events: none; }
.d-wg-site.is-washed .d-wg-wash { clip-path: circle(160% at 50% 0%); }
.d-wg-beam { position: absolute; left: 0; right: 0; top: 0; height: 90px; z-index: 3; background: linear-gradient(180deg, transparent, rgba(47,111,237,.12) 40%, rgba(91,140,240,.1) 60%, transparent); opacity: 0; pointer-events: none; transform: translateY(-100px); }
.d-wg-frame.is-scanning .d-wg-beam { opacity: 1; animation: dWgBarrido 2.6s ease-in-out both; }
@keyframes dWgBarrido { from { transform: translateY(-100px); } to { transform: translateY(480px); } }
.d-wg-pieza { position: absolute; inset: 0; z-index: 1; width: 100%; height: 100%; object-fit: cover; object-position: top; display: block; opacity: 0; }
.d-wg-site[data-ver="video"] .d-wg-site-video { opacity: 1; animation: dWgPieza .55s ${ESPIRAL} both; background: #0B1220; }
.d-wg-site[data-ver="img"] .d-wg-site-img { opacity: 1; clip-path: inset(0 0 100% 0); }
.d-wg-site[data-ver="img"].is-armando .d-wg-site-img { clip-path: inset(0 0 0 0); transition: clip-path 3.1s cubic-bezier(.45, 0, .2, 1); }
@keyframes dWgPieza { from { opacity: 0; transform: translateY(14px) scale(.96); } to { opacity: 1; transform: none; } }
.d-wg-pro { position: absolute; z-index: 4; right: 10px; top: 10px; padding: 4px 10px; border-radius: 9999px; background: #12151B; color: #F2B01E; font-size: 10.5px; font-weight: 600; letter-spacing: .01em; opacity: 0; transform: scale(.7); pointer-events: none; }
.d-wg-pro.is-shown { opacity: 1; transform: none; transition: opacity .3s ease, transform .45s ${ESPIRAL}; }

/* La galería: la sección queda fija mientras las tarjetas se arman (el alto lo pone su script: --stage y --pin). */
/* Las secciones del constructor envuelven su código con 20 px de sección + 10 de fila + 10 de columna, arriba y abajo. */
.d-wg-hst, .d-wg-wis, .d-wg-wcb, .d-wg-why, .d-wg-cir, .d-wg-faq, .d-wg-ctaf { padding: 40px 0; }
.d-wg-galeria { background: #fff; padding: 70px 0 20px; }
.d-wg-gal-head { max-width: 1110px; margin: 0 auto; padding: 0 20px; text-align: center; }
.d-wg-h2-gal { font-size: 42px; line-height: 1.486; font-weight: 600; letter-spacing: -0.035em; color: #000; }
/* Sus dos entradas (animate.css del constructor): el título sube desde su propio alto en .6s lineal; la línea, fadeInUp de 1 s. */
.d-wg-entra-caja { overflow: hidden; }
.d-wg-js .d-wg-entra { opacity: 0; }
.d-wg-js .d-wg-entra.on.d-wg-entra-sube { animation: dWgSube .6s linear both; }
.d-wg-js .d-wg-entra.on.d-wg-entra-funde { animation: dWgSube 1s ease both; }
@keyframes dWgSube { from { opacity: 0; transform: translate3d(0, 100%, 0); } to { opacity: 1; transform: none; } }
.d-wg-h2-gal em { display: block; background-image: linear-gradient(119deg, #2F6FED 15.13%, #5B8CF0 51.44%, #1F57C8 87.75%); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent; }
.d-wg-gal-sub { margin-top: 10px; color: #A3A6AD; font-size: 18px; line-height: 1.5; }
.d-wg-gal-sub em { font-style: italic; }
.d-wg-proof { position: relative; width: 100%; --cs: 1; --gap: calc(2.2vw * var(--cs, 1)); --gutter: calc(4vh * var(--cs, 1)); }
.d-wg-proof.is-vivo { height: var(--pin, 320vh); }
.d-wg-proof-stage { overflow: hidden; overflow-x: clip; overflow-y: visible; display: flex; flex-direction: column; padding: 40px 0; }
.d-wg-proof.is-vivo .d-wg-proof-stage { position: sticky; top: 0; height: var(--stage, 100vh); padding: 0; }
.d-wg-rows { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: var(--gutter); min-height: 0; }
.d-wg-row { display: flex; }
.d-wg-track { display: flex; flex: none; gap: var(--gap); will-change: transform; padding: 0 20px; }
.d-wg-proof.is-vivo .d-wg-track { padding: 0; }
.d-wg-row-arriba .d-wg-track { align-items: flex-end; }
.d-wg-row-abajo .d-wg-track { align-items: flex-start; }
.d-wg-card { position: relative; flex: none; width: calc(var(--w) * var(--cs, 1) * 1vw); aspect-ratio: var(--ar); background: #fff; border: max(6px, calc(.65vw * var(--cs, 1))) solid var(--marco, #2F6FED); will-change: transform; backface-visibility: hidden; }
.d-wg-card-img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: top; }
.d-wg-card-tab { position: absolute; left: -1px; top: -1px; padding: 3px 10px 5px 8px; background: var(--marco, #2F6FED); color: #fff; font-size: 11px; font-weight: 600; letter-spacing: -0.005em; white-space: nowrap; max-width: calc(100% - 10px); overflow: hidden; text-overflow: ellipsis; }
.d-wg-pwc { width: min(100%, 1120px); margin: 0 auto; padding: 8px 20px 56px; display: flex; align-items: center; justify-content: center; gap: 22px; flex-wrap: wrap; }
.d-wg-pwc-line { color: #475467; font-size: 17px; font-weight: 500; letter-spacing: -.015em; }

/* Los contadores: 1150 entre dos rayas #DADADA, 80px arriba y 76 abajo; cuentan al verse y crecen al 103 % con el mouse. */
.d-wg-hst { background: #fff; }
.d-wg-hst-shell { width: min(100% - 40px, 1150px); margin: 0 auto; padding: 80px 0 76px; border-top: 1px solid #DADADA; border-bottom: 1px solid #DADADA; }
.d-wg-hst-title { text-align: center; font-size: clamp(28px, 3.4vw, 42px); font-weight: 600; line-height: 1.2; letter-spacing: -.035em; color: #000; margin-bottom: 58px; }
.d-wg-hst-title em { background-image: linear-gradient(90deg, #2F6FED 0%, #1F57C8 100%); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent; padding-bottom: .14em; margin-bottom: -.14em; }
.d-wg-hst-grid { display: grid; grid-template-columns: repeat(var(--n, 4), minmax(0, 1fr)); gap: 30px; }
.d-wg-hst-card { min-height: 170px; padding: 26px 22px 28px; border-radius: 22px; background: #fff; border: 1px solid #E4E4E4; box-shadow: 0 2px 10px rgba(0,0,0,.05); text-align: center; transition: transform .4s ${SUAVE}; }
@media (hover: hover) and (pointer: fine) { .d-wg-hst-card:hover { transform: translateY(0) scale(1.03); } }
.d-wg-hst-num { display: block; font-size: clamp(36px, 3.6vw, 46px); font-weight: 700; line-height: 1.15; letter-spacing: -.02em; background-image: linear-gradient(90deg, #1F2630 0%, #3A3F48 55%, #6B6B70 100%); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent; font-variant-numeric: tabular-nums; }
.d-wg-hst-lab { display: block; margin-top: 20px; font-size: 15px; font-weight: 500; line-height: 1.15; letter-spacing: .2em; text-transform: uppercase; color: #111729; }

/* ¿Qué es?: 1180, encabezado centrado de 780; texto (1fr) y el deslizador (1.06fr, 3:2) con 54 entre ellos. */
.d-wg-wis { background: #fff; }
.d-wg-wis-shell { width: min(100%, 1180px); margin: 0 auto; padding: 62px 20px 66px; }
.d-wg-wis-head { text-align: center; max-width: 780px; margin: 0 auto 46px; }
.d-wg-wis-title { font-size: clamp(29px, 4.2vw, 46px); font-weight: 600; line-height: 1.07; letter-spacing: -.04em; color: #101828; margin-bottom: 16px; }
.d-wg-wis-title em, .d-wg-wcb-title em, .d-wg-why-title em, .d-wg-cir-title em, .d-wg-faq-title em, .d-wg-ctaf-title em { background-image: ${GRAD}; -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent; }
.d-wg-wis-lede { color: #475467; font-size: clamp(16px, 2vw, 19px); line-height: 1.62; }
.d-wg-wis-lede strong { color: #101828; font-weight: 600; }
.d-wg-wis-grid { display: grid; grid-template-columns: 1fr 1.06fr; gap: 54px; align-items: center; }
.d-wg-wis-block { margin-bottom: 30px; }
.d-wg-wis-block h3 { font-size: 19px; font-weight: 600; letter-spacing: -.022em; color: #1F57C8; margin-bottom: 9px; }
.d-wg-wis-block p { color: #475467; font-size: 15px; line-height: 1.66; }
.d-wg-wis-block strong { color: #101828; font-weight: 600; }
.d-wg-wis-cta { margin-top: 26px; }
.d-wg-rv { --x: 47%; position: relative; width: 100%; aspect-ratio: 3 / 2; border-radius: 12px; overflow: hidden; background: #101828; user-select: none; -webkit-user-select: none; touch-action: pan-y; cursor: ew-resize; box-shadow: 0 2px 6px rgba(16,24,40,.06), 0 30px 64px -30px rgba(16,24,40,.8); }
.d-wg-rv-layer { position: absolute; inset: 0; }
.d-wg-rv-before { z-index: 2; background: linear-gradient(165deg, #101828 0%, #0B1220 100%); clip-path: inset(0 calc(100% - var(--x)) 0 0); display: grid; place-items: center; padding: 0 5%; }
.d-wg-rv-card { width: 100%; background: #fff; border-radius: 12px; padding: 5.5% 6%; min-height: 44%; display: flex; flex-direction: column; justify-content: space-between; gap: 12px; box-shadow: 0 14px 34px -14px rgba(0,0,0,.45); }
.d-wg-rv-q { font-size: clamp(12px, 1.35vw, 17px); color: #14181F; letter-spacing: -.01em; font-weight: 600; }
.d-wg-rv-opt { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border-radius: 10px; border: 1.5px solid #2F6FED; background: #EAF1FE; }
.d-wg-rv-opt b { font-size: clamp(11px, 1.1vw, 14px); font-weight: 600; color: #101828; }
.d-wg-rv-opt span { font-size: clamp(10px, .95vw, 12px); color: #475467; }
.d-wg-rv-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.d-wg-rv-ic { width: 1.9vw; min-width: 22px; aspect-ratio: 1; border-radius: 50%; border: 1px solid #DCDCDC; background: #fff; display: grid; place-items: center; color: #6B6B6B; flex: none; }
.d-wg-rv-tools { display: flex; align-items: center; gap: 14px; color: #9A9A9A; font-size: clamp(10px, .9vw, 12px); }
.d-wg-rv-send { width: 2vw; min-width: 24px; aspect-ratio: 1; border-radius: 50%; background: #2F6FED; display: grid; place-items: center; color: #fff; flex: none; }
.d-wg-rv-after { z-index: 1; background: #F7F4EF; overflow: hidden; }
.d-wg-rv-img { width: 100%; height: 100%; object-fit: cover; object-position: top; display: block; user-select: none; -webkit-user-drag: none; }
.d-wg-rv-sparkles { position: absolute; inset: 0; z-index: 3; pointer-events: none; width: 100%; height: 100%; }
.d-wg-rv-divider { position: absolute; top: 0; bottom: 0; left: var(--x); z-index: 4; width: 0; }
.d-wg-rv-edge { position: absolute; inset: 0; z-index: 4; pointer-events: none; overflow: visible; width: 100%; height: 100%; }
.d-wg-rv-edge path { fill: none; stroke: #F2B01E; stroke-width: 4px; stroke-linejoin: round; stroke-linecap: square; }
.d-wg-rv-bloom { position: absolute; top: 0; bottom: 0; left: 0; width: 84px; background: linear-gradient(90deg, rgba(255,214,130,.34), rgba(255,214,130,0)); opacity: 0; transition: opacity 260ms ease; mix-blend-mode: screen; }
.d-wg-rv.is-active .d-wg-rv-bloom { opacity: 1; }
.d-wg-rv-handle { position: absolute; z-index: 5; top: 50%; left: var(--x); transform: translate(-50%, -50%); width: 32px; height: 32px; border-radius: 50%; background: #111318; border: 3px solid #F2B01E; display: grid; place-items: center; color: #fff; cursor: ew-resize; box-shadow: 0 2px 10px rgba(0,0,0,.4), 0 0 0 4px rgba(242,176,30,.22); transition: transform 220ms cubic-bezier(.22, 1, .36, 1); }
.d-wg-rv-handle:hover { transform: translate(-50%, -50%) scale(1.09); }
.d-wg-rv-handle:active { transform: translate(-50%, -50%) scale(.95); }
.d-wg-rv-handle:focus-visible { outline: 3px solid #fff; outline-offset: 3px; }

/* ¿Qué puede armar?: 1340; la lista de 350 y la ventana con 26 entre ellas; la vista de 560 de alto. */
.d-wg-wcb { background: #fff; }
.d-wg-wcb-shell { width: min(100%, 1340px); margin: 0 auto; padding: 64px 20px; }
.d-wg-wcb-head { text-align: center; margin-bottom: 40px; }
.d-wg-wcb-title { font-size: clamp(28px, 4.2vw, 46px); font-weight: 600; line-height: 1.1; letter-spacing: -0.038em; color: #101828; }
.d-wg-wcb-sub { margin-top: 14px; color: #475467; font-size: clamp(15px, 1.9vw, 18px); }
/* Su CSS arma primero una lista a la izquierda (350) y al final la pisa con una FILA de pestañas centradas: lo que se ve es la fila. */
.d-wg-explorer { display: grid; grid-template-columns: 1fr; gap: 18px; align-items: start; }
.d-wg-list { display: flex; flex-direction: row; justify-content: center; gap: 10px; overflow-x: auto; padding: 4px 2px 8px; scrollbar-width: none; }
.d-wg-list::-webkit-scrollbar { display: none; }
.d-wg-option { position: relative; overflow: hidden; flex: 1 1 0; min-width: 150px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 10px; padding: 16px 12px 18px; border-radius: 14px; border: 1px solid #E7EBF1; background: #fff; color: #101828; cursor: pointer; transition: border-color .25s ease, background .25s ease, transform .25s ${ESPIRAL}, box-shadow .25s ease; -webkit-tap-highlight-color: transparent; }
@media (hover: hover) and (pointer: fine) { .d-wg-option:hover { border-color: #C9D5E6; transform: translateY(-1px); } }
.d-wg-option-ic { flex: none; width: 42px; height: 42px; border-radius: 11px; display: grid; place-items: center; background: #F8FAFD; color: #7A8697; transition: background .3s ease, color .3s ease; }
.d-wg-option-copy { flex: none; }
.d-wg-option-copy strong { display: block; font-size: 14px; font-weight: 600; letter-spacing: -0.015em; line-height: 1.3; }
.d-wg-prog { position: absolute; left: 0; bottom: 0; height: 2.5px; width: 0; background: var(--acc); pointer-events: none; }
.d-wg-option.is-active .d-wg-prog.is-running { animation: dWgProg 5400ms linear both; }
@keyframes dWgProg { from { width: 0; } to { width: 100%; } }
.d-wg-wcb-stage { position: relative; }
.d-wg-window { border-radius: 16px; background: #fff; overflow: hidden; border: 1px solid #E7EBF1; box-shadow: 0 1px 2px rgba(16,24,40,.03), 0 22px 50px -30px rgba(16,24,40,.5); transition: border-color .5s ease, box-shadow .5s ease; }
.d-wg-wcb-stage.is-done .d-wg-window { border-color: var(--acc, #2F6FED); box-shadow: 0 1px 2px rgba(16,24,40,.03), 0 22px 50px -26px rgba(16,24,40,.55); }
.d-wg-wcb-chrome { display: flex; align-items: center; gap: 9px; padding: 11px 15px; background: #F6F8FC; border-bottom: 1px solid #EAEEF4; }
.d-wg-wcb-chrome .d-wg-lights { gap: 5px; } .d-wg-wcb-chrome .d-wg-lights i { width: 9px; height: 9px; }
.d-wg-wcb-chrome-t { margin-left: 5px; color: #7A8697; font-size: 11.5px; font-weight: 500; }
.d-wg-wcb-done { display: none !important; align-items: center; gap: 6px; margin-left: auto; padding: 4px 11px; border-radius: 9999px; background: #E8F6EF; color: #0F7A45; font-size: 10.5px; font-weight: 700; letter-spacing: .02em; white-space: nowrap; opacity: 0; transform: scale(.7); }
.d-wg-wcb-done.is-shown { opacity: 1; transform: scale(1); transition: opacity .3s ease, transform .45s ${ESPIRAL}; }
.d-wg-promptbar { display: flex; align-items: center; gap: 9px; padding: 12px 17px; border-bottom: 1px solid #EAEEF4; background: #fff; font-size: 13px; color: #101828; min-height: 42px; }
.d-wg-wcb-spark { flex: none; color: var(--acc, #2F6FED); display: grid; place-items: center; transition: color .4s ease; }
.d-wg-wcb-spark svg { width: 16px; height: 16px; }
.d-wg-caret { display: inline-block; width: 2px; height: 14px; background: var(--acc, #2F6FED); opacity: 0; margin-left: -6px; }
.d-wg-wcb.is-typing .d-wg-caret { opacity: 1; animation: dWgCaret .8s step-end infinite; }
@keyframes dWgCaret { 50% { opacity: 0; } }
.d-wg-wcb-content { position: relative; padding: 34px 38px; height: 580px; overflow: hidden; background: #FBFCFE; }
.d-wg-project { display: none; }
.d-wg-project h4 { font-size: clamp(21px, 2.4vw, 27px); font-weight: 600; letter-spacing: -0.026em; line-height: 1.2; color: #101828; margin-bottom: 6px; text-align: center; }
.d-wg-project > p { color: #475467; font-size: 14.5px; line-height: 1.6; text-align: center; max-width: 560px; margin: 0 auto 24px; }
.d-wg-project strong { color: #101828; font-weight: 600; }
.d-wg-po { opacity: 1; }
.d-wg-js .d-wg-po { opacity: 0; transform: translateY(9px) scale(.985); }
.d-wg-js .d-wg-po.on { opacity: 1; transform: none; transition: opacity .38s ease, transform .48s ${ESPIRAL}; }
.d-wg-shot { position: relative; max-width: 780px; margin: 0 auto; border-radius: 13px; background: #fff; border: 1px solid #E7EBF1; box-shadow: 0 10px 30px -18px rgba(16,24,40,.5); overflow: hidden; }
.d-wg-shot img, .d-wg-shot video { display: block; width: 100%; height: auto; aspect-ratio: 16 / 9; object-fit: cover; object-position: top; background: #0B1220; }
.d-wg-shot-pro { position: absolute; z-index: 2; right: 10px; top: 10px; padding: 4px 10px; border-radius: 9999px; background: #12151B; color: #F2B01E; font-size: 11px; font-weight: 600; }
${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `#d-wg-t${i}:checked ~ .d-wg-list .d-wg-option-${i} { background: var(--soft); border-color: var(--acc); box-shadow: 0 1px 2px rgba(16,24,40,.03), 0 12px 28px -20px rgba(16,24,40,.5); }
#d-wg-t${i}:checked ~ .d-wg-list .d-wg-option-${i} .d-wg-option-ic { background: var(--acc); color: #fff; }
#d-wg-t${i}:focus-visible ~ .d-wg-list .d-wg-option-${i} { outline: 2px solid var(--acc); outline-offset: 2px; }
#d-wg-t${i}:checked ~ .d-wg-wcb-stage .d-wg-project-${i} { display: block; }
#d-wg-p${i}:checked ~ .d-wg-cir-chips .d-wg-cir-chip-${i} { color: #fff; border-color: transparent; background: var(--chip); box-shadow: 0 10px 22px -10px var(--chip); }
#d-wg-p${i}:focus-visible ~ .d-wg-cir-chips .d-wg-cir-chip-${i} { outline: 2px solid var(--chip); outline-offset: 2px; }
#d-wg-p${i}:checked ~ .d-wg-cir-stage .d-wg-cir-pan-${i} { display: block; }`).join('\n')}

/* Por qué: 1120; el título (660) con el botón a la derecha; la grilla 1.35fr / 1fr con 16 entre ellas; entran escalonadas. */
.d-wg-why { background: #fff; }
.d-wg-why-shell { width: min(100%, 1120px); margin: 0 auto; padding: 56px 20px 64px; }
.d-wg-why-head { display: flex; align-items: flex-end; justify-content: space-between; flex-wrap: wrap; gap: 18px 32px; margin-bottom: 40px; }
.d-wg-why-title { max-width: 660px; font-size: clamp(28px, 4vw, 44px); font-weight: 600; line-height: 1.1; letter-spacing: -.035em; color: #0F1D2E; }
.d-wg-why-cta { flex: none; }
.d-wg-why-grid { display: grid; grid-template-columns: 1.35fr 1fr; gap: 16px; }
.d-wg-why-card, .d-wg-why-quote { position: relative; display: flex; flex-direction: column; border-radius: 20px; transition: opacity .5s ease, transform .55s ${ESPIRAL}, border-color .3s ease, box-shadow .3s ease; }
.d-wg-js .d-wg-why-card, .d-wg-js .d-wg-why-quote { opacity: 0; transform: translateY(14px); }
.d-wg-js .d-wg-why-card.on, .d-wg-js .d-wg-why-quote.on { opacity: 1; transform: none; }
.d-wg-why-card { padding: 26px 26px 24px; background: #fff; border: 1px solid #E5EAF2; box-shadow: 0 1px 2px rgba(15,29,46,.03); }
.d-wg-why-card::before { content: ''; position: absolute; top: -1px; left: 26px; width: 46px; height: 3px; border-radius: 0 0 3px 3px; background: var(--a); }
@media (hover: hover) and (pointer: fine) { .d-wg-why-card:hover { border-color: var(--a); box-shadow: 0 1px 2px rgba(15,29,46,.04), 0 10px 20px -14px rgba(15,29,46,.3), 0 22px 44px -24px rgba(15,29,46,.45); } .d-wg-why-card:hover .d-wg-why-ic { transform: translateY(-2px); } }
.d-wg-why-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 18px; }
.d-wg-why-ic { display: grid; place-items: center; width: 42px; height: 42px; flex: none; border-radius: 12px; background: var(--a-soft); color: var(--a); transition: transform .3s ${ESPIRAL}; }
.d-wg-why-num { font-size: 11.5px; font-weight: 700; letter-spacing: .1em; color: #C3CCDA; font-variant-numeric: tabular-nums; }
.d-wg-why-card h3 { font-size: 21px; font-weight: 600; line-height: 1.25; letter-spacing: -.024em; color: #0F1D2E; margin-bottom: 10px; }
.d-wg-why-card p { color: #55637A; font-size: 14.5px; line-height: 1.64; letter-spacing: -.005em; }
.d-wg-why-card strong { color: #0F1D2E; font-weight: 600; }
.d-wg-why-quote { padding: 26px; background: var(--a-soft); border: 1px solid transparent; justify-content: center; }
.d-wg-why-mark { display: block; font-size: 38px; line-height: .6; color: var(--a); opacity: .28; margin-bottom: 14px; font-family: Georgia, 'Times New Roman', serif; }
.d-wg-why-quote blockquote { color: #0F1D2E; font-size: 17px; font-weight: 500; line-height: 1.45; letter-spacing: -.02em; margin-bottom: 22px; }
.d-wg-why-quote blockquote strong { font-weight: 600; }
.d-wg-why-quote figcaption { display: flex; align-items: center; gap: 11px; }
.d-wg-why-av { flex: none; width: 34px; height: 34px; border-radius: 50%; background: var(--a); color: #fff; font-size: 11.5px; font-weight: 700; letter-spacing: .02em; line-height: 34px; text-align: center; }
.d-wg-why-by b { display: block; font-size: 12.5px; font-weight: 600; color: #0F1D2E; }
.d-wg-why-by i { display: block; font-style: normal; font-size: 11.5px; color: #8794A8; margin-top: 1px; }

/* ¿Para quién?: 1340; pastillas de 10px 20px; el navegador, el cable (176) y lo que pasa después. */
.d-wg-cir { background: #fff; }
.d-wg-cir-shell { width: min(100%, 1340px); margin: 0 auto; padding: 64px 24px; }
.d-wg-cir-head { text-align: center; margin-bottom: 30px; }
.d-wg-cir-title { font-size: clamp(28px, 4.2vw, 46px); font-weight: 600; line-height: 1.1; letter-spacing: -.038em; color: #101828; }
.d-wg-cir-sub { margin: 15px auto 0; max-width: 560px; color: #475467; font-size: clamp(15px, 1.9vw, 18px); line-height: 1.6; }
.d-wg-cir-sub strong { color: #101828; font-weight: 600; }
.d-wg-cir-chips { display: flex; justify-content: center; flex-wrap: wrap; gap: 9px; margin-bottom: 44px; }
.d-wg-cir-chip { padding: 10px 20px; border-radius: 9999px; border: 1px solid #E7EBF1; background: #fff; color: #475467; font-size: 13.5px; font-weight: 500; letter-spacing: -.01em; cursor: pointer; transition: color .25s ease, border-color .25s ease, background .25s ease, transform .25s ${ESPIRAL}; -webkit-tap-highlight-color: transparent; }
@media (hover: hover) and (pointer: fine) { .d-wg-cir-chip:hover { color: #101828; border-color: #C4D0E2; transform: translateY(-1px); } }
.d-wg-cir-stage { display: grid; grid-template-columns: minmax(0, 1fr) 176px minmax(0, 1.02fr); align-items: center; }
.d-wg-cir-left { position: relative; }
.d-wg-cir-browser { display: none; position: relative; border-radius: 20px; background: #fff; border: 1px solid #E7EBF1; box-shadow: 0 1px 2px rgba(16,24,40,.03), 0 24px 54px -30px rgba(16,24,40,.5); transition: box-shadow .5s ease, border-color .5s ease; }
.d-wg-cir-stage.is-sent .d-wg-cir-browser { border-color: var(--acc); box-shadow: 0 1px 2px rgba(16,24,40,.03), 0 14px 28px -18px rgba(16,24,40,.3), 0 28px 60px -30px rgba(16,24,40,.6); }
.d-wg-cir-chrome { display: flex; align-items: center; gap: 11px; padding: 12px 16px; background: #F8FAFD; border-bottom: 1px solid #EDF1F7; border-radius: 20px 20px 0 0; }
.d-wg-cir-chrome .d-wg-lights { gap: 5px; } .d-wg-cir-chrome .d-wg-lights i { width: 9px; height: 9px; }
.d-wg-cir-url { font-size: 11.5px; color: #7A8697; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.d-wg-cir-live { display: inline-flex; align-items: center; gap: 6px; padding: 4px 11px; border-radius: 9999px; background: #E8F6EF; color: #0F7A45; font-size: 10px; font-weight: 700; letter-spacing: .04em; }
.d-wg-cir-live::before { content: ''; width: 5px; height: 5px; border-radius: 50%; background: #12B76A; }
.d-wg-cir-form { padding: 24px 26px 26px; }
.d-wg-cir-form-t { font-size: 17px; font-weight: 600; color: #101828; margin-bottom: 18px; letter-spacing: -.02em; }
.d-wg-cir-field { border: 1.5px solid #E7EBF1; border-radius: 11px; padding: 9px 14px; margin-bottom: 10px; min-height: 52px; transition: border-color .3s ease, background .3s ease, box-shadow .3s ease; }
.d-wg-cir-field.is-typing { border-color: var(--acc); background: #FDFDFF; box-shadow: 0 0 0 4px var(--soft); }
.d-wg-cir-field-lab { display: block; font-size: 9.5px; font-weight: 700; letter-spacing: .09em; text-transform: uppercase; color: #A9B4C4; }
.d-wg-cir-field-val { display: block; margin-top: 4px; font-size: 14px; color: #101828; min-height: 20px; letter-spacing: -.005em; }
.d-wg-cir-submit { margin-top: 18px; padding: 14px; border-radius: 11px; background: var(--acc); color: #fff; font-size: 14px; font-weight: 600; text-align: center; letter-spacing: -.01em; box-shadow: 0 10px 22px -10px var(--acc); transition: transform .18s ease; }
.d-wg-cir-submit.is-pressed { transform: scale(.965); }
.d-wg-cir-packet { position: absolute; z-index: 7; right: -30px; top: 50%; display: flex; align-items: center; gap: 10px; padding: 9px 15px 9px 10px; border-radius: 14px; background: #fff; border: 1px solid #E7EBF1; box-shadow: 0 16px 36px -14px rgba(16,24,40,.45); opacity: 0; transform: translateY(6px) scale(.86); pointer-events: none; white-space: nowrap; }
.d-wg-cir-packet.is-out { opacity: 1; transform: translateY(0) scale(1); transition: opacity .3s ease, transform .5s ${ESPIRAL}; }
.d-wg-cir-packet.is-gone { opacity: 0; transform: translateX(52px) scale(.9); transition: opacity .45s ease, transform .55s ${SUAVE}; }
.d-wg-cir-packet-av { width: 29px; height: 29px; flex: none; border-radius: 50%; background: var(--acc); color: #fff; font-size: 12px; font-weight: 600; line-height: 29px; text-align: center; }
.d-wg-cir-packet-copy b { display: block; font-size: 12px; font-weight: 600; color: #101828; }
.d-wg-cir-packet-copy i { display: block; font-style: normal; font-size: 10.5px; color: #7A8697; }
.d-wg-cir-wire { width: 100%; height: 100%; overflow: visible; align-self: stretch; }
.d-wg-cir-wire path { fill: none; stroke-width: 1.8; stroke-linecap: round; }
.d-wg-cir-track { stroke: #E1E8F2; }
.d-wg-cir-live { stroke: var(--acc, #2F6FED); }
.d-wg-cir-live.on { transition: stroke-dashoffset .78s ${SUAVE}; }
.d-wg-cir-pulse { fill: var(--acc, #2F6FED); opacity: 0; }
.d-wg-cir-pulse.is-live { opacity: 1; }
.d-wg-cir-chain { display: flex; flex-direction: column; gap: 12px; }
.d-wg-cir-chain-lab { font-size: 10.5px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: #7A8697; margin-bottom: 4px; }
.d-wg-cir-node { position: relative; display: flex; align-items: center; gap: 15px; padding: 18px 19px; border-radius: 16px; background: #fff; border: 1px solid #E7EBF1; transition: opacity .5s ease, transform .55s ${ESPIRAL}, border-color .5s ease, box-shadow .5s ease; }
.d-wg-js .d-wg-cir-node { opacity: .55; transform: translateX(10px); }
.d-wg-cir-node.on { opacity: 1 !important; transform: none !important; border-color: var(--acc, #2F6FED); box-shadow: 0 1px 2px rgba(16,24,40,.03), 0 10px 20px -14px rgba(16,24,40,.25), 0 20px 40px -26px rgba(16,24,40,.5); }
.d-wg-cir-node-ic { flex: none; width: 44px; height: 44px; border-radius: 13px; display: grid; place-items: center; background: #F8FAFD; color: #A9B4C4; transition: background .5s ease, color .5s ease; }
.d-wg-cir-node-ic svg { width: 20px; height: 20px; }
.d-wg-cir-node.on .d-wg-cir-node-ic { background: var(--soft, #EAF1FE); color: var(--acc, #2F6FED); }
.d-wg-cir-node-copy { flex: 1; min-width: 0; }
.d-wg-cir-node-copy b { display: block; font-size: 14.5px; font-weight: 600; color: #101828; letter-spacing: -.015em; line-height: 1.3; }
.d-wg-cir-node-copy i { display: block; font-style: normal; font-size: 13px; color: #7A8697; margin-top: 3px; line-height: 1.45; }
.d-wg-cir-node-num { flex: none; font-size: 11.5px; font-weight: 700; letter-spacing: .08em; color: #C9D2DF; font-variant-numeric: tabular-nums; transition: opacity .3s ease, transform .3s ease; }
.d-wg-cir-node.on .d-wg-cir-node-num { opacity: 0; transform: scale(.8); }
.d-wg-cir-node-tick { position: absolute; right: 19px; width: 24px; height: 24px; border-radius: 50%; background: #E8F6EF; color: #0F7A45; display: grid; place-items: center; opacity: 0; transform: scale(.4); }
.d-wg-cir-node.on .d-wg-cir-node-tick { opacity: 1; transform: none; transition: opacity .3s ease .25s, transform .5s ${ESPIRAL} .25s; }
.d-wg-cir-cta { text-align: center; margin-top: 40px; }

/* Preguntas: 1120; dos columnas con 14; cada una #EFF4FE, radio 14; la abierta y la del mouse con el borde azul. */
.d-wg-faq { background: #fff; }
.d-wg-faq-shell { width: min(100%, 1120px); margin: 0 auto; padding: 48px 20px; }
.d-wg-faq-head { text-align: center; margin-bottom: 32px; }
.d-wg-faq-title { font-size: clamp(28px, 4vw, 42px); font-weight: 600; line-height: 1.12; letter-spacing: -.035em; color: #101828; }
.d-wg-faq-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; align-items: start; }
.d-wg-faq-item { border-radius: 14px; background: #EFF4FE; border: 1px solid transparent; overflow: hidden; transition: border-color .25s ease; }
.d-wg-faq-item[open] { border-color: rgba(47,111,237,.35); }
@media (hover: hover) and (pointer: fine) { .d-wg-faq-item:hover { border-color: rgba(47,111,237,.28); } }
.d-wg-faq-item summary { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 18px 20px; cursor: pointer; list-style: none; color: #101828; font-size: 15.5px; font-weight: 500; line-height: 1.4; letter-spacing: -.01em; -webkit-tap-highlight-color: transparent; }
.d-wg-faq-item summary::-webkit-details-marker { display: none; }
.d-wg-faq-item summary:focus-visible { outline: 2px solid rgba(47,111,237,.55); outline-offset: -2px; }
.d-wg-faq-chev { flex: none; width: 22px; height: 22px; display: grid; place-items: center; color: #101828; transition: transform .28s ${SUAVE}, color .25s ease; }
.d-wg-faq-chev svg { width: 14px; height: 14px; }
.d-wg-faq-a { padding: 0 20px 20px; }
.d-wg-faq-a p { color: #56616F; font-size: 14.5px; line-height: 1.65; max-width: 66ch; }
.d-wg-faq-a a { color: #1F57C8; }

/* El cierre: 1080; la caja #0C1322 de radio 28 con sus dos luces, el título de 48, el pedido redondo y el botón. */
.d-wg-ctaf { background: #fff; }
.d-wg-ctaf-shell { width: min(100%, 1080px); margin: 0 auto; padding: 48px 20px; }
.d-wg-ctaf-card { position: relative; border-radius: 28px; background: #0C1322; border: 1px solid rgba(255,255,255,.08); padding: 56px 40px 48px; overflow: hidden; text-align: center; }
.d-wg-ctaf-glow { position: absolute; border-radius: 50%; pointer-events: none; }
.d-wg-ctaf-glow-a { width: 520px; height: 520px; left: -140px; top: -240px; background: radial-gradient(circle, rgba(47,111,237,.32) 0%, transparent 62%); }
.d-wg-ctaf-glow-b { width: 560px; height: 560px; right: -160px; bottom: -280px; background: radial-gradient(circle, rgba(242,176,30,.18) 0%, transparent 60%); }
.d-wg-ctaf-inner { position: relative; }
.d-wg-ctaf-title { font-size: clamp(30px, 4.4vw, 48px); font-weight: 600; line-height: 1.1; letter-spacing: -.035em; color: #F4F8FE; }
.d-wg-ctaf-sub { margin: 16px auto 0; max-width: 500px; color: #B9C7DC; font-size: clamp(15px, 1.9vw, 17.5px); line-height: 1.55; }
.d-wg-ctaf-prompt { display: flex; align-items: center; gap: 11px; width: min(100%, 480px); margin: 30px auto 0; padding: 7px 7px 7px 18px; border-radius: 9999px; background: rgba(255,255,255,.96); border: 1px solid rgba(154,196,255,.4); box-shadow: 0 20px 44px -18px rgba(0,0,0,.7); text-decoration: none; transition: transform .3s ${ESPIRAL}, box-shadow .3s ease; }
.d-wg-ctaf-spark { flex: none; color: #2F6FED; display: grid; place-items: center; }
.d-wg-ctaf-prompt-t { flex: 1; min-width: 0; text-align: left; color: #98A2B3; font-size: 15px; letter-spacing: -.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.d-wg-ctaf-go { flex: none; width: 42px; height: 42px; border-radius: 9999px; background-image: ${GRAD}; color: #fff; display: grid; place-items: center; box-shadow: 0 6px 16px rgba(47,111,237,.4); transition: transform .3s ${ESPIRAL}; }
.d-wg-ctaf-go svg { width: 16px; height: 16px; }
@media (hover: hover) and (pointer: fine) { .d-wg-ctaf-prompt:hover { transform: translateY(-2px); box-shadow: 0 26px 52px -18px rgba(0,0,0,.8); } .d-wg-ctaf-prompt:hover .d-wg-ctaf-go { transform: scale(1.08); } }
.d-wg-ctaf-prompt:focus-visible { outline: 3px solid rgba(96,165,250,.7); outline-offset: 3px; }
.d-wg-ctaf-btn { display: inline-block; margin-top: 22px; padding: 15px 34px; border-radius: 10px; background-image: ${GRAD}; color: #fff !important; font-size: 15.5px; font-weight: 600; letter-spacing: -.01em; text-decoration: none; box-shadow: 0 14px 30px -10px rgba(47,111,237,.75); transition: transform .3s ${ESPIRAL}, box-shadow .3s ease; }
@media (hover: hover) and (pointer: fine) { .d-wg-ctaf-btn:hover { transform: translateY(-2px); box-shadow: 0 18px 38px -10px rgba(47,111,237,.9); } }
.d-wg-ctaf-btn:active { transform: translateY(0) scale(.98); }
.d-wg-ctaf-btn:focus-visible { outline: 3px solid rgba(96,165,250,.7); outline-offset: 3px; }

/* El pie: #07223D, 40px 20px 0; títulos de 17 en mayúsculas, links #6482A2 de 15; el © a la izquierda y lo legal a la derecha. */
.d-wg-pie { background: #07223D; color: #fff; padding: 40px 20px 0; }
.d-wg-pie-cols { max-width: 1150px; margin: 0 auto; padding: 14px 5px 40px; display: grid; grid-template-columns: 321px 299px 289px 1fr; }
.d-wg-pie-col { display: flex; flex-direction: column; align-items: flex-start; }
.d-wg-pie-h { margin: 0 0 21px; font-size: 17px; line-height: 22.1px; font-weight: 400; text-transform: uppercase; }
.d-wg-pie-a { font-size: 15px; line-height: 19.5px; padding: 5px 0; color: #6482A2 !important; text-decoration: none; }
.d-wg-pie-a:hover { color: #fff !important; }
.d-wg-pie-base { max-width: 1170px; margin: 0 auto; border-top: 2px solid #fff; padding: 15px 0 5px; display: flex; justify-content: space-between; align-items: center; gap: 12px; font-size: 14px; line-height: 18.2px; }
.d-wg-pie-base p { margin: 0 0 24px 344px; }
.d-wg-pie-base p + p { margin: 0 0 24px; }
.d-wg-pie-base a { text-decoration: none; }

@media (max-width: 1200px) { .d-wg-pie-base p { margin-left: 0; } }
@media (max-width: 1000px) {
  .d-wg-cir-shell { padding: 44px 18px; }
  .d-wg-cir-stage { grid-template-columns: 1fr; gap: 30px; }
  .d-wg-cir-wire, .d-wg-cir-packet { display: none; }
  .d-wg-cir-left { max-width: 520px; margin: 0 auto; width: 100%; }
  .d-wg-list { justify-content: flex-start; scroll-snap-type: x mandatory; }
  .d-wg-option { flex: 0 0 auto; scroll-snap-align: start; }
}
@media (max-width: 920px) {
  .d-wg-wcb-content { height: auto; min-height: 420px; padding: 20px 16px; }
  .d-wg-project > p { margin-bottom: 20px; }
  .d-wg-option { min-width: 132px; padding: 14px 10px 16px; }
}
@media (max-width: 980px) {
  .d-wg-hst-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
  .d-wg-hst-shell { padding: 60px 0 56px; }
  .d-wg-hst-title { margin-bottom: 40px; }
}
@media (max-width: 940px) {
  .d-wg-wis-shell { padding: 48px 16px 52px; }
  .d-wg-wis-head { margin-bottom: 34px; }
  .d-wg-wis-grid { grid-template-columns: 1fr; gap: 34px; }
  .d-wg-rv { aspect-ratio: 4 / 3; }
  .d-wg-rv-ic, .d-wg-rv-send { width: 26px; }
}
@media (max-width: 820px) {
  .d-wg-why-shell { padding: 42px 16px 48px; }
  .d-wg-why-head { margin-bottom: 30px; }
  .d-wg-why-grid { grid-template-columns: 1fr; gap: 12px; }
  .d-wg-why-card, .d-wg-why-quote { padding: 22px 20px; }
}
@media (max-width: 767px) {
  .d-wg-hst, .d-wg-wis, .d-wg-wcb, .d-wg-why, .d-wg-cir, .d-wg-faq, .d-wg-ctaf { padding: 20px 0; }
  .d-wg-galeria { padding: 50px 0 10px; }
  .d-wg-nav-fondo { padding: 10px; }
  .d-wg-nav { height: 60px; padding: 8px 10px; }
  .d-wg-nav-links { display: none; }
  .d-wg-nav-cta { height: 36px; font-size: 14px; padding: 6px 12px; margin-left: 0; }
  .d-wg-hero { padding: 40px 20px 60px; }
}
@media (max-width: 760px) {
  .d-wg-ais { grid-template-columns: 1fr; gap: 1em; }
  .d-wg-ais-head { text-align: center; }
  .d-wg-gal4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .d-wg-demo { overflow: hidden; }
  .d-wg-proof { --gap: calc(4vw * var(--cs, 1)); }
  .d-wg-proof.is-vivo { height: var(--pin, 260vh); }
  .d-wg-card { width: calc(var(--w) * var(--cs, 1) * 2.1vw); }
}
@media (max-width: 640px) {
  .d-wg-demo { padding: 15px 12px 16px; }
  .d-wg-status { display: none; }
  .d-wg-url { max-width: none; }
  .d-wg-ctaf-shell { padding: 34px 16px; }
  .d-wg-ctaf-card { padding: 40px 20px 34px; border-radius: 22px; }
  .d-wg-ctaf-prompt { padding-left: 14px; }
  .d-wg-ctaf-prompt-t { font-size: 13.5px; }
  .d-wg-ctaf-btn { width: 100%; padding: 15px 20px; }
  .d-wg-faq-shell { padding: 36px 16px; }
  .d-wg-faq-list { grid-template-columns: 1fr; }
  .d-wg-faq-item summary { padding: 16px; font-size: 14.5px; }
  .d-wg-faq-a { padding: 0 16px 16px; }
  .d-wg-why-head { flex-direction: column; align-items: flex-start; }
  .d-wg-why-cta { width: 100%; }
  .d-wg-wcb-shell { padding: 48px 16px; }
  .d-wg-pie-cols { grid-template-columns: 1fr; padding: 0 0 20px; }
  .d-wg-pie-col { margin-bottom: 26px; }
  .d-wg-pie-col:nth-child(2) .d-wg-pie-h, .d-wg-pie-col:nth-child(3) .d-wg-pie-h { display: none; }
  .d-wg-pie-col:nth-child(2), .d-wg-pie-col:nth-child(3) { margin-top: -26px; }
  .d-wg-pie-base { flex-direction: column; text-align: center; }
  .d-wg-pie-base p { margin: 10px 0; }
}
@media (max-width: 560px) {
  .d-wg-wis-title { font-size: clamp(27px, 8.4vw, 36px); }
  .d-wg-wis-block h3 { font-size: 17.5px; }
  .d-wg-wis-block p { font-size: 14.5px; }
  .d-wg-wis-block { margin-bottom: 24px; }
  .d-wg-cir-chips { margin-bottom: 30px; }
  .d-wg-cir-chip { font-size: 12.5px; padding: 9px 15px; }
  .d-wg-cir-form { padding: 20px; }
  .d-wg-cir-node { padding: 15px; gap: 12px; }
  .d-wg-cir-node-ic { width: 40px; height: 40px; }
  .d-wg-cir-node-copy b { font-size: 13.5px; }
  .d-wg-cir-node-copy i { font-size: 12px; }
  .d-wg-cir-node-tick { right: 15px; }
}
@media (max-width: 520px) {
  .d-wg-why-shell { padding: 34px 14px 42px; }
  .d-wg-why-title { font-size: clamp(26px, 8.2vw, 34px); }
  .d-wg-why-card, .d-wg-why-quote { padding: 20px 16px; }
  .d-wg-why-card::before { left: 16px; width: 38px; }
  .d-wg-why-card h3 { font-size: 17.5px; }
  .d-wg-why-card p { font-size: 13.5px; }
  .d-wg-why-quote blockquote { font-size: 15.5px; }
  .d-wg-why-ic { width: 38px; height: 38px; border-radius: 11px; }
  .d-wg-cta { display: block; text-align: center; }
  .d-wg-pwc .d-wg-cta, .d-wg-why-cta .d-wg-cta { width: 100%; }
}
@media (max-width: 480px) {
  .d-wg-hst-grid { grid-template-columns: 1fr; gap: 14px; }
  .d-wg-hst-card { min-height: 0; padding: 24px 18px; }
  .d-wg-hst-lab { font-size: 13.5px; letter-spacing: .16em; }
}
@media (max-width: 420px) {
  .d-wg-gal4 { grid-template-columns: 1fr 1fr; gap: 8px; }
  .d-wg-glabel { font-size: 11.5px; }
  .d-wg-glabel span { display: none; }
}
@media (max-width: 380px) {
  .d-wg-h1 { font-size: clamp(30px, 9vw, 38px); }
  .d-wg-badge { font-size: 12.5px; padding: 10px 18px; }
  .d-wg-demo { padding: 12px 10px 14px; border-radius: 20px; }
  .d-wg-input { font-size: 14px; }
  .d-wg-send { width: 42px; height: 42px; }
  .d-wg-gal4 { gap: 7px; }
  .d-wg-gcard { padding: 8px 8px 10px; }
  .d-wg-chip { font-size: 11.5px; padding: 6px 11px; }
}

@media (prefers-reduced-motion: reduce) {
  .d-wg *, .d-wg *::before, .d-wg *::after { animation: none !important; transition: none !important; }
  .d-wg-beam, .d-wg-progress, .d-wg-frame::after { display: none; }
  .d-wg-site[data-ver="img"] .d-wg-site-img { clip-path: none; }
  .d-wg-proof.is-vivo { height: auto; }
  .d-wg-proof.is-vivo .d-wg-proof-stage { position: static; height: auto; padding: 40px 0 16px; }
  .d-wg-row { overflow: hidden; }
}
`;

// El script (data-visor): los movimientos de la referencia, con sus números. Empieza limpiando su estado (el visor guarda el DOM
// después de correrlo) y cada parte se protege sola: si una falla, las demás andan.
const SCRIPT = `(function(){
var R=document.querySelector('.d-wg');if(!R)return;
var quieto=!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);
var IO='IntersectionObserver' in window;
R.classList.add('d-wg-js');
function q(s,el){return (el||R).querySelector(s);}
function qa(s,el){return [].slice.call((el||R).querySelectorAll(s));}
function cuidar(f){try{f();}catch(e){if(window.console)console.warn('d-wg',e);}}
var easeOut=function(t){return 1-Math.pow(1-t,3);};
var c01=function(v){return v<0?0:v>1?1:v;};

/* 0. Las entradas del constructor de HighLevel (el título de la galería sube, su línea aparece): al verse. */
cuidar(function(){
  var es=qa('.d-wg-entra');es.forEach(function(e){e.classList.remove('on');});
  if(quieto||!IO){es.forEach(function(e){e.classList.add('on');});return;}
  var ob=new IntersectionObserver(function(xs){xs.forEach(function(x){if(x.isIntersecting){x.target.classList.add('on');ob.unobserve(x.target);}});},{threshold:0});
  es.forEach(function(e){ob.observe(e);});
});

/* 1. El constructor del hero: el pedido que se escribe solo, la réplica grabada y los diseños que se arman. */
cuidar(function(){
  var root=q('#d-wg-ais');if(!root)return;
  var input=q('#d-wg-input'),gal=q('#d-wg-gal4'),retry=q('#d-wg-retry'),frame=q('#d-wg-frame'),site=q('#d-wg-site');
  var url=q('#d-wg-url'),st=q('#d-wg-status-t'),done=q('#d-wg-done'),doneT=q('#d-wg-done-t'),bar=q('#d-wg-bar'),pro=q('#d-wg-pro');
  var vid=q('#d-wg-site-video'),img=q('#d-wg-site-img');
  var timers=[],tipeo=null;
  function luego(f,ms){timers.push(setTimeout(f,ms));}
  function limpiar(){timers.forEach(clearTimeout);timers=[];if(tipeo){clearInterval(tipeo);tipeo=null;}if(vid){vid.onended=null;try{vid.pause();}catch(e){}}}
  function reset(){root.classList.remove('is-live','is-building');gal.classList.remove('is-leaving');frame.classList.remove('is-done','is-scanning');site.classList.remove('is-washed','is-armando');site.removeAttribute('data-ver');done.classList.remove('is-shown');pro.classList.remove('is-shown');st.textContent='';qa('.d-wg-chip',retry).forEach(function(c){c.classList.remove('is-on');});if(bar){bar.style.transition='none';bar.style.width='0';}}
  reset();input.value='';
  function estado(t){st.textContent=t;}
  function progreso(ms){if(!bar||quieto)return;void bar.offsetWidth;bar.style.transition='width '+ms+'ms linear';bar.style.width='100%';}
  function terminar(texto){root.classList.remove('is-building');frame.classList.remove('is-scanning');frame.classList.add('is-done');estado('');doneT.textContent=texto;done.classList.add('is-shown');}
  function empezar(){root.classList.add('is-live','is-building');frame.classList.remove('is-done');done.classList.remove('is-shown');site.classList.remove('is-washed','is-armando');pro.classList.remove('is-shown');if(bar){bar.style.transition='none';bar.style.width='0';}}
  function replicar(){
    empezar();url.textContent='${PEDIDO_REPLICA}';site.setAttribute('data-ver','video');pro.classList.add('is-shown');
    var dur=(vid&&vid.duration&&isFinite(vid.duration)?vid.duration:13.2)*1000;
    estado('Leyendo la página\\u2026');progreso(dur);
    if(quieto){terminar('Replicada \\u00b7 lista para editar');return;}
    luego(function(){frame.classList.add('is-scanning');try{vid.currentTime=0;}catch(e){}var p=vid.play();if(p&&p.catch)p.catch(function(){});},500);
    luego(function(){estado('Replicando\\u2026');},2000);
    vid.onended=function(){terminar('Replicada \\u00b7 lista para editar');};
    luego(function(){if(!frame.classList.contains('is-done'))terminar('Replicada \\u00b7 lista para editar');},dur+1500);
  }
  function diseno(id,nombre){
    empezar();url.textContent='hola-mako.site/'+id;site.setAttribute('data-ver','img');
    var ref=q('[data-diseno="'+id+'"] img');img.src=ref?ref.getAttribute('src'):'${A}/mini/'+id+'.jpg';img.alt='Una landing de Web Generator con el diseño '+nombre;
    qa('.d-wg-chip',retry).forEach(function(c){c.classList.toggle('is-on',c.getAttribute('data-diseno')===id);});
    progreso(5600);estado('Tomando el diseño '+nombre+'\\u2026');
    if(quieto){site.classList.add('is-armando');terminar('Lista para editar');return;}
    luego(function(){estado('Poniendo el texto del objetivo\\u2026');},1100);
    luego(function(){estado('Armando las secciones\\u2026');frame.classList.add('is-scanning');},1500);
    luego(function(){site.classList.add('is-washed');},1950);
    luego(function(){site.classList.add('is-armando');},2300);
    luego(function(){terminar('Lista para editar');},5650);
  }
  function correr(f){limpiar();if(!root.classList.contains('is-live')&&!quieto){gal.classList.add('is-leaving');luego(f,250);}else f();}
  function tocar(e){var a=e.target.closest('[data-diseno]');if(!a)return;e.preventDefault();var id=a.getAttribute('data-diseno'),n=a.getAttribute('data-nombre');input.value='';correr(function(){diseno(id,n);});}
  gal.addEventListener('click',tocar);retry.addEventListener('click',tocar);
  input.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();var s=q('.d-wg-send');if(s)location.href=s.getAttribute('href');}});
  function fantasma(){
    var t='${PEDIDO_REPLICA}';
    if(quieto){input.value=t;correr(replicar);return;}
    input.value='';var i=0;
    tipeo=setInterval(function(){i++;input.value=t.slice(0,i);if(i>=t.length){clearInterval(tipeo);tipeo=null;setTimeout(function(){correr(replicar);},380);}},34);
  }
  if(IO){var visto=false;var ob=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting&&!visto){visto=true;setTimeout(fantasma,600);ob.disconnect();}});},{threshold:.35});ob.observe(root);}
});

/* 2. La galería que se arma con el scroll y después corre (su MOTION, tal cual). */
cuidar(function(){
  var sec=q('#d-wg-proof'),rowsEl=q('#d-wg-rows');if(!sec||!rowsEl)return;
  var tracks=qa('.d-wg-track',sec);
  tracks.forEach(function(t){qa('[data-clone]',t).forEach(function(c){c.remove();});delete t.dataset.cloned;t.style.transform='';});
  qa('.d-wg-card',sec).forEach(function(c){c.style.transform='';});
  sec.classList.remove('is-vivo');sec.style.removeProperty('--stage');sec.style.removeProperty('--cs');sec.style.removeProperty('--pin');
  if(quieto)return;
  var M={minScale:.5,maxScale:1,fill:.78,minStage:42,maxStage:100,edgePad:10,assembleAt:.68,settle:.2,amount:1,
    top:[{x:-5.8,y:-7.5,r:-20},{x:-9.4,y:10.4,r:-4},{x:-2.6,y:4.3,r:-3},{x:-3.5,y:-10.7,r:-9}],
    bottom:[{x:-1.2,y:11.8,r:13},{x:2,y:19.6,r:-7},{x:6.4,y:16.6,r:3},{x:2.6,y:-4.4,r:-20}],speed:38,rampMs:900};
  var COPIAS=3,rows=[],cs=1,stageH=0;
  sec.classList.add('is-vivo');
  function clonar(){tracks.forEach(function(t){if(t.dataset.cloned)return;var o=[].slice.call(t.children);for(var c=1;c<COPIAS;c++)o.forEach(function(el){var k=el.cloneNode(true);k.setAttribute('data-clone','1');k.setAttribute('aria-hidden','true');t.appendChild(k);});t.dataset.cloned='1';});}
  function encajar(){
    sec.style.setProperty('--cs','1');
    qa('.d-wg-card',sec).forEach(function(c){c.style.transform='none';});
    var vh=innerHeight,re=[].slice.call(rowsEl.children);
    var blockH=re.length?re[re.length-1].getBoundingClientRect().bottom-re[0].getBoundingClientRect().top:0;
    var lo=M.minStage/100*vh,hi=M.maxStage/100*vh;
    stageH=blockH>0?Math.max(lo,Math.min(hi,blockH/M.fill)):hi;
    sec.style.setProperty('--stage',stageH.toFixed(1)+'px');
    sec.style.setProperty('--pin',(stageH*(innerWidth<=760?2.6:3.2)).toFixed(1)+'px');
    cs=blockH>0?Math.max(M.minScale,Math.min(M.maxScale,(stageH-M.edgePad*2)/blockH)):1;
    sec.style.setProperty('--cs',cs.toFixed(4));
  }
  function armar(){
    clonar();encajar();rows=[];var vw=innerWidth;
    tracks.forEach(function(t,ri){
      var tabla=ri===0?M.top:M.bottom;
      var items=[].slice.call(t.children).map(function(el,i){var p=tabla[i%tabla.length];return{el:el,dx:p.x/100*vw*cs*M.amount,dy:p.y/100*stageH*cs*M.amount,rot:p.r*M.amount,reach:Math.hypot(p.x,p.y)};});
      var maxD=Math.max.apply(null,items.map(function(i){return i.reach;}))||1;
      items.forEach(function(i){i.delay=i.reach/maxD*M.settle;});
      var gap=parseFloat(getComputedStyle(t).columnGap)||0,copyW=(t.scrollWidth+gap)/COPIAS,setW=copyW-gap;
      rows.push({t:t,items:items,copyW:copyW,dir:parseFloat(t.getAttribute('data-dir')),base:vw/2-copyW-setW/2,offset:0});
    });
  }
  function armado(p){var span=1-M.settle;rows.forEach(function(r){r.items.forEach(function(it){var t=easeOut(c01((p-it.delay)/span)),inv=1-t;it.el.style.transform='translate3d('+(it.dx*inv).toFixed(2)+'px,'+(it.dy*inv).toFixed(2)+'px,0) rotate('+(it.rot*inv).toFixed(2)+'deg)';});});}
  function corre(){rows.forEach(function(r){var w=((r.offset%r.copyW)+r.copyW)%r.copyW;r.t.style.transform='translate3d('+(r.base+r.dir*w).toFixed(2)+'px,0,0)';});}
  var visible=true,rampa=null,prev=performance.now();
  function cuadro(now){
    var dt=Math.min(now-prev,50);prev=now;
    var recorrido=sec.offsetHeight-innerHeight;
    var p=recorrido>0?c01(-sec.getBoundingClientRect().top/recorrido):1;
    var a=c01(p/M.assembleAt);
    armado(a);
    if(a>=1&&visible){if(rampa===null)rampa=now;var paso=M.speed*easeOut(c01((now-rampa)/M.rampMs))*(dt/1000);rows.forEach(function(r){r.offset+=paso;});}else if(a<1)rampa=null;
    corre();requestAnimationFrame(cuadro);
  }
  function iniciar(){armar();if(IO)new IntersectionObserver(function(e){visible=e[0].isIntersecting;},{threshold:0}).observe(sec);requestAnimationFrame(cuadro);}
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(iniciar);else addEventListener('load',iniciar);
  var rt;addEventListener('resize',function(){clearTimeout(rt);rt=setTimeout(armar,150);});
});

/* 3. Los contadores: cuentan al verse (1,6 s, ease-out cúbico) y terminan en el número escrito. */
cuidar(function(){
  var root=q('#d-wg-hst');if(!root)return;
  var nums=qa('.d-wg-hst-num[data-to]',root);
  nums.forEach(function(el){var f=el.getAttribute('data-final');if(f)el.textContent=f;else el.setAttribute('data-final',el.textContent);});
  if(quieto||!IO)return;
  function contar(el){var to=parseFloat(el.getAttribute('data-to')),fin=el.getAttribute('data-final'),t0=null,DUR=1600;el.textContent='0';
    function paso(ts){if(t0===null)t0=ts;var t=Math.min(1,(ts-t0)/DUR);el.textContent=String(Math.round(to*easeOut(t)));if(t<1)requestAnimationFrame(paso);else el.textContent=fin;}requestAnimationFrame(paso);}
  var visto=false;var ob=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting&&!visto){visto=true;nums.forEach(contar);ob.disconnect();}});},{threshold:.5});ob.observe(root);
});

/* 4. El deslizador antes/después: el borde rasgado, las chispas y el barrido de entrada (de 96 % a 47 % en 1,5 s). */
cuidar(function(){
  var rv=q('#d-wg-rv');if(!rv)return;
  var before=q('.d-wg-rv-before',rv),edge=q('.d-wg-rv-edge',rv),path=q('path',edge),handle=q('.d-wg-rv-handle',rv),canvas=q('.d-wg-rv-sparkles',rv),ctx=canvas.getContext('2d');
  var C={startX:.47,minX:.05,maxX:.95,amp:.009,pitch:12,minPts:24,seed:7,snapMs:520,introFrom:.96,introDelay:420,
    perPx:.17,maxPerFrame:3,band:30,bias:2.4,puff:4,palette:[[47,111,237],[242,176,30],[91,140,240],[255,214,130]],white:.34,tint:.45,coreMin:.5,coreMax:1.6,glow:6,aMin:.26,aMax:.66,glint:.17,glintLen:7,lifeMin:480,lifeMax:1000,drift:.05,riseMin:-8,riseMax:-26,fadeIn:.18};
  var W=0,H=0,x=C.startX,lastPx=0,arrastrando=false,parts=[],tear=[],sprites=[];
  function rnd32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
  function rasgado(){var n=Math.max(C.minPts,Math.round(H/C.pitch)),r=rnd32(C.seed),amp=W*C.amp,v=0,raw=[];for(var i=0;i<=n;i++){v=v*.45+(r()*2-1);raw.push(v);}var pk=Math.max.apply(null,raw.map(Math.abs))||1;tear=raw.map(function(z,k){return{t:k/n,dx:z/pk*amp};});}
  function borde(){if(!tear.length)return;var px=x*W,poly='polygon(0px 0%',d='';for(var i=0;i<tear.length;i++){var p=tear[i],X=(px+p.dx).toFixed(2);poly+=', '+X+'px '+(p.t*100).toFixed(3)+'%';d+=(i?' L ':'M ')+X+' '+(p.t*H).toFixed(2);}poly+=', 0px 100%)';before.style.clipPath=poly;path.setAttribute('d',d);}
  function medir(){var r=rv.getBoundingClientRect();W=r.width;H=r.height;if(!W||!H)return;var dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);edge.setAttribute('viewBox','0 0 '+W+' '+H);rasgado();borde();lastPx=x*W;}
  function sprite(rgb){var s=64,c=document.createElement('canvas');c.width=c.height=s;var g=c.getContext('2d'),gr=g.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2),col=rgb.join(',');gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.13,'rgba(255,255,255,.8)');gr.addColorStop(.3,'rgba('+col+',.40)');gr.addColorStop(.62,'rgba('+col+',.12)');gr.addColorStop(1,'rgba('+col+',0)');g.fillStyle=gr;g.fillRect(0,0,s,s);return c;}
  sprites=[sprite([255,255,255])].concat(C.palette.map(function(c){return sprite(c.map(function(v){return Math.round(v+(255-v)*C.tint);}));}));
  function ponerX(v){x=Math.min(C.maxX,Math.max(C.minX,v));rv.style.setProperty('--x',(x*100).toFixed(3)+'%');handle.setAttribute('aria-valuenow',Math.round(x*100));borde();}
  function al(a,b){return a+Math.random()*(b-a);}
  function chispas(n,vel){if(quieto)return;var px=x*W;for(var i=0;i<n;i++){var t=Math.pow(Math.random(),C.bias);parts.push({x:px+t*C.band+al(-1,1),y:Math.random()*H,vx:vel*C.drift+al(-6,10),vy:al(C.riseMin,C.riseMax),core:al(C.coreMin,C.coreMax),sp:Math.random()<C.white?0:1+Math.floor(Math.random()*C.palette.length),a:al(C.aMin,C.aMax),life:0,ttl:al(C.lifeMin,C.lifeMax),glint:Math.random()<C.glint});}}
  function dibujar(dt){ctx.clearRect(0,0,W,H);if(!parts.length)return;var px=x*W;ctx.save();ctx.beginPath();ctx.rect(px,0,Math.max(0,W-px),H);ctx.clip();ctx.globalCompositeOperation='lighter';
    for(var i=parts.length-1;i>=0;i--){var p=parts[i];p.life+=dt;if(p.life>=p.ttl){parts.splice(i,1);continue;}var k=p.life/p.ttl,f=k<C.fadeIn?k/C.fadeIn:1-Math.pow((k-C.fadeIn)/(1-C.fadeIn),1.7),a=p.a*f;p.x+=p.vx*dt/1000;p.y+=p.vy*dt/1000;var r=p.core*C.glow;ctx.globalAlpha=a;ctx.drawImage(sprites[p.sp],p.x-r,p.y-r,r*2,r*2);
      if(p.glint){var len=C.glintLen*(.6+p.core/C.coreMax);ctx.globalAlpha=a*.55;ctx.strokeStyle='#fff';ctx.lineWidth=.6;ctx.beginPath();ctx.moveTo(p.x-len,p.y);ctx.lineTo(p.x+len,p.y);ctx.moveTo(p.x,p.y-len*.7);ctx.lineTo(p.x,p.y+len*.7);ctx.stroke();}}
    ctx.restore();ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';}
  var prev=performance.now(),raf=null;
  function cuadro(now){var dt=Math.min(now-prev,50);prev=now;var px=x*W,mov=Math.abs(px-lastPx),vel=px-lastPx;lastPx=px;if(mov>.4)chispas(Math.min(C.maxPerFrame,Math.round(mov*C.perPx)),vel);dibujar(dt);raf=requestAnimationFrame(cuadro);}
  function arranca(){if(raf===null){prev=performance.now();raf=requestAnimationFrame(cuadro);}}
  function para(){if(raf!==null){cancelAnimationFrame(raf);raf=null;}}
  var viaje=0;
  function ir(dest,ms){ms=ms||C.snapMs;if(quieto){ponerX(dest);return;}var de=x,id=++viaje,t0=performance.now();rv.classList.add('is-active');(function paso(now){if(id!==viaje)return;var k=Math.min(1,(now-t0)/ms);ponerX(de+(dest-de)*easeOut(k));if(k<1)requestAnimationFrame(paso);else if(!arrastrando)rv.classList.remove('is-active');})(performance.now());}
  function xDe(e){var r=rv.getBoundingClientRect();return(e.clientX-r.left)/r.width;}
  rv.addEventListener('pointerdown',function(e){viaje++;arrastrando=true;rv.classList.add('is-active');try{rv.setPointerCapture(e.pointerId);}catch(z){}if(e.target.closest('.d-wg-rv-handle'))handle.focus({preventScroll:true});else ponerX(xDe(e));});
  rv.addEventListener('pointermove',function(e){if(!arrastrando)return;e.preventDefault();ponerX(xDe(e));});
  function suelta(e){if(!arrastrando)return;arrastrando=false;rv.classList.remove('is-active');chispas(C.puff,0);try{if(e&&e.pointerId!=null&&rv.hasPointerCapture(e.pointerId))rv.releasePointerCapture(e.pointerId);}catch(z){}}
  rv.addEventListener('pointerup',suelta);rv.addEventListener('pointercancel',suelta);
  handle.addEventListener('keydown',function(e){var s=e.shiftKey?.1:.025,d=null;if(e.key==='ArrowLeft')d=x-s;if(e.key==='ArrowRight')d=x+s;if(e.key==='Home')d=C.minX;if(e.key==='End')d=C.maxX;if(d===null)return;e.preventDefault();ir(Math.min(C.maxX,Math.max(C.minX,d)),240);});
  if('ResizeObserver' in window)new ResizeObserver(medir).observe(rv);else addEventListener('resize',medir);
  medir();
  if(quieto){ponerX(C.startX);return;}
  ponerX(C.introFrom);
  if(IO){var barrido=false;new IntersectionObserver(function(es){es.forEach(function(en){if(en.isIntersecting){arranca();if(!barrido){barrido=true;setTimeout(function(){ir(C.startX,1500);},C.introDelay);}}else para();});},{threshold:.35}).observe(rv);}else{arranca();ir(C.startX,1500);}
});

/* 5. ¿Qué puede armar?: el pedido se escribe (19 ms por letra), las piezas entran (110 + 105 ms cada una) y cada 5,4 s pasa al siguiente. */
cuidar(function(){
  var root=q('#d-wg-wcb');if(!root)return;
  var radios=qa('input[name="d-wg-tipo"]',root),ops=qa('.d-wg-option',root),pros=qa('.d-wg-project',root),stage=q('#d-wg-wcb-stage'),texto=q('#d-wg-wcb-prompt'),done=q('#d-wg-wcb-done'),lista=q('#d-wg-list');
  if(!radios.length)return;
  var CICLO=5400,actual=0,auto=null,tipeo=null,piezas=[],sobre=false;
  function limpiar(){if(tipeo){clearInterval(tipeo);tipeo=null;}piezas.forEach(clearTimeout);piezas=[];root.classList.remove('is-typing');}
  function barra(correr){ops.forEach(function(o){var p=q('.d-wg-prog',o);p.classList.remove('is-running');o.classList.remove('is-active');});var o=ops[actual];o.classList.add('is-active');if(correr){var p=q('.d-wg-prog',o);void p.offsetWidth;p.classList.add('is-running');}}
  function videos(){qa('video',root).forEach(function(v){var mio=v.closest('.d-wg-project')===pros[actual];if(mio){var p=v.play();if(p&&p.catch)p.catch(function(){});}else if(!v.paused)v.pause();});}
  function armar(pr){var ps=qa('.d-wg-po',pr);ps.forEach(function(p){p.classList.remove('on');});ps.forEach(function(p,i){piezas.push(setTimeout(function(){p.classList.add('on');if(i===ps.length-1)piezas.push(setTimeout(function(){stage.classList.add('is-done');done.classList.add('is-shown');},220));},110+i*105));});}
  function elegir(ix){
    limpiar();actual=ix;radios[ix].checked=true;
    var pr=pros[ix];var cs=getComputedStyle(pr);stage.style.setProperty('--acc',cs.getPropertyValue('--acc').trim());stage.style.setProperty('--soft',cs.getPropertyValue('--soft').trim());
    stage.classList.remove('is-done');done.classList.remove('is-shown');
    var pedido=pr.getAttribute('data-prompt')||'';videos();
    if(quieto){texto.textContent=pedido;qa('.d-wg-po',pr).forEach(function(p){p.classList.add('on');});stage.classList.add('is-done');done.classList.add('is-shown');return;}
    texto.textContent='';root.classList.add('is-typing');var i=0;
    tipeo=setInterval(function(){i++;texto.textContent=pedido.slice(0,i);if(i>=pedido.length){clearInterval(tipeo);tipeo=null;root.classList.remove('is-typing');armar(pr);}},19);
  }
  function agendar(){if(auto){clearTimeout(auto);auto=null;}if(quieto){barra(false);return;}barra(true);auto=setTimeout(function(){if(sobre){agendar();return;}elegir((actual+1)%pros.length);agendar();},CICLO);}
  radios.forEach(function(r,i){r.addEventListener('change',function(){if(r.checked){elegir(i);agendar();}});});
  if(window.matchMedia&&matchMedia('(hover: hover) and (pointer: fine)').matches){lista.addEventListener('mouseenter',function(){sobre=true;});lista.addEventListener('mouseleave',function(){sobre=false;});}
  limpiar();radios[0].checked=true;actual=0;barra(false);qa('.d-wg-po',root).forEach(function(p){p.classList.remove('on');});
  if(quieto||!IO){elegir(0);return;}
  var visto=false;var ob=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting&&!visto){visto=true;elegir(0);agendar();ob.disconnect();}});},{threshold:.25});ob.observe(root);
});

/* 6. Por qué: las razones y las citas entran escalonadas (100 ms) al verse. */
cuidar(function(){
  var root=q('#d-wg-why');if(!root)return;var cs=qa('.d-wg-why-card, .d-wg-why-quote',root);
  cs.forEach(function(c){c.classList.remove('on');});
  if(quieto||!IO){cs.forEach(function(c){c.classList.add('on');});return;}
  var visto=false;var ob=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting&&!visto){visto=true;cs.forEach(function(c,i){setTimeout(function(){c.classList.add('on');},i*100);});ob.disconnect();}});},{threshold:.2});ob.observe(root);
});

/* 8. Los videos marcados corren sólo a la vista (y quietos con «reducir movimiento»). */
cuidar(function(){
  var vs=qa('video[data-a-la-vista]');if(quieto||!IO||!vs.length)return;
  var ob=new IntersectionObserver(function(es){es.forEach(function(e){var v=e.target;if(e.isIntersecting){v.preload='auto';var pr=v.play();if(pr&&pr.catch)pr.catch(function(){});}else if(!v.paused)v.pause();});},{threshold:.25});
  vs.forEach(function(v){ob.observe(v);});
});

/* 7. ¿Para quién?: el formulario se llena (25 ms por letra), se aprieta el botón, sale el lead y el cable lo lleva al CRM (9 s cada uno). */
cuidar(function(){
  var root=q('#d-wg-cir');if(!root)return;
  var radios=qa('input[name="d-wg-para"]',root),pans=qa('.d-wg-cir-pan',root),stage=q('#d-wg-cir-stage'),chips=q('#d-wg-cir-chips');
  var svg=q('#d-wg-cir-wire'),track=q('#d-wg-cir-t0'),wire=q('#d-wg-cir-w0'),dot=q('#d-wg-cir-d0'),node=q('#d-wg-cir-node');
  if(!radios.length)return;
  var CICLO=9000,actual=0,timers=[],tipeo=null,ciclo=null,sobre=false,raf=null;
  function luego(f,ms){timers.push(setTimeout(f,ms));}
  function limpiar(){timers.forEach(clearTimeout);timers=[];if(tipeo){clearInterval(tipeo);tipeo=null;}if(raf){cancelAnimationFrame(raf);raf=null;}}
  function largo(){return wire.getTotalLength?wire.getTotalLength():500;}
  function trazar(){
    if(!svg.getBoundingClientRect)return;var box=svg.getBoundingClientRect();if(!box.width||!box.height)return;var W=box.width,H=box.height;svg.setAttribute('viewBox','0 0 '+W+' '+H);
    var sub=q('.d-wg-cir-submit',pans[actual]);if(!sub)return;var s=sub.getBoundingClientRect(),y0=s.top+s.height/2-box.top,r=node.getBoundingClientRect(),y=r.top+r.height/2-box.top;
    var d='M0 '+y0+' C '+(W*.52)+' '+y0+', '+(W*.48)+' '+y+', '+W+' '+y;track.setAttribute('d',d);wire.setAttribute('d',d);
    var L=largo();wire.style.strokeDasharray=L;wire.style.strokeDashoffset=wire.classList.contains('on')?0:L;
  }
  function pulso(){if(!wire.getTotalLength)return;var L=wire.getTotalLength();if(!L)return;dot.classList.add('is-live');var t0=null;function paso(ts){if(t0===null)t0=ts;var p=Math.min(1,(ts-t0)/780),pt=wire.getPointAtLength(L*p);dot.setAttribute('cx',pt.x);dot.setAttribute('cy',pt.y);if(p<1)raf=requestAnimationFrame(paso);else dot.classList.remove('is-live');}raf=requestAnimationFrame(paso);}
  function reset(){node.classList.remove('on');wire.classList.remove('on');wire.style.strokeDashoffset=largo();dot.classList.remove('is-live');stage.classList.remove('is-sent');
    pans.forEach(function(p){var k=q('.d-wg-cir-packet',p);k.classList.remove('is-out','is-gone');q('.d-wg-cir-submit',p).classList.remove('is-pressed');qa('.d-wg-cir-field',p).forEach(function(f){f.classList.remove('is-typing');q('.d-wg-cir-field-val',f).textContent=f.getAttribute('data-valor');});});}
  function asentar(){var p=pans[actual];stage.style.setProperty('--acc',getComputedStyle(p).getPropertyValue('--acc').trim());stage.style.setProperty('--soft',getComputedStyle(p).getPropertyValue('--soft').trim());node.classList.add('on');trazar();wire.classList.add('on');wire.style.strokeDashoffset=0;stage.classList.add('is-sent');}
  function escribir(fs,i,fin){if(i>=fs.length){fin();return;}var f=fs[i],t=f.getAttribute('data-valor')||'',v=q('.d-wg-cir-field-val',f),c=0;f.classList.add('is-typing');tipeo=setInterval(function(){c++;v.textContent=t.slice(0,c);if(c>=t.length){clearInterval(tipeo);tipeo=null;f.classList.remove('is-typing');luego(function(){escribir(fs,i+1,fin);},190);}},25);}
  function correr(ix){
    limpiar();reset();actual=ix;radios[ix].checked=true;var p=pans[ix];
    stage.style.setProperty('--acc',getComputedStyle(p).getPropertyValue('--acc').trim());stage.style.setProperty('--soft',getComputedStyle(p).getPropertyValue('--soft').trim());
    requestAnimationFrame(trazar);
    if(quieto){asentar();return;}
    var fs=qa('.d-wg-cir-field',p);fs.forEach(function(f){q('.d-wg-cir-field-val',f).textContent='';});
    luego(function(){escribir(fs,0,function(){
      var sub=q('.d-wg-cir-submit',p),k=q('.d-wg-cir-packet',p);
      luego(function(){sub.classList.add('is-pressed');},200);
      luego(function(){sub.classList.remove('is-pressed');stage.classList.add('is-sent');k.classList.add('is-out');},380);
      luego(function(){trazar();wire.classList.add('on');wire.style.strokeDashoffset=0;pulso();},700);
      luego(function(){node.classList.add('on');},1300);
      luego(function(){k.classList.add('is-gone');},1900);
    });},450);
  }
  function agendar(){if(ciclo){clearTimeout(ciclo);ciclo=null;}if(quieto)return;ciclo=setTimeout(function(){if(sobre){agendar();return;}correr((actual+1)%pans.length);agendar();},CICLO);}
  radios.forEach(function(r,i){r.addEventListener('change',function(){if(r.checked){correr(i);agendar();}});});
  if(window.matchMedia&&matchMedia('(hover: hover) and (pointer: fine)').matches){chips.addEventListener('mouseenter',function(){sobre=true;});chips.addEventListener('mouseleave',function(){sobre=false;});}
  addEventListener('resize',function(){requestAnimationFrame(trazar);});
  limpiar();reset();radios[0].checked=true;
  if(quieto||!IO){correr(0);return;}
  var visto=false;var ob=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting&&!visto){visto=true;correr(0);agendar();ob.disconnect();}});},{threshold:.3});ob.observe(root);
});
})();`;
