// =============================================================================
// La portada del sitio de MaKo (/vsl/sitio, vista previa): copiada de https://www.beehiiv.com/ (12/11/2026)
// =============================================================================
// Pedido de Martín (12/11/2026): que la portada deje de ser una landing y sea «una página web como normalmente las tienen los
// grandes SaaS», copiando la de beehiiv. Su orden, que se respeta: hero → la tira de logos → «Everything you need to turn
// attention into growth» (seis tarjetas) → «Trusted by names you know» (sus tarjetas de clientes) → «Build your way» (los
// planes) → «The numbers tell the story» → «Powerful integrations» → «Have a question?» → «What are you waiting for?» → pie.
// Los valores medidos, en ./estilos.ts y docs/diseno/sitio-beehiiv.md; lo que dice, en ./datos.ts.
//
// Lo que cambió de la referencia, y por qué:
//   · Hero: sin sus estrellas ni «4.9/5 from 28,479 customers» (contador suyo). Sus dos botones son la llamada y «Ver planes»;
//     su nota («Get started for free…») es la frase de la landing de MaKo que acompaña a la llamada. Su imagen (tres pantallas de su
//     producto superpuestas) son tres de MaKo con los visuales de sus landings: el CRM, el Ops Center y Automations.
//   · La tira: no hay logos de clientes. Van las apps conocidas con las que MaKo se conecta, con su logo oficial
//     (app/_components/ServicioVisual.tsx) y su nombre, deslizándose como la suya.
//   · Sus tarjetas pasaron a FILAS (12/11/2026, Martín): texto de un lado y la grabación de la app del otro, intercalando. Su «+» de arriba a la derecha (allá
//     da vuelta la tarjeta, con JavaScript) lleva a la misma landing. El resto de las funciones está en el menú «Producto» y en el pie.
//   · «Trusted by names you know» → el caso de Mauricio TAL CUAL estaba en la landing de /vsl (CasoMauricio: su video, su historia
//     y el carrusel de fotos). Martín, 12/11/2026: «vuelve a como estaba antes la parte del testimonio de Mauricio».
//   · «Build your way»: los planes salen de planesParaLanding() (lib/compra-plan.ts) y se dibujan con los MISMOS bloques de
//     /planes (TarjetasPlanes, con el Acelerador), sobre una franja clara (Martín: «está todo en negro… y falta el Accelerator»).
//   · «The numbers tell the story» se fue el 12/11/2026 (Martín: «la parte de MaKo en números para mí no tiene mucho sentido»).
//   · «Powerful integrations»: su imagen de logos son los logos de las integraciones del catálogo que un negocio puede conectar.
//   · «Have a question?»: las preguntas de las landings de MaKo, que el código sostiene.
//   · El cierre dice la frase de la landing de MaKo antes de la llamada («¿Lo quieres andando en tu negocio?»).
// Server component. Lo único que no es del servidor son los logos (SvcIcon, de ServicioVisual), que no tienen interacción.
// =============================================================================

import { TEXTO_CTA } from '../_competencia/marca';
import { VisualDeLanding } from '../_competencia/Visuales';
import { FaltaAnimacion } from '../_competencia/FaltaAnimacion';
import type { Bloque } from '../_competencia/tipos';
import PandaPlayer from '../_detalle/PandaPlayer';
import { CSS_CASO, CasoMauricio } from '../_detalle/FeatureDetail';
import { BrandDefs, SvcIcon } from '@/app/_components/ServicioVisual';
import { CSS_TARJETAS, TarjetasPlanes } from '@/app/planes/Tarjetas';
import { ASESORES, inspiradoEn } from '@/lib/asesores/catalogo';
import { bajadaDePlanes } from '@/lib/compra-plan-reglas';
import type { PlanMako } from '@/lib/planes-mako';
import { Barra } from './Barra';
import { Pie } from './Pie';
import { Boton, Flecha, Icono } from './Piezas';
import { CSS_BARRA, CSS_BASE, CSS_PIE, CSS_PORTADA } from './estilos';
import {
  ESCENAS_AVATAR, LOGO_INTEGRACION, PREGUNTAS_SITIO, TABLEROS, RUTA_COMPARACIONES, RUTA_PRECIOS, TARJETAS_PORTADA, integracionesDeLaTira, integracionesVivas, landingDeSlug, nombreCorto,
} from './datos';
import { appsQueReemplaza } from './reemplaza';

/** Un plan como lo devuelve planesParaLanding() (lib/compra-plan.ts). */
export type PlanSitio = Pick<PlanMako, 'id' | 'nombre' | 'capa' | 'precioUsd' | 'resumen' | 'incluye' | 'destacado' | 'precioAnualUsd' | 'preciosLocales'> & { cobrable: boolean };

