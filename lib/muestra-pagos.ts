// =============================================================================
// muestra-pagos — cuándo la ficha del lead dibuja la tab «Pagos»
// =============================================================================
// Puro y SIN `server-only`: lo leen la ruta /crm/[id] (server), la ficha en modal (app/crm/LeadSheet.tsx,
// 'use client'), la tarjeta del deal y los tests.
//
// ⚠️ ES UNA REGLA PARA LAS DOS PUERTAS. Hasta el 11/10/2026 la ruta pedía «es venta o tiene plan» y el
// modal pedía «tiene cuotas»: un Ganado sin cuotas tenía tab Pagos por el link del WhatsApp y no la
// tenía desde el tablero. La misma ficha por dos puertas tiene que decir lo mismo (el comentario de la
// tab Tracking en app/crm/[id]/page.tsx).
//
// ⚠️ Y CON LA PASARELA, UN LEAD QUE TODAVÍA NO COMPRÓ TAMBIÉN TIENE TAB. El botón «Cobrar con link» vive
// adentro de Pagos: sin esto, justo el lead al que hay que cobrarle no tenía dónde apretarlo. Lo que
// NO se le dibuja a ese lead es el deal entero (servicio, promesa, fiscales…): `tieneDeal` decide eso
// en la tarjeta, así la tab de un lead sin compra no se llena de secciones vacías.

export type SenalesPagos = {
  /** `leads.estado_lead`. */
  estado: string | null | undefined;
  /** La etapa de la casa (`pipeline_stage` o la derivada). */
  etapa: string | null | undefined;
  /** Cuántas filas de `pagos` (cuotas) tiene. */
  cuotas: number;
  /** Plan cargado en el lead (cobro inicial o cuotas), aunque todavía no haya filas. */
  planEnLead: boolean;
  /** Tiene algún cobro de la pasarela (un link de pago, en cualquier estado). */
  hayCobros: boolean;
  /** El negocio tiene Stripe o Mercado Pago conectado (puede cobrarle con un link). */
  pasarelaConectada: boolean;
};

/** El plan uniforme del lead (mig 0014): un cobro inicial o cuotas, aunque no haya filas en `pagos`. */
export const planEnLead = (l: { cobro_inicial_usd?: number | null; total_cuotas?: number | null }): boolean =>
  !!l.cobro_inicial_usd || (l.total_cuotas ?? 0) > 0;

/** Hay un DEAL que mostrar: es una venta, o tiene plata pactada o cobrada. */
export const tieneDeal = (s: Pick<SenalesPagos, 'estado' | 'etapa' | 'cuotas' | 'planEnLead'>): boolean =>
  s.estado === 'ganado' || s.etapa === 'facturando' || s.cuotas > 0 || s.planEnLead;

/** La tab Pagos: hay un deal, hay cobros de la pasarela, o se le puede cobrar con un link. */
export const muestraPagos = (s: SenalesPagos): boolean =>
  tieneDeal(s) || s.hayCobros || s.pasarelaConectada;
