// =============================================================================
// TarjetasPlanes — los tres bloques de precios, LOS MISMOS en /planes y en la landing de venta (24/10/2026, noche)
// =============================================================================
// Martín, 24/10: «La sección de planes no se entiende para nada... Lo hiciste con lenguaje interno... Tienes que VENDER,
// Revisa como lo hacen otras paginas... Y sobre todo el acompañamiento debe tener mas beneficios y verse diferencial, porque
// sino no tiene sentido. El personalizado tiene que tener un factor de PROMESA de resultados, ya no solo software».
//
// COPIADO DE (mirados el 24/10): ClickFunnels (clickfunnels.com/pricing) — el escalón de arriba en un bloque OSCURO, distinto
// de los de software, y el botón arriba de la lista, debajo del precio; Kajabi (kajabi.com/pricing) — una frase por plan que
// dice para qué ETAPA del negocio es, y lo que incluye dicho como lo que la persona consigue. Además, arriba de cada nombre,
// cómo se trabaja: «Lo haces tú, con MaKo» o «Lo armamos contigo»: lo que separa al software del acompañamiento.
//
// Los datos: los planes (lib/planes-mako.ts, con si se cobran en línea: `ofertasDeLosPlanes` / `planesParaLanding`) y el
// programa (`PROGRAMA_ACELERADOR`). El botón de cada plan, la regla de siempre (`botonDelPlan`: «Empezar» sólo con un cobro
// detrás). El programa SIEMPRE se pide (nunca pasa por la pasarela). Su promesa (un resultado con plazo) va arriba del
// botón, y su garantía (sobre los entregables) abajo, con el link a las condiciones: sin una, no se dibuja. Sin hooks ni datos: la usan una página del servidor (/planes) y un portal del cliente (la landing).
// Las clases llevan `mkpl-`: adentro de una landing del Web Generator conviven con el CSS de ese diseño, y un nombre
// genérico («card», «btn») se pisa con el suyo.
//
// MENSUAL O ANUAL (25/10/2026, el Cerebro: «el anual son 2 meses gratis»): el selector de arriba, como el de toda página de
// precios, hecho con dos radios y `:has()` (sin JavaScript: anda igual en /planes, que es del servidor, y en el portal de la
// landing). El anual SIEMPRE se pide (`botonAnualDelPlan`): el checkout cobra por mes. Junto al precio, «7 días gratis», y
// debajo de cada botón cuánto se cobra después y hasta cuándo se cancela sin pagar (`PRUEBA_DIAS`, lo mismo que /reembolsos
// §1: desde el 25/10 la prueba reemplaza a la garantía de 14/30 días). Abajo de todo, que desde Argentina se paga en pesos
// con Mercado Pago. Un precio en pesos sólo si el plan lo tiene (`precioEnPesos`): nunca con una tasa.
//
// EL REDISEÑO DEL 12/11/2026 (Martín: «rediseñes los tres bloques de los planes… tienen muchos ítems y puedes fijarte cómo lo
// hace el diseño de otras aplicaciones»). COPIADO DE beehiiv (beehiiv.com/pricing, mirada el 12/11/2026, la misma referencia
// del sitio): tarjetas blancas iguales, el nombre y su frase, el precio grande con su nota chica, UN botón a todo el ancho con
// una nota debajo (su «No credit card required»: aquí, cuándo se paga), una raya y la lista corta, con «Todo lo de Esencial,
// más:» en la del medio. Lo que un plan NO trae ya no va en la tarjeta (eran 8 renglones con ✗): lo dice la comparación.
// La insignia («Recomendado», «Con acompañamiento») arriba a la derecha, negra, como su «Most Popular». El Acelerador deja de
// ser un bloque oscuro: el sol y la luna del sitio llevan la página entera a un solo modo (app/vsl/_competencia/TemaSitio.tsx),
// y un bloque negro en el modo claro es lo que Martín pidió sacar. Se distingue por su insignia y su botón negro.
// LA PRUEBA, SÓLO EN PRO (12/11/2026): `planConPrueba` (lib/planes-mako.ts). Esencial dice que se paga hoy.
// =============================================================================

import { MESES_GRATIS_ANUAL, NOMBRE_PLAN_CON_PRUEBA, PROGRAMA_ACELERADOR, PRUEBA_DIAS, PRUEBA_GRATIS_PRENDIDA, planConPrueba, precioEnPesos, type PlanMako } from '@/lib/planes-mako';
import { botonAnualDelPlan, botonDelPlan } from '@/lib/compra-plan-reglas';
import { formatoMonto } from '@/lib/pasarela-moneda';
import { PROMO_ENTRADA, precioPrimerMes, textoUsd } from '@/lib/promo-entrada-reglas';

