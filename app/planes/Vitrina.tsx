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
import { PREGUNTAS_SITIO } from '@/app/vsl/_sitio/datos';
import { botonDelPlan } from '@/lib/compra-plan-reglas';
import { PROGRAMA_ACELERADOR, PRUEBA_DIAS, planConPrueba, type PlanMako } from '@/lib/planes-mako';
import { celdaDeCapa, filasDeComparacion, type Celda } from '@/lib/planes-comparacion';
import { CSS_PLANES } from './estilo';
import { CSS_TARJETAS, TarjetasPlanes, type PlanEnTarjeta } from './Tarjetas';
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
          {/* El título y el subtítulo de la portada, tal cual (Martín, 14/11/2026: «en precios, el título tiene que ser el mismo título que
              la landing principal y el mismo subtítulo también. Y elimina el subtítulo de subtítulo, eso no tiene sentido»). */}
          <h1>El mejor software para vender <em>High Ticket.</em></h1>
          <p className="planes-sub"><strong>Marketing, ventas y entrega del servicio en una sola app.</strong> Con una IA que conoce tu negocio, desde que alguien te descubre hasta que es tu cliente y le entregas lo que compró.</p>
        </header>
        <TarjetasPlanes planes={planes} sufijo={sufijo} promoVigente={promoVigente} />

        <CompararPlanes planes={planes} sufijo={sufijo} />

        {/* LAS MISMAS PREGUNTAS DE LA PORTADA (Martín, 14/11/2026: «si vas a poner en otros lugares preguntas frecuentes, tienen que ser
            siempre las mismas que están en la landing principal»): PREGUNTAS_SITIO, app/vsl/_sitio/datos.ts. */}
        <section className="planes-faq" aria-labelledby="planes-faq-titulo">
          <h2 id="planes-faq-titulo">Preguntas frecuentes</h2>
          {PREGUNTAS_SITIO.map((q, i) => (
            <details key={q.p} open={i === 0}>
              <summary>{q.p}</summary>
              <p>{q.r}</p>
            </details>
          ))}
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
