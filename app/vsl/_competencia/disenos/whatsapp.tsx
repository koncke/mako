// =============================================================================
// /vsl/whatsapp con el DISEÑO de la portada de Leadsales (https://leadsales.io/), copiado el 11/11/2026 y hecho fiel el 14/11/2026
// =============================================================================
// Los valores (DM Sans, la barra de vidrio flotante, la escala de títulos con su segunda línea en gris, la galería del hero
// con sus pestañas de vidrio, la tabla de chats sueltos contra Leadsales con su columna resaltada, las cuatro piezas con su
// composición sobre degradado, la lista con rayas, la sección oscura de testimonios, las preguntas en dos columnas, el panel
// del cierre con su órbita y el pie lila con la firma gigante) se leyeron con getComputedStyle a 1440 y 390 px:
// docs/diseno/landings-competencia/whatsapp.md. El relevo del 14/11 (capturas, videos, hovers con su tiempo, qué se mueve
// con getAnimations y MutationObserver) está en las notas de la sesión, referencias-landings/whatsapp/relevo.md.
// De MaKo quedan el logo, el azul #2F6FED donde Leadsales pone su violeta (#4145E3), el botón para empezar y los textos.
//
// LO QUE SE MUEVE EN LEADSALES, y cómo va aquí (medido el 14/11: nada aparece al bajar; su JavaScript sólo cambia pestañas,
// corre la pared de logos y pone el video de YouTube):
//   · el brillo que recorre UNA vez el borde de la insignia del hero (4,5 s, ease-in-out) → igual, en CSS;
//   · la galería por pestañas: el clic cambia la pantalla al instante (sin fundido), sólo la elegida lleva su ícono y las
//     otras van separadas por rayitas; su primera pestaña lleva una tarjeta encima → igual, con radios (sin JavaScript). Donde
//     ella pone capturas quietas van PANTALLAS GRABADAS de MaKo (PANTALLA_DE_PESTANA), que corren mientras se ven;
//   · los testimonios: la foto crece a 1,03 al pasar el mouse (,26 s) y el play pone el video EN EL LUGAR (16:9, con
//     «Cerrar video» debajo) → igual, con el video del caso de Mauricio (una casilla y su script: el visor borra los demás);
//   · la órbita del cierre: cuatro canales girando (28 s y 40 s al revés) que se FRENAN con el mouse encima → igual;
//   · las flechas de los links suben 2 px en diagonal (,18 s) y el «+» de las preguntas gira 45° (,18 s) → igual.
//
// Secciones de la referencia que NO van, y por qué:
//   · «+2,800 empresas…» con la pared de logos de sus clientes que corre sola, «Planes desde $97» y «Hemos aparecido en los
//     siguientes medios» (Forbes, Shark Tank): MaKo no tiene ese contenido.
//   · El link «Conoce más de WhatsApp Business API» va como «Conoce las Automations» (/vsl/seguimiento); «Ver en YouTube» y
//     «Ver más casos de éxito», no: no hay a dónde llevarlos.
//   · La frase del pie y su segundo botón («Prueba el CRM 14 días»): el segundo botón de MaKo lleva a «Así funciona».
// Server component: las pestañas son radios con :checked y el video del caso, una casilla; el script chico (data-visor) sólo
// pone a andar el video que se ve.
// =============================================================================

import type { ReactNode } from 'react';
import type { PropsDiseno } from '.';
import type { Bloque } from '../tipos';
import { RUTA_CTA, CASO, EstrellaMaKo, LogoMaKo, TEXTO_CTA, TEXTO_CIERRE, html, otrasFunciones } from '../marca';
import { IconoCanal } from '@/app/chats/iconos-canal';
import type { CanalChat } from '@/lib/chats-tipos';

type Hero = Extract<Bloque, { tipo: 'hero' }>;
type Filas = Extract<Bloque, { tipo: 'filas' }>;
type Contraste = Extract<Bloque, { tipo: 'contraste' }>;
type Tarjetas = Extract<Bloque, { tipo: 'tarjetas' }>;
type Preguntas = Extract<Bloque, { tipo: 'preguntas' }>;

const c = (s: string) => `d-whatsapp-${s}`;
const V = '/vsl-assets/whatsapp';

/**
 * La pantalla de cada pestaña de la galería, por su rótulo (el título de cada fila de ./whatsapp.ts). Son grabaciones de la app
 * REAL con datos de ejemplo (nunca de un cliente), con la cámara acercándose a lo que pasa; el póster es su PRIMER cuadro.
 *   · Conversaciones: la portada (banco C:/dev/bancos-portada/banco-chats, `grabar-corto.mjs`): los cuatro canales y la respuesta
 *     a Tomás por Instagram.
 *   · Borrador de MaKo y Contacto: banco C:/dev/bancos-portada/banco-chats-landing (`grabar.mjs borrador|ficha`).
 *   · Embudo: el CRM de la portada (banco-crm + banco-ficha). Automations: la portada (banco-flujo).
 */
export const PANTALLA_DE_PESTANA: Readonly<Record<string, { video: string; poster: string }>> = {
  Conversaciones: { video: '/vsl-assets/sitio/chats.webm', poster: `${V}/conversaciones.jpg` },
  'Borrador de MaKo': { video: `${V}/borrador.webm`, poster: `${V}/borrador.jpg` },
  Contacto: { video: `${V}/contacto.webm`, poster: `${V}/contacto.jpg` },
  Embudo: { video: '/vsl-assets/sitio/crm-ficha.webm', poster: '/vsl-assets/sitio/crm-ficha.jpg' },
  Automations: { video: '/vsl-assets/sitio/automations.webm', poster: '/vsl-assets/sitio/automations.jpg' },
};

/** El ícono de cada pestaña (sólo la elegida lo muestra, como en la suya). */
const ICO_PESTANA: Record<string, string[]> = {
  Conversaciones: ['M3 21l1.65 -3.8a9 9 0 1 1 3.4 2.9l-5.05 .9'],
  'Borrador de MaKo': ['M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3l5.8 1.9l-5.8 1.9a2 2 0 0 0 -1.3 1.3l-1.9 5.8l-1.9 -5.8a2 2 0 0 0 -1.3 -1.3l-5.8 -1.9l5.8 -1.9a2 2 0 0 0 1.3 -1.3z'],
  Contacto: ['M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0', 'M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2'],
  Embudo: ['M4 4h16v2.172a2 2 0 0 1 -.586 1.414l-4.414 4.414v7l-6 2v-8.5l-4.414 -4.414a2 2 0 0 1 -.586 -1.414v-2.172z'],
  Automations: ['M4 6a2 2 0 1 0 4 0a2 2 0 1 0 -4 0', 'M16 18a2 2 0 1 0 4 0a2 2 0 1 0 -4 0', 'M8 6h5a3 3 0 0 1 3 3v7'],
};

/**
 * La tarjeta que flota sobre la primera pestaña (la suya: «✓ Campaña enviada · Envíos 1.000 · Respuestas 128 · Clics 246»).
 * Sus números son los de la bandeja de EJEMPLO que muestra la grabación (cuatro canales, nueve contactos, tres sin leer):
 * describen la pantalla, no prometen nada.
 */
const TARJETA = {
  titulo: 'Bandeja unificada',
  sub: 'Todos tus canales, juntos',
  cifras: [{ dt: 'Canales', dd: '4' }, { dt: 'Contactos', dd: '9' }, { dt: 'Sin leer', dd: '3' }],
};

/**
 * Las composiciones de las cuatro piezas: recortes FIJOS de pantallas reales (como los recortes de producto de Leadsales), en
 * las ventanas y con la píldora de vidrio de cada una. Las fotos salen de los bancos (C:/dev/bancos-portada/): la hoja de
 * difusión real (banco-difusion-landing), el tablero del CRM (banco-crm), la bandeja y el menú «Posponer hasta»
 * (banco-chats-landing) y Automations (banco-flujo). Las posiciones son las suyas, en % de la composición.
 */
export const RECORTES_DE_PIEZA: readonly { pildora: string; ventanas: readonly { src: string; ancho: number; alto: number }[] }[] = [
  { pildora: 'Desde una columna del CRM', ventanas: [{ src: `${V}/pieza-difusion.jpg`, ancho: 950, alto: 492 }] },
  { pildora: 'Etapa y responsable', ventanas: [{ src: `${V}/pieza-embudo-barra.jpg`, ancho: 634, alto: 66 }, { src: `${V}/pieza-embudo-columnas.jpg`, ancho: 634, alto: 624 }] },
  { pildora: 'Posponer hasta', ventanas: [{ src: `${V}/pieza-pospon-bandeja.jpg`, ancho: 522, alto: 218 }, { src: `${V}/pieza-pospon-menu.jpg`, ancho: 800, alto: 634 }] },
  { pildora: 'Contesta por cada canal', ventanas: [{ src: `${V}/pieza-setter-telefono.jpg`, ancho: 570, alto: 672 }, { src: `${V}/pieza-setter-canales.jpg`, ancho: 418, alto: 60 }] },
];

/** El póster del video del caso (un cuadro de CASO.video, recortado al cuadrado como los suyos). */
export const POSTER_CASO = `${V}/mauricio.jpg`;

/** Los canales que junta Chats, con los íconos de la app (app/chats/iconos-canal.tsx). */
const CANALES: { canal: CanalChat; nombre: string }[] = [
  { canal: 'whatsapp', nombre: 'WhatsApp' }, { canal: 'instagram', nombre: 'Instagram' },
  { canal: 'messenger', nombre: 'Messenger' }, { canal: 'email', nombre: 'Email' },
];

function Ico({ paths, size = 18 }: { paths?: string[]; size?: number }) {
  if (!paths?.length) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths.map((d) => <path key={d} d={d} />)}
    </svg>
  );
}