/** Un plan como lo dibujan las tarjetas, con si se cobra en línea. La capa dice lo que NO trae (la comparación). */
export type PlanEnTarjeta = Pick<PlanMako, 'id' | 'nombre' | 'capa' | 'precioUsd' | 'resumen' | 'incluye' | 'destacado' | 'precioAnualUsd' | 'preciosLocales'> & { cobrable: boolean };

export const TEXTO_PAGOS = 'Desde Argentina pagas en pesos, con Mercado Pago.';
/** La línea de abajo de las tarjetas: cómo es la prueba (sólo de Pro desde el 12/11/2026). */
export const TEXTO_PRUEBA = PRUEBA_GRATIS_PRENDIDA
  ? `${NOMBRE_PLAN_CON_PRUEBA} empieza con ${PRUEBA_DIAS} días gratis: si te das de baja antes del día ${PRUEBA_DIAS + 1}, no se te cobra nada. Esencial se paga al empezar.`
  : 'Pagas al empezar y te das de baja cuando quieras.';

export const CEJA_SOFTWARE = 'Lo haces tú, con MaKo';
export const CEJA_PROGRAMA = 'Lo armamos contigo';

/** La nota de debajo del botón (el «No credit card required» de beehiiv): cuándo se paga. */
export function notaDelBoton(p: { id: string; cobrable: boolean }, anual = false): string {
  if (anual || !p.cobrable) return 'Te escribimos por WhatsApp para darte de alta.';
  return planConPrueba(p.id) ? `Hoy no pagas nada. El primer cobro es el día ${PRUEBA_DIAS + 1}.` : 'Pagas hoy y cancelas cuando quieras.';
}

/**
 * La lista de un plan como la de beehiiv: si su primer renglón es «Todo lo de Esencial, sin tope de…», ése es el título («Todo lo
 * de Esencial, más:») y el resto del renglón pasa a la lista. Sale de `incluye` (lib/planes-mako.ts o el setting `planes.mako`).
 */
export function listaDelPlan(incluye: readonly string[]): { titulo: string; items: string[] } {
  const m = /^Todo lo de ([^,]+),\s*(.+)$/.exec(incluye[0] ?? '');
  if (!m) return { titulo: 'Incluye:', items: [...incluye] };
  return { titulo: `Todo lo de ${m[1]}, más:`, items: [m[2].charAt(0).toUpperCase() + m[2].slice(1), ...incluye.slice(1)] };
}

