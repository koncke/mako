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
import { GRUPOS_DE_LA_TABLA, celdaDeCapa, filasDeComparacion, nombreCorto, type Celda, type FilaComparacion } from '@/lib/planes-comparacion';
import { CSS_PLANES } from './estilo';
import { CSS_TARJETAS, TarjetasPlanes, type PlanEnTarjeta } from './Tarjetas';
import { TOPES_PRUEBA } from '@/lib/topes-plan';

/** La hoja de la vitrina. La usa también la landing de venta, que dibuja la misma comparación (`CompararPlanes`). */
export const CSS_VITRINA = `
/* ── Compara los planes, como Attio (14/11/2026) ───────────────────────────────────────────────────────────────── */
.cp { margin-top: 72px; }
.cp-titulo { margin: 0 0 18px; font-size: 32px; line-height: 1.1; font-weight: 800; letter-spacing: -.02em; text-align: center; }
.cp-tabla { display: grid; grid-template-columns: minmax(0, 2fr) repeat(var(--cp-n, 3), minmax(0, 1fr)); }
.cp-cab, .cp-fila, .cp-pie, .cp-grupo, .cp-grupo-t { display: contents; }
.cp-cab > div { position: sticky; top: 0; z-index: 3; background: #fff; padding: 18px 12px 14px; border-bottom: 1px solid #E3E7EF; }
body:has(.s-barra) .cp-cab > div { top: 77px; }
.cp-cab-plan { display: grid; gap: 4px; align-content: end; position: relative; }
.cp-cab-plan b { font-size: 17px; font-weight: 700; color: #12151B; }
.cp-precio { font-size: 15px; font-weight: 700; color: #12151B; }
.cp-precio small { font-weight: 500; color: #5B6472; font-size: 13px; }
.cp-reco { justify-self: start; margin-bottom: 2px; padding: 2px 9px; border-radius: 999px; background: #2F6FED; color: #fff; font-size: 11px; font-weight: 700; letter-spacing: .02em; }
.cp-btn { display: block; margin-top: 6px; text-align: center; padding: 8px 10px; border-radius: 8px; background: #12151B; color: #fff !important; font-size: 13.5px; font-weight: 700; text-decoration: none; white-space: nowrap; transition: filter .15s ease, transform .15s ease; }
.cp-btn:hover { filter: brightness(1.12); transform: translateY(-1px); }
.cp-btn-azul { background: #2F6FED; }
/* La columna recomendada, resaltada de arriba abajo. */
.cp-tabla [data-destacado] { background: #F2F6FF; }
.cp-cab > div[data-destacado] { background: #F2F6FF; border-radius: 14px 14px 0 0; box-shadow: inset 1px 0 0 #D6E2FB, inset -1px 0 0 #D6E2FB, inset 0 1px 0 #D6E2FB; }
.cp-celda[data-destacado], .cp-pie > div[data-destacado] { box-shadow: inset 1px 0 0 #D6E2FB, inset -1px 0 0 #D6E2FB; }
.cp-pie > div[data-destacado] { border-radius: 0 0 14px 14px; box-shadow: inset 1px 0 0 #D6E2FB, inset -1px 0 0 #D6E2FB, inset 0 -1px 0 #D6E2FB; }
.cp-grupo-t > span { grid-column: 1 / -1; padding: 30px 12px 10px; font-size: 15px; font-weight: 800; color: #12151B; letter-spacing: -.01em; border-bottom: 1px solid #E3E7EF; }
.cp-que, .cp-celda { padding: 12px; border-bottom: 1px solid #EEF1F5; font-size: 14.5px; color: #12151B; display: flex; align-items: center; gap: 8px; }
.cp-celda { justify-content: flex-start; }
.cp-info { position: relative; display: inline-grid; place-items: center; width: 16px; height: 16px; border-radius: 999px; border: 1px solid #B9C1CE; color: #6B7280; font-size: 10px; font-weight: 700; font-style: italic; cursor: help; flex: none; }
.cp-info:hover::after, .cp-info:focus::after { content: attr(data-info); position: absolute; left: 22px; top: 50%; transform: translateY(-50%); z-index: 6; width: max-content; max-width: 280px; padding: 8px 10px; border-radius: 8px; background: #12151B; color: #fff; font-size: 12.5px; font-weight: 500; font-style: normal; line-height: 1.4; box-shadow: 0 10px 24px rgba(18,21,27,.25); }
.cp-pie > div { padding: 18px 12px; }
.cp-tel { display: none; }
@media (max-width: 899px) {
  .cp-tabla { display: none; }
  .cp-tel { display: grid; gap: 10px; }
  .cp-titulo { font-size: 26px; }
  .cp-tel-grupo { border: 1px solid #E3E7EF; border-radius: 14px; background: #fff; padding: 0 14px; }
  .cp-tel-grupo summary { cursor: pointer; list-style: none; padding: 16px 0; font-size: 16px; font-weight: 800; display: flex; justify-content: space-between; }
  .cp-tel-grupo summary::-webkit-details-marker { display: none; }
  .cp-tel-grupo summary::after { content: "+"; color: #2F6FED; font-size: 20px; line-height: 1; }
  .cp-tel-grupo[open] summary::after { content: "−"; }
  .cp-tel-grupo ul { list-style: none; margin: 0; padding: 0 0 8px; }
  .cp-tel-grupo li { padding: 10px 0; border-top: 1px solid #EEF1F5; display: grid; gap: 6px; }
  .cp-tel-grupo li b { font-size: 15px; font-weight: 600; color: #12151B; }
  .cp-tel-planes { display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: 13.5px; color: #4A5260; }
  .cp-tel-planes > span { display: inline-flex; align-items: center; gap: 5px; }
  .cp-tel-planes > span[data-destacado] { color: #2F6FED; font-weight: 700; }
}

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
export function CompararPlanes({ planes, sufijo = '' }: { planes: readonly Pick<PlanEnTarjeta, 'id' | 'nombre' | 'capa' | 'destacado' | 'cobrable' | 'precioUsd'>[]; sufijo?: string }) {
  const programa = PROGRAMA_ACELERADOR;
  const filas = filasDeComparacion();
  // LA TABLA COMO ATTIO (14/11/2026, Martín: «no me gusta para nada el diseño de comparar los planes. Fíjate alguna otra referencia…
  // tampoco se entiende bien los copies»; el molde y por qué, en las notas: referencias-comparar/tablas-de-planes.md). En la
  // computadora, UNA tabla abierta: la cabecera con cada plan, su precio y su botón queda fija al bajar; la columna recomendada va
  // resaltada de arriba abajo; los grupos, en el orden de lo que vende; cada fila con su nombre corto y la frase entera en el (i).
  // En el teléfono, un acordeón por grupo (el primero abierto) y, en cada fila, los tres planes en una línea.
  const cols = [
    ...planes.map((p) => {
      const boton = botonDelPlan({ id: p.id, nombre: p.nombre, cobrable: p.cobrable, sufijo });
      return { id: p.id, nombre: p.nombre, precio: `US$ ${p.precioUsd}`, periodo: 'por mes', destacado: !!p.destacado, href: boton.href,
        boton: planConPrueba(p.id) ? `${PRUEBA_DIAS} días gratis` : 'Empezar', celda: (f: FilaComparacion) => celdaDeCapa(f, p.capa) };
    }),
    { id: programa.id, nombre: programa.nombre, precio: `US$ ${programa.precioUsd.toLocaleString('es-AR')}`, periodo: `en ${programa.cuotas} cuotas`,
      destacado: false, href: `/planes/${programa.id}${sufijo}`, boton: 'Quiero el Acelerador', celda: (f: FilaComparacion) => f.acelerador as Celda | null },
  ];
  const grupos = GRUPOS_DE_LA_TABLA.map((g) => ({ titulo: g.titulo, filas: filas.filter((f) => g.de.includes(f.grupo)) })).filter((g) => g.filas.length);
  const corto = (n: string) => n.replace(/^MaKo\s+/, '');
  return (
    <section className="cp" aria-labelledby="cp-titulo" style={{ '--cp-n': cols.length } as CSSProperties}>
      <h2 id="cp-titulo" className="cp-titulo">Compara los planes</h2>
      {/* La computadora */}
      <div className="cp-tabla" role="table" aria-label="Compara los planes">
        <div className="cp-cab" role="row">
          <div className="cp-cab-que" role="columnheader" />
          {cols.map((c) => (
            <div key={c.id} className="cp-cab-plan" role="columnheader" data-destacado={c.destacado ? '' : undefined}>
              {c.destacado && <span className="cp-reco">Recomendado</span>}
              <b>{c.nombre}</b>
              <span className="cp-precio">{c.precio} <small>{c.periodo}</small></span>
              <a className={`cp-btn${c.destacado ? ' cp-btn-azul' : ''}`} href={c.href}>{c.boton}</a>
            </div>
          ))}
        </div>
        {grupos.map((g) => (
          <div key={g.titulo} className="cp-grupo" role="rowgroup">
            <div className="cp-grupo-t" role="row"><span role="rowheader">{g.titulo}</span></div>
            {g.filas.map((f) => (
              <div key={f.que} className="cp-fila" role="row">
                <div className="cp-que" role="rowheader">
                  {nombreCorto(f.que)}
                  {nombreCorto(f.que) !== f.que && <span className="cp-info" tabIndex={0} role="note" aria-label={f.que} data-info={f.que}>i</span>}
                </div>
                {cols.map((c) => <div key={c.id} className="cp-celda" role="cell" data-destacado={c.destacado ? '' : undefined}><CeldaPlan v={c.celda(f)} /></div>)}
              </div>
            ))}
          </div>
        ))}
        <div className="cp-pie" role="row">
          <div role="cell" />
          {cols.map((c) => <div key={c.id} role="cell" data-destacado={c.destacado ? '' : undefined}><a className={`cp-btn${c.destacado ? ' cp-btn-azul' : ''}`} href={c.href}>{c.boton}</a></div>)}
        </div>
      </div>
      {/* El teléfono: un acordeón por grupo, el primero abierto, sin JavaScript (<details>). */}
      <div className="cp-tel">
        {grupos.map((g, i) => (
          <details key={g.titulo} className="cp-tel-grupo" open={i === 0}>
            <summary>{g.titulo}</summary>
            <ul>
              {g.filas.map((f) => (
                <li key={f.que}>
                  <b>{nombreCorto(f.que)}</b>
                  <span className="cp-tel-planes">
                    {cols.map((c) => <span key={c.id} data-destacado={c.destacado ? '' : undefined}>{corto(c.nombre)} <CeldaPlan v={c.celda(f)} /></span>)}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </section>
  );
}

function CeldaPlan({ v }: { v: Celda | null }) {
  if (v === true) return <span className="planes-si" role="img" aria-label="Incluido"><svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg></span>;
  if (v === false) return <span className="planes-no" aria-label="No incluido">—</span>;
  return <>{v ?? ''}</>;
}
