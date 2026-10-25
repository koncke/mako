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
// =============================================================================

import type { ReactNode } from 'react';
import Link from 'next/link';
import { bajadaDePlanes } from '@/lib/compra-plan-reglas';
import { PROGRAMA_ACELERADOR, PRUEBA_DIAS, type PlanMako } from '@/lib/planes-mako';
import { filasDeComparacion, type Celda, type FilaComparacion } from '@/lib/planes-comparacion';
import { CSS_PLANES } from './estilo';
import { CSS_TARJETAS, TEXTO_PAGOS, TarjetasPlanes } from './Tarjetas';
import { TOPES_PRUEBA } from '@/lib/topes-plan';

const CSS_VITRINA = `
.planes-cabeza { text-align: center; max-width: 720px; margin: 0 auto 30px; }
.planes-cabeza h1 { margin: 10px 0 10px; font-size: 40px; line-height: 1.12; letter-spacing: -.03em; font-weight: 800; }
.planes-cabeza .planes-sub { margin: 0 auto; max-width: 600px; font-size: 17px; }
.planes-alta { margin: 12px 0 0; color: #5B6472; font-size: 14px; }
.planes-tabla tr.planes-grupo th { text-align: left; background: #F8F9FB; color: #5B6472; font-size: 12px; font-weight: 700; letter-spacing: .07em;
  text-transform: uppercase; padding-top: 16px; }
.planes-tabla thead th.programa { color: #142B66; }
.planes-faq { max-width: 760px; margin: 48px auto 0; display: grid; gap: 10px; }
.planes-faq h2 { margin: 0 0 8px; font-size: 22px; text-align: center; }
.planes-faq details { background: #fff; border: 1px solid #EAECF1; border-radius: 14px; padding: 0 18px; }
.planes-faq summary { cursor: pointer; list-style: none; padding: 16px 0; font-weight: 700; display: flex; justify-content: space-between; gap: 14px; }
.planes-faq summary::-webkit-details-marker { display: none; }
.planes-faq summary::after { content: "+"; color: #2F6FED; font-weight: 800; font-size: 20px; line-height: 1; }
.planes-faq details[open] summary::after { content: "−"; }
.planes-faq details p { margin: 0 0 16px; color: #4A5260; }
/* En el teléfono, cada fila con su nombre arriba a todo el ancho y los tres valores abajo (las páginas de precios en móvil):
   en una columna del 40% el nombre se partía en cinco renglones. */
@media (max-width: 600px) {
  .planes-cabeza h1 { font-size: 30px; }
  .planes-tabla, .planes-tabla thead, .planes-tabla tbody { display: block; }
  .planes-tabla tr { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .planes-tabla thead th:first-child { display: none; }
  .planes-tabla tr.planes-grupo { display: block; }
  .planes-tabla tr.planes-grupo th { display: block; padding: 14px 12px 8px; }
  .planes-tabla th[scope=row] { grid-column: 1 / -1; width: auto; padding: 12px 12px 2px; border-bottom: 0; font-weight: 600; }
  .planes-tabla td { padding: 6px 4px 12px; }
}
`;