export const CSS_TARJETAS = `
.mkpl-grilla { display: grid; gap: 16px; grid-template-columns: repeat(3, minmax(0, 1fr)); align-items: stretch; text-align: left; }
.mkpl-card { position: relative; display: flex; flex-direction: column; background: #FFFFFF; color: #12151B; border: 1px solid #E3E7EF;
  border-radius: 12px; padding: 20px; }
.mkpl-card.destacado { border: 2px solid #2F6FED; padding: 19px; }
.mkpl-insignia { position: absolute; top: 18px; right: 18px; background: #12151B; color: #fff; font-size: 12px; line-height: 16px; font-weight: 600;
  padding: 4px 8px; border-radius: 999px; }
.mkpl-ceja { font-size: 11px; line-height: 16px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: #6B7280; padding-right: 130px; }
.mkpl-card h3 { margin: 4px 0 0; font-size: 24px; line-height: 32px; font-weight: 600; letter-spacing: -.01em; color: inherit; }
.mkpl-resumen { margin: 4px 0 0; color: #4A5260; font-size: 14px; line-height: 20px; min-height: 40px; }
.mkpl-gratis { display: inline-block; align-self: flex-start; margin: 20px 0 0; padding: 2px 8px; border-radius: 999px; background: #E3F5EB; color: #1F7A4D;
  font-size: 12px; line-height: 18px; font-weight: 700; }
.mkpl-precio { margin-top: 28px; font-size: 48px; line-height: 1; font-weight: 600; letter-spacing: -.03em; }
.mkpl-gratis + .mkpl-mes .mkpl-precio, .mkpl-gratis + .mkpl-precio { margin-top: 8px; }
.mkpl-precio small { font-size: 18px; font-weight: 400; letter-spacing: 0; color: #12151B; }
.mkpl-cuotas { margin: 6px 0 0; color: #4A5260; font-size: 12px; line-height: 16px; }
.mkpl-btn { display: block; text-align: center; margin: 24px 0 0; background: #2F6FED; color: #fff !important; text-decoration: none;
  font-weight: 600; font-size: 16px; line-height: 24px; padding: 10px 16px; border-radius: 6px; transition: filter .15s ease; }
.mkpl-btn:hover { filter: brightness(1.08); }
.mkpl-btn.borde { background: #fff; color: #2F6FED !important; box-shadow: inset 0 0 0 1px #2F6FED; }
.mkpl-nota { margin: 8px 0 0; text-align: center; font-size: 12px; line-height: 16px; color: #6B7280; }
.mkpl-hr { height: 1px; background: #E3E7EF; margin: 16px 0; }
.mkpl-lista-t { margin: 0 0 6px; font-size: 14px; line-height: 20px; font-weight: 600; color: #12151B; }
.mkpl-lista { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; font-size: 14px; line-height: 20px; color: #4A5260; }
/* El Acelerador: la misma tarjeta, con su insignia y el botón negro (el «Contact sales» de beehiiv). */
.mkpl-programa .mkpl-btn { background: #12151B; }
.mkpl-promesa { margin: 16px 0 0; padding: 10px 12px; border-radius: 8px; background: #FFF8E6; border-left: 3px solid #F2B01E;
  font-size: 13px; line-height: 18px; color: #4A5260; }
.mkpl-promesa b { color: #12151B; }
.mkpl-garantia { margin: 8px 0 0; font-size: 12px; line-height: 16px; color: #6B7280; text-align: center; }
.mkpl-garantia b { color: #4A5260; }
.mkpl-garantia a { color: inherit; text-decoration: underline; text-underline-offset: 2px; }
/* Mensual o anual: dos radios (escondidos) y sus etiquetas como un selector; :has() muestra los precios del que está
   elegido. Sin :has(), se ven los dos: nunca queda una tarjeta sin precio. */
.mkpl-periodo { display: flex; justify-content: center; margin: 0 0 24px; }
.mkpl-periodo-caja { display: inline-flex; gap: 4px; padding: 4px; border-radius: 999px; background: #EEF1F6; }
.mkpl-periodo input { position: absolute; opacity: 0; width: 1px; height: 1px; pointer-events: none; }
.mkpl-periodo label { cursor: pointer; padding: 8px 16px; border-radius: 999px; font-size: 14px; font-weight: 600; color: #4A5260; }
.mkpl-periodo label b { margin-left: 6px; padding: 2px 8px; border-radius: 999px; background: #E3F5EB; color: #1F7A4D; font-size: 12px; }
.mkpl-periodo input:checked + label { background: #FFFFFF; color: #12151B; box-shadow: 0 1px 3px rgba(18,21,27,.14); }
.mkpl-periodo input:focus-visible + label { outline: 2px solid #2F6FED; outline-offset: 2px; }
.mkpl-bloques:has(#mkpl-p-anual:checked) .mkpl-mes { display: none; }
.mkpl-bloques:has(#mkpl-p-mes:checked) .mkpl-anual { display: none; }
.mkpl-primer-mes { margin: 8px 0 0; padding: 8px 10px; border-radius: 8px; background: #FFF8DB; color: #4A5260; font-size: 13px; line-height: 1.4; }
.mkpl-primer-mes b { display: block; color: #12151B; font-size: 14px; }
.mkpl-pagos { margin: 20px 0 0; text-align: center; color: #4A5260; font-size: 14px; line-height: 20px; }
.mkpl-pagos b { color: #12151B; }
@media (max-width: 900px) {
  .mkpl-grilla { grid-template-columns: 1fr; gap: 16px; }
  .mkpl-resumen { min-height: 0; }
}
`;

const precio = (n: number) => n.toLocaleString('es-AR');

