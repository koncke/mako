// =============================================================================
// VitrinaPlanes — lo que DIBUJA /planes: los tres bloques, la comparación, las preguntas y MaKo Partners (24/10/2026)
// =============================================================================
// Sin datos ni red: la página (./page.tsx) lee las ofertas y el origen de la URL y se los pasa. Aparte para que la vitrina
// se pueda mirar sin levantar la app (que en local escribe en la base de producción): un render estático con los planes
// de hoy (lib/planes-mako.ts) es la MISMA pantalla.
//
// QUE VENDA (24/10/2026, noche, Martín: «La sección de planes no se entiende para nada... Lo hiciste con lenguaje interno...
// Tienes que VENDER, Revisa como lo hacen otras paginas»): los bloques son los mismos de la landing de venta
// (./Tarjetas.tsx, copiados de ClickFunnels y Kajabi); arriba, en una frase, las dos maneras de trabajar; abajo, la
// comparación por grupos y sin nombres de tabs, y las preguntas que contesta toda página de precios («¿qué plan me
// conviene?», como Kajabi).
// El título vende el EQUIPO, no el software (30/10/2026; docs/como-venden-otros.md §1, la investigación de productos con landing:
// «Vendé un equipo, no un software»), y dice sólo lo que los tres planes traen. Antes: «Elige cómo quieres crecer con MaKo».
// =============================================================================

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { bajadaDePlanes, botonDelPlan } from '@/lib/compra-plan-reglas';
import { NOMBRE_PLAN_CON_PRUEBA, PROGRAMA_ACELERADOR, PRUEBA_DIAS, PRUEBA_GRATIS_PRENDIDA, planConPrueba, type PlanMako } from '@/lib/planes-mako';
import { celdaDeCapa, filasDeComparacion, type Celda } from '@/lib/planes-comparacion';
import { CSS_PLANES } from './estilo';
import { CSS_TARJETAS, TEXTO_PAGOS, TarjetasPlanes, type PlanEnTarjeta } from './Tarjetas';
import { TOPES_PRUEBA } from '@/lib/topes-plan';

/** La hoja de la vitrina. La usa también la landing de venta, que dibuja la misma comparación (`CompararPlanes`). */
export const CSS_VITRINA = `
.planes-cabeza { text-align: center; max-width: 720px; margin: 0 auto 30px; }
.planes-cabeza h1 { margin: 10px 0 10px; font-size: 40px; line-height: 1.12; letter-spacing: -.03em; font-weight: 800; }
.planes-cabeza .planes-sub { margin: 0 auto; max-width: 600px; font-size: 17px; }
.planes-alta { margin: 12px 0 0; color: #5B6472; font-size: 14px; }
.planes-faq { max-width: 760px; margin: 48px auto 0; display: grid; gap: 10px; }
.planes-faq h2 { margin: 0 0 8px; font-size: 22px; text-align: center; }
.planes-faq details { background: #fff; border: 1px solid #EAECF1; border-radius: 14px; padding: 0 18px; }
.planes-faq summary { cursor: pointer; list-style: none; padding: 16px 0; font-weight: 700; display: flex; justify-content: space-between; gap: 14px; }
.planes-faq summary::-webkit-details-marker { display: none; }
.planes-faq summary::after { content: "+"; color: #2F6FED; font-weight: 800; font-size: 20px; line-height: 1; }
.planes-faq details[open] summary::after { content: "−"; }
.planes-faq details p { margin: 0 0 16px; color: #4A5260; }
@media (max-width: 600px) {
  .planes-cabeza h1 { font-size: 30px; }
}
`;

