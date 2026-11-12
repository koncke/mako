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
//   · Sus seis tarjetas son seis funciones de MaKo, cada una con el visual de su landing y su link. Su «+» de arriba a la derecha (allá
//     da vuelta la tarjeta, con JavaScript) lleva a la misma landing. El resto de las funciones está en el menú «Producto» y en el pie.
//   · «Trusted by names you know»: su marquesina de fotos y cifras de clientes → el caso de Mauricio (el único): su foto con su
//     nombre y las tres cifras de sus meses, con el diseño de esas tarjetas, quietas (cuatro entran en el ancho; a 390, como su
//     fila de 220 × 300 cortada en el borde, se corren con el dedo). Sin «See all
//     customer stories» ni la caja con la cita de otro cliente que va después de los planes (no hay otro caso).
//   · «Build your way»: los planes salen de planesParaLanding() (lib/compra-plan.ts) y cada uno lleva a /planes/<id>, como en la
//     portada de hoy. Sin sus chips de «All plans include», su regla de suscriptores ni su selector anual: el precio de MaKo no
//     depende de los suscriptores y el anual se pide en /planes. Con dos planes las tarjetas son de 384 en vez de 284.
//   · «The numbers tell the story»: cuatro números CONTADOS del código (./datos.ts, `numerosDelSitio`), nunca de uso.
//   · «Powerful integrations»: su imagen de logos son los logos de las integraciones del catálogo que un negocio puede conectar.
//   · «Have a question?»: las preguntas de las landings de MaKo, que el código sostiene.
//   · El cierre dice la frase de la landing de MaKo antes de la llamada («¿Lo quieres andando en tu negocio?»).
// Server component. Lo único que no es del servidor son los logos (SvcIcon, de ServicioVisual), que no tienen interacción.
// =============================================================================

import type { CSSProperties } from 'react';
import { CASO, TEXTO_CTA, TEXTO_CIERRE } from '../_competencia/marca';
import { VisualDeLanding } from '../_competencia/Visuales';
import type { Bloque } from '../_competencia/tipos';
import { FEATURE_VISUALS } from '../_detalle/feature-visuals';
import { Visual } from '../_detalle/Visual';
import PandaPlayer from '../_detalle/PandaPlayer';
import { BrandDefs, SvcIcon } from '@/app/_components/ServicioVisual';
import { bajadaDePlanes, botonDelPlan } from '@/lib/compra-plan-reglas';
import type { PlanMako } from '@/lib/planes-mako';
import { Barra } from './Barra';
import { Pie } from './Pie';
import { Boton, Flecha, Icono } from './Piezas';
import { CSS_BARRA, CSS_BASE, CSS_PIE, CSS_PORTADA } from './estilos';
import {
  HISTORIA, PREGUNTAS_SITIO, RUTA_PRECIOS, TARJETAS_PORTADA, integracionesDeLaTira, integracionesVivas, landingDeSlug, nombreCorto, numerosDelSitio,
} from './datos';

/** Un plan como lo devuelve planesParaLanding() (lib/compra-plan.ts). */
export type PlanSitio = Pick<PlanMako, 'id' | 'nombre' | 'capa' | 'precioUsd' | 'resumen' | 'incluye' | 'destacado' | 'precioAnualUsd' | 'preciosLocales'> & { cobrable: boolean };

type Hero = Extract<Bloque, { tipo: 'hero' }>;
const heroDe = (slug: string): Hero | undefined => landingDeSlug(slug)?.bloques.find((b): b is Hero => b.tipo === 'hero');
const precio = (n: number) => n.toLocaleString('es-AR');

/** El VSL que grabó Martín, el mismo de la portada de hoy (el documento publicado de hola-mako.com, 12/11/2026). */
export const VSL_PORTADA = 'https://player-vz-dd4ad08b-375.tv.pandavideo.com/embed/?v=25c0684d-528e-4382-9796-d1ec74b79634&color=%232F6FED';

function HeroSitio() {
  return (
    <section className="s-hero">
      <div className="s-cont s-hero-in">
        <div>
          <h1 className="s-h1">Ventas.<br />Marketing.<br />Contenido.<br /><em>Una sola app.</em></h1>
          <p className="s-hero-p">La app con IA para vender High Ticket, de punta a punta: del primer clic en tu anuncio al cliente que paga.</p>
          <div className="s-hero-btns">
            <Boton clase="s-btn-alto" />
            <Boton href={RUTA_PRECIOS} texto="Ver planes" clase="s-btn-alto s-btn-borde" />
          </div>
          <p className="s-nota">{TEXTO_CIERRE}</p>
        </div>
        {/* Martín (12/11/2026): «en esa parte debería estar el VSL que yo ya grabé», y no las tres pantallas (CRM, Ops Center
            y Automations) que ponía beehiiv en su composición. Es el VSL de la portada de hoy (hola-mako.com). */}
        <div className="s-hero-vsl"><PandaPlayer src={VSL_PORTADA} title="MaKo: el video de presentación" /></div>
      </div>
    </section>
  );
}