export function TarjetasPlanes({ planes, sufijo, promoVigente = false }: {
  planes: readonly PlanEnTarjeta[]; sufijo: string;
  /** El reloj del 50% sigue vivo en este navegador: cada plan del cartel dice lo que sale su primer mes. Después, el precio de siempre. */
  promoVigente?: boolean;
}) {
  const pr = PROGRAMA_ACELERADOR;
  // El selector, sólo si TODOS los planes tienen anual: uno sin anual quedaría sin precio al elegirlo.
  const conAnual = planes.length > 0 && planes.every((p) => !!p.precioAnualUsd);
  const pro = planes.find((p) => p.destacado) ?? planes[planes.length - 1];
  return (
    <div className="mkpl-bloques">
      {conAnual && (
        <div className="mkpl-periodo">
          <div className="mkpl-periodo-caja" role="radiogroup" aria-label="Cómo pagas">
            <input type="radio" name="mkpl-periodo" id="mkpl-p-mes" defaultChecked />
            <label htmlFor="mkpl-p-mes">Mensual</label>
            <input type="radio" name="mkpl-periodo" id="mkpl-p-anual" />
            <label htmlFor="mkpl-p-anual">Anual<b>{MESES_GRATIS_ANUAL} meses gratis</b></label>
          </div>
        </div>
      )}
      <div className="mkpl-grilla">
      {planes.map((p) => {
        // El mismo botón en /planes y en la landing: «Empezar» sólo con un cobro detrás; sin pasarela, «Quiero …» y se pide.
        const boton = botonDelPlan({ id: p.id, nombre: p.nombre, cobrable: p.cobrable, sufijo });
        const borde = `mkpl-btn${p.destacado ? '' : ' borde'}`;
        const pesos = precioEnPesos(p);
        const lista = listaDelPlan(p.incluye);
        return (
          <section key={p.id} className={`mkpl-card${p.destacado ? ' destacado' : ''}`}>
            {p.destacado && <span className="mkpl-insignia">Recomendado</span>}
            <div className="mkpl-ceja">{CEJA_SOFTWARE}</div>
            <h3>{p.nombre}</h3>
            {p.resumen && <p className="mkpl-resumen">{p.resumen}</p>}
            {planConPrueba(p.id) && <span className="mkpl-gratis">{PRUEBA_DIAS} días gratis</span>}
            <div className="mkpl-mes">
              <div className="mkpl-precio">US$ {precio(p.precioUsd)} <small>/ mes</small></div>
              {pesos && <div className="mkpl-cuotas">o {formatoMonto(pesos, 'ARS')} por mes</div>}
              {promoVigente && PROMO_ENTRADA.planes.includes(p.id) && (
                <div className="mkpl-primer-mes"><b>Tu primer mes: US$ {textoUsd(precioPrimerMes(p.precioUsd))}</b> Después, el precio de siempre.</div>
              )}
              <a className={borde} href={boton.href}>{boton.texto}</a>
              <p className="mkpl-nota">{notaDelBoton(p)}</p>
            </div>
            {conAnual && p.precioAnualUsd && (
              <div className="mkpl-anual">
                <div className="mkpl-precio">US$ {precio(p.precioAnualUsd)} <small>/ año</small></div>
                <div className="mkpl-cuotas">Pagas una vez al año: {MESES_GRATIS_ANUAL} meses gratis.</div>
                <a className={borde} href={botonAnualDelPlan({ id: p.id, sufijo }).href}>{botonAnualDelPlan({ id: p.id, sufijo }).texto}</a>
                <p className="mkpl-nota">{notaDelBoton(p, true)}</p>
              </div>
            )}
            <div className="mkpl-hr" />
            <p className="mkpl-lista-t">{lista.titulo}</p>
            <ul className="mkpl-lista">{lista.items.map((x) => <li key={x}>{x}</li>)}</ul>
          </section>
        );
      })}
      <section className="mkpl-card mkpl-programa">
        <span className="mkpl-insignia">Con acompañamiento</span>
        <div className="mkpl-ceja">{CEJA_PROGRAMA}</div>
        <h3>{pr.nombre}</h3>
        <p className="mkpl-resumen">{pr.resumen}</p>
        <div className="mkpl-precio">US$ {precio(pr.precioUsd)}</div>
        <div className="mkpl-cuotas">en {pr.cuotas} cuotas de US$ {precio(Math.round(pr.precioUsd / pr.cuotas))}</div>
        {pr.promesa && <p className="mkpl-promesa"><b>Nuestra promesa:</b> {pr.promesa}</p>}
        <a className="mkpl-btn" href={`/planes/${pr.id}${sufijo}`}>Quiero el Acelerador</a>
        {pr.garantia && <p className="mkpl-garantia"><b>Garantía de entrega:</b> {pr.garantia} <a href="/reembolsos#grupal">Ver condiciones</a></p>}
        <div className="mkpl-hr" />
        <p className="mkpl-lista-t">Todo lo de {pro?.nombre ?? 'MaKo Pro'} los {pr.cuotas} meses, más:</p>
        <ul className="mkpl-lista">{pr.incluye.map((x) => <li key={x}>{x}</li>)}</ul>
      </section>
      </div>
      <p className="mkpl-pagos"><b>{TEXTO_PAGOS}</b> {TEXTO_PRUEBA} <a href="/reembolsos">Ver condiciones</a></p>
    </div>
  );
}
