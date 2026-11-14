// =============================================================================
// /vsl/script — Ads Analyst con el DISEÑO de la portada de Gethookd (https://www.gethookd.ai/, leída el 11/11 y el 14/11/2026)
// =============================================================================
// Copiado de la referencia, con los valores leídos del navegador a 1440 y 390 px y de su CSS y sus scripts, que vienen DENTRO del
// HTML (docs/diseno/landings-competencia/script.md; el relevo con capturas, videos y hovers: notas de la sesión,
// referencias-landings/script/). Lo que se mueve, exacto como en la suya:
//   · el titular con la palabra en degradado que corre (3 s) y los chips que suben 1 px con el mouse;
//   · «Pregúntale a tu IA»: la demo que ESCRIBE una pregunta (18 ms por letra, 12 el espacio, 55 la coma), deja caer las
//     tarjetas de a una (115 ms entre una y otra, 0,42 s con su curva), las tiene 2,86 s, las saca al revés (70 ms) y escribe la
//     siguiente: cuatro escenas, sólo mientras se ve (25 %), con la flecha para pasar a la próxima;
//   · las bandas que aparecen al bajar (.7 s, 26 px, con 0,09 / 0,18 s de diferencia), como sus `.rv`;
//   · «Dos formas»: cada tarjeta de la app trae su VIDEO, que corre sólo mientras se ve (uno por columna en la computadora, uno
//     solo en el teléfono, y carga 600 px antes de llegar); la tarjeta del paso 2 queda pegada mientras pasan tres de la app; al
//     pasar las cabezas aparece arriba la barra de cada columna; y la tarjeta del paso 3 escribe el pedido, aprieta y deja caer
//     tres tarjetas (un ciclo de 9 s), sólo mientras se ve;
//   · las preguntas con su acordeón (el título se pone azul con el mouse; abierto, el chevrón gira y se pone azul);
//   · el cierre con dos cintas de anuncios que corren (60 s y 75 s al revés) detrás de su viñeta.
// De MaKo: el logo, el azul #2F6FED donde Gethookd pone el suyo (#3352FF), el botón para empezar, los textos de
// app/vsl/_competencia/script.ts y, donde Gethookd pone su app y los anuncios de su biblioteca, MaKo grabado y los anuncios y
// videos REALES de Alex Hormozi que lee Competitor Spy (C:/dev/bancos-portada/banco-spy-gurus/hormozi-funnel.json, leído el
// 14/11/2026 en sólo lectura; las cuentas con las funciones puras de la app, lib/spy-detalle.ts). Nada de un cliente.
// Lo que se sacó de la referencia, y por qué:
//   · La píldora «Trusted by Mark Builds Brands… and 100,000+ users», sus logos de clientes, «Works with your AI» (Claude,
//     ChatGPT…: MaKo no se conecta a esas IA), las insignias de plan, «Find the store before you find the product» (tiendas de
//     e-commerce), los precios y la letra chica de la prueba gratis: son suyos o MaKo no los tiene.
//   · Su biblioteca de 22 millones de anuncios y la descarga de anuncios ajenos: en MaKo, Spy lee a los referentes que sigues.
// =============================================================================

import type { ReactNode } from 'react';
import type { PropsDiseno } from '.';
import type { Bloque } from '../tipos';
import { RUTA_CTA, CASO, EstrellaMaKo, LogoMaKo, TEXTO_CTA, html, otrasFunciones, TEXTO_CIERRE } from '../marca';

const P = 'd-script';
const A = '/vsl-assets/script/';

type De<T extends Bloque['tipo']> = Extract<Bloque, { tipo: T }>;

// ── Los datos de las tarjetas: Alex Hormozi en Competitor Spy al 14/11/2026 ──────────────────────────────────────────────
// Su foto es la caricatura del sitio (public/asesores/, la misma de la landing de Copywriting).
const HORMOZI = { nombre: 'Alex Hormozi', foto: '/asesores/hormozi.png' };
const imagenDe = (id: number) => `${A}anuncio-${id}.jpg`;

/** Escena 1: cinco de sus 14 anuncios activos (de 64 que le vio Spy), con los días que llevan corriendo como los dibuja Spy
 *  (`diasCorriendo`, la grabación spy-anuncios.webm: «16 d» los del 28/10 y «44 d» los del 30/9). Los 14 llevan a
 *  acquisition.com/roadmap. Las imágenes son las miniaturas que guardó Spy (public/vsl-assets/script/anuncio-<id>.jpg). */
export const ANUNCIOS_ACTIVOS: readonly { id: number; dias: number }[] = [
  { id: 3360, dias: 16 }, { id: 3357, dias: 16 }, { id: 3344, dias: 44 }, { id: 3354, dias: 16 }, { id: 3349, dias: 16 },
];
/** Escena 2: «A dónde mandan» de Spy (los 64 anuncios por su destino; los tres primeros). */
export const DESTINOS: readonly { pagina: string; n: number; pct: number }[] = [
  { pagina: 'acquisition.com/workshop-km', n: 16, pct: 25 }, { pagina: 'acquisition.com/roadmap', n: 14, pct: 22 }, { pagina: 'skool.com/acq', n: 3, pct: 5 },
];
const TOTAL_ANUNCIOS = 64;
/** Escena 3: «¿Qué formatos le funcionan?» de Spy sobre sus 479 videos cortos (`formatosDe` + `lecturaDeFormatos`: «Storytime y
 *  Caso de éxito rinden 14,6x y 13x la mediana; Tutorial, 0,6x»), con el gancho de su mejor storytime (1.171.691 vistas). */
export const FORMATOS: readonly { t: string; v: string; s: string; malo?: boolean }[] = [
  { t: 'Formato que más le rinde', v: 'Storytime', s: '<b>14,6×</b> la mediana de sus cortos' },
  { t: 'Su gancho', v: '«Aprendí este truco a los 23 años de un mentor»', s: '<b>1,2 M</b> de vistas' },
  { t: 'Lo que no le rinde', v: 'Tutorial', s: '<b>0,6×</b> la mediana, en 44 videos', malo: true },
];
/** Escena 4 y paso 3: el guion que MaKo escribió replicando su reel «When someone asks for a discount» con la oferta «MaKo
 *  Acelerador» (Copywriting → Replicar, 14/11/2026; notas de la sesión, copy-reel-hormozi/texto.txt). Es el de la grabación
 *  public/vsl-assets/sitio/copywriting.webm. Tramos tal cual, recortados con «…». */
export const GUION_REPLICADO: readonly { t: string; v: string }[] = [
  { t: 'Gancho', v: 'Compré la herramienta para armar mi embudo y sigue sin vender.' },
  { t: 'Historia', v: 'Te pasó: conseguiste MaKo, metiste tus scripts, tu oferta, tu gancho. Todo está ahí. Pero nadie llama.' },
  { t: 'Llamado', v: 'Comenta EMBUDO y te cuento cómo funciona.' },
];

/** Las cinco tarjetas de la columna «En la app» (las de Explore, Brand Spy, Shops, Boards y Clone Ads): su rótulo y su
 *  grabación, en el orden de los ítems del bloque `filas`. Todas son pantallas reales de MaKo grabadas en un banco. */
export const FILAS_DE_LA_APP: readonly { rotulo: string; video: string; poster: string; alt: string }[] = [
  { rotulo: 'Anuncio ganador', video: `${A}anuncio-ganador.webm`, poster: `${A}anuncio-ganador.jpg`, alt: 'La hoja «Anuncio ganador» del Dashboard, con los datos de ejemplo de su plantilla' },
  { rotulo: 'Hooks y retención', video: `${A}hooks.webm`, poster: `${A}hooks.jpg`, alt: 'La hoja «Hooks y retención» del Dashboard, con los datos de ejemplo de su plantilla' },
  { rotulo: 'Competitor Spy', video: '/vsl-assets/sitio/spy-anuncios.webm', poster: '/vsl-assets/sitio/spy-anuncios.jpg', alt: 'Los anuncios de Alex Hormozi en Competitor Spy: cuántos tiene activos, a dónde mandan y sus tests' },
  { rotulo: 'Su gancho', video: '/vsl-assets/sitio/spy-gancho.webm', poster: '/vsl-assets/sitio/spy-gancho.jpg', alt: 'Un video de Alex Hormozi en Competitor Spy con su gancho, su ángulo y su formato' },
  { rotulo: 'Replicar', video: '/vsl-assets/sitio/copywriting.webm', poster: '/vsl-assets/sitio/copywriting.jpg', alt: 'Un reel de Alex Hormozi replicado en Copywriting: el guion con gancho, historia y llamado' },
];

/** El paso 2 (en la suya, la caja de Claude escribiendo tres pedidos): la caja REAL del chat de MaKo de una hoja del Dashboard
 *  (`MakoChat`, «Pregúntale a MaKo…») escribiendo tres preguntas, sin mandar nada (no se dispara ninguna IA), recortada a la caja como
 *  la suya (STEP2-ASK-CROP). Banco: scratchpad, script-banco-hojas/entrada-chat.tsx + grabar-chat.mjs. */
export const PASO_PREGUNTA = { rotulo: 'Pregúntale a MaKo', video: `${A}pregunta.webm`, poster: `${A}pregunta.jpg`, alt: 'La caja del chat de MaKo con tres preguntas escritas: qué guion escalar, dónde se cae la gente y qué le funciona a Alex Hormozi' };

/** Las dos cintas del cierre (en la suya, anuncios de su biblioteca): anuncios de Hormozi que guardó Spy, diez por cinta. */
export const CINTAS_CIERRE: readonly (readonly number[])[] = [
  [3360, 3357, 3354, 3356, 3349, 3344, 3332, 3381, 3378, 3372],
  [3318, 3320, 3321, 3323, 3327, 3328, 3333, 3335, 3337, 3366],
];

