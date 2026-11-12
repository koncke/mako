// =============================================================================
// /vsl/mako con el DISEÑO de la portada de Holo (https://tryholo.ai/), copiado el 11/11/2026
// =============================================================================
// Los valores (la escala de títulos, el fondo #0A0B14 de la mitad oscura, las tres píldoras de la barra, el hero de dos
// columnas 487/560 con sus chips de vidrio, las tarjetas inclinadas, el «cómo funciona» en círculo, las tarjetas de
// «Proactive», la tarjeta de resultados, las tarjetas blancas de radio 28 con su sombra de tres capas, la sección semana a
// semana, el carrusel de cajas #F7F7F7, la privacidad sobre el degradado gris, las preguntas en cajas #F5F6F8 y el pie
// #FAFAFA de cuatro columnas) se leyeron con getComputedStyle a 1440 y 390 px: docs/diseno/landings-competencia/mako.md.
// La letra de Holo es «NEXT Book» (propietaria): va Figtree (Google Fonts, OFL), la más parecida medida al lado (el ancho de
// «Your Marketing» a 60,64 px da 415 px contra los 417 de Holo), bajada a public/vsl-assets/fuentes/figtree/.
// De MaKo quedan el logo, el azul #2F6FED y el dorado donde Holo pone su degradado naranja-rosa-azul (los botones, el borde
// del botón de la barra, la palabra que brilla del título, la línea de la semana activa), el botón de la llamada, el caso de
// Mauricio y los textos. El visual del hero es propio: el chat de MaKo con una tarjeta que espera tu sí (el de /vsl/mako
// era una respuesta del media buyer, que es del CoPilot y no del Ops Center).
//
// Secciones de la referencia que NO van, y por qué:
//   · La píldora de «4.6/5 from 4,268 customers», la tira de logos de redes con su contador de contenido creado, los
//     sellos de «Security & compliance», «Holo runs your ads…» con sus tres columnas, el carrusel de anuncios con sus
//     87 % / 11x / 23 h / 51 %, los testimonios de «Less anxiety, more business», «Rated 4.6/5» con sus premios G2 y
//     «Backed by leading investors»: son contadores, sellos, premios, inversores o testimonios suyos (la regla de /vsl).
//   · La tarjeta «Support available 24/7» al lado de las preguntas: MaKo no tiene ese contenido (lo de los tickets va en
//     una pregunta). Las tres columnas angostas que se asoman al lado de la tarjeta de resultados son OTROS clientes: no van.
//   · Los muñecos de Holo (su mascota) en las tarjetas y el del cierre, y las flechas del carrusel (piden JavaScript).
// Lo que se agregó porque la landing de MaKo lo trae y Holo no: el título de las tarjetas inclinadas, de las tarjetas de
// «Any niche» y la bajada de «Proactive», con la tipografía de los títulos de sección de Holo.
// 12/11/2026 (Martín: «Your Marketing Department. One Hire… eso estaría bueno copiarlo»): los textos de Holo van traducidos
// (../mako.ts); las tarjetas inclinadas son cuatro, como las suyas, una por departamento de MaKo, con su dibujo
// (DIBUJO_DEPARTAMENTO); la tercera tarjeta de «Any…» es «Any integration» con lo que se conecta en Integraciones, y el cierre
// dice «Pon a trabajar hoy tu departamento de marketing.» (su «Approve your first week…» habla de contenido que MaKo no arma solo).
// Server component, sin JavaScript: las preguntas son <details>, el carrusel es un scroll con snap, las animaciones son CSS
// y se apagan con prefers-reduced-motion.
// =============================================================================

import type { PropsDiseno } from '.';
import type { Bloque } from '../tipos';
import { RUTA_CTA, CASO, EstrellaMaKo, LogoMaKo, MAKO, TEXTO_CTA, html, otrasFunciones, TEXTO_CIERRE } from '../marca';
import { FEATURE_VISUALS } from '../../_detalle/feature-visuals';
import { Visual } from '../../_detalle/Visual';

type B<T extends Bloque['tipo']> = Extract<Bloque, { tipo: T }>;

function Ico({ paths, size = 20, grosor = 1.8 }: { paths?: string[]; size?: number; grosor?: number }) {
  if (!paths?.length) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={grosor} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths.map((d) => <path key={d} d={d} />)}
    </svg>
  );
}