function TiraSitio() {
  const apps = integracionesDeLaTira();
  if (!apps.length) return null;
  const lista = (oculta: boolean) => (
    <ul className="s-tira-l" aria-hidden={oculta || undefined}>
      {apps.map((d) => (
        <li key={d.key} className="s-tira-i"><SvcIcon k={d.key} size={18} box={30} radius={8} />{d.nombre}</li>
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

function TarjetaFuncion({ slug, texto, visual, chica }: (typeof TARJETAS_PORTADA)[number] & { chica: boolean }) {
  const l = landingDeSlug(slug);
  if (!l) return null;
  const hero = heroDe(slug);
  const pedido = visual === 'hero' ? null : visual;
  const spec = pedido ? FEATURE_VISUALS[pedido.grupo]?.groups.find((g) => g.type === pedido.tipo) : undefined;
  return (
    <article className={`s-card${chica ? ' s-card-chica' : ''}`}>
      <div className="s-card-tx">
        <h3 className="s-card-t">{nombreCorto(l)}</h3>
        <p className="s-card-p">{texto}</p>
        <a className="s-card-a" href={`/vsl/${l.slug}`}>Ver cómo funciona <Flecha /></a>
      </div>
      {/* Su «+» de arriba a la derecha (allá da vuelta la tarjeta, con JavaScript): aquí lleva a la misma landing. */}
      <a className="s-card-mas" href={`/vsl/${l.slug}`} tabIndex={-1} aria-hidden="true"><Icono d={['M12 5v14', 'M5 12h14']} size={24} /></a>
      <div className="s-card-vis" aria-hidden="true">
        <div className="s-panel">{spec ? <Visual spec={spec} /> : hero ? <VisualDeLanding visual={hero.visual} /> : null}</div>
      </div>
    </article>
  );
}

function ProductoSitio() {
  const filas: (typeof TARJETAS_PORTADA)[number][][] = [];
  for (let i = 0; i < TARJETAS_PORTADA.length; i += 2) filas.push(TARJETAS_PORTADA.slice(i, i + 2));
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
        <div className="s-bento">
          {filas.map((par, i) => {
            // Como sus filas: la primera de 2 a 1, la siguiente de 1 a 2, y así.
            const inv = i % 2 === 1;
            return (
              <div key={i} className={`s-fila${inv ? ' s-fila-inv' : ''}`}>
                {par.map((t, j) => <TarjetaFuncion key={t.slug} {...t} chica={inv ? j === 0 : j === 1} />)}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function CasoSitio() {
  return (
    <section className="s-sec" id="caso">
      <div className="s-cont">
        <div className="s-centro">
          <p className="s-rotulo">Caso</p>
          <h2 className="s-h2" dangerouslySetInnerHTML={{ __html: CASO.titulo }} />
          <p className="s-lede">{CASO.sub}</p>
          <Boton />
        </div>
        <ul className="s-casos">
          <li className="s-caso s-caso-foto">
            {/* eslint-disable-next-line @next/next/no-img-element -- su foto de cliente, servida de /public */}
            <img className="s-caso-img" src={HISTORIA.foto} alt={HISTORIA.fotoAlt} loading="lazy" />
            <div className="s-caso-velo">
              <p className="s-caso-n">{CASO.quien}</p>
              <p className="s-caso-r">{CASO.rol}</p>
            </div>
          </li>
          {CASO.meses.map((m) => (
            <li key={m.mes} className="s-caso s-caso-cifra">
              <p className="s-caso-num">{m.monto}</p>
              <p className="s-caso-txt">en {m.mes.toLowerCase()}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function PlanesSitio({ planes }: { planes: readonly PlanSitio[] }) {
  return (
    <section className="s-sec" id="precios">
      <div className="s-cont">
        <div className="s-centro">
          <p className="s-rotulo">Precios</p>
          <h2 className="s-h2">Elige cómo quieres crecer.</h2>
          <p className="s-lede">{bajadaDePlanes(planes.some((p) => p.cobrable))}</p>
          <a className="s-btn-sec" href={RUTA_PRECIOS}>Comparar los planes <Flecha /></a>
        </div>
        {planes.length ? (
          <div className="s-planes" style={{ '--n': planes.length } as CSSProperties}>
            {planes.map((p) => {
              const boton = botonDelPlan({ id: p.id, nombre: p.nombre, cobrable: p.cobrable, sufijo: '' });
              return (
                <article key={p.id} className={`s-plan${p.destacado ? ' s-plan-dest' : ''}`}>
                  <div className="s-plan-top">
                    <div className="s-plan-nom">
                      <h3 className="s-plan-h">{p.nombre}</h3>
                      {p.destacado ? <span className="s-plan-chip">Recomendado</span> : null}
                    </div>
                    {p.resumen ? <p className="s-plan-res">{p.resumen}</p> : null}
                    <p className="s-plan-pr"><span className="s-plan-num">US$ {precio(p.precioUsd)}</span><span className="s-plan-mes">/mes</span></p>
                    {p.precioAnualUsd ? <p className="s-plan-sub">o US$ {precio(p.precioAnualUsd)} al año</p> : null}
                  </div>
                  <a className="s-plan-btn" href={boton.href}>{boton.texto}</a>
                  <div className="s-plan-hr" />
                  <ul className="s-plan-ul">
                    <li>Incluye:</li>
                    {p.incluye.map((x) => <li key={x}>{x}</li>)}
                  </ul>
                </article>
              );
            })}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function NumerosSitio() {
  const nums = numerosDelSitio();
  return (
    <section className="s-sec">
      <div className="s-cont">
        <div className="s-centro"><h2 className="s-h2">MaKo, en números.</h2></div>
        <div className="s-nums">
          {nums.map((n) => (
            <article key={n.texto} className="s-num">
              <p className="s-num-v">{n.valor}</p>
              <p className="s-num-t">{n.texto}</p>
            </article>
          ))}
        </div>
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
        <TiraSitio />
        <ProductoSitio />
        <CasoSitio />
        <PlanesSitio planes={planes} />
        <NumerosSitio />
        <IntegracionesSitio />
        <PreguntasSitio />
        <CierreSitio />
      </main>
      <Pie />
    </div>
  );
}
