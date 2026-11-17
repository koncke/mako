// =============================================================================
// ficha/reglas-pagos — las reglas PURAS de los bloques de la tab Pagos
// =============================================================================
// Los componentes van en ./registro-pagos.tsx (y ./pagos/). Son del frente de Pagos (ver ./tipos.ts).
//
// 16/10/2026: la tab se rehizo en bloques (pedido de Martín: «la tab de PAGOS que está un desastre también en
// funcionalidad, no se entiende... NO tengas miedo a ELIMINAR todo»). Hasta acá `venta` era DealDetailsCard entera,
// con «Editar deal →» abajo, y la tab entera era esa tarjeta. Ahora cada bloque es UNA cosa y escribe SU campo.
// Lo que se relevó y por qué: docs/hallazgos-pagos.md §1.
//
// CUÁNDO SE CALLA CADA UNO (la regla de siempre, ahora por bloque): a un lead que todavía no compró le quedan la
// oferta y los links (`tieneDeal`, lib/muestra-pagos.ts). El estado de cuenta se calla si no hay nada que contar
// (`estadoDeCuenta` da null: un becado, o un lead sin venta ni cuotas); la suscripción, si la venta no es una; los
// movimientos, si nunca se movió plata.
// =============================================================================

import { planEnLead, tieneDeal } from '@/lib/muestra-pagos';
import { cobradoDelLead, esCuotaDevuelta, type CuotaParaCobrado } from '@/lib/cobrado-lead';
import { estadoDeCuenta } from '@/lib/pagos-vistazo';
import { tieneExcepciones } from '@/lib/pagos-bloques-lead';
import { DISENOS_CLIENTE_EN_CS, sinClienteEnCs } from '@/lib/cliente-en-cs';
import type { StepId } from '@/lib/stage-requirements';
import type { CtxFicha, ReglasDeTab } from './tipos';

/** Las cuotas que trajo la ficha (una ficha a medio leer puede no traerlas: entonces no hay ninguna). */
const cuotasDe = (ctx: CtxFicha) => ctx.data?.pagos ?? [];

/** ¿Hay un deal (es una venta, o tiene plata pactada o cobrada)? Sin él, lo del deal se calla. */
export const conDeal = (ctx: CtxFicha): boolean =>
  tieneDeal({ estado: ctx.lead.estado_lead, etapa: ctx.etapa, cuotas: cuotasDe(ctx).length, planEnLead: planEnLead(ctx.lead) });

/**
 * ¿El estado de cuenta tiene algo que decir? Se mira SIN los cobros de la pasarela (que el bloque pide al montarse):
 * lo que lo calla —un becado, o nada vendido ni cargado— no depende de ellos.
 */
export function sinEstadoDeCuenta(ctx: CtxFicha): boolean {
  const l = ctx.lead;
  const cobrado = cobradoDelLead({
    ventaTipo: l.venta_tipo ?? null, montoCierreUsd: l.monto_cierre_usd ?? null, suscripcionMontoUsd: l.suscripcion_monto_usd ?? null,
    suscripcionMeses: l.suscripcion_meses ?? null, fechaCierre: l.fecha_cierre ?? null, pagos: cuotasDe(ctx) as CuotaParaCobrado[], cobros: [], hoy: ctx.hoy,
    movimientos: ctx.data?.suscripcion?.movimientos ?? [],
  });
  return estadoDeCuenta({ cobrado, pagos: cuotasDe(ctx), ganado: l.estado_lead === 'ganado', hoy: ctx.hoy }) === null;
}

/**
 * ⚠️ UN BLOQUE CUYO DATO SE ESTÁ PIDIENDO NUNCA SE CALLA. «Solucionar» un dato sin marcar va a la tab donde el bloque
 * lo dibuja (`tabDelDato`, ./armar.ts): si el bloque se callara, el dato pedido no tendría dónde cargarse. Pasa con
 * la etapa de cierre de un funnel propio, que pide el monto antes de que el lead figure ganado.
 */
const pide = (ctx: CtxFicha, pasos: readonly StepId[]): boolean => (ctx.data?.faltantes ?? []).some((f) => pasos.includes(f.id));
/** Se calla sin deal, salvo que se esté pidiendo uno de sus datos. */
const sinDealSalvo = (...pasos: StepId[]) => (ctx: CtxFicha) => !conDeal(ctx) && !pide(ctx, pasos);

/**
 * ⚠️ UNA SUSCRIPCIÓN SE VE EN SU BLOQUE (5/11/2026, docs/investigacion-suscripciones.md). Con el bloque `suscripcion` en la
 * misma hoja, en una venta de suscripción se callan el estado de cuenta, las cuotas y la venta: el bloque dibuja adentro
 * el estado, lo pagado, los meses y el monto, y repetirlos al lado es la pestaña «muy compleja» que Martín pidió cambiar.
 * Los movimientos se quedan sólo si la pasarela movió plata (un rechazo o una devolución no están en los meses). Sin el
 * bloque en la hoja (una ficha armada a mano), todo se ve como antes.
 */