// ── Piezas chicas ────────────────────────────────────────────────────────────────────────────────────────────────────────
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
    <svg className={`${P}-chev`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6l6 -6" /></svg>
  );
}

/** El botón principal (el «Start a 7-Day Trial for $0» de la referencia). */
function Cta({ clase = '' }: { clase?: string }) {
  return <a href={RUTA_CTA} className={`${P}-cta ${clase}`}>{TEXTO_CTA}<Flecha /></a>;
}

// ── La barra (la del sitio la tapa: TemaSitio.tsx → BARRA_PROPIA) ──────────────────────────────────────────────────────────
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

// ── El hero, la tira del caso y la tarjeta «Pregúntale a tu IA» (en la referencia, las tres viven en la misma sección) ───────
const ICONOS_CHIPS = [
  ['M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4', 'M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4'],
  ['M3 17l6 -6l4 4l8 -8', 'M14 7l7 0l0 7'],
  ['M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0', 'M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0'],
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

const ICONO_COPIAS = ['M8 8m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z', 'M16 8v-2a2 2 0 0 0 -2 -2h-8a2 2 0 0 0 -2 2v8a2 2 0 0 0 2 2h2'];
const ICONO_LINK = ['M9 15l6 -6', 'M11 6l.463 -.536a5 5 0 0 1 7.071 7.072l-.534 .464', 'M13 18l-.397 .534a5.068 5.068 0 0 1 -7.127 0a4.972 4.972 0 0 1 0 -7.071l.524 -.463'];

/** La cara de una tarjeta de anuncio (la de Gethookd: el anunciante, la creatividad, los días y su segundo dato). */
function TarjetaAnuncio({ id, dias }: { id: number; dias: number }) {
  return (
    <article className={`${P}-acard`}>
      <div className={`${P}-acard-brand`}>
        <img className={`${P}-acard-logo`} src={HORMOZI.foto} alt="" width={20} height={20} />
        <span className={`${P}-acard-name`}>{HORMOZI.nombre}</span>
        <span className={`${P}-acard-more`} aria-hidden="true">•••</span>
      </div>
      <img className={`${P}-acard-img`} src={imagenDe(id)} alt={`Un anuncio de ${HORMOZI.nombre} en Meta`} width={152} height={126} loading="lazy" />
      <div className={`${P}-acard-foot`}>
        <span className={`${P}-pill ${P}-pill-vivo`}>{dias} d</span>
        <span className={`${P}-pill`}><Icono d={ICONO_LINK} size={10} />roadmap</span>
      </div>
    </article>
  );
}

function Pregunta({ b }: { b: De<'tarjetas'> }) {
  const pedidos = b.items.map((it) => it.titulo);
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
      {/* La demo: las tarjetas son blancas en los dos modos, como las suyas (data-tema-fijo). El script la anima; sin él, se ve
          la primera escena entera, como su HTML. data-pedidos: las cuatro preguntas, en el orden de las filas. */}
      <div className={`${P}-iface`} data-tema-fijo="" data-pedidos={JSON.stringify(pedidos)} aria-live="polite">
        <div className={`${P}-row`} data-fila="0" role="group" aria-label={`${b.items[0]?.texto ?? ''}`}>
          {ANUNCIOS_ACTIVOS.map((a) => <TarjetaAnuncio key={a.id} id={a.id} dias={a.dias} />)}
        </div>
        <div className={`${P}-row`} data-fila="1" role="group" aria-label={b.items[1]?.texto ?? ''} hidden>
          {DESTINOS.map((d) => (
            <article key={d.pagina} className={`${P}-bcard`}>
              <div className={`${P}-bcard-head`}>
                <span className={`${P}-bcard-logo`}><Icono d={ICONO_LINK} size={12} /></span>
                <span className={`${P}-bcard-name`}>{d.pagina}</span>
                <span className={`${P}-bcard-up`}>{d.pct} %</span>
              </div>
              <span className={`${P}-bcard-barra`}><i style={{ width: `${Math.round((d.pct / DESTINOS[0].pct) * 100)}%` }} /></span>
              <div className={`${P}-bcard-foot`}><b>{d.n}</b> de sus <b>{TOTAL_ANUNCIOS}</b> anuncios</div>
            </article>
          ))}
        </div>
        <div className={`${P}-row`} data-fila="2" role="group" aria-label={b.items[2]?.texto ?? ''} hidden>
          {FORMATOS.map((f) => (
            <article key={f.t} className={`${P}-icard${f.malo ? ` ${P}-icard-malo` : ''}`}>
              <div className={`${P}-icard-t`}>{f.t}</div>
              <div className={`${P}-icard-v`}>{f.v}</div>
              <div className={`${P}-icard-s`} dangerouslySetInnerHTML={html(f.s)} />
            </article>
          ))}
        </div>
        <div className={`${P}-row`} data-fila="3" role="group" aria-label={b.items[3]?.texto ?? ''} hidden>
          {GUION_REPLICADO.map((g) => (
            <article key={g.t} className={`${P}-gcard`}>
              <div className={`${P}-gcard-brand`}><span className={`${P}-gcard-logo`}><EstrellaMaKo size={12} /></span><span>Escrito por MaKo</span></div>
              <div className={`${P}-gcard-t`}>{g.t}</div>
              <p className={`${P}-gcard-v`}>{g.v}</p>
              <div className={`${P}-gcard-foot`}><span className={`${P}-pill`}>Reel · 45 s</span></div>
            </article>
          ))}
        </div>
        <div className={`${P}-prompt`}>
          <span className={`${P}-chip`} role="img" aria-label="MaKo"><EstrellaMaKo size={16} /><span>MaKo</span></span>
          <span className={`${P}-type`}><span data-pedido="">{pedidos[0]}</span><span className={`${P}-cursor`} aria-hidden="true" /></span>
          <span className={`${P}-submit`} role="button" tabIndex={0} aria-label="Ver la próxima pregunta" data-proxima="">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5" /><path d="M6 11l6 -6l6 6" /></svg>
          </span>
        </div>
      </div>
    </section>
  );
}

// ── «Dos formas»: las dos cabezas, las dos columnas, las barras pegadas y la banda del final ────────────────────────────────
function Video({ f }: { f: { video: string; poster: string; alt: string } }) {
  return (
    <span className={`${P}-pantalla`}>
      <video className={`${P}-video`} src={f.video} poster={f.poster} muted loop playsInline preload="none" aria-label={f.alt} />
    </span>
  );
}

/** El paso 1: la conexión de tu Meta con MaKo, una vez (en la suya, el video de pegar su línea en Claude). */
function Conecta() {
  return (
    <div className={`${P}-conecta`}>
      <span className={`${P}-conecta-t`}><img src="/vsl-assets/logos/meta.png" alt="" width={34} height={34} /></span>
      <span className={`${P}-conecta-l`}><i /></span>
      <span className={`${P}-conecta-t ${P}-conecta-m`}><EstrellaMaKo size={30} /></span>
    </div>
  );
}

/** El paso 3: el pedido que se escribe, la flecha que se aprieta y las tres tarjetas del guion que caen (su `.sx-chat`). Es
 *  blanco con su grilla en los dos modos, como el suyo (data-tema-fijo). */
function Listo({ pedido }: { pedido: string }) {
  return (
    <div className={`${P}-dm ${P}-chat`} data-tema-fijo="" role="img" aria-label={`MaKo escribiendo tu guion: ${GUION_REPLICADO.map((g) => g.t.toLowerCase()).join(', ')}`}>
      <div className={`${P}-cc-fila`} aria-hidden="true">
        {GUION_REPLICADO.map((g, k) => (
          <div key={g.t} className={`${P}-cc`} style={{ ['--k' as string]: String(k + 1) }}>
            <div className={`${P}-cc-b`}><span><EstrellaMaKo size={10} /></span><b>MaKo</b></div>
            <div className={`${P}-cc-t`}>{g.t}</div>
            <p className={`${P}-cc-v`}>{g.v}</p>
          </div>
        ))}
      </div>
      <div className={`${P}-cc-prompt`} aria-hidden="true">
        <span className={`${P}-chip ${P}-chip-cq`}><EstrellaMaKo size={12} /><span>MaKo</span></span>
        <span className={`${P}-cc-type`}><span>{pedido}</span></span>
        <span className={`${P}-cc-send`}>↑</span>
      </div>
    </div>
  );
}

