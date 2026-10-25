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
// =============================================================================

import { MESES_GRATIS_ANUAL, PROGRAMA_ACELERADOR, PRUEBA_DIAS, precioEnPesos, textoDespuesDeLaPrueba, type PlanMako } from '@/lib/planes-mako';
import { botonAnualDelPlan, botonDelPlan } from '@/lib/compra-plan-reglas';
import { formatoMonto } from '@/lib/pasarela-moneda';

/** Un plan como lo dibujan las tarjetas, con si se cobra en línea. */
export type PlanEnTarjeta = Pick<PlanMako, 'id' | 'nombre' | 'precioUsd' | 'resumen' | 'incluye' | 'destacado' | 'precioAnualUsd' | 'preciosLocales'> & { cobrable: boolean };

export const TEXTO_PAGOS = 'Desde Argentina pagas en pesos, con Mercado Pago.';
/** La línea de abajo de las tarjetas: cómo es la prueba (también la lee el test contra /reembolsos). */
export const TEXTO_PRUEBA = `${PRUEBA_DIAS} días gratis con tu tarjeta: si te das de baja antes del día ${PRUEBA_DIAS + 1}, no se te cobra nada.`;

export const CEJA_SOFTWARE = 'Lo haces tú, con MaKo';
export const CEJA_PROGRAMA = 'Lo armamos contigo';

export const CSS_TARJETAS = `
.mkpl-grilla { display: grid; gap: 18px; grid-template-columns: repeat(3, minmax(0, 1fr)); padding-top: 14px; align-items: stretch; text-align: left; }
.mkpl-card { position: relative; display: flex; flex-direction: column; background: #FFFFFF; color: #12151B; border: 1px solid #E6EAF2;
  border-radius: 20px; padding: 28px 24px 24px; box-shadow: 0 1px 2px rgba(18,21,27,.04), 0 10px 28px rgba(18,21,27,.06); }
.mkpl-card.destacado { border-color: #2F6FED; box-shadow: 0 0 0 1px #2F6FED, 0 16px 40px rgba(47,111,237,.18); }
.mkpl-insignia { position: absolute; top: -13px; left: 24px; background: #2F6FED; color: #fff; font-size: 12px; font-weight: 700;
  letter-spacing: .03em; padding: 5px 12px; border-radius: 999px; }
.mkpl-ceja { font-size: 12px; font-weight: 700; letter-spacing: .07em; text-transform: uppercase; color: #5B6472; }
.mkpl-card h3 { margin: 6px 0 6px; font-size: 22px; line-height: 1.2; font-weight: 800; letter-spacing: -.01em; color: inherit; }
.mkpl-resumen { margin: 0 0 16px; color: #4A5260; font-size: 15px; line-height: 1.5; min-height: 68px; }
.mkpl-precio { font-size: 40px; line-height: 1; font-weight: 800; letter-spacing: -.03em; }
.mkpl-precio small { font-size: 15px; font-weight: 500; letter-spacing: 0; color: #5B6472; }
.mkpl-cuotas { margin: 6px 0 0; color: #5B6472; font-size: 14px; }
.mkpl-btn { display: block; text-align: center; margin: 20px 0 22px; background: #2F6FED; color: #fff !important; text-decoration: none;
  font-weight: 700; font-size: 15px; padding: 14px 20px; border-radius: 12px; box-shadow: 0 6px 18px rgba(47,111,237,.24); }
.mkpl-btn.borde { background: #fff; color: #2F6FED !important; box-shadow: inset 0 0 0 1.5px #2F6FED; }
.mkpl-lista { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; font-size: 14.5px; line-height: 1.45; }
.mkpl-lista li { display: flex; gap: 10px; align-items: flex-start; }
.mkpl-lista li::before { content: "✓"; flex: none; width: 20px; height: 20px; border-radius: 50%; display: inline-flex; align-items: center;
  justify-content: center; font-size: 12px; font-weight: 800; color: #1F7A4D; background: #E3F5EB; margin-top: 1px; }
.mkpl-programa { background: radial-gradient(700px 320px at 100% 0%, rgba(122,162,255,.28), transparent 60%), linear-gradient(160deg, #142B66 0%, #0B1735 100%);
  color: #F3F6FF; border-color: #1E3A80; box-shadow: 0 22px 54px rgba(11,23,53,.34); }
.mkpl-programa .mkpl-insignia { background: #F5C451; color: #2A1E00; }
.mkpl-programa .mkpl-ceja { color: #F5C451; }
.mkpl-programa .mkpl-resumen, .mkpl-programa .mkpl-cuotas, .mkpl-programa .mkpl-precio small { color: #C9D3EE; }
.mkpl-programa .mkpl-btn { background: #F5C451; color: #2A1E00 !important; box-shadow: 0 8px 22px rgba(245,196,81,.28); }
.mkpl-programa .mkpl-lista li::before { color: #2A1E00; background: #F5C451; }
.mkpl-promesa { margin: 18px 0 0; padding: 14px 16px; border-radius: 14px; background: rgba(245,196,81,.12); border: 1px solid rgba(245,196,81,.45);
  font-size: 14.5px; line-height: 1.45; }
.mkpl-promesa b { color: #F5C451; }
.mkpl-garantia { margin: -10px 0 20px; font-size: 13.5px; line-height: 1.45; color: #4A5260; }
.mkpl-garantia b { color: #12151B; }
.mkpl-garantia a { color: inherit; text-decoration: underline; text-underline-offset: 2px; }
.mkpl-programa .mkpl-garantia { color: #C9D3EE; }
.mkpl-programa .mkpl-garantia b { color: #F3F6FF; }
/* Mensual o anual: dos radios (escondidos) y sus etiquetas como un selector; :has() muestra los precios del que está
   elegido. Sin :has(), se ven los dos: nunca queda una tarjeta sin precio. */
.mkpl-periodo { display: flex; justify-content: center; margin: 0 0 22px; }
.mkpl-periodo-caja { display: inline-flex; gap: 4px; padding: 4px; border-radius: 999px; background: #E9EDF5; }
.mkpl-periodo input { position: absolute; opacity: 0; width: 1px; height: 1px; pointer-events: none; }
.mkpl-periodo label { cursor: pointer; padding: 9px 18px; border-radius: 999px; font-size: 14.5px; font-weight: 700; color: #4A5260; }
.mkpl-periodo label b { margin-left: 6px; padding: 2px 8px; border-radius: 999px; background: #E3F5EB; color: #1F7A4D; font-size: 12px; }
.mkpl-periodo input:checked + label { background: #FFFFFF; color: #12151B; box-shadow: 0 1px 3px rgba(18,21,27,.14); }
.mkpl-periodo input:focus-visible + label { outline: 2px solid #2F6FED; outline-offset: 2px; }
.mkpl-bloques:has(#mkpl-p-anual:checked) .mkpl-mes { display: none; }
.mkpl-bloques:has(#mkpl-p-mes:checked) .mkpl-anual { display: none; }
.mkpl-pagos { margin: 22px 0 0; text-align: center; color: #4A5260; font-size: 14.5px; }
.mkpl-gratis { display: inline-block; margin: 0 0 10px; padding: 3px 10px; border-radius: 999px; background: #E3F5EB; color: #1F7A4D;
  font-size: 12.5px; font-weight: 800; letter-spacing: .02em; }
.mkpl-pagos b { color: #12151B; }
.mkpl-despues { margin: 18px 0 0; padding-top: 14px; border-top: 1px solid rgba(255,255,255,.14); font-size: 13.5px; color: #C9D3EE; }
@media (max-width: 900px) {
  .mkpl-grilla { grid-template-columns: 1fr; gap: 26px; }
  .mkpl-resumen { min-height: 0; }
}
`;