function Flecha({ size = 18 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="M13 6l6 6l-6 6" /></svg>;
}

/** Su botón «Try Holo»: la píldora de 50 px con el degradado y el brillo blanco adentro (el degradado, en azul y dorado). */
function Boton({ chico = false }: { chico?: boolean }) {
  return <a href={RUTA_CTA} className={`d-mako-btn${chico ? ' d-mako-btn-chico' : ''}`}>{TEXTO_CTA}<Flecha size={chico ? 16 : 18} /></a>;
}

const I = {
  chat: ['M3 21l1.65 -3.8a9 9 0 1 1 3.4 2.9l-5.05 .9'],
  check: ['M9 11l3 3l8 -8', 'M20 12v6a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h9'],
  escudo: ['M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3', 'M9 12l2 2l4 -4'],
  ia: ['M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3l5.8 1.9l-5.8 1.9a2 2 0 0 0 -1.3 1.3l-1.9 5.8l-1.9 -5.8a2 2 0 0 0 -1.3 -1.3l-5.8 -1.9l5.8 -1.9a2 2 0 0 0 1.3 -1.3z'],
  lupa: ['M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0', 'M21 21l-6 -6'],
  crm: ['M4 4h4v16h-4z', 'M10 4h4v10h-4z', 'M16 4h4v6h-4z'],
  wa: ['M3 21l1.65 -3.8a9 9 0 1 1 3.4 2.9l-5.05 .9'],
  llamada: ['M5 4h4l2 5l-2.5 1.5a11 11 0 0 0 5 5l1.5 -2.5l5 2v4a2 2 0 0 1 -2 2a16 16 0 0 1 -15 -15a2 2 0 0 1 2 -2'],
  mapa: ['M6 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0', 'M18 6m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0', 'M18 18m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0', 'M8.7 10.7l6.6 -3.4', 'M8.7 13.3l6.6 3.4'],
  enviar: ['M10 14l11 -11', 'M21 3l-6.5 18a.55 .55 0 0 1 -1 0l-3.5 -7l-7 -3.5a.55 .55 0 0 1 0 -1l18 -6.5'],
};

// ── El visual del hero: el chat de MaKo con la tarjeta que espera tu sí (los textos de la tarjeta son los de la app:
//    «Aprobación pendiente» de lib/mako-gramatica.ts, el botón con el nombre de la acción y «No ejecutar la acción» de
//    app/m/mako/chat-ui.ts; «Escribe a MaKo» es la caja de app/second-brain/PiezasCliente.tsx). Los chips de vidrio son los de
//    Holo, con lo que MaKo lee de tu negocio. ─────────────────────────────────────────────────────────────────────────
function VisualChat() {
  return (
    <div className="d-mako-vis" aria-hidden="true">
      <div className="d-mako-vis-glow" />
      <div className="d-mako-chat">
        <div className="d-mako-chat-top">
          <span className="d-mako-chat-av"><EstrellaMaKo size={15} /></span>
          <span className="d-mako-chat-n">MaKo</span>
          <span className="d-mako-chat-s">Ops Center</span>
        </div>
        <div className="d-mako-chat-yo">Laura ya agendó su llamada. Pásala de etapa.</div>
        <div className="d-mako-chat-mk">
          <span className="d-mako-chat-av d-mako-chat-av-chico"><EstrellaMaKo size={11} /></span>
          <div className="d-mako-tarj">
            <div className="d-mako-tarj-cab"><span className="d-mako-tarj-pill">Aprobación pendiente</span></div>
            <div className="d-mako-tarj-t">Mover un lead de etapa</div>
            <div className="d-mako-tarj-r">Laura pasa a «Agendó».</div>
            <div className="d-mako-tarj-l"><span>Etapa</span><span>Contactado <b>→</b> Agendó</span></div>
            <div className="d-mako-tarj-bot"><span className="d-mako-tarj-si">Mover un lead de etapa</span><span className="d-mako-tarj-no">No ejecutar la acción</span></div>
          </div>
        </div>
        <div className="d-mako-chat-caja"><span>Escribe a MaKo</span><span className="d-mako-chat-env"><Ico paths={I.enviar} size={14} grosor={2} /></span></div>
      </div>
      <span className="d-mako-chip d-mako-chip-1"><b><Ico paths={I.crm} size={13} grosor={2.2} />Tu CRM</b><small>Leads y etapas</small></span>
      <span className="d-mako-chip d-mako-chip-2"><b><Ico paths={I.wa} size={13} grosor={2.2} />Tus chats</b><small>WhatsApp</small></span>
      <span className="d-mako-chip d-mako-chip-3"><b><Ico paths={I.llamada} size={13} grosor={2.2} />Tus llamadas</b><small>Grabadas</small></span>
      <span className="d-mako-chip d-mako-chip-4"><b><Ico paths={I.mapa} size={13} grosor={2.2} />Tu Second Brain</b><small>Tu oferta y tu funnel</small></span>
    </div>
  );
}

function Hero({ b }: { b: B<'hero'> }) {
  return (
    <header className="d-mako-hero">
      <div className="d-mako-w d-mako-hero-g">
        <div className="d-mako-hero-txt">
          <span className="d-mako-etq"><span className="d-mako-etq-ico"><EstrellaMaKo size={14} /></span>{b.etiqueta}</span>
          <h1 className="d-mako-h1" dangerouslySetInnerHTML={html(b.titulo)} />
          <p className="d-mako-bajada" dangerouslySetInnerHTML={html(b.bajada)} />
          <div className="d-mako-hero-cta"><Boton /></div>
          {b.puntos?.length ? (
            <ul className="d-mako-confia">
              {b.puntos.map((p, i) => (
                <li key={p}><Ico paths={i === 0 ? I.chat : I.escudo} size={24} grosor={1.6} /><span dangerouslySetInnerHTML={html(p)} /></li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="d-mako-hero-vis"><VisualChat /></div>
      </div>
    </header>
  );
}

// ── «Ads that sell. Socials that grow. SEO that ranks. Emails that convert.» (12/11/2026): sus cuatro tarjetas son los cuatro
//    departamentos de MaKo, en el orden de ../mako.ts (anuncios, contenido, landings, mensajes). Cada una lleva el dibujo de
//    lo suyo: el chat de Ads Writer y la conversación de un seguimiento (los gráficos de FEATURE_VISUALS de esas landings, sin
//    cifras) y dos dibujos propios con los nombres reales de las pantallas («Encuentra tu siguiente OUTLIER» de Image, el
//    formulario que entra al CRM de Web Generator). Ninguno lleva un número. ──────────────────────────────────────────────
function MockCarruseles() {
  const tonos = ['#1F2028', '#2F6FED', '#FDF1D6'];
  return (
    <div className="d-mako-dep" aria-hidden="true">
      <p className="d-mako-dep-h">Encuentra tu siguiente <span>OUTLIER</span></p>
      <div className="d-mako-dep-grilla">
        {tonos.map((t, i) => (
          <span key={t} className="d-mako-dep-car">
            <span className="d-mako-dep-lam" style={{ background: t }}>
              <i className="d-mako-dep-pill">Outlier</i>
              <i className="d-mako-dep-l" style={{ background: i === 2 ? '#1F2028' : '#fff' }} />
              <i className="d-mako-dep-l d-mako-dep-l2" style={{ background: i === 2 ? '#1F2028' : '#fff' }} />
            </span>
            <span className="d-mako-dep-editar">Editar</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function MockLanding() {
  return (
    <div className="d-mako-dep" aria-hidden="true">
      <div className="d-mako-dep-nav"><i /><i /><i /><span>hola-mako.site</span></div>
      <div className="d-mako-dep-pag">
        <i className="d-mako-dep-t" /><i className="d-mako-dep-t d-mako-dep-t2" />
        <span className="d-mako-dep-campos"><span>Nombre</span><span>WhatsApp</span></span>
        <span className="d-mako-dep-boton">Quiero mi llamada</span>
      </div>
      <span className="d-mako-dep-chip">Nuevo lead en tu CRM</span>
    </div>
  );
}

const DIBUJO_DEPARTAMENTO = [
  () => <Visual spec={FEATURE_VISUALS.ads?.groups?.[3]} />,
  () => <MockCarruseles />,
  () => <MockLanding />,
  () => <Visual spec={FEATURE_VISUALS.seguimiento?.groups?.[1]} />,
];
const ICONO_DEPARTAMENTO = [
  ['M18 8a3 3 0 0 1 0 6', 'M10 8v11a1 1 0 0 1 -1 1h-1a1 1 0 0 1 -1 -1v-5', 'M12 8h0l4.524 -3.77a.9 .9 0 0 1 1.476 .692v12.156a.9 .9 0 0 1 -1.476 .692l-4.524 -3.77h-8a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1h8'],
  ['M12 4l-8 4l8 4l8 -4l-8 -4', 'M4 12l8 4l8 -4', 'M4 16l8 4l8 -4'],
  ['M3 5a1 1 0 0 1 1 -1h16a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1z', 'M3 9h18', 'M7 6.5h.01', 'M10 6.5h.01'],
  I.chat,
];

/** «Ads that sell. Socials that grow…»: sus cuatro tarjetas inclinadas, con los departamentos de MaKo y su dibujo. */
function Inclinadas({ b }: { b: B<'filas'> }) {
  return (
    <section className="d-mako-s d-mako-oscuro d-mako-incl">
      <div className="d-mako-w">
        <h2 className="d-mako-h2 d-mako-centro" dangerouslySetInnerHTML={html(b.titulo)} />
      </div>
      <div className="d-mako-incl-fila">
        {b.items.map((f, i) => {
          const Dibujo = DIBUJO_DEPARTAMENTO[i];
          return (
            <article key={f.titulo} className="d-mako-incl-t">
              <span className={`d-mako-incl-ico d-mako-incl-ico-${i % 3}`}><Ico paths={ICONO_DEPARTAMENTO[i] ?? I.chat} size={24} grosor={2} /></span>
              <h3 className="d-mako-incl-h" dangerouslySetInnerHTML={html(f.titulo)} />
              <p className="d-mako-incl-p" dangerouslySetInnerHTML={html(f.texto)} />
              {f.puntos?.length ? <ul className="d-mako-incl-l">{f.puntos.map((p) => <li key={p} dangerouslySetInnerHTML={html(p)} />)}</ul> : null}
              <div className="d-mako-incl-vis">{Dibujo ? <Dibujo /> : <Visual spec={FEATURE_VISUALS[b.slug]?.groups?.[f.grafico ?? i]} />}</div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

/** «How it works? It's as easy as 1, 2, 3…»: los pasos alrededor de un centro, cada uno con su tarjeta blanca. */
function Como({ b }: { b: B<'pasos'> }) {
  return (
    <section className="d-mako-s d-mako-oscuro d-mako-como" id="como">
      <div className="d-mako-w">
        <div className="d-mako-cab">
          <h2 className="d-mako-h2" dangerouslySetInnerHTML={html(b.titulo)} />
          {b.bajada ? <p className="d-mako-cab-p" dangerouslySetInnerHTML={html(b.bajada)} /> : null}
        </div>
        <div className="d-mako-como-esc">
          <div className="d-mako-como-aros" aria-hidden="true"><span /><span /><span /></div>
          {b.pasos.map((p, i) => (
            <div key={p.titulo} className={`d-mako-como-p d-mako-como-p${i + 1}`}>
              <p className="d-mako-como-t"><span>{i + 1}.</span> <span dangerouslySetInnerHTML={html(p.titulo)} /></p>
              <div className="d-mako-como-card" dangerouslySetInnerHTML={html(p.texto)} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** «Proactive. No prompt needed.»: sus seis tarjetas de vidrio con la píldora blanca arriba. */
function Proactivo({ b }: { b: B<'tarjetas'> }) {
  return (
    <section className="d-mako-s d-mako-oscuro d-mako-pro" id="sugiere">
      <div className="d-mako-w">
        <div className="d-mako-pro-cab">
          <div>
            <h2 className="d-mako-h2" dangerouslySetInnerHTML={html(b.titulo)} />
            {b.bajada ? <p className="d-mako-pro-baj" dangerouslySetInnerHTML={html(b.bajada)} /> : null}
          </div>
          <Boton />
        </div>
        <div className="d-mako-pro-g">
          {b.items.map((it, i) => (
            <article key={it.titulo} className="d-mako-pro-t">
              <span className="d-mako-pro-chip"><span className={`d-mako-pro-chip-i d-mako-pro-chip-i${i % 2}`}><Ico paths={it.icono} size={18} grosor={2} /></span><span className="d-mako-pro-chip-t" dangerouslySetInnerHTML={html(it.titulo)} /></span>
              <p className="d-mako-pro-p" dangerouslySetInnerHTML={html(it.texto)} />
              {it.meta ? <span className="d-mako-pro-meta">{it.meta}</span> : null}
              <span className={`d-mako-pro-art d-mako-pro-art${i % 2}`} aria-hidden="true"><Ico paths={it.icono} size={58} grosor={1.3} /></span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/** «Real customer results»: su fila del número grande y la tarjeta de rendimiento, con el caso de Mauricio. */
function Caso() {
  return (
    <section className="d-mako-oscuro d-mako-caso">
      <div className="d-mako-w">
        <div className="d-mako-caso-top">
          <p className="d-mako-caso-t" dangerouslySetInnerHTML={html(CASO.titulo)} />
          <span className="d-mako-caso-sep" aria-hidden="true" />
          <p className="d-mako-caso-num">{CASO.meses[2].monto}</p>
          <div className="d-mako-caso-barra">
            <span className="d-mako-caso-pista"><span /></span>
            <p className="d-mako-caso-lab">en {CASO.meses[2].mes.toLowerCase()}</p>
          </div>
        </div>
        <div className="d-mako-caso-card">
          <div className="d-mako-caso-in">
            <div className="d-mako-caso-cab">
              <p className="d-mako-caso-quien">{CASO.quien}</p>
              <span className="d-mako-caso-rol">{CASO.rol}</span>
            </div>
            <div className="d-mako-caso-stats">
              {CASO.meses.map((m, i) => (
                <div key={m.mes} className={`d-mako-caso-st${i === 0 ? ' d-mako-caso-st-on' : ''}`}><span>{m.mes}</span><p>{m.monto}</p></div>
              ))}
            </div>
            <div className="d-mako-caso-cuerpo">
              <video className="d-mako-caso-video" muted autoPlay loop playsInline preload="metadata"><source src={CASO.video} type="video/mp4" /></video>
              <div className="d-mako-caso-hist">
                {CASO.historia.map((h) => <p key={h} dangerouslySetInnerHTML={html(h)} />)}
                <p className="d-mako-caso-res" dangerouslySetInnerHTML={html(CASO.resultado)} />
              </div>
            </div>
          </div>
          <p className="d-mako-caso-pie">{CASO.sub}</p>
        </div>
      </div>
    </section>
  );
}

// «Any niche / Any language / Any integration»: la búsqueda y las píldoras de cada tarjeta, con lo que es cierto de MaKo
// (lo que tiene tu Second Brain, los roles de tu equipo y, desde el 12/11/2026, lo que conectas en Integraciones). El color de cada píldora reparte el azul y el
// dorado donde Holo pone sus naranjas, azules, violetas y rosas; las grises quedan grises.
const PILDORAS: { busca: string; items: { t: string; c: 'a' | 'd' | 'o' | 'g' }[] }[] = [
  { busca: 'Tu oferta', items: [{ t: 'Tu oferta', c: 'd' }, { t: 'Tus clientes', c: 'a' }, { t: 'Tu funnel', c: 'o' }, { t: 'Tu mensaje', c: 'a' }, { t: 'Tu marca', c: 'g' }] },
  { busca: 'Closer', items: [{ t: 'Admin', c: 'g' }, { t: 'Closer', c: 'a' }, { t: 'Setter', c: 'd' }] },
  { busca: 'Calendly', items: [{ t: 'Meta', c: 'a' }, { t: 'Calendly', c: 'd' }, { t: 'Fathom', c: 'o' }, { t: 'Stripe', c: 'a' }, { t: 'Tu IA', c: 'g' }] },
];

function Nicho({ b }: { b: B<'tarjetas'> }) {
  return (
    <section className="d-mako-s d-mako-claro d-mako-nicho">
      <div className="d-mako-w">
        <h2 className="d-mako-h2 d-mako-h2-claro" dangerouslySetInnerHTML={html(b.titulo)} />
        <div className="d-mako-nicho-lista">
          {b.items.map((it, i) => {
            const p = PILDORAS[i % PILDORAS.length];
            return (
              <article key={it.titulo} className="d-mako-nicho-t">
                <div>
                  <h3 className="d-mako-nicho-h" dangerouslySetInnerHTML={html(it.titulo)} />
                  <p className="d-mako-nicho-p" dangerouslySetInnerHTML={html(it.texto)} />
                </div>
                <div className="d-mako-nicho-vis" aria-hidden="true">
                  <div className="d-mako-busca"><Ico paths={I.lupa} size={16} grosor={2.2} /><span>{p.busca}</span><i /></div>
                  <div className="d-mako-pild">{p.items.map((x) => <span key={x.t} className={`d-mako-pild-${x.c}`}>{x.t}</span>)}</div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/** «Early signals, first tweaks / Doubling down on what works»: el título grande, la curva y las semanas abajo. */
function Semanas({ b }: { b: B<'pasos'> }) {
  return (
    <section className="d-mako-s d-mako-claro d-mako-sem">
      <div className="d-mako-w">
        <div className="d-mako-cab">
          <h2 className="d-mako-sem-h" dangerouslySetInnerHTML={html(b.titulo)} />
          {b.bajada ? <p className="d-mako-cab-p d-mako-cab-p-claro" dangerouslySetInnerHTML={html(b.bajada)} /> : null}
        </div>
        <div className="d-mako-sem-graf" aria-hidden="true">
          <svg viewBox="0 0 1080 330" preserveAspectRatio="none">
            <defs>
              <linearGradient id="d-mako-sem-l" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stopColor="#2F6FED" /><stop offset=".55" stopColor="#5B8EF5" /><stop offset="1" stopColor={MAKO.dorado} /></linearGradient>
              <linearGradient id="d-mako-sem-a" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#2F6FED" stopOpacity=".16" /><stop offset="1" stopColor="#2F6FED" stopOpacity=".03" /></linearGradient>
              <radialGradient id="d-mako-sem-g"><stop offset="0" stopColor={MAKO.dorado} stopOpacity=".45" /><stop offset="1" stopColor={MAKO.dorado} stopOpacity="0" /></radialGradient>
            </defs>
            <path d="M0 296 C40 304 80 306 120 304 S200 292 250 294 S330 284 380 276 S460 246 520 238 S600 240 640 236 S690 222 720 205 L720 330 L0 330 Z" fill="url(#d-mako-sem-a)" />
            <path d="M0 296 C40 304 80 306 120 304 S200 292 250 294 S330 284 380 276 S460 246 520 238 S600 240 640 236 S690 222 720 205" fill="none" stroke="url(#d-mako-sem-l)" strokeWidth="2.4" vectorEffect="non-scaling-stroke" />
            <circle cx="720" cy="205" r="95" fill="url(#d-mako-sem-g)" />
            <line x1="720" y1="205" x2="720" y2="330" stroke="#B9C8F5" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          </svg>
          <span className="d-mako-sem-punto" />
        </div>
        <ol className="d-mako-sem-tabs">
          {b.pasos.map((p, i) => (
            <li key={p.titulo} className={i < 2 ? 'd-mako-sem-on' : ''}>
              <p className="d-mako-sem-t">{i + 1}. <span dangerouslySetInnerHTML={html(p.titulo)} /></p>
              <p className="d-mako-sem-x" dangerouslySetInnerHTML={html(p.texto)} />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// Lo que se ve adentro de las tres cajas grises de «Inside…» (Holo pone ahí sus demos): la pantalla de MaKo de cada cosa,
// con sus nombres reales (las tabs, «Aprende solo», lo que tiene el Second Brain). Sin números de uso.
function MockConversaciones() {
  const filas = [
    { t: 'Pasa a Laura a «Agendó»', tab: 'CRM' },
    { t: '¿Qué hago primero hoy?', tab: 'Plan' },
    { t: 'Arma la bienvenida de WhatsApp', tab: 'Automations' },
  ];
  return (
    <div className="d-mako-mock">
      <p className="d-mako-mock-h">Conversaciones</p>
      <div className="d-mako-mock-panel">
        {filas.map((f) => (
          <div key={f.t} className="d-mako-mock-fila"><span>{f.t}</span><i>{f.tab}</i></div>
        ))}
      </div>
    </div>
  );
}

function MockCerebro() {
  const nodos = [
    { t: 'Oferta', x: 52, y: 40 }, { t: 'Clientes', x: 208, y: 40 }, { t: 'Funnel', x: 52, y: 196 }, { t: 'Mensaje', x: 208, y: 196 },
  ];
  return (
    <div className="d-mako-mock d-mako-mock-cerebro">
      <p className="d-mako-mock-h">Second Brain</p>
      <svg viewBox="0 0 260 236" width="100%">
        {nodos.map((n) => <line key={n.t} x1="130" y1="118" x2={n.x} y2={n.y} stroke="#C9D7F8" strokeWidth="1.5" strokeDasharray="4 4" />)}
        <circle cx="130" cy="118" r="34" fill="#2F6FED" />
        <text x="130" y="122" textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff">Tu negocio</text>
        {nodos.map((n, i) => (
          <g key={n.t}>
            <rect x={n.x - 38} y={n.y - 15} width="76" height="30" rx="15" fill={i === 0 ? '#FDF1D6' : '#F3F6FB'} stroke={i === 0 ? '#F2B01E' : '#DCE5F7'} />
            <text x={n.x} y={n.y + 4} textAnchor="middle" fontSize="11.5" fontWeight="700" fill="#1F2028">{n.t}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function MockAprende() {
  return (
    <div className="d-mako-mock">
      <div className="d-mako-mock-tog"><p className="d-mako-mock-h">«Aprende solo»</p><span className="d-mako-mock-sw"><i /></span></div>
      <p className="d-mako-mock-sub">De tus conversaciones de WhatsApp con leads</p>
      <div className="d-mako-mock-panel">
        <div className="d-mako-mock-fila"><span>Objeciones</span><i>WhatsApp</i></div>
        <div className="d-mako-mock-fila"><span>Pedidos</span><i>WhatsApp</i></div>
      </div>
    </div>
  );
}

const MOCKS = [MockConversaciones, MockCerebro, MockAprende];

/** «Inside your new marketing department.»: el carrusel de cajas grises con su leyenda «Título. texto», y debajo la fila
 *  de tarjetitas blancas con su píldora (las tres primeras capacidades van en el carrusel; las otras, en las tarjetitas). */
function Adentro({ b }: { b: B<'tarjetas'> }) {
  const grandes = b.items.slice(0, MOCKS.length);
  const chicas = b.items.slice(MOCKS.length);
  return (
    <section className="d-mako-claro d-mako-dentro">
      <div className="d-mako-w"><h2 className="d-mako-h2 d-mako-h2-claro d-mako-dentro-h" dangerouslySetInnerHTML={html(b.titulo)} /></div>
      <div className="d-mako-dentro-fila">
        {grandes.map((it, i) => {
          const Mock = MOCKS[i];
          return (
            <article key={it.titulo} className="d-mako-dentro-t">
              <div className="d-mako-dentro-caja" aria-hidden="true"><Mock /></div>
              <p className="d-mako-dentro-p"><b dangerouslySetInnerHTML={html(it.titulo + '.')} /> <span dangerouslySetInnerHTML={html(it.texto)} /></p>
            </article>
          );
        })}
      </div>
      {chicas.length ? (
        <div className="d-mako-w d-mako-chicas">
          {chicas.map((it, i) => (
            <article key={it.titulo} className="d-mako-chica">
              <span className="d-mako-chica-chip"><span className={`d-mako-pro-chip-i d-mako-pro-chip-i${(i + 1) % 2}`}><Ico paths={it.icono} size={18} grosor={2} /></span><b dangerouslySetInnerHTML={html(it.titulo)} /></span>
              <p dangerouslySetInnerHTML={html(it.texto)} />
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

/** «With great powers comes great privacy.»: tres tarjetas blancas sobre el degradado gris. */
function Datos({ b }: { b: B<'tarjetas'> }) {
  return (
    <section className="d-mako-s d-mako-datos" id="datos">
      <div className="d-mako-w">
        <h2 className="d-mako-h2 d-mako-h2-claro d-mako-centro d-mako-datos-h" dangerouslySetInnerHTML={html(b.titulo)} />
        <div className="d-mako-datos-g">
          {b.items.map((it) => (
            <article key={it.titulo} className="d-mako-datos-t">
              <span className="d-mako-datos-ico"><Ico paths={it.icono} size={18} grosor={1.8} /></span>
              <p className="d-mako-datos-tt" dangerouslySetInnerHTML={html(it.titulo)} />
              <p className="d-mako-datos-p" dangerouslySetInnerHTML={html(it.texto)} />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/** «Skeptical? Good. Read this.»: el título con su botón y las preguntas en cajas grises. */
function Preguntas({ b }: { b: B<'preguntas'> }) {
  return (
    <section className="d-mako-claro d-mako-faq" id="preguntas">
      <div className="d-mako-faq-w">
        <div className="d-mako-faq-cab">
          <h2 className="d-mako-h2 d-mako-h2-claro" dangerouslySetInnerHTML={html(b.titulo)} />
          <div className="d-mako-faq-btn"><Boton /></div>
        </div>
        <div className="d-mako-faq-lista">
          {b.items.map((q) => (
            <details key={q.p} className="d-mako-faq-i">
              <summary><span>{q.p}</span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6l6 -6" /></svg></summary>
              <p dangerouslySetInnerHTML={html(q.r)} />
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function Seccion({ b, i, bloques }: { b: Bloque; i: number; bloques: Bloque[] }) {
  switch (b.tipo) {
    case 'hero': return <Hero b={b} />;
    case 'filas': return <Inclinadas b={b} />;
    case 'pasos': {
      // El primer «pasos» es «How it works?»; el segundo, la sección semana a semana.
      const primero = bloques.findIndex((x) => x.tipo === 'pasos') === i;
      return primero ? <Como b={b} /> : <Semanas b={b} />;
    }
    case 'tarjetas': {
      // Las cuatro tarjetas de la landing, en el orden de Holo: «Proactive», «Any niche», «Inside…» y la privacidad.
      const n = bloques.slice(0, i).filter((x) => x.tipo === 'tarjetas').length;
      if (n === 0) return <Proactivo b={b} />;
      if (n === 1) return <Nicho b={b} />;
      if (n === 2) return <Adentro b={b} />;
      return <Datos b={b} />;
    }
    case 'caso': return <Caso />;
    case 'preguntas': return <Preguntas b={b} />;
    default: return null;
  }
}

function Pie({ slug }: { slug: string }) {
  const otras = otrasFunciones(slug);
  const cols = [0, 1, 2].map((c) => otras.slice(Math.ceil(otras.length / 3) * c, Math.ceil(otras.length / 3) * (c + 1)));
  return (
    <footer className="d-mako-pie">
      <div className="d-mako-pie-g">
        <div className="d-mako-pie-marca">
          <LogoMaKo className="d-mako-pie-logo" tamano={26} />
          <p>El mejor SaaS para ventas High Ticket, de punta a punta.</p>
        </div>
        {cols.map((col, i) => (
          <nav key={i} className="d-mako-pie-col" aria-label={i === 0 ? 'Funciones de MaKo' : undefined}>
            <h2 aria-hidden={i > 0 || undefined}>{i === 0 ? 'Funciones' : ' '}</h2>
            {col.map((o) => <a key={o.href} href={o.href}>{o.nombre}</a>)}
          </nav>
        ))}
      </div>
      <div className="d-mako-pie-abajo">
        <p>© MaKo — Todos los derechos reservados.</p>
        <a href={RUTA_CTA} className="d-mako-pie-cta">{TEXTO_CTA}</a>
      </div>
    </footer>
  );
}

export default function DisenoMako({ landing }: PropsDiseno) {
  return (
    <div className="d-mako">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="d-mako-nav">
        <LogoMaKo className="d-mako-nav-logo" tamano={24} claro />
        <nav className="d-mako-nav-links" aria-label="Secciones">
          <a href="#como">Cómo funciona</a>
          <a href="#sugiere">Sugerencias</a>
          <a href="#datos">Tus datos</a>
          <a href="#preguntas">Preguntas</a>
        </nav>
        <a href={RUTA_CTA} className="d-mako-nav-cta">{TEXTO_CTA}<Flecha size={15} /></a>
      </div>
      <main>
        {landing.bloques.map((b, i) => <Seccion key={`${b.tipo}-${i}`} b={b} i={i} bloques={landing.bloques} />)}
        <section className="d-mako-claro d-mako-cierre">
          <span className="d-mako-cursor d-mako-cursor-1" aria-hidden="true">CRM</span>
          <span className="d-mako-cursor d-mako-cursor-2" aria-hidden="true">WhatsApp</span>
          <span className="d-mako-cursor d-mako-cursor-3" aria-hidden="true">Llamadas</span>
          <span className="d-mako-cursor d-mako-cursor-4" aria-hidden="true">Second Brain</span>
          <h2 className="d-mako-h2 d-mako-h2-claro d-mako-centro d-mako-cierre-h">Pon a trabajar hoy tu departamento de marketing.</h2>
          <div className="d-mako-cierre-caja">
            <p>{TEXTO_CIERRE}</p>
            <div className="d-mako-cierre-pie"><Boton chico /></div>
          </div>
        </section>
      </main>
      <Pie slug={landing.slug} />
    </div>
  );
}

const DEG = 'linear-gradient(103.56deg, #F2B01E 5%, #F5A623 13%, #5B8EF5 30%, #2F6FED 62%, #1F57C8 90%)';

const CSS = `
@font-face { font-family: 'Figtree'; src: url('/vsl-assets/fuentes/figtree/figtree-latin.woff2') format('woff2'); font-weight: 300 900; font-style: normal; font-display: swap; }
.d-mako { background: #0A0B14; color: #1F2028; font-family: 'Figtree', ui-sans-serif, system-ui, sans-serif; font-size: 18px; line-height: 23.4px; -webkit-font-smoothing: antialiased; overflow-x: clip; }
:where(.d-mako) *, :where(.d-mako) *::before, :where(.d-mako) *::after { box-sizing: border-box; }
:where(.d-mako) :where(p, h1, h2, h3, ul, ol) { margin: 0; padding: 0; }
:where(.d-mako) :where(ul, ol) { list-style: none; }
:where(.d-mako) a { color: inherit; }
.d-mako-w { width: 100%; max-width: min(1080px, calc(100% - 80px)); margin: 0 auto; }
.d-mako-s { padding: 96px 24px; }
.d-mako-oscuro { background: #0A0B14; color: #F5F6F8; }
.d-mako-claro { background: #fff; color: #1F2028; }
.d-mako-centro { text-align: center; }

/* Títulos: 36,8 / 42,32, -0,552 px, 700; la segunda mitad (<em>) con su degradado gris en lo oscuro y #A5A5AD en lo claro */
.d-mako-h2 { font-size: 36.8px; line-height: 42.32px; letter-spacing: -0.552px; font-weight: 700; color: #F5F6F8; text-wrap: balance; }
.d-mako-h2 em { font-style: normal; background: linear-gradient(#EDEEF2 0%, #B9BAC2 55%, #6D6E76 100%); -webkit-background-clip: text; background-clip: text; color: transparent; }
.d-mako-h2-claro { color: #1F2028; }
.d-mako-h2-claro em, .d-mako-sem-h em { font-style: normal; background: none; color: #A5A5AD; }
.d-mako-cab { display: flex; justify-content: space-between; align-items: flex-start; gap: 40px; }
.d-mako-cab .d-mako-h2 { max-width: 346px; }
.d-mako-cab-p { width: 380px; flex: none; font-size: 18px; line-height: 23.4px; color: #C7C8CE; }
.d-mako-cab-p-claro { width: 360px; color: #6D6E76; }

/* Botón: la píldora de 50 px, 10 10 10 20, el degradado y el brillo blanco adentro */
.d-mako-btn { display: inline-flex; align-items: center; gap: 10px; height: 50px; padding: 10px 14px 10px 20px; border-radius: 9999px; background: ${DEG}; box-shadow: inset 0 0 10px rgba(255,255,255,.85); color: #FBFBFB; font-size: 17.2px; line-height: 26px; font-weight: 700; text-decoration: none; white-space: nowrap; transition: transform .3s cubic-bezier(.16,1,.3,1), box-shadow .3s; }
.d-mako-btn svg { transition: transform .3s cubic-bezier(.16,1,.3,1); }
.d-mako-btn:hover { transform: scale(1.04); box-shadow: inset 0 0 12px rgba(255,255,255,.95), 0 10px 30px -10px rgba(47,111,237,.6); }
.d-mako-btn:hover svg { transform: translateX(3px); }
.d-mako-btn-chico { height: 42px; padding: 8px 12px 8px 20px; font-size: 15px; line-height: 22px; }

/* Barra: tres píldoras de 44 px centradas, fija arriba (12 px) */
.d-mako-nav { position: fixed; top: 0; left: 0; right: 0; z-index: 80; display: flex; justify-content: center; align-items: center; gap: 8px; padding: 12px 24px 0; pointer-events: none; }
.d-mako-nav > * { pointer-events: auto; }
.d-mako-nav-logo { height: 44px; padding: 0 16px 0 12px; border-radius: 9999px; background: #0A0B14; border: 1px solid rgba(255,255,255,.14); }
.d-mako-nav-links { display: flex; align-items: center; gap: 28px; height: 44px; padding: 0 32px; border-radius: 9999px; border: 1px solid rgba(255,255,255,.14); background: #0A0B14; }
.d-mako-nav-links a { font-size: 15px; line-height: 19.5px; font-weight: 700; color: #F5F6F8; text-decoration: none; transition: opacity .2s; }
.d-mako-nav-links a:hover { opacity: .7; }
.d-mako-nav-cta { display: inline-flex; align-items: center; gap: 8px; height: 44px; padding: 0 20px; border-radius: 9999px; border: 1px solid transparent; background: linear-gradient(#0A0B14, #0A0B14) padding-box, ${DEG} border-box; color: #F5F6F8; font-size: 15px; line-height: 19.5px; font-weight: 700; text-decoration: none; white-space: nowrap; transition: transform .3s cubic-bezier(.16,1,.3,1); }
.d-mako-nav-cta:hover { transform: scale(1.04); }

/* Hero: 80 24 24 sobre #0A0B14; la grilla 487 / 560 con 32 de espacio */
.d-mako-hero { background: #0A0B14; color: #F5F6F8; padding: 80px 24px 24px; overflow-x: clip; }
.d-mako-hero-g { display: grid; grid-template-columns: minmax(0, 487fr) minmax(0, 560fr); gap: 32px; align-items: center; margin-top: 24px; }
.d-mako-hero-txt { animation: d-mako-sube .7s cubic-bezier(.16,1,.3,1) both; }
.d-mako-etq { display: inline-flex; align-items: center; gap: 10px; height: 38px; padding: 6px 14px 6px 8px; border-radius: 9999px; border: 1px solid rgba(255,255,255,.22); font-size: 12.5px; line-height: 16.25px; color: #C7C8CE; }
.d-mako-etq-ico { width: 24px; height: 24px; border-radius: 9999px; background: #1A1712; display: inline-flex; align-items: center; justify-content: center; }
.d-mako-h1 { margin-top: 24px; font-size: 60.64px; line-height: 69.55px; letter-spacing: -0.8px; font-weight: 700; color: #F5F6F8; }
.d-mako-h1 em { font-style: normal; display: inline-block; color: transparent; filter: drop-shadow(0 0 16px rgba(255,255,255,.3)); background-image: linear-gradient(90deg, #fff 0% 34%, #2F6FED 41%, #5B8EF5 45%, #8FB2FA 50%, #F7C85A 55%, #F2B01E 59%, #F5A623 62%, #fff 68% 100%); background-size: 300% 100%; -webkit-background-clip: text; background-clip: text; animation: d-mako-brillo 8s linear infinite; }
.d-mako-bajada { margin-top: 20px; max-width: 336px; font-size: 17px; line-height: 23.375px; font-weight: 600; color: #C7C8CE; }
.d-mako-bajada strong { font-weight: 600; color: #F5F6F8; }
.d-mako-hero-cta { margin-top: 28px; }
.d-mako-confia { margin-top: 20px; display: flex; gap: 32px; flex-wrap: wrap; }
.d-mako-confia li { display: flex; align-items: center; gap: 12px; color: #94959D; font-size: 13px; line-height: 16.25px; }
.d-mako-confia li span { color: #C7C8CE; max-width: 200px; }
.d-mako-confia strong { display: block; font-size: 13.5px; line-height: 16.875px; font-weight: 700; color: #F5F6F8; }
.d-mako-hero-vis { margin-left: -86px; }

/* El chat del hero, en el lugar y el tamaño de su ilustración (647 × 485), con los chips de vidrio de Holo */
.d-mako-vis { position: relative; height: 485px; }
.d-mako-vis-glow { position: absolute; inset: 40px 70px; border-radius: 50%; background: radial-gradient(closest-side, rgba(47,111,237,.38), rgba(47,111,237,.08) 60%, transparent), radial-gradient(closest-side at 70% 75%, rgba(242,176,30,.18), transparent); filter: blur(30px); }
.d-mako-chat { position: absolute; left: 50%; top: 50%; width: 404px; transform: translate(-50%, -50%); display: flex; flex-direction: column; gap: 12px; padding: 14px 14px 12px; border-radius: 26px; background: #0E0F1A; border: 1px solid rgba(255,255,255,.12); box-shadow: inset 0 1px 0 rgba(255,255,255,.06), 0 14px 36px rgba(0,0,0,.3), 0 40px 80px -30px rgba(47,111,237,.35); }
.d-mako-chat-top { display: flex; align-items: center; gap: 8px; padding: 2px 2px 10px; border-bottom: 1px solid rgba(255,255,255,.08); }
.d-mako-chat-av { width: 26px; height: 26px; border-radius: 8px; background: #1A1712; display: inline-flex; align-items: center; justify-content: center; flex: none; }
.d-mako-chat-av-chico { width: 22px; height: 22px; border-radius: 7px; margin-top: 2px; }
.d-mako-chat-n { font-size: 14px; line-height: 18px; font-weight: 700; color: #F5F6F8; }
.d-mako-chat-s { font-size: 11.5px; line-height: 14px; color: #94959D; }
.d-mako-chat-yo { align-self: flex-end; max-width: 250px; padding: 9px 13px; border-radius: 14px 14px 4px 14px; background: #2F6FED; color: #fff; font-size: 13.5px; line-height: 18px; font-weight: 600; }
.d-mako-chat-mk { display: flex; gap: 8px; align-items: flex-start; }
.d-mako-tarj { flex: 1; padding: 12px 13px; border-radius: 14px; background: #fff; color: #1F2028; box-shadow: 0 10px 24px -12px rgba(0,0,0,.6); }
.d-mako-tarj-pill { display: inline-flex; padding: 3px 9px; border-radius: 9999px; background: #FDF1D6; color: #8A5A00; font-size: 11px; line-height: 14px; font-weight: 700; }
.d-mako-tarj-t { margin-top: 8px; font-size: 14.5px; line-height: 18px; font-weight: 700; }
.d-mako-tarj-r { margin-top: 3px; font-size: 13px; line-height: 17px; color: #4A4B54; }
.d-mako-tarj-l { margin-top: 9px; display: flex; justify-content: space-between; gap: 8px; padding: 7px 9px; border-radius: 8px; background: #F5F6F8; font-size: 12px; line-height: 15px; color: #6D6E76; }
.d-mako-tarj-l span:last-child { color: #1F2028; font-weight: 600; }
.d-mako-tarj-l b { color: #2F6FED; }
.d-mako-tarj-bot { margin-top: 10px; display: flex; flex-wrap: wrap; gap: 6px; }
.d-mako-tarj-si, .d-mako-tarj-no { display: inline-flex; align-items: center; height: 28px; padding: 0 11px; border-radius: 9999px; font-size: 12px; font-weight: 700; white-space: nowrap; }
.d-mako-tarj-si { background: #2F6FED; color: #fff; }
.d-mako-tarj-no { background: #F5F6F8; color: #4A4B54; }
.d-mako-chat-caja { display: flex; align-items: center; justify-content: space-between; height: 40px; padding: 0 5px 0 14px; border-radius: 9999px; border: 1px solid rgba(255,255,255,.12); font-size: 13px; color: #6D6E76; }
.d-mako-chat-env { width: 30px; height: 30px; border-radius: 9999px; background: rgba(255,255,255,.08); color: #C7C8CE; display: inline-flex; align-items: center; justify-content: center; }
.d-mako-chip { position: absolute; z-index: 2; display: flex; flex-direction: column; gap: 3px; padding: 10px 16px; border-radius: 12px; background: rgba(10,11,20,.55); border: 1px solid rgba(255,255,255,.2); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); animation: d-mako-flota 6s ease-in-out infinite; }
.d-mako-chip b { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; line-height: 18.2px; font-weight: 700; color: #F5F6F8; }
.d-mako-chip small { font-size: 11.5px; line-height: 14.375px; color: #C7C8CE; }
.d-mako-chip-1 { left: 14px; top: 58px; }
.d-mako-chip-2 { right: 6px; top: 0; animation-delay: -1.5s; }
.d-mako-chip-3 { right: -8px; top: 322px; animation-delay: -3s; }
.d-mako-chip-4 { left: 6px; top: 404px; animation-delay: -4.5s; }

/* Las tarjetas inclinadas: #0E0F1A, borde blanco 12 %, radio 26, 264 × 462 girando -4°, 2,5° y -2° */
.d-mako-incl { padding: 96px 24px; }
.d-mako-incl-fila { display: flex; justify-content: center; align-items: flex-start; gap: 7px; margin-top: 56px; }
.d-mako-incl-t { width: 300px; height: 520px; flex: none; display: flex; flex-direction: column; align-items: center; text-align: center; padding: 20px 20px 0; border-radius: 26px; background: #0E0F1A; border: 1px solid rgba(255,255,255,.12); overflow: hidden; transition: transform .5s cubic-bezier(.16,1,.3,1); }
.d-mako-incl-t:nth-child(1) { transform: rotate(-4deg); }
.d-mako-incl-t:nth-child(2) { transform: translateY(21px) rotate(2.5deg); }
.d-mako-incl-t:nth-child(3) { transform: translateY(7px) rotate(-2deg); }
.d-mako-incl-t:nth-child(4) { transform: translateY(16px) rotate(3deg); }
/* Los dibujos propios de las tarjetas (12/11/2026): la portada de Image y el formulario de Web Generator, en chico. */
.d-mako-dep { position: relative; padding: 12px 10px 26px; color: #1F2028; font-size: 11px; line-height: 14px; text-align: left; }
.d-mako-dep-h { font-size: 12.5px; line-height: 16px; font-weight: 800; letter-spacing: -0.2px; text-align: center; }
.d-mako-dep-h span { display: inline-block; padding: 1px 5px; border-radius: 5px; background: #F2B01E; transform: rotate(-2deg); }
.d-mako-dep-grilla { margin-top: 10px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; }
.d-mako-dep-car { display: flex; flex-direction: column; gap: 5px; }
.d-mako-dep-lam { position: relative; aspect-ratio: 4 / 5; border-radius: 7px; padding: 6px; display: flex; flex-direction: column; gap: 4px; border: 1px solid rgba(16,24,40,.08); }
.d-mako-dep-pill { align-self: flex-start; font-style: normal; font-size: 8px; line-height: 10px; font-weight: 800; padding: 2px 4px; border-radius: 4px; background: #F2B01E; color: #1F2028; margin-bottom: 6px; }
.d-mako-dep-l { display: block; height: 5px; width: 80%; border-radius: 3px; opacity: .9; }
.d-mako-dep-l2 { width: 55%; }
.d-mako-dep-editar { display: block; text-align: center; font-size: 9.5px; line-height: 18px; font-weight: 700; border-radius: 6px; background: #1F2028; color: #fff; }
.d-mako-dep-nav { display: flex; align-items: center; gap: 4px; padding: 6px 8px; border-radius: 8px 8px 0 0; background: #F3F6FB; border: 1px solid #E4E9F2; }
.d-mako-dep-nav i { width: 6px; height: 6px; border-radius: 50%; background: #D0D6E2; }
.d-mako-dep-nav span { margin-left: 6px; font-size: 9.5px; color: #6D6E76; }
.d-mako-dep-pag { display: flex; flex-direction: column; gap: 6px; padding: 12px 10px 14px; border: 1px solid #E4E9F2; border-top: 0; border-radius: 0 0 8px 8px; }
.d-mako-dep-t { display: block; height: 8px; width: 78%; border-radius: 4px; background: #1F2028; }
.d-mako-dep-t2 { width: 52%; background: #A5A5AD; height: 6px; }
.d-mako-dep-campos { margin-top: 4px; display: grid; grid-template-columns: 1fr 1fr; gap: 5px; }
.d-mako-dep-campos span { padding: 5px 6px; border-radius: 5px; border: 1px solid #E4E9F2; font-size: 9px; color: #8A8B93; }
.d-mako-dep-boton { display: block; text-align: center; padding: 5px; border-radius: 5px; background: #2F6FED; color: #fff; font-size: 9.5px; font-weight: 700; }
.d-mako-dep-chip { position: absolute; right: 10px; bottom: 8px; padding: 4px 8px; border-radius: 9999px; background: #1F2028; color: #fff; font-size: 9.5px; font-weight: 700; box-shadow: 0 6px 16px -6px rgba(0,0,0,.4); }
.d-mako-dep-chip::before { content: ''; display: inline-block; width: 7px; height: 7px; margin-right: 5px; border-radius: 2px; background: #F2B01E; vertical-align: middle; }
.d-mako-incl-t:hover { transform: translateY(-6px) rotate(0deg) scale(1.02); }
.d-mako-incl-ico { margin-top: 10px; width: 47px; height: 47px; border-radius: 13px; display: inline-flex; align-items: center; justify-content: center; color: #fff; box-shadow: inset 0 -3px 6px rgba(0,0,0,.18), inset 0 2px 4px rgba(255,255,255,.35); }
.d-mako-incl-ico-0 { background: linear-gradient(160deg, #6E9BF7, #2F6FED); }
.d-mako-incl-ico-1 { background: linear-gradient(160deg, #F7C85A, #E39A0B); }
.d-mako-incl-ico-2 { background: linear-gradient(160deg, #3B3328, #1A1712); }
.d-mako-incl-h { margin-top: 12px; font-size: 21px; line-height: 26.25px; font-weight: 700; color: #F5F6F8; }
.d-mako-incl-p { margin-top: 10px; font-size: 14px; line-height: 19.6px; color: #C7C8CE; }
.d-mako-incl-p strong { color: #F5F6F8; font-weight: 700; }
.d-mako-incl-l { margin-top: 10px; display: flex; flex-direction: column; gap: 4px; font-size: 12.5px; line-height: 16px; color: #94959D; }
.d-mako-incl-vis { margin-top: auto; width: calc(100% + 8px); padding: 8px 8px 0; border-radius: 18px 18px 0 0; background: #fff; transform: translateY(14px); }
.d-mako-incl-vis svg { display: block; width: 100%; height: auto; }

/* How it works: su cabecera (título 346, texto 380 a la derecha) y los pasos alrededor de los aros */
.d-mako-como { padding: 96px 24px 64px; }
.d-mako-como-esc { position: relative; height: 600px; margin-top: 40px; }
.d-mako-como-aros { position: absolute; left: 50%; top: 52%; width: 0; height: 0; }
.d-mako-como-aros span { position: absolute; left: 50%; top: 50%; border-radius: 50%; border: 1px solid rgba(255,255,255,.05); transform: translate(-50%, -50%); }
.d-mako-como-aros span:nth-child(1) { width: 260px; height: 260px; background: radial-gradient(closest-side, rgba(47,111,237,.14), transparent); }
.d-mako-como-aros span:nth-child(2) { width: 470px; height: 470px; }
.d-mako-como-aros span:nth-child(3) { width: 680px; height: 680px; border-color: rgba(255,255,255,.035); }
.d-mako-como-p { position: absolute; width: 300px; }
.d-mako-como-p1 { left: 50%; top: 10px; transform: translateX(-50%); text-align: center; }
.d-mako-como-p2 { right: 40px; top: 370px; }
.d-mako-como-p3 { left: 40px; top: 370px; }
.d-mako-como-t { font-size: 22px; line-height: 28.6px; letter-spacing: -0.11px; font-weight: 700; color: #F5F6F8; }
.d-mako-como-card { margin-top: 10px; padding: 14px 16px; border-radius: 12px; background: #fff; color: #1F2028; font-size: 15px; line-height: 21px; text-align: left; box-shadow: 0 18px 40px -16px rgba(0,0,0,.55); transition: transform .4s cubic-bezier(.16,1,.3,1); }
.d-mako-como-p:hover .d-mako-como-card { transform: translateY(-4px); }

/* Proactive: 2 columnas de 524 con 32 de espacio; vidrio 3 %, borde 5 %, radio 19,59 y su sombra */
.d-mako-pro { padding: 96px 24px 80px; }
.d-mako-pro-cab { display: flex; justify-content: space-between; align-items: center; gap: 24px; }
.d-mako-pro-cab .d-mako-h2 { max-width: 560px; }
.d-mako-pro-baj { margin-top: 14px; max-width: 560px; font-size: 18px; line-height: 23.4px; color: #C7C8CE; }
.d-mako-pro-baj strong { color: #F5F6F8; font-weight: 700; }
.d-mako-pro-g { margin-top: 44px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 32px; }
.d-mako-pro-t { position: relative; min-height: 325px; padding: 17px 18px 18px; border-radius: 19.59px; background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.05); box-shadow: inset 0 1px 0 rgba(255,255,255,.06), 0 14px 36px rgba(0,0,0,.3); overflow: hidden; transition: transform .4s cubic-bezier(.16,1,.3,1), border-color .4s; }
.d-mako-pro-t:hover { transform: translateY(-4px); border-color: rgba(255,255,255,.1); }
.d-mako-pro-chip { display: inline-flex; align-items: center; height: 34px; border-radius: 10.4px; background: #fff; overflow: hidden; }
.d-mako-pro-chip-i { width: 34px; height: 34px; display: inline-flex; align-items: center; justify-content: center; color: #fff; }
.d-mako-pro-chip-i0 { background: linear-gradient(160deg, #6E9BF7, #2F6FED); }
.d-mako-pro-chip-i1 { background: linear-gradient(160deg, #F7C85A, #E39A0B); }
.d-mako-pro-chip-t { padding: 0 10.6px 0 7.35px; font-size: 17.96px; line-height: 17.96px; font-weight: 700; color: #16171D; white-space: nowrap; }
.d-mako-pro-p { position: relative; z-index: 1; margin-top: 22px; max-width: 300px; font-size: 16.32px; line-height: 20.4px; font-weight: 700; color: #F5F6F8; }
.d-mako-pro-meta { position: absolute; left: 18px; bottom: 16px; z-index: 1; font-size: 12.24px; line-height: 15.9px; color: #94959D; }
.d-mako-pro-art { position: absolute; right: -14px; bottom: -14px; width: 190px; height: 190px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #F5F6F8; }
.d-mako-pro-art0 { background: radial-gradient(closest-side, rgba(47,111,237,.55), rgba(47,111,237,.12) 70%, transparent); }
.d-mako-pro-art1 { background: radial-gradient(closest-side, rgba(242,176,30,.45), rgba(242,176,30,.1) 70%, transparent); }

/* Real customer results: su fila del número grande (88 px) y la tarjeta de rendimiento (radio 24) */
.d-mako-caso { padding: 80px 24px 96px; }
.d-mako-caso-top { display: grid; grid-template-columns: 260px 1px auto 1fr; align-items: center; column-gap: 46px; }
.d-mako-caso-t { font-size: 22px; line-height: 28.6px; letter-spacing: -0.11px; font-weight: 500; color: #F5F6F8; }
.d-mako-caso-sep { align-self: stretch; background: rgba(255,255,255,.12); }
.d-mako-caso-num { font-size: 88px; line-height: 88px; font-weight: 700; color: transparent; background: linear-gradient(103.56deg, #2F6FED 10%, #5B8EF5 55%, #A9C4FB 95%); -webkit-background-clip: text; background-clip: text; white-space: nowrap; }
.d-mako-caso-barra { margin-left: -14px; }
.d-mako-caso-pista { display: block; height: 12px; border-radius: 9999px; background: rgba(255,255,255,.16); overflow: hidden; }
.d-mako-caso-pista span { display: block; height: 100%; width: 100%; border-radius: inherit; background: ${DEG}; transform-origin: left; animation: d-mako-llena 1.6s .3s cubic-bezier(.16,1,.3,1) both; }
.d-mako-caso-lab { margin-top: 10px; font-size: 18px; line-height: 23.4px; color: transparent; background: linear-gradient(#EDEEF2 0%, #B9BAC2 55%, #6D6E76 100%); -webkit-background-clip: text; background-clip: text; }
.d-mako-caso-card { margin-top: 40px; border-radius: 24px; background: #0A0B15; border: 1px solid rgba(255,255,255,.05); box-shadow: inset 0 1px 0 rgba(255,255,255,.06), 0 14px 36px rgba(0,0,0,.3); overflow: hidden; }
.d-mako-caso-in { padding: 20px 20px 0; }
.d-mako-caso-cab { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
.d-mako-caso-quien { font-size: 16px; line-height: 16px; font-weight: 700; color: #F5F5F5; }
.d-mako-caso-rol { display: inline-flex; align-items: center; height: 31px; padding: 6px 12px; border-radius: 5px; border: 1px solid #282931; font-size: 13px; line-height: 16.9px; color: #F5F5F5; }
.d-mako-caso-stats { margin-top: 10px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.d-mako-caso-st { padding: 10px; border-radius: 5px; border: 1px solid transparent; }
.d-mako-caso-st-on { border-color: #282931; }
.d-mako-caso-st span { font-size: 13px; line-height: 19px; font-weight: 700; color: #F5F5F5; }
.d-mako-caso-st p { margin-top: 2px; font-size: 28px; line-height: 28px; color: #F5F5F5; }
.d-mako-caso-cuerpo { margin-top: 14px; display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); gap: 28px; align-items: center; }
.d-mako-caso-video { display: block; width: 100%; aspect-ratio: 848 / 480; object-fit: cover; border-radius: 12px; background: #000; }
.d-mako-caso-hist { display: flex; flex-direction: column; gap: 12px; font-size: 15px; line-height: 21px; color: #9B9EA6; }
.d-mako-caso-hist strong { color: #F5F5F5; font-weight: 700; }
.d-mako-caso-res { color: #F5F5F5; }
.d-mako-caso-pie { padding: 16px 20px 20px; font-size: 20px; line-height: 25px; font-weight: 700; color: #fff; }

/* Any niche: tarjetas blancas de 1080, radio 28, 64 de relleno, la sombra de tres capas; grilla 497 / 397 con 56 */
.d-mako-nicho { padding: 64px 24px 64px; }
.d-mako-nicho-lista { margin-top: 40px; display: flex; flex-direction: column; gap: 32px; }
.d-mako-nicho-t { display: grid; grid-template-columns: minmax(0, 496.66fr) minmax(0, 397.34fr); gap: 56px; align-items: center; padding: 64px; border-radius: 28px; background: #fff; border: 1px solid rgba(16,17,26,.05); box-shadow: inset 0 1px 0 rgba(255,255,255,.85), 0 1px 2px rgba(16,17,26,.03), 0 12px 32px rgba(16,17,26,.06); }
.d-mako-nicho-h { font-size: 44px; line-height: 50.6px; font-weight: 700; color: #1F2028; }
.d-mako-nicho-h em { font-style: normal; color: #A5A5AD; }
.d-mako-nicho-p { margin-top: 20px; max-width: 448px; font-size: 18px; line-height: 23.4px; color: #6D6E76; }
.d-mako-busca { display: flex; align-items: center; gap: 12px; height: 53px; padding: 14px 20px; border-radius: 9999px; background: #fff; border: 1px solid rgba(16,17,26,.05); box-shadow: inset 0 1px 0 rgba(255,255,255,.85), 0 1px 2px rgba(16,17,26,.03), 0 12px 32px rgba(16,17,26,.06); font-size: 17px; line-height: 22.1px; font-weight: 600; color: #1F2028; }
.d-mako-busca i { width: 2px; height: 20px; margin-left: -10px; background: ${MAKO.azul}; animation: d-mako-cursor 1s steps(1) infinite; }
.d-mako-pild { margin-top: 24px; display: flex; flex-wrap: wrap; gap: 12px; }
.d-mako-pild span { display: inline-flex; align-items: center; height: 42px; padding: 10px 20px; border-radius: 9999px; font-size: 17px; line-height: 22.1px; font-weight: 700; color: #fff; transition: transform .3s cubic-bezier(.16,1,.3,1); }
.d-mako-pild span:hover { transform: translateY(-2px); }
.d-mako-pild-a { background: #2F6FED; }
.d-mako-pild-o { background: #1F57C8; }
.d-mako-pild-d { background: #F2B01E; color: #1A1712 !important; }
.d-mako-pild-g { background: #F5F6F8; color: #6D6E76 !important; }

/* Semana a semana: el título de 52 px, el texto de 360 a la derecha, la curva y las pestañas de abajo */
.d-mako-sem { padding: 96px 24px; }
.d-mako-sem-h { max-width: 558px; font-size: 52px; line-height: 58.24px; letter-spacing: -0.5px; font-weight: 700; color: #1F2028; }
.d-mako-sem-graf { position: relative; margin-top: 64px; height: 330px; background-image: repeating-linear-gradient(to bottom, #E5E6EB 0 2px, transparent 2px 7px); background-size: 1px 100%; background-repeat: no-repeat; background-position: 0 0; }
.d-mako-sem-graf::before, .d-mako-sem-graf::after { content: ''; position: absolute; top: 0; bottom: 0; width: 1px; background-image: repeating-linear-gradient(to bottom, #E5E6EB 0 2px, transparent 2px 7px); }
.d-mako-sem-graf::before { left: 33.333%; }
.d-mako-sem-graf::after { left: 66.666%; }
.d-mako-sem-graf svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.d-mako-sem-punto { position: absolute; left: 66.666%; top: 62.1%; width: 10px; height: 10px; margin: -5px 0 0 -5px; border-radius: 50%; background: #fff; border: 2px solid #5B8EF5; }
.d-mako-sem-tabs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }
.d-mako-sem-tabs li { padding: 16px 24px 4px 0; border-top: 3px solid #E5E6EB; }
.d-mako-sem-tabs li.d-mako-sem-on { border-image: linear-gradient(90deg, #2F6FED, #F2B01E) 1; }
.d-mako-sem-t { font-size: 15px; line-height: 19.5px; color: #6D6E76; }
.d-mako-sem-on .d-mako-sem-t { color: #1F2028; font-weight: 700; }
.d-mako-sem-x { margin-top: 8px; font-size: 15px; line-height: 21px; color: #6D6E76; }
.d-mako-sem-x strong { color: #1F2028; }

/* Inside…: el título a la izquierda y el carrusel de cajas #F7F7F7 de 400 × 460 (radio 16, 20 de espacio) */
.d-mako-dentro { padding: 96px 0; }
.d-mako-dentro-fila { margin-top: 48px; display: flex; gap: 20px; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; padding: 0 calc((100% - min(1080px, calc(100% - 80px))) / 2); scroll-padding: 0 calc((100% - min(1080px, calc(100% - 80px))) / 2); }
.d-mako-dentro-fila::-webkit-scrollbar { display: none; }
.d-mako-dentro-t { width: 400px; flex: none; scroll-snap-align: start; }
.d-mako-dentro-caja { height: 460px; border-radius: 16px; background: #F7F7F7; display: flex; align-items: center; justify-content: center; overflow: hidden; }
.d-mako-mock { width: 270px; padding: 16px; border-radius: 16px; background: #fff; box-shadow: 0 1px 2px rgba(16,17,26,.04), 0 16px 36px rgba(16,17,26,.08); transition: transform .5s cubic-bezier(.16,1,.3,1); }
.d-mako-dentro-t:hover .d-mako-mock { transform: translateY(-6px); }
.d-mako-mock-h { font-size: 18px; line-height: 22px; font-weight: 600; color: #1F2028; }
.d-mako-mock-sub { margin-top: 4px; font-size: 11.5px; line-height: 15px; color: #6D6E76; }
.d-mako-mock-panel { margin-top: 12px; display: flex; flex-direction: column; gap: 8px; padding: 8px; border-radius: 12px; background: #F3F6FB; }
.d-mako-mock-fila { display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; border-radius: 10px; background: #fff; font-size: 13.5px; line-height: 17px; color: #1F2028; }
.d-mako-mock-fila i { align-self: flex-start; font-style: normal; padding: 2px 8px; border-radius: 9999px; background: #EAF1FE; color: #2F6FED; font-size: 10.5px; line-height: 14px; font-weight: 600; }
.d-mako-mock-cerebro svg { display: block; margin-top: 8px; }
.d-mako-mock-tog { display: flex; justify-content: space-between; align-items: center; }
.d-mako-mock-sw { width: 34px; height: 20px; border-radius: 9999px; background: #2F6FED; position: relative; }
.d-mako-mock-sw i { position: absolute; right: 2px; top: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; }
.d-mako-chicas { margin-top: 64px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.d-mako-chica { padding: 24px; border-radius: 16px; background: #fff; border: 1px solid rgba(16,17,26,.05); transition: transform .4s cubic-bezier(.16,1,.3,1), box-shadow .4s; }
.d-mako-chica:hover { transform: translateY(-3px); box-shadow: 0 12px 32px rgba(16,17,26,.06); }
.d-mako-chica-chip { display: inline-flex; align-items: center; height: 36px; padding-right: 12px; border-radius: 11px; background: #fff; border: 1px solid rgba(16,17,26,.1); overflow: hidden; }
.d-mako-chica-chip .d-mako-pro-chip-i { width: 34px; height: 34px; }
.d-mako-chica-chip b { padding-left: 10px; font-size: 15px; line-height: 19.5px; font-weight: 700; color: #16171D; }
.d-mako-chica p { margin-top: 19px; font-size: 14px; line-height: 22.75px; color: #6D6E76; }
.d-mako-dentro-p { padding: 20px 8px 0 0; font-size: 18px; line-height: 23.4px; color: #6D6E76; }
.d-mako-dentro-p b { color: #1F2028; font-weight: 700; }

/* Privacidad: el degradado blanco → #F5F6F8 y tres tarjetas blancas de radio 28 (16 de espacio) */
.d-mako-datos { background: linear-gradient(#fff 0%, #fff 90px, #F5F6F8 340px, #F5F6F8 100%); color: #1F2028; }
.d-mako-datos-h { max-width: 460px; margin: 0 auto; }
.d-mako-datos-g { margin-top: 48px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.d-mako-datos-t { padding: 28px; border-radius: 28px; background: #fff; border: 1px solid rgba(16,17,26,.05); box-shadow: inset 0 1px 0 rgba(255,255,255,.85), 0 1px 2px rgba(16,17,26,.03), 0 12px 32px rgba(16,17,26,.06); transition: transform .4s cubic-bezier(.16,1,.3,1); }
.d-mako-datos-t:hover { transform: translateY(-4px); }
.d-mako-datos-ico { width: 32px; height: 32px; border-radius: 9px; border: 1.5px solid #1F2028; display: inline-flex; align-items: center; justify-content: center; color: #1F2028; }
.d-mako-datos-tt { margin-top: 26px; font-size: 22px; line-height: 28.6px; letter-spacing: -0.11px; font-weight: 700; color: #1F2028; }
.d-mako-datos-p { margin-top: 11px; font-size: 18px; line-height: 23.4px; color: #6D6E76; }

/* Skeptical?: 1032 de ancho; las preguntas en cajas #F5F6F8 de radio 12, 14 px en negrita, 12 de espacio */
.d-mako-faq { padding: 96px 24px; }
.d-mako-faq-w { max-width: min(1032px, calc(100% - 80px)); margin: 0 auto; }
.d-mako-faq-cab .d-mako-h2 { max-width: 351px; }
.d-mako-faq-btn { margin-top: 28px; }
.d-mako-faq-lista { margin-top: 56px; display: flex; flex-direction: column; gap: 12px; }
.d-mako-faq-i { border-radius: 12px; background: #F5F6F8; }
.d-mako-faq-i summary { list-style: none; display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 20px 24px; cursor: pointer; font-size: 14px; line-height: 18.9px; letter-spacing: .14px; font-weight: 700; color: #1F2028; }
.d-mako-faq-i summary::-webkit-details-marker { display: none; }
.d-mako-faq-i summary svg { flex: none; transition: transform .3s; }
.d-mako-faq-i[open] summary svg { transform: rotate(180deg); }
.d-mako-faq-i p { max-width: 768px; padding: 0 24px 20px; font-size: 14px; line-height: 18.9px; letter-spacing: .14px; color: #6D6E76; }

/* El cierre: 144 arriba y 288 abajo, el título centrado de 570 y la caja con el botón abajo a la derecha */
.d-mako-cierre { position: relative; padding: 144px 24px 200px; overflow: hidden; }
.d-mako-cierre-h { max-width: 570px; margin: 0 auto; }
.d-mako-cierre-caja { position: relative; z-index: 1; max-width: 540px; margin: 40px auto 0; padding: 16px 16px 14px 20px; border-radius: 24px; background: #fff; border: 1px solid rgba(16,17,26,.08); box-shadow: inset 0 1px 0 rgba(255,255,255,.85), 0 1px 2px rgba(16,17,26,.03), 0 12px 32px rgba(16,17,26,.08); }
.d-mako-cierre-caja p { font-size: 17px; line-height: 24.65px; color: #9A9BA3; }
.d-mako-cierre-pie { margin-top: 18px; display: flex; justify-content: flex-end; }
.d-mako-cursor { position: absolute; display: inline-flex; padding: 6px 12px; border-radius: 9999px; font-size: 14px; line-height: 14px; font-weight: 500; color: #fff; animation: d-mako-flota 7s ease-in-out infinite; }
.d-mako-cursor::before { content: ''; position: absolute; left: -12px; top: -14px; width: 14px; height: 16px; background: inherit; clip-path: polygon(0 0, 100% 62%, 45% 62%, 22% 100%); }
.d-mako-cursor-1 { left: 17%; top: 98px; background: #2F6FED; }
.d-mako-cursor-2 { right: 11%; top: 120px; background: #F2B01E; color: #1A1712; animation-delay: -2s; }
.d-mako-cursor-3 { left: 9%; top: 460px; background: #8FB2FA; animation-delay: -4s; }
.d-mako-cursor-4 { right: 16%; top: 420px; background: #1F57C8; animation-delay: -5s; }

/* Pie: #FAFAFA, la marca a la izquierda (260) y las columnas de 280 en 512 / 816 / 1120 */
.d-mako-pie { background: #FAFAFA; color: #1F2028; padding: 80px 40px 40px; }
.d-mako-pie-g { display: grid; grid-template-columns: minmax(0, 1fr) repeat(3, 280px); gap: 24px; }
.d-mako-pie-marca p { margin-top: 20px; max-width: 260px; font-size: 15px; line-height: 21.75px; color: #1F2028; }
.d-mako-pie-logo { color: #1F2028 !important; }
.d-mako-pie-col { display: flex; flex-direction: column; align-items: flex-start; gap: 18px; }
.d-mako-pie-col h2 { min-height: 14px; margin-bottom: 6px; font-size: 11px; line-height: 14.3px; letter-spacing: 1.54px; font-weight: 600; text-transform: uppercase; color: #6D6E76; }
.d-mako-pie-col a { font-size: 15px; line-height: 19.5px; color: #1F2028; text-decoration: none; transition: color .2s; }
.d-mako-pie-col a:hover { color: #2F6FED; }
.d-mako-pie-abajo { margin-top: 56px; padding-top: 40px; border-top: 1px solid rgba(31,32,40,.08); display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; }
.d-mako-pie-abajo p { font-size: 14px; line-height: 18.2px; color: #6D6E76; }
.d-mako-pie-cta { font-size: 13px; line-height: 16.9px; font-weight: 600; color: #2F6FED !important; text-decoration: none; }

@keyframes d-mako-sube { 0% { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
@keyframes d-mako-brillo { 0% { background-position: 150% 0; } to { background-position: -150% 0; } }
@keyframes d-mako-flota { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
@keyframes d-mako-cursor { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
@keyframes d-mako-llena { 0% { transform: scaleX(0); } to { transform: scaleX(1); } }

/* Por debajo de 1024: la grilla del hero y lo ancho se apilan */
@media (max-width: 1023px) {
  .d-mako-hero-g { grid-template-columns: minmax(0, 1fr); }
  .d-mako-hero-vis { margin-left: 0; }
  .d-mako-incl-fila { overflow-x: auto; justify-content: flex-start; padding: 20px 24px 40px; scroll-snap-type: x mandatory; scrollbar-width: none; }
  .d-mako-incl-t { scroll-snap-align: center; }
  .d-mako-pro-g, .d-mako-datos-g { grid-template-columns: minmax(0, 1fr); }
  .d-mako-pie-g { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .d-mako-pie-marca { grid-column: 1 / -1; }
}

/* 390: lo que Holo hace en el teléfono (el visual arriba, el texto centrado, 31 px el título, 35,9 los de sección) */
@media (max-width: 767px) {
  .d-mako-w, .d-mako-faq-w { max-width: none; }
  .d-mako-s, .d-mako-incl, .d-mako-como, .d-mako-pro, .d-mako-faq { padding: 64px 24px; }
  .d-mako-nav { justify-content: space-between; padding: 12px 16px 0; }
  .d-mako-nav-links { display: none; }
  .d-mako-hero { padding: 72px 24px 56px; }
  .d-mako-hero-g { margin-top: 8px; gap: 24px; }
  .d-mako-hero-vis { order: -1; }
  .d-mako-hero-txt { display: flex; flex-direction: column; align-items: center; text-align: center; }
  .d-mako-hero-cta { order: -1; margin-top: 0; }
  .d-mako-etq { display: none; }
  .d-mako-h1 { margin-top: 26px; font-size: 31px; line-height: 35.65px; }
  .d-mako-bajada { margin: 24px auto 0; max-width: 300px; font-size: 15.5px; line-height: 21.31px; }
  .d-mako-confia { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-top: 40px; width: 100%; }
  .d-mako-confia li { flex-direction: column; gap: 10px; text-align: center; }
  .d-mako-confia strong { font-size: 15px; line-height: 18.75px; margin-bottom: 4px; }
  .d-mako-vis { height: auto; padding: 0; }
  .d-mako-vis-glow { inset: 0; }
  .d-mako-chat { position: relative; left: auto; top: auto; transform: none; width: 100%; }
  .d-mako-chip { display: none; }
  .d-mako-h2 { font-size: 35.9px; line-height: 41.29px; letter-spacing: -0.5385px; }
  .d-mako-cab { flex-direction: column; gap: 20px; }
  .d-mako-cab-p, .d-mako-cab-p-claro { width: auto; }
  .d-mako-incl-fila { margin-top: 32px; gap: 16px; }
  .d-mako-incl-t { width: 306px; padding: 32px 20px 0; }
  .d-mako-incl-t:nth-child(n) { transform: rotate(-1.5deg); }
  .d-mako-como-esc { height: auto; margin-top: 40px; display: flex; flex-direction: column; gap: 36px; }
  .d-mako-como-aros { display: none; }
  .d-mako-como-p, .d-mako-como-p1 { position: static; width: auto; max-width: 300px; transform: none; text-align: left; }
  .d-mako-como-p2 { align-self: flex-end; text-align: right; }
  .d-mako-como-p2 .d-mako-como-card { text-align: left; }
  .d-mako-pro-cab { flex-direction: column; align-items: flex-start; }
  .d-mako-pro-g { margin-top: 32px; gap: 16px; }
  .d-mako-pro-t { min-height: 260px; }
  .d-mako-pro-p { max-width: 220px; font-size: 15px; line-height: 18.75px; }
  .d-mako-pro-art { width: 150px; height: 150px; }
  .d-mako-caso { padding: 64px 24px 80px; }
  .d-mako-caso-top { grid-template-columns: 1fr; row-gap: 16px; }
  .d-mako-caso-t { order: 3; font-size: 18px; line-height: 23.4px; }
  .d-mako-caso-sep { display: none; }
  .d-mako-caso-num { order: 1; font-size: 71.8px; line-height: 71.8px; }
  .d-mako-caso-barra { order: 2; margin-left: 0; }
  .d-mako-caso-card { margin-top: 32px; }
  .d-mako-caso-stats { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px; }
  .d-mako-caso-st { padding: 8px 6px; }
  .d-mako-caso-st p { font-size: 20px; line-height: 22px; }
  .d-mako-caso-cuerpo { grid-template-columns: minmax(0, 1fr); gap: 16px; }
  .d-mako-caso-pie { font-size: 18px; line-height: 22.5px; }
  .d-mako-nicho { padding: 40px 24px 56px; }
  .d-mako-nicho-t { grid-template-columns: minmax(0, 1fr); gap: 32px; min-height: 0; padding: 32px 28px; }
  .d-mako-nicho-h { font-size: 28.24px; line-height: 32.48px; }
  .d-mako-nicho-p { font-size: 18px; }
  .d-mako-sem { padding: 80px 24px; }
  .d-mako-sem-h { font-size: 41.44px; line-height: 46.41px; }
  .d-mako-sem-graf { margin-top: 40px; height: 180px; }
  .d-mako-sem-tabs { grid-template-columns: minmax(0, 1fr); gap: 4px; }
  .d-mako-sem-tabs li { padding: 14px 0 12px; }
  .d-mako-sem-t { font-size: 17px; line-height: 22.1px; }
  .d-mako-dentro { padding: 96px 0 64px; }
  .d-mako-dentro-h { font-size: 25px; line-height: 30.5px; letter-spacing: -0.375px; }
  .d-mako-dentro-fila { padding: 0 24px; scroll-padding: 0 24px; gap: 20px; }
  .d-mako-dentro-t { width: 320px; }
  .d-mako-dentro-caja { height: 420px; }
  .d-mako-chicas { grid-template-columns: minmax(0, 1fr); margin-top: 40px; }
  .d-mako-datos { padding: 80px 24px; }
  .d-mako-datos-g { gap: 16px; margin-top: 32px; }
  .d-mako-datos-t { padding: 24px; }
  .d-mako-cierre { padding: 80px 24px 160px; }
  .d-mako-cursor-1 { left: 6%; top: 40px; }
  .d-mako-cursor-2 { right: 6%; top: 56px; }
  .d-mako-cursor-3 { left: 8%; top: auto; bottom: 64px; }
  .d-mako-cursor-4 { right: 8%; top: auto; bottom: 90px; }
  .d-mako-pie { padding: 64px 24px 40px; }
  .d-mako-pie-g { grid-template-columns: minmax(0, 1fr); gap: 36px; }
  .d-mako-pie-col h2:empty, .d-mako-pie-col h2[aria-hidden] { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  .d-mako *, .d-mako *::before, .d-mako *::after { animation: none !important; transition: none !important; }
}
`;
