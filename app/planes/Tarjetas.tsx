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
// LA TERCERA VUELTA (12/11/2026, noche, Martín: «no pongas tanto texto… los botones… todos tienen que estar alineados… me
// gustaban los colores de las tarjetas anteriores, el Acelerador estaba negro»): listas cortas (`listaCorta`), sin notas debajo
// de los botones ni la línea de pagos, filas comunes con subgrid y los colores de antes (el azul de Pro, el Acelerador grafito).
// =============================================================================

import { ASESORIAS_DEL_PROGRAMA, MESES_GRATIS_ANUAL, NOMBRE_PLAN_CON_PRUEBA, PROGRAMA_ACELERADOR, PRUEBA_DIAS, PRUEBA_GRATIS_PRENDIDA, planConPrueba, precioEnPesos, type PlanMako } from '@/lib/planes-mako';
import { TOPES } from '@/lib/topes-plan';
import { botonAnualDelPlan, botonDelPlan } from '@/lib/compra-plan-reglas';
import { formatoMonto } from '@/lib/pasarela-moneda';
import { PROMO_ENTRADA, precioPrimerMes, textoUsd } from '@/lib/promo-entrada-reglas';

/** Un plan como lo dibujan las tarjetas, con si se cobra en línea. La capa dice lo que NO trae (la comparación). */
export type PlanEnTarjeta = Pick<PlanMako, 'id' | 'nombre' | 'capa' | 'precioUsd' | 'resumen' | 'incluye' | 'destacado' | 'precioAnualUsd' | 'preciosLocales'> & { cobrable: boolean };

export const TEXTO_PAGOS = 'Desde Argentina pagas en pesos, con Mercado Pago.';
/** La línea de la prueba, para quien la necesite fuera de las tarjetas (las tarjetas ya no la repiten abajo). */
export const TEXTO_PRUEBA = PRUEBA_GRATIS_PRENDIDA
  ? `${NOMBRE_PLAN_CON_PRUEBA} empieza con ${PRUEBA_DIAS} días gratis: si te das de baja antes del día ${PRUEBA_DIAS + 1}, no se te cobra nada.`
  : 'Pagas al empezar y te das de baja cuando quieras.';

export const CEJA_SOFTWARE = 'Lo haces tú, con MaKo';
export const CEJA_PROGRAMA = 'Lo armamos contigo';

const n = (v: number | null) => (v == null ? 'sin tope' : v.toLocaleString('es-AR'));

/**
 * LAS LISTAS CORTAS (12/11/2026, noche, Martín: «no pongas tanto texto… fíjate cómo lo hacen otras aplicaciones… es
 * sobresaturación de información»). Como beehiiv: renglones de 2 a 6 palabras. Los números salen de los topes del código
 * (lib/topes-plan.ts), por CAPA, así un plan del setting `planes.mako` con otro id dice lo que su capa le da. Lo largo (qué es
 * cada cosa, lo que no trae) está en «Compara los planes».
 */
export function listaCorta(capa: string): { titulo: string; items: string[] } {
  const c = TOPES.completo, a = TOPES.agencia;
  if (capa === 'agencia') {
    return { titulo: 'Todo lo de Esencial, más:', items: [
      'Contactos, páginas y seguimientos sin tope',
      'MaKo aplica las mejoras de tus anuncios',
      'Qué mejorar en cada llamada de venta',
      'Editor de video y de imágenes',
      `${n(a['chats.lineas_whatsapp'])} WhatsApp y ${n(a['equipo.usuarios'])} personas de tu equipo`,
    ] };
  }
  return { titulo: 'Incluye:', items: [
    'Tu asistente con IA',
    `Hasta ${n(c['crm.leads'])} contactos`,
    `${n(c['chats.lineas_whatsapp'])} WhatsApp e Instagram`,
    `${n(c['automations.activas'])} seguimientos automáticos`,
    `${n(c['web.landings_publicadas'])} páginas de venta`,
  ] };
}

/** La lista corta del Acelerador: lo que suma a MaKo Pro (el detalle de cada entregable, en /reembolsos §2). */
export const LISTA_PROGRAMA: readonly string[] = [
  'Todo armado la primera semana',
  `${ASESORIAS_DEL_PROGRAMA} asesorías en vivo con Martín`,
  'Plantillas probadas',
  'Un grupo de WhatsApp con Martín',
];

/** Debajo del precio, una sola cosa: los días gratis, que se paga hoy, o las cuotas. */
export function bajoElPrecio(p: { id: string }): string {
  return planConPrueba(p.id) ? `${PRUEBA_DIAS} días gratis` : 'Se paga al empezar';
}