const precio = (n: number) => n.toLocaleString('es-AR');

export function TarjetasPlanes({ planes, sufijo }: { planes: readonly PlanEnTarjeta[]; sufijo: string }) {
  const pr = PROGRAMA_ACELERADOR;
  // El selector, sólo si TODOS los planes tienen anual: uno sin anual quedaría sin precio al elegirlo.
  const conAnual = planes.length > 0 && planes.every((p) => !!p.precioAnualUsd);
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
        return (
          <section key={p.id} className={`mkpl-card${p.destacado ? ' destacado' : ''}`}>
            {p.destacado && <span className="mkpl-insignia">Recomendado</span>}
            <div className="mkpl-ceja">{CEJA_SOFTWARE}</div>
            <h3>{p.nombre}</h3>
            {p.resumen && <p className="mkpl-resumen">{p.resumen}</p>}
            <span className="mkpl-gratis">{PRUEBA_DIAS} días gratis</span>
            <div className="mkpl-mes">
              <div className="mkpl-precio">US$ {precio(p.precioUsd)} <small>/ mes</small></div>
              {pesos && <div className="mkpl-cuotas">o {formatoMonto(pesos, 'ARS')} por mes</div>}
              <a className={borde} href={boton.href}>{boton.texto}</a>
              <p className="mkpl-garantia">{textoDespuesDeLaPrueba(p.precioUsd, 'mes')}</p>
            </div>
            {conAnual && p.precioAnualUsd && (
              <div className="mkpl-anual">
                <div className="mkpl-precio">US$ {precio(p.precioAnualUsd)} <small>/ año</small></div>
                <div className="mkpl-cuotas">Pagas una vez al año: {MESES_GRATIS_ANUAL} meses gratis.</div>
                <a className={borde} href={botonAnualDelPlan({ id: p.id, sufijo }).href}>{botonAnualDelPlan({ id: p.id, sufijo }).texto}</a>
                <p className="mkpl-garantia">{textoDespuesDeLaPrueba(p.precioAnualUsd, 'año')}</p>
              </div>
            )}
            {p.incluye.length > 0 && <ul className="mkpl-lista">{p.incluye.map((x) => <li key={x}>{x}</li>)}</ul>}
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
        <ul className="mkpl-lista">{pr.incluye.map((x) => <li key={x}>{x}</li>)}</ul>
        <p className="mkpl-despues">Al terminar, si quieres seguir: {pr.despues.nombre}, US$ {precio(pr.despues.precioUsd)} por mes, con MaKo Pro y la asesoría de cada semana.</p>
      </section>
      </div>
      <p className="mkpl-pagos"><b>{TEXTO_PAGOS}</b> {TEXTO_PRUEBA} <a href="/reembolsos">Ver condiciones</a></p>
    </div>
  );
}
