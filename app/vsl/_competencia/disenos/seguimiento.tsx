// =============================================================================
// /vsl/seguimiento con el DISEÑO de la portada de SetSmart (https://setsmart.io/es), copiado el 11/11/2026
// =============================================================================
// La página entera es la de SetSmart: la barra fija con el botón de los corchetes, el hero sobre la trama en diagonal con su
// titular en dos tonos, el botón dentro de corchetes y la demo enmarcada, la fila «Se integra con» en gris, la sección gris
// con el interruptor «Sin / Con», el muro de reseñas en tres columnas, la grilla de seis tarjetas con su superficie de demo,
// la línea de tres puntos, los pasos «01 / 02 / 03», la terminal oscura, las preguntas en filas y el pie oscuro de columnas.
// Los valores (Fustat + Inter + DM Mono, escala, colores, contenedores, espacios, radios) se midieron con getComputedStyle a
// 1440 y a 390 px, y viven en docs/diseno/landings-competencia/seguimiento.md.
//
// De MaKo: el logo, el azul #2F6FED donde SetSmart pone su amarillo (las palabras resaltadas, los corchetes del botón, el
// cuadradito del botón de la barra, el «›» de la terminal), el dorado en el punto que SetSmart pinta ámbar, el botón de la
// llamada donde SetSmart pone «Registrarse» / «Crear Mi Agente IA», el caso de Mauricio en el lugar de las reseñas, y el
// resto de las funciones en las columnas del pie. Lo que se sacó de SetSmart (no tiene contenido real de MaKo): su badge de
// Meta y su «Más de 500 coaches», sus calificaciones de Trustpilot y sus estrellas, «Crea tu IA en solo unos clics» (su
// asistente por nicho), su tabla contra el setter humano, su calculadora de ROI, la grilla «Funciona con tu stack», su cita
// suelta, sus «Estadísticas en vivo», su selector de idioma y sus íconos sociales. El video de su sección «Automatiza el
// agendamiento» es, acá, el gráfico de esa fila de la landing (el marco 16:9 es el suyo).
// Server component sin JavaScript: el interruptor es un checkbox con :checked, el menú del teléfono es un <details>, las
// preguntas son <details> y las animaciones son CSS (se apagan con «reducir movimiento»).
// =============================================================================

import type { PropsDiseno } from '.';
import type { Bloque } from '../tipos';
import { RUTA_CTA, CASO, LogoMaKo, TEXTO_CTA, html, otrasFunciones } from '../marca';
import { VisualDeLanding } from '../Visuales';
import { FaltaAnimacion } from '../FaltaAnimacion';
import { NICHOS_SEGUIMIENTO, CHATS_SEGUIMIENTO, type LineaChat } from '../seguimiento';

const c = (n: string) => `d-seguimiento-${n}`;

/** «Cómo funciona»: donde SetSmart pone su video (mux-player 16:9), el lienzo REAL armando las tres plantillas, una por canal
 *  (banco C:/dev/bancos-portada/banco-flujo/, grabar.mjs; recortado a 16:9). */
export const VIDEO_COMO = { video: '/vsl-assets/seguimiento/como-funciona.webm', poster: '/vsl-assets/seguimiento/como-funciona.jpg' };

function Icono({ d, size = 16, grosor = 2 }: { d: string[]; size?: number; grosor?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={grosor} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d.map((p) => <path key={p} d={p} />)}
    </svg>
  );
}
const FLECHA = ['M5 12h14', 'M12 5l7 7-7 7'];
const CHEQUE = ['M5 12l5 5l10 -10'];
const ABAJO = ['M6 9l6 6l6 -6'];

/** Los cuatro corchetes de las esquinas: la firma de SetSmart alrededor de botones, títulos y la demo. */
function Esquinas({ tono = 'gris' }: { tono?: 'gris' | 'azul' }) {
  return (
    <>
      {['tl', 'tr', 'bl', 'br'].map((e) => <span key={e} aria-hidden="true" className={`${c('esq')} ${c(`esq-${e}`)} ${c(`esq-${tono}`)}`} />)}
    </>
  );
}

/** Texto que sube al pasar el mouse y deja ver su copia (el efecto de los botones y los links de SetSmart). */
function Rueda({ texto }: { texto: string }) {
  return (
    <span className={c('rueda')}>
      <span className={c('rueda-a')}>{texto}</span>
      <span className={c('rueda-b')} aria-hidden="true">{texto}</span>
    </span>
  );
}

/** La flecha doble que se corre al pasar el mouse. */
function FlechaCorre() {
  return (
    <span className={c('fc')} aria-hidden="true">
      <span className={c('fc-a')}><Icono d={FLECHA} size={14} /></span>
      <span className={c('fc-b')}><Icono d={FLECHA} size={14} /></span>
    </span>
  );
}

/** El botón negro redondeado de las secciones («Probar gratis», «Automatizar mis reservas»). */
function BotonNegro() {
  return (
    <div className={c('cta-fila')}>
      <a href={RUTA_CTA} className={c('btn-negro')}>{TEXTO_CTA}<span className={c('btn-negro-fl')}><Icono d={FLECHA} size={16} /></span></a>
    </div>
  );
}

/** El título de sección dentro de corchetes. */
function TituloEnCorchetes({ titulo, bajada, id }: { titulo: string; bajada?: string; id?: string }) {
  return (
    <div className={c('tcorch')}>
      <Esquinas />
      <h2 id={id} className={c('h2')} dangerouslySetInnerHTML={html(titulo)} />
      {bajada ? <p className={c('tcorch-p')} dangerouslySetInnerHTML={html(bajada)} /> : null}
    </div>
  );
}

/** El titular palabra por palabra, como su `.hero-word` (cada una entra 70 ms después de la anterior): la primera línea es lo de
 *  antes del <em>, la segunda (en azul) lo de adentro. */
function TitularPorPalabras({ titulo }: { titulo: string }) {
  const m = /^([\s\S]*?)<em>([\s\S]*?)<\/em>\s*$/.exec(titulo);
  const lineas = m ? [m[1], m[2]] : [titulo];
  let n = 0;
  // El lector de pantalla lee el titular entero (las palabras sueltas van escondidas para él).
  return (
    <h1 className={c('h1')}>
      <span className={c('vh')} dangerouslySetInnerHTML={html(titulo)} />
      <span aria-hidden="true">
        {lineas.map((l, i) => (
          <span key={i} className={`${c('h1-l')}${i === 1 ? ` ${c('h1-az')}` : ''}`}>
            {l.trim().split(/\s+/).map((w, j) => {
              const k = n++;
              return <span key={j}><span className={c('hw')} style={{ ['--i' as string]: k }}>{w}</span>{' '}</span>;
            })}
          </span>
        ))}
      </span>
    </h1>
  );
}

/** «Hecho para coaches»: la palabra que se escribe, espera y se borra (su máquina de escribir: 55 ms por letra, 1,6 s quieta, 28 ms
 *  por letra al borrar). La más larga, invisible, da el ancho; sin JavaScript se ve la primera. */
function Cejilla({ antes }: { antes: string }) {
  const larga = NICHOS_SEGUIMIENTO.reduce((a, b) => (b.length > a.length ? b : a), '');
  return (
    <p className={c('hero-etq')}>
      {antes}{' '}
      <span className={c('tw')} data-palabras={NICHOS_SEGUIMIENTO.join('|')}>
        <span className={c('tw-ancho')} aria-hidden="true">{larga}</span>
        <span className={c('tw-vis')}><span className={c('tw-txt')}>{NICHOS_SEGUIMIENTO[0]}</span><span className={c('tw-cur')} aria-hidden="true" /></span>
      </span>
    </p>
  );
}

