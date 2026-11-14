// =============================================================================
// /vsl/email con el DISEÑO de la portada de beehiiv (https://www.beehiiv.com/), copiado el 11/11/2026; relevo FIEL el 14/11/2026
// =============================================================================
// Medida con Chromium a 1440 y a 390 px el 11/11 y otra vez el 14/11/2026 con video del scroll, `getAnimations()` en cada paso,
// MutationObserver e IntersectionObserver, los hovers con su tiempo y su CSS (los valores, en docs/diseno/landings-competencia/email.md;
// el relevo con capturas y videos, en la carpeta de notas de la sesión, referencias-landings/email/).
//
// LO QUE SE MUEVE es lo de la referencia y nada más:
//   · el hero FUNDE sus dos imágenes (`hero-fade-blur`): 9,05 s por vuelta con cubic-bezier(.33,1,.68,1), arranca a los 3,4 s; la que
//     se va baja 48 px y se desenfoca 14 px, la que llega sube desde 24 px y 6 px de desenfoque. Aquí, sus mismos cuadros clave con dos
//     PANTALLAS REALES de Email (banco C:/dev/bancos-portada/banco-email-landing): las secuencias y los envíos;
//   · detrás de la imagen, su mancha de color desenfocada (aquí el azul y el dorado de MaKo) y, de fondo, su cuadrícula;
//   · las tarjetas por producto se dan vuelta con el «+» (o tocando la tarjeta entera): su cara se apaga y la de atrás se prende en
//     ,35 s (cubic-bezier(.65,0,.35,1)); si es la angosta, además las dos de la fila se cambian el ancho (la tocada pasa a 2 y la otra
//     a 1, flex-grow en el mismo ,35 s). Una abierta por fila; la × la vuelve. Aquí con radios y `:has()`, sin JavaScript (un
//     <button> sin onClick lo marca tests/ningun-boton-muerto.test.ts; el visor borra los scripts). En el teléfono no se dan vuelta:
//     su «+» queda invisible y la captura va debajo del texto;
//   · los botones: el botón crece a 1,02 y su cara sube 18 px dejando ver sus dos capas (12 y 6 px), en ,125 s; el «+» crece a 1,05
//     en ,3 s; la flecha de «Get started free →» se corre 4 px en ,3 s;
//   · las preguntas abren DE GOLPE (medido: el alto salta en el primer cuadro; su `transition-[max-height]` no se usa) y la flecha gira
//     180° en ,3 s; pueden quedar varias abiertas.
// Nada más se mueve (medido con `getAnimations()` en cada paso del scroll: ninguna aparición al bajar, las cifras no cuentan). Todo
// es CSS: esta página no lleva script. Con «menos movimiento» las imágenes del hero no se funden (queda la primera) y nada se anima.
//
// Fuentes: beehiiv usa Clash Grotesk y Satoshi (de Fontshare, no de Google Fonts). Van las de Google más parecidas:
// Archivo (variable, en 900 y al 88 % de ancho) para los titulares y Figtree para el texto.
//
// De MaKo: el logo, el azul #2F6FED donde beehiiv pone su índigo #2F39BA (los botones), el dorado donde pone su rosa #FF5EC4 (el
// renglón en degradado, los rótulos, el «+», las capas del botón), los textos de ../email.ts, las PANTALLAS y el caso de Mauricio.
// Lo que NO va, y por qué:
//   · La franja «Trusted by the world's top publishers…» con su cinta de logos (85 s por vuelta), las estrellas «4.9/5 from 28,479
//     customers», las dos cintas de clientes de «Trusted by names you know» (fotos y cifras de sus clientes, 100 s por vuelta, en
//     sentidos opuestos, que se frenan con el mouse) y su «See all customer stories», sus planes con precio, las flechas de su carrusel
//     de 25 citas y su «Read the story» (hay un solo caso, sin una página que lo cuente), «The numbers tell the story» y el botón
//     flotante «Trial Premium Features»: son sus clientes, sus contadores, sus precios y su producto. Tampoco el segundo botón del
//     hero («Sign up with email»): MaKo tiene un solo llamado.
//   · beehiiv sirve otra portada a la mitad de las visitas (cookie `eid44_homepage_variant`: «control», con «Stand out in the inbox»);
//     ésta copia «variant_1», la de «Everything you need…».
//   · Las fotos de sus productos (newsletters, podcasts, productos digitales, monetización, comunidad, sitios): aquí las seis partes
//     de Email, con su pantalla real y, atrás, sus seis recuadros. Crecer y monetizar (su red de anuncios, recomendaciones entre
//     newsletters, suscripciones pagas) MaKo no los tiene.
//   · Su imagen de integraciones → las fichas de lo que dispara una secuencia.
//   · En el pie: el formulario de su newsletter, sus links legales y de redes. Queda el lema de /vsl, las funciones de MaKo en
//     columnas y la estrella en el lugar de su isotipo.
// =============================================================================

import type { CSSProperties } from 'react';
import type { PropsDiseno } from '.';
import type { Bloque } from '../tipos';
import { RUTA_CTA, CASO, EstrellaMaKo, LogoMaKo, TEXTO_CTA, html, otrasFunciones } from '../marca';

type Hero = Extract<Bloque, { tipo: 'hero' }>;
type Tarjetas = Extract<Bloque, { tipo: 'tarjetas' }>;
type Logos = Extract<Bloque, { tipo: 'logos' }>;
type Preguntas = Extract<Bloque, { tipo: 'preguntas' }>;

const P = 'd-email';
const A = '/vsl-assets/email';

/** Las dos imágenes del hero que se funden, como las suyas («Hero newsletter» y «Hero products»): Email REAL con un negocio inventado
 *  («Cierre Consultivo», banco C:/dev/bancos-portada/banco-email-landing, fotos.mjs + recortar.py), en su cuadro de 4:3. */
export const HERO_EMAIL: readonly { src: string; alt: string }[] = [
  { src: `${A}/hero-secuencias.webp`, alt: 'Email de MaKo: la secuencia «Vio tu VSL y no agendó» con su primer email, la lista de secuencias por etapa y las tasas de apertura y de clic' },
  { src: `${A}/hero-envios.webp`, alt: 'Email de MaKo: los envíos a un segmento del CRM, los segmentos con cuántos tienen email y «¿Enviar a 312 leads ahora?»' },
];