export function VitrinaPlanes({ ofertas, sufijo, promoVigente = false }: {
  /** El reloj del 50% del primer mes sigue vivo en este navegador: las tarjetas lo dicen. */
  promoVigente?: boolean;
  ofertas: ReadonlyArray<{ plan: PlanMako; cobrable: boolean }>;
  /** Lo que la URL trae y pasa tal cual al plan elegido (el origen y el código de partner). */
  sufijo: string;
}) {
  // LOS TRES BLOQUES (24/10/2026, Martín: «quiero ver los 3 bloques de pricing típicos que tiene toda app»): los dos planes
  // de software y, a la derecha, el programa con Martín, que nunca pasa por la pasarela: se pide, como el «hablar con
  // ventas» de cualquier SaaS (lib/planes-mako.ts, `PROGRAMA_ACELERADOR`). El ANUAL se muestra desde el 25/10 (el Cerebro) y
  // se PIDE, como el programa: el checkout cobra por mes, así que su botón deja el pedido (./Tarjetas.tsx).
  const programa = PROGRAMA_ACELERADOR;
  const desde = Math.min(...ofertas.map((o) => o.plan.precioUsd));
  const barato = ofertas.find((o) => o.plan.precioUsd === desde)?.plan;
  const recomendado = ofertas.find((o) => o.plan.destacado)?.plan;
  const planes = ofertas.map(({ plan: p, cobrable }) => ({
    id: p.id, nombre: p.nombre, capa: p.capa, precioUsd: p.precioUsd, resumen: p.resumen, incluye: p.incluye, destacado: p.destacado,
    precioAnualUsd: p.precioAnualUsd ?? null, preciosLocales: p.preciosLocales, cobrable,
  }));
  return (
    <main className="planes-root">
      <style dangerouslySetInnerHTML={{ __html: CSS_PLANES + CSS_TARJETAS + CSS_VITRINA }} />
      <div className="planes-wrap planes-ancho">
        <header className="planes-cabeza">
          <div className="planes-marca">MaKo</div>
          <h1>Tu equipo de ventas con IA{Number.isFinite(desde) ? `, desde US$\u00A0${desde.toLocaleString('es-AR')} por mes` : ''}</h1>
          <p className="planes-sub">
            Tus anuncios, tus mensajes, tus páginas de venta y tus cobros en un solo lugar, con una IA que conoce tu negocio. Lo usas
            por tu cuenta, o lo armamos contigo.
          </p>
          <p className="planes-alta">{bajadaDePlanes(ofertas.some((o) => o.cobrable))}</p>
        </header>
        <TarjetasPlanes planes={planes} sufijo={sufijo} promoVigente={promoVigente} />

        <CompararPlanes planes={planes} sufijo={sufijo} />

        <section className="planes-faq" aria-labelledby="planes-faq-titulo">
          <h2 id="planes-faq-titulo">Preguntas frecuentes</h2>
          <details open>
            <summary>¿Qué plan me conviene?</summary>
            <p>
              Si recién empiezas a vender por internet, {barato?.nombre ?? 'el de entrada'}. Si ya vendes y quieres anuncios,
              contenido y equipo, {recomendado?.nombre ?? 'el recomendado'}. Si quieres que te acompañemos a armarlo y a venderlo,
              el {programa.nombre.replace(/^MaKo\s+/, '')}.
            </p>
          </details>
          <details>
            <summary>¿La inteligencia artificial está incluida?</summary>
            <p>
              MaKo trabaja con tu propia cuenta de IA (ChatGPT, Claude o Gemini). Lo que consumes ahí lo pagas directo a ese
              proveedor, aparte del plan.
            </p>
          </details>
          <details>
            <summary>¿Puedo cambiar de plan o darme de baja?</summary>
            <p>Sí. Pasas a otro plan o te das de baja cuando quieras, desde «Tu plan», adentro de MaKo.</p>
          </details>
          {!PRUEBA_GRATIS_PRENDIDA && (
            <details>
              <summary>¿Cuándo pago y cuándo entro?</summary>
              <p>
                Pagas al empezar y entras en el acto. Tu plan se renueva cada mes y te das de baja cuando quieras, desde «Tu plan». Lo
                ya pagado no se devuelve. <Link href="/reembolsos">Las condiciones</Link>.
              </p>
            </details>
          )}
          {PRUEBA_GRATIS_PRENDIDA && <details>
            <summary>¿Cómo es la prueba gratis?</summary>
            <p>
              {NOMBRE_PLAN_CON_PRUEBA} empieza con {PRUEBA_DIAS} días gratis. Pones tu tarjeta al empezar y no se te cobra nada
              hasta el día {PRUEBA_DIAS + 1}. Si te das de baja antes, desde «Tu plan», no se te cobra nada. Después del primer
              cobro, lo pagado no se devuelve. MaKo Esencial no tiene prueba: se paga al empezar.{' '}
              <Link href="/reembolsos">Las condiciones</Link>.
            </p>
            <p>
              En la prueba, lo que se crea con IA tiene tope: hasta {TOPES_PRUEBA['prueba.videos']} videos armados,{' '}
              {TOPES_PRUEBA['prueba.avatares']} video con avatar de IA, {TOPES_PRUEBA['prueba.imagenes']} imágenes y{' '}
              {TOPES_PRUEBA['web.landings_publicadas']} página publicada; exportar en masa se habilita con el primer cobro. El resto
              de MaKo (tus contactos, tus mensajes, tus seguimientos y tus tareas) anda entero. Si quieres todo antes, empiezas tu plan
              cuando quieras.
            </p>
          </details>}
          <details>
            <summary>¿Puedo pagar en pesos?</summary>
            <p>{TEXTO_PAGOS} Desde otro país, en dólares.</p>
          </details>
          <details>
            <summary>¿Cómo se paga el {programa.nombre.replace(/^MaKo\s+/, '')}?</summary>
            <p>
              En {programa.cuotas} cuotas de US$ {Math.round(programa.precioUsd / programa.cuotas).toLocaleString('es-AR')}. Nos dejas tus datos,
              te escribimos por WhatsApp y lo hablamos en una llamada antes de empezar.
            </p>
          </details>
        </section>

        <p className="planes-pie">¿Ya tienes MaKo? Recomiéndalo y llévate el primer mes entero de cada negocio que traigas: <Link href="/mako-partners">MaKo Partners</Link></p>
      </div>
    </main>
  );
}