function Hero({ b, logos }: { b: Extract<Bloque, { tipo: 'hero' }>; logos?: Extract<Bloque, { tipo: 'logos' }> }) {
  return (
    <div className={c('hero')}>
      <div className={c('hero-fondo')} aria-hidden="true" />
      <div className={c('hero-rel')}>
        <div className={c('hero-in')}>
          <div className={c('hero-txt')}>
            {b.etiqueta ? <Cejilla antes={b.etiqueta} /> : null}
            <TitularPorPalabras titulo={b.titulo} />
            <p className={c('hero-p')} dangerouslySetInnerHTML={html(b.bajada)} />
          </div>
          <div className={c('hero-cta')}>
            <div className={c('hero-caja')}>
              <Esquinas tono="azul" />
              <div className={c('hero-form')}>
                <a href={RUTA_CTA} className={c('hero-btn')}>
                  <span>{TEXTO_CTA}</span>
                  <FlechaCorre />
                </a>
              </div>
            </div>
            {b.puntos?.length ? (
              // Donde SetSmart rota una reseña cada 4 s (avatar + dos renglones), acá rotan los puntos del hero.
              <div className={c('rota')}>
                {b.puntos.map((p, i) => (
                  <div key={p} className={`${c('rota-i')}${i === 0 ? ` ${c('rota-on')}` : ''}`} aria-hidden={i === 0 ? undefined : true}>
                    <span className={c('hero-punto-ic')}><Icono d={CHEQUE} size={14} grosor={2.4} /></span>
                    <p className={c('rota-t')} dangerouslySetInnerHTML={html(p)} />
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <div className={c('demo')}>
          <div className={c('demo-in')}>
            <div className={c('demo-marco')}>
              <Esquinas />
              <div className={c('demo-caja')}>
                <div className={c('demo-sup')}>
                  <div className={c('demo-vis')}><VisualDeLanding visual={b.visual} /></div>
                </div>
              </div>
            </div>
          </div>
        </div>
        {logos ? (
          <div className={`${c('integra')} ${c('sr')}`}>
            <span className={c('integra-t')}>{logos.titulo}</span>
            <ul className={c('integra-fila')}>
              {logos.items.map((l) => (
                // eslint-disable-next-line @next/next/no-img-element
                <li key={l.nombre}><img src={`/vsl-assets/logos/${l.logo}`} alt={l.nombre} title={l.nombre} /></li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const RELOJ = ['M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0', 'M12 7v5l3 3'];
const VISTO = ['M7 12l5 5l10 -10', 'M2 12l5 5m5 -5l5 -5'];
/** Los íconos de los canales (debajo de los chats y en la cabecera de cada uno), en el gris de SetSmart. */
const CANALES: { n: string; d: string[] }[] = [
  { n: 'Instagram', d: ['M4 8a4 4 0 0 1 4 -4h8a4 4 0 0 1 4 4v8a4 4 0 0 1 -4 4h-8a4 4 0 0 1 -4 -4z', 'M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0', 'M16.5 7.5v.01'] },
  { n: 'WhatsApp', d: ['M3 21l1.65 -3.8a9 9 0 1 1 3.4 2.9l-5.05 .9', 'M9 10a.5 .5 0 0 0 1 0v-1a.5 .5 0 0 0 -1 0v1a5 5 0 0 0 5 5h1a.5 .5 0 0 0 0 -1h-1a.5 .5 0 0 0 0 1'] },
  { n: 'Messenger', d: ['M3 20l1.3 -3.9a9 8 0 1 1 3.4 2.9l-4.7 1', 'M8 13l3 -2l2 2l3 -2'] },
  { n: 'Email', d: ['M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10z', 'M3 7l9 6l9 -6'] },
];

/** Una de las dos tarjetas de chat del interruptor (su BeforeAfterDemo: cabecera con el lead, los globos, la pausa «10h después» y el
 *  pie con el tiempo y la pastilla). */
function ChatCarta({ lado, lineas, pie }: { lado: 'sin' | 'con'; lineas: LineaChat[]; pie: [string, string] }) {
  const { lead } = CHATS_SEGUIMIENTO;
  return (
    <div className={`${c('chat')} ${c(`chat-${lado}`)}`}>
      <div className={c('chat-cab')}>
        <span className={c('chat-ava')} aria-hidden="true">{lead.nombre.split(' ').map((p) => p[0]).join('')}</span>
        <div className={c('chat-quien')}><p className={c('chat-n')}>{lead.nombre}</p><p className={c('chat-u')}>{lead.usuario}</p></div>
        <span className={c('chat-red')}><Icono d={CANALES[0].d} size={16} /></span>
      </div>
      <div className={c('chat-cu')}>
        {lineas.map((l, i) => {
          switch (l.tipo) {
            case 'nota': return <p key={i} className={c('chat-hora')}>{l.texto}</p>;
            case 'lead': return <div key={i} className={c('chat-fila')}><p className={`${c('globo')} ${c('globo-lead')}`}>{l.texto}</p></div>;
            case 'negocio': return <div key={i} className={`${c('chat-fila')} ${c('chat-fila-der')}`}><p className={`${c('globo')} ${c('globo-neg')}`}>{l.texto}</p></div>;
            case 'pausa': return <div key={i} className={c('pausa')}><span className={c('pausa-l')} /><span className={c('pausa-t')}><Icono d={RELOJ} size={12} />{l.texto}</span><span className={c('pausa-l')} /></div>;
            case 'visto': return <div key={i} className={c('visto')}><span className={c('visto-ic')}><Icono d={VISTO} size={16} /></span><span className={c('visto-t')}>{l.texto}</span></div>;
            case 'aviso': return (
              <div key={i} className={c('aviso')}>
                <span className={c('aviso-ic')}><Icono d={CHEQUE} size={18} grosor={2.2} /></span>
                <div className={c('aviso-tx')}><p className={c('aviso-t')}>{l.titulo}</p><p className={c('aviso-p')}>{l.texto}</p></div>
              </div>
            );
          }
        })}
      </div>
      <div className={c('chat-pie')}>
        <span className={c('chat-tiempo')}><Icono d={RELOJ} size={14} /><strong>{pie[0]}</strong></span>
        <span className={`${c('chat-pas')} ${c(`chat-pas-${lado}`)}`}>{pie[1]}</span>
      </div>
    </div>
  );
}

/** Su «El problema / La solución»: arranca en «Sin», se da vuelta solo cada 5 s (el script) y el interruptor lo da vuelta a mano. Sin
 *  JavaScript es una casilla: la pastilla, el final del título, el interruptor y la tarjeta cambian con :checked. */
function Contraste({ b }: { b: Extract<Bloque, { tipo: 'contraste' }> }) {
  return (
    <section className={`${c('sol')} ${c('sr')}`} id={c('solucion')}>
      <div className={c('sol-in')}>
        <input type="checkbox" id={c('sw')} className={c('sw-cb')} aria-label={`Ver ${b.con.titulo.replace(/<[^>]+>/g, '')}`} />
        <div className={c('pill-fila')}>
          <span className={c('pill')}><span className={c('pill-p')} /><span className={c('pill-sin')}>El problema</span><span className={c('pill-con')}>{b.etiqueta ?? 'La solución'}</span></span>
        </div>
        <div className={c('sol-enc')}>
          <h2 className={c('h2')}>
            <span dangerouslySetInnerHTML={html(b.titulo)} />{' '}
            <span className={c('sol-fin')}>
              <span className={c('sol-fin-sin')} dangerouslySetInnerHTML={html(b.sin.titulo)} />
              <span className={c('sol-fin-con')} dangerouslySetInnerHTML={html(b.con.titulo)} />
            </span>
          </h2>
          <p className={c('sol-p')} dangerouslySetInnerHTML={html(b.sin.texto)} />
        </div>
        <div className={c('sw-fila')}>
          <label htmlFor={c('sw')} className={`${c('sw-l')} ${c('sw-l-sin')}`}>Sin MaKo</label>
          <label htmlFor={c('sw')} className={c('sw-pista')} aria-hidden="true"><span className={c('sw-bola')} /></label>
          <label htmlFor={c('sw')} className={`${c('sw-l')} ${c('sw-l-con')}`}>Con MaKo</label>
        </div>
        <div className={c('sw-cartas')}>
          <ChatCarta lado="sin" {...CHATS_SEGUIMIENTO.sin} />
          <ChatCarta lado="con" {...CHATS_SEGUIMIENTO.con} />
        </div>
        <div className={c('canales')}>
          {CANALES.map((x) => <span key={x.n} className={c('canal')} title={x.n}><Icono d={x.d} size={16} /></span>)}
          <span className={c('canales-t')} dangerouslySetInnerHTML={html(b.con.texto)} />
        </div>
        {b.cta ? <BotonNegro /> : null}
      </div>
    </section>
  );
}

function Caso() {
  const autor = (
    <div className={c('res-autor')}>
      <span className={c('res-ava')} aria-hidden="true">{CASO.quien.charAt(0)}</span>
      <span className={c('res-quien')}><span className={c('res-n')}>{CASO.quien}</span><span className={c('res-r')}>{CASO.rol}</span></span>
    </div>
  );
  return (
    <section className={`${c('res')} ${c('sr')}`}>
      <div className={c('res-enc')}>
        <h2 className={`${c('h2')} ${c('res-h2')}`} dangerouslySetInnerHTML={html(CASO.titulo)} />
        <p className={c('res-sub')}>{CASO.sub}</p>
      </div>
      <div className={c('res-in')}>
        <div className={c('res-cols')}>
          <article className={c('res-art')}>
            <div className={c('res-video')}><video muted autoPlay loop playsInline preload="metadata"><source src={CASO.video} type="video/mp4" /></video></div>
            <p className={c('res-p')} dangerouslySetInnerHTML={html(CASO.historia[0])} />
            {autor}
          </article>
          <article className={c('res-art')}>
            <p className={c('res-p')} dangerouslySetInnerHTML={html(CASO.historia[1])} />
            {autor}
          </article>
          <article className={c('res-art')}>
            <h3 className={c('res-h3')}>{CASO.sub}</h3>
            <p className={c('res-p')} dangerouslySetInnerHTML={html(CASO.resultado)} />
            <ul className={c('res-meses')}>
              {CASO.meses.map((m) => <li key={m.mes}><span>{m.mes}</span><strong>{m.monto}</strong></li>)}
            </ul>
            {autor}
          </article>
        </div>
      </div>
    </section>
  );
}

/** Las seis tarjetas: dos tercios + un tercio, alternando, con su superficie de demo arriba (como «Todo lo que hace tu setter IA»). */
function Bento({ b, icono }: { b: Extract<Bloque, { tipo: 'tarjetas' }>; icono: string[] }) {
  const ancho = [2, 1, 1, 2, 2, 1];
  return (
    <section className={c('bento')} id={c('funciones')}>
      <div className={`${c('bento-in')} ${c('sr')}`}>
        <TituloEnCorchetes titulo={b.titulo} bajada={b.bajada} />
        <div className={c('bento-grid')}>
          {b.items.map((t, i) => (
            <div key={t.titulo} className={`${c('bcard')}${ancho[i % 6] === 2 ? ` ${c('bcard-2')}` : ''}`}>
              <div className={c('bsup')}>
                {FOTO_DE_TARJETA[i]
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img className={c('bfoto')} src={FOTO_DE_TARJETA[i].src} alt={FOTO_DE_TARJETA[i].alt} width={FOTO_DE_TARJETA[i].w} height={FOTO_DE_TARJETA[i].h} loading="lazy" decoding="async" />
                  : <span className={c('bwid-ic')}><Icono d={t.icono ?? icono} size={20} grosor={1.8} /></span>}
              </div>
              <div className={c('btxt')}>
                <h3 className={c('h3')} dangerouslySetInnerHTML={html(t.titulo)} />
                <p className={c('bp')} dangerouslySetInnerHTML={html(t.texto)} />
              </div>
            </div>
          ))}
        </div>
        {b.cta ? <BotonNegro /> : null}
      </div>
    </section>
  );
}

/** Las tarjetas REALES del lienzo de Automations, fotografiadas al doble en el banco C:/dev/bancos-portada/banco-flujo/
 *  (fotos-landing.mjs), una por tarjeta de «Todo lo que hace tu setter con IA», en su orden. */
export const FOTO_DE_TARJETA: readonly { src: string; alt: string; w: number; h: number }[] = [
  { src: '/vsl-assets/seguimiento/tarjeta-comentario-dm.jpg', alt: 'El disparador «El usuario comenta tu publicación o Reel con GUÍA» y el DM de Instagram que sale', w: 624, h: 225 },
  { src: '/vsl-assets/seguimiento/tarjeta-califica.jpg', alt: 'La tarjeta AI Step con su objetivo «Que agende una llamada»', w: 220, h: 105 },
  { src: '/vsl-assets/seguimiento/tarjeta-recuerda.jpg', alt: 'La tarjeta de WhatsApp: «Hola {{nombre}}, vi que agendaste la reunión. ¿Confirmas tu asistencia?»', w: 220, h: 155 },
  { src: '/vsl-assets/seguimiento/tarjeta-seguimientos.jpg', alt: 'La condición «Llegó hace menos de 3 días y No agendó», el WhatsApp y la espera de 1 día', w: 604, h: 225 },
  { src: '/vsl-assets/seguimiento/tarjeta-tono.jpg', alt: 'La tarjeta de email «Gracias por tus datos» y la espera de 2 días', w: 317, h: 186 },
  { src: '/vsl-assets/seguimiento/tarjeta-te-lo-pasa.jpg', alt: 'La tarjeta «MaKo en WhatsApp»: te avisa que el lead te escribió por Instagram', w: 258, h: 141 },
];

/** La línea de tres puntos con su video arriba (como «Automatiza el agendamiento de citas…»). */
function Linea({ b }: { b: Extract<Bloque, { tipo: 'filas' }> }) {
  return (
    <section className={c('lin')} id={c('como')}>
      <div className={`${c('lin-in')} ${c('sr')}`}>
        <div className={c('lin-enc')}>
          <h2 className={`${c('h2')} ${c('lin-h2')}`} dangerouslySetInnerHTML={html(b.titulo)} />
          {b.bajada ? <p className={c('lin-p')} dangerouslySetInnerHTML={html(b.bajada)} /> : null}
        </div>
        <div className={c('lin-video')}>
          <video src={VIDEO_COMO.video} poster={VIDEO_COMO.poster} muted autoPlay loop playsInline preload="metadata" aria-label="El lienzo de Automations armando una automatización por WhatsApp, otra por Instagram y otra por email" />
        </div>
        <div className={c('lin-grid')}>
          {b.items.map((f, i) => (
            <div key={f.titulo} className={c('lin-it')}>
              <span className={`${c('lin-dot')}${i === b.items.length - 1 ? ` ${c('lin-dot-oro')}` : ''}`} aria-hidden="true" />
              <h3 className={`${c('h3')} ${c('lin-h3')}`} dangerouslySetInnerHTML={html(f.titulo)} />
              <p className={c('bp')} dangerouslySetInnerHTML={html(f.texto)} />
              {f.puntos?.length ? <ul className={c('lin-puntos')}>{f.puntos.map((p) => <li key={p} dangerouslySetInnerHTML={html(p)} />)}</ul> : null}
            </div>
          ))}
        </div>
        <BotonNegro />
      </div>
    </section>
  );
}

function Pasos({ b }: { b: Extract<Bloque, { tipo: 'pasos' }> }) {
  return (
    <section className={c('pasos')}>
      <div className={`${c('pasos-in')} ${c('sr')}`}>
        <div className={c('pasos-enc')}><TituloEnCorchetes titulo={b.titulo} bajada={b.bajada} /></div>
        <ol className={c('pasos-grid')}>
          {b.pasos.map((p, i) => (
            <li key={p.titulo} className={c('paso')}>
              <span className={c('paso-n')}>{String(i + 1).padStart(2, '0')}</span>
              <h3 className={`${c('h3')} ${c('paso-h3')}`} dangerouslySetInnerHTML={html(p.titulo)} />
              <p className={c('bp')} dangerouslySetInnerHTML={html(p.texto)} />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** «Controla SetSmart desde tu propia IA»: donde la referencia pone su terminal va una sesión real de la API de MaKo. Hasta
 *  tenerla grabada, el recuadro de lo que falta (12/11/2026: la terminal dibujada a mano se sacó). */
function Terminal({ b }: { b: Extract<Bloque, { tipo: 'tarjetas' }> }) {
  return (
    <section className={c('term')}>
      <div className={`${c('term-in')} ${c('sr')}`}>
        <TituloEnCorchetes titulo={b.titulo} bajada={b.bajada} />
        <div className={c('term-falta')}>
          <FaltaAnimacion que="Una sesión real de la API de MaKo con Claude." />
        </div>
        {b.cta ? <BotonNegro /> : null}
      </div>
    </section>
  );
}

function Preguntas({ b }: { b: Extract<Bloque, { tipo: 'preguntas' }> }) {
  return (
    <section className={c('faq')} id={c('preguntas')}>
      <div className={`${c('faq-in')} ${c('sr')}`}>
        <div className={c('faq-enc')}><TituloEnCorchetes titulo={b.titulo} /></div>
        <div className={c('faq-lista')}>
          {b.items.map((q) => (
            <details key={q.p} className={c('faq-i')}>
              <summary><span className={c('faq-q')}>{q.p}</span><span className={c('faq-ch')}><Icono d={ABAJO} size={16} /></span></summary>
              <p className={c('faq-r')} dangerouslySetInnerHTML={html(q.r)} />
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pie({ slug, metaDesc }: { slug: string; metaDesc: string }) {
  const otras = otrasFunciones(slug);
  const tercio = Math.ceil(otras.length / 3);
  const cols = [otras.slice(0, tercio), otras.slice(tercio, tercio * 2), otras.slice(tercio * 2)];
  return (
    <footer className={c('pie')}>
      <div className={c('pie-in')}>
        <div className={c('pie-grid')}>
          <div className={c('pie-marca')}>
            <LogoMaKo className={c('pie-logo')} tamano={26} claro />
            <p className={c('pie-desc')}>{metaDesc}</p>
          </div>
          {cols.map((col, i) => (
            <div key={i} className={c('pie-col')}>
              <h3 className={c('pie-h')} aria-hidden={i > 0 ? true : undefined}>{i === 0 ? 'Funciones' : ' '}</h3>
              <ul>
                {col.map((o) => <li key={o.href}><a href={o.href}>{o.nombre}</a></li>)}
              </ul>
            </div>
          ))}
        </div>
        <div className={c('pie-abajo')}>
          <p>© 2026 MaKo</p>
          <ul>
            <li><a href="/terminos">Términos del servicio</a></li>
            <li><a href="/privacidad">Privacidad</a></li>
            <li><a href="/aup">Política de uso aceptable</a></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}

function Barra({ landing }: { landing: PropsDiseno['landing'] }) {
  const links: { href: string; t: string }[] = [];
  const con = landing.bloques.find((b) => b.tipo === 'contraste');
  if (con && con.tipo === 'contraste' && con.etiqueta) links.push({ href: `#${c('solucion')}`, t: con.etiqueta });
  if (landing.bloques.some((b) => b.tipo === 'filas')) links.push({ href: `#${c('como')}`, t: 'Cómo funciona' });
  if (landing.bloques.some((b) => b.tipo === 'tarjetas')) links.push({ href: `#${c('funciones')}`, t: 'Funciones' });
  if (landing.bloques.some((b) => b.tipo === 'preguntas')) links.push({ href: `#${c('preguntas')}`, t: 'Preguntas' });
  return (
    <header className={c('barra')}>
      <div className={c('barra-in')}>
        <div className={c('barra-grid')}>
          <LogoMaKo className={c('logo')} tamano={24} />
          <nav className={c('nav')} aria-label="Secciones">
            {links.map((l, i) => (
              <a key={l.href} href={l.href} className={c('nav-a')}><Rueda texto={l.t} /><sup>{String(i + 1).padStart(2, '0')}</sup></a>
            ))}
          </nav>
          <div className={c('barra-der')}>
            <a href="/login" className={`${c('cf')} ${c('cf-rev')} ${c('nav-a')} ${c('login')}`}><Esquinas /><Rueda texto="Iniciar sesión" /></a>
            <a href={RUTA_CTA} className={`${c('cf')} ${c('btn-barra')}`}>
              <span className={c('btn-barra-fill')} aria-hidden="true" />
              <Esquinas />
              <span className={c('btn-barra-ic')}><FlechaCorre /></span>
              <span className={c('btn-barra-t')}><Rueda texto={TEXTO_CTA} /></span>
            </a>
          </div>
          <details className={c('menu')}>
            <summary aria-label="Menú"><Icono d={['M4 6h16', 'M4 12h16', 'M4 18h16']} size={20} /></summary>
            <div className={c('menu-panel')}>
              {links.map((l) => <a key={l.href} href={l.href}>{l.t}</a>)}
              <a href="/login">Iniciar sesión</a>
              <a href={RUTA_CTA} className={c('menu-cta')}>{TEXTO_CTA}</a>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}

export default function DisenoSeguimiento({ landing }: PropsDiseno) {
  const bloques = landing.bloques;
  const logos = bloques.find((b) => b.tipo === 'logos') as Extract<Bloque, { tipo: 'logos' }> | undefined;
  return (
    <div className={c('raiz')}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <Barra landing={landing} />
      <main>
        {bloques.map((b, i) => {
          switch (b.tipo) {
            case 'hero': return <Hero key={i} b={b} logos={logos} />;
            case 'logos': return null; // va dentro del hero, donde SetSmart pone «Se integra con»
            case 'contraste': return <Contraste key={i} b={b} />;
            case 'caso': return <Caso key={i} />;
            case 'tarjetas': return b.columnas === 2 ? <Terminal key={i} b={b} /> : <Bento key={i} b={b} icono={landing.icono} />;
            case 'filas': return <Linea key={i} b={b} />;
            case 'pasos': return <Pasos key={i} b={b} />;
            case 'preguntas': return <Preguntas key={i} b={b} />;
            default: return null;
          }
        })}
      </main>
      <Pie slug={landing.slug} metaDesc={landing.metaDesc} />
      {/* En el teléfono, cuando el botón del hero se va por arriba, el botón queda fijo abajo (su stickyCtaBar). */}
      <div className={c('fija')}>
        <a href={RUTA_CTA} className={c('fija-btn')}>{TEXTO_CTA}<FlechaCorre /></a>
      </div>
      <script data-visor="" dangerouslySetInnerHTML={{ __html: SCRIPT }} />
    </div>
  );
}

// LO QUE SE MUEVE CON JAVASCRIPT (lo de sus scripts de Nuxt, reescrito; un <script data-visor> porque el visor de Martín borra los
// demás). Limpia su estado al arrancar (pulir.mjs guarda el DOM con lo que el script dejó) y no corre dos veces:
//   · lo que aparece al bajar: su directiva v-reveal (IntersectionObserver con umbral ,1; lo que ya se ve, a la vista enseguida);
//   · la cejilla «Hecho para …»: 55 ms por letra al escribir, 1,6 s quieta, 28 ms por letra al borrar;
//   · los puntos debajo del botón: cambian cada 4 s (su TestimonialRotator);
//   · el interruptor «Sin / Con»: se da vuelta solo cada 5 s y, si se toca, vuelve a contar (su BeforeAfterDemo).
// Con «reducir movimiento» no se mueve nada (como en la suya).
const SCRIPT = `(function(){
var P='d-seguimiento';
function trasHidratar(fn){if(!document.querySelector('script[src*="/_next/"]'))return fn();var t0=Date.now();(function mira(){var h=Object.keys(document.body).some(function(k){return k.indexOf('__reactFiber')===0||k.indexOf('__reactProps')===0;});if(h||Date.now()-t0>6000)fn();else setTimeout(mira,60);})();}
function iniciar(){
  var R=document.querySelector('.'+P+'-raiz');if(!R||R.__listo)return;R.__listo=1;
  var quieto=!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);
  var srs=[].slice.call(R.querySelectorAll('.'+P+'-sr'));
  R.classList.remove(P+'-js');srs.forEach(function(el){el.classList.remove(P+'-sr-in');});
  if(!quieto&&'IntersectionObserver' in window){
    var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add(P+'-sr-in');io.unobserve(e.target);}});},{threshold:.1});
    srs.forEach(function(el){if(el.getBoundingClientRect().top<innerHeight)el.classList.add(P+'-sr-in');else io.observe(el);});
    R.classList.add(P+'-js');
  }
  var tw=R.querySelector('.'+P+'-tw'),txt=tw&&tw.querySelector('.'+P+'-tw-txt');
  if(tw&&txt){
    var pal=(tw.getAttribute('data-palabras')||'').split('|');txt.textContent=pal[0];
    if(!quieto&&pal.length>1){
      var i=0,modo='quieta';
      var paso=function(){
        if(modo==='quieta'){modo='borra';return setTimeout(paso,1600);}
        if(modo==='borra'){if(txt.textContent.length){txt.textContent=txt.textContent.slice(0,-1);return setTimeout(paso,28);}i=(i+1)%pal.length;modo='escribe';return setTimeout(paso,55);}
        var n=pal[i];if(txt.textContent.length<n.length){txt.textContent=n.slice(0,txt.textContent.length+1);return setTimeout(paso,55);}
        modo='quieta';paso();
      };
      paso();
    }
  }
  var it=[].slice.call(R.querySelectorAll('.'+P+'-rota-i'));
  it.forEach(function(x,k){x.classList.toggle(P+'-rota-on',k===0);x.classList.remove(P+'-rota-sale');});
  if(!quieto&&it.length>1){
    var j=0;
    setInterval(function(){var a=it[j];j=(j+1)%it.length;var b=it[j];a.classList.remove(P+'-rota-on');a.classList.add(P+'-rota-sale');setTimeout(function(){a.classList.remove(P+'-rota-sale');b.classList.add(P+'-rota-on');},350);},4000);
  }
  var sw=R.querySelector('#'+P+'-sw');
  if(sw){
    sw.checked=false;
    if(!quieto){var t=null;var arma=function(){clearInterval(t);t=setInterval(function(){sw.checked=!sw.checked;},5000);};sw.addEventListener('change',arma);arma();}
  }
  [].slice.call(R.querySelectorAll('video')).forEach(function(v){v.muted=true;if(quieto){v.removeAttribute('autoplay');v.pause();}});
  var fija=R.querySelector('.'+P+'-fija'),caja=R.querySelector('.'+P+'-hero-caja');
  document.body.classList.remove(P+'-fija-on');if(fija)fija.classList.remove(P+'-fija-vis');
  if(fija&&caja&&'IntersectionObserver' in window){
    document.body.classList.add(P+'-fija-on');
    var cab=document.querySelector('header'),hh=Math.round((cab&&cab.getBoundingClientRect().height)||60);
    new IntersectionObserver(function(es){var e=es[0],arriba=(e.rootBounds&&e.rootBounds.top)||hh;fija.classList.toggle(P+'-fija-vis',!e.isIntersecting&&e.boundingClientRect.bottom<=arriba);},{threshold:0,rootMargin:'-'+hh+'px 0px 0px 0px'}).observe(caja);
  }
}
function arrancar(){trasHidratar(iniciar);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',arrancar);else arrancar();
})();`;

// Los valores, medidos en setsmart.io/es el 11/11/2026 (docs/diseno/landings-competencia/seguimiento.md). Tailwind v4:
// neutral-900 #171717, neutral-500 #737373, neutral-400 #a3a3a3, neutral-200 #e5e5e5, neutral-100 #f5f5f5, neutral-50
// #fafafa, zinc-900 #18181b, zinc-700 #3f3f46, zinc-500 #71717a, zinc-400 #a1a1aa, zinc-300 #d4d4d8, zinc-200 #e4e4e7.
const CSS = `
@font-face{font-family:'DSeg Fustat';src:url('/vsl-assets/fuentes/fustat/fustat-latin-var.woff2') format('woff2');font-weight:200 800;font-style:normal;font-display:swap}
@font-face{font-family:'DSeg Inter';src:url('/vsl-assets/fuentes/inter/inter-latin-var.woff2') format('woff2');font-weight:100 900;font-style:normal;font-display:swap}
@font-face{font-family:'DSeg Mono';src:url('/vsl-assets/fuentes/dm-mono/dm-mono-latin-400.woff2') format('woff2');font-weight:400;font-style:normal;font-display:swap}
.s-raiz{--az:#2F6FED;--oro:#F2B01E;--n9:#171717;--n5:#737373;--n4:#a3a3a3;--n2:#e5e5e5;--n1:#f5f5f5;--n0:#fafafa;--z9:#18181b;--z7:#3f3f46;--z5:#71717a;--z4:#a1a1aa;--z3:#d4d4d8;--z2:#e4e4e7;--z1:#f4f4f5;--fh:'DSeg Fustat','DSeg Inter',ui-sans-serif,system-ui,sans-serif;--fm:'DSeg Mono',ui-monospace,SFMono-Regular,monospace;--ease:cubic-bezier(.4,0,.2,1);background:#fff;color:#111827;font-family:'DSeg Inter',ui-sans-serif,system-ui,sans-serif;font-size:16px;line-height:24px;-webkit-font-smoothing:antialiased;overflow-x:clip}
:where(.s-raiz) *,:where(.s-raiz) *::before,:where(.s-raiz) *::after{box-sizing:border-box}
:where(.s-raiz) a{color:inherit;text-decoration:none}
:where(.s-raiz) :where(h1,h2,h3,p,ul,ol,figure){margin:0;padding:0}
:where(.s-raiz) :where(ul,ol){list-style:none}
:where(.s-raiz) :where(img,video,svg){display:block}
.s-h2{font-family:var(--fh);font-size:36px;line-height:40px;font-weight:600;letter-spacing:-.025em;color:var(--n9)}
.s-h2 em,.s-h1 em{font-style:normal;color:var(--az)}
.s-h3{font-family:var(--fh);font-size:16px;line-height:24px;font-weight:600;color:var(--n9);margin-bottom:6px}
.s-bp{font-size:14px;line-height:22.75px;color:var(--n5)}
.s-bp strong{color:var(--n9);font-weight:600}

/* Corchetes */
.s-esq{position:absolute;width:12px;height:12px;pointer-events:none;border:0 solid var(--z3)}
.s-esq-azul{border-color:var(--az)}
.s-esq-tl{top:0;left:0;border-top-width:1px;border-left-width:1px}
.s-esq-tr{top:0;right:0;border-top-width:1px;border-right-width:1px}
.s-esq-bl{bottom:0;left:0;border-bottom-width:1px;border-left-width:1px}
.s-esq-br{bottom:0;right:0;border-bottom-width:1px;border-right-width:1px}

/* Texto que rueda y flecha que se corre */
.s-rueda{display:inline-block;overflow:hidden;position:relative;vertical-align:bottom;white-space:nowrap}
.s-rueda-a,.s-rueda-b{display:block;transition:transform .3s var(--ease)}
.s-rueda-b{position:absolute;left:0;top:100%;color:var(--n9);font-family:var(--fh)}
.s-fc{position:relative;width:16px;height:16px;overflow:hidden;display:flex;align-items:center;justify-content:center;flex:none}
.s-fc-a,.s-fc-b{display:flex;transition:transform .3s var(--ease)}
.s-fc-b{position:absolute;transform:translateX(-160%)}

/* Barra */
.s-barra{position:fixed;top:0;left:0;right:0;z-index:30;padding:20px 24px 0}
.s-barra-in{max-width:1440px;margin:0 auto;padding:12px 24px;background:rgba(255,255,255,.8);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}
.s-barra-grid{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:16px}
.s-logo{justify-self:start;font-family:var(--fh)}
.s-nav{display:flex;align-items:center;gap:24px;font-size:13px;line-height:19.5px;color:var(--n5);justify-self:center;white-space:nowrap}
.s-nav-a{transition:color .15s}
.s-nav-a:hover{color:var(--n9)}
.s-nav-a:hover .s-rueda-a,.s-nav-a:hover .s-rueda-b{transform:translateY(-100%)}
.s-nav sup{margin-left:2px;font-family:var(--fm);font-size:9px;line-height:12px;color:var(--n4)}
.s-barra-der{display:flex;align-items:center;gap:16px;justify-self:end;white-space:nowrap}
.s-cf{position:relative}
.s-cf .s-esq{width:7px;height:7px;transition:transform .2s ease,opacity .2s ease;z-index:10}
.s-cf:hover .s-esq-tl{transform:translate(-3px,-3px)}
.s-cf:hover .s-esq-tr{transform:translate(3px,-3px)}
.s-cf:hover .s-esq-bl{transform:translate(-3px,3px)}
.s-cf:hover .s-esq-br{transform:translate(3px,3px)}
.s-cf-rev .s-esq{opacity:0;border-color:var(--n4)}
.s-cf-rev:hover .s-esq{opacity:1}
.s-login{font-size:13px;line-height:19.5px;color:var(--n5);padding:8px 12px}
.s-btn-barra{display:flex;align-items:center;gap:10px;background:#fff;padding:6px 16px 6px 6px;font-size:13px;line-height:19.5px;font-weight:500;color:var(--n9)}
.s-btn-barra .s-esq{border-color:var(--n9)}
.s-btn-barra-fill{position:absolute;inset:0;background:var(--n9);transform:scaleX(0);transform-origin:left;transition:transform .3s var(--ease)}
.s-btn-barra-ic{position:relative;z-index:1;width:24px;height:24px;background:var(--az);color:#fff;display:flex;align-items:center;justify-content:center;flex:none;overflow:hidden}
.s-btn-barra-t{position:relative;z-index:1}
.s-btn-barra .s-rueda-b{color:#fff}
.s-btn-barra:hover .s-btn-barra-fill{transform:scaleX(1)}
.s-btn-barra:hover .s-esq{border-color:var(--az)}
.s-btn-barra:hover .s-rueda-a,.s-btn-barra:hover .s-rueda-b{transform:translateY(-100%)}
.s-btn-barra:hover .s-fc-a,.s-hero-btn:hover .s-fc-a{transform:translateX(160%)}
.s-btn-barra:hover .s-fc-b,.s-hero-btn:hover .s-fc-b{transform:translateX(0)}
.s-menu{display:none;justify-self:end;grid-column:3;position:relative}
.s-menu summary{list-style:none;cursor:pointer;padding:8px;border-radius:8px;color:#525252;display:flex}
.s-menu summary::-webkit-details-marker{display:none}
.s-menu-panel{position:absolute;right:0;top:calc(100% + 12px);width:240px;background:#fff;border:1px solid var(--n2);border-radius:8px;padding:8px;display:flex;flex-direction:column;box-shadow:0 12px 32px -16px rgba(0,0,0,.25)}
.s-menu-panel a{padding:10px 12px;font-size:14px;color:var(--n9);border-radius:6px}
.s-menu-panel a:hover{background:var(--n0)}
.s-menu-panel .s-menu-cta{margin-top:6px;background:var(--n9);color:#fff;text-align:center;font-weight:500}
.s-menu-panel .s-menu-cta:hover{background:#262626}

/* Hero */
.s-hero{position:relative;overflow:hidden;text-align:center}
.s-hero-fondo{position:absolute;inset:0;background-color:#fff;background-image:repeating-linear-gradient(45deg,transparent,transparent 50px,#00000006 50px,#00000006 51px),repeating-linear-gradient(-45deg,transparent,transparent 50px,#00000006 50px,#00000006 51px)}
.s-hero-rel{position:relative}
.s-hero-in{max-width:1200px;margin:0 auto;padding:112px 32px 16px;animation:s-sube 1.6s cubic-bezier(.16,1,.3,1) both}
.s-hero-txt{display:flex;flex-direction:column;align-items:center;padding-top:32px}
.s-hero-etq{margin-bottom:24px;font-size:14px;line-height:20px;color:var(--z5)}
.s-tw{position:relative;display:inline-block;text-align:left}
.s-tw-ancho{visibility:hidden;white-space:nowrap;font-weight:500}
.s-tw-vis{position:absolute;top:0;bottom:0;left:0;display:flex;align-items:center;white-space:nowrap}
.s-tw-txt{font-weight:500;color:#18181b}
.s-tw-cur{margin-left:2px;display:inline-block;width:2px;height:1em;background:var(--z4);flex:none;animation:s-parpadeo 1.1s step-end infinite}
.s-h1{font-family:var(--fh);font-size:48px;line-height:1.1;font-weight:600;letter-spacing:-.025em;color:var(--n9);max-width:896px}
.s-vh{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
.s-h1-l{display:block;text-wrap:balance}
.s-h1-az{color:var(--az)}
.s-hw{display:inline-block;animation:s-palabra .9s cubic-bezier(.16,1,.3,1) both;animation-delay:calc(var(--i) * 70ms)}
.s-h1 em{display:block}
.s-hero-p{margin-top:24px;max-width:570px;font-size:16.8px;line-height:1.625;color:var(--n5)}
.s-hero-p strong{font-weight:600;color:var(--n9)}
.s-hero-cta{display:flex;flex-direction:column;align-items:center;padding:32px 0}
.s-hero-caja{position:relative;width:100%;max-width:448px;padding:12px}
.s-hero-form{display:flex;align-items:stretch;border-radius:12px;background:#fff;border:1px solid var(--n2);overflow:hidden}
.s-hero-btn{flex:1;display:flex;align-items:center;justify-content:center;gap:8px;padding:14px 24px;background:var(--n9);color:#fff;font-size:14px;line-height:20px;font-weight:500;transition:background .2s}
.s-hero-btn:hover{background:#262626}
.s-hero-btn .s-rueda-b{color:#fff}
.s-hero-btn:hover .s-rueda-a,.s-hero-btn:hover .s-rueda-b{transform:translateY(-100%)}
/* La reseña que rota cada 4 s (su TestimonialRotator, tr-swap: sale hacia arriba y entra desde abajo, ,35 s) */
.s-rota{display:grid;justify-items:center;margin-top:20px;width:100%;max-width:448px}
.s-rota-i{grid-area:1/1;display:flex;align-items:center;gap:10px;max-width:260px;text-align:left;opacity:0;transform:translateY(8px);transition:opacity .35s ease,transform .35s ease;pointer-events:none}
.s-rota-on{opacity:1;transform:none;pointer-events:auto}
.s-rota-sale{opacity:0;transform:translateY(-8px)}
.s-rota-t{font-size:12px;line-height:1.375;color:var(--n5);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.s-hero-punto-ic{width:32px;height:32px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;background:var(--z1);border:1px solid var(--z2);color:var(--az)}
.s-demo{margin-bottom:40px}
.s-demo-in{max-width:1280px;margin:0 auto;padding:0 24px}
.s-demo-marco{position:relative;padding:8px;animation:s-sube 1.6s cubic-bezier(.16,1,.3,1) both}
.s-demo-caja{background:#fff;border-radius:4px;border:1px solid var(--n2);overflow:hidden}
.s-demo-sup{height:auto;display:flex;align-items:center;justify-content:center;padding:40px;background-color:var(--n0);background-image:repeating-linear-gradient(45deg,transparent,transparent 50px,#00000006 50px,#00000006 51px),repeating-linear-gradient(-45deg,transparent,transparent 50px,#00000006 50px,#00000006 51px)}
.s-demo-vis{width:100%;max-width:1040px;background:#fff;border:1px solid var(--n2);border-radius:4px;overflow:hidden}
.s-integra{max-width:1200px;margin:0 auto;padding:0 32px 64px;display:flex;flex-direction:column;align-items:center;gap:10px}
.s-integra-t{font-size:11px;line-height:16.5px;font-weight:500;text-transform:uppercase;letter-spacing:.05em;color:var(--n4)}
.s-integra-fila{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:20px}
.s-integra-fila img{width:28px;height:28px;object-fit:contain;filter:grayscale(1);opacity:.5;transition:all .2s}
.s-integra-fila img:hover{filter:none;opacity:1}

/* La solución: su BeforeAfterDemo (arranca en «Sin»; el script lo da vuelta cada 5 s) */
.s-sol{padding:96px 0;background:var(--n0);text-align:center}
.s-sol-in{max-width:672px;margin:0 auto;padding:0 32px}
.s-sw-cb{position:absolute;opacity:0;width:1px;height:1px;pointer-events:none}
.s-pill-fila{display:flex;justify-content:center}
.s-pill{display:inline-flex;align-items:center;gap:8px;border:1px solid #fecaca;border-radius:4px;padding:4px 10px;font-family:var(--fm);font-size:10px;line-height:15px;text-transform:uppercase;letter-spacing:.12em;background:#fef2f2;color:#dc2626;transition:color .3s,background-color .3s,border-color .3s}
.s-pill-p{width:6px;height:6px;background:#ef4444;transition:background-color .3s}
.s-pill-con{display:none}
.s-sw-cb:checked ~ .s-pill-fila .s-pill{border-color:#a7f3d0;background:#ecfdf5;color:#059669}
.s-sw-cb:checked ~ .s-pill-fila .s-pill-p{background:#10b981}
.s-sw-cb:checked ~ .s-pill-fila .s-pill-sin,.s-sw-cb:checked ~ .s-sol-enc .s-sol-fin-sin{display:none}
.s-sw-cb:checked ~ .s-pill-fila .s-pill-con,.s-sw-cb:checked ~ .s-sol-enc .s-sol-fin-con{display:inline}
.s-sol-enc{margin-top:16px}
.s-sol-fin-sin{color:var(--n9)}
.s-sol-fin-con{display:none;color:var(--az)}
.s-sol-p{margin-top:12px;font-size:16px;line-height:24px;color:var(--n5)}
.s-sw-fila{display:flex;align-items:center;justify-content:center;gap:12px;margin:24px 0 32px}
.s-sw-l{font-size:14px;line-height:20px;font-weight:500;color:#18181b;cursor:pointer;transition:color .2s}
.s-sw-pista{position:relative;display:inline-flex;align-items:center;width:48px;height:28px;border-radius:9999px;background:#f87171;cursor:pointer;transition:background-color .3s}
.s-sw-bola{display:inline-block;width:20px;height:20px;border-radius:50%;background:#fff;transform:translateX(4px);transition:transform .3s}
.s-sw-cb:checked ~ .s-sw-fila .s-sw-pista{background:#10b981}
.s-sw-cb:checked ~ .s-sw-fila .s-sw-bola{transform:translateX(24px)}
.s-sw-cb:checked ~ .s-sw-fila .s-sw-l-sin{color:var(--z4)}
.s-sw-cb:not(:checked) ~ .s-sw-fila .s-sw-l-con{color:var(--z4)}
.s-sw-cb:focus-visible ~ .s-sw-fila .s-sw-pista{outline:2px solid var(--az);outline-offset:2px}
.s-sw-cartas{display:grid;max-width:448px;margin:0 auto}
.s-chat{grid-column:1;grid-row:1;background:#fff;border:1px solid var(--z2);border-radius:4px;overflow:hidden;height:100%;display:flex;flex-direction:column;transition:opacity .5s}
.s-sw-cb:not(:checked) ~ .s-sw-cartas .s-chat-con,.s-sw-cb:checked ~ .s-sw-cartas .s-chat-sin{opacity:0;pointer-events:none}
.s-chat-cab{display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--z1)}
.s-chat-ava{width:36px;height:36px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;background:var(--z1);border:1px solid var(--z2);color:var(--z7);font-size:12px;font-weight:600}
.s-chat-quien{flex:1;min-width:0;text-align:left}
.s-chat-n{font-size:14px;line-height:20px;font-weight:600;color:#18181b}
.s-chat-u{font-size:11px;line-height:16.5px;color:var(--z4)}
.s-chat-red{color:var(--z3);display:flex}
.s-chat-cu{padding:16px;display:flex;flex-direction:column;gap:8px;flex:1}
.s-chat-fila{display:flex;justify-content:flex-start}
.s-chat-fila-der{justify-content:flex-end}
.s-globo{display:inline-block;max-width:78%;border-radius:16px;padding:8px 12px;font-size:14px;line-height:20px;text-align:left;overflow-wrap:break-word}
.s-globo-lead{background:var(--n1);color:var(--n9)}
.s-globo-neg{background:var(--n9);color:#fff}
.s-chat-hora{font-size:11px;line-height:16.5px;color:var(--z4);padding-left:4px}
.s-pausa{display:flex;align-items:center;gap:12px;padding:4px 0}
.s-pausa-l{height:1px;flex:1;background:var(--z2)}
.s-pausa-t{display:inline-flex;align-items:center;gap:4px;font-size:11px;line-height:16.5px;font-weight:500;color:var(--z5);white-space:nowrap}
.s-visto{display:flex;align-items:center;justify-content:flex-end;gap:4px;padding-right:4px}
.s-visto-ic{color:#10b981;display:flex}
.s-visto-t{font-size:11px;line-height:16.5px;font-weight:500;color:#ef4444}
.s-aviso{margin-top:12px;display:flex;align-items:center;gap:12px;border:1px solid #a7f3d0;border-radius:4px;background:#ecfdf5;padding:10px 12px;text-align:left}
.s-aviso-ic{width:36px;height:36px;border-radius:4px;flex:none;display:flex;align-items:center;justify-content:center;background:#d1fae5;color:#059669}
.s-aviso-tx{flex:1;min-width:0}
.s-aviso-t{font-size:14px;line-height:20px;font-weight:600;color:#064e3b}
.s-aviso-p{font-size:12px;line-height:16px;color:#047857}
.s-chat-pie{display:flex;align-items:center;justify-content:space-between;gap:12px;border-top:1px solid var(--z1);padding:12px 16px}
.s-chat-tiempo{display:inline-flex;align-items:center;gap:6px;font-size:12px;line-height:16px;color:var(--z5)}
.s-chat-tiempo strong{font-weight:600;color:#18181b}
.s-chat-pas{display:inline-flex;align-items:center;gap:6px;border:1px solid;padding:2px 8px;font-family:var(--fm);font-size:10px;line-height:15px;text-transform:uppercase;letter-spacing:.1em;border-radius:4px}
.s-chat-pas::before{content:'';width:6px;height:6px;flex:none;background:currentColor}
.s-chat-pas-sin{border-color:#fecaca;background:#fef2f2;color:#b91c1c}
.s-chat-pas-sin::before{background:#ef4444}
.s-chat-pas-con{border-color:#a7f3d0;background:#ecfdf5;color:#047857}
.s-chat-pas-con::before{background:#10b981}
.s-canales{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:40px}
.s-canal{color:var(--z4);display:flex}
.s-canales-t{margin-left:4px;font-size:12px;line-height:16px;color:var(--z5)}
.s-cta-fila{text-align:center;margin-top:24px}
.s-btn-negro{display:inline-flex;align-items:center;gap:8px;padding:10px 24px;background:var(--n9);color:#fff;border-radius:8px;font-size:14px;line-height:20px;font-weight:500;transition:background .2s}
.s-btn-negro:hover{background:#262626}
.s-btn-negro-fl{display:flex;transition:transform .2s}
.s-btn-negro:hover .s-btn-negro-fl{transform:translateX(2px)}

/* Reseñas (el caso) */
.s-res{background:#fff;padding:96px 0}
.s-res-enc{text-align:center;margin-bottom:40px;padding:0 32px}
.s-res-h2{line-height:1.1;max-width:672px;margin:0 auto;text-wrap:balance}
.s-res-sub{margin:12px auto 0;max-width:448px;font-size:14px;line-height:1.625;color:var(--n5)}
.s-res-in{max-width:1152px;margin:0 auto;padding:0 32px}
.s-res-cols{column-count:3;column-gap:20px}
.s-res-art{break-inside:avoid;margin-bottom:20px;display:flex;flex-direction:column;background:#fff;border:1px solid var(--z2);border-radius:4px;padding:20px;transition:border-color .2s}
.s-res-art:hover{border-color:var(--z3)}
.s-res-video{margin:-4px -4px 14px;border-radius:4px;overflow:hidden;background:#0b0d12;aspect-ratio:848/480}
.s-res-video video{width:100%;height:100%;object-fit:cover}
.s-res-h3{font-family:var(--fh);font-size:14px;line-height:1.375;font-weight:600;color:#18181b;margin-bottom:6px}
.s-res-p{font-size:13px;line-height:1.625;color:var(--z7)}
.s-res-p strong{font-weight:600;color:#18181b}
.s-res-meses{display:flex;gap:8px;margin-top:12px}
.s-res-meses li{flex:1;display:flex;flex-direction:column;gap:2px;border:1px solid var(--z2);border-radius:4px;padding:8px 10px;font-size:11px;line-height:16px;color:var(--z5)}
.s-res-meses strong{font-family:var(--fh);font-size:16px;line-height:22px;font-weight:600;color:#18181b}
.s-res-autor{display:flex;align-items:center;gap:10px;margin-top:auto;padding-top:16px}
.s-res-ava{width:32px;height:32px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;background:var(--z1);border:1px solid var(--z2);color:var(--z7);font-weight:600;font-size:11px}
.s-res-quien{display:flex;flex-direction:column;min-width:0}
.s-res-n{font-size:12px;line-height:16px;font-weight:500;color:#18181b}
.s-res-r{font-size:11px;line-height:16.5px;color:var(--z5);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

/* Bento */
.s-bento{background:var(--n0)}
.s-bento-in{max-width:1152px;margin:0 auto;padding:80px 32px}
.s-tcorch{position:relative;width:fit-content;margin:0 auto 48px;padding:24px 40px;text-align:center}
.s-tcorch-p{margin:12px auto 0;max-width:576px;font-size:16px;line-height:24px;color:var(--z5)}
.s-bento .s-tcorch-p{margin-top:16px;max-width:672px;font-size:18px;line-height:28px;color:var(--n5)}
.s-bento-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px;text-align:left}
.s-bcard{background:#fff;border:1px solid var(--n2);border-radius:4px;overflow:hidden;display:flex;flex-direction:column}
.s-bcard-2{grid-column:span 2}
/* La parte de arriba era un recuadro de 180 de alto con UN ícono (el Cerebro, 14/11: «cajas vacías con un solo ícono»): el ícono va
   arriba del texto y la tarjeta mide lo que su texto. */
/* Arriba de cada tarjeta, su superficie de demo (min-height 180, padding 24, la trama y el borde de abajo) con la tarjeta REAL del
   lienzo fotografiada (FOTO_DE_TARJETA). Sin hover: la suya no cambia al pasar el mouse. */
.s-bsup{flex:1;min-height:180px;padding:24px;display:flex;align-items:center;justify-content:center;border-bottom:1px solid var(--n1);background-color:var(--n0);background-image:repeating-linear-gradient(45deg,transparent,transparent 50px,#00000006 50px,#00000006 51px),repeating-linear-gradient(-45deg,transparent,transparent 50px,#00000006 50px,#00000006 51px)}
.s-bfoto{display:block;width:auto;height:auto;max-width:100%;max-height:200px;border-radius:6px;box-shadow:0 1px 2px rgba(16,24,40,.06)}
.s-bwid-ic{width:40px;height:40px;border-radius:4px;display:flex;align-items:center;justify-content:center;background:var(--n9);color:#fff}
.s-btxt{padding:24px}

/* Línea */
.s-lin{background:#fff;padding:96px 0}
.s-lin-in{max-width:1024px;margin:0 auto;padding:0 32px}
.s-lin-enc{text-align:center;margin:0 auto 48px;max-width:896px}
.s-lin-h2{margin-bottom:20px}
.s-lin-p{margin:0 auto;max-width:576px;font-size:18px;line-height:28px;color:var(--n5)}
.s-lin-video{border:1px solid var(--n2);border-radius:4px;overflow:hidden;aspect-ratio:16/9;background:#fff}
.s-lin-video video{width:100%;height:100%;object-fit:cover}
.s-lin-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));margin-top:56px;text-align:left}
.s-lin-it{position:relative;border-top:1px solid var(--n2);padding:24px 40px 0 0}
.s-lin-dot{position:absolute;top:0;left:0;transform:translateY(-50%);width:10px;height:10px;border-radius:50%;background:var(--n9)}
.s-lin-dot-oro{background:var(--oro)}
.s-lin-h3{margin-bottom:8px}
.s-lin-puntos{margin-top:10px;display:flex;flex-direction:column;gap:6px}
.s-lin-puntos li{position:relative;padding-left:14px;font-size:13px;line-height:20px;color:var(--n5)}
.s-lin-puntos li::before{content:'';position:absolute;left:0;top:8px;width:5px;height:5px;background:var(--n4)}
.s-lin .s-cta-fila{margin-top:48px}

/* Pasos */
.s-pasos{background:#fff;padding:80px 0}
.s-pasos-in{max-width:1024px;margin:0 auto;padding:0 32px}
.s-pasos-enc .s-tcorch{margin-bottom:56px}
.s-pasos-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));column-gap:32px;row-gap:48px;text-align:left}
.s-paso{position:relative;border-top:1px solid var(--z2);padding-top:28px}
.s-paso-n{position:absolute;top:0;left:0;transform:translateY(-50%);background:#fff;padding-right:12px;font-family:var(--fm);font-size:12px;line-height:16px;color:var(--z4)}
.s-paso-h3{color:#18181b;margin-bottom:8px}

/* Terminal */
.s-term{background:var(--n0);padding:80px 0}
.s-term-in{max-width:896px;margin:0 auto;padding:0 32px}
.s-term-falta{max-width:672px;margin:0 auto}
.s-term-caja{max-width:672px;margin:0 auto;border:1px solid #27272a;border-radius:4px;overflow:hidden;background:#09090b;text-align:left}
.s-term-cab{display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-bottom:1px solid #27272a}
.s-term-cab-i{display:inline-flex;align-items:center;gap:8px;font-family:var(--fm);font-size:12px;line-height:16px;color:var(--z5)}
.s-term-cab-d{font-family:var(--fm);font-size:11px;line-height:16.5px;color:#52525b}
.s-term-cu{padding:24px;font-family:var(--fm);font-size:13px;line-height:1.625;display:flex;flex-direction:column;gap:16px}
.s-term-l{display:flex;gap:10px}
.s-term-l2{margin-top:4px}
.s-term-pr{color:var(--az);flex:none;user-select:none;font-weight:700}
.s-term-cmd{color:#e4e4e7}
.s-term-ok{color:#34d399;flex:none;margin-top:4px}
.s-term-res{color:var(--z5)}
.s-term-res strong{color:var(--z4);font-weight:400}
.s-term-cur{display:inline-block;width:8px;height:16px;background:#52525b;margin-top:3px;animation:s-pulso 2s cubic-bezier(.4,0,.6,1) infinite}

/* Preguntas */
.s-faq{background:#fff;padding:80px 0}
.s-faq-in{max-width:768px;margin:0 auto;padding:0 32px}
.s-faq-enc .s-tcorch{margin-bottom:40px}
.s-faq-lista{border-top:1px solid var(--z2)}
.s-faq-i{border-bottom:1px solid var(--z2)}
.s-faq-i summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:20px 0;text-align:left}
.s-faq-i summary::-webkit-details-marker{display:none}
.s-faq-q{font-size:15px;line-height:22.5px;font-weight:500;color:#18181b;transition:color .15s}
.s-faq-i summary:hover .s-faq-q{color:#52525b}
.s-faq-ch{color:var(--z4);flex:none;transition:transform .2s}
.s-faq-i[open] .s-faq-ch{transform:rotate(180deg)}
.s-faq-r{padding-bottom:20px;font-size:14px;line-height:1.625;color:var(--z5);text-align:left}

/* Pie */
.s-pie{background:var(--z9);padding:64px 0 48px}
.s-pie-in{max-width:1024px;margin:0 auto;padding:0 16px}
.s-pie-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:48px;padding-bottom:48px}
.s-pie-marca{grid-column:span 2}
.s-pie-logo{margin-bottom:12px;font-family:var(--fh)}
.s-pie-desc{font-size:14px;line-height:1.625;color:var(--z4);max-width:320px}
.s-pie-h{font-family:var(--fh);font-size:12px;line-height:16px;font-weight:500;text-transform:uppercase;letter-spacing:.05em;color:var(--z5);margin-bottom:16px;min-height:16px}
.s-pie-col ul{display:flex;flex-direction:column;gap:10px}
.s-pie-col a{font-size:14px;line-height:20px;color:var(--z4);transition:color .15s}
.s-pie-col a:hover{color:#fff}
.s-pie-abajo{padding-top:32px;display:flex;justify-content:space-between;align-items:center;gap:16px;color:var(--z5);font-size:14px;line-height:20px}
.s-pie-abajo ul{display:flex;flex-wrap:wrap;gap:8px 20px}
.s-pie-abajo a:hover{color:#fff}

@keyframes s-palabra{from{opacity:0;filter:blur(8px);transform:translateY(.35em)}to{opacity:1;filter:blur(0);transform:none}}
@keyframes s-sube{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}
@keyframes s-pulso{50%{opacity:.5}}
@keyframes s-parpadeo{0%,to{opacity:1}50%{opacity:0}}
/* Lo que aparece al bajar (su sr-init y sr-in: sube 24 px en 1,6 s). La clase -js la pone el script: sin JavaScript se ve todo. */
@media (prefers-reduced-motion:no-preference){
  .s-raiz.s-js .s-sr{opacity:0;transform:translateY(24px)}
  .s-raiz.s-js .s-sr.s-sr-in{opacity:1;transform:none;transition:opacity 1.6s cubic-bezier(.16,1,.3,1),transform 1.6s cubic-bezier(.16,1,.3,1)}
}

@media (max-width:767.98px){
  .s-nav,.s-barra-der{display:none}
  .s-menu{display:block}
  .s-barra-grid{grid-template-columns:1fr auto}
  .s-bento-grid,.s-lin-grid,.s-pasos-grid{grid-template-columns:minmax(0,1fr)}
  .s-bcard-2{grid-column:auto}
  .s-lin-grid{row-gap:40px}
  .s-lin-it{padding-right:0}
  .s-pie-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:32px}
  .s-pie-marca{grid-column:1 / -1}
}
@media (max-width:1023.98px){.s-res-cols{column-count:2}}
.s-fija{display:none}
@media (max-width:639.98px){
  body.s-fija-on{padding-bottom:72px}
  .s-fija{display:block;position:fixed;left:0;right:0;bottom:0;z-index:40;background:#fff;border-top:1px solid var(--z2);padding:12px 16px max(12px,env(safe-area-inset-bottom));opacity:0;transform:translateY(8px);visibility:hidden;transition:opacity .2s cubic-bezier(.4,0,1,1),transform .2s cubic-bezier(.4,0,1,1),visibility 0s linear .2s}
  .s-fija.s-fija-vis{opacity:1;transform:none;visibility:visible;transition:opacity .2s cubic-bezier(0,0,.2,1),transform .2s cubic-bezier(0,0,.2,1)}
  .s-fija-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:14px 24px;border-radius:8px;background:var(--n9);color:#fff;font-size:14px;line-height:20px;font-weight:500;transition:background-color .2s}
  .s-fija-btn:hover{background:#262626}
}
@media (max-width:639.98px){
  .s-barra{padding:0}
  .s-barra-in{padding:12px 16px}
  .s-hero-in{padding:64px 16px 16px}
  .s-hero-txt{padding-top:8px}
  .s-h1{font-size:33.6px}
  .s-hero-cta{padding:32px 0}
  .s-hero-caja{padding:10px}
  .s-demo-in{padding:0 16px}
  .s-demo-marco{padding:6px}
  .s-demo-sup{height:auto;padding:12px}
  .s-integra{padding:0 16px 64px}
  .s-h2{font-size:30px;line-height:36px}
  .s-res-h2{line-height:1.1}
  .s-sol,.s-res,.s-lin{padding:80px 0}
  .s-pasos,.s-term,.s-faq{padding:64px 0}
  .s-bento-in{padding:64px 16px}
  .s-sol-in,.s-res-in,.s-lin-in,.s-pasos-in,.s-term-in,.s-faq-in,.s-res-enc{padding-left:16px;padding-right:16px}
  .s-res-cols{column-count:1}
  .s-tcorch{padding:20px}
  .s-tcorch-p{font-size:14px;line-height:20px}
  .s-term-cu{padding:20px}
  .s-pie-grid{grid-template-columns:minmax(0,1fr)}
  .s-pie-col:not(:first-of-type) .s-pie-h{display:none}
  .s-pie-abajo{flex-direction:column}
  .s-pie-abajo ul{justify-content:center}
}
@media (prefers-reduced-motion:reduce){
  .s-raiz *,.s-raiz *::before,.s-raiz *::after{animation:none !important;transition:none !important}
}
`.replace(/\.s-/g, '.d-seguimiento-').replace(/\bs-(palabra|sube|pulso|parpadeo)\b/g, 'd-seguimiento-$1');