/**
 * La pantalla de cada tarjeta por producto, por su título en ../email.ts, y dónde va dentro de la tarjeta (como su
 * `product-card-shot`: corrida y cortada por el borde). `x`/`y` en px desde la esquina de arriba a la izquierda del lugar de la
 * captura (debajo del texto); `w` y `h`, el tamaño de la imagen en la tarjeta a 1440 (con 20 px de aire para su sombra). En el
 * teléfono la tarjeta no se da vuelta (su «+» queda invisible) y la captura va entera debajo del texto, pegada al borde derecho: `tel`
 * es su recorte, más de cerca.
 */
export const PANTALLA_DE_TARJETA: Readonly<Record<string, { src: string; tel: string; alt: string; x: number; y: number; w: number; h: number }>> = {
  Secuencias: { src: `${A}/secuencias.webp`, tel: `${A}/secuencias-tel.webp`, alt: 'El editor de una secuencia con el disparador abierto: dejó el formulario sin agendar, vio el VSL sin agendar, agendó pero no confirmó…', x: 50, y: -20, w: 797, h: 483 },
  Envíos: { src: `${A}/envios.webp`, tel: `${A}/envios-tel.webp`, alt: 'Los envíos a un segmento del CRM, con lo enviado, lo programado y el borrador, y el segmento «Asistieron a R1»: 312 con email', x: 4, y: -20, w: 460, h: 450 },
  'Escribe con MaKo': { src: `${A}/escribir.webp`, tel: `${A}/escribir-tel.webp`, alt: 'La voz de tu negocio aprendida («Voz ✓») y el borrador de un envío con su asunto, su vista previa, su texto y el botón «Generar con MaKo»', x: 4, y: -20, w: 410, h: 440 },
  'Tu dominio': { src: `${A}/dominio.webp`, tel: `${A}/dominio-tel.webp`, alt: 'El dominio de envío: los registros DKIM y SPF para cargar en el DNS y «Ya los cargué → Verificar»', x: 50, y: -20, w: 760, h: 455 },
  Mide: { src: `${A}/mide.webp`, tel: `${A}/mide-tel.webp`, alt: 'Las cifras de Email: suscriptores activos, tasa de apertura y de clic de los últimos 30 días, lo enviado este mes y lo de cada email de la secuencia', x: 50, y: -20, w: 770, h: 508 },
  'Cuida tu envío': { src: `${A}/cuidar.webp`, tel: `${A}/cuidar-tel.webp`, alt: 'Antes de mandar: «¿Enviar a 312 leads ahora?», el aviso de que manda emails reales y el envío real prendido', x: 4, y: -20, w: 440, h: 380 },
};

/** Su botón: la cara de color y, debajo, dos capas que se corren al pasar el mouse. */
function Boton({ clase = '' }: { clase?: string }) {
  return (
    <a href={RUTA_CTA} className={`${P}-btn ${clase}`.trim()}>
      <span className={`${P}-btn-t`}>{TEXTO_CTA}</span>
      <span className={`${P}-btn-c2`} aria-hidden="true" />
      <span className={`${P}-btn-c1`} aria-hidden="true" />
    </a>
  );
}

