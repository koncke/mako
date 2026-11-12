// =============================================================================
// /vsl/whatsapp con el DISEÑO de la portada de Leadsales (https://leadsales.io/), copiado el 11/11/2026
// =============================================================================
// Los valores (DM Sans, la barra de vidrio flotante, la escala de títulos con su segunda línea en gris, la galería del hero
// con sus pestañas de vidrio, la tabla de chats sueltos contra Leadsales con su columna resaltada, las cuatro piezas con su
// composición sobre degradado, la lista con rayas, la sección oscura de testimonios, las preguntas en dos columnas, el panel
// del cierre con su órbita y el pie lila con la firma gigante) se leyeron con getComputedStyle a 1440 y 390 px:
// docs/diseno/landings-competencia/whatsapp.md. De MaKo quedan el logo, el azul #2F6FED donde Leadsales pone su violeta
// (#4145E3), el dorado como detalle (la estrella de las tarjetas que flotan), el botón de la llamada y los textos.
// Sus degradados violetas y rosas pasan a la familia del azul de MaKo y a un dorado claro (la tabla, en el .md).
// Su letra es DM Sans (Google Fonts, OFL): se sirve desde /vsl-assets/fuentes/dm-sans/.
//
// Secciones de la referencia que NO van, y por qué:
//   · Las insignias de Meta y WhatsApp del hero y su botón «Prueba el CRM 14 días»: son suyas; el único botón es la llamada.
//   · «+2,800 empresas…» con sus logos de clientes, «Planes desde $97» y «Hemos aparecido en los siguientes medios» (Forbes,
//     Shark Tank): MaKo no tiene ese contenido.
//   · El link «Conoce más de WhatsApp Business API» y el «Ver más casos de éxito»: no hay a dónde llevarlos.
//   · La frase del pie: la landing de MaKo no la tiene. El texto del panel «Tu próximo paso» va tal cual desde el
//     12/11/2026, con la llamada en lugar de su demo.
//   · Sus cuatro testimonios extra: la prueba de MaKo es el caso de Mauricio (dos tarjetas: su video y sus meses).
// Las pantallas de su producto (capturas) son los gráficos de la landing de /vsl (FEATURE_VISUALS.whatsapp) y el visual de
// la portada, dentro de los mismos marcos. Server component sin JavaScript: las pestañas son radios ocultos con :checked.
// =============================================================================

import type { ReactNode } from 'react';
import type { PropsDiseno } from '.';
import type { Bloque } from '../tipos';
import { RUTA_CTA, CASO, EstrellaMaKo, LogoMaKo, TEXTO_CTA, TEXTO_CIERRE, html, otrasFunciones } from '../marca';
import { VisualDeLanding } from '../Visuales';
import { FEATURE_VISUALS } from '../../_detalle/feature-visuals';
import { Visual } from '../../_detalle/Visual';
import type { VisualSpec } from '../../_detalle/Visual';

type Hero = Extract<Bloque, { tipo: 'hero' }>;
type Filas = Extract<Bloque, { tipo: 'filas' }>;
type Contraste = Extract<Bloque, { tipo: 'contraste' }>;
type Tarjetas = Extract<Bloque, { tipo: 'tarjetas' }>;
type Preguntas = Extract<Bloque, { tipo: 'preguntas' }>;

const c = (s: string) => `d-whatsapp-${s}`;

/** Íconos de trazo (viewBox 24), los mismos de app/vsl/_competencia/whatsapp.ts. */
const ICO = {
  chat: ['M3 21l1.65 -3.8a9 9 0 1 1 3.4 2.9l-5.05 .9', 'M9 10a.5 .5 0 0 0 1 0v-1a.5 .5 0 0 0 -1 0v1a5 5 0 0 0 5 5h1a.5 .5 0 0 0 0 -1h-1a.5 .5 0 0 0 0 1'],
  bandeja: ['M4 6a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z', 'M4 13h3l3 3h4l3 -3h3'],
  persona: ['M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0', 'M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2'],
  etapa: ['M4 4h16v2.172a2 2 0 0 1 -.586 1.414l-4.414 4.414v7l-6 2v-8.5l-4.414 -4.414a2 2 0 0 1 -.586 -1.414v-2.172z'],
  estrella: ['M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3l5.8 1.9l-5.8 1.9a2 2 0 0 0 -1.3 1.3l-1.9 5.8l-1.9 -5.8a2 2 0 0 0 -1.3 -1.3l-5.8 -1.9l5.8 -1.9a2 2 0 0 0 1.3 -1.3z'],
};
/** El ícono de cada fila de la tabla (Leadsales: enviar, equipo, robot). */
const ICO_FILAS = [ICO.chat, ICO.persona, ICO.etapa];
/** El ícono de cada pestaña de la galería, por el gráfico que muestra. */
const ICO_GRAFICO: Record<string, string[]> = { chatThread: ICO.chat, waInbox: ICO.bandeja, makoAnswer: ICO.estrella, kanban: ICO.etapa };

function Ico({ paths, size = 18 }: { paths?: string[]; size?: number }) {
  if (!paths?.length) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths.map((d) => <path key={d} d={d} />)}
    </svg>
  );
}

