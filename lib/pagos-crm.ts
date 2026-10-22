// =============================================================================
// pagos-crm — los pagos son de un CRM: el trato de un lead en cada CRM donde está (22/10/2026)
// =============================================================================
// La llamada con un cliente del 22/10/2026 (Fathom 195129619, 10:00-12:19): en el CRM de renovaciones, la tab Pagos de
// un cliente que renovó mostraba el plan de su PRIMER servicio («cuota 1, cobrada el 01/04»). Martín: «una vez que un
// cliente pasa a un nuevo CRM, se reinicia la etapa de pago… en el primer servicio te puede haber pagado todas las
// cuotas y en la renovación está en la primera cuota».
//
// EL MODELO (mig 0324). Un lead está en su CASA (`leads.funnel_id`, NULL = el funnel del negocio) y en los CRMs a los
// que se lo agregó (`lead_funnel`, mig 0207). Cada uno es un TRATO aparte:
//   · el de la casa es el de siempre: la venta y el plan en `leads`, y los pagos que NO son de un CRM agregado;
//   · el de un CRM agregado: la venta y el plan en SU fila de `lead_funnel`, y los pagos con ese `funnel_id`.
// Cada pago guarda su CRM desde la 0310 (`pagos.funnel_id`). Un pago de un CRM del que después se quitó al lead
// vuelve a verse en la casa (`esDelTrato`): ninguna plata queda sin pantalla.
//
// Un CRM agregado no tiene suscripción: una mensualidad sigue siendo de la casa (la cobra la pasarela por lead).
//
// Puro y sin `server-only`: lo leen la ficha (navegador), lib/pagos.ts y los tests (tests/pagos-crm.test.ts).
// =============================================================================

/** De qué trato se habla: `null` = la casa; un número = un CRM agregado (su `funnel_id`). */
export type Crm = number | null;

/** Lo que un CRM agregado guarda de su venta y su plan (las columnas de `lead_funnel`, mig 0324). */
export type CamposTrato = {
  venta_tipo: 'unico' | 'sin_cobro' | null;
  monto_cierre_usd: number | null;
  fecha_cierre: string | null;
  cobro_inicial_usd: number | null;
  monto_cuota_usd: number | null;
  total_cuotas: number | null;
  dia_de_pago: number | null;
};

export const CAMPOS_TRATO = ['venta_tipo', 'monto_cierre_usd', 'fecha_cierre', 'cobro_inicial_usd', 'monto_cuota_usd', 'total_cuotas', 'dia_de_pago'] as const;

/** El trato de un CRM agregado, como lo lee la ficha: su etapa ahí, lo suyo, y sus pagos. */
export type TratoCrm<P = unknown> = CamposTrato & {
  funnelId: number;
  /** La etapa del lead en ESE CRM (`lead_funnel.etapa`). */
  etapa: string | null;
  pagos: P[];
};

const num = (v: unknown): number | null => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

/** Una fila de `lead_funnel` (lo que venga: una base sin la 0324 no trae las columnas) como los campos del trato. */
export function camposDeFila(f: Record<string, unknown> | null | undefined): CamposTrato {
  const tipo = f?.venta_tipo === 'sin_cobro' ? 'sin_cobro' : f?.venta_tipo === 'unico' ? 'unico' : null;
  return {
    venta_tipo: tipo,
    monto_cierre_usd: num(f?.monto_cierre_usd),
    fecha_cierre: typeof f?.fecha_cierre === 'string' ? f.fecha_cierre.slice(0, 10) : null,
    cobro_inicial_usd: num(f?.cobro_inicial_usd),
    monto_cuota_usd: num(f?.monto_cuota_usd),
    total_cuotas: num(f?.total_cuotas),
    dia_de_pago: num(f?.dia_de_pago),
  };
}

/**
 * ¿Este pago es del trato `crm`? De un CRM agregado: el que lleva su `funnel_id`. De la casa: TODO lo demás (su
 * funnel, el del negocio, uno sin funnel, o el de un CRM del que ya se quitó al lead), así nada queda sin verse.
 */
export function esDelTrato(funnelDelPago: number | string | null | undefined, crm: Crm, agregados: readonly number[]): boolean {
  const f = funnelDelPago == null || funnelDelPago === '' ? null : Number(funnelDelPago);
  if (crm != null) return f === crm;
  return f == null || !agregados.includes(f);
}

/** Los pagos del trato `crm`, con la regla de `esDelTrato`. */
export const pagosDelTrato = <P extends { funnel_id?: number | string | null }>(pagos: readonly P[], crm: Crm, agregados: readonly number[]): P[] =>
  pagos.filter((p) => esDelTrato(p.funnel_id, crm, agregados));

/** Lo del lead que la tab Pagos lee de la venta: en un CRM agregado sale de su trato. */
type LeadDePagos = {
  estado_lead?: unknown;
  venta_tipo?: unknown;
  monto_cierre_usd?: number | null;
  fecha_cierre?: string | null;
  cobro_inicial_usd?: number | null;
  monto_cuota_usd?: number | null;
  total_cuotas?: number | null;
  dia_de_pago?: number | null;
  suscripcion_monto_usd?: number | null;
  suscripcion_meses?: number | null;
  total_cobrado_usd?: number | null;
};

/**
 * El lead como lo leen los bloques de Pagos mirando un CRM agregado: la venta, el plan y si está ganado son los de ESE
 * CRM; la suscripción no existe ahí. Todo lo demás (el nombre, el contacto, las reuniones) es el mismo lead.
 * Sin trato (no se pudo leer, o la 0324 no está): la venta y el plan vacíos, nunca los de la casa.
 */
export function leadConTrato<L extends LeadDePagos>(lead: L, t: (CamposTrato & { etapa?: string | null }) | null | undefined): L {
  const c = t ?? camposDeFila(null);
  return {
    ...lead,
    estado_lead: t?.etapa === 'ganado' ? 'ganado' : t?.etapa === 'perdido' ? 'perdido' : null,
    venta_tipo: c.venta_tipo ?? 'unico',
    monto_cierre_usd: c.monto_cierre_usd,
    fecha_cierre: c.fecha_cierre,
    cobro_inicial_usd: c.cobro_inicial_usd,
    monto_cuota_usd: c.monto_cuota_usd,
    total_cuotas: c.total_cuotas,
    dia_de_pago: c.dia_de_pago,
    suscripcion_monto_usd: null,
    suscripcion_meses: null,
    total_cobrado_usd: null,
  };
}

/** Los tipos de venta de un CRM agregado: sin suscripción (una mensualidad es de la casa). */
export const TIPOS_DE_UN_CRM: ReadonlyArray<'unico' | 'sin_cobro'> = ['unico', 'sin_cobro'];

/**
 * El 23505 de insertar una cuota de un CRM agregado sin la 0324: el índice viejo `(lead_id, numero)` no deja que la
 * cuota 1 de la renovación conviva con la cuota 1 de la casa. Se dice qué falta, no «duplicate key».
 */
export function faltaIndicePorCrm(e: unknown): boolean {
  const m = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e);
  const code = typeof e === 'object' && e && 'code' in e ? String((e as { code: unknown }).code) : '';
  return (code === '23505' || /duplicate key/i.test(m)) && /idx_pagos_lead_numero/.test(m);
}
export const FALTA_0324 = 'No se pudo guardar el plan de este CRM: falta aplicar la migración 0324 (las cuotas por CRM). Avísale al administrador.';