export function VitrinaPlanes({ ofertas, sufijo }: {
  ofertas: ReadonlyArray<{ plan: PlanMako; cobrable: boolean }>;
  /** Lo que la URL trae y pasa tal cual al plan elegido (el origen y el código de partner). */
  sufijo: string;
}) {
  // LOS TRES BLOQUES (24/10/2026, Martín: «quiero ver los 3 bloques de pricing típicos que tiene toda app»): los dos planes
  // de software y, a la derecha, el programa con Martín, que nunca pasa por la pasarela: se pide, como el «hablar con
  // ventas» de cualquier SaaS (lib/planes-mako.ts, `PROGRAMA_ACELERADOR`). El ANUAL se muestra desde el 25/10 (el Cerebro) y
  // se PIDE, como el programa: el checkout cobra por mes, así que su botón deja el pedido (./Tarjetas.tsx).
  const programa = PROGRAMA_ACELERADOR;
  const filas = filasDeComparacion();
  const desde = Math.min(...ofertas.map((o) => o.plan.precioUsd));
  const barato = ofertas.find((o) => o.plan.precioUsd === desde)?.plan;
  const recomendado = ofertas.find((o) => o.plan.destacado)?.plan;
  const planes = ofertas.map(({ plan: p, cobrable }) => ({
    id: p.id, nombre: p.nombre, precioUsd: p.precioUsd, resumen: p.resumen, incluye: p.incluye, destacado: p.destacado,
    precioAnualUsd: p.precioAnualUsd ?? null, preciosLocales: p.preciosLocales, cobrable,
  }));
  const columnas = ofertas.length + 2;
  return (
    <main className="planes-root">
      <style dangerouslySetInnerHTML={{ __html: CSS_PLANES + CSS_TARJETAS + CSS_VITRINA }} />
      <div className="planes-wrap planes-ancho">
        <header className="planes-cabeza">
          <div className="planes-marca">MaKo</div>
          <h1>Elige cómo quieres crecer con MaKo</h1>
          <p className="planes-sub">
            {Number.isFinite(desde) ? `Úsalo por tu cuenta desde US$ ${desde.toLocaleString('es-AR')} por mes, o deja` : 'Úsalo por tu cuenta, o deja'} que
            te acompañemos a armar tu embudo y a vender.
          </p>
          <p className="planes-alta">{bajadaDePlanes(ofertas.some((o) => o.cobrable))}</p>
        </header>
        <TarjetasPlanes planes={planes} sufijo={sufijo} />

        <section className="planes-compara" aria-labelledby="planes-compara-titulo">
          <h2 id="planes-compara-titulo">Compara los planes</h2>
          <div className="planes-tabla-wrap">
            <table className="planes-tabla">
              <thead>
                <tr>
                  <th scope="col"><span className="planes-oculto">Qué incluye</span></th>
                  {ofertas.map(({ plan: p }) => <th key={p.id} scope="col" className={p.destacado ? 'destacado' : undefined}><NombreColumna nombre={p.nombre} /></th>)}
                  <th scope="col" className="programa"><NombreColumna nombre={programa.nombre} /></th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f, i) => (
                  <FilaConGrupo key={f.que} f={f} nuevoGrupo={i === 0 || filas[i - 1].grupo !== f.grupo} columnas={columnas}>
                    <th scope="row">{f.que}</th>
                    {ofertas.map(({ plan: p }) => <td key={p.id}><CeldaPlan v={celdaDe(f, p.capa)} /></td>)}
                    <td><CeldaPlan v={f.acelerador} /></td>
                  </FilaConGrupo>
                ))}
              </tbody>
            </table>
          </div>
        </section>

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
          <details>
            <summary>¿Cómo es la prueba gratis?</summary>
            <p>
              Tienes {PRUEBA_DIAS} días gratis con el plan que elijas. Pones tu tarjeta al empezar y no se te cobra nada hasta el
              día {PRUEBA_DIAS + 1}. Si te das de baja antes, desde «Tu plan», no se te cobra nada. Después del primer cobro, lo
              pagado no se devuelve. <Link href="/reembolsos">Las condiciones</Link>.
            </p>
            <p>
              En la prueba, lo que se crea con IA tiene tope: hasta {TOPES_PRUEBA['prueba.videos']} videos armados,{' '}
              {TOPES_PRUEBA['prueba.avatares']} video con avatar de IA, {TOPES_PRUEBA['prueba.imagenes']} imágenes y{' '}
              {TOPES_PRUEBA['web.landings_publicadas']} página publicada; exportar en masa se habilita con el primer cobro. El resto
              de MaKo (tu CRM, tus mensajes, tus automatizaciones y tu Plan) anda entero. Si quieres todo antes, empiezas tu plan
              cuando quieras.
            </p>
          </details>
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

        <p className="planes-pie">¿Ya tienes MaKo? Recomiéndalo y suma crédito por cada negocio que traigas: <Link href="/mako-partners">MaKo Partners</Link></p>
      </div>
    </main>
  );
}

/** Una fila de la tabla, con el rótulo de su grupo arriba cuando empieza uno nuevo (como el «Compare features» de Kajabi). */
function FilaConGrupo({ f, nuevoGrupo, columnas, children }: { f: FilaComparacion; nuevoGrupo: boolean; columnas: number; children: ReactNode }) {
  return (
    <>
      {nuevoGrupo && <tr className="planes-grupo"><th scope="colgroup" colSpan={columnas}>{f.grupo}</th></tr>}
      <tr>{children}</tr>
    </>
  );
}

/**
 * La columna de un plan en la tabla, por su CAPA y no por su id: los números salen de los topes de la capa
 * (lib/planes-comparacion.ts), así que un plan del setting `planes.mako` con otro id dice lo que su capa le da. Una capa
 * sin columna (pm), vacía: no se inventa.
 */
function celdaDe(f: FilaComparacion, capa: string): Celda | null {
  return capa === 'completo' ? f.esencial : capa === 'agencia' ? f.pro : null;
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
  if (v === true) return <span className="planes-si" aria-label="Incluido">✓</span>;
  if (v === false) return <span className="planes-no" aria-label="No incluido">—</span>;
  return <>{v ?? ''}</>;
}