type Hero = Extract<Bloque, { tipo: 'hero' }>;
const heroDe = (slug: string): Hero | undefined => landingDeSlug(slug)?.bloques.find((b): b is Hero => b.tipo === 'hero');

/** El VSL que grabó Martín, el mismo de la portada de hoy (el documento publicado de hola-mako.com, 12/11/2026). */
export const VSL_PORTADA = 'https://player-vz-dd4ad08b-375.tv.pandavideo.com/embed/?v=25c0684d-528e-4382-9796-d1ec74b79634&color=%232F6FED';

function HeroSitio() {
  return (
    <section className="s-hero">
      <div className="s-cont s-hero-in">
        <div className="s-hero-tx">
          {/* Martín (12/11/2026): «el título principal me gustaría que sea el mejor software para ventas high ticket. Y me gusta eso
              de ventas, marketing, contenido en una sola app. Eso tal vez abajo». Y la frase debajo del botón se fue: repetía lo
              que el botón ya dice. Y «debería tener como máximo 3 saltos de línea, no 4»: tres renglones fijos, y la letra se
              achica con el ancho de su columna (`cqi` en estilos.ts) para que «El mejor software» entre siempre en uno. */}
          <h1 className="s-h1">El mejor software<br /> para ventas<br /> <em>High Ticket.</em></h1>
          <p className="s-hero-p"><strong>Ventas, marketing y contenido en una sola app.</strong> Con una IA que conoce tu negocio, del primer clic en tu anuncio al cliente que paga.</p>
          <div className="s-hero-btns">
            <Boton clase="s-btn-alto" />
            <Boton href={RUTA_PRECIOS} texto="Ver planes" clase="s-btn-alto s-btn-borde" />
          </div>
        </div>
        {/* Martín (12/11/2026): «en esa parte debería estar el VSL que yo ya grabé», y no las tres pantallas (CRM, Ops Center
            y Automations) que ponía beehiiv en su composición. Es el VSL de la portada de hoy (hola-mako.com). */}
        <div className="s-hero-vsl"><PandaPlayer src={VSL_PORTADA} title="MaKo: el video de presentación" /></div>
      </div>
    </section>
  );
}

/**
 * Debajo del hero, las apps que MaKo reemplaza, con su logo original (./reemplaza.ts) y el link a la comparación. Martín
 * (12/11/2026): «ese carrusel de aplicaciones lo pondría tal vez en otra sección más abajo, ahí pondría el mismo carrusel de MaKo
 * reemplaza las apps que ya estás pagando, que ahí justamente salga la comparativa». La de integraciones bajó a su sección.
 */
function TiraReemplaza() {
  const apps = appsQueReemplaza();
  const lista = (oculta: boolean) => (
    <ul className="s-tira-l" aria-hidden={oculta || undefined}>
      {apps.map((a) => (
        // eslint-disable-next-line @next/next/no-img-element
        <li key={a.logo} className="s-tira-i s-tira-app"><img src={a.logo} alt="" width={30} height={30} />{a.nombre}</li>
      ))}
    </ul>
  );
  return (
    <section className="s-tira s-tira-reemplaza" aria-label="Las apps que MaKo reemplaza">
      <p className="s-tira-r">MaKo reemplaza {apps.length} apps que ya estás pagando</p>
      <div className="s-tira-v">
        <div className="s-tira-p">{lista(false)}{lista(true)}</div>
      </div>
      <p className="s-tira-ver"><a href={RUTA_COMPARACIONES}>Ver la comparación, trabajo por trabajo <Flecha size={18} /></a></p>
    </section>
  );
}

function TiraSitio() {
  const apps = integracionesDeLaTira();
  if (!apps.length) return null;
  const lista = (oculta: boolean) => (
    <ul className="s-tira-l" aria-hidden={oculta || undefined}>
      {apps.map((d) => (
        <li key={d.key} className="s-tira-i s-tira-app">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {LOGO_INTEGRACION[d.key] ? <img src={`/vsl-assets/logos/integraciones/${LOGO_INTEGRACION[d.key]}`} alt="" width={30} height={30} /> : <SvcIcon k={d.key} size={18} box={30} radius={8} />}
          {d.nombre}
        </li>
      ))}
    </ul>
  );
  return (
    <section className="s-tira" aria-label="Apps con las que se conecta">
      <p className="s-tira-r">Funciona con las apps que ya usas</p>
      <div className="s-tira-v">
        <div className="s-tira-p">{lista(false)}{lista(true)}</div>
      </div>
    </section>
  );
}