/** Su flecha «↗» (los botones primarios y los links) y su «→» (los secundarios). */
function Flecha({ size = 14 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17L17 7" /><path d="M8 7h9v9" /></svg>;
}
function FlechaDer({ size = 18 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12h16" /><path d="M14 6l6 6l-6 6" /></svg>;
}

/** Un link de texto con su flecha que sube en diagonal al pasar el mouse. */
function LinkTexto({ href, children, clase }: { href: string; children: ReactNode; clase: string }) {
  return <a href={href} className={clase}>{children}<span className={c('flecha')} aria-hidden="true"><Flecha size={15} /></span></a>;
}

// ── La barra ─────────────────────────────────────────────────────────────────

function Barra() {
  const links = [
    { href: '#d-whatsapp-como', t: 'Así funciona' },
    { href: '#d-whatsapp-funciones', t: 'Funciones' },
    { href: '#d-whatsapp-preguntas', t: 'Preguntas' },
  ];
  return (
    <header className={c('hdr')}>
      <div className={c('hdr-in')}>
        <LogoMaKo className={c('marca')} tamano={28} />
        <div className={c('ctrl')}>
          <nav className={c('links')} aria-label="Secciones">
            {links.map((l) => <a key={l.href} href={l.href} className={c('link')}>{l.t}</a>)}
          </nav>
          <a href="/login" className={c('entrar')}>Entrar</a>
          <a href={RUTA_CTA} className={`${c('btn')} ${c('btn-nav')}`}>{TEXTO_CTA}<Flecha /></a>
        </div>
        <details className={c('menu')}>
          <summary aria-label="Menú"><span className={c('hamb')} aria-hidden="true"><i /><i /><i /></span></summary>
          <div className={c('menu-panel')}>
            {links.map((l) => <a key={l.href} href={l.href} className={c('menu-link')}>{l.t}</a>)}
            <a href="/login" className={c('menu-link')}>Entrar</a>
            <a href={RUTA_CTA} className={`${c('btn')} ${c('btn-menu')}`}>{TEXTO_CTA}<Flecha /></a>
          </div>
        </details>
      </div>
    </header>
  );
}

// ── El hero con su galería por pestañas ─────────────────────────────────────

/** Su insignia de socios (Meta, WhatsApp) con el brillo que la recorre una vez: aquí, los cuatro canales que junta Chats. */
function Insignia({ etiqueta }: { etiqueta: string }) {
  return (
    <div className={c('insignia')} role="note" aria-label={`${etiqueta}: WhatsApp, Instagram, Messenger y email`}>
      <span className={c('marcas')}>
        {CANALES.map((k) => <span key={k.canal} className={c('marca-canal')}><IconoCanal canal={k.canal} size={18} /><span>{k.nombre}</span></span>)}
      </span>
    </div>
  );
}

function Galeria({ filas }: { filas?: Filas }) {
  const pestanas = (filas?.items ?? []).map((f) => ({ etiqueta: f.titulo.replace(/<[^>]+>/g, ''), pie: f.texto }));
  return (
    <div className={c('stage')} id="d-whatsapp-como">
      {filas ? <h2 className={c('sr')}>{filas.titulo.replace(/<[^>]+>/g, '')}</h2> : null}
      <ul className={c('canales')} aria-label="Canales que conectas a MaKo">
        {CANALES.map((k) => <li key={k.canal} className={c('canal')} title={k.nombre}><IconoCanal canal={k.canal} size={22} /></li>)}
      </ul>
      {pestanas.map((p, i) => <input key={p.etiqueta} type="radio" name="d-whatsapp-galeria" id={`d-whatsapp-g${i}`} className={`${c('r')} ${c(`r${i}`)}`} defaultChecked={i === 0} aria-label={p.etiqueta} />)}
      <div className={c('vista')}>
        {pestanas.map((p, i) => {
          const g = PANTALLA_DE_PESTANA[p.etiqueta];
          const figura = (
            <figure className={c('fig')}>
              <div className={c('prev')}>
                <div className={c('lienzo')}>
                  {g ? <video className={c('video')} src={g.video} poster={g.poster} muted loop playsInline preload={i === 0 ? 'metadata' : 'none'} aria-label={p.pie} /> : null}
                </div>
              </div>
              <figcaption className={c('cap')}><span dangerouslySetInnerHTML={html(p.pie)} /></figcaption>
            </figure>
          );
          return (
            <section key={p.etiqueta} className={`${c('pan')} ${c(`pan${i}`)}`} aria-label={p.etiqueta}>
              {i === 0 ? (
                <div className={c('flujo')}>
                  <div className={c('tablero')}>{figura}</div>
                  <aside className={c('tarjeta')}>
                    <div className={c('t-estado')}>
                      <span className={c('t-ok')} aria-hidden="true">✓</span>
                      <div><p className={c('t-titulo')}>{TARJETA.titulo}</p><p className={c('t-sub')}>{TARJETA.sub}</p></div>
                    </div>
                    <dl className={c('t-cifras')}>
                      {TARJETA.cifras.map((x) => <div key={x.dt}><dt>{x.dt}</dt><dd>{x.dd}</dd></div>)}
                    </dl>
                  </aside>
                </div>
              ) : figura}
            </section>
          );
        })}
      </div>
      {/* data-tema-fijo: la pestaña elegida se elige DESPUÉS de que el sol y la luna leyó los colores; su oscuro va escrito aparte. */}
      <div className={c('tabs')} data-tema-fijo="">
        {pestanas.map((p, i) => (
          <label key={p.etiqueta} htmlFor={`d-whatsapp-g${i}`} className={`${c('tab')} ${c(`tab${i}`)}`}>
            <span className={c('tab-ic')}><Ico paths={ICO_PESTANA[p.etiqueta]} /></span>{p.etiqueta}
          </label>
        ))}
      </div>
    </div>
  );
}

function SeccionHero({ b, filas }: { b: Hero; filas?: Filas }) {
  return (
    <section className={c('hero')}>
      <div className={`${c('shell')} ${c('hero-grid')}`}>
        <div className={c('hero-copy')}>
          <Insignia etiqueta={b.etiqueta} />
          <h1 className={c('h1')} dangerouslySetInnerHTML={html(b.titulo)} />
          <p className={c('hero-p')} dangerouslySetInnerHTML={html(b.bajada)} />
          <div className={c('acciones')}>
            <a href={RUTA_CTA} className={`${c('btn')} ${c('btn-hero')}`}>{TEXTO_CTA}<Flecha size={16} /></a>
            <a href="#d-whatsapp-funciones" className={`${c('btn2')} ${c('btn-hero')}`}>Así funciona<FlechaDer /></a>
          </div>
        </div>
        <Galeria filas={filas} />
      </div>
    </section>
  );
}

// ── La tabla: chats sueltos contra Chats de MaKo, una fila por tema ─────────

/** El ícono de cada fila de la tabla (Leadsales: enviar, equipo, robot). */
const ICO_FILAS = [
  ['M10 14l11 -11', 'M21 3l-6.5 18a.55 .55 0 0 1 -1 0l-3.5 -7l-7 -3.5a.55 .55 0 0 1 0 -1l18 -6.5'],
  ['M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0', 'M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2'],
  ['M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3l5.8 1.9l-5.8 1.9a2 2 0 0 0 -1.3 1.3l-1.9 5.8l-1.9 -5.8a2 2 0 0 0 -1.3 -1.3l-5.8 -1.9l5.8 -1.9a2 2 0 0 0 1.3 -1.3z'],
];

function Comparacion({ grupo }: { grupo: Contraste[] }) {
  const [primero] = grupo;
  return (
    <section className={c('cmp-sec')}>
      <div className={c('shell')}>
        <h2 className={c('cmp-h2')} dangerouslySetInnerHTML={html(primero.titulo)} />
        <div className={c('marco')}>
          <div className={c('libro')}>
            <table className={c('tabla')}>
              <colgroup><col className={c('col-tema')} /><col className={c('col-sin')} /><col className={c('col-con')} /></colgroup>
              <thead>
                <tr>
                  <td className={c('th-vacio')} />
                  <th scope="col" className={c('th-sin')} dangerouslySetInnerHTML={html(primero.sin.titulo)} />
                  <th scope="col" className={c('th-con')}><span className={c('th-marca')}>Con <LogoMaKo className={c('th-logo')} tamano={18} /></span></th>
                </tr>
              </thead>
              <tbody>
                {grupo.map((b, i) => (
                  <tr key={b.titulo} className={c('fila')}>
                    <th scope="row" className={c('tema')}>
                      <span className={c('tema-in')}>
                        <span className={c('tema-ic')}><Ico paths={ICO_FILAS[i % ICO_FILAS.length]} /></span>
                        <span dangerouslySetInnerHTML={html(i === 0 && b.etiqueta ? b.etiqueta : b.titulo)} />
                      </span>
                    </th>
                    <td className={c('sin')}>
                      <span className={c('movil')}>En chats sueltos</span>
                      <span dangerouslySetInnerHTML={html(b.sin.texto)} />
                    </td>
                    <td className={c('con')}>
                      <span className={`${c('movil')} ${c('movil-con')}`} dangerouslySetInnerHTML={html(b.con.titulo)} />
                      <span dangerouslySetInnerHTML={html(b.con.texto)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Las cuatro piezas, cada una con su composición sobre degradado ──────────

function Piezas({ b }: { b: Tarjetas }) {
  return (
    <section className={c('piezas-sec')} id="d-whatsapp-funciones">
      <div className={c('shell')}>
        <div className={c('top')}>
          <h2 className={c('h2')} dangerouslySetInnerHTML={html(b.titulo)} />
          {b.bajada ? <p className={c('top-p')} dangerouslySetInnerHTML={html(b.bajada)} /> : null}
        </div>
        <div className={c('piezas')}>
          {b.items.map((it, i) => {
            const r = RECORTES_DE_PIEZA[i % RECORTES_DE_PIEZA.length];
            return (
              <article key={it.titulo} className={c('pieza')}>
                <figure className={`${c('comp')} ${c(`comp${i % 4}`)}`} aria-label={it.meta ?? it.titulo}>
                  {r.ventanas.map((v, j) => (
                    <span key={v.src} className={`${c('ventana')} ${c(`v${j}`)}`}>
                      <img src={v.src} alt="" width={v.ancho} height={v.alto} loading="lazy" decoding="async" />
                    </span>
                  ))}
                  <span className={c('pastilla')}><span className={c('pastilla-ic')}><Ico paths={it.icono} /></span>{r.pildora}</span>
                </figure>
                <div className={c('copy')}>
                  {it.meta ? <p className={c('etiqueta')}><Ico paths={it.icono} size={16} />{it.meta}</p> : null}
                  <h3 className={c('h3')} dangerouslySetInnerHTML={html(it.titulo)} />
                  <p className={c('p')} dangerouslySetInnerHTML={html(it.texto)} />
                </div>
              </article>
            );
          })}
        </div>
        <LinkTexto href="/vsl/seguimiento" clase={c('link-piezas')}>Conoce las Automations</LinkTexto>
      </div>
    </section>
  );
}

// ── «Todo lo que incluye»: la lista con rayas ──────────────────────────────

function Incluye({ b }: { b: Tarjetas }) {
  return (
    <section className={c('incl-sec')}>
      <div className={c('shell')}>
        <div className={c('top')}><h2 className={`${c('h2')} ${c('h2-ancho')}`} dangerouslySetInnerHTML={html(b.titulo)} /></div>
        <ul className={c('lista')}>
          {b.items.map((it) => (
            <li key={it.titulo} className={c('li')}>
              <span className={c('tile')}><Ico paths={it.icono} /></span>
              <span className={c('li-txt')}>
                <strong dangerouslySetInnerHTML={html(it.titulo)} />
                <span dangerouslySetInnerHTML={html(it.texto)} />
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ── El caso de Mauricio, con el tratamiento de sus testimonios ──────────────

function Caso() {
  const numeros = CASO.meses.map((m) => Number(m.monto.replace(/[^0-9]/g, '')));
  const max = Math.max(...numeros);
  return (
    // data-tema-fijo: la banda oscura de sus testimonios (el caso de Mauricio queda igual en los dos modos del sol y la luna).
    <section className={c('caso')} data-tema-fijo="">
      <div className={c('shell')}>
        <h2 className={`${c('h2')} ${c('h2-claro')}`}><span dangerouslySetInnerHTML={html(CASO.titulo)} /> <em>{CASO.sub}</em></h2>
        <ul className={c('testis')}>
          <li className={c('testi-li')}>
            <figure className={c('testi')}>
              {/* El play pone el video en el lugar (16:9) y «Cerrar video» lo saca: una casilla, sin JavaScript para el estado. */}
              <input type="checkbox" id="d-whatsapp-ver" className={c('ver')} aria-label={`Reproducir el video de ${CASO.quien}`} />
              <div className={c('media')}>
                <label htmlFor="d-whatsapp-ver" className={c('play')}>
                  <img className={c('poster')} src={POSTER_CASO} alt="" width={480} height={480} loading="lazy" decoding="async" />
                  <span className={c('play-ic')} aria-hidden="true"><svg viewBox="0 0 68 48" width="68" height="48"><path d="M66.5 7.7c-.8-2.9-3-5.2-5.9-6C55.4.3 34 .3 34 .3S12.6.3 7.4 1.7c-2.9.8-5.1 3.1-5.9 6C.1 13 .1 24 .1 24s0 11 1.4 16.3c.8 2.9 3 5.2 5.9 6C12.6 47.7 34 47.7 34 47.7s21.4 0 26.6-1.4c2.9-.8 5.1-3.1 5.9-6C67.9 35 67.9 24 67.9 24s0-11-1.4-16.3z" fill="#2F6FED" /><path d="M45 24 27 14v20" fill="#fff" /></svg></span>
                </label>
                <video className={c('caso-video')} src={CASO.video} playsInline controls preload="none" aria-label={`${CASO.quien}, en un escenario`} />
              </div>
              <div className={c('controles')}><label htmlFor="d-whatsapp-ver" className={c('cerrar')}>Cerrar video</label></div>
              <blockquote className={c('cita')}><p dangerouslySetInnerHTML={html(CASO.historia[0])} /></blockquote>
              <figcaption className={c('persona')}><strong>{CASO.quien}</strong><span>{CASO.rol}</span></figcaption>
            </figure>
          </li>
          <li className={c('testi-li')}>
            <figure className={c('testi')}>
              <div className={`${c('media')} ${c('media-meses')}`} aria-label="Lo que facturó por mes">
                {CASO.meses.map((m, i) => (
                  <div key={m.mes} className={c('mes')}>
                    <span className={c('mes-v')}>{m.monto}</span>
                    <span className={`${c('mes-barra')} ${i === CASO.meses.length - 1 ? c('mes-oro') : ''}`} style={{ height: `${Math.max(14, Math.round((numeros[i] / max) * 100))}%` }} />
                    <span className={c('mes-l')}>{m.mes}</span>
                  </div>
                ))}
              </div>
              <blockquote className={c('cita')}><p dangerouslySetInnerHTML={html(CASO.resultado)} /></blockquote>
              <figcaption className={c('persona')}><strong>{CASO.quien}</strong><span>{CASO.rol}</span></figcaption>
            </figure>
          </li>
        </ul>
      </div>
    </section>
  );
}

// ── Las preguntas, en dos columnas ──────────────────────────────────────────

function SeccionPreguntas({ b }: { b: Preguntas }) {
  return (
    <section className={`${c('shell')} ${c('faq')}`} id="d-whatsapp-preguntas">
      <div className={c('faq-izq')}>
        <p className={c('chico')}>Antes del siguiente paso</p>
        <h2 className={`${c('h2')} ${c('h2-46')}`} dangerouslySetInnerHTML={html(b.titulo)} />
        <LinkTexto href={RUTA_CTA} clase={c('textlink')}>{TEXTO_CTA}</LinkTexto>
      </div>
      <div className={c('preguntas')}>
        {b.items.map((q) => (
          <details key={q.p} className={c('det')}>
            <summary className={c('sum')}><span dangerouslySetInnerHTML={html(q.p)} /><span className={c('mas')} aria-hidden="true">+</span></summary>
            <p className={c('resp')} dangerouslySetInnerHTML={html(q.r)} />
          </details>
        ))}
      </div>
    </section>
  );
}

// ── El panel del cierre con la órbita de los canales ────────────────────────

function Panel() {
  // Su órbita, leída de su DOM: dos anillos (r 166 y 112 sobre 400) y cuatro plataformas; las de afuera giran 40 s al revés y las
  // de adentro 28 s, con sus retrasos negativos (arrancan repartidas). Con el mouse encima, se frenan.
  const orbitas: { canal: CanalChat; r: number; dur: number; delay: number; inversa: boolean; ang: number }[] = [
    { canal: 'messenger', r: 166, dur: 40, delay: -5, inversa: true, ang: -45 },
    { canal: 'instagram', r: 112, dur: 28, delay: -17.5, inversa: false, ang: 225 },
    { canal: 'email', r: 166, dur: 40, delay: -25, inversa: true, ang: -225 },
    { canal: 'whatsapp', r: 112, dur: 28, delay: -3.5, inversa: false, ang: 45 },
  ];
  return (
    <section className={`${c('shell')} ${c('panel')}`}>
      <div className={c('panel-in')}>
        <div className={c('panel-txt')}>
          <div>
            {/* Su texto del cierre, tal cual (12/11/2026); su «prueba de 14 días» es la de MaKo (TEXTO_CIERRE). */}
            <h2 className={c('panel-h')}>Tu próximo paso: organizar las ventas de tu equipo.</h2>
            <p className={c('panel-p')}>{TEXTO_CIERRE}</p>
          </div>
          <div className={c('acciones-panel')}>
            <a href={RUTA_CTA} className={`${c('btn')} ${c('btn-panel')}`}>{TEXTO_CTA}<Flecha size={16} /></a>
            <a href="#d-whatsapp-como" className={`${c('btn2')} ${c('btn-panel')}`}>Así funciona<FlechaDer /></a>
          </div>
        </div>
        <figure className={c('orbita')} aria-hidden="true">
          <div className={c('lienzo-orbita')}>
            <div className={c('hub')}><span className={c('hub-logo')} aria-label="MaKo"><span className={c('hub-cuadro')}><EstrellaMaKo size={16} /></span>MaKo</span></div>
            <svg className={c('anillo')} viewBox="0 0 400 400"><circle cx="200" cy="200" r="166" /></svg>
            <svg className={c('anillo')} viewBox="0 0 400 400"><circle cx="200" cy="200" r="112" /></svg>
            {orbitas.map((o) => (
              <div key={o.canal} className={`${c('orbitador')} ${o.inversa ? c('orbitador-inv') : ''}`} style={{ ['--d-whatsapp-r' as string]: o.r, ['--d-whatsapp-ang' as string]: `${o.ang}deg`, animationDuration: `${o.dur}s`, animationDelay: `${o.delay}s` }}>
                <span className={c('orbita-ic')}><IconoCanal canal={o.canal} size={26} /></span>
              </div>
            ))}
          </div>
        </figure>
      </div>
    </section>
  );
}

// ── El pie ──────────────────────────────────────────────────────────────────

function Pie({ slug }: { slug: string }) {
  const otras = otrasFunciones(slug);
  const porColumna = Math.ceil(otras.length / 4);
  const columnas = [0, 1, 2, 3].map((i) => otras.slice(i * porColumna, (i + 1) * porColumna)).filter((x) => x.length);
  return (
    <footer className={c('pie')}>
      <div className={c('pie-in')}>
        <div className={c('pie-intro')}>
          <div className={c('ident')}>
            <LogoMaKo tamano={30} />
            <div className={c('contacto')}>
              <span className={c('contacto-l')}>Contacto</span>
              <a href={RUTA_CTA} className={c('contacto-a')}>{TEXTO_CTA}</a>
            </div>
          </div>
        </div>
        <div className={c('grupos')}>
          {columnas.map((col, i) => (
            <section key={i} className={c('grupo')}>
              <h2 className={c('grupo-h')}>{i === 0 ? 'Funciones de MaKo' : ' '}</h2>
              <ul className={c('grupo-ul')}>{col.map((o) => <li key={o.href}><a href={o.href} className={c('grupo-a')}>{o.nombre}</a></li>)}</ul>
            </section>
          ))}
          <section className={c('grupo')}>
            <h2 className={c('grupo-h')}>Tu cuenta</h2>
            <ul className={c('grupo-ul')}><li><a href="/login" className={c('grupo-a')}>Entrar</a></li></ul>
          </section>
        </div>
        <div className={c('bajo')}>
          <p>© 2026 MaKo</p>
          <div className={c('legal')}><a href="/privacidad">Privacidad</a><a href="/terminos">Términos</a></div>
        </div>
      </div>
      <div className={c('firma')} aria-hidden="true">MaKo</div>
    </footer>
  );
}

export default function DisenoWhatsapp({ landing }: PropsDiseno) {
  const bloques = landing.bloques;
  const secciones: ReactNode[] = [];
  for (let i = 0; i < bloques.length; i++) {
    const b = bloques[i];
    if (b.tipo === 'hero') {
      const sig = bloques[i + 1];
      const conFilas = sig?.tipo === 'filas' ? sig : undefined;
      if (conFilas) i++;
      secciones.push(<SeccionHero key={i} b={b} filas={conFilas} />);
    } else if (b.tipo === 'filas') {
      secciones.push(<section key={i} className={`${c('shell')} ${c('filas-sola')}`}><Galeria filas={b} /></section>);
    } else if (b.tipo === 'contraste') {
      const grupo: Contraste[] = [b];
      while (bloques[i + 1]?.tipo === 'contraste') grupo.push(bloques[++i] as Contraste);
      secciones.push(<Comparacion key={i} grupo={grupo} />);
    } else if (b.tipo === 'tarjetas') {
      secciones.push(b.columnas === 2 ? <Piezas key={i} b={b} /> : <Incluye key={i} b={b} />);
    } else if (b.tipo === 'caso') {
      secciones.push(<Caso key={i} />);
    } else if (b.tipo === 'preguntas') {
      secciones.push(<SeccionPreguntas key={i} b={b} />);
    }
  }
  return (
    <div className="d-whatsapp">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <Barra />
      <main>
        {secciones}
        <Panel />
      </main>
      <Pie slug={landing.slug} />
      <script data-visor="" dangerouslySetInnerHTML={{ __html: SCRIPT }} />
    </div>
  );
}

// ── Lo que hace el script (data-visor: el visor de Martín borra los demás <script>) ──
// 1. La galería: el video de la pestaña elegida corre desde el principio mientras la galería se ve; los otros se frenan (sólo el
//    primero se baja de entrada, como en la Spy). Con «reducir movimiento» queda el póster.
// 2. El caso: al tocar el play (la casilla) el video arranca con sonido; «Cerrar video» lo frena y lo vuelve al principio.
const SCRIPT = `(function(){
var P='d-whatsapp',quieto=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
function galeria(){
  var st=document.querySelector('.'+P+'-stage');if(!st)return;
  var ve=false;
  function mostrar(){
    var rs=st.querySelectorAll('.'+P+'-r'),k=-1,i;
    for(i=0;i<rs.length;i++)if(rs[i].checked)k=i;
    var ps=st.querySelectorAll('.'+P+'-pan');
    for(i=0;i<ps.length;i++){var v=ps[i].querySelector('video');if(!v)continue;
      if(i===k&&ve&&!quieto){if(v.preload==='none')v.preload='auto';if(st.__k!==k){try{v.currentTime=0;}catch(e){}}var pr=v.play();if(pr&&pr.catch)pr.catch(function(){});}
      else if(!v.paused)v.pause();}
    st.__k=k;
  }
  st.addEventListener('change',function(e){if(e.target&&e.target.classList.contains(P+'-r'))mostrar();});
  if('IntersectionObserver' in window){new IntersectionObserver(function(es){es.forEach(function(en){ve=en.isIntersecting;mostrar();});},{threshold:0.2}).observe(st);}
  else{ve=true;mostrar();}
}
function caso(){
  var cb=document.getElementById(P+'-ver');if(!cb)return;
  var v=cb.parentNode.querySelector('.'+P+'-caso-video');if(!v)return;
  cb.addEventListener('change',function(){
    if(cb.checked){v.preload='auto';try{v.currentTime=0;}catch(e){}v.muted=false;var pr=v.play();if(pr&&pr.catch)pr.catch(function(){v.muted=true;v.play();});}
    else{v.pause();try{v.currentTime=0;}catch(e){}}
  });
}
function iniciar(){galeria();caso();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',iniciar);else iniciar();
})();`;

// ── Los estilos, con los valores medidos (docs/diseno/landings-competencia/whatsapp.md) ──

const RUIDO = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='g' x='0' y='0' width='100%25' height='100%25' color-interpolation-filters='sRGB'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch' result='n'/%3E%3CfeColorMatrix in='n' values='0 0 0 0 .1 0 0 0 0 .12 0 0 0 0 .32 .42 0 0 0 -.18' result='d'/%3E%3CfeColorMatrix in='n' values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 .5 0 0 -.24' result='l'/%3E%3CfeMerge%3E%3CfeMergeNode in='d'/%3E%3CfeMergeNode in='l'/%3E%3C/feMerge%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E\")";

/** Las pestañas de la galería (hasta seis, como la suya): la pantalla, la pestaña prendida, su ícono y sus rayitas. */
const TABS = Array.from({ length: 6 }, (_, i) => `
.d-whatsapp-r${i}:checked ~ .d-whatsapp-vista .d-whatsapp-pan${i} { display: block; }
.d-whatsapp-r${i}:checked ~ .d-whatsapp-tabs .d-whatsapp-tab${i} { gap: 6px; padding: 8px 13px 8px 10px; font-size: 14.5px; line-height: 18.85px; background-image: linear-gradient(#FFFFFF, rgba(255, 255, 255, .86)); box-shadow: #FFFFFF 0 1px 0 0 inset, rgba(32, 43, 55, .06) 0 0 0 1px, rgba(32, 43, 55, .4) 0 8px 18px -10px; }
.d-whatsapp-r${i}:checked ~ .d-whatsapp-tabs .d-whatsapp-tab${i} .d-whatsapp-tab-ic { display: inline-flex; }
.d-whatsapp-r${i}:checked ~ .d-whatsapp-tabs .d-whatsapp-tab${i}::before, .d-whatsapp-r${i}:checked ~ .d-whatsapp-tabs .d-whatsapp-tab${i + 1}::before { opacity: 0; }
html[data-sitio-modo="oscuro"] .d-whatsapp-r${i}:checked ~ .d-whatsapp-tabs .d-whatsapp-tab${i} { background-image: linear-gradient(rgba(255, 255, 255, .16), rgba(255, 255, 255, .1)); box-shadow: rgba(255, 255, 255, .14) 0 1px 0 0 inset, rgba(0, 0, 0, .3) 0 8px 18px -10px; }
.d-whatsapp-r${i}:focus-visible ~ .d-whatsapp-tabs .d-whatsapp-tab${i} { outline: 2px solid #2F6FED; outline-offset: -3px; }
@media (max-width: 1023px) { .d-whatsapp-r${i}:checked ~ .d-whatsapp-tabs .d-whatsapp-tab${i} { gap: 8px; padding: 8px 22px 8px 18px; font-size: 16px; line-height: 20.8px; } }`).join('');

const BASE = `
@font-face { font-family: 'MaKo DM Sans'; src: url('/vsl-assets/fuentes/dm-sans/dm-sans-latin-var.woff2') format('woff2'); font-weight: 100 1000; font-style: normal; font-display: swap; }
.d-whatsapp { --ink: #202B37; --gris: #637083; --gris2: #414E62; --gris3: #586174; --gris4: #626B7B; --linea: #E4E7EC; --linea-f: #CED2DA; --azul: #2F6FED; --azul-h: #1F57C8; --marino: #12151B; --ruido: ${RUIDO};
  --seccion: clamp(72px, 9vw, 128px); --titulo: clamp(1.875rem, 3.2vw, 2.75rem);
  background: #FFFFFF; color: var(--ink); font-family: 'MaKo DM Sans', 'DM Sans', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif; font-size: 16px; line-height: 1.55; -webkit-font-smoothing: antialiased; overflow-x: clip; }
.d-whatsapp *, .d-whatsapp *::before, .d-whatsapp *::after { box-sizing: border-box; }
.d-whatsapp :where(h1, h2, h3, p, ul, dl, dd, figure, blockquote) { margin: 0; padding: 0; }
.d-whatsapp :where(ul) { list-style: none; }
.d-whatsapp :where(a) { color: inherit; text-decoration: none; }
.d-whatsapp :where(img, video) { display: block; max-width: 100%; }
.d-whatsapp :where(em) { font-style: normal; }
.d-whatsapp-shell { width: min(1152px, calc(100% - 40px)); margin: 0 auto; }
.d-whatsapp-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }

/* ── Botones (su «conversion-actions»: #4145E3 → azul de MaKo; el secundario blanco que se pinta del azul) ── */
.d-whatsapp-btn, .d-whatsapp-btn2 { display: inline-flex; align-items: center; justify-content: center; gap: 12px; min-height: 52px; border: 1px solid transparent; border-radius: 999px; padding: 13px 20px; font-size: 15px; line-height: 21px; font-weight: 700; text-align: center; transition: background .16s, border-color .16s, box-shadow .16s, color .16s; white-space: nowrap; }
.d-whatsapp-btn { background: var(--azul); color: #FFFFFF; border-color: var(--azul); box-shadow: rgba(13, 15, 97, .1) 0 2px 3px 0; }
.d-whatsapp-btn:hover { background: var(--azul-h); border-color: var(--azul-h); box-shadow: rgba(13, 15, 97, .14) 0 4px 10px 0; }
.d-whatsapp-btn2 { background: #FFFFFF; color: var(--ink); border-color: var(--linea-f); }
.d-whatsapp-btn2:hover { background: #F8FAFC; border-color: var(--azul); color: var(--azul); }
.d-whatsapp-btn:focus-visible, .d-whatsapp-btn2:focus-visible { outline: 3px solid var(--azul); outline-offset: 4px; }

/* Los links de texto: la flecha sube 2 px en diagonal en ,18 s */
.d-whatsapp-flecha { display: inline-flex; transition: transform .18s; }
.d-whatsapp-textlink:hover .d-whatsapp-flecha, .d-whatsapp-link-piezas:hover .d-whatsapp-flecha { transform: translate(2px, -2px); }

/* ── La barra de vidrio ── */
.d-whatsapp-hdr { position: sticky; top: 0; z-index: 40; padding: 12px 0 0; height: 80px; }
.d-whatsapp-hdr-in { position: relative; width: min(1200px, calc(100% - 24px)); height: 68px; margin: 0 auto; display: flex; align-items: center; padding: 0 10px 0 26px; border-radius: 999px; border: 1px solid rgba(255, 255, 255, .75); background-image: linear-gradient(rgba(255, 255, 255, .8), rgba(255, 255, 255, .66)); box-shadow: rgba(255, 255, 255, .9) 0 1px 0 0 inset, rgba(32, 43, 55, .07) 0 0 0 1px, rgba(32, 43, 55, .3) 0 12px 32px -18px; -webkit-backdrop-filter: blur(18px) saturate(1.7); backdrop-filter: blur(18px) saturate(1.7); }
.d-whatsapp-marca { flex: none; }
.d-whatsapp-marca span:last-child { font-size: 22px !important; letter-spacing: -1.08px !important; }
.d-whatsapp-ctrl { display: flex; align-items: center; justify-content: flex-end; gap: 20px; margin-left: 30px; flex: 1; }
.d-whatsapp-links { display: flex; gap: 4px; margin-right: auto; }
.d-whatsapp-link { display: inline-flex; align-items: center; padding: 12px 13px; border-radius: 999px; font-size: 14px; line-height: 18.2px; font-weight: 500; color: #262B35; }
.d-whatsapp-link:hover { background: #F4F3F8; }
.d-whatsapp-entrar { font-size: 14px; line-height: 22.4px; color: #262B35; padding: 12px 0; }
.d-whatsapp-entrar:hover { color: var(--azul-h); }
.d-whatsapp-btn-nav { min-height: 44px; padding: 11px 17px; font-size: 14px; line-height: 22.4px; font-weight: 550; gap: 17px; box-shadow: rgba(43, 36, 120, .1) 0 2px 4px 0; }
.d-whatsapp-menu { display: none; margin-left: auto; position: static; }
.d-whatsapp-menu summary { list-style: none; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; cursor: pointer; border-radius: 999px; transition: background .15s; }
.d-whatsapp-menu summary:hover, .d-whatsapp-menu[open] summary { background: #F4F3F8; }
.d-whatsapp-menu summary::-webkit-details-marker { display: none; }
.d-whatsapp-hamb { display: flex; flex-direction: column; gap: 4px; }
.d-whatsapp-hamb i { display: block; width: 18px; height: 2px; border-radius: 2px; background: #262B35; }
.d-whatsapp-menu-panel { position: absolute; left: 0; right: 0; top: calc(100% + 8px); background: #FFFFFF; border: 1px solid #E4E1ED; border-radius: 24px; box-shadow: rgba(40, 33, 81, .32) 0 24px 48px -24px; padding: 18px 20px 26px; display: flex; flex-direction: column; }
.d-whatsapp-menu-link { min-height: 54px; padding: 14px 8px; font-size: 18px; line-height: 23.4px; font-weight: 500; color: #262B35; border-bottom: 1px solid #EFEDF4; }
.d-whatsapp-btn-menu { margin-top: 22px; min-height: 48px; }

/* ── Hero ── */
.d-whatsapp-hero { padding: clamp(40px, 4vw, 56px) 0 44px; background: #FFFFFF; }
.d-whatsapp-hero-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 28px; }
.d-whatsapp-hero-copy { min-width: 0; }
/* Su insignia: el borde en degradado y el brillo que la recorre una vez (partnerEdgeSheen, 4,5 s) */
.d-whatsapp-insignia { position: relative; display: flex; align-items: center; width: fit-content; max-width: 100%; margin: 0 0 18px; padding: 10px 18px; border-radius: 999px; border: 1px solid transparent; background: linear-gradient(115deg, #FFFFFF 45%, #FBFDFC) padding-box, linear-gradient(110deg, #9CBCE8, #E3E5EC 24%, #E3E5EC 78%, #DCE9E2) border-box; box-shadow: #FFFFFF 0 1px 0 0 inset; }
.d-whatsapp-insignia::before { content: ''; position: absolute; inset: -1px; border-radius: inherit; padding: 1px; pointer-events: none; background: linear-gradient(110deg, transparent 38%, rgba(47, 111, 237, .35) 49%, rgba(130, 193, 245, .2) 53%, transparent 64%); background-size: 250% 100%; background-position: 160% 0; -webkit-mask: linear-gradient(#FFF 0 0) content-box, linear-gradient(#FFF 0 0); -webkit-mask-composite: xor; mask: linear-gradient(#FFF 0 0) content-box, linear-gradient(#FFF 0 0); mask-composite: exclude; animation: d-whatsapp-brillo 4.5s ease-in-out 1 both; }
@keyframes d-whatsapp-brillo { to { background-position: -60% 0; } }
.d-whatsapp-marcas { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 22px; min-width: 0; }
.d-whatsapp-marca-canal { position: relative; display: inline-flex; align-items: center; gap: 6px; font-size: 13.5px; line-height: 24px; font-weight: 600; letter-spacing: -.01em; color: #3A4552; white-space: nowrap; }
/* La insignia es una caja chica con un degradado de tono medio: el sol y la luna la trata como un botón y NO cambia su letra (que
   quedaba oscura sobre el fondo ya oscuro). Su oscuro va escrito. */
html[data-sitio-modo="oscuro"] .d-whatsapp-marca-canal { color: #DCE1EA; }
.d-whatsapp-marca-canal + .d-whatsapp-marca-canal::before { content: ''; position: absolute; top: 4px; left: -11px; width: 1px; height: 16px; background: #E4E7ED; }
.d-whatsapp-h1 { margin-top: 0; font-size: clamp(2.25rem, 4.15vw, 3.625rem); line-height: 1.08; font-weight: 700; letter-spacing: -.04em; color: var(--ink); text-wrap: balance; }
.d-whatsapp-hero-p { margin-top: 16px; font-size: clamp(1.125rem, 1.7vw, 1.5rem); line-height: 1.45; letter-spacing: -.02em; color: var(--gris); text-wrap: pretty; }
.d-whatsapp-hero-p strong { color: var(--ink); font-weight: 600; }
.d-whatsapp-acciones { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-top: 24px; }

/* La galería (su product-gallery, data-presentation=hero): grilla con la vista arriba y las pestañas abajo */
.d-whatsapp-stage { position: relative; display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; padding: 16px; border-radius: 24px; border: 1px solid rgba(255, 255, 255, .8);
  background-image: var(--ruido), radial-gradient(38% 44% at 100% 0%, rgba(201, 218, 251, .6), rgba(0, 0, 0, 0) 70%), radial-gradient(40% 44% at 94% 64%, rgba(165, 196, 245, .45), rgba(0, 0, 0, 0) 70%), radial-gradient(40% 36% at 0% 100%, rgba(201, 218, 251, .4), rgba(0, 0, 0, 0) 70%), radial-gradient(80% 50% at 50% 100%, rgba(47, 111, 237, .14), rgba(0, 0, 0, 0) 75%), linear-gradient(#FFFFFF, #FDFDFF 42%, #F5F6FD);
  background-size: 160px auto, auto, auto, auto, auto, auto;
  box-shadow: rgba(255, 255, 255, .95) 0 1px 0 0 inset, rgba(47, 111, 237, .07) 0 0 0 1px, rgba(32, 43, 55, .16) 0 18px 40px -16px; scroll-margin-top: 100px; }
.d-whatsapp-canales { position: absolute; top: -18px; right: clamp(16px, 3vw, 32px); display: flex; gap: 8px; z-index: 2; }
.d-whatsapp-canal { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 50%; background: #FFFFFF; border: 1px solid var(--linea); box-shadow: rgba(32, 43, 55, .45) 0 10px 22px -12px; }
.d-whatsapp-r { position: absolute; opacity: 0; width: 1px; height: 1px; pointer-events: none; }
.d-whatsapp-vista { position: relative; min-width: 0; container-type: inline-size; }
.d-whatsapp-pan { display: none; min-width: 0; }
.d-whatsapp-flujo { position: relative; display: grid; grid-template-columns: minmax(0, 1fr); align-items: start; isolation: isolate; }
.d-whatsapp-tablero { grid-area: 1 / 1; min-width: 0; margin-left: 17%; }
.d-whatsapp-fig { margin: 0; padding: 6px 6px 0; border: 1px solid var(--linea); border-radius: 18px; background: #FFFFFF; box-shadow: rgba(32, 43, 55, .04) 0 2px 4px 0, rgba(32, 43, 55, .08) 0 16px 40px 0; }
.d-whatsapp-prev { overflow: hidden; border-radius: 12px 12px 0 0; background: #F8FAFC; }
.d-whatsapp-lienzo { display: grid; align-items: center; width: 100%; aspect-ratio: 16 / 10; background: #F8FAFC; }
.d-whatsapp-video { width: 100%; height: 100%; object-fit: cover; object-position: top; }
.d-whatsapp-cap { display: flex; align-items: center; gap: 12px; margin-top: 10px; padding: 10px 14px; border-top: 1px solid var(--linea); font-size: 14px; line-height: 1.4; font-weight: 500; color: var(--gris2); }
.d-whatsapp-tarjeta { position: relative; grid-area: 1 / 1; z-index: 1; width: 336px; max-width: 42%; margin-top: 40px; padding: 22px; border: 1px solid var(--linea); border-radius: 20px; background: #FFFFFF; box-shadow: rgba(32, 43, 55, .28) 0 24px 56px -24px, rgba(32, 43, 55, .06) 0 4px 12px 0; }
.d-whatsapp-t-estado { display: flex; align-items: center; gap: 12px; }
.d-whatsapp-t-ok { display: grid; flex: 0 0 36px; width: 36px; height: 36px; place-items: center; border-radius: 50%; background: #E8F6EE; color: #287550; font-size: 20px; line-height: 1; }
.d-whatsapp-t-titulo { font-size: 16px; line-height: 1.4; font-weight: 700; color: var(--ink); }
.d-whatsapp-t-sub { margin-top: 2px; font-size: 12px; line-height: 1.4; color: var(--gris); }
.d-whatsapp-t-cifras { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1.25fr) minmax(0, 1fr); gap: 8px; margin: 22px 0 0; }
.d-whatsapp-t-cifras > div + div { padding-left: 8px; border-left: 1px solid var(--linea); }
.d-whatsapp-t-cifras dt { font-size: 11px; line-height: 1.5; color: var(--gris); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.d-whatsapp-t-cifras dd { margin: 2px 0 0; font-size: clamp(22px, 2.1vw, 28px); line-height: 1.1; font-weight: 500; letter-spacing: -.04em; color: var(--ink); }
.d-whatsapp-t-cifras > div:not(:first-child) dd { color: var(--azul); }
/* Sus pestañas de vidrio: rayitas entre las no elegidas, el ícono sólo en la elegida, el hover al 60 % de blanco en ,14 s */
.d-whatsapp-tabs { display: flex; gap: 2px; justify-self: center; max-width: 100%; min-width: 0; padding: 4px; overflow-x: auto; border: 1px solid rgba(255, 255, 255, .75); border-radius: 999px; background-image: linear-gradient(rgba(255, 255, 255, .62), rgba(255, 255, 255, .34)); box-shadow: rgba(255, 255, 255, .9) 0 1px 0 0 inset, rgba(47, 111, 237, .08) 0 0 0 1px, rgba(32, 43, 55, .3) 0 10px 28px -14px; -webkit-backdrop-filter: blur(18px) saturate(1.7); backdrop-filter: blur(18px) saturate(1.7); scrollbar-width: none; }
.d-whatsapp-tabs::-webkit-scrollbar { display: none; }
.d-whatsapp-tab { position: relative; display: flex; flex: 0 0 auto; align-items: center; min-height: 40px; padding: 8px 20px; border-radius: 999px; font-size: 15px; line-height: 1.3; font-weight: 500; color: var(--ink); white-space: nowrap; cursor: pointer; transition: color .14s, background-color .14s, box-shadow .14s; }
.d-whatsapp-tab + .d-whatsapp-tab::before { content: ''; position: absolute; top: 50%; left: -2px; width: 1px; height: 18px; background: #D9DCE4; transform: translateY(-50%); }
.d-whatsapp-tab:hover { background-color: rgba(255, 255, 255, .6); }
.d-whatsapp-tab-ic { display: none; color: var(--azul); }
html[data-sitio-modo="oscuro"] .d-whatsapp-tabs { background-image: linear-gradient(rgba(255, 255, 255, .08), rgba(255, 255, 255, .04)); border-color: rgba(255, 255, 255, .12); box-shadow: rgba(255, 255, 255, .06) 0 1px 0 0 inset, rgba(0, 0, 0, .4) 0 10px 28px -14px; }
html[data-sitio-modo="oscuro"] .d-whatsapp-tab { color: #E8EAF0; }
html[data-sitio-modo="oscuro"] .d-whatsapp-tab:hover { background-color: rgba(255, 255, 255, .08); }
html[data-sitio-modo="oscuro"] .d-whatsapp-tab + .d-whatsapp-tab::before { background: rgba(255, 255, 255, .16); }
html[data-sitio-modo="oscuro"] .d-whatsapp-tab-ic { color: #8FB0F5; }

/* ── La tabla ── */
.d-whatsapp-cmp-sec { padding: var(--seccion) 0; border-bottom: 1px solid var(--linea); background: #FFFFFF; }
.d-whatsapp-cmp-h2 { max-width: 960px; margin: 0 auto; text-align: center; font-size: var(--titulo); line-height: 1.16; font-weight: 600; letter-spacing: -.035em; color: var(--ink); text-wrap: balance; }
.d-whatsapp-cmp-h2 em { display: block; color: var(--azul); }
.d-whatsapp-marco { margin-top: 48px; border-radius: 30px; border: 1px solid rgba(255, 255, 255, .8); padding: 12px 12px 12px clamp(20px, 3.5vw, 48px);
  background-image: var(--ruido), radial-gradient(55% 75% at 100% 100%, rgba(201, 218, 251, .55), rgba(0, 0, 0, 0) 70%), radial-gradient(45% 60% at 0% 0%, rgba(255, 255, 255, .8), rgba(0, 0, 0, 0) 70%), linear-gradient(125deg, #F8F8FF, #F1F2FD);
  background-size: 160px auto, auto, auto, auto;
  box-shadow: rgba(255, 255, 255, .95) 0 1px 0 0 inset, rgba(47, 111, 237, .07) 0 0 0 1px, rgba(32, 43, 55, .16) 0 18px 40px -16px; }
.d-whatsapp-libro { position: relative; isolation: isolate; }
.d-whatsapp-libro::before { content: ''; position: absolute; top: 0; bottom: 0; right: 0; z-index: -1; width: 39%; border-radius: 18px; border: 1px solid rgba(255, 255, 255, .8); box-shadow: #FFFFFF 0 1px 0 0 inset;
  background-image: var(--ruido), radial-gradient(70% 40% at 100% 0%, rgba(247, 208, 120, .26), rgba(0, 0, 0, 0) 70%), radial-gradient(80% 45% at 0% 100%, rgba(47, 111, 237, .2), rgba(0, 0, 0, 0) 70%), linear-gradient(#EEF4FF, #DCE7FD);
  background-size: 160px auto, auto, auto, auto; }
/* El sol y la luna no ve los ::before: la columna resaltada lleva su oscuro escrito (en oscuro su texto pasa a claro). */
html[data-sitio-modo="oscuro"] .d-whatsapp-libro::before { border-color: rgba(255, 255, 255, .1); box-shadow: rgba(255, 255, 255, .06) 0 1px 0 0 inset;
  background-image: var(--ruido), radial-gradient(70% 40% at 100% 0%, rgba(247, 208, 120, .12), rgba(0, 0, 0, 0) 70%), radial-gradient(80% 45% at 0% 100%, rgba(47, 111, 237, .3), rgba(0, 0, 0, 0) 70%), linear-gradient(#18213A, #111A2E); }
.d-whatsapp-tabla { width: 100%; border-collapse: collapse; table-layout: fixed; text-align: left; }
.d-whatsapp-col-tema { width: 25%; } .d-whatsapp-col-con { width: 39%; }
.d-whatsapp-tabla thead td, .d-whatsapp-tabla thead th { padding: 26px 32px 16px 0; font-size: 14px; line-height: 1.55; font-weight: 500; color: var(--gris2); text-align: left; vertical-align: bottom; }
.d-whatsapp-tabla thead .d-whatsapp-th-con { padding: 26px 28px 16px; color: var(--marino); }
.d-whatsapp-th-marca { display: flex; align-items: center; gap: 7px; font-size: 15px; color: var(--gris2); }
.d-whatsapp-th-logo span:last-child { font-size: 13px !important; }
/* Las rayas van OPACAS (#DFE1E8 es su rgba(32,43,55,.1) sobre el marco): el sol y la luna lleva al modo los bordes oscuros y
   transparentes, y el claro las borraba (docs/hallazgos-landing.md, AI Avatar). */
.d-whatsapp-tema, .d-whatsapp-sin, .d-whatsapp-con { padding: 28px 32px 28px 0; border-top: 1px solid #DFE1E8; font-size: 17px; line-height: 1.55; vertical-align: top; text-align: left; }
.d-whatsapp-tema { font-size: 16px; font-weight: 500; color: var(--marino); }
.d-whatsapp-tema-in { display: flex; align-items: flex-start; gap: 12px; }
.d-whatsapp-tema-ic { flex: none; display: grid; place-items: center; width: 34px; height: 34px; margin-top: -5px; border-radius: 10px; background: rgba(255, 255, 255, .78); border: 1px solid rgba(47, 111, 237, .18); color: var(--azul); }
.d-whatsapp-sin { color: var(--gris2); }
.d-whatsapp-sin strong { font-weight: 600; color: var(--ink); }
.d-whatsapp-con { padding-inline: 28px; border-top-color: rgba(255, 255, 255, .85); font-weight: 500; color: var(--ink); }
.d-whatsapp-con a { color: var(--azul); text-decoration: underline; text-underline-offset: 3px; }
.d-whatsapp-movil { display: none; }

/* ── Encabezados de sección: dos tonos ── */
.d-whatsapp-top { display: flex; justify-content: space-between; align-items: flex-end; gap: 48px; margin-bottom: clamp(40px, 4.5vw, 64px); }
.d-whatsapp-h2 { max-width: 560px; font-size: var(--titulo); line-height: 1.08; font-weight: 700; letter-spacing: -.035em; color: var(--ink); text-wrap: balance; }
.d-whatsapp-h2 em { display: block; color: var(--gris); }
.d-whatsapp-h2-ancho { max-width: 804px; }
.d-whatsapp-top-p { max-width: 340px; font-size: 17px; line-height: 1.55; color: var(--gris2); }

/* ── Las cuatro piezas (su product-composition: ventanas con recortes del producto y una píldora de vidrio) ── */
.d-whatsapp-piezas-sec { padding: var(--seccion) 0; scroll-margin-top: 80px; }
.d-whatsapp-piezas { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: clamp(56px, 5vw, 72px) 32px; }
.d-whatsapp-pieza { display: flex; flex-direction: column; gap: 24px; min-width: 0; }
.d-whatsapp-comp { position: relative; min-width: 0; margin: 0; aspect-ratio: 1.5; overflow: hidden; border-radius: 28px; border: 1px solid rgba(255, 255, 255, .8); background-size: 160px auto, auto, auto, auto, auto;
  box-shadow: rgba(255, 255, 255, .95) 0 1px 0 0 inset, rgba(47, 111, 237, .07) 0 0 0 1px, rgba(32, 43, 55, .16) 0 18px 40px -16px; }
.d-whatsapp-comp0 { background-image: var(--ruido), radial-gradient(60% 75% at 100% 100%, rgba(247, 208, 120, .62), rgba(0, 0, 0, 0) 70%), radial-gradient(60% 75% at 0% 100%, rgba(47, 111, 237, .55), rgba(0, 0, 0, 0) 70%), radial-gradient(45% 55% at 85% 0%, rgba(169, 193, 251, .45), rgba(0, 0, 0, 0) 70%), linear-gradient(#FAFCFF, #EAF1FE 45%, #CFDFFC); }
.d-whatsapp-comp1 { background-image: var(--ruido), radial-gradient(65% 75% at 0% 100%, rgba(125, 162, 247, .6), rgba(0, 0, 0, 0) 70%), radial-gradient(60% 75% at 100% 100%, rgba(47, 111, 237, .48), rgba(0, 0, 0, 0) 70%), radial-gradient(45% 55% at 90% 0%, rgba(201, 218, 251, .5), rgba(0, 0, 0, 0) 70%), linear-gradient(#FAFBFF, #EAF1FE 45%, #D3E0FC); }
.d-whatsapp-comp2 { background-image: var(--ruido), radial-gradient(60% 72% at 100% 0%, rgba(247, 208, 120, .62), rgba(0, 0, 0, 0) 70%), radial-gradient(65% 80% at 0% 100%, rgba(47, 111, 237, .5), rgba(0, 0, 0, 0) 70%), radial-gradient(50% 45% at 100% 100%, rgba(150, 175, 250, .38), rgba(0, 0, 0, 0) 70%), linear-gradient(#FAFCFF, #EAF1FE 50%, #CFDFFC); }
.d-whatsapp-comp3 { background-image: var(--ruido), radial-gradient(70% 80% at 100% 100%, rgba(47, 111, 237, .52), rgba(0, 0, 0, 0) 70%), radial-gradient(50% 65% at 0% 80%, rgba(201, 218, 251, .62), rgba(0, 0, 0, 0) 70%), radial-gradient(45% 40% at 45% 100%, rgba(140, 170, 248, .35), rgba(0, 0, 0, 0) 70%), linear-gradient(#FBFBFF, #EAF1FE 45%, #CFDFFC); }
.d-whatsapp-ventana { position: absolute; overflow: hidden; border: 1px solid #E6E8EE; border-radius: 14px; background: #FFFFFF; box-shadow: rgba(32, 43, 55, .05) 0 2px 4px 0, rgba(32, 43, 55, .38) 0 24px 48px -24px; }
.d-whatsapp-ventana img { width: 100%; height: auto; }
.d-whatsapp-comp0 .d-whatsapp-v0 { top: 6%; left: 6%; width: 88%; }
.d-whatsapp-comp1 .d-whatsapp-v0 { top: 9%; left: 7%; width: 112%; }
.d-whatsapp-comp1 .d-whatsapp-v1 { top: 28%; left: 7%; width: 60%; }
.d-whatsapp-comp2 .d-whatsapp-v0 { top: 12%; left: 6%; width: 50%; }
.d-whatsapp-comp2 .d-whatsapp-v1 { top: 30%; right: 6%; width: 46%; }
.d-whatsapp-comp3 .d-whatsapp-v0 { top: 8%; right: 6%; width: 40%; }
/* La tira de canales va a 44 % (la suya, a 36 %): a 36 % tapaba la respuesta de Tomás en el teléfono. */
.d-whatsapp-comp3 .d-whatsapp-v1 { top: 44%; left: 6%; width: 56%; }
.d-whatsapp-pastilla { position: absolute; z-index: 1; display: inline-flex; align-items: center; gap: 10px; padding: 10px 18px 10px 14px; border-radius: 999px; border: 1px solid rgba(255, 255, 255, .85); background-image: linear-gradient(rgba(255, 255, 255, .9), rgba(255, 255, 255, .68)); box-shadow: #FFFFFF 0 1px 0 0 inset, rgba(47, 111, 237, .08) 0 0 0 1px, rgba(32, 43, 55, .42) 0 14px 30px -14px; -webkit-backdrop-filter: blur(14px) saturate(1.6); backdrop-filter: blur(14px) saturate(1.6); font-size: 15px; line-height: 1.2; font-weight: 500; color: var(--ink); white-space: nowrap; }
.d-whatsapp-comp0 .d-whatsapp-pastilla { bottom: 5%; left: 6%; }
.d-whatsapp-comp1 .d-whatsapp-pastilla { top: 44%; right: 6%; }
.d-whatsapp-comp2 .d-whatsapp-pastilla { bottom: 9%; left: 6%; }
.d-whatsapp-comp3 .d-whatsapp-pastilla { bottom: 12%; left: 6%; }
.d-whatsapp-comp1 .d-whatsapp-pastilla, .d-whatsapp-comp3 .d-whatsapp-pastilla { background-image: linear-gradient(rgba(236, 242, 255, .94), rgba(222, 233, 254, .82)); color: var(--marino); }
.d-whatsapp-pastilla-ic { display: inline-flex; color: var(--azul); }
.d-whatsapp-copy { min-width: 0; }
.d-whatsapp-etiqueta { display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px 6px 10px; border-radius: 999px; background: rgba(255, 255, 255, .78); border: 1px solid rgba(47, 111, 237, .18); font-size: 13px; line-height: 1.35; font-weight: 500; color: var(--marino); }
.d-whatsapp-etiqueta svg { color: var(--azul); }
.d-whatsapp-h3 { margin-top: 16px; font-size: clamp(22px, 2.2vw, 28px); line-height: 1.15; font-weight: 700; letter-spacing: -.03em; color: var(--ink); text-wrap: balance; }
.d-whatsapp-p { margin-top: 12px; max-width: 48ch; font-size: 16px; line-height: 1.55; color: var(--gris2); }
.d-whatsapp-p a, .d-whatsapp-resp a { color: var(--azul); text-decoration: underline; text-underline-offset: 3px; }
.d-whatsapp-link-piezas, .d-whatsapp-textlink { display: inline-flex; align-items: center; gap: 14px; min-height: 44px; margin-top: 32px; font-size: 14px; line-height: 1.55; font-weight: 500; color: var(--azul); transition: color .16s; }
.d-whatsapp-link-piezas:hover, .d-whatsapp-textlink:hover { color: var(--azul-h); }

/* ── «Todo lo que incluye» ── */
.d-whatsapp-incl-sec { padding: calc(var(--seccion) / 2) 0; }
.d-whatsapp-lista { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px 32px; }
.d-whatsapp-li { display: flex; align-items: flex-start; gap: 14px; padding: 16px 0; border-top: 1px solid var(--linea); }
.d-whatsapp-tile { flex: none; display: grid; place-items: center; width: 36px; height: 36px; border-radius: 10px; border: 1px solid #DCE7FC; background-image: linear-gradient(145deg, #F4F8FF, #E3ECFE); color: var(--azul); }
.d-whatsapp-li-txt { display: grid; gap: 2px; min-width: 0; }
.d-whatsapp-li-txt strong { font-size: 15px; line-height: 1.35; font-weight: 600; color: var(--ink); }
.d-whatsapp-li-txt > span { font-size: 14px; line-height: 1.45; color: var(--gris2); }

/* ── El caso: su sección oscura de testimonios ── */
.d-whatsapp-caso { background: #12141C; color: #FFFFFF; padding: var(--seccion) 0; }
.d-whatsapp-h2-claro { max-width: 900px; margin-bottom: clamp(40px, 4.5vw, 64px); color: #FFFFFF; }
.d-whatsapp-h2-claro em { color: #A2A7B6; }
.d-whatsapp-testis { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: clamp(32px, 4vw, 48px) clamp(16px, 2.5vw, 32px); }
.d-whatsapp-testi-li { display: flex; min-width: 0; }
.d-whatsapp-testi { position: relative; display: flex; flex: 1; flex-direction: column; gap: 16px; min-width: 0; }
.d-whatsapp-ver { position: absolute; opacity: 0; width: 1px; height: 1px; pointer-events: none; }
.d-whatsapp-media { position: relative; width: 100%; min-width: 0; aspect-ratio: 1; overflow: hidden; border-radius: 18px; background: #000000; }
.d-whatsapp-play { position: absolute; inset: 0; display: grid; place-items: center; cursor: pointer; }
.d-whatsapp-poster { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transition: transform .26s ease; }
.d-whatsapp-play:hover .d-whatsapp-poster { transform: scale(1.03); }
.d-whatsapp-play-ic { position: relative; display: block; width: 68px; height: 48px; filter: drop-shadow(0 6px 14px rgba(0, 0, 0, .35)); }
.d-whatsapp-play-ic svg { display: block; width: 100%; height: 100%; }
.d-whatsapp-ver:focus-visible ~ .d-whatsapp-media .d-whatsapp-play { outline: 3px solid #C9D9FF; outline-offset: -3px; }
.d-whatsapp-caso-video { display: none; position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; background: #000000; }
.d-whatsapp-controles { display: none; justify-content: flex-end; margin-top: -6px; }
.d-whatsapp-cerrar { display: inline-flex; align-items: center; min-height: 36px; padding: 6px 14px; border: 1px solid rgba(255, 255, 255, .3); border-radius: 999px; font-size: 13px; color: #FFFFFF; cursor: pointer; }
.d-whatsapp-ver:checked ~ .d-whatsapp-media { aspect-ratio: 16 / 9; min-height: 200px; }
.d-whatsapp-ver:checked ~ .d-whatsapp-media .d-whatsapp-play { display: none; }
.d-whatsapp-ver:checked ~ .d-whatsapp-media .d-whatsapp-caso-video { display: block; }
.d-whatsapp-ver:checked ~ .d-whatsapp-controles { display: flex; }
.d-whatsapp-media-meses { display: flex; align-items: flex-end; justify-content: center; gap: 22px; padding: 36px 36px 28px; background: radial-gradient(80% 60% at 50% 100%, rgba(47, 111, 237, .35), rgba(0, 0, 0, 0) 70%), #000000; }
.d-whatsapp-mes { height: 100%; flex: 1 1 0; max-width: 72px; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; gap: 10px; }
.d-whatsapp-mes-barra { width: 100%; border-radius: 12px 12px 4px 4px; background: linear-gradient(#5B8CF0, #2F6FED); }
.d-whatsapp-mes-oro { background: linear-gradient(#F7D078, #F2B01E); }
.d-whatsapp-mes-v { font-size: 16px; line-height: 19.6px; font-weight: 700; color: #FFFFFF; }
.d-whatsapp-mes-l { font-size: 13px; line-height: 18.2px; color: #A2A7B6; }
.d-whatsapp-cita { margin-top: 4px; }
.d-whatsapp-cita p { font-size: clamp(16px, 1.4vw, 18px); line-height: 1.5; color: #FFFFFF; text-wrap: pretty; }
.d-whatsapp-cita strong { font-weight: 600; }
.d-whatsapp-persona { display: grid; gap: 2px; margin-top: auto; font-size: 14px; line-height: 1.4; color: #A2A7B6; }
.d-whatsapp-persona strong { font-weight: 600; color: #FFFFFF; }

/* ── Preguntas ── */
.d-whatsapp-faq { display: grid; grid-template-columns: .9fr 1.1fr; gap: 65px; padding-block: 110px; scroll-margin-top: 80px; }
.d-whatsapp-chico { display: flex; align-items: center; gap: 9px; font-size: 14px; color: var(--gris2); }
.d-whatsapp-h2-46 { margin: 22px 0; font-size: clamp(32px, 3.7vw, 46px); max-width: none; }
.d-whatsapp-textlink { margin-top: 0; gap: 18px; }
.d-whatsapp-det { padding: 22px 0; border-bottom: 1px solid var(--linea); }
.d-whatsapp-det:first-child { border-top: 1px solid var(--linea); }
.d-whatsapp-sum { display: flex; justify-content: space-between; align-items: center; gap: 22px; list-style: none; cursor: pointer; font-size: 16px; line-height: 1.45; font-weight: 500; color: var(--ink); }
.d-whatsapp-sum::-webkit-details-marker { display: none; }
.d-whatsapp-mas { flex: none; font-size: 24px; line-height: 1; font-weight: 400; color: var(--gris); transition: transform .18s; }
.d-whatsapp-det[open] .d-whatsapp-mas { transform: rotate(45deg); }
.d-whatsapp-resp { margin-top: 18px; padding-right: 20px; font-size: 14px; line-height: 1.7; color: var(--gris2); }

/* ── El panel del cierre (su conversion-actions_panel, data-layout=illustrated) ── */
.d-whatsapp-panel { margin-block: var(--seccion); border-radius: 24px; border: 1px solid rgba(255, 255, 255, .8);
  background-image: var(--ruido), radial-gradient(60% 85% at 92% 88%, rgba(47, 111, 237, .4), rgba(0, 0, 0, 0) 70%), radial-gradient(45% 65% at 72% 0%, rgba(165, 196, 245, .35), rgba(0, 0, 0, 0) 70%), radial-gradient(55% 70% at 4% 6%, rgba(255, 255, 255, .85), rgba(0, 0, 0, 0) 70%), linear-gradient(120deg, #F5F8FF, #E5EDFD);
  background-size: 160px auto, auto, auto, auto, auto;
  box-shadow: rgba(255, 255, 255, .9) 0 1px 0 0 inset, rgba(47, 111, 237, .09) 0 0 0 1px; }
.d-whatsapp-panel-in { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, .9fr); gap: 40px; align-items: center; padding: clamp(28px, 4vw, 56px); }
.d-whatsapp-panel-txt { display: grid; gap: 28px; min-width: 0; }
.d-whatsapp-panel-h { max-width: 22ch; font-size: var(--titulo); line-height: 1.12; font-weight: 700; letter-spacing: -.035em; color: var(--ink); text-wrap: balance; }
.d-whatsapp-panel-p { max-width: 48ch; margin-top: 18px; font-size: 17px; line-height: 1.6; color: var(--gris2); }
.d-whatsapp-acciones-panel { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.d-whatsapp-btn-panel { border-radius: 8px; gap: 16px; }
.d-whatsapp-orbita { display: grid; justify-items: center; width: 100%; max-width: 400px; justify-self: center; min-width: 0; }
.d-whatsapp-lienzo-orbita { position: relative; display: grid; place-items: center; container-type: inline-size; width: 100%; max-width: 400px; aspect-ratio: 1; isolation: isolate; }
.d-whatsapp-hub { display: grid; place-items: center; width: clamp(94px, 34cqi, 136px); height: clamp(62px, 21cqi, 84px); background: #FFFFFF; border: 1px solid #DEDFF4; border-radius: 22px; box-shadow: rgba(47, 111, 237, .18) 0 8px 28px -8px, rgba(32, 43, 55, .03) 0 2px 4px 0; }
.d-whatsapp-hub-logo { display: inline-flex; align-items: center; gap: 8px; font-size: clamp(15px, 5.5cqi, 21px); font-weight: 700; letter-spacing: -.02em; color: #12151B; }
.d-whatsapp-hub-cuadro { display: inline-flex; align-items: center; justify-content: center; width: clamp(20px, 7cqi, 28px); height: clamp(20px, 7cqi, 28px); border-radius: 8px; background: #1A1712; }
.d-whatsapp-anillo { position: absolute; inset: 0; z-index: 0; width: 100%; height: 100%; pointer-events: none; }
.d-whatsapp-anillo circle { fill: none; stroke: rgba(47, 111, 237, .38); stroke-width: 1.25; }
.d-whatsapp-orbitador { --d-whatsapp-tam: clamp(30px, 12.5cqi, 50px); --d-whatsapp-rad: calc(var(--d-whatsapp-r) * 100cqi / 400); position: absolute; z-index: 1; top: 50%; left: 50%; display: grid; place-items: center; width: var(--d-whatsapp-tam); height: var(--d-whatsapp-tam); margin: calc(var(--d-whatsapp-tam) / -2); background: #FFFFFF; border: 1px solid #E2E3EF; border-radius: 16px; box-shadow: rgba(32, 43, 55, .12) 0 5px 14px -4px;
  transform: rotate(var(--d-whatsapp-ang)) translateY(var(--d-whatsapp-rad)) rotate(calc(-1 * var(--d-whatsapp-ang))); animation-name: d-whatsapp-orbita; animation-timing-function: linear; animation-iteration-count: infinite; }
.d-whatsapp-orbitador-inv { animation-direction: reverse; }
.d-whatsapp-orbita:hover .d-whatsapp-orbitador { animation-play-state: paused; }
.d-whatsapp-orbita-ic { display: grid; place-items: center; width: 52%; height: 52%; }
.d-whatsapp-orbita-ic svg { width: 100%; height: 100%; }
@keyframes d-whatsapp-orbita { 0% { transform: rotate(0deg) translateY(var(--d-whatsapp-rad)) rotate(0deg); } 100% { transform: rotate(1turn) translateY(var(--d-whatsapp-rad)) rotate(-1turn); } }

/* ── El pie ── */
.d-whatsapp-pie { position: relative; background: #F8F7FC; border-top: 1px solid #E7E4EE; padding: 72px 0 28px; overflow: hidden; }
.d-whatsapp-pie-in { width: min(1152px, calc(100% - 40px)); margin: 0 auto; display: grid; gap: 52px; position: relative; z-index: 1; }
.d-whatsapp-ident { display: grid; gap: 26px; justify-items: start; }
.d-whatsapp-contacto { display: grid; gap: 3px; }
.d-whatsapp-contacto-l { font-size: 13px; line-height: 19.5px; font-weight: 500; color: var(--ink); }
.d-whatsapp-contacto-a { padding: 4px 0; font-size: 14px; line-height: 21px; color: var(--gris3); }
.d-whatsapp-contacto-a:hover, .d-whatsapp-grupo-a:hover, .d-whatsapp-legal a:hover { color: var(--azul); text-decoration: underline; }
.d-whatsapp-grupos { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 32px 28px; }
.d-whatsapp-grupo-h { padding: 5px 0; font-size: 15px; line-height: 21px; font-weight: 500; color: var(--ink); letter-spacing: normal; }
.d-whatsapp-grupo-ul { margin-top: 12px; display: grid; gap: 4px; }
.d-whatsapp-grupo-a { display: inline-block; padding: 5px 0; font-size: 14px; line-height: 21px; color: var(--gris3); }
.d-whatsapp-bajo { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 16px 32px; padding-top: 22px; border-top: 1px solid #E4E0EC; font-size: 12px; line-height: 18px; color: var(--gris4); }
.d-whatsapp-legal { display: flex; gap: 32px; }
.d-whatsapp-legal a { padding: 5px 0; }
.d-whatsapp-firma { position: relative; margin: 56px 20px 0; height: 176px; overflow: hidden; font-size: 236px; line-height: 176px; font-weight: 700; letter-spacing: -8px; background-image: linear-gradient(rgba(47, 111, 237, .26), rgba(47, 111, 237, .08) 70%, rgba(47, 111, 237, 0)); -webkit-background-clip: text; background-clip: text; color: transparent; user-select: none; }

/* ── Los cortes de la referencia: 1024 (el hero en dos columnas), 1000, 960, 900, 767/700 y 480 ── */
@media (min-width: 681px) {
  .d-whatsapp-prev { height: min(clamp(470px, 60svh, 560px), calc((83cqi - 14px) * 10 / 16)); }
}
@media (min-width: 1024px) {
  .d-whatsapp-hero-grid { grid-template-columns: minmax(0, .84fr) minmax(0, 1.16fr); align-items: center; gap: clamp(32px, 3vw, 44px) clamp(40px, 4vw, 64px); }
  .d-whatsapp-h1 { margin-top: 20px; font-size: clamp(2.25rem, 3.15vw, 3rem); }
  .d-whatsapp-hero-p { font-size: clamp(1.0625rem, 1.3vw, 1.25rem); }
  .d-whatsapp-acciones { gap: 16px 28px; }
  .d-whatsapp-acciones .d-whatsapp-btn, .d-whatsapp-acciones .d-whatsapp-btn2 { gap: 12px; padding-inline: 20px; }
  .d-whatsapp-tab { padding-inline: 11px; font-size: 14px; line-height: 18.2px; }
}
@media (min-width: 1024px) and (max-width: 1179px) {
  .d-whatsapp-tab { padding-inline: 8px; font-size: 13px; }
}
@media (max-width: 1200px) {
  .d-whatsapp-tablero .d-whatsapp-cap { visibility: hidden; }
}
@media (max-width: 1100px) {
  .d-whatsapp-links { display: none; }
}
@media (max-width: 1023px) {
  .d-whatsapp-grupos { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 1000px) {
  .d-whatsapp-top { flex-direction: column; align-items: flex-start; gap: 16px; }
  .d-whatsapp-lista { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .d-whatsapp-stage { gap: 12px; }
  .d-whatsapp-tab { min-height: 40px; padding: 8px 16px; font-size: 14px; }
}
@media (max-width: 960px) {
  .d-whatsapp-panel-in { grid-template-columns: minmax(0, 1fr); gap: 28px; }
}
@media (max-width: 900px) {
  .d-whatsapp-tema, .d-whatsapp-sin, .d-whatsapp-con { padding: 24px 20px 24px 0; }
  .d-whatsapp-con { padding-inline: 20px; }
  .d-whatsapp-faq { gap: 35px; }
}
@media (max-width: 767px) {
  .d-whatsapp-hdr { height: 68px; padding-top: 8px; }
  .d-whatsapp-hdr-in { height: 60px; padding: 0 8px 0 20px; }
  .d-whatsapp-marca span:last-child { font-size: 18px !important; }
  .d-whatsapp-ctrl { display: none; }
  .d-whatsapp-menu { display: block; }
  .d-whatsapp-faq { grid-template-columns: minmax(0, 1fr); gap: 25px; padding-block: 65px; }
}
@media (max-width: 700px) {
  .d-whatsapp-hero { padding: 32px 0 24px; }
  .d-whatsapp-hero-grid { gap: 20px; }
  .d-whatsapp-insignia { padding: 8px 14px; margin-bottom: 16px; border-radius: 22px; }
  .d-whatsapp-marcas { gap: 6px 22px; }
  .d-whatsapp-h1 { font-size: clamp(1.875rem, 8.4vw, 2.25rem); text-wrap: pretty; }
  .d-whatsapp-hero-p { margin-top: 12px; font-size: 18px; line-height: 1.45; }
  .d-whatsapp-acciones { margin-top: 18px; }
  .d-whatsapp-canales { top: -15px; gap: 6px; }
  .d-whatsapp-canal { width: 34px; height: 34px; }
  .d-whatsapp-canal svg { width: 18px; height: 18px; }
  .d-whatsapp-cmp-sec { padding: 48px 0; }
  .d-whatsapp-cmp-h2 { font-size: 30px; text-align: left; }
  .d-whatsapp-cmp-h2 em { margin-top: 4px; }
  .d-whatsapp-marco { margin-top: 28px; padding: 4px 20px; border-radius: 22px; }
  .d-whatsapp-libro::before { display: none; }
  .d-whatsapp-tabla, .d-whatsapp-tabla tbody, .d-whatsapp-tabla tr, .d-whatsapp-tabla th, .d-whatsapp-tabla td { display: block; width: 100%; }
  .d-whatsapp-tabla thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  .d-whatsapp-tabla colgroup { display: none; }
  .d-whatsapp-fila { padding-block: 22px; border-top: 1px solid #DFE1E8; }
  .d-whatsapp-fila:first-child { border-top: 0; }
  .d-whatsapp-tema, .d-whatsapp-sin, .d-whatsapp-con { padding: 0; border: 0; font-size: 16px; }
  .d-whatsapp-tema-in { align-items: center; }
  .d-whatsapp-tema-ic { margin-top: 0; }
  .d-whatsapp-sin { margin-top: 14px; }
  .d-whatsapp-con { margin-top: 14px; padding: 14px 16px 16px; border: 1px solid rgba(255, 255, 255, .8); border-radius: 16px;
    background-image: var(--ruido), radial-gradient(70% 40% at 100% 0%, rgba(247, 208, 120, .26), rgba(0, 0, 0, 0) 70%), radial-gradient(80% 45% at 0% 100%, rgba(47, 111, 237, .2), rgba(0, 0, 0, 0) 70%), linear-gradient(#EEF4FF, #DCE7FD);
    background-size: 160px auto, auto, auto, auto; }
  .d-whatsapp-movil { display: block; margin-bottom: 4px; font-size: 13px; font-weight: 500; color: var(--gris2); }
  .d-whatsapp-movil-con { color: var(--azul); }
  .d-whatsapp-piezas { grid-template-columns: minmax(0, 1fr); gap: 56px; }
  .d-whatsapp-pieza { gap: 18px; }
  .d-whatsapp-comp { aspect-ratio: 1.45; border-radius: 22px; }
  .d-whatsapp-pastilla { gap: 8px; padding: 8px 14px 8px 10px; font-size: 13px; }
  .d-whatsapp-pastilla svg { width: 16px; height: 16px; }
  .d-whatsapp-p { font-size: 15px; }
  .d-whatsapp-lista { gap: 0 16px; }
  .d-whatsapp-li { align-items: center; gap: 10px; padding: 12px 0; }
  .d-whatsapp-tile { width: 30px; height: 30px; border-radius: 8px; }
  .d-whatsapp-li-txt strong { font-size: 14px; }
  .d-whatsapp-li-txt > span { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  .d-whatsapp-testis { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 32px 14px; }
  .d-whatsapp-testi-li:has(.d-whatsapp-ver:checked) { grid-column: 1 / -1; }
  .d-whatsapp-testi { gap: 12px; }
  .d-whatsapp-media { border-radius: 14px; }
  .d-whatsapp-play-ic { width: 52px; height: 37px; }
  .d-whatsapp-media-meses { gap: 10px; padding: 18px 14px 14px; }
  .d-whatsapp-mes-v { font-size: 12px; line-height: 15px; }
  .d-whatsapp-mes-l { font-size: 11px; line-height: 14px; }
  .d-whatsapp-cita p { font-size: 14px; }
  .d-whatsapp-persona { font-size: 13px; }
  .d-whatsapp-pie { padding-top: 48px; }
  .d-whatsapp-grupos { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 28px 24px; }
  .d-whatsapp-firma { font-size: 120px; line-height: 96px; height: 96px; letter-spacing: -4px; margin: 40px 20px 0; }
}
@media (max-width: 680px) {
  .d-whatsapp-stage { padding: 10px 12px 20px; border-radius: 18px; }
  .d-whatsapp-tablero { width: 100%; margin-left: 0; }
  .d-whatsapp-tarjeta { align-self: end; justify-self: center; width: calc(100% - 20px); max-width: none; margin: 0 0 10px; padding: 14px 16px; }
  .d-whatsapp-t-cifras { margin-top: 14px; }
  .d-whatsapp-fig { padding: 5px 5px 0; border-radius: 15px; }
  .d-whatsapp-prev { max-height: min(25rem, 72svh); border-radius: 10px 10px 0 0; }
  .d-whatsapp-cap { align-items: flex-start; gap: 8px; padding: 10px 8px; min-height: calc(2.9em + 20px); font-size: 13px; }
}
@media (max-width: 480px) {
  .d-whatsapp-acciones { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .d-whatsapp-acciones .d-whatsapp-btn, .d-whatsapp-acciones .d-whatsapp-btn2 { min-width: 0; gap: 6px; padding: 12px 8px; font-size: 13px; line-height: 18.2px; white-space: normal; }
  .d-whatsapp-acciones-panel { flex-direction: column; align-items: stretch; }
  .d-whatsapp-acciones-panel a { width: 100%; }
  .d-whatsapp-panel-in { padding: 28px 24px; }
  .d-whatsapp-orbitador { border-radius: 12px; }
  .d-whatsapp-hub { border-radius: 18px; }
}
@media (prefers-reduced-motion: reduce) {
  .d-whatsapp *, .d-whatsapp *::before, .d-whatsapp *::after { animation: none !important; transition: none !important; }
}
`;

const CSS = BASE + TABS;