function DosFormas({ t, f, p, pedido }: { t: De<'tarjetas'>; f: De<'filas'>; p: De<'pasos'>; pedido: string }) {
  const [app, mako] = t.items;
  const it = f.items;
  const filaApp = (i: number, fila: string, d = '') => {
    const item = it[i];
    const g = FILAS_DE_LA_APP[i];
    if (!item || !g) return null;
    return (
      <div className={`${P}-card ${P}-rv${d} ${fila}`} data-col="app">
        <div className={`${P}-dm`} data-tema-fijo="">
          <Video f={g} />
          {f.etiqueta ? <span className={`${P}-tag`}>{f.etiqueta}</span> : null}
        </div>
        <div className={`${P}-dc`}>
          <span className={`${P}-sb`}>{g.rotulo}</span>
          <h4 dangerouslySetInnerHTML={html(item.titulo)} />
          <p dangerouslySetInnerHTML={html(item.texto)} />
        </div>
      </div>
    );
  };
  const paso = (i: number, visual: ReactNode, clase: string, d = ' ' + P + '-d1') => {
    const it2 = p.pasos[i];
    if (!it2) return null;
    return (
      <div className={`${P}-card ${P}-rv${d} ${clase}`} data-col="mako">
        <div className={`${P}-dmwrap`}>
          {visual}
          {p.etiqueta ? <span className={`${P}-tag ${P}-tag-ag`}>{p.etiqueta}</span> : null}
        </div>
        <div className={`${P}-dc`}>
          <span className={`${P}-sb`}><i>{i + 1}</i></span>
          <h4 dangerouslySetInnerHTML={html(it2.titulo)} />
          <p dangerouslySetInnerHTML={html(it2.texto)} />
        </div>
      </div>
    );
  };
  return (
    <section className={`${P}-band`}>
      <div className={`${P}-wrap`}>
        {t.etiqueta ? <div className={`${P}-kicker ${P}-rv`}>{t.etiqueta}</div> : null}
        <h2 className={`${P}-h2 ${P}-rv ${P}-d1`} dangerouslySetInnerHTML={html(t.titulo)} />
        {t.bajada ? <p className={`${P}-lede ${P}-rv ${P}-d2`} dangerouslySetInnerHTML={html(t.bajada)} /> : null}
        <div className={`${P}-sx`}>
          <header className={`${P}-way ${P}-rv ${P}-d1`} data-hd="app" data-col="app">
            {app?.meta ? <span className={`${P}-wt`}>{app.meta}</span> : null}
            <h3 dangerouslySetInnerHTML={html(app?.titulo ?? f.titulo)} />
            {app ? <p dangerouslySetInnerHTML={html(app.texto)} /> : null}
            <ul>{(app?.puntos ?? it.map((x) => x.titulo)).map((x) => <li key={x} dangerouslySetInnerHTML={html(x)} />)}</ul>
          </header>
          <span className={`${P}-or ${P}-rv ${P}-d2`} aria-hidden="true">o</span>
          <header className={`${P}-way ${P}-rv ${P}-d2`} data-hd="mako" data-col="mako">
            {mako?.meta ? <span className={`${P}-wt`}>{mako.meta}</span> : null}
            <h3 dangerouslySetInnerHTML={html(mako?.titulo ?? p.titulo)} />
            {mako ? <p dangerouslySetInnerHTML={html(mako.texto)} /> : null}
            <ul>{(mako?.puntos ?? p.pasos.map((x) => x.titulo)).map((x) => <li key={x} dangerouslySetInnerHTML={html(x)} />)}</ul>
          </header>
          {/* El orden es el de la suya: en el teléfono, una debajo de la otra, la de la app primero en cada par. */}
          {filaApp(0, `${P}-r2`)}
          {paso(0, <div className={`${P}-dm ${P}-dm-oscuro`} data-tema-fijo=""><Conecta /></div>, `${P}-r2`)}
          <div className={`${P}-ask-track`} data-col="mako">
            {paso(1, <div className={`${P}-dm ${P}-dm-negro`} data-tema-fijo=""><Video f={PASO_PREGUNTA} /></div>, `${P}-pega`)}
          </div>
          {filaApp(1, `${P}-r3`)}
          {filaApp(2, `${P}-r4`)}
          {filaApp(3, `${P}-r5`)}
          {filaApp(4, `${P}-r6`)}
          {paso(2, <Listo pedido={pedido} />, `${P}-r6 ${P}-listo`)}
          <div className={`${P}-bar-track`} data-col="app" aria-hidden="true">
            <div className={`${P}-bar`} data-bar="app">{app?.meta ? <span className={`${P}-wt`}>{app.meta}</span> : null}<b dangerouslySetInnerHTML={html(app?.titulo ?? f.titulo)} /></div>
          </div>
          <div className={`${P}-bar-track`} data-col="mako" aria-hidden="true">
            <div className={`${P}-bar`} data-bar="mako">{mako?.meta ? <span className={`${P}-wt`}>{mako.meta}</span> : null}<b dangerouslySetInnerHTML={html(mako?.titulo ?? p.titulo)} /></div>
          </div>
          <div className={`${P}-spine`} aria-hidden="true" />
          {p.bajada ? (
            <div className={`${P}-finish ${P}-rv`}>
              <p dangerouslySetInnerHTML={html(p.bajada)} />
              <Cta />
            </div>
          ) : null}
        </div>
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
          <div className={`${P}-kicker ${P}-rv`}>[ Preguntas ]</div>
          <h2 className={`${P}-h2 ${P}-rv ${P}-d1`} dangerouslySetInnerHTML={html(b.titulo)} />
          <p className={`${P}-rv ${P}-d2`}>¿No encuentras tu respuesta?<br /><a href={RUTA_CTA}>{TEXTO_CTA}</a></p>
        </div>
        <div className={`${P}-faq2-right ${P}-rv ${P}-d1`}>
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

/** El cierre: el texto es el de la banda de todas las landings de /vsl; detrás, como en la suya, dos cintas de anuncios que corren
 *  (acá, los de Hormozi que guardó Spy), con su viñeta encima. La sección es oscura en los dos modos (data-tema-fijo). */
function Cierre() {
  return (
    <section className={`${P}-closer`} data-tema-fijo="">
      <div className={`${P}-marq`} aria-hidden="true">
        {CINTAS_CIERRE.map((cinta, k) => (
          <div key={k} className={`${P}-lane${k ? ` ${P}-lane-r` : ''}`}>
            {[...cinta, ...cinta].map((id, i) => <img key={i} src={imagenDe(id)} alt="" width={120} height={id === 3360 ? 213 : 150} loading="lazy" />)}
          </div>
        ))}
      </div>
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
  const partes: ReactNode[] = [];
  // La referencia mete el hero, la tira de logos y «Ask your AI» en la misma sección (con su grilla y su halo).
  const cabeza: ReactNode[] = [];
  const pregunta = bl.find((b): b is De<'tarjetas'> => b.tipo === 'tarjetas' && b.columnas !== 2);
  const pedidoFinal = pregunta?.items[pregunta.items.length - 1]?.titulo ?? '';
  let i = 0;
  while (i < bl.length) {
    const b = bl[i];
    const n1 = bl[i + 1];
    const n2 = bl[i + 2];
    if (b.tipo === 'tarjetas' && b.columnas === 2 && n1?.tipo === 'filas' && n2?.tipo === 'pasos') {
      partes.push(<DosFormas key={i} t={b} f={n1} p={n2} pedido={pedidoFinal} />);
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
    <div className={`${P} ${P}-raiz`}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <Barra />
      <main>
        <section className={`${P}-hero`}>{cabeza}</section>
        {partes}
        <Cierre />
      </main>
      <PieDePagina />
      <script data-visor="" dangerouslySetInnerHTML={{ __html: SCRIPT }} />
    </div>
  );
}

// =============================================================================
// El script (data-visor: el visor de Martín borra los demás). Es el de Gethookd, pasado a MaKo:
//   1. la demo de «Pregúntale a tu IA» (sus tiempos exactos; sólo mientras se ve el 25 %; la flecha pasa a la próxima);
//   2. las `-rv` que aparecen al entrar (umbral .18 y 8 % menos abajo, como sus `.rv`);
//   3. «Dos formas»: las barras de cada columna cuando sus cabezas salen por arriba (computadora), la tarjeta del paso 3 que se
//      anima sólo mientras se ve el 35 %, y los videos: cada uno carga 600 px antes y corre sólo el que más se ve de su columna
//      (en el teléfono, uno solo), con un botón para tocar si el teléfono no deja arrancarlo.
// Con «menos movimiento»: la demo queda en su primera escena entera, nada aparece ni corre solo, y los videos se tocan.
// Idempotente (`__listo`) y limpia su estado antes de empezar: pulir.mjs guarda el DOM DESPUÉS de correrlo.
// =============================================================================
const SCRIPT = `(function(){
var P='${P}';
function trasHidratar(fn){if(!document.querySelector('script[src*="/_next/"]'))return fn();var t0=Date.now();(function mira(){var h=Object.keys(document.body).some(function(k){return k.indexOf('__reactFiber')===0||k.indexOf('__reactProps')===0;});if(h||Date.now()-t0>6000)fn();else setTimeout(mira,60);})();}
function iniciar(){
  var R=document.querySelector('.'+P+'-raiz');if(!R||R.__listo)return;R.__listo=1;
  var quieto=!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);
  var hayIO='IntersectionObserver' in window;
  var barra=document.querySelector('.s-solo-barra');
  function alto(){return barra?Math.round(barra.getBoundingClientRect().height):0;}
  R.style.setProperty('--barra-alto',alto()+'px');
  // 1. La demo.
  var D=R.querySelector('.'+P+'-iface');
  if(D){
    var filas=[].slice.call(D.querySelectorAll('[data-fila]'));
    var pedidos=[];try{pedidos=JSON.parse(D.getAttribute('data-pedidos')||'[]');}catch(e){}
    var pr=D.querySelector('[data-pedido]'),caja=pr.parentNode,sig=D.querySelector('[data-proxima]');
    var actual=0,timers=[],corre=false,ve=false;
    function luego(fn,ms){var t=setTimeout(function(){timers=timers.filter(function(x){return x!==t;});fn();},ms);timers.push(t);return t;}
    function limpiar(){timers.forEach(clearTimeout);timers=[];}
    function preparar(k){actual=(k+filas.length)%filas.length;filas.forEach(function(f,j){f.hidden=j!==actual;});return [].slice.call(filas[actual].children);}
    function quieta(k){var c=preparar(k);pr.textContent=pedidos[actual]||'';c.forEach(function(x){x.classList.add('in');});}
    function escena(k){
      if(!corre||!ve)return;
      var c=preparar(k),texto=pedidos[actual]||'',n=0;
      caja.classList.remove(P+'-borra');pr.textContent='';c.forEach(function(x){x.classList.remove('in');});
      function letra(){
        if(!corre||!ve)return;
        n++;pr.textContent=texto.slice(0,n);
        if(n<texto.length){var ch=texto.charAt(n-1);luego(letra,ch===','?55:ch===' '?12:18);return;}
        luego(function(){c.forEach(function(x,j){luego(function(){x.classList.add('in');},j*115);});},120);
        luego(function(){
          c.slice().reverse().forEach(function(x,j){luego(function(){x.classList.remove('in');},j*70);});
          luego(function(){caja.classList.add(P+'-borra');},90);
          luego(function(){pr.textContent='';caja.classList.remove(P+'-borra');escena(actual+1);},470);
        },2860);
      }
      luego(letra,260);
    }
    function parar(){limpiar();corre=false;}
    function arrancar(k){if(!ve)return;parar();if(quieto){quieta(k);return;}corre=true;escena(k);}
    D.classList.remove(P+'-anima');caja.classList.remove(P+'-borra');filas.forEach(function(f){[].slice.call(f.children).forEach(function(x){x.classList.remove('in');});});
    function proxima(){arrancar(actual+1);}
    if(sig){sig.addEventListener('click',proxima);sig.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();proxima();}});}
    if(!quieto){D.classList.add(P+'-anima');pr.textContent='';}else quieta(0);
    if(hayIO){new IntersectionObserver(function(es){es.forEach(function(e){ve=e.isIntersecting;if(ve)arrancar(actual);else parar();});},{threshold:.25}).observe(D);}
    else{ve=true;arrancar(0);}
  }
  // 2. Lo que aparece al bajar.
  var rv=[].slice.call(R.querySelectorAll('.'+P+'-rv'));
  rv.forEach(function(e){e.classList.remove('in');});
  if(hayIO&&!quieto){
    R.classList.add(P+'-rv-on');
    var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});},{threshold:.18,rootMargin:'0px 0px -8% 0px'});
    rv.forEach(function(e){io.observe(e);});
  }else R.classList.remove(P+'-rv-on');
  // 3. Dos formas.
  var sx=R.querySelector('.'+P+'-sx');if(!sx)return;
  var desk=window.matchMedia?matchMedia('(min-width: 861px)'):{matches:true};
  var barras=[].slice.call(sx.querySelectorAll('[data-hd]')).map(function(h){return {hd:h,bar:sx.querySelector('[data-bar="'+h.getAttribute('data-hd')+'"]')};}).filter(function(x){return x.bar;});
  var enCola=false;
  function barrasYa(){enCola=false;var b=alto();R.style.setProperty('--barra-alto',b+'px');barras.forEach(function(x){x.bar.classList.toggle('on',desk.matches&&x.hd.getBoundingClientRect().bottom<b);});}
  function barrasLuego(){if(!enCola){enCola=true;requestAnimationFrame(barrasYa);}}
  addEventListener('scroll',barrasLuego,{passive:true});addEventListener('resize',barrasLuego);barrasYa();
  var chat=sx.querySelector('.'+P+'-chat'),chatVe=false;
  function chatYa(){if(chat)chat.classList.toggle(P+'-anim',chatVe&&!document.hidden);}
  if(chat){chat.classList.remove(P+'-anim');if(hayIO&&!quieto)new IntersectionObserver(function(es){es.forEach(function(e){chatVe=e.isIntersecting&&e.intersectionRatio>=.35;chatYa();});},{threshold:[0,.35,.6,1]}).observe(chat);}
  var vids=[].slice.call(sx.querySelectorAll('video'));
  [].slice.call(sx.querySelectorAll('.'+P+'-play')).forEach(function(b){b.parentNode.removeChild(b);});
  function grupo(v){if(!desk.matches)return 'todos';var c=v.closest('[data-col]');return c?c.getAttribute('data-col'):'todos';}
  function boton(v){
    if(v.__b)return v.__b;
    var b=document.createElement('span');b.className=P+'-play';b.setAttribute('role','button');b.setAttribute('tabindex','0');b.setAttribute('aria-label','Reproducir el video');
    b.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5z"/></svg>';
    var dale=function(){v.__ok=true;var g=grupo(v);vids.forEach(function(o){if(o!==v&&grupo(o)===g&&!o.paused)o.pause();});tocar(v);};
    b.addEventListener('click',dale);b.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();dale();}});
    v.addEventListener('playing',function(){b.classList.remove('si');});
    v.parentNode.appendChild(b);v.__b=b;return b;
  }
  function calentar(v){if(quieto&&!v.__ok)return;if(v.preload==='none'){v.preload='metadata';if(v.readyState===0&&v.paused){try{v.load();}catch(e){}}}}
  function tocar(v){
    if(quieto&&!v.__ok){boton(v).classList.add('si');return;}
    var q;try{q=v.play();}catch(e){boton(v).classList.add('si');return;}
    if(q&&q.then)q.then(function(){if(v.__b)v.__b.classList.remove('si');},function(err){if(err&&err.name==='AbortError')return;if(v.paused)boton(v).classList.add('si');});
  }
  vids.forEach(function(v){v.muted=true;v.pause();boton(v);if(quieto)v.__b.classList.add('si');});
  if(!hayIO){vids.forEach(function(v){calentar(v);v.__b.classList.add('si');});return;}
  var cal=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){calentar(e.target);cal.unobserve(e.target);}});},{rootMargin:'600px 0px'});
  vids.forEach(function(v){cal.observe(v);});
  var cuanto=new Map();
  function elegir(){
    var mejor={},vh=innerHeight||document.documentElement.clientHeight;
    vids.forEach(function(v){var r=cuanto.get(v)||0;if(r<.35)return;var b=v.getBoundingClientRect(),g=grupo(v);var s=r*1000-Math.abs((b.top+b.bottom)/2-vh/2)/10+(v.__ok?5000:0);if(!mejor[g]||s>mejor[g].s)mejor[g]={v:v,s:s};});
    vids.forEach(function(v){var g=grupo(v),si=mejor[g]&&mejor[g].v===v;if(!si){if(!v.paused)v.pause();if(!quieto&&v.__b)v.__b.classList.remove('si');return;}if(v.paused&&!document.hidden)tocar(v);});
  }
  var mira=new IntersectionObserver(function(es){es.forEach(function(e){cuanto.set(e.target,e.intersectionRatio);});elegir();},{threshold:[0,.2,.35,.5,.65,.8,1]});
  vids.forEach(function(v){mira.observe(v);});
  document.addEventListener('visibilitychange',function(){if(document.hidden)vids.forEach(function(v){if(!v.paused)v.pause();});else elegir();chatYa();});
  if(desk.addEventListener)desk.addEventListener('change',function(){elegir();barrasYa();});
}
function arrancar(){trasHidratar(iniciar);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',arrancar);else arrancar();
})();`;

// Los valores salen de getComputedStyle sobre https://www.gethookd.ai/ a 1440 y 390 px (11/11 y 14/11/2026) y de su CSS (que viene
// en el HTML). El azul de la referencia (#3352FF) va como el de MaKo (#2F6FED); sus tintes (#EDF0FF, #EEF1FF, #F5F7FF, #CCD4FF,
// #D3DAF7, #9FB0FF), como los mismos tintes del azul de MaKo.
const CSS = `
@font-face { font-family: 'd-script-inter'; src: url('/vsl-assets/fuentes/inter/inter-latin-opsz-var.woff2') format('woff2'); font-weight: 100 900; font-style: normal; font-display: swap; }
.d-script { --az: #2F6FED; --az-o: #1F57C8; --az-t: #EAF1FE; --az-t2: #F4F7FE; --az-b: #C9D9FB; --tinta: #061523; --tinta2: #0B1A27; --gris: #52616E; --gris2: #5F6D7A; --gris3: #6F7781; --linea: #E2E6EA; --barra-alto: 72px;
  background: #fff; color: var(--tinta); font-family: 'd-script-inter', Inter, Arial, sans-serif; font-size: 16px; line-height: normal; -webkit-font-smoothing: antialiased; overflow-x: clip; }
.d-script *, .d-script *::before, .d-script *::after { box-sizing: border-box; }
.d-script :where(h1, h2, h3, h4, p, ul) { margin: 0; padding: 0; }
.d-script :where(ul) { list-style: none; }
.d-script :where(a) { color: inherit; text-decoration: none; }
.d-script-wrap { max-width: 1240px; margin: 0 auto; }
.d-script-flecha { flex: none; }

/* ── Barra: 82 px, blanca al 98 %, filete #EEF0F2 (la del sitio la tapa) ── */
.d-script-nav { position: relative; z-index: 20; background: rgba(255,255,255,.98); border-bottom: 1px solid #EEF0F2; }
.d-script-navin { height: 81px; display: flex; align-items: center; justify-content: space-between; gap: 24px; }
.d-script-brand { flex: none; }
.d-script-navlinks { display: flex; align-items: center; gap: 34px; position: absolute; left: 50%; transform: translateX(-50%); }
.d-script-dd { position: relative; }
.d-script-dd-btn { display: inline-flex; align-items: center; gap: 5px; cursor: pointer; font-size: 15px; font-weight: 650; line-height: 21px; color: #6F7781; }
.d-script-dd-btn .d-script-chev { width: 12px; height: 12px; transition: transform .15s; }
.d-script-dd:hover .d-script-dd-btn, .d-script-dd:focus-within .d-script-dd-btn { color: var(--tinta); }
.d-script-dd:hover .d-script-chev, .d-script-dd:focus-within .d-script-chev { transform: rotate(180deg); }
.d-script-dd-list { position: absolute; top: calc(100% + 14px); left: 50%; transform: translateX(-50%); width: 560px; display: none; grid-template-columns: 1fr 1fr; gap: 2px; padding: 8px; background: #fff; border: 1px solid #E2E6EA; border-radius: 13px; box-shadow: 0 24px 80px rgba(6,21,35,.12); }
.d-script-dd-list::before { content: ''; position: absolute; left: 0; right: 0; top: -16px; height: 16px; }
.d-script-dd:hover .d-script-dd-list, .d-script-dd:focus-within .d-script-dd-list { display: grid; }
.d-script-dd-list a { padding: 9px 12px; border-radius: 8px; font-size: 14.5px; font-weight: 650; color: #34414D; }
.d-script-dd-list a:hover, .d-script-dd-list a:focus-visible { background: #F5F7F9; color: var(--tinta); }
.d-script-navright { display: flex; align-items: center; gap: 24px; }
.d-script-login { font-size: 16px; font-weight: 650; line-height: 22.4px; color: #6F7781; }
.d-script-login:hover { color: var(--tinta); }
.d-script-navcta, .d-script-cta { display: inline-flex; align-items: center; justify-content: center; gap: 10px; height: 50px; padding: 0 19px; border-radius: 9px; background: var(--az); color: #fff !important; font-size: 14px; font-weight: 800; line-height: 16.8px; box-shadow: 0 10px 24px rgba(47,111,237,.18); transition: all .2s ease; white-space: nowrap; }
.d-script-navcta:hover, .d-script-cta:hover { background: var(--az-o); transform: translateY(-1px); }
.d-script-burger { display: none; position: relative; }
.d-script-burger summary { list-style: none; cursor: pointer; width: 40px; height: 40px; display: grid; place-items: center; border: 1px solid #E2E6EA; border-radius: 9px; color: var(--tinta); }
.d-script-burger summary::-webkit-details-marker { display: none; }
.d-script-burger-list { position: absolute; right: 0; top: calc(100% + 8px); width: 260px; max-height: 70vh; overflow: auto; background: #fff; border: 1px solid #E2E6EA; border-radius: 14px; box-shadow: 0 24px 40px rgba(6,21,35,.1); padding: 8px; display: flex; flex-direction: column; }
.d-script-burger-list a { padding: 10px 12px; border-radius: 9px; font-size: 15px; font-weight: 650; color: #34414D; }

/* ── Hero: padding 76/72, grilla de 76 px enmascarada y halo lila arriba ── */
.d-script-hero { position: relative; padding: 76px 0 72px; background: #fff; overflow: hidden; }
.d-script-hero::before { content: ''; position: absolute; inset: 0; pointer-events: none;
  background-image: linear-gradient(rgba(47,111,237,.055) 1px, transparent 1px), linear-gradient(90deg, rgba(47,111,237,.055) 1px, transparent 1px);
  background-size: 76px 76px;
  -webkit-mask-image: radial-gradient(ellipse 78% 62% at 50% 34%, #000 30%, transparent 78%); mask-image: radial-gradient(ellipse 78% 62% at 50% 34%, #000 30%, transparent 78%); }
.d-script-hero::after { content: ''; position: absolute; left: 50%; top: -12%; width: 1180px; height: 780px; transform: translateX(-50%); pointer-events: none;
  background: radial-gradient(ellipse at center, rgba(47,111,237,.13), rgba(120,140,255,.07) 42%, transparent 70%); }
.d-script-hero > * { position: relative; z-index: 2; }
.d-script-hero-copy { max-width: 1480px; padding: 0 24px; text-align: center; }
.d-script-eyebrow { font-size: clamp(15px, 1.3vw, 17px); font-weight: 800; letter-spacing: -0.005em; color: var(--az); }
.d-script-h1 { margin: 12px auto 20px; max-width: 1100px; font-size: clamp(54px, 4.4vw, 72px); font-weight: 600; line-height: 1; letter-spacing: -0.06em; color: var(--tinta); text-wrap: balance; }
.d-script-h1 strong { font-weight: 600; color: transparent; -webkit-text-fill-color: transparent; -webkit-background-clip: text; background-clip: text;
  background-image: linear-gradient(100deg, #2F6FED 0%, #6E8FF8 20%, #00B3FF 40%, #6E8FF8 60%, #2F6FED 80%, #2F6FED 100%); background-size: 250% 100%; animation: d-script-hl 3s linear infinite; }
.d-script-hero-sub { margin: 0 auto; max-width: 850px; font-size: clamp(19px, 1.72vw, 25px); font-weight: 540; line-height: 1.4; color: #354351; }
.d-script-hero-sub strong { font-weight: 700; color: var(--tinta); }
.d-script-hero-actions { margin-top: 28px; display: flex; justify-content: center; align-items: center; gap: 12px; }
.d-script-hero-actions .d-script-cta { height: 52px; padding: 0 23px; gap: 11px; font-size: 16px; }
.d-script-hero-stats { margin: 28px auto 0; display: flex; justify-content: center; flex-wrap: wrap; gap: 8px; }
.d-script-hero-stat { display: inline-flex; align-items: center; gap: 9px; padding: 8px 15px 8px 9px; border-radius: 13px; background: rgba(255,255,255,.7); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); border: 1px solid rgba(16,38,64,.08); font-size: 13.5px; font-weight: 600; letter-spacing: -0.005em; color: #5B6B7B; transition: border-color .2s ease, transform .2s ease; }
.d-script-hero-stat:hover { border-color: rgba(47,111,237,.22); transform: translateY(-1px); }
.d-script-hero-stat i { flex: none; width: 23px; height: 23px; border-radius: 8px; background: var(--az-t); color: var(--az); display: grid; place-items: center; }
.d-script-hero-stat b { color: #101F2E; font-weight: 800; }

/* ── La tira (en la referencia, «Trusted by teams at» y los logos al 50 %) ── */
.d-script-logos { padding: 30px 24px 34px; background: transparent; border-bottom: 1px solid var(--linea); text-align: center; }
.d-script-logos-kicker { margin: 0 0 20px; font-size: 12px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; color: var(--gris2); line-height: 1.35; }
.d-script-logos-track { display: flex; justify-content: center; align-items: center; gap: 60px; flex-wrap: wrap; }
.d-script-logo { display: inline-flex; align-items: baseline; gap: 10px; opacity: .5; font-size: 30px; font-weight: 700; letter-spacing: -0.04em; color: var(--tinta); }
.d-script-logo b { font-weight: 800; }

/* ── «Pregúntale a tu IA»: 1120 de ancho, mínimo 590 de alto, radio 26, grilla de 90 px, sombra 0 24 80 ── */
.d-script-ask { position: relative; z-index: 2; max-width: 1120px; min-height: 590px; margin: 52px auto 0; padding: 56px 56px 38px; border-radius: 26px; border: 1px solid #DCE2E7; overflow: hidden;
  background-color: #fff; background-image: linear-gradient(rgba(47,111,237,.055) 1px, transparent 1px), linear-gradient(90deg, rgba(47,111,237,.055) 1px, transparent 1px); background-size: 90px 90px;
  box-shadow: 0 24px 80px rgba(6,21,35,.12); }
.d-script-ask::before { content: ''; position: absolute; inset: 28% 18% 3%; pointer-events: none; background: radial-gradient(circle, rgba(47,111,237,.09), transparent 70%); }
.d-script-ask > * { position: relative; z-index: 2; }
.d-script-ask-head { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 40px; align-items: end; }
.d-script-access { display: flex; align-items: center; gap: 10px; font-size: 11px; font-weight: 820; letter-spacing: .1em; text-transform: uppercase; color: var(--az); }
.d-script-ask-h2 { margin: 14px 0 10px; font-size: clamp(44px, 5vw, 70px); font-weight: 700; line-height: .98; letter-spacing: -0.055em; color: var(--tinta); }
.d-script-ask-copy { max-width: 660px; font-size: 17px; line-height: 1.52; color: var(--gris); }
.d-script-learn { display: inline-flex; align-items: center; justify-content: center; min-height: 48px; padding: 0 20px; border-radius: 12px; background: #F2F4F6; color: #1D2B37; font-size: 14px; font-weight: 800; transition: transform .2s ease, background-color .2s ease; white-space: nowrap; }
.d-script-learn:hover { background: #E9EDF0; transform: translateY(-1px); }
.d-script-iface { position: relative; z-index: 2; width: min(820px, 100%); margin: 112px auto 0; }
.d-script-row { display: flex; justify-content: center; align-items: stretch; gap: 10px; margin: 0 0 16px; }
.d-script-row[hidden] { display: none; }
.d-script-acard, .d-script-bcard, .d-script-icard, .d-script-gcard { display: flex; flex-direction: column; flex: 0 0 auto; overflow: hidden; border: 1px solid #E3E7EB; border-radius: 14px; background: #fff; box-shadow: 0 14px 34px rgba(6,21,35,.13);
  transition: opacity .42s cubic-bezier(.2,.75,.2,1), transform .42s cubic-bezier(.2,.75,.2,1); will-change: opacity, transform; }
.d-script-anima .d-script-row > * { opacity: 0; transform: translateY(26px) scale(.9); }
.d-script-anima .d-script-row > .in { opacity: 1; transform: none; }
.d-script-acard { width: 152px; }
.d-script-acard-brand { display: flex; align-items: center; gap: 7px; padding: 9px 10px 8px; }
.d-script-acard-logo { flex: none; width: 20px; height: 20px; border-radius: 50%; object-fit: cover; background: #EEF1F4; }
.d-script-acard-name { flex: 1; min-width: 0; overflow: hidden; color: #101F2E; font-size: 10.5px; font-weight: 750; text-overflow: ellipsis; white-space: nowrap; }
.d-script-acard-more { flex: none; color: #AEB7C0; font-size: 12px; line-height: 1; letter-spacing: .5px; }
.d-script-acard-img { display: block; width: 100%; height: 126px; object-fit: cover; object-position: top; background: #F2F4F6; }
.d-script-acard-foot { display: flex; align-items: center; gap: 6px; padding: 8px 9px; margin-top: auto; }
.d-script-pill { display: inline-flex; align-items: center; gap: 4px; padding: 3px 7px; border-radius: 7px; background: #F2F5F8; color: #54636F; font-size: 9.5px; font-weight: 750; white-space: nowrap; }
.d-script-pill svg { color: #6B7A86; }
.d-script-pill-vivo { background: #EAF7EF; color: #17804A; }
.d-script-pill-vivo::before { content: ''; width: 5px; height: 5px; border-radius: 50%; background: #25B567; }
.d-script-bcard, .d-script-icard, .d-script-gcard { width: 196px; padding: 14px 15px 13px; }
.d-script-bcard-head { display: flex; align-items: center; gap: 7px; margin-bottom: 10px; }
.d-script-bcard-logo { flex: none; width: 21px; height: 21px; border-radius: 50%; background: var(--az-t); color: var(--az); display: grid; place-items: center; }
.d-script-bcard-name { flex: 1; min-width: 0; overflow: hidden; color: #101F2E; font-size: 11px; font-weight: 800; text-overflow: ellipsis; white-space: nowrap; }
.d-script-bcard-up { flex: none; display: inline-flex; align-items: center; padding: 3px 6px; border-radius: 6px; background: #EAF7EF; color: #17804A; font-size: 9.5px; font-weight: 850; }
.d-script-bcard-barra { display: block; height: 32px; border-radius: 6px; background: #F2F5F8; overflow: hidden; position: relative; }
.d-script-bcard-barra i { position: absolute; left: 0; top: 0; bottom: 0; background: linear-gradient(90deg, rgba(37,181,103,.18), rgba(37,181,103,.35)); border-right: 2px solid #25B567; }
.d-script-bcard-foot { margin-top: auto; padding-top: 9px; color: #6C7883; font-size: 9.5px; font-weight: 650; }
.d-script-bcard-foot b { color: #2B3A47; font-weight: 850; }
.d-script-icard-t, .d-script-gcard-t { color: var(--az); font-size: 8.5px; font-weight: 850; letter-spacing: .09em; text-transform: uppercase; }
.d-script-icard-v { margin-top: 7px; color: #101F2E; font-size: 14px; font-weight: 800; line-height: 1.25; letter-spacing: -0.02em; }
.d-script-icard-s { margin-top: auto; padding-top: 9px; color: #6C7883; font-size: 9.5px; font-weight: 650; }
.d-script-icard-s b { color: #17804A; font-weight: 850; }
.d-script-icard-malo .d-script-icard-s b { color: #C2410C; }
.d-script-gcard-brand { display: flex; align-items: center; gap: 7px; margin-bottom: 9px; color: #101F2E; font-size: 10.5px; font-weight: 750; }
.d-script-gcard-logo { flex: none; width: 20px; height: 20px; border-radius: 50%; background: #1A1712; display: grid; place-items: center; }
.d-script-gcard-v { margin-top: 6px; color: #101F2E; font-size: 12px; font-weight: 700; line-height: 1.32; letter-spacing: -0.01em; }
.d-script-gcard-foot { margin-top: auto; padding-top: 10px; }
.d-script-prompt { display: flex; align-items: center; gap: 12px; min-height: 104px; padding: 18px 18px 18px 20px; background: #fff; border: 1px solid #DCE2E7; border-radius: 20px; box-shadow: 0 18px 38px rgba(6,21,35,.1); }
.d-script-chip { flex: none; display: inline-flex; align-items: center; gap: 7px; padding: 8px 10px; border-radius: 999px; background: var(--az-t); color: var(--az-o); font-size: 11px; font-weight: 850; }
.d-script-type { flex: 1; min-width: 0; min-height: 1.4em; color: #152534; font-size: 17px; line-height: 1.4; transition: opacity .22s ease, transform .22s ease; }
.d-script-type.d-script-borra { opacity: 0; transform: translateY(5px); }
.d-script-cursor { display: inline-block; width: 2px; height: 1.05em; margin-left: 2px; background: var(--az); vertical-align: -.15em; animation: d-script-cursor .72s steps(1, end) infinite; }
.d-script-submit { flex: none; width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; background: var(--az); color: #fff; cursor: pointer; box-shadow: 0 8px 20px rgba(47,111,237,.25); transition: transform .2s ease, background-color .2s ease; }
.d-script-submit:hover { background: var(--az-o); transform: translateY(-1px); }
.d-script-submit:focus-visible, .d-script-learn:focus-visible { outline: 3px solid rgba(47,111,237,.35); outline-offset: 3px; }

/* ── Lo que aparece al bajar (sus .rv): sólo con el script andando ── */
.d-script-rv-on .d-script-rv { opacity: 0; transform: translateY(26px); transition: opacity .7s cubic-bezier(.2,.7,.2,1), transform .7s cubic-bezier(.2,.7,.2,1); }
.d-script-rv-on .d-script-rv.in { opacity: 1; transform: none; }
.d-script-rv-on .d-script-rv.d-script-d1 { transition-delay: .09s; }
.d-script-rv-on .d-script-rv.d-script-d2 { transition-delay: .18s; }

/* ── Bandas: padding 96, contenedor 1240, rótulo 11 px, h2 56 px ── */
.d-script-band { padding: 96px 0; background: #fff; }
.d-script-kicker { font-size: 11px; font-weight: 850; letter-spacing: .14em; text-transform: uppercase; color: var(--az); }
.d-script-h2 { margin: 12px 0 16px; max-width: 900px; font-size: clamp(34px, 4.4vw, 56px); font-weight: 700; line-height: 1.02; letter-spacing: -0.05em; color: var(--tinta); }
.d-script-lede { max-width: 720px; font-size: 18px; line-height: 1.58; color: var(--gris); }

/* ── «Dos formas» (su .sx) ── */
.d-script-sx { position: relative; margin-top: 44px; display: grid; grid-template-columns: minmax(0, 1fr) 56px minmax(0, 1fr); row-gap: 24px; align-items: start; }
.d-script-way { align-self: stretch; display: flex; flex-direction: column; padding: 30px 28px; background: #fff; border: 1px solid #E0E5EA; border-radius: 18px; box-shadow: 0 12px 32px rgba(6,21,35,.06); cursor: default; }
.d-script-wt { display: inline-flex; align-items: center; gap: 9px; font-size: 10.5px; font-weight: 850; letter-spacing: .13em; text-transform: uppercase; color: var(--az); }
.d-script-way h3 { margin: 14px 0 10px; font-size: 26px; font-weight: 700; line-height: 1.2; letter-spacing: -0.035em; color: var(--tinta); }
.d-script-way > p { margin: 0 0 18px; font-size: 16px; line-height: 1.55; color: var(--gris2); }
.d-script-way ul { margin: 0 0 18px; flex: 1; }
.d-script-way li { position: relative; padding-left: 24px; margin-bottom: 11px; font-size: 15.5px; line-height: 1.5; color: #2B3A47; }
.d-script-way li::before { content: ''; position: absolute; left: 0; top: 7px; width: 12px; height: 6px; border-left: 2px solid var(--az); border-bottom: 2px solid var(--az); transform: rotate(-45deg); }
.d-script-or { position: relative; z-index: 3; width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; background: #fff; border: 1px solid #DFE4EA; box-shadow: 0 8px 22px rgba(6,21,35,.1); font-size: 11px; font-weight: 850; letter-spacing: .1em; text-transform: uppercase; color: var(--gris2); }
.d-script-card { position: relative; margin: 0; overflow: hidden; background: #fff; border: 1px solid #E3E8EC; border-radius: 18px; box-shadow: 0 10px 30px rgba(11,26,39,.06); }
.d-script-dmwrap { position: relative; }
.d-script-dm { position: relative; aspect-ratio: 1752 / 1080; overflow: hidden; background: #0F1C27; }
/* Donde la suya pone la grabación de su app sobre su fondo azul, la de MaKo, como una ventana sobre el mismo fondo. */
.d-script-card[data-col="app"] .d-script-dm { background: radial-gradient(120% 90% at 92% 0%, #6FA3FF 0%, rgba(111,163,255,0) 45%), radial-gradient(90% 70% at 0% 100%, #1D5FD6 0%, rgba(29,95,214,0) 65%), linear-gradient(160deg, #2E6CE6 0%, #173F94 45%, #0F1C27 100%); }
.d-script-pantalla { position: absolute; left: 5.5%; right: 5.5%; top: 7%; bottom: -1px; overflow: hidden; border-radius: 10px 10px 0 0; background: #F6F5F2; box-shadow: 0 -2px 40px rgba(0,0,0,.35); }
.d-script-video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: top; display: block; }
.d-script-play { position: absolute; left: 50%; top: 50%; z-index: 3; display: none; place-items: center; width: 62px; height: 62px; margin: -31px 0 0 -31px; border-radius: 50%; background: rgba(47,111,237,.94); cursor: pointer; box-shadow: 0 10px 26px rgba(6,21,35,.3); }
.d-script-play.si { display: grid; }
.d-script-play svg { width: 22px; height: 22px; margin-left: 3px; fill: #fff; }
.d-script-tag { position: absolute; top: 10px; left: 10px; z-index: 2; display: none; padding: 5px 8px; border-radius: 7px; background: rgba(11,26,39,.84); color: #fff; font-size: 9.5px; font-weight: 850; line-height: 1.2; letter-spacing: .07em; text-transform: uppercase; pointer-events: none; }
.d-script-tag-ag { background: rgba(47,111,237,.94); }
.d-script-dc { padding: 18px 20px 20px; }
.d-script-sb { display: inline-flex; align-items: center; gap: 10px; font-size: 10.5px; font-weight: 850; letter-spacing: .14em; text-transform: uppercase; color: var(--az); }
.d-script-sb i { width: 24px; height: 24px; border-radius: 8px; background: var(--az); color: #fff; display: grid; place-items: center; font-style: normal; font-size: 12px; font-weight: 850; letter-spacing: 0; }
.d-script-dc h4 { margin: 10px 0 6px; font-size: 21px; font-weight: 700; line-height: 1.18; letter-spacing: -0.03em; color: var(--tinta); text-wrap: balance; }
.d-script-dc p { font-size: 15.5px; line-height: 1.5; color: var(--gris); }
.d-script-bar-track, .d-script-spine { display: none; }
.d-script-bar { position: sticky; top: calc(var(--barra-alto) + 16px); display: flex; width: fit-content; max-width: 100%; align-items: center; gap: 12px; min-height: 52px; padding: 9px 16px; border: 1px solid #DFE4EA; border-radius: 14px; background: rgba(255,255,255,.96); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); box-shadow: 0 14px 34px rgba(6,21,35,.12); opacity: 0; transform: translateY(-10px); transition: opacity .28s ease, transform .28s ease; }
.d-script-bar.on { opacity: 1; transform: none; }
.d-script-bar .d-script-wt { flex: none; font-size: 10px; }
.d-script-bar b { flex: 1; min-width: 0; overflow: hidden; color: var(--tinta2); font-size: 16px; font-weight: 750; letter-spacing: -0.02em; text-overflow: ellipsis; white-space: nowrap; }
.d-script-finish { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 24px; margin-top: 8px; padding: 24px 26px; border-radius: 18px; background: var(--az-t2); border: 1px solid var(--az-b); }
.d-script-finish p { max-width: 660px; font-size: 19px; font-weight: 750; line-height: 1.4; letter-spacing: -0.02em; color: var(--tinta2); }
.d-script-finish .d-script-cta { flex: none; height: 52px; padding: 0 23px; gap: 11px; font-size: 16px; }
/* el paso 1: la conexión */
.d-script-dm-oscuro { display: flex; align-items: center; justify-content: center; background: #0F1C27; }
.d-script-dm-negro { display: flex; align-items: center; justify-content: center; background: #141414; }
.d-script-conecta { display: flex; align-items: center; }
.d-script-conecta-t { width: 84px; height: 84px; border-radius: 22px; display: grid; place-items: center; background: #fff; box-shadow: 0 14px 34px rgba(0,0,0,.35); }
.d-script-conecta-m { background: #1A1712; border: 1px solid #3A3631; }
.d-script-conecta-l { position: relative; width: 120px; height: 2px; background: repeating-linear-gradient(90deg, rgba(255,255,255,.35) 0 6px, transparent 6px 12px); }
.d-script-conecta-l i { position: absolute; top: -4px; left: 0; width: 10px; height: 10px; border-radius: 50%; background: var(--az); box-shadow: 0 0 0 4px rgba(47,111,237,.25); animation: d-script-viaja 2.4s ease-in-out infinite; }
/* el paso 3: su .sx-chat (medidas en cqw, del ancho de la tarjeta) */
.d-script-chat { container-type: inline-size; background-color: #fff; background-image: linear-gradient(rgba(47,111,237,.055) 1px, transparent 1px), linear-gradient(90deg, rgba(47,111,237,.055) 1px, transparent 1px); background-size: 36px 36px; }
.d-script-cc-fila { position: absolute; left: 0; right: 0; top: 5cqw; bottom: 18cqw; display: flex; justify-content: center; align-items: flex-end; gap: 3cqw; }
.d-script-cc { display: flex; flex-direction: column; width: 22cqw; height: 100%; overflow: hidden; padding: 0 1.5cqw 1.5cqw; border: 1px solid #E3E7EB; border-radius: 2.2cqw; background: #fff; box-shadow: 0 2cqw 5cqw rgba(6,21,35,.13); }
.d-script-cc-b { display: flex; align-items: center; gap: 1.2cqw; padding: 1.3cqw 0; }
.d-script-cc-b span { flex: none; width: 3.2cqw; height: 3.2cqw; border-radius: 50%; background: #1A1712; display: grid; place-items: center; }
.d-script-cc-b span svg { width: 2cqw; height: 2cqw; }
.d-script-cc-b b { color: #101F2E; font-size: clamp(7px, 1.75cqw, 11px); font-weight: 750; }
.d-script-cc-t { margin-top: .6cqw; color: var(--az); font-size: clamp(6px, 1.4cqw, 9px); font-weight: 850; letter-spacing: .09em; text-transform: uppercase; }
.d-script-cc-v { margin-top: .8cqw; color: #101F2E; font-size: clamp(7px, 1.95cqw, 12px); font-weight: 700; line-height: 1.3; letter-spacing: -0.01em; }
.d-script-cc-prompt { position: absolute; left: 6cqw; right: 6cqw; bottom: 4.5cqw; display: flex; align-items: center; gap: 2cqw; height: 10.5cqw; padding: 0 1.6cqw 0 2cqw; border: 1px solid #DCE2E7; border-radius: 3cqw; background: #fff; box-shadow: 0 2cqw 5cqw rgba(6,21,35,.1); }
.d-script-chip-cq { gap: 1cqw; padding: 1.2cqw 1.6cqw; font-size: clamp(7px, 1.8cqw, 11px); }
.d-script-chip-cq svg { width: 3cqw; height: 3cqw; }
.d-script-cc-type { flex: 1; min-width: 0; overflow: hidden; color: #152534; font-size: clamp(9px, 2.6cqw, 16px); line-height: 1.3; white-space: nowrap; }
.d-script-cc-type span { display: inline-block; max-width: 100%; overflow: hidden; vertical-align: bottom; border-right: 2px solid transparent; }
.d-script-cc-send { flex: none; display: grid; place-items: center; width: 7cqw; height: 7cqw; border-radius: 50%; background: var(--az); color: #fff; font-size: clamp(10px, 3.4cqw, 20px); font-weight: 800; line-height: 1; }
.d-script-chat.d-script-anim .d-script-cc-type span { animation: d-script-sxtype 9s linear infinite both; }
.d-script-chat.d-script-anim .d-script-cc-send { animation: d-script-sxsend 9s ease infinite both; }
.d-script-chat.d-script-anim .d-script-cc { animation: d-script-sxcard 9s cubic-bezier(.2,.75,.2,1) infinite both; animation-delay: calc((var(--k) - 1) * .35s); }

/* ── Preguntas: fondo #F7F9FA, dos columnas .82fr / 1.18fr con 70 de separación ── */
.d-script-alt { background: #F7F9FA; border-top: 1px solid #E7EBEE; border-bottom: 1px solid #E7EBEE; }
.d-script-faq2 { display: grid; grid-template-columns: minmax(0, .82fr) minmax(0, 1.18fr); gap: 70px; align-items: start; }
.d-script-faq2-left .d-script-h2 { font-size: clamp(36px, 4.6vw, 62px); line-height: 1; letter-spacing: -0.055em; }
.d-script-faq2-left p { font-size: 16px; line-height: 1.6; color: var(--gris2); }
.d-script-faq2-left a { font-weight: 750; color: var(--az); }
.d-script-faq2-right details { border-top: 1px solid var(--linea); }
.d-script-faq2-right details:last-of-type { border-bottom: 1px solid var(--linea); }
.d-script-faq2-right summary { list-style: none; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 22px 0; font-size: 18px; font-weight: 700; letter-spacing: -0.02em; color: var(--tinta2); }
.d-script-faq2-right summary::-webkit-details-marker { display: none; }
.d-script-faq2-right summary:hover { color: var(--az); }
.d-script-faq2-right .d-script-chev { flex: none; color: #8A949D; transition: transform .25s ease; }
.d-script-faq2-right details[open] .d-script-chev { transform: rotate(180deg); color: var(--az); }
.d-script-ans { margin: 0 0 24px; padding-right: 40px; font-size: 16px; line-height: 1.66; color: var(--gris); }
.d-script-ans strong, .d-script-ans b { color: var(--tinta2); }

/* ── El cierre: #0B1A27, dos cintas de anuncios al 42 % debajo de su viñeta, h2 60 px blanco ── */
.d-script-closer { position: relative; padding: 120px 24px 196px; background: #0B1A27; text-align: center; overflow: hidden; }
.d-script-marq { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: space-between; padding: 26px 0; opacity: .42; pointer-events: none; }
.d-script-lane { display: flex; gap: 14px; width: max-content; animation: d-script-lane 60s linear infinite; }
.d-script-lane-r { animation-direction: reverse; animation-duration: 75s; }
.d-script-lane img { display: block; height: 150px; width: auto; border-radius: 12px; filter: saturate(.9); }
.d-script-closer::before { content: ''; position: absolute; inset: 0; z-index: 1; pointer-events: none; background: radial-gradient(ellipse at 50% 50%, rgba(11,26,39,.72) 0, rgba(11,26,39,.55) 38%, rgba(11,26,39,.15) 75%); }
.d-script-closer-in { position: relative; z-index: 2; max-width: 860px; }
.d-script-closer h2 { margin: 0 0 16px; font-size: clamp(34px, 4.8vw, 60px); font-weight: 700; line-height: 1.02; letter-spacing: -0.05em; color: #fff; }
.d-script-q { display: block; color: #9DBDF6; }
.d-script-closer p { margin: 0 auto 30px; max-width: 620px; font-size: 19px; line-height: 1.55; color: #B7C3CE; }
.d-script-cta-big { height: auto; padding: 18px 30px; border-radius: 12px; font-size: 17px; font-weight: 700; box-shadow: 0 0 0 6px rgba(47,111,237,.18), 0 18px 40px rgba(47,111,237,.35); }

/* ── Pie: filete arriba, padding 56/34, columnas 1.55fr / .8fr ── */
.d-script-foot { background: #fff; border-top: 1px solid var(--linea); padding: 56px 0 34px; }
.d-script-foot-top { display: grid; grid-template-columns: 1.55fr .8fr; gap: 40px; }
.d-script-foot-tag { margin-top: 26px; max-width: 460px; font-size: 19px; font-weight: 500; line-height: 1.5; color: var(--tinta); }
.d-script-foot-col { display: flex; flex-direction: column; }
.d-script-foot-h { margin-bottom: 22px; font-size: 14px; font-weight: 500; color: #687886; }
.d-script-foot-col a, .d-script-foot-grid a { margin: 0 0 14px; font-size: 18px; font-weight: 500; color: var(--tinta); }
.d-script-foot-col a:hover, .d-script-foot-grid a:hover, .d-script-foot-bottom a:hover { color: var(--az); }
.d-script-foot-more { margin-top: 64px; }
.d-script-foot-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); column-gap: 40px; }
.d-script-foot-bottom { margin-top: 44px; padding-top: 26px; border-top: 1px solid var(--linea); display: flex; gap: 18px; }
.d-script-foot-bottom a { font-size: 15px; font-weight: 500; color: var(--tinta); }

@keyframes d-script-hl { from { background-position: 0% 0; } to { background-position: -250% 0; } }
@keyframes d-script-cursor { 0%, 48% { opacity: 1; } 49%, 100% { opacity: 0; } }
@keyframes d-script-viaja { 0% { left: 0; } 50% { left: calc(100% - 10px); } 100% { left: 0; } }
@keyframes d-script-lane { from { transform: translateX(0); } to { transform: translateX(-50%); } }
/* el ciclo de 9 s de su tarjeta del paso 3: quieto con el resultado, se borra, se escribe, se aprieta y caen las tres */
@keyframes d-script-sxtype { 0%, 30% { max-width: 100%; opacity: 1; border-right-color: transparent; } 34% { max-width: 100%; opacity: 0; border-right-color: transparent; } 35% { max-width: 0; opacity: 0; border-right-color: #2F6FED; } 37% { max-width: 0; opacity: 1; border-right-color: #2F6FED; animation-timing-function: steps(34, end); } 62% { max-width: 100%; opacity: 1; border-right-color: #2F6FED; } 66%, 100% { max-width: 100%; opacity: 1; border-right-color: transparent; } }
@keyframes d-script-sxsend { 0%, 63% { transform: none; } 65% { transform: scale(.84); } 68%, 100% { transform: none; } }
@keyframes d-script-sxcard { 0%, 30% { opacity: 1; transform: none; } 34%, 68% { opacity: 0; transform: translateY(4cqw) scale(.94); } 76%, 100% { opacity: 1; transform: none; } }

/* ── Computadora (desde 861): las dos columnas con sus filas, la tarjeta del paso 2 pegada y las barras ── */
@media (min-width: 861px) {
  .d-script-sx [data-col="app"] { grid-column: 1; }
  .d-script-sx [data-col="mako"] { grid-column: 3; }
  .d-script-sx .d-script-way { grid-row: 1; }
  .d-script-or { grid-column: 2; grid-row: 1; align-self: center; justify-self: center; }
  .d-script-sx .d-script-r2 { grid-row: 2; }
  .d-script-sx .d-script-r3 { grid-row: 3; }
  .d-script-sx .d-script-r4 { grid-row: 4; }
  .d-script-sx .d-script-r5 { grid-row: 5; }
  .d-script-sx .d-script-r6 { grid-row: 6; }
  .d-script-sx .d-script-ask-track { grid-row: 3 / 6; align-self: stretch; }
  .d-script-pega { position: sticky; top: calc(var(--barra-alto) + 88px); }
  .d-script-sx .d-script-bar-track { display: block; grid-row: 2 / 7; align-self: stretch; position: relative; z-index: 6; pointer-events: none; }
  .d-script-sx .d-script-spine { display: block; grid-column: 2; grid-row: 2 / 7; justify-self: center; align-self: stretch; width: 0; border-left: 2px dashed #CFDDF9; }
  .d-script-sx .d-script-finish { grid-column: 1 / -1; grid-row: 7; margin-top: 20px; }
  .d-script-finish::before, .d-script-finish::after { content: ''; position: absolute; top: -45px; width: 2px; height: 44px; margin-left: -1px; background: linear-gradient(rgba(47,111,237,0), var(--az)); }
  .d-script-finish::before { left: calc((100% - 56px) / 4); }
  .d-script-finish::after { left: calc(100% - (100% - 56px) / 4); }
}

/* ── Mediano ── */
@media (max-width: 1290px) {
  .d-script-wrap { padding: 0 24px; }
  .d-script-ask { margin-left: 24px; margin-right: 24px; }
}
@media (max-width: 1000px) {
  .d-script-ask { padding: 44px 38px 34px; }
  .d-script-iface { margin-top: 90px; }
}

/* ── Teléfono y tableta (hasta 860): una columna, las cabezas lado a lado, la etiqueta en cada tarjeta ── */
@media (max-width: 860px) {
  .d-script-band { padding: 64px 0; }
  .d-script-sx { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); column-gap: 10px; }
  .d-script-sx > * { grid-column: 1 / -1; }
  .d-script-sx [data-hd="app"] { grid-column: 1; grid-row: 1; }
  .d-script-sx [data-hd="mako"] { grid-column: 2; grid-row: 1; }
  .d-script-sx .d-script-or { grid-column: 1 / -1; grid-row: 1; align-self: center; justify-self: center; width: 34px; height: 34px; font-size: 9.5px; }
  .d-script-way { padding: 18px 16px; }
  .d-script-way ul { display: none; }
  .d-script-way h3 { margin: 10px 0 8px; font-size: 18px; line-height: 1.15; }
  .d-script-way > p { margin: 0 0 14px; font-size: 13.5px; line-height: 1.45; flex: 1; }
  .d-script-way .d-script-wt { font-size: 9px; letter-spacing: .1em; }
  .d-script-tag { display: block; }
  .d-script-cc-fila { top: 12cqw; }
  .d-script-dc { padding: 14px 16px 16px; }
  .d-script-dc h4 { font-size: 19px; }
  .d-script-dc p { font-size: 15px; }
  .d-script-finish { flex-direction: column; align-items: stretch; padding: 22px 20px; }
  .d-script-finish p { font-size: 17px; }
  .d-script-faq2 { grid-template-columns: minmax(0, 1fr); gap: 26px; }
  .d-script-ans { padding-right: 0; }
  .d-script-foot-top { grid-template-columns: minmax(0, 1fr); gap: 34px; }
  .d-script-foot-tag, .d-script-foot-col a, .d-script-foot-grid a { font-size: 17px; }
  .d-script-foot-more { margin-top: 40px; }
  .d-script-foot-grid { grid-template-columns: minmax(0, 1fr); }
  .d-script-navlinks, .d-script-login { display: none; }
  .d-script-burger { display: block; }
}

/* ── Teléfono (medido a 390): márgenes de 14, titulares de 34, la demo más chica ── */
@media (max-width: 650px) {
  .d-script-wrap { padding: 0 14px; }
  .d-script-navin { height: 69px; gap: 8px; }
  .d-script-navright { gap: 6px; }
  .d-script-navcta { height: 40px; padding: 0 9px; gap: 5px; font-size: 10px; line-height: 12px; }
  .d-script-navcta .d-script-flecha { width: 11px; height: 11px; }
  .d-script-hero { padding: 55px 0 48px; }
  .d-script-hero-copy { padding: 0 14px; }
  .d-script-eyebrow { max-width: 320px; margin: 0 auto; font-size: 15px; line-height: 1.4; }
  .d-script-h1 { margin: 12px auto 17px; font-size: 34px; line-height: 1.03; letter-spacing: -0.055em; }
  .d-script-hero-sub { font-size: 18px; line-height: 1.45; }
  .d-script-hero-actions { margin-top: 23px; }
  .d-script-hero-actions .d-script-cta { width: 100%; max-width: 360px; }
  .d-script-hero-stats { margin-top: 20px; gap: 6px; }
  .d-script-hero-stat { padding: 6px 11px 6px 7px; gap: 7px; border-radius: 11px; font-size: 11.5px; }
  .d-script-hero-stat i { width: 19px; height: 19px; border-radius: 6px; }
  .d-script-hero-stat svg { width: 11px; height: 11px; }
  .d-script-logos { padding: 24px 14px 26px; }
  .d-script-logos-track { gap: 40px; }
  .d-script-logo { font-size: 23px; gap: 6px; }
  .d-script-ask { min-height: 540px; margin: 36px 10px 0; padding: 28px 20px 26px; border-radius: 19px; background-size: 64px 64px; }
  .d-script-ask-head { grid-template-columns: minmax(0, 1fr); gap: 18px; }
  .d-script-ask-h2 { font-size: 42px; }
  .d-script-ask-copy { font-size: 15px; }
  .d-script-learn { justify-self: start; min-height: 42px; }
  .d-script-iface { margin-top: 70px; }
  .d-script-row { gap: 5px; }
  .d-script-acard { width: 98px; border-radius: 11px; }
  .d-script-acard-brand { padding: 6px; }
  .d-script-acard-logo { width: 15px; height: 15px; }
  .d-script-acard-name { font-size: 8px; }
  .d-script-acard-img { height: 92px; }
  .d-script-prompt { min-height: 94px; padding: 14px; gap: 8px; }
  .d-script-type { font-size: 13px; }
  .d-script-chip { padding: 7px; }
  .d-script-prompt > .d-script-chip span { display: none; }
  .d-script-submit { width: 39px; height: 39px; }
  .d-script-h2 { font-size: 34px; line-height: 1.02; }
  .d-script-closer { padding: 120px 14px 196px; }
}
@media (max-width: 359px) {
  .d-script-sx { column-gap: 8px; }
  .d-script-way { padding: 16px 12px; }
  .d-script-way h3 { font-size: 16px; }
}

@media (prefers-reduced-motion: reduce) {
  .d-script *, .d-script *::before, .d-script *::after { animation: none !important; transition: none !important; }
  .d-script-cta:hover, .d-script-navcta:hover { transform: none; }
}
`;