/** Su flecha de «Get started free →» (Phosphor «arrow-right», 16 px). */
const Flecha = () => (
  <svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M221.66 133.66l-72 72a8 8 0 0 1-11.32-11.32L196.69 136H40a8 8 0 0 1 0-16h156.69l-58.35-58.34a8 8 0 0 1 11.32-11.32l72 72a8 8 0 0 1 0 11.32z" /></svg>
);
/** Su «+» y su × (Phosphor, 28 px en el recuadro de 44). */
const Mas = () => (<svg width="28" height="28" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M224 128a8 8 0 0 1-8 8h-80v80a8 8 0 0 1-16 0v-80H40a8 8 0 0 1 0-16h80V40a8 8 0 0 1 16 0v80h80a8 8 0 0 1 8 8z" /></svg>);
const Cruz = () => (<svg width="28" height="28" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M205.66 194.34a8 8 0 0 1-11.32 11.32L128 139.31l-66.34 66.35a8 8 0 0 1-11.32-11.32L116.69 128 50.34 61.66a8 8 0 0 1 11.32-11.32L128 116.69l66.34-66.35a8 8 0 0 1 11.32 11.32L139.31 128z" /></svg>);
/** El ícono de cada recuadro de la cara de atrás (24 px, su lavanda): uno solo, el sobre de Email. */
const Sobre = () => (<svg width="24" height="24" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M224 48H32a8 8 0 0 0-8 8v136a16 16 0 0 0 16 16h176a16 16 0 0 0 16-16V56a8 8 0 0 0-8-8zm-96 85.15L52.57 64h150.86zM98.71 128 40 181.81V74.19zm11.84 10.85 12 11.05a8 8 0 0 0 10.82 0l12-11.05 58 53.15H52.57zM157.29 128 216 74.18v107.64z" /></svg>);

function Barra() {
  return (
    <header className={`${P}-barra`}>
      <LogoMaKo className={`${P}-logo`} tamano={28} claro />
      <div className={`${P}-barra-der`}>
        <a href="/vsl" className={`${P}-barra-link`}>Todas las funcionalidades</a>
        <a href={RUTA_CTA} className={`${P}-barra-btn`}>{TEXTO_CTA}</a>
      </div>
    </header>
  );
}

/** Su hero: el titular con el último renglón en degradado, la bajada, el botón, la nota y, a la derecha, las dos imágenes que se funden. */
function HeroD({ b }: { b: Hero }) {
  return (
    <section className={`${P}-hero`}>
      <div className={`${P}-cont ${P}-hero-in`}>
        <div className={`${P}-hero-txt`}>
          <h1 className={`${P}-h1`} dangerouslySetInnerHTML={html(b.titulo)} />
          <p className={`${P}-hero-p`} dangerouslySetInnerHTML={html(b.bajada)} />
          <div className={`${P}-hero-btns`}><Boton clase={`${P}-btn-hero`} /></div>
          {b.puntos?.length ? <p className={`${P}-nota`}>{b.puntos.join('. ')}.</p> : null}
        </div>
        <div className={`${P}-hero-vis`}>
          <span className={`${P}-hero-mancha`} aria-hidden="true" />
          <div className={`${P}-funde`} data-tema-fijo="">
            {HERO_EMAIL.map((f, i) => (
              <div key={f.src} className={`${P}-funde-c ${P}-funde-${i ? 'b' : 'a'}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.src} alt={f.alt} width={1200} height={900} decoding="async" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/** Una tarjeta por producto: su cara (título, texto, link y «+», con la pantalla corrida debajo) y su cara de atrás (la frase, el botón
 *  y los seis recuadros). El radio de su fila la da vuelta; el de «cerrada» la vuelve. */
function Tarjeta({ t, fila, i, ancho }: { t: Tarjetas['items'][number]; fila: number; i: number; ancho: 1 | 2 }) {
  const id = `${P}-f${fila}-${i}`;
  const pant = PANTALLA_DE_TARJETA[t.titulo.replace(/<[^>]+>/g, '')];
  // «Título: texto» → el título y, debajo, el texto con su mayúscula (como sus recuadros).
  const recuadros = (t.puntos ?? []).map((p) => { const k = p.indexOf(': '); const x = k > 0 ? p.slice(k + 2) : ''; return { h: k > 0 ? p.slice(0, k) : p, x: x.charAt(0).toUpperCase() + x.slice(1) }; });
  return (
    <article className={`${P}-tile ${P}-tile-${ancho}`} data-tema-fijo="">
      <input type="radio" name={`${P}-fila-${fila}`} id={id} className={`${P}-radio`} aria-label={`Ver lo que tiene ${t.titulo.replace(/<[^>]+>/g, '')}`} />
      <span className={`${P}-mesh ${P}-mesh-${fila}-${i}`} aria-hidden="true" />
      <div className={`${P}-cara`}>
        <label htmlFor={id} className={`${P}-cara-toda`} aria-hidden="true" />
        <div className={`${P}-cara-cab`}>
          <div className={`${P}-cara-tx`}>
            <h3 className={`${P}-tile-t`} dangerouslySetInnerHTML={html(t.titulo)} />
            <p className={`${P}-tile-p`} dangerouslySetInnerHTML={html(t.texto)} />
            <a href={RUTA_CTA} className={`${P}-tile-a`}>{TEXTO_CTA}<span><Flecha /></span></a>
          </div>
          <label htmlFor={id} className={`${P}-mas`} title="Ver más"><Mas /></label>
        </div>
        {pant ? (
          <div className={`${P}-shot`} style={{ '--x': `${pant.x}px`, '--y': `${pant.y}px`, '--w': `${pant.w}px` } as CSSProperties}>
            {/* Dos imágenes y no un <picture>: el visor reescribe el src y no el srcset. La del teléfono, sólo en el teléfono. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={`${P}-shot-pc`} src={pant.src} alt={pant.alt} width={pant.w * 2} height={pant.h * 2} loading="lazy" decoding="async" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={`${P}-shot-tel`} src={pant.tel} alt={pant.alt} width={652} height={400} loading="lazy" decoding="async" />
          </div>
        ) : null}
      </div>
      <div className={`${P}-atras`}>
        <label htmlFor={`${P}-f${fila}-x`} className={`${P}-cruz`} title="Cerrar"><Cruz /></label>
        <div className={`${P}-atras-in`}>
          <div className={`${P}-atras-cab`}>
            <div className={`${P}-atras-tx`}>
              <h3 className={`${P}-atras-t`} dangerouslySetInnerHTML={html(t.titulo)} />
              {t.meta ? <p className={`${P}-atras-p`} dangerouslySetInnerHTML={html(t.meta)} /> : null}
            </div>
            <Boton />
          </div>
          <ul className={`${P}-cajas`}>
            {recuadros.map((r) => (
              <li key={r.h} className={`${P}-caja`}>
                <span className={`${P}-caja-i`}><Sobre /></span>
                <span className={`${P}-caja-tx`}><strong dangerouslySetInnerHTML={html(r.h)} />{r.x ? <span dangerouslySetInnerHTML={html(r.x)} /> : null}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </article>
  );
}

/** Su «Everything you need…»: rótulo y título a la izquierda, texto y botón a la derecha, y las seis tarjetas en filas de 2 a 1 y de 1 a 2. */
function ProductoD({ b }: { b: Tarjetas }) {
  const filas: (Tarjetas['items'][number])[][] = [];
  for (let i = 0; i < b.items.length; i += 2) filas.push(b.items.slice(i, i + 2));
  return (
    <section className={`${P}-sec ${P}-producto`}>
      <div className={`${P}-cont`}>
        <div className={`${P}-cab`}>
          <div>
            {b.etiqueta ? <p className={`${P}-rotulo`}>{b.etiqueta}</p> : null}
            <h2 className={`${P}-h2`} dangerouslySetInnerHTML={html(b.titulo)} />
          </div>
          <div className={`${P}-cab-der`}>
            {b.bajada ? <p className={`${P}-lede`} dangerouslySetInnerHTML={html(b.bajada)} /> : null}
            <Boton />
          </div>
        </div>
        <div className={`${P}-bento`}>
          {filas.map((par, f) => (
            // Como sus filas: la primera de 2 a 1, la segunda de 1 a 2, la tercera de 2 a 1.
            <div key={f} className={`${P}-fila`}>
              <input type="radio" name={`${P}-fila-${f}`} id={`${P}-f${f}-x`} className={`${P}-radio ${P}-radio-x`} defaultChecked aria-label="Volver a las tarjetas" />
              {par.map((t, i) => <Tarjeta key={t.titulo} t={t} fila={f} i={i} ancho={(f % 2 ? i === 1 : i === 0) ? 2 : 1} />)}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Su «Trusted by names you know» (rótulo, título, texto y botón centrados) y su cita en la caja de borde, con el caso de Mauricio. */
function ClientesD() {
  return (
    <section className={`${P}-sec ${P}-clientes`}>
      <div className={`${P}-cont`}>
        <div className={`${P}-centro`}>
          <p className={`${P}-rotulo`}>Clientes</p>
          <h2 className={`${P}-h2`} dangerouslySetInnerHTML={html(CASO.titulo)} />
          <p className={`${P}-lede`}>{CASO.sub}</p>
          <Boton />
        </div>
        <figure className={`${P}-cita`} data-tema-fijo="">
          {/* Su brillo: una elipse de su color de acento, desenfocada, asomando desde abajo de la caja. */}
          <svg className={`${P}-cita-brillo`} viewBox="0 0 1245.2 602.188" fill="none" preserveAspectRatio="none" aria-hidden="true">
            <g opacity="0.3" filter={`url(#${P}-brillo)`}><ellipse cx="622.6" cy="301.094" rx="372.6" ry="51.0938" fill={DORADO} /></g>
            <defs><filter id={`${P}-brillo`} x="0" y="0" width="1245.2" height="602.188" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB"><feGaussianBlur stdDeviation="125" /></filter></defs>
          </svg>
          <blockquote className={`${P}-cita-t`} dangerouslySetInnerHTML={html(`“${CASO.historia[1]}”`)} />
          <figcaption className={`${P}-cita-pie`}>
            <video className={`${P}-cita-av`} muted autoPlay loop playsInline preload="metadata" aria-label={`${CASO.quien}, en video`} data-tema-fijo="">
              <source src={CASO.video} type="video/mp4" />
            </video>
            <span className={`${P}-cita-n`}>{CASO.quien}</span>
            <span className={`${P}-cita-r`}>{CASO.rol}</span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

/** Su «Powerful integrations»: el título a la izquierda, el botón a la derecha y, debajo, lo que conecta. */
function IntegracionesD({ b }: { b: Logos }) {
  return (
    <section className={`${P}-sec ${P}-integ`}>
      <div className={`${P}-cont`}>
        <div className={`${P}-cab ${P}-cab-integ`}>
          <h2 className={`${P}-h2`} dangerouslySetInnerHTML={html(b.titulo)} />
          <div className={`${P}-cab-der`}><Boton /></div>
        </div>
        <ul className={`${P}-logos`}>
          {b.items.map((l) => (
            <li key={l.nombre} className={`${P}-logo-i`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <span className={`${P}-logo-c`}><img src={`/vsl-assets/logos/${l.logo}`} alt="" width={40} height={40} /></span>
              <span className={`${P}-logo-n`}>{l.nombre}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Su «Have a question?»: el título a la izquierda y las preguntas a la derecha, cada una con su filete arriba. */
function PreguntasD({ b }: { b: Preguntas }) {
  return (
    <section className={`${P}-sec ${P}-faq`}>
      <div className={`${P}-cont ${P}-faq-in`}>
        <h2 className={`${P}-h2 ${P}-faq-h2`} dangerouslySetInnerHTML={html(b.titulo)} />
        <div className={`${P}-faq-l`}>
          {b.items.map((q) => (
            <details key={q.p} className={`${P}-q`}>
              <summary>
                <h3 dangerouslySetInnerHTML={html(q.p)} />
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B8B8C8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
              </summary>
              <p className={`${P}-q-r`} dangerouslySetInnerHTML={html(q.r)} />
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Su caja del cierre: «What are you waiting for?» (aquí «¿Empezamos?») y el botón. */
function Cierre() {
  return (
    <section className={`${P}-cierre`}>
      <div className={`${P}-cont`}>
        <div className={`${P}-cierre-caja`} data-tema-fijo="">
          <h2 className={`${P}-h2 ${P}-cierre-h`}>¿Empezamos?</h2>
          <Boton />
        </div>
      </div>
    </section>
  );
}

function PieD({ slug }: { slug: string }) {
  return (
    <footer className={`${P}-pie`}>
      <div className={`${P}-cont`}>
        <div className={`${P}-pie-in`}>
          <p className={`${P}-pie-lema`}>El mejor software para vender High Ticket.</p>
          <div className={`${P}-pie-cols`}>
            <p className={`${P}-pie-h`}>Funciones de MaKo</p>
            <ul>{otrasFunciones(slug).map((x) => <li key={x.href}><a href={x.href}>{x.nombre}</a></li>)}</ul>
          </div>
        </div>
        <div className={`${P}-pie-base`}>
          <p>© MaKo — Todos los derechos reservados.</p>
          <EstrellaMaKo size={32} />
        </div>
      </div>
    </footer>
  );
}

export default function DisenoEmail({ landing }: PropsDiseno) {
  return (
    <div className={P}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <Barra />
      <main>
        {landing.bloques.map((b, i) => {
          switch (b.tipo) {
            case 'hero': return <HeroD key={i} b={b} />;
            case 'tarjetas': return <ProductoD key={i} b={b} />;
            case 'caso': return <ClientesD key={i} />;
            case 'logos': return <IntegracionesD key={i} b={b} />;
            case 'preguntas': return <PreguntasD key={i} b={b} />;
            default: return null;
          }
        })}
        <Cierre />
      </main>
      <PieD slug={landing.slug} />
    </div>
  );
}

// Los valores salen de docs/diseno/landings-competencia/email.md (medidos el 11/11 y otra vez el 14/11/2026). Su índigo #2F39BA → el
// azul de MaKo; su rosa #FF5EC4 → el dorado; sus rosas de las capas del botón y del degradado (#FFC8EB, #F092DD, #FFDCFF) → dorados
// claros; su lavanda de los íconos de atrás → un celeste; sus fondos de color (las «mesh» de las tarjetas, la luz del cierre, la
// mancha del hero) llevan el azul y el dorado de MaKo donde los suyos llevan índigo y rosa.
const FONDO = '#060419';
const CARD = '#0D0B28';
const SURFACE2 = '#141230';
const SURFACE3 = '#1C1940';
const TEXTO = '#F7F5FF';
const GRIS = '#DDDCE8';
const GRIS2 = '#C4C2D6';
const GRIS3 = '#9393A9';
const LINEA = '#1F1D3A';
const AZUL = '#2F6FED';
const DORADO = '#F2B01E';
const DORADO_CAPA = '#FBE3A6';
const DORADO_MEDIO = '#F6CB63';
const DORADO_CLARO = '#FDF0CC';
const CELESTE = '#9DB8FF';
const TITULAR = `font-family:'d-email-archivo',Arial,sans-serif;font-weight:900;font-stretch:88%;text-transform:uppercase`;
/** El fondo de color de cada tarjeta (su «mesh»: navy arriba y una luz abajo), medido en sus capturas; uno para la ancha, otro para la
 *  angosta, como los suyos. */
const MESH = [
  `radial-gradient(60% 50% at 0% 100%,rgba(58,82,170,.95),rgba(58,82,170,0) 70%),radial-gradient(45% 40% at 100% 100%,rgba(242,176,30,.26),rgba(242,176,30,0) 70%),linear-gradient(180deg,#0B0A1F 0%,#0E0D2B 45%,#1A2054 100%)`,
  `radial-gradient(70% 45% at 10% 95%,rgba(68,86,170,.9),rgba(68,86,170,0) 70%),radial-gradient(40% 35% at 95% 100%,rgba(242,176,30,.22),rgba(242,176,30,0) 70%),linear-gradient(180deg,#0A0B1F 0%,#111334 55%,#1C2258 100%)`,
];
const CSS = `
@font-face{font-family:'d-email-archivo';src:url('/vsl-assets/fuentes/archivo/archivo-latin-wdth-wght.woff2') format('woff2');font-weight:100 900;font-stretch:62% 125%;font-display:swap}
@font-face{font-family:'d-email-figtree';src:url('/vsl-assets/fuentes/figtree/figtree-latin.woff2') format('woff2');font-weight:300 900;font-display:swap}
.${P}{background:${FONDO};color:#fff;font-family:'d-email-figtree',Arial,sans-serif;font-size:16px;line-height:24px;-webkit-font-smoothing:antialiased;overflow-x:hidden}
.${P} *{box-sizing:border-box}
:where(.${P}) :where(h1,h2,h3,h4,p,ul,li,figure,blockquote){margin:0;padding:0}
:where(.${P}) :where(ul){list-style:none}
:where(.${P}) :where(a){text-decoration:none;color:inherit}
.${P}-cont{max-width:1440px;margin:0 auto;padding:0 128px}

/* La barra: 77 px (20 arriba y abajo, 128 a los lados), filete abajo blanco al 12 %, pegada arriba. En producción la tapa la del sitio
   (BARRA_PROPIA). */
.${P}-barra{position:sticky;top:0;z-index:50;display:flex;align-items:center;justify-content:space-between;padding:20px 128px;background:${FONDO};border-bottom:1px solid rgba(255,255,255,.12)}
.${P}-logo{font-family:'d-email-figtree',Arial,sans-serif}
.${P}-barra-der{display:flex;align-items:center;gap:12px}
.${P}-barra-link,.${P}-barra-btn{display:inline-flex;align-items:center;font-size:14px;line-height:20px;font-weight:600;padding:7px 12px;border-radius:6px;border:1px solid rgba(255,255,255,.2);color:#fff;transition:background-color .15s,color .15s}
.${P}-barra-link:hover{background:rgba(255,255,255,.1)}
.${P}-barra-btn{background:#fff;border-color:#fff;color:${FONDO}}
.${P}-barra-btn:hover{background:${FONDO};color:#fff}

/* El botón: la cara azul de radio 6 (18/28 700, 8 × 24 de aire: 46 de alto) y, debajo, las dos capas (dorado claro arriba y dorado
   medio abajo, filete #0B0D2A) que se separan 12 y 6 px al pasar el mouse mientras la cara sube 18 y el botón crece a 1,02. */
.${P}-btn{position:relative;display:inline-flex;transition:transform .125s ease-out}
.${P}-btn:hover{transform:scale(1.02)}
.${P}-btn-t{position:relative;z-index:10;display:inline-flex;align-items:center;justify-content:center;background:${AZUL};border:1px solid ${AZUL};border-radius:6px;padding:8px 24px;font-size:18px;line-height:28px;font-weight:700;color:#fff;white-space:nowrap;transition:transform .125s ease-out}
.${P}-btn-c1,.${P}-btn-c2{position:absolute;inset:1px;border:1px solid #0B0D2A;border-radius:6px;transition:transform .125s ease-out}
.${P}-btn-c1{background:${DORADO_CAPA}}
.${P}-btn-c2{background:${DORADO_MEDIO}}
.${P}-btn:hover .${P}-btn-t{transform:translate(-18px,-18px)}
.${P}-btn:hover .${P}-btn-c1{transform:translate(-12px,-12px)}
.${P}-btn:hover .${P}-btn-c2{transform:translate(-6px,-6px)}
.${P}-btn-hero .${P}-btn-t{min-height:50px;padding:10px 24px}

/* El hero: 96 arriba y abajo, su cuadrícula de fondo; dos columnas de 576 con 32 de separación; a la derecha la mancha desenfocada
   (634 × 475) y la imagen de 634 de ancho (se sale 29 px por lado), con las dos que se funden. */
.${P}-hero{position:relative;overflow:hidden;padding:96px 0;background-image:linear-gradient(rgba(255,255,255,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.03) 1px,transparent 1px);background-size:66px 66px;background-position:center -10px}
.${P}-hero-in{position:relative;z-index:1;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:32px;align-items:center}
.${P}-h1{${TITULAR};font-size:60px;line-height:60px;color:#fff;margin-bottom:16px}
.${P}-h1 em{font-style:normal;display:inline-block;background:linear-gradient(to right,${DORADO_CLARO},${DORADO});-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-fill-color:transparent}
.${P}-hero-p{max-width:512px;font-size:20px;line-height:28px;font-weight:500;color:${TEXTO}}
.${P}-hero-p strong{font-weight:700;color:#fff}
.${P}-hero-btns{margin-top:24px;display:flex;gap:12px}
.${P}-nota{margin-top:16px;font-size:14px;line-height:20px;color:#B8B8C8}
.${P}-hero-vis{position:relative;display:flex;align-items:center;justify-content:center;min-height:420px}
.${P}-hero-mancha{position:absolute;left:50%;top:50%;width:calc(100% + 58px);aspect-ratio:634/475;transform:translate(-50%,-50%) scale(1.1);pointer-events:none;filter:blur(64px);background:radial-gradient(42% 28% at 60% 52%,rgba(47,111,237,.9),rgba(47,111,237,0) 100%),radial-gradient(20% 26% at 18% 46%,rgba(242,176,30,.32),rgba(242,176,30,0) 100%)}
.${P}-funde{position:relative;z-index:10;flex:none;width:calc(100% + 58px);aspect-ratio:4/3}
.${P}-funde-c{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
.${P}-funde-c img{display:block;width:100%;height:auto}
.${P}-funde-b{opacity:0;visibility:hidden}
.${P}-funde-a{animation:9.05s cubic-bezier(.33,1,.68,1) 3.4s infinite ${P}-funde-a}
.${P}-funde-b{animation:9.05s cubic-bezier(.33,1,.68,1) 3.4s infinite ${P}-funde-b}
/* Sus cuadros clave tal cual (hero-fade-blur-newsletter y hero-fade-blur-products). */
@keyframes ${P}-funde-a{0%,to{opacity:1;filter:blur(0);visibility:visible;transform:translateY(0)}8.29%{opacity:0;filter:blur(14px);visibility:visible;transform:translateY(48px)}8.29%,45.86%{opacity:0;filter:blur(14px);visibility:hidden;transform:translateY(48px)}45.86%{opacity:0;filter:blur(6px);visibility:visible;transform:translateY(24px)}54.14%,to{opacity:1;filter:blur(0);visibility:visible;transform:translateY(0)}}
@keyframes ${P}-funde-b{0%{opacity:0;filter:blur(6px);visibility:hidden;transform:translateY(24px)}.01%,8.29%{opacity:0;filter:blur(6px);visibility:visible;transform:translateY(24px)}8.29%,45.86%{opacity:1;filter:blur(0);visibility:visible;transform:translateY(0)}54.14%,to{opacity:0;filter:blur(14px);visibility:hidden;transform:translateY(48px)}}

/* Las secciones: 96 arriba y abajo. El rótulo 14/20 de color, 8 px arriba del título 48/48; a la derecha el texto 20/28 y el botón. */
.${P}-sec{padding:96px 0}
.${P}-rotulo{font-size:14px;line-height:20px;font-weight:500;color:${DORADO}}
.${P}-h2{${TITULAR};font-size:48px;line-height:48px;color:#fff;margin-top:8px}
.${P}-lede{font-size:20px;line-height:28px;font-weight:500;color:#fff}
.${P}-cab{display:grid;grid-template-columns:569px 557px;justify-content:space-between;align-items:end}
.${P}-cab-der{display:flex;flex-direction:column;align-items:flex-start;gap:24px}

/* Las tarjetas: filas de 608 de alto con 24 de separación, la ancha el doble de la angosta (773 + 387); radio 12, filete blanco al 6 %,
   #0D0B28 y su fondo de color. «overflow: clip» y no «hidden»: al tocar el «+» el navegador enfoca el radio y desplazaba de costado
   la tarjeta (la captura se sale por la derecha), y la cara quedaba corrida al volver. */
.${P}-bento{margin-top:64px;display:flex;flex-direction:column;gap:24px}
.${P}-fila{display:flex;gap:24px;height:608px}
.${P}-radio{position:absolute;width:1px;height:1px;margin:0;opacity:0;pointer-events:none}
.${P}-tile{position:relative;min-width:0;min-height:0;overflow:clip;border-radius:12px;border:1px solid rgba(255,255,255,.06);background:${CARD};flex:1 1 0%;transition:flex-grow .35s cubic-bezier(.65,0,.35,1)}
.${P}-tile-2{flex-grow:2}
.${P}-mesh{position:absolute;inset:0;pointer-events:none}
.${P}-mesh-0-0,.${P}-mesh-1-1,.${P}-mesh-2-0{background:${MESH[0]}}
.${P}-mesh-0-1,.${P}-mesh-1-0,.${P}-mesh-2-1{background:${MESH[1]}}
.${P}-cara,.${P}-atras{position:absolute;inset:0;transition:opacity .35s cubic-bezier(.65,0,.35,1)}
.${P}-cara{display:flex;flex-direction:column;gap:24px;overflow:clip}
.${P}-cara-toda{position:absolute;inset:0;z-index:0;cursor:pointer}
.${P}-cara-cab{position:relative;z-index:10;display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:24px 24px 0;pointer-events:none}
.${P}-cara-tx{display:flex;flex-direction:column;gap:8px;min-width:0;flex:1}
.${P}-tile-t{font-size:24px;line-height:32px;font-weight:700;color:#fff}
.${P}-tile-p{font-size:18px;line-height:28px;font-weight:500;color:${TEXTO}}
.${P}-tile-a{pointer-events:auto;display:inline-flex;align-items:center;gap:6px;width:fit-content;font-size:18px;line-height:28px;font-weight:500;color:${DORADO}}
.${P}-tile-a span{display:inline-flex;transition:transform .3s ease-out}
.${P}-tile-a:hover span{transform:translateX(4px)}
/* Su «+» y su ×: 44 × 44, #1C1940, radio 8, el ícono de 28 del color de acento; el «+» crece a 1,05 en ,3 s. */
.${P}-mas,.${P}-cruz{display:flex;flex:none;align-items:center;justify-content:center;width:44px;height:44px;border-radius:8px;background:${SURFACE3};color:${DORADO};cursor:pointer}
/* El «+» recibe el toque aunque su cabecera no; la × hereda el «none» de la cara de atrás mientras está apagada (si no, invisible y
   encima del «+», se comía el toque). */
.${P}-mas{pointer-events:auto;transition:transform .3s ease-out}
.${P}-mas:hover{transform:scale(1.05)}
.${P}-cruz{transition:opacity .15s}
.${P}-cruz:hover{opacity:.9}
.${P}-radio:focus-visible ~ .${P}-cara .${P}-mas,.${P}-fila:has(> .${P}-radio-x:focus-visible) .${P}-cruz{outline:2px solid ${DORADO};outline-offset:2px}
/* La captura, corrida y cortada por el borde, como su product-card-shot (la imagen trae su sombra y sus esquinas). */
.${P}-shot{position:relative;flex:1;min-height:0;pointer-events:none}
.${P}-shot img{position:absolute;left:var(--x);top:var(--y);width:var(--w);max-width:none;height:auto}
.${P}-shot .${P}-shot-tel{display:none}
/* La cara de atrás: #141230; la × a 20 px de la esquina; 48 arriba y 32 a los lados y abajo, 40 entre el encabezado (título 24/28 y
   frase 18/26 en 420 px, el botón a la derecha, abajo) y los seis recuadros en 3 × 2 con 12 de separación: #1C1940, radio 12,
   20 × 16 de aire, el ícono de 24 y, a 16, el título y el texto 14/20. */
.${P}-atras{z-index:10;opacity:0;pointer-events:none;background:${SURFACE2};overflow:clip}
.${P}-cruz{position:absolute;right:20px;top:20px;z-index:20}
.${P}-atras-in{display:flex;flex-direction:column;gap:40px;height:100%;padding:48px 32px 32px}
.${P}-atras-cab{display:flex;align-items:flex-end;justify-content:space-between;gap:32px}
.${P}-atras-tx{display:flex;flex-direction:column;gap:6px;max-width:420px}
.${P}-atras-t{font-size:24px;line-height:28px;font-weight:700;color:#fff}
.${P}-atras-p{font-size:18px;line-height:26px;font-weight:500;color:${GRIS}}
.${P}-atras .${P}-btn{flex:none}
.${P}-cajas{flex:1;min-height:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));grid-template-rows:repeat(2,minmax(0,1fr));gap:12px}
.${P}-caja{display:flex;flex-direction:column;align-items:flex-start;gap:16px;min-height:0;overflow:hidden;border-radius:12px;background:${SURFACE3};padding:20px 16px}
.${P}-caja-i{display:flex;color:${CELESTE}}
.${P}-caja-tx{display:flex;flex-direction:column;gap:4px;font-size:14px;line-height:20px;font-weight:500;color:${GRIS}}
.${P}-caja-tx strong{font-weight:700;color:#fff}
/* Dada vuelta (medido): la tocada queda en 2 y la otra de la fila en 1 —si la tocada era la angosta, se cambian el ancho—; su cara se
   apaga y la de atrás se prende. */
.${P}-fila:has(> .${P}-tile > .${P}-radio:checked) > .${P}-tile{flex-grow:1}
.${P}-fila:has(> .${P}-tile > .${P}-radio:checked) > .${P}-tile:has(> .${P}-radio:checked){flex-grow:2}
.${P}-tile:has(> .${P}-radio:checked) .${P}-cara{opacity:0;pointer-events:none}
.${P}-tile:has(> .${P}-radio:checked) .${P}-cara *{pointer-events:none!important}
.${P}-tile:has(> .${P}-radio:checked) .${P}-atras{opacity:1;pointer-events:auto}

/* «Trusted by names you know»: todo centrado (el texto en 770 px) y la cita en su caja de 1184 × 520, borde #4E4E6C y radio 8. */
.${P}-centro{display:flex;flex-direction:column;align-items:center;text-align:center}
.${P}-centro .${P}-h2{max-width:1000px}
.${P}-centro .${P}-lede{margin-top:12px;max-width:770px}
.${P}-centro .${P}-btn{margin-top:24px}
.${P}-cita{position:relative;isolation:isolate;overflow:hidden;margin-top:64px;min-height:520px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:80px 64px;border:1px solid #4E4E6C;border-radius:8px;background:${CARD} linear-gradient(-11.046deg,rgba(78,78,108,0) 66.952%,rgba(152,152,210,.04) 99.472%)}
.${P}-cita-brillo{position:absolute;z-index:-1;left:-.68%;top:42.9%;width:101.9%;height:136.7%;pointer-events:none}
.${P}-cita-t{max-width:755px;font-size:30px;line-height:36px;font-weight:500;color:#fff}
.${P}-cita-t strong{font-weight:500}
.${P}-cita-pie{margin-top:32px;display:flex;flex-direction:column;align-items:center}
.${P}-cita-av{width:48px;height:48px;border-radius:9999px;object-fit:cover;border:1px solid rgba(255,255,255,.12);margin-bottom:12px}
.${P}-cita-n{font-size:16px;line-height:24px;font-weight:700;color:#fff}
.${P}-cita-r{font-size:18px;line-height:28px;font-weight:500;color:${GRIS2}}

/* «Powerful integrations»: el título de 576 a la izquierda, el botón a la derecha, y a 64 px la franja de 1184 × 237. */
.${P}-cab-integ{grid-template-columns:576px auto;align-items:end}
.${P}-cab-integ .${P}-h2{margin-top:0}
.${P}-logos{margin-top:64px;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:16px;min-height:237px}
.${P}-logo-i{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;background:${CARD};border:1px solid ${LINEA};border-radius:12px;padding:24px 16px;text-align:center}
.${P}-logo-c{display:flex;align-items:center;justify-content:center;width:72px;height:72px;border-radius:16px;background:#fff}
.${P}-logo-c img{width:40px;height:40px;object-fit:contain}
.${P}-logo-n{font-size:16px;line-height:24px;font-weight:500;color:${GRIS}}

/* «Have a question?»: el título en 352 px a la izquierda y las preguntas en 768 desde x = 544 (4 y 8 de 12 columnas, 64 entre medio);
   filete de 2 px #4E4E6C arriba de cada una, 24 × 16 de aire, la pregunta 20/28 600 y su flecha de 20 que gira en ,3 s. La respuesta
   aparece de golpe (medido), 20/28 500 #DDDCE8. */
.${P}-faq-in{display:grid;grid-template-columns:minmax(0,4fr) minmax(0,8fr);gap:64px;align-items:start}
.${P}-faq-h2{margin-top:0}
.${P}-q summary{display:flex;align-items:center;justify-content:space-between;padding:24px 16px;border-top:2px solid #4E4E6C;cursor:pointer;list-style:none;font-size:18px;line-height:28px;font-weight:500}
.${P}-q summary::-webkit-details-marker{display:none}
.${P}-q h3{width:95%;padding-right:8px;font-size:20px;line-height:28px;font-weight:600;color:#fff}
.${P}-q summary svg{flex:none;transition:transform .3s cubic-bezier(.4,0,.2,1)}
.${P}-q[open] summary svg{transform:rotate(180deg)}
.${P}-q-r{padding:0 16px 24px;font-size:20px;line-height:28px;font-weight:500;color:${GRIS}}

/* La caja del cierre: 64 arriba y abajo, 1184 × 312, borde del color de marca a media luz y radio 12; su imagen de luz (un azul
   profundo al centro que se apaga hacia los bordes) es aquí un degradado con el azul de MaKo. */
.${P}-cierre{padding:64px 0}
.${P}-cierre-h{position:relative;margin-top:0}
.${P}-cierre-caja{position:relative;overflow:hidden;display:flex;flex-direction:column;gap:24px;text-align:center;align-items:center;justify-content:center;min-height:312px;padding:64px 24px;border:1px solid #1E3D8A;border-radius:12px;background:radial-gradient(28% 55% at 2% 0%,rgba(47,111,237,.38),rgba(47,111,237,0) 100%),radial-gradient(62% 95% at 52% 48%,#123084 0%,#0E2568 38%,#0A1642 68%,#070A22 100%)}

/* El pie: filete arriba, 64 de aire; el lema a la izquierda (384 px) y las columnas de links a partir de x = 624. */
.${P}-pie{border-top:1px solid ${LINEA};padding:64px 0}
.${P}-pie-in{display:grid;grid-template-columns:384px 688px;justify-content:space-between;padding-bottom:48px;border-bottom:1px solid ${LINEA}}
.${P}-pie-lema{font-size:16px;line-height:24px;font-weight:700;color:#fff}
.${P}-pie-h{font-size:14px;line-height:20px;font-weight:700;color:#fff;margin-bottom:16px}
.${P}-pie-cols ul{columns:4;column-gap:40px}
.${P}-pie-cols li{font-size:14px;line-height:20px;font-weight:500;padding-bottom:12px;break-inside:avoid}
.${P}-pie-cols a{color:${GRIS3};border-radius:6px;transition:color .15s}
.${P}-pie-cols a:hover{color:#fff}
.${P}-pie-base{display:flex;align-items:center;justify-content:space-between;padding-top:32px}
.${P}-pie-base p{font-size:14px;line-height:20px;font-weight:500;color:${GRIS2}}

/* De 1280 para abajo: 32 de aire a los lados. */
@media (max-width:1279px){
  .${P}-cont{padding:0 32px}
  .${P}-barra{padding:20px 32px}
  .${P}-cab{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:48px}
  .${P}-cab-integ{grid-template-columns:minmax(0,1fr) auto}
  .${P}-pie-in{grid-template-columns:minmax(0,1fr) minmax(0,1.8fr);gap:48px}
}
/* Su cara de atrás entre 768 y 1024: los recuadros en dos columnas. */
@media (max-width:1023px){
  .${P}-cajas{grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:none;grid-auto-rows:minmax(0,1fr)}
  .${P}-faq-in{grid-template-columns:minmax(0,1fr);gap:48px}
}
/* Como su hero, que pasa a una columna debajo de 890 px. */
@media (max-width:889px){
  .${P}-hero-in{grid-template-columns:minmax(0,1fr)}
  .${P}-hero-vis{min-height:0}
  .${P}-funde,.${P}-hero-mancha{width:100%}
  .${P}-pie-cols ul{columns:2}
}
/* A 390: 40 de aire en cada sección, 20 a los lados, titulares 42/44 y 36/40, todo en una columna. */
@media (max-width:767px){
  .${P}-cont{padding:0 20px}
  .${P}-barra{padding:10px 16px}
  .${P}-barra-link{display:none}
  .${P}-hero{padding:40px 0}
  .${P}-h1{font-size:42px;line-height:44px;margin-bottom:8px}
  .${P}-hero-p{max-width:none}
  .${P}-hero-btns{flex-direction:column;gap:16px}
  .${P}-hero-btns .${P}-btn,.${P}-hero-btns .${P}-btn-t{width:100%}
  .${P}-btn-hero .${P}-btn-t{min-height:46px}
  .${P}-btn-t{font-size:16px;line-height:24px}
  .${P}-btn:hover,.${P}-btn:hover .${P}-btn-t,.${P}-btn:hover .${P}-btn-c1,.${P}-btn:hover .${P}-btn-c2{transform:none}
  .${P}-sec{padding:40px 0}
  .${P}-h2{font-size:36px;line-height:40px}
  .${P}-lede{font-size:18px;line-height:28px}
  .${P}-cab,.${P}-cab-integ{grid-template-columns:minmax(0,1fr);gap:24px}
  .${P}-bento{margin-top:40px;gap:16px}
  /* Su teléfono: las tarjetas una debajo de otra (16 de separación), sin darse vuelta (su «+» queda invisible), el texto con 24 de
     aire y, a 40 px, la captura entera, pegada al borde derecho, con 24 abajo. */
  .${P}-fila{flex-direction:column;gap:16px;height:auto}
  .${P}-tile,.${P}-tile-2{flex:none;height:auto}
  .${P}-radio,.${P}-atras,.${P}-cara-toda{display:none}
  .${P}-cara{position:relative;gap:40px}
  .${P}-mas{visibility:hidden;width:32px;height:32px}
  .${P}-tile-t{font-size:20px;line-height:28px}
  .${P}-tile-p,.${P}-tile-a{font-size:16px;line-height:24px}
  .${P}-shot{padding:0 0 24px 24px}
  .${P}-shot .${P}-shot-pc{display:none}
  .${P}-shot .${P}-shot-tel{position:static;display:block;width:100%;height:auto}
  .${P}-cita{margin-top:40px;min-height:480px;padding:40px 20px}
  .${P}-cita-t{font-size:18px;line-height:28px}
  .${P}-cita-r{font-size:16px;line-height:24px}
  .${P}-cab-integ .${P}-btn,.${P}-cab-integ .${P}-btn-t{width:100%}
  .${P}-logos{margin-top:40px;grid-template-columns:minmax(0,1fr);gap:8px;min-height:0}
  .${P}-logo-i{flex-direction:row;justify-content:flex-start;padding:12px 16px}
  .${P}-logo-c{width:48px;height:48px;border-radius:12px}
  .${P}-logo-c img{width:28px;height:28px}
  .${P}-cierre{padding:40px 0}
  .${P}-cierre-caja{min-height:276px;padding:64px 24px}
  .${P}-cierre-caja .${P}-btn,.${P}-cierre-caja .${P}-btn-t{width:100%}
  .${P}-pie{padding:40px 0}
  .${P}-pie .${P}-cont{display:flex;flex-direction:column;padding:0 16px}
  .${P}-pie-in{display:contents}
  .${P}-pie-cols{order:1}
  .${P}-pie-base{order:2;margin-top:32px;padding-top:32px;border-top:1px solid ${LINEA}}
  .${P}-pie-lema{order:3;margin-top:40px}
}
@media (prefers-reduced-motion:reduce){
  .${P} *{animation:none!important;transition:none!important}
  .${P}-funde-b{display:none}
}
`;