/** Una fila: el texto de un lado y lo que se ve del otro (`inv`: al revés). Sin landing (Classroom), sin link. */
function FilaFuncion({ slug, rotulo, titulo, texto, visual, inv }: (typeof TARJETAS_PORTADA)[number] & { inv: boolean }) {
  const l = slug ? landingDeSlug(slug) : undefined;
  if (slug && !l) return null;
  const hero = visual === 'hero' && slug ? heroDe(slug) : undefined;
  const grabacion = typeof visual === 'object' && 'video' in visual ? visual : null;
  const falta = typeof visual === 'object' && 'falta' in visual ? visual.falta : null;
  return (
    <div className={`s-zz-fila${inv ? ' s-zz-inv' : ''}`}>
      <div className="s-zz-tx">
        <p className="s-zz-r">{rotulo ?? (l ? nombreCorto(l) : '')}</p>
        <h3 className="s-zz-t">{titulo}</h3>
        <p className="s-zz-p">{texto}</p>
        {l ? <a className="s-zz-a" href={`/vsl/${l.slug}`}>Ver cómo funciona <Flecha /></a> : null}
      </div>
      <div className={`s-zz-vis${grabacion ? ' s-zz-video' : visual === 'gurus' ? ' s-zz-gurus' : visual === 'tableros' ? ' s-zz-tableros' : visual === 'avatar' ? ' s-zz-avatar' : falta ? ' s-zz-falta' : ''}`} aria-hidden={falta ? undefined : true}>
        {grabacion ? (
          // Sin sonido y en bucle: arranca sola, como un GIF (el navegador sólo deja eso si está muda).
          <video src={grabacion.video} poster={grabacion.poster} autoPlay muted loop playsInline preload="metadata" />
        ) : visual === 'gurus' ? (
          <Gurus />
        ) : visual === 'tableros' ? (
          <Tableros />
        ) : visual === 'avatar' ? (
          <AvatarEscenas />
        ) : falta ? (
          <FaltaAnimacion que={falta} />
        ) : (
          <div className="s-panel">{hero ? <VisualDeLanding visual={hero.visual} /> : null}</div>
        )}
      </div>
    </div>
  );
}

/**
 * Los referentes (public/asesores/<id>.png), en una pared que se desliza sola hacia arriba y vuelve a empezar sin corte (la lista
 * va dos veces). Sin texto encima (Martín, 12/11/2026: «no pongas texto innecesario»): «Inspirado en» queda en el nombre de cada
 * imagen, y la landing de Copywriting lo dice entero.
 */
function Gurus() {
  const una = (copia: boolean) => ASESORES.map((a) => (
    <li key={`${copia ? 'b' : 'a'}-${a.id}`}><img src={`/asesores/${a.id}.png`} alt={copia ? '' : inspiradoEn(a)} title={copia ? undefined : inspiradoEn(a)} width={200} height={200} decoding="async" /></li>
  ));
  return (
    <div className="s-gurus">
      <ul className="s-gurus-ul">{una(false)}{una(true)}</ul>
    </div>
  );
}

/** Los tableros de MaKo pasando de a uno, cada uno entrando de arriba hacia abajo (sólo CSS: anda sin JavaScript y en el visor). */
function Tableros() {
  const n = TABLEROS.length;
  return (
    <div className="s-tab" style={{ ['--n' as string]: n }}>
      {TABLEROS.map((t, i) => (
        <img key={t.id} src={`/vsl-assets/sitio/tableros/${t.id}.jpg`} alt={`El tablero «${t.nombre}» de MaKo`} width={960} height={600}
          decoding="async" style={{ animationDelay: `${i * 2.6}s` }} />
      ))}
    </div>
  );
}

