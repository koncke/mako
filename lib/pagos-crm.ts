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

/**
 * Los cobros de la pasarela (que son del LEAD) que tocan a las cuotas de un trato: el que salda una de sus cuotas
 * (`pago_id`) o el que quedó asentado en una (`cobro_id`). Un link suelto o el de la venta de la casa no es de la renovación.
 */
export function cobrosDelTrato<C extends { id: number; pago_id?: number | null }>(cobros: readonly C[], pagos: readonly { id: number; cobro_id?: number | null }[]): C[] {
  const cuotas = new Set(pagos.map((q) => Number(q.id)));
  const asentados = new Set(pagos.map((q) => q.cobro_id).filter((x): x is number => x != null).map(Number));
  return cobros.filter((c) => (c.pago_id != null && cuotas.has(Number(c.pago_id))) || asentados.has(Number(c.id)));
}

/** Lo contrario de `cobrosDelTrato`: los cobros que NO tocan a estas cuotas (la casa, sin los de sus renovaciones). */
export function cobrosSinLosDe<C extends { id: number; pago_id?: number | null }>(cobros: readonly C[], pagosAjenos: readonly { id: number; cobro_id?: number | null }[]): C[] {
  const ajenos = new Set(cobrosDelTrato(cobros, pagosAjenos).map((c) => c.id));
  return cobros.filter((c) => !ajenos.has(c.id));
}

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

/**
 * Lo cobrado de la venta de la CASA (mig 0325, segunda revisión del 22/10/2026): `total_cobrado_casa_usd`; sin la columna
 * (una base sin la 0325, o una fila que todavía no se sincronizó), `total_cobrado_usd`, que es lo de antes.
 */
export function cobradoDeLaVenta(l: { total_cobrado_casa_usd?: unknown; total_cobrado_usd?: unknown }): number {
  const casa = num(l.total_cobrado_casa_usd);
  return casa ?? num(l.total_cobrado_usd) ?? 0;
}

/**
 * Lo que le falta pagar de la venta de la CASA: su monto de cierre menos lo cobrado de ESA venta, nunca negativo. null sin
 * monto (sin venta, «falta» no tiene referencia). Lo usan `{{lead_saldo}}` (mensajes al cliente), el filtro «Solo los que
 * deben», el export y `listar_leads`. ⚠️ Con lo cobrado en TODOS los CRMs, una renovación pagada restaba de la venta.
 */
export function faltaDeLaVenta(l: { monto_cierre_usd?: unknown; total_cobrado_casa_usd?: unknown; total_cobrado_usd?: unknown }): number | null {
  const monto = num(l.monto_cierre_usd);
  if (monto == null) return null;
  return Math.max(0, Math.round((monto - cobradoDeLaVenta(l)) * 100) / 100);
}

/** Una venta de un CRM agregado (una renovación): la de su fila de `lead_funnel`. */
export type VentaDeCrm = { leadId: number; funnelId: number; monto: number; fecha: string; nombre: string | null };

/**
 * Qué filas de `lead_funnel` son una VENTA que suma a «Firmado» (CO2, 22/10/2026): ganada en ese CRM (etapa `ganado`), con
 * monto y fecha de cierre, que no es «sin cobro». Una fila que repite la CASA del lead no cuenta: esa venta es la de
 * `leads` y sumaría dos veces. `filas` trae `leads(nombre, funnel_id)`; `casaDelNegocio` es la casa de un lead con NULL.
 */
export function ventasDeFilas(filas: readonly Record<string, unknown>[], casaDelNegocio: number | null): VentaDeCrm[] {
  return filas.flatMap((f) => {
    const c = camposDeFila(f);
    const relCrudo = f.leads as { nombre?: string | null; funnel_id?: number | string | null } | Array<{ nombre?: string | null; funnel_id?: number | string | null }> | null | undefined;
    const rel = Array.isArray(relCrudo) ? relCrudo[0] : relCrudo;
    const casa = rel?.funnel_id != null ? Number(rel.funnel_id) : casaDelNegocio;
    const funnelId = Number(f.funnel_id);
    if (f.etapa !== 'ganado' || c.venta_tipo === 'sin_cobro' || c.monto_cierre_usd == null || !c.fecha_cierre || funnelId === casa) return [];
    return [{ leadId: Number(f.lead_id), funnelId, monto: c.monto_cierre_usd, fecha: c.fecha_cierre, nombre: rel?.nombre ?? null }];
  });
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