export const CSS_TARJETAS = `
/* LOS BOTONES ALINEADOS (12/11/2026, Martín: «todos tienen que estar alineados… no puede estar uno más arriba, otro más abajo»):
   cada tarjeta tiene las MISMAS filas (nombre, frase, precio, botón, lista) y con subgrid el alto de cada fila lo pone la más
   alta de las tres. Los colores, los de antes (Martín: «me gustaban los colores… el Acelerador estaba negro»). */
.mkpl-grilla { display: grid; gap: 18px; grid-template-columns: repeat(3, minmax(0, 1fr)); grid-template-rows: repeat(5, auto); padding-top: 14px; align-items: stretch; text-align: left; }
.mkpl-card { position: relative; display: grid; grid-row: span 5; grid-template-rows: subgrid; row-gap: 0; background: #FFFFFF; color: #12151B;
  border: 1px solid #E6EAF2; border-radius: 20px; padding: 26px 24px 24px; box-shadow: 0 1px 2px rgba(18,21,27,.04), 0 10px 28px rgba(18,21,27,.06); }
.mkpl-card.destacado { border-color: #2F6FED; box-shadow: 0 0 0 1px #2F6FED, 0 16px 40px rgba(47,111,237,.18); }
.mkpl-insignia { position: absolute; top: -13px; left: 24px; background: #2F6FED; color: #fff; font-size: 12px; font-weight: 700;
  letter-spacing: .03em; padding: 5px 12px; border-radius: 999px; }
.mkpl-card h3 { margin: 0 0 6px; font-size: 22px; line-height: 1.2; font-weight: 800; letter-spacing: -.01em; color: inherit; }
.mkpl-resumen { margin: 0 0 18px; color: #4A5260; font-size: 15px; line-height: 1.5; }
.mkpl-r-precio { display: flex; flex-direction: column; justify-content: flex-end; gap: 6px; }
.mkpl-precio { font-size: 40px; line-height: 1; font-weight: 800; letter-spacing: -.03em; }
.mkpl-precio small { font-size: 15px; font-weight: 500; letter-spacing: 0; color: #5B6472; }
.mkpl-bajo { font-size: 13px; font-weight: 600; color: #5B6472; }
.mkpl-bajo.gratis { align-self: flex-start; padding: 2px 10px; border-radius: 999px; background: #E3F5EB; color: #1F7A4D; font-weight: 800; }
.mkpl-r-boton { padding: 20px 0 22px; }
.mkpl-btn { display: block; text-align: center; background: #2F6FED; color: #fff !important; text-decoration: none;
  font-weight: 700; font-size: 15px; padding: 14px 20px; border-radius: 12px; box-shadow: 0 6px 18px rgba(47,111,237,.24); transition: filter .15s ease; }
.mkpl-btn:hover { filter: brightness(1.06); }
.mkpl-btn.prueba { font-size: 17px; padding: 18px 20px; border-radius: 14px; box-shadow: 0 10px 26px rgba(47,111,237,.34); }
.mkpl-btn.borde { background: #fff; color: #2F6FED !important; box-shadow: inset 0 0 0 1.5px #2F6FED; }
.mkpl-garantia { display: block; margin-top: 8px; text-align: center; font-size: 12.5px; color: #C4C8D0; text-decoration: underline; text-underline-offset: 2px; }
.mkpl-lista-t { margin: 0 0 10px; font-size: 14px; font-weight: 700; }
.mkpl-lista { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; font-size: 14.5px; line-height: 1.4; }
.mkpl-lista li { display: flex; gap: 10px; align-items: flex-start; }
.mkpl-lista li::before { content: "✓"; flex: none; width: 20px; height: 20px; border-radius: 50%; display: inline-flex; align-items: center;
  justify-content: center; font-size: 12px; font-weight: 800; color: #1F7A4D; background: #E3F5EB; margin-top: 0; }
/* El Acelerador, OSCURO para que se destaque (grafito #101319, el de la app, con el brillo dorado de su botón). No lo toca el sol
   y la luna (data-tema-fijo): es negro en los dos modos. */
.mkpl-programa { background: radial-gradient(700px 320px at 100% 0%, rgba(245,196,81,.14), transparent 60%), linear-gradient(160deg, #1C1F27 0%, #101319 100%);
  color: #F4F5F7; border-color: #2A2F3A; box-shadow: 0 22px 54px rgba(16,19,25,.34); }
.mkpl-programa .mkpl-insignia { background: #F5C451; color: #2A1E00; }
.mkpl-programa .mkpl-resumen, .mkpl-programa .mkpl-bajo, .mkpl-programa .mkpl-precio small { color: #C4C8D0; }
.mkpl-programa .mkpl-resumen b { color: #F5C451; }
.mkpl-programa .mkpl-btn { background: #F5C451; color: #2A1E00 !important; box-shadow: 0 8px 22px rgba(245,196,81,.28); }
.mkpl-programa .mkpl-lista li::before { color: #2A1E00; background: #F5C451; }
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
.mkpl-primer-mes { margin: 8px 0 0; padding: 8px 10px; border-radius: 10px; background: #FFF8DB; color: #4A5260; font-size: 13.5px; line-height: 1.4; }
.mkpl-primer-mes b { display: block; color: #12151B; font-size: 15px; }
@media (max-width: 900px) {
  .mkpl-grilla { grid-template-columns: 1fr; grid-template-rows: none; gap: 26px; }
  .mkpl-card { display: flex; flex-direction: column; grid-row: auto; }
}
`;