/**
 * «Compara los planes»: una fila por cosa y por tope, una columna por plan (lib/planes-comparacion.ts). La MISMA tabla en
 * /planes y en la landing de venta (29/10/2026, Martín: «en la landing no está la comparativa, la tabla»). En el teléfono,
 * cada fila con su nombre arriba y los tres valores abajo (`CSS_VITRINA`): no se corta ninguna columna.
 */
export function CompararPlanes({ planes, sufijo = '' }: { planes: readonly Pick<PlanEnTarjeta, 'id' | 'nombre' | 'capa' | 'destacado' | 'cobrable'>[]; sufijo?: string }) {
  const programa = PROGRAMA_ACELERADOR;
  const filas = filasDeComparacion();
  const grupos = [...new Set(filas.map((f) => f.grupo))];
  return (
    <section className="planes-compara" aria-labelledby="planes-compara-titulo">
      {/* Como el «Compare features» de beehiiv: el título y, arriba de cada columna, el plan con su botón. CON MOVIMIENTO (la llamada
          con Leila, 13/11/2026: «muy plana»): la cabecera queda pegada arriba al bajar, la columna de Pro va resaltada, cada grupo
          es una tarjeta que se abre suave, las tildes aparecen de a una al abrirlo y las filas entran al verse (estilo.ts). */}
      <div className="planes-compara-cab" style={{ '--n': planes.length + 1 } as CSSProperties}>
        <h2 id="planes-compara-titulo">Compara los planes</h2>
        {planes.map((p) => {
          const boton = botonDelPlan({ id: p.id, nombre: p.nombre, cobrable: p.cobrable, sufijo });
          return (
            <div key={p.id} className="planes-compara-plan" data-destacado={p.destacado ? '' : undefined}>
              {p.destacado ? <span className="planes-compara-reco">Recomendado</span> : null}
              <b><NombreColumna nombre={p.nombre} /></b>
              <a className={`planes-compara-btn${p.destacado ? ' azul' : ''}`} href={boton.href}>{p.destacado && planConPrueba(p.id) ? `${PRUEBA_DIAS} días gratis` : 'Empezar'}</a>
            </div>
          );
        })}
        <div className="planes-compara-plan">
          <b><NombreColumna nombre={programa.nombre} /></b>
          <a className="planes-compara-btn" href={`/planes/${programa.id}${sufijo}`}>Quiero el Acelerador</a>
        </div>
      </div>
      {grupos.map((g, i) => (
        // El primero abierto (lo que entra en cada plan); los demás se abren tocándolos. Sin JavaScript: <details>.
        <details key={g} className="planes-grupo-d" open={i === 0}>
          <summary>{g}<small className="planes-grupo-n">{filas.filter((f) => f.grupo === g).length}</small></summary>
          <table className="planes-tabla">
            <colgroup><col className="planes-col-que" />{planes.map((p) => <col key={p.id} />)}<col /></colgroup>
            <tbody>
              {filas.filter((f) => f.grupo === g).map((f, k) => (
                <tr key={f.que} style={{ '--i': k } as CSSProperties}>
                  <th scope="row">{f.que}</th>
                  {planes.map((p) => <td key={p.id} data-destacado={p.destacado ? '' : undefined}><CeldaPlan v={celdaDeCapa(f, p.capa)} /></td>)}
                  <td><CeldaPlan v={f.acelerador} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      ))}
    </section>
  );
}

/**
 * El encabezado de una columna. En el teléfono va sin «MaKo» delante: con el nombre entero la tabla no entraba y sólo se
 * veía la columna de Esencial (había que deslizar, sin saberlo, para descubrir Pro y el Acelerador).
 */
function NombreColumna({ nombre }: { nombre: string }) {
  const corto = nombre.replace(/^MaKo\s+/, '');
  return corto === nombre ? <>{nombre}</> : <><span className="planes-largo">{nombre}</span><span className="planes-corto">{corto}</span></>;
}

function CeldaPlan({ v }: { v: Celda | null }) {
  if (v === true) return <span className="planes-si" role="img" aria-label="Incluido"><svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg></span>;
  if (v === false) return <span className="planes-no" aria-label="No incluido">—</span>;
  return <>{v ?? ''}</>;
}