/** AI Avatar en una mirada: el personaje a la izquierda y, a la derecha, ESE MISMO personaje pasando por sus escenas. */
function AvatarEscenas() {
  return (
    <div className="s-av">
      <figure className="s-av-foto"><img src="/vsl-assets/sitio/avatar/personaje.jpg" alt="Tu personaje" width={432} height={774} /><figcaption>Tu personaje</figcaption></figure>
      <span className="s-av-flecha" aria-hidden="true">→</span>
      <div className="s-av-tel">
        {ESCENAS_AVATAR.map((e, i) => (
          <figure key={e.foto} style={{ animationDelay: `${i * 2.8}s` }}>
            <img src={`/vsl-assets/sitio/avatar/${e.foto}.jpg`} alt={`Tu personaje: ${e.nombre}`} width={432} height={774} />
            <figcaption>{e.nombre}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

function ProductoSitio() {
  return (
    <section className="s-sec">
      <div className="s-cont">
        <div className="s-cab">
          <div>
            <p className="s-rotulo">Producto</p>
            <h2 className="s-h2">Todo lo que necesitas para vender High Ticket.</h2>
          </div>
          <div className="s-cab-der">
            <p className="s-lede">Tu CRM, tus chats, tus anuncios y tu contenido en una sola app, con MaKo trabajando en tu negocio.</p>
            <Boton />
          </div>
        </div>
        <div className="s-zz">
          {TARJETAS_PORTADA.map((t, i) => <FilaFuncion key={`${t.slug ?? t.rotulo}-${i}`} {...t} inv={i % 2 === 1} />)}
        </div>
      </div>
    </section>
  );
}

/**
 * El caso de Mauricio TAL CUAL estaba en la landing de /vsl (CasoMauricio: el video «Mauricio, en vivo», su historia, lo que no
 * lo habría resuelto y el carrusel de fotos). Martín (12/11/2026): «vuelve a como estaba antes la parte del testimonio de
 * Mauricio… vuélvelo como estaba». Va sobre su franja clara, como en la landing.
 */
function CasoSitio() {
  return (
    <section className="s-caso-orig" id="caso" data-tema-fijo="">
      {/* EXACTAMENTE como estaba (Martín, 12/11/2026, noche: «vuelvas a como estaba exactamente antes… no me gusta cómo quedó»): la
          franja clara de la landing (su ::before) y de color fijo (`data-tema-fijo`): el sol y la luna no la toca. */}
      <style dangerouslySetInnerHTML={{ __html: CSS_CASO + '.s-caso-orig{color:#12151B}.s-caso-orig .mk-hist{margin:0}.s-caso-orig .mk-hist::before{background:#F6F8FC}' }} />
      <div className="s-cont"><CasoMauricio /></div>
    </section>
  );
}

/**
 * Los precios: LOS MISMOS tres bloques de /planes (app/planes/Tarjetas.tsx → TarjetasPlanes: Esencial, Pro y el Acelerador), sobre
 * una franja clara. Martín (12/11/2026): «en la parte de pricing está todo en negro cuando no debería ser así. Y falta el MaKo
 * Accelerator». Lo que se cambie en los bloques de /planes se ve aquí sin tocar nada.
 */
function PlanesSitio({ planes }: { planes: readonly PlanSitio[] }) {
  return (
    <section className="s-sec s-precios" id="precios">
      <style dangerouslySetInnerHTML={{ __html: CSS_TARJETAS }} />
      <div className="s-cont">
        <div className="s-centro">
          <p className="s-rotulo">Precios</p>
          <h2 className="s-h2">Elige cómo quieres crecer.</h2>
          <p className="s-lede">{bajadaDePlanes(planes.some((p) => p.cobrable))}</p>
        </div>
        {planes.length ? <div className="s-precios-bloques"><TarjetasPlanes planes={planes} sufijo="" /></div> : null}
        <div className="s-centro"><a className="s-btn-sec" href={RUTA_PRECIOS}>Comparar los planes <Flecha /></a></div>
      </div>
    </section>
  );
}

function IntegracionesSitio() {
  const todas = integracionesVivas();
  const filas = [todas.filter((_, i) => i % 2 === 0), todas.filter((_, i) => i % 2 === 1)];
  return (
    <section className="s-sec">
      <div className="s-cont">
        <div className="s-int-cab">
          <div>
            <h2 className="s-h2">Tus apps, conectadas.</h2>
            <p className="s-lede">{todas.length} integraciones: tus anuncios, tus chats, tu agenda, tus reuniones y tus cobros.</p>
          </div>
          <Boton />
        </div>
      </div>
      <div className="s-cont">
        <div className="s-int-filas">
          {filas.map((f, i) => (
            <ul key={i} className="s-int-f">
              {f.map((d) => (
                <li key={d.key} className="s-int-t" title={d.nombre}>
                  <SvcIcon k={d.key} size={28} box={46} radius={11} />
                  <span className="s-sr">{d.nombre}</span>
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </section>
  );
}

function PreguntasSitio() {
  return (
    <section className="s-sec">
      <div className="s-cont s-faq-in">
        <h2 className="s-h2">¿Tienes una pregunta?</h2>
        <div className="s-faq-l">
          {PREGUNTAS_SITIO.map((q) => (
            <details key={q.p} className="s-q">
              <summary>
                <h3>{q.p}</h3>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
              </summary>
              <p>{q.r}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function CierreSitio() {
  return (
    <section className="s-cierre">
      <div className="s-cont">
        <div className="s-cierre-caja">
          <h2 className="s-h2">¿Lo quieres andando en tu negocio?</h2>
          <Boton texto={TEXTO_CTA} />
        </div>
      </div>
    </section>
  );
}

export function PortadaSitio({ planes }: { planes: readonly PlanSitio[] }) {
  return (
    <div className="s-sitio">
      <style dangerouslySetInnerHTML={{ __html: CSS_BASE + CSS_BARRA + CSS_PIE + CSS_PORTADA }} />
      <BrandDefs />
      <Barra />
      <main>
        <HeroSitio />
        <TiraReemplaza />
        <ProductoSitio />
        <CasoSitio />
        <PlanesSitio planes={planes} />
        <TiraSitio />
        <IntegracionesSitio />
        <PreguntasSitio />
        <CierreSitio />
      </main>
      <Pie />
    </div>
  );
}