const precio = (v: number) => v.toLocaleString('es-AR');

export function TarjetasPlanes({ planes, sufijo, promoVigente = false }: {
  planes: readonly PlanEnTarjeta[]; sufijo: string;
  /** El reloj del 50% sigue vivo en este navegador: cada plan del cartel dice lo que sale su primer mes. Después, el precio de siempre. */
  promoVigente?: boolean;
}) {
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
        const lista = listaCorta(p.capa);
        return (
          <section key={p.id} className={`mkpl-card${p.destacado ? ' destacado' : ''}`} aria-label={CEJA_SOFTWARE}>
            {p.destacado && <span className="mkpl-insignia">Recomendado</span>}
            <h3>{p.nombre}</h3>
            <p className="mkpl-resumen">{p.resumen}</p>
            <div className="mkpl-r-precio">
              <div className="mkpl-mes">
                <div className="mkpl-precio">US$ {precio(p.precioUsd)} <small>/ mes</small></div>
                {pesos && <div className="mkpl-bajo">o {formatoMonto(pesos, 'ARS')} por mes</div>}
                {promoVigente && PROMO_ENTRADA.planes.includes(p.id) && (
                  <div className="mkpl-primer-mes"><b>Tu primer mes: US$ {textoUsd(precioPrimerMes(p.precioUsd))}</b> Después, el precio de siempre.</div>
                )}
              </div>
              {conAnual && p.precioAnualUsd && <div className="mkpl-anual"><div className="mkpl-precio">US$ {precio(p.precioAnualUsd)} <small>/ año</small></div></div>}
              <span className={`mkpl-bajo${planConPrueba(p.id) ? ' gratis' : ''}`}>{bajoElPrecio(p)}</span>
            </div>
            <div className="mkpl-r-boton">
              <a className={`${borde} mkpl-mes${p.cobrable && planConPrueba(p.id) ? ' prueba' : ''}`} href={boton.href}>{boton.texto}</a>
              {conAnual && p.precioAnualUsd && <a className={`${borde} mkpl-anual`} href={botonAnualDelPlan({ id: p.id, sufijo }).href}>{botonAnualDelPlan({ id: p.id, sufijo }).texto}</a>}
            </div>
            <div>
              <p className="mkpl-lista-t">{lista.titulo}</p>
              <ul className="mkpl-lista">{lista.items.map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
          </section>
        );
      })}
      <section className="mkpl-card mkpl-programa" data-tema-fijo="" aria-label={CEJA_PROGRAMA}>
        <span className="mkpl-insignia">Con acompañamiento</span>
        <h3>{pr.nombre}</h3>
        {pr.promesa ? <p className="mkpl-resumen"><b>Nuestra promesa:</b> {pr.promesa}</p> : <p className="mkpl-resumen">{pr.resumen}</p>}
        <div className="mkpl-r-precio">
          <div className="mkpl-precio">US$ {precio(pr.precioUsd)}</div>
          <span className="mkpl-bajo">en {pr.cuotas} cuotas de US$ {precio(Math.round(pr.precioUsd / pr.cuotas))}</span>
        </div>
        <div className="mkpl-r-boton">
          <a className="mkpl-btn" href={`/planes/${pr.id}${sufijo}`}>Quiero el Acelerador</a>
          {pr.garantia && <a className="mkpl-garantia" href="/reembolsos#grupal">Con garantía de entrega</a>}
        </div>
        <div>
          <p className="mkpl-lista-t">Todo lo de MaKo Pro, más:</p>
          <ul className="mkpl-lista">{LISTA_PROGRAMA.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
      </section>
      </div>
    </div>
  );
}
