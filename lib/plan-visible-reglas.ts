// =============================================================================
// EL NOMBRE DEL PLAN QUE VE EL CLIENTE: el que se vende, nunca la capa (18/11/2026)
// =============================================================================
// «Tu plan» decía «Agencia» a quien paga MaKo Pro y «Completo» a quien paga MaKo Essential: `capaDef(capa).nombre`
// (lib/capas.ts), que es el nombre de la CAPA, algo interno. Es el mismo error que el #89 del 12/11 en la ficha de los
// tickets (`planDeLaFicha`, lib/tickets-reglas.ts), y la regla es la misma: la capa `completo` ES Essential y la
// `agencia`, Pro (`CAPA_DE_PLAN`, lib/agencia-cobro-reglas.ts), pero esa misma capa también la tienen el ws1 y los
// acuerdos a mano, que no pagan un plan. Lo que los separa es `rige`: si el negocio paga un plan de MaKo, por la pasarela
// o por su agencia (`pagaUnPlanDe`, lib/plan-esencial.ts).
// La decisión vive acá, sin imports, y la usan las dos: la ficha (`planDeLaFicha`) y lo que ve el cliente
// (`nombreDelPlanVisible`; las lecturas, en lib/plan-visible.ts).
// =============================================================================

/**
 * Qué plan se le vende al negocio: `esencial` o `pro` si paga uno; `sin-plan` si tiene una capa de plan sin pagarlo (el ws1,
 * un acuerdo a mano); `no-se` si no se pudo leer `rige`; `otra-capa` si su capa no es la de ningún plan que se venda.
 */
export type PlanQueSeVende = 'esencial' | 'pro' | 'sin-plan' | 'no-se' | 'otra-capa';

export function planQueSeVende(p: { capa: string | null; rige: boolean | null }): PlanQueSeVende {
  if (p.capa !== 'completo' && p.capa !== 'agencia') return 'otra-capa';
  if (p.rige === true) return p.capa === 'agencia' ? 'pro' : 'esencial';
  if (p.rige === false) return 'sin-plan';
  return 'no-se';
}

/** Lo que ve quien no paga un plan del catálogo: un acuerdo a mano (el ws1, los 6 meses gratis…) o una capa sin plan. */
export const PLAN_A_MEDIDA = 'Plan a medida';
/** Lo que ve el cliente de una agencia que no le paga un plan del catálogo: su plan lo maneja ella. */
export const PLAN_DE_TU_AGENCIA = 'Plan de tu agencia';

/**
 * El nombre del plan para el CLIENTE («Tu plan», en la computadora y en el teléfono, y el email del código de baja). Nunca la
 * capa: quien paga ve el nombre del catálogo (`nombres`, de `planesMako`); el cliente de una agencia sin un plan del catálogo,
 * `PLAN_DE_TU_AGENCIA`; el resto, `PLAN_A_MEDIDA`. Si `rige` no se pudo leer (`no-se`), el plan de su capa: es lo que paga
 * casi todo negocio con esa capa (el ws1 y la plataforma no llegan a leer: `pagaUnPlanDe` los contesta antes).
 */
export function nombreDelPlanVisible(p: {
  capa: string | null;
  rige: boolean | null;
  clienteDeAgencia: boolean;
  nombres: { esencial: string; pro: string };
}): string {
  const plan = planQueSeVende(p);
  if (plan === 'pro') return p.nombres.pro;
  if (plan === 'esencial') return p.nombres.esencial;
  if (p.clienteDeAgencia) return PLAN_DE_TU_AGENCIA;
  if (plan === 'no-se') return p.capa === 'agencia' ? p.nombres.pro : p.nombres.esencial;
  return PLAN_A_MEDIDA;
}

/**
 * El concepto de RESERVA de un cobro de alta que llega sin concepto (`crearCobro`, lib/cobros.ts): termina en el recibo que ve el
 * cliente, y decía «MaKo · plan Agencia» (la capa). Es la venta de un plan, así que `rige` es sí: la capa `agencia` es Pro y la
 * `completo`, Essential. Una capa sin plan del catálogo, «MaKo · Plan a medida».
 */
export function conceptoDeAlta(capa: string, nombres: { esencial: string; pro: string }): string {
  const plan = planQueSeVende({ capa, rige: true });
  if (plan === 'pro') return nombres.pro;
  if (plan === 'esencial') return nombres.esencial;
  return `MaKo · ${PLAN_A_MEDIDA}`;
}