/** Su flecha «↗» de los botones y los links. */
function Flecha({ size = 14 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17L17 7" /><path d="M8 7h9v9" /></svg>;
}

/** Los canales que junta Chats, con los logos que ya tiene /vsl-assets/logos (WhatsApp, Meta por Instagram y Messenger, email). */
const CANALES = [
  { src: '/vsl-assets/logos/whatsapp.png', nombre: 'WhatsApp' },
  { src: '/vsl-assets/logos/meta.png', nombre: 'Instagram y Messenger' },
  { src: '/vsl-assets/logos/gmail.png', nombre: 'Email' },
];

const sinEtiquetas = (s: string) => s.replace(/<[^>]+>/g, '');

/** Lo que muestra cada pestaña de la galería: el visual de la portada primero y después las piezas de «Así funciona». */
type Pantalla = { etiqueta: string; icono?: string[]; dibujo: ReactNode; nota?: { titulo: string; texto: string } };

function pantallasDe(hero: Hero | undefined, filas: Filas | undefined): Pantalla[] {
  const slug = filas?.slug ?? (hero?.visual.tipo === 'detalle' ? hero.visual.slug : 'whatsapp');
  const fv = FEATURE_VISUALS[slug];
  const out: Pantalla[] = [];
  if (hero) {
    const titulo = typeof fv?.hero?.title === 'string' ? fv.hero.title : 'Conversación';
    out.push({
      etiqueta: titulo,
      icono: ICO_GRAFICO[fv?.hero?.type ?? ''] ?? ICO.chat,
      dibujo: <VisualDeLanding visual={hero.visual} />,
      nota: hero.puntos?.[0] ? { titulo, texto: hero.puntos[0] } : undefined,
    });
  }
  for (const [i, f] of (filas?.items ?? []).entries()) {
    const spec: VisualSpec | undefined = fv?.groups?.[f.grafico ?? i];
    out.push({ etiqueta: sinEtiquetas(f.titulo), icono: ICO_GRAFICO[spec?.type ?? ''] ?? ICO.chat, dibujo: <Visual spec={spec} />, nota: { titulo: f.titulo, texto: f.texto } });
  }
  return out;
}

// ── La barra ─────────────────────────────────────────────────────────────────

function Barra() {
  const links = [
    { href: '#d-whatsapp-como', t: 'Así funciona' },
    { href: '#d-whatsapp-incluye', t: 'Qué incluye' },
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

function Galeria({ hero, filas }: { hero?: Hero; filas?: Filas }) {
  const pantallas = pantallasDe(hero, filas);
  return (
    <div className={c('stage')} id="d-whatsapp-como">
      <ul className={c('canales')} aria-label="Canales">
        {CANALES.map((k) => <li key={k.src} className={c('canal')}><img src={k.src} alt={k.nombre} width={22} height={22} /></li>)}
      </ul>
      {pantallas.map((p, i) => <input key={p.etiqueta} type="radio" name="d-whatsapp-galeria" id={`d-whatsapp-g${i}`} className={`${c('r')} ${c(`r${i}`)}`} defaultChecked={i === 0} aria-label={p.etiqueta} />)}
      <figure className={c('fig')}>
        <div className={c('pantalla')}>
          {pantallas.map((p, i) => <div key={p.etiqueta} className={`${c('pan')} ${c(`pan${i}`)}`}>{p.dibujo}</div>)}
        </div>
        {filas ? <figcaption className={c('cap')}><h2 className={c('cap-h')} dangerouslySetInnerHTML={html(filas.titulo)} /></figcaption> : null}
      </figure>
      {pantallas.map((p, i) => (p.nota ? (
        <aside key={p.etiqueta} className={`${c('nota')} ${c(`nota${i}`)}`}>
          <div className={c('nota-top')}>
            <span className={c('nota-ic')}><EstrellaMaKo size={16} /></span>
            <p className={c('nota-t')} dangerouslySetInnerHTML={html(p.nota.titulo)} />
          </div>
          <p className={c('nota-p')} dangerouslySetInnerHTML={html(p.nota.texto)} />
        </aside>
      ) : null))}
      <div className={c('tabs')} role="presentation">
        {pantallas.map((p, i) => (
          <label key={p.etiqueta} htmlFor={`d-whatsapp-g${i}`} className={`${c('tab')} ${c(`tab${i}`)}`}>
            <span className={c('tab-ic')}><Ico paths={p.icono} /></span>{p.etiqueta}
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
          <p className={c('badge')} dangerouslySetInnerHTML={html(b.etiqueta)} />
          <h1 className={c('h1')} dangerouslySetInnerHTML={html(b.titulo)} />
          <p className={c('hero-p')} dangerouslySetInnerHTML={html(b.bajada)} />
          <div className={c('acciones')}>
            <a href={RUTA_CTA} className={`${c('btn')} ${c('btn-hero')}`}>{TEXTO_CTA}<Flecha /></a>
          </div>
        </div>
        <Galeria hero={b} filas={filas} />
      </div>
    </section>
  );
}

// ── La tabla: chats sueltos contra Chats de MaKo, una fila por tema ─────────

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
                      <span className={c('movil')} dangerouslySetInnerHTML={html(b.sin.titulo)} />
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

/** Qué pantalla va en la composición de cada pieza (Leadsales pone un recorte de su producto en cada una). */
const PANTALLA_DE_PIEZA: (number | 'hero')[] = [0, 4, 'hero', 2];

function Piezas({ b, hero, filas }: { b: Tarjetas; hero?: Hero; filas?: Filas }) {
  const slug = filas?.slug ?? 'whatsapp';
  const fv = FEATURE_VISUALS[slug];
  const pantalla = (i: number): { spec?: VisualSpec; etiqueta: string } => {
    const cual = PANTALLA_DE_PIEZA[i % PANTALLA_DE_PIEZA.length];
    if (cual === 'hero') return { spec: fv?.hero, etiqueta: typeof fv?.hero?.title === 'string' ? fv.hero.title : 'Conversación' };
    const f = filas?.items.find((x) => x.grafico === cual);
    return { spec: fv?.groups?.[cual], etiqueta: f ? sinEtiquetas(f.titulo) : '' };
  };
  return (
    <section className={c('piezas-sec')}>
      <div className={c('shell')}>
        <div className={c('top')}>
          <h2 className={c('h2')} dangerouslySetInnerHTML={html(b.titulo)} />
          {b.bajada ? <p className={c('top-p')} dangerouslySetInnerHTML={html(b.bajada)} /> : null}
        </div>
        <div className={c('piezas')}>
          {b.items.map((it, i) => {
            const p = pantalla(i);
            return (
              <article key={it.titulo} className={c('pieza')}>
                <figure className={`${c('comp')} ${c(`comp${i % 4}`)}`}>
                  <div className={c('ventana')}>{i % 4 === 2 && hero ? <VisualDeLanding visual={hero.visual} /> : <Visual spec={p.spec} />}</div>
                  {p.etiqueta ? <span className={c('pastilla')}><span className={c('pastilla-ic')}><Ico paths={it.icono} /></span>{p.etiqueta}</span> : null}
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
      </div>
    </section>
  );
}

// ── «Todo lo que incluye»: la lista con rayas ──────────────────────────────

function Incluye({ b }: { b: Tarjetas }) {
  return (
    <section className={c('incl-sec')} id="d-whatsapp-incluye">
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
    <section className={c('caso')}>
      <div className={c('shell')}>
        <h2 className={`${c('h2')} ${c('h2-claro')}`}><span dangerouslySetInnerHTML={html(CASO.titulo)} /> <em>{CASO.sub}</em></h2>
        <ul className={c('testis')}>
          <li>
            <figure className={c('testi')}>
              <div className={c('media')}><video muted autoPlay loop playsInline preload="metadata"><source src={CASO.video} type="video/mp4" /></video></div>
              <blockquote className={c('cita')}><p dangerouslySetInnerHTML={html(CASO.historia[0])} /></blockquote>
              <figcaption className={c('persona')}><strong>{CASO.quien}</strong><span>{CASO.rol}</span></figcaption>
            </figure>
          </li>
          <li>
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
        <h2 className={`${c('h2')} ${c('h2-46')}`} dangerouslySetInnerHTML={html(b.titulo)} />
        <a href={RUTA_CTA} className={c('textlink')}>{TEXTO_CTA}<Flecha /></a>
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
  // Su órbita: dos anillos (r 112 y 166) y los íconos girando 28 s el de adentro y 40 s al revés los de afuera.
  const orbitas = [
    { k: CANALES[0], r: 166, dur: 40, delay: -5, inversa: true, ang: 100 },
    { k: CANALES[1], r: 112, dur: 28, delay: -17.5, inversa: false, ang: 302 },
    { k: CANALES[2], r: 166, dur: 40, delay: -25, inversa: true, ang: 280 },
  ];
  return (
    <section className={`${c('shell')} ${c('panel-sec')}`}>
      <div className={c('panel')}>
        <div className={c('panel-in')}>
          <div className={c('panel-txt')}>
            {/* Su texto del cierre, tal cual (12/11/2026); su «prueba de 14 días» es la de MaKo, de 7 (TEXTO_CIERRE). */}
            <h2 className={`${c('h2')} ${c('panel-h')}`}>Tu próximo paso: <em>organizar las ventas de tu equipo.</em></h2>
            <p className={`${c('top-p')} ${c('panel-p')}`}>{TEXTO_CIERRE}</p>
            <div className={c('acciones')}><a href={RUTA_CTA} className={`${c('btn')} ${c('btn-panel')}`}>{TEXTO_CTA}<Flecha /></a></div>
          </div>
          <figure className={c('orbita')} aria-hidden="true">
            <svg className={c('anillos')} viewBox="0 0 400 400" width="400" height="400"><circle cx="200" cy="200" r="166" /><circle cx="200" cy="200" r="112" /></svg>
            <div className={c('hub')}><LogoMaKo tamano={26} /></div>
            {orbitas.map((o) => (
              <div key={o.k.src} className={`${c('orbitador')} ${o.inversa ? c('orbitador-inv') : ''}`} style={{ ['--d-whatsapp-r' as string]: `${o.r}px`, ['--d-whatsapp-ang' as string]: `${o.ang}deg`, animationDuration: `${o.dur}s`, animationDelay: `${o.delay}s` }}>
                <img src={o.k.src} alt="" width={22} height={22} />
              </div>
            ))}
          </figure>
        </div>
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
              <h2 className={c('grupo-h')}>{i === 0 ? 'Funciones de MaKo' : ' '}</h2>
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
  const hero = bloques.find((x): x is Hero => x.tipo === 'hero');
  const filas = bloques.find((x): x is Filas => x.tipo === 'filas');
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
      secciones.push(b.columnas === 2 ? <Piezas key={i} b={b} hero={hero} filas={filas} /> : <Incluye key={i} b={b} />);
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
    </div>
  );
}

// ── Los estilos, con los valores medidos (docs/diseno/landings-competencia/whatsapp.md) ──

const RUIDO = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='g' x='0' y='0' width='100%25' height='100%25' color-interpolation-filters='sRGB'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch' result='n'/%3E%3CfeColorMatrix in='n' values='0 0 0 0 .1 0 0 0 0 .12 0 0 0 0 .32 .42 0 0 0 -.18' result='d'/%3E%3CfeColorMatrix in='n' values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 .5 0 0 -.24' result='l'/%3E%3CfeMerge%3E%3CfeMergeNode in='d'/%3E%3CfeMergeNode in='l'/%3E%3C/feMerge%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E\")";

/** Las pestañas de la galería (hasta seis, como la suya): la pantalla, su tarjeta y la pestaña prendida. */
const TABS = Array.from({ length: 6 }, (_, i) => `
.d-whatsapp-r${i}:checked ~ .d-whatsapp-fig .d-whatsapp-pan${i}, .d-whatsapp-r${i}:checked ~ .d-whatsapp-nota${i} { display: block; }
.d-whatsapp-r${i}:checked ~ .d-whatsapp-tabs .d-whatsapp-tab${i} { background-image: linear-gradient(#FFFFFF, rgba(255, 255, 255, .86)); box-shadow: #FFFFFF 0 1px 0 0 inset, rgba(32, 43, 55, .06) 0 0 0 1px, rgba(32, 43, 55, .4) 0 8px 18px -10px; }
.d-whatsapp-r${i}:focus-visible ~ .d-whatsapp-tabs .d-whatsapp-tab${i} { outline: 2px solid #2F6FED; outline-offset: 2px; }`).join('');

const BASE = `
@font-face { font-family: 'MaKo DM Sans'; src: url('/vsl-assets/fuentes/dm-sans/dm-sans-latin-var.woff2') format('woff2'); font-weight: 100 1000; font-style: normal; font-display: swap; }
.d-whatsapp { --ink: #202B37; --gris: #637083; --gris2: #414E62; --gris3: #586174; --gris4: #626B7B; --linea: #E4E7EC; --azul: #2F6FED; --azul-h: #1F57C8; --marino: #12151B; --ruido: ${RUIDO};
  background: #FFFFFF; color: var(--ink); font-family: 'MaKo DM Sans', 'DM Sans', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif; font-size: 16px; line-height: 1.55; -webkit-font-smoothing: antialiased; overflow-x: clip; }
.d-whatsapp *, .d-whatsapp *::before, .d-whatsapp *::after { box-sizing: border-box; }
.d-whatsapp :where(h1, h2, h3, p, ul, figure, blockquote) { margin: 0; padding: 0; }
.d-whatsapp :where(ul) { list-style: none; }
.d-whatsapp :where(a) { color: inherit; text-decoration: none; }
.d-whatsapp :where(img, video) { display: block; max-width: 100%; }
.d-whatsapp :where(em) { font-style: normal; }
.d-whatsapp-shell { width: min(1152px, calc(100% - 40px)); margin: 0 auto; }

/* ── Botones (su «conversion-actions_primary»: #4145E3 → azul de MaKo) ── */
.d-whatsapp-btn { display: inline-flex; align-items: center; justify-content: center; gap: 12px; background: var(--azul); color: #FFFFFF; border: 1px solid var(--azul); border-radius: 999px; padding: 13px 20px; font-size: 15px; line-height: 21px; font-weight: 700; box-shadow: rgba(13, 15, 97, .1) 0 2px 3px 0; transition: background .16s, border-color .16s, box-shadow .16s; white-space: nowrap; }
.d-whatsapp-btn:hover { background: var(--azul-h); border-color: var(--azul-h); box-shadow: rgba(13, 15, 97, .14) 0 4px 10px 0; }
.d-whatsapp-btn:focus-visible { outline: 2px solid var(--azul); outline-offset: 3px; }

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
.d-whatsapp-entrar:hover { color: var(--azul); }
.d-whatsapp-btn-nav { padding: 11px 17px; font-size: 14px; line-height: 22.4px; font-weight: 550; gap: 10px; box-shadow: rgba(43, 36, 120, .1) 0 2px 4px 0; }
.d-whatsapp-menu { display: none; margin-left: auto; position: static; }
.d-whatsapp-menu summary { list-style: none; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; cursor: pointer; border-radius: 999px; }
.d-whatsapp-menu summary::-webkit-details-marker { display: none; }
.d-whatsapp-hamb { display: flex; flex-direction: column; gap: 4px; }
.d-whatsapp-hamb i { display: block; width: 18px; height: 2px; border-radius: 2px; background: #262B35; }
.d-whatsapp-menu-panel { position: absolute; left: 0; right: 0; top: calc(100% + 8px); background: #FFFFFF; border: 1px solid #DFDEE7; border-radius: 20px; box-shadow: rgba(36, 31, 71, .32) 0 24px 64px -32px; padding: 6px 12px 20px; display: flex; flex-direction: column; }
.d-whatsapp-menu-link { padding: 14px 8px; font-size: 18px; line-height: 23.4px; font-weight: 500; color: #262B35; border-radius: 8px; }
.d-whatsapp-btn-menu { margin-top: 10px; }

/* ── Hero ── */
.d-whatsapp-hero { padding: 56px 0 44px; background: #FFFFFF; }
.d-whatsapp-hero-grid { display: grid; grid-template-columns: 459.64fr 634.77fr; gap: 43.2px 57.6px; align-items: center; }
.d-whatsapp-hero-copy { min-width: 0; }
.d-whatsapp-badge { display: inline-flex; align-items: center; padding: 10px 18px; border-radius: 999px; border: 1px solid transparent; background: linear-gradient(115deg, #FFFFFF 45%, #FBFDFC) padding-box, linear-gradient(110deg, #9CBCE8, #E3E5EC 24%, #E3E5EC 78%, #DCE9E2) border-box; box-shadow: #FFFFFF 0 1px 0 0 inset, rgba(33, 57, 91, .02) 0 2px 8px 0; font-size: 14px; line-height: 18.2px; font-weight: 500; color: var(--gris2); }
.d-whatsapp-h1 { margin-top: 20px; font-size: 45.36px; line-height: 48.99px; font-weight: 700; letter-spacing: -1.8144px; color: var(--ink); }
.d-whatsapp-hero-p { margin-top: 16px; font-size: 18.72px; line-height: 27.144px; letter-spacing: -.3744px; color: var(--gris); }
.d-whatsapp-hero-p strong { color: var(--ink); font-weight: 600; }
.d-whatsapp-acciones { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 24px; }

/* La galería: escenario de 635 × 461 con su ruido y sus luces */
.d-whatsapp-stage { position: relative; height: 461px; border-radius: 24px; border: 1px solid rgba(255, 255, 255, .8); padding: 16px;
  background-image: var(--ruido), radial-gradient(38% 44% at 100% 0%, rgba(201, 218, 251, .6), rgba(0, 0, 0, 0) 70%), radial-gradient(40% 44% at 94% 64%, rgba(165, 196, 245, .45), rgba(0, 0, 0, 0) 70%), radial-gradient(40% 36% at 0% 100%, rgba(201, 218, 251, .4), rgba(0, 0, 0, 0) 70%), radial-gradient(80% 50% at 50% 100%, rgba(47, 111, 237, .14), rgba(0, 0, 0, 0) 75%), linear-gradient(#FFFFFF, #FDFDFF 42%, #F5F6FD);
  background-size: 160px auto, auto, auto, auto, auto, auto;
  box-shadow: rgba(255, 255, 255, .95) 0 1px 0 0 inset, rgba(47, 111, 237, .07) 0 0 0 1px, rgba(32, 43, 55, .16) 0 18px 40px -16px; scroll-margin-top: 100px; }
.d-whatsapp-canales { position: absolute; top: -18px; right: 32px; display: flex; gap: 8px; z-index: 3; }
.d-whatsapp-canal { width: 40px; height: 40px; border-radius: 50%; background: #FFFFFF; border: 1px solid var(--linea); box-shadow: rgba(32, 43, 55, .45) 0 10px 22px -12px; display: flex; align-items: center; justify-content: center; }
.d-whatsapp-canal img { width: 22px; height: 22px; object-fit: contain; }
.d-whatsapp-r { position: absolute; opacity: 0; width: 1px; height: 1px; pointer-events: none; }
.d-whatsapp-fig { position: absolute; left: 18.74%; top: 17px; width: 78.58%; background: #FFFFFF; border: 1px solid var(--linea); border-radius: 18px; padding: 6px 6px 0; box-shadow: rgba(32, 43, 55, .04) 0 2px 4px 0, rgba(32, 43, 55, .08) 0 16px 40px 0; z-index: 1; }
.d-whatsapp-pantalla { height: 303px; border-radius: 12px 12px 0 0; background: #F8FAFC; overflow: hidden; }
.d-whatsapp-pan { display: none; height: 100%; }
.d-whatsapp-pan > svg, .d-whatsapp-pan svg[viewBox="0 0 400 300"] { width: auto !important; height: 100% !important; max-width: 100%; margin: 0 auto; }
.d-whatsapp-cap { border-top: 1px solid var(--linea); padding: 10px 14px; }
.d-whatsapp-cap-h { font-size: 14px; line-height: 19.6px; font-weight: 500; color: var(--gris2); letter-spacing: normal; }
.d-whatsapp-nota { display: none; position: absolute; left: 2.68%; top: 57px; width: 39.69%; max-width: 252px; min-width: 200px; z-index: 2; background: #FFFFFF; border: 1px solid var(--linea); border-radius: 20px; padding: 22px; box-shadow: rgba(32, 43, 55, .28) 0 24px 56px -24px, rgba(32, 43, 55, .06) 0 4px 12px 0; }
.d-whatsapp-nota-top { display: flex; align-items: center; gap: 12px; }
.d-whatsapp-nota-ic { flex: none; width: 36px; height: 36px; border-radius: 50%; background: #FFF6DE; display: flex; align-items: center; justify-content: center; }
.d-whatsapp-nota-t { font-size: 16px; line-height: 22.4px; font-weight: 700; color: var(--ink); }
.d-whatsapp-nota-p { margin-top: 14px; font-size: 12px; line-height: 16.8px; color: var(--gris2); }
.d-whatsapp-nota-p strong { color: var(--ink); font-weight: 600; }
.d-whatsapp-tabs { position: absolute; left: 20px; right: 20px; bottom: 17px; height: 50px; z-index: 2; display: flex; gap: 3px; padding: 4px; border-radius: 999px; border: 1px solid rgba(255, 255, 255, .75); background-image: linear-gradient(rgba(255, 255, 255, .62), rgba(255, 255, 255, .34)); box-shadow: rgba(255, 255, 255, .9) 0 1px 0 0 inset, rgba(47, 111, 237, .08) 0 0 0 1px, rgba(32, 43, 55, .3) 0 10px 28px -14px; -webkit-backdrop-filter: blur(18px) saturate(1.7); backdrop-filter: blur(18px) saturate(1.7); overflow-x: auto; scrollbar-width: none; }
.d-whatsapp-tabs::-webkit-scrollbar { display: none; }
.d-whatsapp-tab { flex: none; display: inline-flex; align-items: center; gap: 8px; height: 40px; padding: 8px 13px 8px 10px; border-radius: 999px; font-size: 14px; line-height: 18.2px; font-weight: 500; color: var(--ink); cursor: pointer; white-space: nowrap; transition: color .14s, background-color .14s, box-shadow .14s; }
.d-whatsapp-tab:hover { background-color: rgba(255, 255, 255, .6); }
.d-whatsapp-tab-ic { display: inline-flex; color: var(--azul); }

/* ── La tabla ── */
.d-whatsapp-cmp-sec { padding: 128px 0; border-bottom: 1px solid var(--linea); background: #FFFFFF; }
.d-whatsapp-cmp-h2 { max-width: 960px; margin: 0 auto; text-align: center; font-size: 44px; line-height: 51.04px; font-weight: 600; letter-spacing: -1.54px; color: var(--ink); }
.d-whatsapp-cmp-h2 em { display: block; color: var(--azul); }
.d-whatsapp-marco { margin-top: 48px; border-radius: 30px; border: 1px solid rgba(255, 255, 255, .8); padding: 12px 12px 12px 48px;
  background-image: var(--ruido), radial-gradient(55% 75% at 100% 100%, rgba(201, 218, 251, .55), rgba(0, 0, 0, 0) 70%), radial-gradient(45% 60% at 0% 0%, rgba(255, 255, 255, .8), rgba(0, 0, 0, 0) 70%), linear-gradient(125deg, #F8F8FF, #F1F2FD);
  background-size: 160px auto, auto, auto, auto;
  box-shadow: rgba(255, 255, 255, .95) 0 1px 0 0 inset, rgba(47, 111, 237, .07) 0 0 0 1px, rgba(32, 43, 55, .16) 0 18px 40px -16px; }
.d-whatsapp-libro { position: relative; }
.d-whatsapp-libro::before { content: ''; position: absolute; top: 0; bottom: 0; right: 0; width: 38.99%; border-radius: 18px; border: 1px solid rgba(255, 255, 255, .8); box-shadow: #FFFFFF 0 1px 0 0 inset;
  background-image: var(--ruido), radial-gradient(70% 40% at 100% 0%, rgba(247, 208, 120, .26), rgba(0, 0, 0, 0) 70%), radial-gradient(80% 45% at 0% 100%, rgba(47, 111, 237, .2), rgba(0, 0, 0, 0) 70%), linear-gradient(#EEF4FF, #DCE7FD);
  background-size: 160px auto, auto, auto, auto; }
.d-whatsapp-tabla { position: relative; width: 100%; border-collapse: collapse; table-layout: fixed; }
.d-whatsapp-col-tema { width: 25.05%; } .d-whatsapp-col-sin { width: 35.96%; } .d-whatsapp-col-con { width: 38.99%; }
.d-whatsapp-tabla thead td, .d-whatsapp-tabla thead th { padding: 26px 32px 16px 0; font-size: 14px; line-height: 21.7px; font-weight: 500; color: var(--gris2); text-align: left; vertical-align: bottom; }
.d-whatsapp-tabla thead .d-whatsapp-th-con { padding: 26px 28px 16px; color: var(--marino); }
.d-whatsapp-th-marca { display: inline-flex; align-items: center; gap: 7px; font-size: 15px; line-height: 23.25px; color: var(--gris2); }
.d-whatsapp-th-logo span:last-child { font-size: 13px !important; }
.d-whatsapp-tema { padding: 28px 32px 28px 0; border-top: 1px solid rgba(32, 43, 55, .1); text-align: left; vertical-align: middle; font-size: 16px; line-height: 24.8px; font-weight: 500; color: var(--marino); }
.d-whatsapp-tema-in { display: inline-flex; align-items: center; gap: 12px; }
.d-whatsapp-tema-ic { flex: none; width: 34px; height: 34px; border-radius: 10px; background: rgba(255, 255, 255, .78); border: 1px solid rgba(47, 111, 237, .18); display: flex; align-items: center; justify-content: center; color: var(--azul); }
.d-whatsapp-sin { padding: 28px 32px 28px 0; border-top: 1px solid rgba(32, 43, 55, .1); font-size: 17px; line-height: 26.35px; color: var(--gris2); vertical-align: middle; }
.d-whatsapp-sin strong { font-weight: 600; color: var(--ink); }
.d-whatsapp-con { padding: 28px; border-top: 1px solid rgba(255, 255, 255, .85); font-size: 17px; line-height: 26.35px; font-weight: 500; color: var(--ink); vertical-align: middle; }
.d-whatsapp-movil { display: none; }

/* ── Encabezados de sección: dos tonos ── */
.d-whatsapp-top { display: flex; justify-content: space-between; align-items: flex-end; gap: 48px; }
.d-whatsapp-h2 { max-width: 560px; font-size: 44px; line-height: 47.52px; font-weight: 700; letter-spacing: -1.54px; color: var(--ink); }
.d-whatsapp-h2 em { display: block; color: var(--gris); }
.d-whatsapp-h2-ancho { max-width: 804px; }
.d-whatsapp-h2-46 { font-size: 46px; line-height: 49.68px; letter-spacing: -1.61px; max-width: none; }
.d-whatsapp-top-p { max-width: 340px; font-size: 17px; line-height: 26.35px; color: var(--gris2); }

/* ── Las cuatro piezas ── */
.d-whatsapp-piezas-sec { padding: 128px 0; }
.d-whatsapp-piezas { margin-top: 64px; display: grid; grid-template-columns: 1fr 1fr; gap: 72px 32px; }
.d-whatsapp-pieza { display: flex; flex-direction: column; gap: 24px; min-width: 0; }
.d-whatsapp-comp { position: relative; aspect-ratio: 560 / 373; border-radius: 28px; border: 1px solid rgba(255, 255, 255, .8); overflow: hidden; background-size: 160px auto, auto, auto, auto, auto;
  box-shadow: rgba(255, 255, 255, .95) 0 1px 0 0 inset, rgba(47, 111, 237, .07) 0 0 0 1px, rgba(32, 43, 55, .16) 0 18px 40px -16px; }
.d-whatsapp-comp0 { background-image: var(--ruido), radial-gradient(60% 75% at 100% 100%, rgba(247, 208, 120, .62), rgba(0, 0, 0, 0) 70%), radial-gradient(60% 75% at 0% 100%, rgba(47, 111, 237, .55), rgba(0, 0, 0, 0) 70%), radial-gradient(45% 55% at 85% 0%, rgba(169, 193, 251, .45), rgba(0, 0, 0, 0) 70%), linear-gradient(#FAFCFF, #EAF1FE 45%, #CFDFFC); }
.d-whatsapp-comp1 { background-image: var(--ruido), radial-gradient(65% 75% at 0% 100%, rgba(125, 162, 247, .6), rgba(0, 0, 0, 0) 70%), radial-gradient(60% 75% at 100% 100%, rgba(47, 111, 237, .48), rgba(0, 0, 0, 0) 70%), radial-gradient(45% 55% at 90% 0%, rgba(201, 218, 251, .5), rgba(0, 0, 0, 0) 70%), linear-gradient(#FAFBFF, #EAF1FE 45%, #D3E0FC); }
.d-whatsapp-comp2 { background-image: var(--ruido), radial-gradient(60% 72% at 100% 0%, rgba(247, 208, 120, .62), rgba(0, 0, 0, 0) 70%), radial-gradient(65% 80% at 0% 100%, rgba(47, 111, 237, .5), rgba(0, 0, 0, 0) 70%), radial-gradient(50% 45% at 100% 100%, rgba(150, 175, 250, .38), rgba(0, 0, 0, 0) 70%), linear-gradient(#FAFCFF, #EAF1FE 50%, #CFDFFC); }
.d-whatsapp-comp3 { background-image: var(--ruido), radial-gradient(70% 80% at 100% 100%, rgba(47, 111, 237, .52), rgba(0, 0, 0, 0) 70%), radial-gradient(50% 65% at 0% 80%, rgba(201, 218, 251, .62), rgba(0, 0, 0, 0) 70%), radial-gradient(45% 40% at 45% 100%, rgba(140, 170, 248, .35), rgba(0, 0, 0, 0) 70%), linear-gradient(#FBFBFF, #EAF1FE 45%, #CFDFFC); }
.d-whatsapp-ventana { position: absolute; left: 6.07%; top: 6.43%; width: 87.68%; height: 68.1%; background: #FFFFFF; border: 1px solid rgba(32, 43, 55, .08); border-radius: 14px; overflow: hidden; box-shadow: rgba(32, 43, 55, .05) 0 2px 4px 0, rgba(32, 43, 55, .38) 0 24px 48px -24px; }
.d-whatsapp-ventana svg { width: 100% !important; height: auto !important; }
.d-whatsapp-pastilla { position: absolute; left: 6.07%; bottom: 15.8%; display: inline-flex; align-items: center; gap: 10px; padding: 10px 18px 10px 14px; border-radius: 999px; border: 1px solid rgba(255, 255, 255, .85); background-image: linear-gradient(rgba(255, 255, 255, .9), rgba(255, 255, 255, .68)); box-shadow: #FFFFFF 0 1px 0 0 inset, rgba(47, 111, 237, .08) 0 0 0 1px, rgba(32, 43, 55, .42) 0 14px 30px -14px; font-size: 15px; line-height: 18px; font-weight: 500; color: var(--ink); white-space: nowrap; }
.d-whatsapp-comp2 .d-whatsapp-pastilla, .d-whatsapp-comp3 .d-whatsapp-pastilla { background-image: linear-gradient(rgba(236, 242, 255, .94), rgba(222, 233, 254, .82)); color: var(--marino); }
.d-whatsapp-pastilla-ic { display: inline-flex; color: var(--azul); }
.d-whatsapp-copy { min-width: 0; }
.d-whatsapp-etiqueta { display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px 6px 10px; border-radius: 999px; background: rgba(255, 255, 255, .78); border: 1px solid rgba(47, 111, 237, .18); font-size: 13px; line-height: 17.55px; font-weight: 500; color: var(--marino); }
.d-whatsapp-etiqueta svg { color: var(--azul); }
.d-whatsapp-h3 { margin-top: 15px; font-size: 28px; line-height: 32.2px; font-weight: 700; letter-spacing: -.84px; color: var(--ink); }
.d-whatsapp-p { margin-top: 12px; max-width: 532px; font-size: 16px; line-height: 24.8px; color: var(--gris2); }
.d-whatsapp-p a, .d-whatsapp-resp a { color: var(--azul); text-decoration: underline; text-underline-offset: 2px; }

/* ── «Todo lo que incluye» ── */
.d-whatsapp-incl-sec { padding: 64px 0; scroll-margin-top: 80px; }
.d-whatsapp-lista { margin-top: 64px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px 32px; }
.d-whatsapp-li { display: flex; gap: 14px; padding: 16px 0; border-top: 1px solid var(--linea); }
.d-whatsapp-tile { flex: none; width: 36px; height: 36px; border-radius: 10px; border: 1px solid #DCE7FC; background-image: linear-gradient(145deg, #F4F8FF, #E3ECFE); display: flex; align-items: center; justify-content: center; color: var(--azul); }
.d-whatsapp-li-txt { display: grid; gap: 2px; min-width: 0; }
.d-whatsapp-li-txt strong { font-size: 15px; line-height: 20.25px; font-weight: 600; color: var(--ink); }
.d-whatsapp-li-txt > span { font-size: 14px; line-height: 20.3px; color: var(--gris2); }

/* ── El caso: su sección oscura de testimonios ── */
.d-whatsapp-caso { background: #12141C; padding: 128px 0; margin-top: 64px; }
.d-whatsapp-h2-claro { max-width: none; color: #FFFFFF; }
.d-whatsapp-h2-claro em { color: #A2A7B6; }
.d-whatsapp-testis { margin-top: 64px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 48px 32px; }
.d-whatsapp-testi { display: flex; flex-direction: column; gap: 16px; }
.d-whatsapp-media { position: relative; aspect-ratio: 1 / 1; border-radius: 18px; background: #000000; overflow: hidden; }
.d-whatsapp-media video { width: 100%; height: 100%; object-fit: cover; transition: transform .26s; }
.d-whatsapp-media:hover video { transform: scale(1.03); }
.d-whatsapp-media-meses { display: flex; align-items: flex-end; justify-content: center; gap: 22px; padding: 36px 36px 28px; background: radial-gradient(80% 60% at 50% 100%, rgba(47, 111, 237, .35), rgba(0, 0, 0, 0) 70%), #000000; }
.d-whatsapp-mes { height: 100%; flex: 1 1 0; max-width: 72px; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; gap: 10px; }
.d-whatsapp-mes-barra { width: 100%; border-radius: 12px 12px 4px 4px; background: linear-gradient(#5B8CF0, #2F6FED); }
.d-whatsapp-mes-oro { background: linear-gradient(#F7D078, #F2B01E); }
.d-whatsapp-mes-v { font-size: 16px; line-height: 19.6px; font-weight: 700; color: #FFFFFF; }
.d-whatsapp-mes-l { font-size: 13px; line-height: 18.2px; color: #A2A7B6; }
.d-whatsapp-cita p { font-size: 18px; line-height: 27px; color: #FFFFFF; }
.d-whatsapp-cita strong { font-weight: 600; }
.d-whatsapp-persona { display: grid; gap: 2px; font-size: 14px; line-height: 19.6px; color: #A2A7B6; }
.d-whatsapp-persona strong { font-weight: 600; color: #FFFFFF; }

/* ── Preguntas ── */
.d-whatsapp-faq { padding: 110px 0; display: grid; grid-template-columns: 489.14fr 597.86fr; gap: 65px; scroll-margin-top: 80px; }
.d-whatsapp-textlink { display: inline-flex; align-items: center; gap: 18px; margin-top: 23px; padding: 11px 0; font-size: 14px; line-height: 21.7px; font-weight: 500; color: var(--azul); }
.d-whatsapp-textlink:hover { color: var(--azul-h); }
.d-whatsapp-det { border-bottom: 1px solid var(--linea); padding: 22px 0; }
.d-whatsapp-det:first-child { border-top: 1px solid var(--linea); }
.d-whatsapp-sum { list-style: none; display: flex; justify-content: space-between; align-items: center; gap: 22px; cursor: pointer; font-size: 16px; line-height: 23.2px; font-weight: 500; color: var(--ink); }
.d-whatsapp-sum::-webkit-details-marker { display: none; }
.d-whatsapp-mas { flex: none; width: 14px; font-size: 24px; line-height: 23.2px; font-weight: 400; color: var(--gris); text-align: center; transition: transform .2s; }
.d-whatsapp-det[open] .d-whatsapp-mas { transform: rotate(45deg); }
.d-whatsapp-resp { margin-top: 18px; padding-right: 20px; font-size: 14px; line-height: 23.8px; color: var(--gris2); }

/* ── El panel del cierre ── */
.d-whatsapp-panel-sec { padding: 18px 0 128px; }
.d-whatsapp-panel { border-radius: 24px; border: 1px solid rgba(255, 255, 255, .8);
  background-image: var(--ruido), radial-gradient(60% 85% at 92% 88%, rgba(47, 111, 237, .4), rgba(0, 0, 0, 0) 70%), radial-gradient(45% 65% at 72% 0%, rgba(165, 196, 245, .35), rgba(0, 0, 0, 0) 70%), radial-gradient(55% 70% at 4% 6%, rgba(255, 255, 255, .85), rgba(0, 0, 0, 0) 70%), linear-gradient(120deg, #F5F8FF, #E5EDFD);
  background-size: 160px auto, auto, auto, auto, auto;
  box-shadow: rgba(255, 255, 255, .9) 0 1px 0 0 inset, rgba(47, 111, 237, .09) 0 0 0 1px, rgba(32, 43, 55, .16) 0 18px 40px -16px; }
.d-whatsapp-panel-in { display: grid; grid-template-columns: 548.89fr 449.11fr; gap: 40px; align-items: center; padding: 56px; }
.d-whatsapp-panel-txt .d-whatsapp-acciones { margin-top: 32px; }
.d-whatsapp-panel-p { margin-top: 16px; max-width: 420px; }
.d-whatsapp-btn-panel { border-radius: 8px; gap: 16px; }
.d-whatsapp-orbita { position: relative; width: 400px; height: 400px; justify-self: center; }
.d-whatsapp-anillos { position: absolute; inset: 0; width: 100%; height: 100%; }
.d-whatsapp-anillos circle { fill: none; stroke: rgba(47, 111, 237, .38); stroke-width: 1.25px; }
.d-whatsapp-hub { position: absolute; left: 50%; top: 50%; width: 136px; height: 84px; margin: -42px 0 0 -68px; display: flex; align-items: center; justify-content: center; background: #FFFFFF; border: 1px solid #DEDFF4; border-radius: 22px; box-shadow: rgba(47, 111, 237, .18) 0 8px 28px -8px, rgba(32, 43, 55, .03) 0 2px 4px 0; }
.d-whatsapp-orbitador { position: absolute; left: 50%; top: 50%; width: 44px; height: 44px; margin: -22px 0 0 -22px; display: flex; align-items: center; justify-content: center; background: #FFFFFF; border: 1px solid #E2E3EF; border-radius: 16px; box-shadow: rgba(32, 43, 55, .12) 0 5px 14px -4px;
  transform: rotate(var(--d-whatsapp-ang)) translateY(var(--d-whatsapp-r)) rotate(calc(-1 * var(--d-whatsapp-ang))); animation-name: d-whatsapp-orbita; animation-timing-function: linear; animation-iteration-count: infinite; }
.d-whatsapp-orbitador-inv { animation-direction: reverse; }
.d-whatsapp-orbitador img { width: 22px; height: 22px; object-fit: contain; }
@keyframes d-whatsapp-orbita { 0% { transform: rotate(0deg) translateY(var(--d-whatsapp-r)) rotate(0deg); } 100% { transform: rotate(1turn) translateY(var(--d-whatsapp-r)) rotate(-1turn); } }

/* ── El pie ── */
.d-whatsapp-pie { position: relative; background: #F8F7FC; border-top: 1px solid #E7E4EE; padding: 72px 0 28px; overflow: hidden; }
.d-whatsapp-pie-in { width: min(1152px, calc(100% - 40px)); margin: 0 auto; display: grid; gap: 52px; position: relative; z-index: 1; }
.d-whatsapp-ident { display: grid; gap: 26px; justify-items: start; }
.d-whatsapp-contacto { display: grid; gap: 3px; }
.d-whatsapp-contacto-l { font-size: 13px; line-height: 19.5px; font-weight: 500; color: var(--ink); }
.d-whatsapp-contacto-a { padding: 4px 0; font-size: 14px; line-height: 21px; color: var(--gris3); }
.d-whatsapp-contacto-a:hover, .d-whatsapp-grupo-a:hover, .d-whatsapp-legal a:hover { color: var(--azul); }
.d-whatsapp-grupos { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 32px 28px; }
.d-whatsapp-grupo-h { padding: 5px 0; font-size: 15px; line-height: 21px; font-weight: 500; color: var(--ink); letter-spacing: normal; }
.d-whatsapp-grupo-ul { margin-top: 12px; display: grid; gap: 4px; }
.d-whatsapp-grupo-a { display: inline-block; padding: 5px 0; font-size: 14px; line-height: 21px; color: var(--gris3); }
.d-whatsapp-bajo { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 16px 32px; padding-top: 22px; border-top: 1px solid #E4E0EC; font-size: 12px; line-height: 18px; color: var(--gris4); }
.d-whatsapp-legal { display: flex; gap: 32px; }
.d-whatsapp-legal a { padding: 5px 0; }
.d-whatsapp-firma { position: relative; margin: 56px 20px 0; height: 176px; overflow: hidden; font-size: 236px; line-height: 176px; font-weight: 700; letter-spacing: -8px; background-image: linear-gradient(rgba(47, 111, 237, .26), rgba(47, 111, 237, .08) 70%, rgba(47, 111, 237, 0)); -webkit-background-clip: text; background-clip: text; color: transparent; user-select: none; }

/* ── Teléfono (su corte de 767 px) ── */
@media (max-width: 1100px) {
  .d-whatsapp-links { display: none; }
}
@media (max-width: 1023px) {
  .d-whatsapp-hero-grid { grid-template-columns: minmax(0, 1fr); }
  .d-whatsapp-stage { width: 100%; max-width: 635px; justify-self: center; }
  .d-whatsapp-grupos { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 767px) {
  .d-whatsapp-hdr { height: 68px; padding-top: 8px; }
  .d-whatsapp-hdr-in { height: 60px; padding: 0 10px 0 21px; }
  .d-whatsapp-marca span:last-child { font-size: 18px !important; }
  .d-whatsapp-ctrl { display: none; }
  .d-whatsapp-menu { display: block; }
  .d-whatsapp-hero { padding: 32px 0 24px; }
  .d-whatsapp-hero-grid { grid-template-columns: minmax(0, 1fr); gap: 20px; }
  .d-whatsapp-h1 { font-size: 32.76px; line-height: 35.38px; letter-spacing: -1.3104px; margin-top: 18px; }
  .d-whatsapp-hero-p { font-size: 18px; line-height: 26.1px; letter-spacing: -.36px; }
  .d-whatsapp-btn-hero { font-size: 13px; line-height: 18.2px; }
  .d-whatsapp-stage { height: auto; padding: 14px 12px 12px; margin-top: 14px; }
  .d-whatsapp-canales { top: -15px; right: 16px; gap: 6px; }
  .d-whatsapp-canal { width: 34px; height: 34px; }
  .d-whatsapp-canal img { width: 18px; height: 18px; }
  .d-whatsapp-fig { position: relative; left: auto; top: auto; width: 100%; }
  .d-whatsapp-pantalla { height: auto; aspect-ratio: 4 / 3; }
  .d-whatsapp-nota { position: relative; left: auto; top: auto; width: auto; margin: -38px 12px 0; padding: 16px; }
  .d-whatsapp-nota-p { margin-top: 10px; }
  .d-whatsapp-tabs { position: relative; left: auto; right: auto; bottom: auto; margin-top: 12px; }
  .d-whatsapp-cmp-sec { padding: 48px 0; }
  .d-whatsapp-cmp-h2 { font-size: 30px; line-height: 34.8px; letter-spacing: -1.05px; text-align: left; }
  .d-whatsapp-marco { margin-top: 28px; padding: 22px 20px; }
  .d-whatsapp-libro::before { display: none; }
  .d-whatsapp-tabla, .d-whatsapp-tabla tbody, .d-whatsapp-tabla tr, .d-whatsapp-tabla th, .d-whatsapp-tabla td { display: block; width: 100%; }
  .d-whatsapp-tabla thead, .d-whatsapp-tabla colgroup { display: none; }
  .d-whatsapp-fila + .d-whatsapp-fila { margin-top: 22px; padding-top: 22px; border-top: 1px solid rgba(32, 43, 55, .1); }
  .d-whatsapp-tema { padding: 0; border-top: 0; }
  .d-whatsapp-sin { padding: 14px 0 0; border-top: 0; font-size: 16px; line-height: 24.8px; }
  .d-whatsapp-con { margin-top: 14px; padding: 16px; border-radius: 18px; border: 1px solid rgba(255, 255, 255, .8); font-size: 16px; line-height: 24.8px; box-shadow: #FFFFFF 0 1px 0 0 inset;
    background-image: var(--ruido), radial-gradient(70% 40% at 100% 0%, rgba(247, 208, 120, .26), rgba(0, 0, 0, 0) 70%), radial-gradient(80% 45% at 0% 100%, rgba(47, 111, 237, .2), rgba(0, 0, 0, 0) 70%), linear-gradient(#EEF4FF, #DCE7FD);
    background-size: 160px auto, auto, auto, auto; }
  .d-whatsapp-movil { display: block; font-size: 13px; line-height: 20.15px; font-weight: 500; color: var(--gris2); }
  .d-whatsapp-movil-con { color: var(--azul); }
  .d-whatsapp-top { flex-direction: column; align-items: flex-start; gap: 12px; }
  .d-whatsapp-h2, .d-whatsapp-h2-46 { font-size: 30px; line-height: 32.4px; letter-spacing: -1.05px; max-width: none; }
  .d-whatsapp-piezas-sec { padding: 72px 0; }
  .d-whatsapp-piezas { margin-top: 36px; grid-template-columns: minmax(0, 1fr); gap: 56px; }
  .d-whatsapp-pastilla { font-size: 13px; line-height: 15.6px; padding: 8px 14px 8px 10px; }
  .d-whatsapp-h3 { font-size: 22px; line-height: 25.3px; letter-spacing: -.66px; }
  .d-whatsapp-p { font-size: 15px; line-height: 23.25px; }
  .d-whatsapp-incl-sec { padding: 36px 0; }
  .d-whatsapp-lista { margin-top: 36px; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 16px; }
  .d-whatsapp-li { gap: 10px; padding: 12px 0; align-items: flex-start; }
  .d-whatsapp-tile { width: 30px; height: 30px; border-radius: 9px; }
  .d-whatsapp-li-txt strong { font-size: 14px; line-height: 18.9px; }
  .d-whatsapp-li-txt > span { display: none; }
  .d-whatsapp-caso { padding: 72px 0; margin-top: 36px; }
  .d-whatsapp-testis { margin-top: 36px; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 32px 14px; }
  .d-whatsapp-media { border-radius: 14px; }
  .d-whatsapp-media-meses { gap: 10px; padding: 18px 14px 14px; }
  .d-whatsapp-mes-v { font-size: 12px; line-height: 15px; }
  .d-whatsapp-mes-l { font-size: 11px; line-height: 14px; }
  .d-whatsapp-cita p { font-size: 14px; line-height: 21px; }
  .d-whatsapp-persona { font-size: 13px; line-height: 18.2px; }
  .d-whatsapp-faq { padding: 65px 0; grid-template-columns: minmax(0, 1fr); gap: 25px; }
  .d-whatsapp-panel-sec { padding: 0 0 72px; }
  .d-whatsapp-panel-in { grid-template-columns: minmax(0, 1fr); gap: 28px; padding: 28px 24px; }
  .d-whatsapp-panel-txt .d-whatsapp-btn { width: 100%; }
  .d-whatsapp-orbita { width: 300px; height: 300px; }
  .d-whatsapp-orbitador { animation-name: d-whatsapp-orbita-chica; transform: rotate(var(--d-whatsapp-ang)) translateY(calc(var(--d-whatsapp-r) * .75)) rotate(calc(-1 * var(--d-whatsapp-ang))); }
  .d-whatsapp-pie { padding-top: 48px; }
  .d-whatsapp-grupos { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 28px 24px; }
  .d-whatsapp-firma { font-size: 120px; line-height: 96px; height: 96px; letter-spacing: -4px; margin: 40px 20px 0; }
}
@keyframes d-whatsapp-orbita-chica { 0% { transform: rotate(0deg) translateY(calc(var(--d-whatsapp-r) * .75)) rotate(0deg); } 100% { transform: rotate(1turn) translateY(calc(var(--d-whatsapp-r) * .75)) rotate(-1turn); } }
@media (prefers-reduced-motion: reduce) {
  .d-whatsapp *, .d-whatsapp *::before, .d-whatsapp *::after { animation: none !important; transition: none !important; }
}
`;

const CSS = BASE + TABS;