export const suscripcionAlLado = (ctx: CtxFicha, hermanos?: readonly string[]): boolean =>
  ctx.lead.venta_tipo === 'suscripcion' && !ctx.crm && !!hermanos?.includes('suscripcion');

/**
 * (17/11/2026, P28) ¿Tiene alguna cuota sin cobrar, en la casa o en un CRM agregado? Sin ninguna no puede haber un
 * recordatorio de cobro corriendo, así que `recordatorios-de-cobro` ni pide su lectura. Con alguna, el bloque lee las
 * corridas al montarse y, si no hay ninguna viva, no dibuja nada (el armador esconde la celda vacía).
 */
export const conCuotasSinCobrar = (ctx: CtxFicha): boolean =>
  cuotasDe(ctx).some((q) => !q.pagado) || (ctx.data?.tratos ?? []).some((t) => t.pagos.some((q) => !q.pagado));

/**
 * ¿La confirmación de pago no tiene nada que decir? Sin fecha de confirmación, se calla si no hay deal (la regla de la tab:
 * «a un lead que todavía no compró le quedan la oferta y los links», tests/pagos-tab-bloques.test.ts) o si el lead salió.
 * CON fecha se ve siempre: «confirmó hace 5 días y no pagó» es justo el lead que todavía no tiene deal. La fecha de un lead
 * sin deal se carga en la R1 (Reuniones), como siempre.
 */
export const sinConfirmacionQueMostrar = (ctx: CtxFicha): boolean =>
  !ctx.lead.fecha_confirmacion && (!conDeal(ctx) || ctx.lead.estado_lead === 'perdido' || ctx.lead.estado_lead === 'descalificado');

export const REGLAS_PAGOS = {
  oferta: {},
  'links-de-pago': { disenos: ['lista', 'pendiente'] },
  venta: { estaVacio: (ctx, _p?, h?) => sinDealSalvo('monto')(ctx) || suscripcionAlLado(ctx, h), disenos: ['cajas', 'renglon', 'numero'] },
  cobrado: { estaVacio: (ctx, _p?, h?) => sinEstadoDeCuenta(ctx) || suscripcionAlLado(ctx, h), disenos: ['numero', 'chip'] },
  cuotas: { estaVacio: (ctx, _p?, h?) => (sinDealSalvo('plan', 'comprobante')(ctx) && cuotasDe(ctx).length === 0) || suscripcionAlLado(ctx, h), disenos: ['tabla', 'proxima'] },
  movimientos: {
    estaVacio: (ctx, _p?, h?) => (!cuotasDe(ctx).some((q) => q.pagado || esCuotaDevuelta(q)) && !ctx.data?.cobro?.hayCobros)
      || (suscripcionAlLado(ctx, h) && !ctx.data?.cobro?.hayCobros),
    disenos: ['lista', 'ultimos'],
  },
  // Dibuja adentro el comprobante de cada pago (se adjunta desde su mes): «Solucionar» un comprobante que falta viene acá.
  suscripcion: { estaVacio: (ctx) => ctx.lead.venta_tipo !== 'suscripcion', disenos: ['completa'], cubreTambien: ['comprobante'] },
  contrato: { estaVacio: sinDealSalvo(), disenos: ['franja', 'vista'] },
  'datos-fiscales': { estaVacio: sinDealSalvo('dealFiscal', 'dealFiscalDoc'), disenos: ['grilla', 'compacta'] },
  'servicio-vendido': { estaVacio: sinDealSalvo('dealServicio'), disenos: ['grilla', 'renglon'] },
  'promesa-y-garantia': { estaVacio: sinDealSalvo('dealPromesa'), disenos: ['cajas', 'cita'] },
  obligaciones: { estaVacio: sinDealSalvo('dealObligaciones'), disenos: ['listas', 'tabla'] },
  // (17/11/2026, P28) Los cuatro que estaban en el catálogo y en las plantillas sin componente: la ficha los saltaba callada.
  // La confirmación se llena ahí (`sinDatos: 'raya'`) en un lead con deal; con la fecha puesta se ve siempre.
  'confirmacion-de-pago': { estaVacio: sinConfirmacionQueMostrar, disenos: ['fecha', 'alerta'] },
  'recordatorios-de-cobro': { estaVacio: (ctx) => !conCuotasSinCobrar(ctx), disenos: ['lista', 'renglon'] },
  excepciones: { estaVacio: (ctx) => !tieneExcepciones(ctx.lead), disenos: ['chips', 'lista'] },
  // Sólo en un ganado. Es del CLIENTE, no del trato: mirando un CRM agregado dice lo mismo (sin `delTrato` en el registro).
  'cliente-en-cs': { estaVacio: (ctx) => sinClienteEnCs(ctx.lead), disenos: DISENOS_CLIENTE_EN_CS },
} satisfies ReglasDeTab;
