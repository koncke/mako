// =============================================================================
// Pagos — plan de cobranza por cuotas (Fase 8-bis)
// =============================================================================
// Una fila por movimiento esperado de un lead:
//   numero = 0  → cobro inicial
//   numero = 1..6 → cuotas mensuales
// El cash collected del dashboard se calcula sumando los pagos pagado=true por
// su fecha_pago. total_cobrado_usd del lead se DERIVA de acá (se sincroniza en
// cada mutación). Outstanding = Σ pagos no pagados.
// =============================================================================

import 'server-only';
import { getTenantDb, getWorkspaceActual } from './workspace';
import { hoyEnWorkspace } from './timezone';
import { cachedRead, TAG, TTL } from './cache';
import { leerTodo, type ConsultaPaginada } from './supabase-paginado';
import { VENTA_SIN_COBRO, ventaTipoDe, type VentaTipo } from './venta-tipo';
import { faltaColumnaFunnel } from './funnels-elegidos';
import { pasaAGanado } from './crm-curso-al-ganar-reglas';
import { etapaContradiceElEstado } from './pipeline';
import { centavos, diferenciaPendiente, dolaresALaTasaDeLaCuota, restoEnLaMonedaDeLaCuota, type RestoDeCobro } from './pagos-diferencia';
import {
  aplicarObligacion, avisoPlanUniforme, cuotasDelPlan, esCampoLeadDeal, esSeccionDeal, etiquetaDePago, fusionarCampo, pagoEnMoneda, patchDeVenta,
  diferenciaDePlan, planCambiadoAfuera, reconciliarCuotas, rotuloCampoDeal, rotuloObligacion, valorDeCampoDeal, CAMPOS_LEAD_DEAL, COLUMNA_SECCION, MONEDA_POR_DEFECTO,
  avisoDeConservadas, cuotaExistenteDe, diaDePagoFuturo, lineasDeCuotas, planCambioDesde, planComoEstaba, planPorTramosDelServer,
  type AnticipoPlan, type CambioObligacion, type CambioVenta, type CampoLeadDeal, type CuotaDeseada, type CuotaExistente, type CuotaVista, type FilaVenta,
  type ModoReconciliar, type Obligaciones, type PlanDeCuotas, type PlanUniforme, type Proteccion, type SeccionDeal, type TramoPlan,
} from './pagos-campo';
import { getLead, logLeadChanges, logLeadEvent } from './leads';
import { esCuotaDeBaja, esCuotaDevuelta, noEsDeuda } from './cobrado-lead';
import { normalizarMoneda } from './pasarela-moneda';
import { borrarSettingSi, cambiarSettingSi, getSettingEstricto, getSetting, setSetting } from './settings';
import { keyEspaciado } from './espaciado';
import { AVISOS_DE_CUOTA, DEDUP_OLVIDADO, claveDedupCuota, cuotasReprogramadas, marcaAlDeshacer } from './cobranza';
import type { MarcasDeCobranza } from './deshacer-movimiento';
import { plazoAlReactivar } from './suscripcion-manual';
import { laCobraLaPasarela } from './cobros-reglas';
import type { Pasarela } from './cobros-tipos';
import type { CobroParaCobrado } from './cobrado-lead';
import { itemDeSuscripcion, type ItemPorCobrar, type LeadSuscripcion } from './suscripciones-por-cobrar';
import { leerCambiosDeSuscripcion } from './suscripcion-movimientos';
import { mismoCentavo } from './cobro-etapa';
import { FALTA_0324, camposDeFila, esDelTrato, faltaIndicePorCrm, type CamposTrato, type Crm } from './pagos-crm';

export type Pago = {
  id: number;
  lead_id: number;
  numero: number;          // 0 = inicial, 1..6 = cuota
  monto_usd: number;
  fecha_esperada: string | null; // YYYY-MM-DD
  pagado: boolean;
  fecha_pago: string | null;
  // Comprobante del pago (migración 0060): archivo en Storage + hora del pago.
  comprobante_path?: string | null;
  comprobante_nombre?: string | null;
  pago_hora?: string | null;
  // De qué cobro de la pasarela salió (mig 0255). null = cargada a mano o por un plan.
  cobro_id?: number | null;
  proveedor?: Pasarela | null;
  proveedor_pago_id?: string | null;
  moneda?: string | null;          // la del cobro real; null = USD
  monto_original?: number | null;  // en esa moneda
  // Lo cargado a mano (mig 0292): por qué y cómo se cobró. null en lo de la pasarela y en lo viejo.
  concepto?: string | null;
  metodo?: string | null;
  /** Nació ya cobrada: un pago suelto, una mensualidad registrada a mano (mig 0295) o el cobro de un link que no saldaba
   *  ninguna cuota (`registrarCobroDeProveedor`). Deshacer la de a mano la quita. No es una cuota del plan (`esCuotaDelPlan`). */
  nacio_cobrada?: boolean | null;
  /** La diferencia de un cobro por menos: el id de la cuota de la que salió (`cobrar_cuota_con_resto`). No es del plan. */
  resto_de?: number | null;
  /** Se registró como la mensualidad («Registrar el mes cobrado», mig 0323): vale un mes en una suscripción. */
  es_mensualidad?: boolean | null;
  /** El cliente se dio de baja (mig 0307, lib/pagos-baja.ts): impaga y sin vencimiento; el que tenía, en `baja_vencia`. */
  baja_at?: string | null;
  baja_vencia?: string | null;
  /** El CRM del pago (mig 0310, el de cuando se creó): el trato al que pertenece (mig 0324, lib/pagos-crm.ts). */
  funnel_id?: number | null;
  created_at: string;
};

export type PlanPagos = {
  cobro_inicial_usd: number | null;
  monto_cuota_usd: number | null;
  total_cuotas: number | null;   // 1..6
  dia_de_pago: number | null;    // 1..28
};

// ─────────────────────────────────────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pagos de un lead, ordenados por numero (inicial primero), de UN trato (22/10/2026, mig 0324, lib/pagos-crm.ts):
 *   · sin `crm` (o null): los de la CASA, que es lo que leen todos los que hablan de «la venta del lead» (la API de
 *     MaKo, el asistente de Ganado, Customer Success, lo cobrado del lead): su monto y su plan están en `leads`;
 *   · un número: los de ESE CRM agregado (la tab Pagos mirando una renovación);
 *   · 'todos': todos, para buscar una cuota por su id o saldar una deuda de cualquier trato.
 * ⚠️ Antes del 22/10 devolvía SIEMPRE todos: la renovación mostraba el plan del primer servicio.
 */
export async function getPagosByLead(leadId: number, crm: Crm | 'todos' = null): Promise<Pago[]> {
  const supabase = (await getTenantDb());
  let q = supabase
    .from('pagos')
    .select('*')
    .eq('lead_id', leadId);
  if (crm === 'todos') { /* todos */ }
  else if (crm != null) q = q.eq('funnel_id', crm);
  else {
    // La casa es todo lo que NO es de un CRM agregado (`esDelTrato`): lo de un CRM del que ya se quitó al lead vuelve acá.
    const agregados = await crmsAgregadosDelLead(leadId);
    if (agregados.length) q = q.or(`funnel_id.is.null,funnel_id.not.in.(${agregados.join(',')})`);
  }
  const { data, error } = await q.order('numero', { ascending: true });
  if (error) throw new Error(`Error listando pagos del lead ${leadId}: ${error.message}`);
  return (data ?? []) as Pago[];
}

/** El funnel del negocio (`es_default`): la casa de un lead con `funnel_id` NULL. null si no se pudo leer. */
async function funnelDelNegocio(): Promise<number | null> {
  // ⚠️ TIRA si no puede leer (tercera revisión, B3): con null, una fila de `lead_funnel` que repite la casa contaba como
  // agregado, todos los pagos de la casa quedaban afuera y se ESCRIBÍA lo cobrado de la casa en 0.
  const { data, error } = await (await getTenantDb()).from('funnels').select('id').eq('es_default', true).limit(1).maybeSingle();
  if (error) throw new Error(`No pude leer el funnel del negocio: ${error.message}`);
  return data ? Number((data as { id: number }).id) : null;
}

/** La casa del lead ya resuelta (su `funnel_id`, o el del negocio si es NULL). Tira si el lead no es de este negocio. */
export async function casaDelLead(leadId: number): Promise<number | null> {
  const { data, error } = await (await getTenantDb()).from('leads').select('funnel_id').eq('id', leadId).maybeSingle();
  if (error) throw new Error(`No pude leer el lead ${leadId}: ${error.message}`);
  if (!data) throw new Error('No encontré ese lead en este negocio.');
  const f = (data as { funnel_id: number | string | null }).funnel_id;
  return f != null ? Number(f) : funnelDelNegocio();
}

/**
 * Los CRMs a los que se agregó al lead (`lead_funnel`): cada uno es un trato aparte. Tira si no puede leer.
 * ⚠️ SIN LA CASA (revisión del 22/10/2026, M3): una fila de `lead_funnel` que repite la casa puede quedar si falla un
 * borrado (`quitarDeProducto`, `eliminarFunnelDefinitivo`). Contada como agregado, la casa quedaba vacía, lo cobrado en
 * null, armar el plan chocaba con el índice y `crmDelTrato(casa)` devolvía un CRM. La casa es siempre la casa.
 */
export async function crmsAgregadosDelLead(leadId: number): Promise<number[]> {
  const { data, error } = await (await getTenantDb()).from('lead_funnel').select('funnel_id').eq('lead_id', leadId);
  if (error) throw new Error(`No pude leer los CRMs del lead ${leadId}: ${error.message}`);
  const ids = [...new Set(((data ?? []) as Array<{ funnel_id: number | string }>).map((r) => Number(r.funnel_id)).filter(Number.isFinite))];
  if (!ids.length) return ids;
  const casa = await casaDelLead(leadId);
  return ids.filter((x) => x !== casa);
}

/**
 * El trato de un pago que ya existe, por su `funnel_id` (la regla de `esDelTrato`): el CRM agregado si es uno del lead; si
 * no, la casa. Lo usa lo que toca una cuota sin que la pantalla diga el CRM (deshacer un pago suelto, la pasarela).
 */
export async function tratoDelPago(leadId: number, funnelDelPago: number | string | null | undefined): Promise<Crm> {
  if (funnelDelPago == null || funnelDelPago === '') return null;
  const f = Number(funnelDelPago);
  return (await crmsAgregadosDelLead(leadId)).includes(f) ? f : null;
}

/**
 * De estos leads, los que tienen PLATA en el CRM `crm` (la regla de `tratoConPlata`, de a tandas): una venta o un plan en su
 * fila de `lead_funnel`, o algún pago con ese `funnel_id`. Lo usan los borrados EN LOTE de una fila de `lead_funnel`
 * (`quitarLoteDeProducto`, el borrado definitivo de un funnel y su rescate), que la saltean en vez de perderla.
 */
export async function leadsConPlataEn(crm: number, leadIds: readonly number[]): Promise<Set<number>> {
  const out = new Set<number>();
  const db = await getTenantDb();
  const ids = [...new Set(leadIds)];
  for (let i = 0; i < ids.length; i += 200) {
    const tanda = ids.slice(i, i + 200);
    const [pg, lf] = await Promise.all([
      db.from('pagos').select('lead_id').eq('funnel_id', crm).in('lead_id', tanda),
      db.from('lead_funnel').select('*').eq('funnel_id', crm).in('lead_id', tanda),
    ]);
    if (pg.error) throw new Error(`No pude leer los pagos de ese CRM: ${pg.error.message}`);
    if (lf.error) throw new Error(`No pude leer el plan de ese CRM: ${lf.error.message}`);
    for (const r of (pg.data ?? []) as Array<{ lead_id: number }>) out.add(Number(r.lead_id));
    for (const f of (lf.data ?? []) as Array<Record<string, unknown>>) {
      const c = camposDeFila(f);
      if (c.monto_cierre_usd != null || c.venta_tipo === 'sin_cobro' || c.cobro_inicial_usd != null || c.monto_cuota_usd != null || c.total_cuotas != null) out.add(Number(f.lead_id));
    }
  }
  return out;
}

/**
 * ¿El lead tiene PLATA en el trato de ese CRM agregado? Una venta o un plan cargados en su fila de `lead_funnel`, o algún
 * pago con ese `funnel_id`. Quitarlo de ese CRM (o promoverlo a casa) mezclaría esa plata con la de otro trato: lo frenan
 * `quitarDeProducto` (lib/lead-funnel.ts) y el borrado definitivo de un funnel (revisión del 22/10/2026, M4).
 */
export async function tratoConPlata(leadId: number, crm: number): Promise<boolean> {
  const db = await getTenantDb();
  const [t, pg] = await Promise.all([
    db.from('lead_funnel').select('*').eq('lead_id', leadId).eq('funnel_id', crm).maybeSingle(),
    db.from('pagos').select('id').eq('lead_id', leadId).eq('funnel_id', crm).limit(1),
  ]);
  if (t.error) throw new Error(`No pude leer el plan de ese CRM: ${t.error.message}`);
  if (pg.error) throw new Error(`No pude leer los pagos de ese CRM: ${pg.error.message}`);
  const c = camposDeFila(t.data as Record<string, unknown> | null);
  return (pg.data ?? []).length > 0 || c.monto_cierre_usd != null || c.venta_tipo === 'sin_cobro' || c.cobro_inicial_usd != null || c.monto_cuota_usd != null || c.total_cuotas != null;
}

/**
 * El CRM del trato que pide una pantalla, VALIDADO: null (la casa) o un CRM agregado de ESTE lead en ESTE negocio. El id
 * de la casa (o del funnel del negocio para un lead sin casa) también es la casa. Un id que no es un CRM del lead TIRA:
 * escribir el plan de un CRM donde el lead no está dejaría plata en una pantalla que nadie abre.
 */
export async function crmDelTrato(leadId: number, crm: unknown): Promise<Crm> {
  if (crm == null || crm === '') return null;
  const n = Number(crm);
  if (!Number.isSafeInteger(n) || n <= 0) throw new Error('Ese CRM no existe.');
  if ((await crmsAgregadosDelLead(leadId)).includes(n)) return n;
  if ((await casaDelLead(leadId)) === n) return null;
  throw new Error('Ese CRM no es de este lead.');
}

/** La fila del trato de un CRM agregado (`lead_funnel`, mig 0324), o null si el lead no está en ese CRM. */
export async function filaDelTrato(leadId: number, crm: number): Promise<(CamposTrato & { etapa: string | null; id: number }) | null> {
  const { data, error } = await (await getTenantDb()).from('lead_funnel').select('*').eq('lead_id', leadId).eq('funnel_id', crm).maybeSingle();
  if (error) throw new Error(`No pude leer el plan de este CRM: ${error.message}`);
  if (!data) return null;
  const f = data as Record<string, unknown>;
  return { ...camposDeFila(f), etapa: typeof f.etapa === 'string' ? f.etapa : null, id: Number(f.id) };
}

/**
 * Los tratos de los CRMs agregados del lead, con sus pagos: lo que la ficha muestra en la tab Pagos al mirar uno.
 * `select('*')` de `lead_funnel`: sin la 0324 no tiene las columnas, y cada trato sale vacío (no se cae la ficha).
 */
export async function tratosDelLead(leadId: number): Promise<Array<CamposTrato & { funnelId: number; etapa: string | null; pagos: Pago[] }>> {
  const db = await getTenantDb();
  const { data, error } = await db.from('lead_funnel').select('*').eq('lead_id', leadId);
  if (error) throw new Error(`No pude leer los CRMs del lead ${leadId}: ${error.message}`);
  // Sin la fila que repite la casa (M3): la casa no es un CRM agregado.
  const casa = (data ?? []).length ? await casaDelLead(leadId) : null;
  const filas = ((data ?? []) as Array<Record<string, unknown>>).filter((f) => Number(f.funnel_id) !== casa);
  if (!filas.length) return [];
  const ids = filas.map((f) => Number(f.funnel_id));
  const { data: pg, error: e2 } = await db.from('pagos').select('*').eq('lead_id', leadId).in('funnel_id', ids).order('numero', { ascending: true });
  if (e2) throw new Error(`No pude leer los pagos de los CRMs del lead ${leadId}: ${e2.message}`);
  const pagos = (pg ?? []) as Pago[];
  return filas.map((f) => {
    const funnelId = Number(f.funnel_id);
    return { ...camposDeFila(f), funnelId, etapa: typeof f.etapa === 'string' ? f.etapa : null, pagos: pagos.filter((p) => esDelTrato((p as { funnel_id?: number | null }).funnel_id, funnelId, ids)) };
  });
}

export type LeadPlan = {
  total_usd: number | null;
  duracion_meses: number | null;
  fecha_cierre: string | null;
  fecha_inicio: string | null;
  contrato_nombre: string | null;
  tiene_contrato: boolean;
  pagos: Pago[];
};

/** Plan + cuotas + info de contrato de un lead (para el modo "ver" del CRM). */
export async function getLeadPlan(leadId: number): Promise<LeadPlan> {
  const supabase = (await getTenantDb());
  const { data, error } = await supabase
    .from('leads')
    .select('monto_cierre_usd, duracion_meses, fecha_cierre, fecha_inicio_servicio, contrato_nombre, contrato_path')
    .eq('id', leadId)
    .single();
  if (error) throw new Error(`Error leyendo plan del lead ${leadId}: ${error.message}`);
  const pagos = await getPagosByLead(leadId);
  return {
    total_usd: (data?.monto_cierre_usd as number | null) ?? null,
    duracion_meses: (data?.duracion_meses as number | null) ?? null,
    fecha_cierre: (data?.fecha_cierre as string | null) ?? null,
    fecha_inicio: (data?.fecha_inicio_servicio as string | null) ?? null,
    contrato_nombre: (data?.contrato_nombre as string | null) ?? null,
    tiene_contrato: !!(data?.contrato_path),
    pagos,
  };
}

// El calendario del plan (inicial en el cierre, la cuota N el `dia_de_pago` del mes N, en UTC) vive desde el
// 14/10/2026 en `cuotasDelPlan` (lib/pagos-campo.ts), puro y con tests.

// ─────────────────────────────────────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Reconciliar las cuotas POR ID (14/10/2026, docs/diseno-ficha-bloques.md §3 Pagos)
// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ NINGÚN ESCRITOR DE CUOTAS BORRA E INSERTA. Hasta el 14/10 `saveLeadPlanManual` borraba todas las impagas y
// las volvía a insertar: cada guardado de «Editar deal» le cambiaba el id a cada cuota, y de ese id cuelgan el
// link que la salda (`cobros.pago_id`, que el FK pone en null), el corte de la cobranza al pagarla
// (`cerrarCorridasDeCuota` busca `ctx.cuotaId`: el recordatorio de la cuota «vieja» seguía saliendo después del
// pago) y el dedup del recordatorio (`cuota:${pago_id}`, lib/cobranza.ts: la «nueva» volvía a entrar). La regla
// de qué se actualiza, qué se inserta y qué se borra es `reconciliarCuotas` (lib/pagos-campo.ts, pura y con
// tests); acá sólo se lee lo que protege a una cuota y se escribe.

/**
 * ⚠️ EL LEAD TIENE QUE SER DE ESTE NEGOCIO antes de escribirle una cuota (auditoría de seguridad del 14/10/2026).
 * `getTenantDb` estampa el workspace en el insert, pero `pagos.lead_id` sólo tiene FK a `leads(id)` y el índice
 * único (lead_id, numero) es GLOBAL: con el id de un lead de OTRO negocio (los ids son secuenciales), la fila
 * entraba en el cash de éste apuntando a una persona ajena, sin un error; el join `leads(nombre, …)` de
 * Outstanding y de las alertas traía el nombre y el monto de ese lead ajeno; y el dueño real ya no podía numerar
 * sus propias cuotas (el insert chocaba con el índice). Un update o un select filtrados por workspace no avisan
 * (0 filas, sin error), así que el corte es leer el lead y tirar si no está.
 * Vive acá y no en la pantalla: la ficha, la API de MaKo y la pasarela escriben por estas funciones.
 * El nombre es el mismo que en la rama crm-bloques (wtc-b2) para que las dos converjan al integrar.
 */
export async function asegurarLeadDelNegocio(leadId: number): Promise<void> {
  if (!Number.isInteger(leadId) || leadId <= 0) throw new Error('Lead inválido.');
  const { data, error } = await (await getTenantDb()).from('leads').select('id').eq('id', leadId).maybeSingle();
  if (error) throw new Error(`No pude leer el lead ${leadId}: ${error.message}`);
  if (!data) throw new Error('No encontré ese lead en este negocio.');
}

/**
 * Guarda el plan de pagos de un lead y (re)genera las filas de `pagos`.
 * Qué protege a cada cuota impaga: un link sin pagar que la salda (`cobros.pago_id`, pendiente o rechazado) o
 * un recordatorio de cobranza abierto (`flujo_corridas.ctx.cuotaId`, pendiente).
 *
 * ⚠️ TIRA si no pudo leer: «no pude ver si tiene un link» NO es «no tiene». Con un default vacío, una falla de
 * lectura dejaba borrar la cuota de un link que el cliente está por pagar.
 * El riesgo de que eso trabara SIEMPRE guardar cuotas y cerrar en Ganado era que PostgREST rechazara el `.in` sobre
 * `ctx->>cuotaId`. Medido el 17/10/2026 contra producción (sólo lectura): lo acepta (200) y filtra bien un `in` sobre
 * un camino jsonb (docs/hallazgos-pagos.md). Lo que queda es una falla PASAJERA: contesta el error y se reintenta.
 */
export async function proteccionesDeCuotas(leadId: number, ids: readonly number[]): Promise<Map<number, Proteccion[]>> {
  const out = new Map<number, Proteccion[]>();
  if (!ids.length) return out;
  const db = await getTenantDb();
  const marcar = (id: number, p: Proteccion) => { const l = out.get(id) ?? []; if (!l.includes(p)) l.push(p); out.set(id, l); };
  const [links, corridas] = await Promise.all([
    db.from('cobros').select('pago_id').eq('lead_id', leadId).in('estado', ['pendiente', 'fallido']).in('pago_id', [...ids]),
    db.from('flujo_corridas').select('ctx').eq('estado', 'pendiente').in('ctx->>cuotaId', ids.map(String)),
  ]);
  if (links.error) throw new Error(`No pude revisar los links de pago de las cuotas: ${links.error.message}`);
  if (corridas.error) throw new Error(`No pude revisar los recordatorios de las cuotas: ${corridas.error.message}`);
  for (const r of (links.data ?? []) as Array<{ pago_id: number | null }>) if (r.pago_id != null) marcar(Number(r.pago_id), 'link');
  for (const r of (corridas.data ?? []) as Array<{ ctx: { cuotaId?: unknown } | null }>) {
    const id = Number(r.ctx?.cuotaId);
    if (Number.isFinite(id) && ids.includes(id)) marcar(id, 'recordatorio');
  }
  return out;
}

/** Las cuotas del trato (la casa o un CRM agregado) como las lee `reconciliarCuotas`, con lo que protege a cada impaga. */
async function cuotasParaReconciliar(leadId: number, crm: Crm): Promise<CuotaExistente[]> {
  const pagos = await getPagosByLead(leadId, crm);
  const prot = await proteccionesDeCuotas(leadId, pagos.filter((q) => !q.pagado).map((q) => q.id));
  // La misma forma con que la propuesta de MaKo simula la reconciliación (`cuotaExistenteDe`, lib/pagos-campo.ts).
  return pagos.map((q) => cuotaExistenteDe(q, prot.get(q.id) ?? []));
}

/**
 * Escribe lo que decidió `reconciliarCuotas`: primero actualiza por id, después inserta y AL FINAL borra. Si algo
 * falla a mitad de camino, quedan cuotas de más (se ven y se quitan), nunca de menos (una deuda que desaparece).
 * Cada escritura lleva `lead_id` y `pagado = false`: una cuota que se cobró mientras tanto no se pisa ni se borra.
 */
async function escribirReconciliacion(leadId: number, plan: PlanDeCuotas, crm: Crm): Promise<void> {
  const db = await getTenantDb();
  // La moneda va sólo si la reconciliación la trae (el plan por tramos): sin la clave, la de la cuota no se toca.
  const moneda = (x: { moneda?: string | null; monto_original?: number | null }) => ('moneda' in x && x.moneda !== undefined ? { moneda: x.moneda, monto_original: x.monto_original ?? null } : {});
  for (const u of plan.actualizar) {
    const { error } = await db.from('pagos').update({ monto_usd: u.monto_usd, fecha_esperada: u.fecha_esperada, ...moneda(u) })
      .eq('id', u.id).eq('lead_id', leadId).eq('pagado', false);
    if (error) throw new Error(`Error actualizando la cuota ${u.id}: ${error.message}`);
  }
  if (plan.insertar.length) {
    // La de un CRM agregado lleva su CRM (mig 0324); la de la casa la completa el trigger `pagos_funnel`.
    const rows = plan.insertar.map((i) => ({ ...moneda(i), lead_id: leadId, numero: i.numero, monto_usd: i.monto_usd, fecha_esperada: i.fecha_esperada, ...(crm != null ? { funnel_id: crm } : {}) }));
    const { error } = await db.from('pagos').insert(rows);
    if (error) throw new Error(crm != null && faltaIndicePorCrm(error) ? FALTA_0324 : `Error guardando cuotas del lead ${leadId}: ${error.message}`);
  }
  if (plan.borrar.length) {
    const { error } = await db.from('pagos').delete().in('id', plan.borrar.map((b) => b.id)).eq('lead_id', leadId).eq('pagado', false);
    if (error) throw new Error(`Error quitando cuotas del lead ${leadId}: ${error.message}`);
  }
  await olvidarAvisosDeCuotas(cuotasReprogramadas(plan.actualizar));
}

// `DEDUP_OLVIDADO` (lib/cobranza.ts): un instante viejo, el dedup lo lee como «salió hace mucho» y la cuota puede
// volver a entrar. Vive allá porque el Deshacer también lo lee (`marcaAlDeshacer`).

/**
 * Deja que una cuota REPROGRAMADA vuelva a entrar a la cobranza (`cuotasReprogramadas`, lib/cobranza.ts): el dedup
 * de sus dos avisos pasa a «salió hace mucho». Se hace con compare-and-set contra lo que se leyó, la misma
 * operación con que el cron reclama, así que un cron que justo la está reclamando gana y no sale dos veces.
 *
 * No tira: si falla, la cuota queda como estaba antes de esto (sin recordatorio de la fecha nueva), y eso no
 * puede tumbar la edición que ya se escribió. Sin negocio no hace nada: `app_settings` caería al ws1.
 */
async function olvidarAvisosDeCuotas(pagoIds: readonly number[]): Promise<void> {
  if (!pagoIds.length) return;
  try {
    if ((await getWorkspaceActual()) == null) return;
    for (const id of pagoIds) {
      for (const aviso of AVISOS_DE_CUOTA) {
        const key = keyEspaciado(aviso, claveDedupCuota(id));
        const previo = await getSettingEstricto(key);
        if (previo && previo !== DEDUP_OLVIDADO) await cambiarSettingSi(key, previo, DEDUP_OLVIDADO);
      }
    }
  } catch (e) {
    console.error(`[pagos] no pude reabrir la cobranza de las cuotas ${pagoIds.join(', ')}:`, e instanceof Error ? e.message : e);
  }
}

/**
 * Las marcas de dedup de cobranza de estas cuotas, tal como están (null = sin marca). Es la mitad de la foto del
 * Deshacer que `olvidarAvisosDeCuotas` pisa al reprogramar. null = no se pudieron leer (sin negocio, o la base).
 */
export async function leerMarcasDeCobranza(pagoIds: readonly number[]): Promise<MarcasDeCobranza | null> {
  try {
    if ((await getWorkspaceActual()) == null) return null;
    const out: MarcasDeCobranza = {};
    for (const id of pagoIds) {
      const marcas: Record<string, string | null> = {};
      for (const aviso of AVISOS_DE_CUOTA) marcas[aviso] = await getSettingEstricto(keyEspaciado(aviso, claveDedupCuota(id)));
      out[String(id)] = marcas;
    }
    return out;
  } catch (e) {
    console.error('[pagos] no pude leer las marcas de cobranza:', e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * El Deshacer de un movimiento que reprogramó cuotas: cada marca vuelve a la de ANTES (`marcaAlDeshacer`), con
 * compare-and-set contra la del olvido, así que un aviso que salió en el medio gana. Una cuota sin marcas en la foto
 * no se toca. No tira: la cuota ya volvió a su fecha.
 */
export async function reponerMarcasDeCobranza(antes: MarcasDeCobranza, pagoIds: readonly number[]): Promise<void> {
  try {
    if (!pagoIds.length || (await getWorkspaceActual()) == null) return;
    for (const id of pagoIds) {
      const foto = antes[String(id)];
      if (!foto) continue;
      for (const aviso of AVISOS_DE_CUOTA) {
        const key = keyEspaciado(aviso, claveDedupCuota(id));
        const accion = marcaAlDeshacer(foto[aviso] ?? null, await getSettingEstricto(key));
        if (accion && 'poner' in accion) await cambiarSettingSi(key, DEDUP_OLVIDADO, accion.poner);
        else if (accion) await borrarSettingSi(key, DEDUP_OLVIDADO);
      }
    }
  } catch (e) {
    console.error(`[pagos] no pude reponer la cobranza de las cuotas ${pagoIds.join(', ')}:`, e instanceof Error ? e.message : e);
  }
}

/**
 * Reconcilia una lista de cuotas impagas de UN trato y sincroniza lo cobrado. Devuelve lo que hizo (y lo que NO tocó).
 * `crm`: el CRM agregado cuyo plan se toca (mig 0324); sin él, el de la casa. Los números son los de ESE trato.
 */
export async function reconciliarYGuardar(
  leadId: number, deseadas: readonly CuotaDeseada[], modo: ModoReconciliar,
  opts: { soloNumeros?: ReadonlySet<number>; vistos?: ReadonlySet<number>; crm?: Crm; protegidasPrimero?: boolean; sobreLoVisto?: boolean } = {},
): Promise<PlanDeCuotas> {
  await asegurarLeadDelNegocio(leadId);
  const crm = opts.crm ?? null;
  const existentes = await cuotasParaReconciliar(leadId, crm);
  // ⚠️ UN PLAN ENTERO SE GUARDA SÓLO SOBRE EL QUE SE VIO (`sobreLoVisto`, el plan por tramos; revisión de 9fc4030dd, media). Con
  // dos pestañas abiertas, las cuotas nuevas de la primera eran «nuevas» para la segunda, que las conservaba y agregaba las suyas:
  // 3 cuotas pedidas «5» dos veces quedaban en 7. Si el plan tiene una impaga que la pantalla no vio, no se escribe nada.
  if (opts.sobreLoVisto && opts.vistos) {
    const cambio = planCambiadoAfuera(existentes, opts.vistos);
    if (cambio) throw new Error(cambio);
  }
  const plan = reconciliarCuotas(existentes, deseadas, modo, opts);
  await escribirReconciliacion(leadId, plan, crm);
  await sincronizarTotalCobrado(leadId);
  return plan;
}

/**
 * Las cuotas impagas de una pantalla que manda el ID de cada una (Editar deal, `saveCuotasAction`): la que trae
 * id se actualiza POR ID, la que no se inserta, y la impaga que no vino se borra — salvo que tenga un link sin
 * pagar o un recordatorio corriendo, que se conserva y se devuelve en `conservar`. NO gana el lead: ganarlo es
 * mover de etapa, no guardar cuotas.
 */
export async function guardarCuotasPorId(
  leadId: number,
  cuotas: ReadonlyArray<CuotaDeseada>,
  opts: { vistos?: ReadonlySet<number>; crm?: Crm; protegidasPrimero?: boolean; sobreLoVisto?: boolean } = {},
): Promise<PlanDeCuotas> {
  return reconciliarYGuardar(leadId, cuotas, 'porId', opts);
}

/**
 * El plan POR TRAMOS desde la API de MaKo (`armar_plan_por_tramos`; ticket #26 de Mauricio, 29/10/2026). Lee las cuotas y sus
 * protecciones AHORA, arma la lista con la MISMA regla que «Guardar el plan» de la ficha (`planPorTramosDelServer`) y la guarda POR
 * ID sobre lo que leyó (`sobreLoVisto`: si otro la cambió en el medio, no escribe nada). Después, las columnas del plan del lead y
 * el historial. Sólo el plan de la casa, de un pago único: una suscripción se pasa antes a pago único (`escribirVenta`), como en
 * la ficha. NO gana el lead ni toca el monto de la venta.
 */
export async function guardarPlanPorTramos(
  leadId: number,
  /** `vistas`: las impagas que se leyeron al PROPONER, con su firma (revisión de 805afb460, N1, y de 7f79a4e6c, B8). Si alguna
   *  cambió, no se escribe nada. Obligatorias: sin ellas regía la regla vieja (B9). */
  p: { desde: string; tramos: readonly TramoPlan[]; anticipo: AnticipoPlan | null; vistas: readonly CuotaVista[] },
  autor: string,
): Promise<{ cambios: PlanDeCuotas; cuotas: number; nuevas: number; cubiertas: number; sinTocar: string | null }> {
  await asegurarLeadDelNegocio(leadId);
  const lead = await getLead(leadId);
  if (!lead) throw new Error('Ese lead no existe en este negocio.');
  const tipo = ventaTipoDe(lead.venta_tipo);
  if (tipo !== 'unico') throw new Error(tipo === 'suscripcion' ? 'Es una suscripción: pásala a pago único antes de armarle cuotas.' : 'Está como becado (sin cobro): no tiene cuotas que armar.');
  const pagos = await getPagosByLead(leadId);
  const cambio = planCambioDesde(pagos, p.vistas);
  if (cambio) throw new Error(cambio);
  const prot = await proteccionesDeCuotas(leadId, pagos.filter((q) => !q.pagado && !noEsDeuda(q)).map((q) => q.id));
  const armado = planPorTramosDelServer({
    pagos, protegidas: new Set([...prot].filter(([, x]) => x.length > 0).map(([id]) => id)),
    planConInicial: (Number(lead.cobro_inicial_usd) || 0) > 0, cobroInicialUsd: lead.cobro_inicial_usd ?? null,
    desde: p.desde, tramos: p.tramos, anticipo: p.anticipo,
  });
  if (!armado.ok) throw new Error(armado.error);
  // Dos «sí» a la vez: el segundo choca con el número de una cuota que el primero acaba de crear (revisión de 805afb460, B6). No
  // duplica nada, pero contestaba el error crudo de la base.
  const cambios = await guardarCuotasPorId(leadId, armado.deseadas, { vistos: new Set(p.vistas.map((v) => v.id)), protegidasPrimero: true, sobreLoVisto: true })
    .catch((e: unknown) => {
      if (/pagos_lead_numero|duplicate key|23505/.test(e instanceof Error ? e.message : String(e))) throw new Error('Otro guardado del mismo plan llegó a la vez y éste no terminó: revisa las cuotas en la ficha antes de pedirlo otra vez.');
      throw e;
    });
  const { error } = await (await getTenantDb()).from('leads').update({ ...planComoEstaba(armado.columnas) }).eq('id', leadId);
  if (error) throw new Error(`Las cuotas quedaron, pero no pude guardar el plan del lead: ${error.message}`);
  await anotarEnHistorial(leadId, lineasDeCuotas(cambios), autor);
  const sinTocar = avisoDeConservadas(cambios);
  await logLeadEvent(leadId, 'Plan de pagos', `Plan por tramos: ${armado.lista.length} cuota(s)${sinTocar ? ` · no se tocó: ${sinTocar}` : ''}`, autor);
  return { cambios, cuotas: armado.lista.length, nuevas: armado.nuevas, cubiertas: armado.cubiertas, sinTocar };
}

export type ResultadoPlan = { pagos: Pago[]; cambios: PlanDeCuotas };

/**
 * Arma o ajusta el plan UNIFORME (inicial, cuota, cantidad y día de pago) y reconcilia sus cuotas por número:
 * la cuota N que ya existe se actualiza POR ID, la que falta se inserta, la que sobra se borra si no tiene link
 * ni recordatorio, y las cobradas no se tocan (cubren su número). NO gana el lead.
 *
 * fecha base = fecha_cierre del lead (o hoy si no hay). El inicial vence en la fecha del cierre; la cuota N vence
 * el `dia_de_pago` del mes N siguiente (el calendario de siempre, `cuotasDelPlan`).
 *
 * Con `opts.antes` (el plan que había: un AJUSTE desde la ficha) se aplica sólo la DIFERENCIA (`diferenciaDePlan`):
 * no se pisa una cuota movida a mano ni se borra una que no es del plan. Sin él (el wizard de Ganado, la API
 * `guardar_plan_pagos`), el plan se reimpone entero, como siempre.
 */
export async function ajustarPlanPagos(leadId: number, plan: PlanUniforme, hoy: string, opts: { antes?: PlanUniforme; crm?: Crm } = {}): Promise<ResultadoPlan> {
  // ⚠️ EL LEAD TIENE QUE SER DE ESTE NEGOCIO antes de escribirle una cuota (auditoría del 14/10/2026).
  // Va acá y no en savePlanPagos porque éste es el choke point: por acá escriben savePlanPagos y la
  // server action de pagos campo por campo, que recibe el leadId del navegador. El `.single()` de abajo
  // tira con un lead ajeno, pero es una guarda por accidente: pasarlo a `maybeSingle()` la borraría sin
  // que nada falle. Al integrar la rama de Pagos (anterior a la auditoría) esta llamada se habría perdido.
  await asegurarLeadDelNegocio(leadId);
  const supabase = (await getTenantDb());
  const crm = opts.crm ?? null;
  const columnas = { cobro_inicial_usd: plan.cobro_inicial_usd, monto_cuota_usd: plan.monto_cuota_usd, total_cuotas: plan.total_cuotas, dia_de_pago: plan.dia_de_pago };
  let base: string;
  if (crm != null) {
    // EL PLAN DE UN CRM AGREGADO (mig 0324): su fecha de cierre y sus columnas son las de su fila de `lead_funnel`.
    const t = await filaDelTrato(leadId, crm);
    if (!t) throw new Error('Este lead ya no está en ese CRM. Recarga la ficha.');
    base = t.fecha_cierre ?? hoy;
    const { error } = await supabase.from('lead_funnel').update({ ...columnas, updated_at: new Date().toISOString() }).eq('id', t.id);
    if (error) throw new Error(/column|columna/i.test(error.message) ? FALTA_0324 : `Error guardando el plan de este CRM: ${error.message}`);
  } else {
    const { data: leadRow, error: leadErr } = await supabase.from('leads').select('fecha_cierre').eq('id', leadId).single();
    if (leadErr) throw new Error(`Error leyendo lead ${leadId}: ${leadErr.message}`);
    base = (leadRow?.fecha_cierre as string | null) ?? hoy;
    const { error: planErr } = await supabase.from('leads').update(columnas).eq('id', leadId);
    if (planErr) throw new Error(`Error guardando plan del lead ${leadId}: ${planErr.message}`);
  }

  let cambios: PlanDeCuotas;
  if (opts.antes) {
    const { deseadas, tocar } = diferenciaDePlan(opts.antes, plan, base);
    cambios = await reconciliarYGuardar(leadId, deseadas, 'slots', { soloNumeros: tocar, crm });
  } else {
    cambios = await reconciliarYGuardar(leadId, cuotasDelPlan(plan, base), 'slots', { crm });
  }
  return { pagos: await getPagosByLead(leadId, crm), cambios };
}

/**
 * Guarda el plan de pagos de un lead y (re)genera las filas de `pagos`. Lo llaman el wizard de Ganado
 * (app/crm/actions.ts), `savePlanPagosAction` y la API (`guardar_plan_pagos`): es `ajustarPlanPagos` con la firma
 * de siempre. Desde el 14/10/2026 no borra una cuota con un link sin pagar ni con un recordatorio corriendo.
 */
export async function savePlanPagos(
  leadId: number,
  plan: PlanPagos,
  hoy?: string,
): Promise<Pago[]> {
  // ⚠️ NO SE ARMA ENCIMA DE PLATA SUELTA SIN PLAN (21/10/2026, quinta revisión): la seña de US$100 (número 1) tapaba la
  // cuota 1 de US$1.000 y la API contestaba «Listo» con US$900 menos. La MISMA regla que el asistente de Ganado
  // (`avisoPlanUniforme` → `pagosPrevios`, lib/pagos-campo.ts): se arma en la tab Pagos, viendo lo cobrado.
  const aviso = avisoPlanUniforme(await getPagosByLead(leadId));
  if (aviso) throw new Error(aviso);
  // Sin `hoy`, el del NEGOCIO (20/10/2026): el default era el día UTC, que de noche en México ya es mañana.
  return (await ajustarPlanPagos(leadId, plan, hoy ?? (await hoyEnWorkspace()))).pagos;
}

/**
 * Plan MANUAL desde el CRM: guarda las cuotas TAL CUAL (cada una su monto y su
 * fecha), sin la generación uniforme de savePlanPagos. Persiste también total,
 * duración y fechas del lead. Conserva las cuotas ya pagadas (no se tocan); las
 * no pagadas se RECONCILIAN con la lista nueva (ver `reconciliarCuotas`, modo 'lista').
 *
 * ⚠️ GANA EL LEAD, y por eso desde el 14/10/2026 sólo lo llaman los caminos que CIERRAN la venta: el wizard de
 * Ganado (`completeStageMoveAction`, app/crm/actions.ts) y la API `guardar_cuotas`, que lo avisa en su resumen.
 * Guardar cuotas desde una pantalla (Editar deal, los bloques de Pagos) es `guardarCuotasPorId`, que no gana.
 */
export type PlanManual = {
  total_usd: number | null;
  duracion_meses: number | null;
  fecha_cierre: string | null;   // YYYY-MM-DD
  fecha_inicio: string | null;   // YYYY-MM-DD
  cuotas: Array<{ monto_usd: number; fecha_esperada: string | null }>;
};

export async function saveLeadPlanManual(leadId: number, p: PlanManual): Promise<PlanDeCuotas> {
  // ⚠️ EL LEAD TIENE QUE SER DE ESTE NEGOCIO (auditoría del 14/10/2026). El maybeSingle y el update de
  // abajo, con un lead ajeno, dan null y 0 filas SIN error, y las cuotas se insertaban igual con el
  // lead_id del otro negocio. La rama de Pagos es anterior a la auditoría y no la traía.
  await asegurarLeadDelNegocio(leadId);
  const supabase = (await getTenantDb());

  // El plan de pagos pertenece a un lead GANADO: dejamos el desenlace coherente
  // (estado_lead/cerro) para que Sold Revenue y los cierres lo cuenten siempre.
  // ⚠️ ESTE UPDATE TAMBIÉN GANA: no pasa por updateLead, así que el enganche «al ganar» (la
  // invitación automática al curso, lib/crm-curso-al-ganar.ts) se llama acá. Por eso se lee
  // el estado de ANTES: sólo la transición invita, y guardar las cuotas de un ganado no.
  const { data: antes } = await supabase.from('leads').select('estado_lead, funnel_id, fecha_cierre, pipeline_stage').eq('id', leadId).maybeSingle();
  const leadUpdate: Record<string, unknown> = { estado_lead: 'ganado', cerro: true };
  // ⚠️ Y SI LA TARJETA TENÍA SU COLUMNA GUARDADA (Perdido, o una etapa abierta), VUELVE A LA DERIVACIÓN (27/10/2026, el
  // lead 2371): ganaba acá y la tarjeta seguía en «Perdido» mientras Customer Success lo contaba como cliente
  // (`etapaContradiceElEstado`, lib/pipeline.ts). Sólo en la transición: re-guardar el plan de un ganado no la toca.
  const previa = antes as { estado_lead?: string | null; pipeline_stage?: string | null } | null;
  if (previa && previa.estado_lead !== 'ganado' && etapaContradiceElEstado(previa.pipeline_stage, 'ganado')) leadUpdate.pipeline_stage = null;
  if (p.total_usd != null) leadUpdate.monto_cierre_usd = p.total_usd;
  if (p.duracion_meses != null) leadUpdate.duracion_meses = p.duracion_meses;
  // ⚠️ LO QUE GANA LLEVA SU FECHA DE CIERRE (21/10/2026, quinta revisión): una suscripción ganada desde el asistente con
  // su plan quedaba con `fecha_cierre` NULL (este update gana sin ella, y después `setPipelineStage` ve el lead ya
  // ganado y no toca la venta). No contaba en los cierres del mes, el MRR la daba activa para siempre y nunca
  // «Terminó». Sin una fecha que venga ni una que ya tenga, la del día del negocio: la misma con que se anclan sus cuotas.
  if (p.fecha_cierre) leadUpdate.fecha_cierre = p.fecha_cierre;
  else if (!(antes as { fecha_cierre?: string | null } | null)?.fecha_cierre) leadUpdate.fecha_cierre = await hoyEnWorkspace();
  if (p.fecha_inicio) leadUpdate.fecha_inicio_servicio = p.fecha_inicio;
  if (Object.keys(leadUpdate).length > 0) {
    const { error } = await supabase.from('leads').update(leadUpdate).eq('id', leadId);
    if (error) throw new Error(`Error guardando plan del lead ${leadId}: ${error.message}`);
  }
  const previo = antes as { estado_lead: string | null; funnel_id: number | string | null } | null;
  if (previo && pasaAGanado(previo.estado_lead, 'ganado')) {
    try {
      const { alGanarInvitarAlCurso } = await import('./crm-curso-al-ganar');
      await alGanarInvitarAlCurso({ leadId, funnelId: previo.funnel_id == null ? null : Number(previo.funnel_id) });
    } catch (e) {
      console.error(`[pagos] lead ${leadId}: el enganche al ganar falló:`, e instanceof Error ? e.message : e);
    }
  }

  // Conservar cuotas pagadas; las no pagadas se RECONCILIAN con la lista nueva, sin borrar e insertar (ver
  // «Reconciliar las cuotas POR ID» arriba). La lista llega sin ids (el wizard, la API): modo 'lista'.
  return reconciliarYGuardar(leadId, p.cuotas.map((c) => ({ monto_usd: c.monto_usd, fecha_esperada: c.fecha_esperada })), 'lista');
}

/**
 * Edita UNA cuota por su id: el monto, la fecha o los dos, sin borrar ni reinsertar nada (el link, el recordatorio y el
 * dedup siguen apuntando a la misma cuota). En una impaga la fecha es el VENCIMIENTO; en una cobrada a mano, el DÍA DEL
 * PAGO. Devuelve el antes y el después (para el historial y para Deshacer, que llama a esta misma función).
 *
 * ⚠️ SIN TRÁMITES (27/10/2026, Martín: «Los pagos funcionan mal, no tiene LIBERTAD»). Hasta acá se rechazaba y había que
 * hacer otra cosa antes: «desmárcala primero» (una cobrada), «córtalo para editarla» (un recordatorio corriendo), «anúlalo
 * para cambiar el monto» (un link sin pagar). Ahora se edita, y lo que quedaba viejo se arregla solo:
 *   · una cobrada A MANO se corrige en el lugar (monto y día del pago) y lo cobrado del lead se recalcula;
 *   · un recordatorio corriendo se corta (llevaba el monto y la fecha de antes) y la cobranza la vuelve a tomar con los
 *     nuevos (`olvidarAvisosDeCuotas`);
 *   · un link sin pagar, si cambia el MONTO, se anula (cobraría el viejo); si cambia sólo la fecha, sigue.
 * Lo único que no se toca: lo que cobró la PASARELA (su monto es lo que entró por Stripe o Mercado Pago; se corrige
 * devolviéndolo), una cuota devuelta y la de un cliente dado de baja.
 *
 * ⚠️ `espera` DICE QUÉ CUOTA VIO QUIEN LLAMA, y sin ella es «impaga» (revisión adversarial de b335f972c, 27/10/2026). La
 * fecha de una impaga es el vencimiento y la de una cobrada el día del pago: la misma `fecha` decide dos columnas. Con la
 * rama elegida por lo que se LEYÓ, MaKo («pasá la cuota 3 al 15/11», confirmado después de que la cobraron) o una pestaña
 * vieja escribían el vencimiento como `fecha_pago` y el Cash de octubre pasaba a noviembre. Ahora corregir una cobrada es
 * explícito (`espera: 'cobrada'`, el renglón «cobrada el …»), y si la cuota no está como la vio quien llama, tira.
 */
export async function editarCuota(
  leadId: number,
  pagoId: number,
  /** `montoOriginal`: el monto en SU moneda de una impaga en otra moneda (un tramo en pesos); sus dólares son `monto`. */
  cambio: { monto?: number | null; montoOriginal?: number | null; fecha?: string | null; espera?: 'impaga' | 'cobrada' },
): Promise<{ antes: { monto_usd: number; fecha_esperada: string | null; monto_original?: number | null }; despues: { monto_usd: number; fecha_esperada: string | null; monto_original?: number | null }; numero: number; moneda?: string | null; recordatorioCortado?: boolean; linkAnulado?: boolean }> {
  const db = await getTenantDb();
  // `*` y no la lista: `baja_at` (mig 0307) se lee si existe, y una base sin la migración no rompe editar.
  const { data, error } = await db.from('pagos').select('*').eq('id', pagoId).eq('lead_id', leadId).maybeSingle();
  if (error) throw new Error(`Error leyendo la cuota ${pagoId}: ${error.message}`);
  if (!data) throw new Error('Esa cuota no existe en este lead.');
  const q = data as { numero: number; monto_usd: number; fecha_esperada: string | null; fecha_pago?: string | null; pagado: boolean; proveedor: string | null; cobro_id: number | null; baja_at?: string | null; moneda?: string | null; monto_original?: number | string | null };
  if (esCuotaDevuelta(q)) throw new Error('Esa cuota se devolvió: no se edita.');
  if (esCuotaDeBaja(q)) throw new Error('El cliente se dio de baja: deshaz la baja para editar esa cuota.');
  const espera = cambio.espera ?? 'impaga';
  if (q.pagado && espera !== 'cobrada') throw new Error('Esa cuota ya está cobrada (¿se cobró mientras tanto?): recarga y corrígela en su renglón.');
  if (!q.pagado && espera === 'cobrada') throw new Error('La cuota cambió mientras tanto (¿se desmarcó?). Recarga la ficha.');
  if (q.pagado && cambio.montoOriginal !== undefined) throw new Error('El monto en otra moneda de una cobrada se corrige desmarcándola y cobrándola otra vez.');
  if (q.pagado) return editarCuotaCobrada(leadId, pagoId, q, cambio);
  // Una impaga en otra moneda (un tramo en pesos, 29/10/2026) lleva sus dos montos, y se editan por separado: los dos los
  // declara la persona (no hay tasa que inventar). Sin moneda, `montoOriginal` no tiene dónde ir.
  const monedaPropia = q.moneda && q.moneda.toUpperCase() !== 'USD' && q.monto_original != null ? q.moneda.toUpperCase() : null;
  const antes: { monto_usd: number; fecha_esperada: string | null; monto_original?: number | null } = {
    monto_usd: Number(q.monto_usd), fecha_esperada: q.fecha_esperada, ...(monedaPropia ? { monto_original: Number(q.monto_original) } : {}),
  };
  const despues = { ...antes };
  if (cambio.monto !== undefined) {
    const m = Number(cambio.monto);
    if (!Number.isFinite(m) || m <= 0) throw new Error('El monto tiene que ser mayor a cero.');
    despues.monto_usd = centavos(m);
  }
  if (cambio.montoOriginal !== undefined) {
    if (!monedaPropia) throw new Error('Esa cuota es en dólares: cambia su monto.');
    const m = Number(cambio.montoOriginal);
    if (!Number.isFinite(m) || m <= 0) throw new Error('El monto tiene que ser mayor a cero.');
    despues.monto_original = centavos(m);
  }
  if (cambio.fecha !== undefined) {
    if (cambio.fecha != null && !/^\d{4}-\d{2}-\d{2}$/.test(cambio.fecha)) throw new Error('La fecha tiene que ser AAAA-MM-DD.');
    despues.fecha_esperada = cambio.fecha;
  }
  const cambiaMonto = Math.abs(despues.monto_usd - antes.monto_usd) >= 0.005 || Math.abs(Number(despues.monto_original ?? 0) - Number(antes.monto_original ?? 0)) >= 0.005;
  const cambiaFecha = despues.fecha_esperada !== antes.fecha_esperada;
  if (!cambiaMonto && !cambiaFecha) return { antes, despues, numero: q.numero, moneda: monedaPropia };
  const prot = (await proteccionesDeCuotas(leadId, [pagoId])).get(pagoId) ?? [];
  const { data: hecho, error: e2 } = await db.from('pagos').update({ monto_usd: despues.monto_usd, fecha_esperada: despues.fecha_esperada, ...(monedaPropia ? { monto_original: despues.monto_original } : {}) })
    .eq('id', pagoId).eq('lead_id', leadId).eq('pagado', false).select('id');
  if (e2) throw new Error(`Error guardando la cuota ${pagoId}: ${e2.message}`);
  if (!hecho?.length) throw new Error('La cuota cambió mientras tanto (¿se cobró?). Recarga la ficha.');
  // Lo que protegía a la cuota se arregla DESPUÉS de guardarla (si el guardado falla, queda como estaba). Nunca tumba la
  // edición: lo peor es un recordatorio o un link con lo de antes, que es lo que pasaba siempre.
  const ws = prot.length ? await getWorkspaceActual() : null;
  let recordatorioCortado = false;
  if (ws != null && prot.includes('recordatorio')) {
    try {
      const { cerrarCorridasDeCuota } = await import('./flujo-corridas');
      recordatorioCortado = (await cerrarCorridasDeCuota(ws, pagoId)) > 0;
    } catch (e) { console.error(`[pagos] cuota ${pagoId}: no pude cortar su recordatorio:`, e instanceof Error ? e.message : e); }
  }
  // El link anulado NO VUELVE con el Deshacer (revisión de 0b6d5b754, baja): se dice, en el cambio y en el Deshacer.
  let linkAnulado = false;
  if (ws != null && prot.includes('link') && cambiaMonto) {
    try {
      const { anularLinksDeCuota } = await import('./cobros');
      // Sólo si de verdad anuló alguno (revisión de 1f02dd813, baja: lo decía aunque el link ya no estuviera vivo).
      linkAnulado = (await anularLinksDeCuota(ws, pagoId, 'MaKo (cambió el monto de la cuota)')) > 0;
    } catch (e) { console.error(`[pagos] cuota ${pagoId}: no pude anular su link:`, e instanceof Error ? e.message : e); }
  }
  // ⚠️ UN RECORDATORIO CORTADO VUELVE A LA COBRANZA AUNQUE LA FECHA NO CAMBIE (revisión de b335f972c, media): con sólo el
  // monto nuevo, `cuotasReprogramadas` no la devuelve, el dedup `cuota:<id>` seguía «enviado» y el cron la descartaba: la
  // cuota de US$400 se quedaba sin recordatorio, sin que nadie lo dijera.
  const reabrir = cuotasReprogramadas([{ id: pagoId, fecha_esperada: despues.fecha_esperada, antes }]);
  await olvidarAvisosDeCuotas(recordatorioCortado && !reabrir.includes(pagoId) ? [...reabrir, pagoId] : reabrir);
  return { antes, despues, numero: q.numero, moneda: monedaPropia, recordatorioCortado, linkAnulado };
}

/**
 * Corrige una cuota COBRADA A MANO en el lugar (27/10/2026): el monto que entró y el día del pago (`cambio.fecha`). Lo que
 * cobró la pasarela no: ése es el monto que entró por Stripe o Mercado Pago. Lo cobrado del lead se recalcula. En `antes` y
 * `despues`, `fecha_esperada` es el DÍA DEL PAGO (el Deshacer manda lo mismo de vuelta por `editarCuota`).
 */
async function editarCuotaCobrada(
  leadId: number,
  pagoId: number,
  q: { numero: number; monto_usd: number; fecha_pago?: string | null; proveedor: string | null; cobro_id: number | null; moneda?: string | null },
  cambio: { monto?: number | null; fecha?: string | null },
): Promise<{ antes: { monto_usd: number; fecha_esperada: string | null }; despues: { monto_usd: number; fecha_esperada: string | null }; numero: number }> {
  if (q.proveedor || q.cobro_id != null) throw new Error('Esa cuota la cobró la pasarela: su monto es lo que entró. Si hay que corregirla, devuélvela desde su link.');
  const antes = { monto_usd: Number(q.monto_usd), fecha_esperada: q.fecha_pago ? String(q.fecha_pago).slice(0, 10) : null };
  const despues = { ...antes };
  if (cambio.monto !== undefined) {
    const m = Number(cambio.monto);
    if (!Number.isFinite(m) || m <= 0) throw new Error('El monto tiene que ser mayor a cero.');
    despues.monto_usd = centavos(m);
  }
  if (cambio.fecha !== undefined) {
    if (cambio.fecha == null || !/^\d{4}-\d{2}-\d{2}$/.test(cambio.fecha)) throw new Error('El día del pago tiene que ser AAAA-MM-DD.');
    // ⚠️ UN PAGO NO SE CORRIGE AL FUTURO (14/11/2026, Mauricio): «cobrada el 30/11» era su manera de devolver a pendiente
    // una cuota que no había pagado. Se dice cómo se hace (pagos-campo.ts → `diaDePagoFuturo`). Sólo si la fecha cambia:
    // una que ya quedó en el futuro igual deja corregir su monto.
    if (cambio.fecha !== antes.fecha_esperada) {
      const futuro = diaDePagoFuturo(cambio.fecha, await hoyEnWorkspace());
      if (futuro) throw new Error(futuro);
    }
    despues.fecha_esperada = cambio.fecha;
  }
  const cambiaMonto = Math.abs(despues.monto_usd - antes.monto_usd) >= 0.005;
  if (!cambiaMonto && despues.fecha_esperada === antes.fecha_esperada) return { antes, despues, numero: q.numero };
  // Lo último que se dijo del cobro manda (la regla de `cobrarCuota`): un monto nuevo en dólares deja vieja la moneda y el
  // monto original («MX$8.600 · US$480» era una equivalencia falsa en los movimientos).
  const upd: Record<string, unknown> = { monto_usd: despues.monto_usd, fecha_pago: despues.fecha_esperada };
  if (cambiaMonto && q.moneda) { upd.moneda = null; upd.monto_original = null; }
  const db = await getTenantDb();
  const { data: hecho, error } = await db.from('pagos').update(upd)
    .eq('id', pagoId).eq('lead_id', leadId).eq('pagado', true).select('id');
  if (error) throw new Error(`Error guardando la cuota ${pagoId}: ${error.message}`);
  if (!hecho?.length) throw new Error('La cuota cambió mientras tanto (¿se desmarcó?). Recarga la ficha.');
  await sincronizarTotalCobrado(leadId);
  return { antes, despues, numero: q.numero };
}

/**
 * Corta los recordatorios de cobranza de UNA cuota del lead (el «Cortarlo» del bloque `recordatorios-de-cobro`):
 * es el mismo corte que hace `marcarPago` al cobrarla. La cuota tiene que ser de ese lead: el id llega de afuera.
 */
export async function cortarRecordatoriosDeCuota(leadId: number, pagoId: number): Promise<number> {
  const db = await getTenantDb();
  const { data, error } = await db.from('pagos').select('id').eq('id', pagoId).eq('lead_id', leadId).maybeSingle();
  if (error) throw new Error(`Error leyendo la cuota ${pagoId}: ${error.message}`);
  if (!data) throw new Error('Esa cuota no existe en este lead.');
  const ws = await getWorkspaceActual();
  if (ws == null) throw new Error('Sin negocio.');
  const { cerrarCorridasDeCuota } = await import('./flujo-corridas');
  // `tirar`: este corte lo pide una persona, y «no pude escribir» no es «no había nada que cortar» (revisión del
  // 14/10/2026: la API contestaba eso ante un 5xx, y después editarCuota rechazaba por «recordatorio en curso»).
  return cerrarCorridasDeCuota(ws, pagoId, { tirar: true });
}

/**
 * ⚠️ AL COBRAR UNA CUOTA SE ANULAN SUS LINKS SIN PAGAR (`anularLinksDeCuota`, lib/cobros.ts): un link vivo de una
 * cuota ya cobrada se podía pagar otra vez (revisión del 14/10/2026). Lo llama `marcarPago`, que es por donde pasan
 * la ficha, el doer, la API y la pasarela. Si la salda la pasarela, su propio cobro (`cobro_id`) queda afuera.
 * Desmarcar no los reabre: un link anulado no vuelve. No tira: lo peor es que el link siga vivo, como antes.
 */
async function anularLinksAlCobrar(pagoId: number, cobroId: number | null): Promise<void> {
  try {
    const ws = await getWorkspaceActual();
    if (ws == null) return;
    const { anularLinksDeCuota } = await import('./cobros');
    const n = await anularLinksDeCuota(ws, pagoId, 'MaKo (la cuota ya se cobró)', cobroId == null ? null : Number(cobroId));
    if (n) console.log(`[pagos] cuota ${pagoId} pagada → ${n} link(s) de pago anulado(s)`);
  } catch (e) {
    console.error('[pagos] no pude anular los links de la cuota:', e instanceof Error ? e.message : String(e));
  }
}

/**
 * Marca un pago como cobrado (o lo revierte). Sincroniza total_cobrado_usd y
 * fecha_primer_pago del lead.
 */
/**
 * ⚠️ DESHACER UNA CUOTA QUE NACIÓ COBRADA LA QUITA (mig 0295, 16/10/2026). Un pago suelto o una mensualidad registrada
 * a mano nacen con vencimiento = el día del pago: desmarcarlos los dejaba VENCIDOS («Debe $X», y la cobranza los
 * recordaba) por una deuda que nunca existió. Sólo lo cargado a mano: lo de la pasarela se revierte con «Devolver».
 *
 * Se quita por el ÚNICO borrado de cuotas, el de la reconciliación (`guardarCuotasPorId`, con esa cuota como la única
 * vista), que ya la ve impaga: ningún escritor borra cuotas por su cuenta (tests/pagos-escritura.test.ts). Si algo la
 * protege (un link sin pagar, un recordatorio corriendo), queda impaga como antes y se devuelve false.
 * `marcarPago` lee la cuota con `*`: sin la mig 0295 la columna no existe, y pedirla por nombre rompía todo marcar.
 */
async function quitarSiNacioCobrada(pagoId: number, fila: { lead_id: number; cobro_id?: number | null; proveedor?: string | null; nacio_cobrada?: boolean | null; funnel_id?: number | null }): Promise<boolean> {
  if (fila.nacio_cobrada !== true || fila.proveedor || fila.cobro_id != null) return false;
  // ⚠️ EN SU TRATO (revisión del 22/10/2026, A1): reconciliado contra la casa, el pago suelto de una renovación no se
  // encontraba, quedaba impago y vencido el día que se cobró, y aparecía como deuda en «A quién cobrarle» y en la cobranza.
  const crm = await tratoDelPago(fila.lead_id, fila.funnel_id);
  const cambios = await guardarCuotasPorId(fila.lead_id, [], { vistos: new Set([pagoId]), crm });
  return cambios.borrar.some((b) => b.id === pagoId);
}

/**
 * ⚠️ APAGADO. APAGADO por la revisión adversarial del 17/10/2026 (scratchpad/revision-b4.md, cosechada en el relevo del área): se prende SÓLO con su arreglo y su revisión.
 * Defecto: con un link en estado «pagado», `asentarLinkPagadoDeCuota` da la cuota por cobrada aunque
 * `aplicarPagoAprobado` no marque nada: una cuota destildada por error ya no se puede volver a marcar (queda impaga para
 * siempre) y cada intento repite «Entró un pago». Con esto en false, marcar a mano es lo de antes del 17/10.
 */
export const MIRAR_LINK_ANTES_DE_MARCAR: boolean = false;

/**
 * ¿Un link de esta cuota ya se COBRÓ y todavía no se asentó? Si sí, lo asienta por el camino de la pasarela y
 * devuelve cuál (la cuota ya está cobrada con ESE pago: no se marca a mano). La regla vive en
 * `asentarLinkPagadoDeCuota` (lib/cobros.ts). Si no se pudo mirar (sin workspace, la base no contestó), null: la marca
 * a mano sigue como siempre, porque trabarla es peor (docs/hallazgos-pagos.md §4).
 */
async function linkYaPagado(pagoId: number): Promise<Pasarela | null> {
  if (!MIRAR_LINK_ANTES_DE_MARCAR) return null; // apagado: se marca a mano como siempre
  try {
    const ws = await getWorkspaceActual();
    if (ws == null) return null;
    const { asentarLinkPagadoDeCuota } = await import('./cobros');
    const r = await asentarLinkPagadoDeCuota(ws, pagoId);
    return r.asentado ? r.pasarela : null;
  } catch (e) {
    console.error(`[pagos] no pude mirar los links de la cuota ${pagoId} antes de marcarla:`, e instanceof Error ? e.message : String(e));
    return null;
  }
}

/**
 * La cuota sólo si SIGUE como estaba: impaga (`IS NOT TRUE`: una fila vieja sin `pagado` cuenta como impaga, igual que
 * `Boolean(pago.pagado)`) o cobrada (`IS TRUE`). Con `.select('id')`, cero filas = otra escritura llegó antes.
 */
function siSigue<Q extends { not: (c: string, op: string, v: boolean) => Q; is: (c: string, v: boolean) => Q }>(q: Q, impaga: boolean): Q {
  return impaga ? q.not('pagado', 'is', true) : q.is('pagado', true);
}

/**
 * Lo que pasa DESPUÉS de cobrar una cuota, la marque quien la marque (`marcarPago`, `cobrarCuota`).
 *
 * ⚠️ COBRAR CORTA EL RECORDATORIO, y por eso vive acá y no en la pantalla: el pago se marca desde la ficha, desde el
 * doer de WhatsApp y desde la API, y una cura puesta en un call site deja los otros dos mandando cobranza sobre algo ya
 * cobrado. Es la mitad de la tarjeta #19 que dice «sin que nadie la pause a mano». Desmarcar no la reabre: las corridas
 * cerradas no vuelven a `pendiente`, y reabrirla sería mandar de nuevo los mensajes que ya salieron.
 */
/**
 * «Ya estaba así»: no se toca la cuota, pero se CURA lo de después, que es idempotente (21/10/2026, revisión adversarial).
 * Si un intento anterior tomó la cuota y se cortó antes de sincronizar o de cortar los recordatorios, el reintento le
 * daba «ya estaba» y nada se arreglaba: lo cobrado del lead quedaba desfasado y los recordatorios, vivos.
 */
async function yaEstabaAsi(pagoId: number, pago: { lead_id: unknown; cobro_id?: unknown }, cobrada: boolean): Promise<{ quitada: false; porLink: null; yaEstaba: true }> {
  await curarDespues(pagoId, Number(pago.lead_id), cobrada, pago.cobro_id == null ? null : Number(pago.cobro_id));
  return { quitada: false, porLink: null, yaEstaba: true };
}

/** Sincronizar lo cobrado del lead y, si la cuota está cobrada, `trasCobrar`. Las dos cosas se pueden repetir. */
async function curarDespues(pagoId: number, leadId: number, cobrada: boolean, cobroId: number | null): Promise<void> {
  // ⚠️ CORTAR PRIMERO (21/10/2026, segunda revisión adversarial): `trasCobrar` no tira y sincronizar sí. En el otro orden,
  // una falla al sincronizar dejaba sin cortar los recordatorios y sin anular el otro link, y como el reintento de la
  // pasarela volvía «ya estaba» sin curar, al cliente que pagó le seguían llegando, y podía pagar dos veces.
  if (cobrada) await trasCobrar(pagoId, cobroId);
  await sincronizarTotalCobrado(leadId);
}

async function trasCobrar(pagoId: number, cobroId: number | null): Promise<void> {
  try {
    const ws = await getWorkspaceActual();
    if (ws != null) {
      const { cerrarCorridasDeCuota } = await import('./flujo-corridas');
      const n = await cerrarCorridasDeCuota(ws, pagoId);
      if (n) console.log(`[pagos] cuota ${pagoId} pagada → ${n} recordatorio(s) cortado(s)`);
    }
  } catch (e) {
    // Que falle el corte no puede tumbar el registro del pago: lo peor que pasa es
    // que el recordatorio siguiente salga, y eso se ve. Perder el pago, no.
    console.error('[pagos] no pude cortar los recordatorios:', e instanceof Error ? e.message : String(e));
  }
  await anularLinksAlCobrar(pagoId, cobroId);
}

export async function marcarPago(
  pagoId: number,
  pagado: boolean,
  fechaPago: string | null = null,
  opts: { mirarLinks?: boolean } = {},
): Promise<{ quitada: boolean; porLink: Pasarela | null; yaEstaba: boolean }> {
  const supabase = (await getTenantDb());
  const { data: pago, error: getErr } = await supabase
    .from('pagos')
    .select('*')
    .eq('id', pagoId)
    .single();
  if (getErr) throw new Error(`Error leyendo pago ${pagoId}: ${getErr.message}`);

  // ⚠️ IDEMPOTENTE (20/10/2026): una cuota que YA está como se pide no se toca. Marcar otra vez una cobrada le
  // reescribía `fecha_pago` (el cobro saltaba de mes y el Cash con él) y el historial decía «Pago registrado» dos
  // veces; desmarcar otra vez una impaga podía QUITAR un pago que nació cobrado. Pasa con una lista vieja (General
  // abierta en otra pestaña, el chat con MaKo, una tarjeta confirmada después de que alguien la marcó en la ficha).
  // Quien llama lo DICE y no ofrece «Deshacer»: deshacer sería desmarcar el cobro de otro.
  if (Boolean(pago.pagado) === pagado) return yaEstabaAsi(pagoId, pago, pagado);

  // ⚠️ MARCAR A MANO una cuota cuyo link ya se pagó contaba la plata dos veces (17/10/2026): ver
  // `linkYaPagado`. Por defecto se mira; sólo no lo miran la pasarela misma y quien ya lo miró.
  if (pagado && !pago.pagado && opts.mirarLinks !== false) {
    const porLink = await linkYaPagado(pagoId);
    if (porLink) return { quitada: false, porLink, yaEstaba: false };
  }

  // Sin fecha, HOY en la zona del negocio (20/10/2026): con el día UTC, un cobro marcado de noche caía mañana.
  const fecha = pagado ? (fechaPago ?? (await hoyEnWorkspace())) : null;
  // ⚠️ LA ESCRITURA ES CONDICIONAL (20/10/2026, revisión adversarial): la comparación de arriba lee y después escribe, y
  // dos pantallas a la vez (General en la computadora y en el teléfono, MaKo y la ficha) pasaban las dos: la segunda
  // pisaba la fecha, las dos escribían «Pago registrado» y las dos ofrecían Deshacer. Sólo se toca la cuota si SIGUE
  // como estaba (`siSigue`); si no se tocó ninguna, ya estaba, y lo demás (quitar, sincronizar, cortar) lo hizo el otro.
  // Para cobrarla tiene que seguir impaga; para desmarcarla, cobrada.
  const { data: tocadas, error } = await siSigue(supabase.from('pagos').update({ pagado, fecha_pago: fecha }).eq('id', pagoId), pagado).select('id');
  if (error) throw new Error(`Error marcando pago ${pagoId}: ${error.message}`);
  if (!tocadas?.length) return yaEstabaAsi(pagoId, pago, pagado);
  const quitada = !pagado && (await quitarSiNacioCobrada(pagoId, pago));

  await sincronizarTotalCobrado(pago.lead_id as number);

  // Sólo al marcar PAGADO: desmarcar un pago (un error de carga) no reabre la secuencia (`trasCobrar`).
  if (pagado) await trasCobrar(pagoId, pago.cobro_id ?? null);
  return { quitada, porLink: null, yaEstaba: false };
}

/**
 * El número de una cuota, para el historial de quien la desmarca (`textoDeVueltaAPendiente`, 14/11/2026: «Cuota desmarcada» no
 * decía cuál). Se lee DESPUÉS de desmarcar, a propósito: `marcarPago` devuelve lo mismo de siempre (los tests lo comparan
 * entero) y la guarda de la action va pegada a la escritura (tests/datos-comercial.test.ts). null: no se pudo leer.
 */
export async function numeroDeCuota(pagoId: number): Promise<number | null> {
  const { data, error } = await (await getTenantDb()).from('pagos').select('numero').eq('id', pagoId).maybeSingle();
  if (error || !data) return null;
  const n = Number((data as { numero: unknown }).numero);
  return Number.isFinite(n) ? n : null;
}

/**
 * COBRA una cuota con fecha, hora y —si fue distinto— el monto real (pedido de Mauricio del 13/10/2026: «un pago
 * diferente»). Es lo que llaman la ficha del CRM (`marcarPagoManualAction`) y la API de MaKo (`marcar_pago_cobrado`):
 * una sola implementación.
 *
 * ⚠️ UN PAGO DE MENOS DEJA LA DIFERENCIA PENDIENTE (salvo `resto: 'descuento'`; la regla en lib/pagos-diferencia.ts):
 *    una fila NUEVA de `pagos` con el vencimiento de la cuota, numerada después de la última (el índice único es
 *    (lead_id, numero)). Se inserta DESPUÉS de tomar la cuota (la escritura condicional): si falla, la cuota vuelve a
 *    como estaba, impaga. Sin esto, la diferencia desaparecía del plan y del Outstanding como si ya no la debiera.
 * ⚠️ La cuota tiene que ser de ESE lead (`lead_id`): el id llega de afuera.
 * No escribe el historial del lead: lo escribe quien llama, con su autor.
 */
export async function cobrarCuota(
  pagoId: number,
  leadId: number,
  datos: { monto?: number | null; fecha: string; hora?: string | null; resto?: RestoDeCobro } & DatosDeMoneda,
): Promise<{
  original: number; monto: number | null; pendiente: number | null; descuento: number; moneda: string | null; montoOriginal: number | null; porLink: Pasarela | null; yaEstaba: boolean;
  /** La diferencia en la moneda de la cuota, como la deja la 0347 (`restoEnLaMonedaDeLaCuota`): los textos la dicen así. */
  pendienteEnSuMoneda: { moneda: string; monto: number } | null;
}> {
  if (!datos.fecha) throw new Error('La fecha del pago es obligatoria.');
  // La cuota ya se lee con `lead_id`, pero la diferencia de abajo es un INSERT con ese leadId.
  await asegurarLeadDelNegocio(leadId);
  const db = await getTenantDb();
  const { data: antes, error: eLeer } = await db.from('pagos')
    .select('monto_usd, fecha_esperada, pagado, proveedor, cobro_id, pago_hora, moneda, monto_original')
    .eq('id', pagoId).eq('lead_id', leadId).maybeSingle();
  if (eLeer) throw new Error(`Error leyendo el pago ${pagoId}: ${eLeer.message}`);
  if (!antes) throw new Error('Esa cuota no existe en este lead.');
  const fila = antes as {
    monto_usd: number; fecha_esperada: string | null; pagado: boolean; proveedor: string | null; cobro_id: number | null;
    pago_hora: string | null; moneda: string | null; monto_original: number | null;
  };
  // ⚠️ LO ÚLTIMO QUE SE DIJO DEL COBRO MANDA (revisión del 14/10/2026): la moneda, el monto original, el concepto y el
  // método se escribían sólo si venían, así que una cuota cobrada en MXN, desmarcada y vuelta a cobrar en USD seguía
  // diciendo «MX$8.600». En una cuota a mano, lo que no vino se limpia; lo de la pasarela no se toca.
  const aMano = !fila.proveedor;
  const original = Number(fila.monto_usd) || 0;
  // ⚠️ IDEMPOTENTE, como `marcarPago` (20/10/2026): cobrar una cuota que YA está cobrada no toca NADA. Antes le
  // reescribía el monto, la moneda, la hora y la fecha al cobro que ya había entrado. Ninguna pantalla vuelve a cobrar
  // una cobrada a propósito: para corregirla se desmarca (o se edita la cuota). Lo dice quien llama.
  // «Ya estaba» cura lo de después (sincronizar, cortar recordatorios): un intento anterior pudo cortarse en el medio.
  const yaCobrada = async () => {
    await curarDespues(pagoId, leadId, true, fila.cobro_id ?? null);
    return { original, monto: null, pendiente: null, pendienteEnSuMoneda: null, descuento: 0, moneda: null, montoOriginal: null, porLink: null, yaEstaba: true as const };
  };
  // ⚠️ NO TOMARLA NO SIEMPRE ES «YA ESTABA» (21/10/2026, quinta revisión): si la cuota se BORRÓ en el medio (la
  // reconciliación de un plan), decir «ya estaba cobrada» escondía un cobro que sí entró. Se mira cómo quedó.
  const noTomada = async () => {
    const { data: ahora } = await db.from('pagos').select('pagado').eq('id', pagoId).eq('lead_id', leadId).maybeSingle();
    if ((ahora as { pagado?: boolean | null } | null)?.pagado) return yaCobrada();
    throw new Error('La cuota cambió mientras la cobrabas (se quitó o se rehízo el plan): recarga la ficha y vuelve a cobrarla. No se escribió nada.');
  };
  if (fila.pagado) return yaCobrada();
  // ⚠️ Un monto que no llega a un centavo (0,004) no es «sin monto» (21/10/2026, quinta revisión): caía como el cobro
  // ENTERO, o se guardaba en 0 y la deuda desaparecía sin su diferencia.
  if (datos.monto != null && Number.isFinite(datos.monto) && datos.monto > 0 && centavos(datos.monto) <= 0) {
    throw new Error('El monto tiene que ser de al menos un centavo.');
  }
  // ⚠️ Si un link de la cuota ya se cobró, la cuota queda cobrada con ESE pago y no se toca nada más: ni el monto, ni
  // la diferencia, ni la moneda (17/10/2026, `linkYaPagado`). Antes la plata se contaba dos veces.
  if (!fila.pagado) {
    const porLink = await linkYaPagado(pagoId);
    if (porLink) return { original, monto: null, pendiente: null, pendienteEnSuMoneda: null, descuento: 0, moneda: null, montoOriginal: null, porLink, yaEstaba: false };
  }
  // Sin los dólares, un cobro en la moneda de la cuota (un tramo en pesos) va a SU tasa: con «la cuota entera», un cobro a
  // medias no dejaba diferencia (revisión de 9fc4030dd, alta). La API de MaKo manda los pesos sin los dólares.
  const monto = datos.monto != null && Number.isFinite(datos.monto) && datos.monto > 0 ? centavos(datos.monto) : dolaresALaTasaDeLaCuota(fila, datos);
  // La moneda en que se cobró (decisión 7). `monto` sigue siendo DÓLARES; sin `moneda`, todo como siempre.
  const enMonedaR = datos.moneda ? pagoEnMoneda({ montoUsd: monto ?? original, moneda: datos.moneda, montoOriginal: datos.montoOriginal }) : null;
  if (enMonedaR && !enMonedaR.ok) throw new Error(enMonedaR.error);
  const enMoneda = enMonedaR && enMonedaR.ok ? enMonedaR : null;
  const pend = diferenciaPendiente(original, monto, { yaPagada: fila.pagado, resto: datos.resto });
  const descuento = !fila.pagado && datos.resto === 'descuento' && monto != null && monto < original ? centavos(original - monto) : 0;

  // ⚠️ EL COBRO ENTERO VA EN UNA ESCRITURA CONDICIONAL (20/10/2026, revisión adversarial): pagado, fecha, hora, monto
  // y moneda, y sólo si la cuota SIGUE impaga. Leer «impaga» y escribir el monto antes de marcar dejaba que dos cobros a
  // la vez (MaKo y la ficha) pasaran los dos: el segundo pisaba monto y moneda del primero, escribía su historial con una
  // fecha que no quedó, y lo cobrado del lead quedaba desfasado. Sin filas tocadas, otro la cobró: no se escribe nada.
  const upd: Record<string, unknown> = { pagado: true, fecha_pago: datos.fecha, pago_hora: datos.hora?.trim() || null };
  if (monto != null) upd.monto_usd = monto;
  if (enMoneda) { upd.moneda = enMoneda.moneda; upd.monto_original = enMoneda.montoOriginal; }
  else if (aMano) { upd.moneda = null; upd.monto_original = null; }
  // ⚠️ UN COBRO DE MENOS VA EN UNA TRANSACCIÓN (21/10/2026, segunda revisión adversarial, mig 0318): tomar la cuota y dejar
  // su diferencia son dos escrituras, y desde acá eran dos viajes. Con la diferencia DESPUÉS, un error en el medio dejaba
  // la cuota cobrada sin su diferencia (o había que devolverla a impaga, y eso volvía mentira el «ya estaba» de otra
  // pantalla); con la diferencia ANTES, un error en la toma la dejaba como una cuota FANTASMA que la cobranza le reclamaba
  // al cliente, y el reintento agregaba otra. En la función van juntas o no va ninguna; si la respuesta se pierde con
  // todo escrito, el reintento ve la cuota cobrada y la diferencia está una vez. El cobro ENTERO es una sola escritura.
  if (pend > 0) {
    const r = await cobrarConResto(db, {
      p_pago: pagoId, p_lead: leadId, p_fecha: datos.fecha, p_hora: datos.hora?.trim() || null, p_monto: monto,
      p_moneda: enMoneda?.moneda ?? null, p_monto_original: enMoneda?.montoOriginal ?? null, p_limpiar_moneda: !enMoneda && aMano,
      p_resto: pend, p_vence: fila.fecha_esperada ?? datos.fecha,
      // ⚠️ Con el monto que se LEYÓ (mig 0323): editada en el medio (500 → 400), un cobro de 300 dejaba 300 cobrados y 200
      // pendientes de una cuota de 400. Si cambió, no se toma y `noTomada` lo dice.
      p_original: original,
    });
    if (!r.tomada) return noTomada();
  } else {
    // Y con el monto que se leyó, como el cobro por menos (mig 0323): una cuota editada en el medio no se cobra por lo de antes.
    const { data: tomada, error } = await siSigue(db.from('pagos').update(upd).eq('id', pagoId).eq('lead_id', leadId).eq('monto_usd', original), true).select('id');
    if (error) throw new Error(`Error cobrando el pago ${pagoId}: ${error.message}`);
    if (!tomada?.length) return noTomada();
  }
  // El concepto y el método (`etiquetarPago` no tira: una etiqueta que no se guardó no tumba un cobro que ya entró).
  await etiquetarPago(pagoId, datos, { limpiar: aMano });

  await curarDespues(pagoId, leadId, true, fila.cobro_id ?? null);
  return {
    original, monto, pendiente: pend > 0 ? pend : null, descuento,
    pendienteEnSuMoneda: pend > 0 ? restoEnLaMonedaDeLaCuota(fila, { moneda: enMoneda?.moneda, montoOriginal: enMoneda?.montoOriginal }) : null,
    moneda: enMoneda?.moneda ?? null, montoOriginal: enMoneda?.montoOriginal ?? null, porLink: null, yaEstaba: false,
  };
}

/** ¿La función de la 0323 (la de la 0318 con `p_original`) no está en la base (la migración todavía no se aplicó)? */
const funcionNoExiste = (e: { code?: string; message?: string } | null): boolean =>
  !!e && (e.code === 'PGRST202' || e.code === '42883' || /could not find the function|function .* does not exist/i.test(e.message ?? ''));

/**
 * Cobra una cuota por menos y deja su diferencia, en UNA transacción (`cobrar_cuota_con_resto`, mig 0318). El rpc no pasa
 * por el scoping de `getTenantDb`: el workspace va explícito, y la función lo mira en cada consulta. Si otro escritor del
 * lead (un pago suelto) tomó el número de la diferencia, el índice (lead_id, numero) hace fallar TODO con 23505 y se
 * reintenta UNA vez, como `registrarCobroDeProveedor`. Sin la función, no se escribe nada y se dice.
 */
async function cobrarConResto(
  db: Awaited<ReturnType<typeof getTenantDb>>,
  p: { p_pago: number; p_lead: number; p_fecha: string; p_hora: string | null; p_monto: number | null; p_moneda: string | null; p_monto_original: number | null; p_limpiar_moneda: boolean; p_resto: number; p_original: number; p_vence: string },
): Promise<{ tomada: boolean }> {
  const ws = await getWorkspaceActual();
  if (ws == null) throw new Error('No sé de qué negocio es esta cuota.');
  for (let intento = 0; intento < 2; intento++) {
    const { data, error } = await db.rpc('cobrar_cuota_con_resto', { p_ws: ws, ...p });
    if (!error) return { tomada: (data as { tomada?: boolean } | null)?.tomada === true };
    if (funcionNoExiste(error)) throw new Error('Un cobro por menos todavía no se puede guardar: falta la migración 0323. No se escribió nada.');
    if (error.code !== PG_DUPLICADO) throw new Error(`Error cobrando el pago ${p.p_pago}: ${error.message}`);
  }
  throw new Error(`No pude cobrar el pago ${p.p_pago}: dos choques seguidos con el número de la diferencia. No se escribió nada.`);
}

/**
 * Un pago FUERA DEL PLAN (un adelanto, un extra, otro esquema): una cuota nueva ya cobrada, numerada después de la
 * última, que pasa por `marcarPago` —lo cobrado del lead y el corte de los recordatorios—. No toca el monto de
 * cierre: si fue una venta nueva, se corrige en el deal. Lo llaman la ficha y la API de MaKo (`registrar_pago_suelto`).
 */
export async function registrarPagoSuelto(
  leadId: number,
  /** `crm`: el CRM agregado del pago (la tab Pagos mirando una renovación, mig 0324); sin él, la casa. */
  datos: { monto: number; fecha: string; hora?: string | null; mensualidad?: boolean; crm?: Crm } & DatosDeMoneda,
): Promise<{ pagoId: number; monto: number; moneda: string | null; montoOriginal: number | null }> {
  const monto = Number(datos.monto);
  if (!Number.isFinite(monto) || monto <= 0) throw new Error('El monto tiene que ser mayor a cero.');
  if (!datos.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(datos.fecha)) throw new Error('La fecha del pago es obligatoria.');
  // `monto` es DÓLARES; con `moneda`, se guarda además en lo que se cobró (decisión 7, `pagoEnMoneda`).
  const enMonedaR = datos.moneda ? pagoEnMoneda({ montoUsd: monto, moneda: datos.moneda, montoOriginal: datos.montoOriginal }) : null;
  if (enMonedaR && !enMonedaR.ok) throw new Error(enMonedaR.error);
  const enMoneda = enMonedaR && enMonedaR.ok ? enMonedaR : null;
  await asegurarLeadDelNegocio(leadId);
  const db = await getTenantDb();
  const crm = datos.crm ?? null;
  const existentes = await getPagosByLead(leadId, crm);
  const base = existentes.length > 0 ? Math.max(...existentes.map((q) => q.numero)) : 0;
  const redondo = centavos(monto);
  const { data, error } = await db.from('pagos')
    .insert({
      lead_id: leadId, numero: base + 1, ...(crm != null ? { funnel_id: crm } : {}), monto_usd: redondo, fecha_esperada: datos.fecha, pagado: false, pago_hora: datos.hora?.trim() || null,
      // Nace cobrada (mig 0295): deshacerla la quita, no la deja como deuda vencida.
      nacio_cobrada: true,
      // Registrada COMO la mensualidad (mig 0323): vale un mes, sea del monto que sea (`mesesDeUnaCobrada`).
      ...(datos.mensualidad ? { es_mensualidad: true } : {}),
      ...(enMoneda ? { moneda: enMoneda.moneda, monto_original: enMoneda.montoOriginal } : {}),
    })
    .select('id').single();
  if (error || !data) throw new Error(crm != null && faltaIndicePorCrm(error) ? FALTA_0324 : `No pude registrar el pago: ${error?.message ?? 'sin fila'}`);
  const pagoId = Number((data as { id: number }).id);
  await etiquetarPago(pagoId, datos);
  await marcarPago(pagoId, true, datos.fecha);
  return { pagoId, monto: redondo, moneda: enMoneda?.moneda ?? null, montoOriginal: enMoneda?.montoOriginal ?? null };
}

// ─────────────────────────────────────────────────────────────────────────────
// Lo cargado a mano: moneda, concepto y método (decisión 7 de docs/diseno-ficha-bloques.md)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lo que un pago a mano suma a su monto en dólares. ⚠️ Sin `moneda` es USD como siempre (ver `pagoEnMoneda`,
 * lib/pagos-campo.ts): la moneda del negocio la pone la PANTALLA como valor inicial, no el server a ciegas.
 */
export type DatosDeMoneda = {
  /** ISO de 3 letras. null/ausente = dólares (lo de siempre). */
  moneda?: string | null;
  /** Lo cobrado en `moneda` (obligatorio si no es USD). */
  montoOriginal?: number | null;
  concepto?: string | null;
  /** Uno de METODOS_PAGO (lib/pagos-campo.ts); lo desconocido queda 'otro'. */
  metodo?: string | null;
};

/**
 * Concepto y método del pago (mig 0292). ⚠️ UPDATE APARTE Y QUE NO TIRA: si la migración todavía no corrió, la
 * columna no existe y PostgREST rechazaría la fila ENTERA. Perder la etiqueta se ve en el historial; perder el
 * pago, no. Molde: las omisiones del wizard de Ganado (app/crm/actions.ts, «update APARTE»).
 */
async function etiquetarPago(pagoId: number, datos: DatosDeMoneda, opts: { limpiar?: boolean } = {}): Promise<void> {
  const e = etiquetaDePago(datos);
  // `limpiar`: volver a cobrar una cuota a mano sin concepto ni método borra los de la vez anterior.
  if (!e.concepto && !e.metodo && !opts.limpiar) return;
  try {
    const { error } = await (await getTenantDb()).from('pagos').update({ concepto: e.concepto, metodo: e.metodo }).eq('id', pagoId);
    if (error) console.error(`[pagos] el concepto y el método del pago ${pagoId} no se guardaron (¿falta la migración?): ${error.message}`);
  } catch (err) {
    console.error(`[pagos] etiquetar el pago ${pagoId}:`, err instanceof Error ? err.message : err);
  }
}

/**
 * Las líneas de un cambio de Pagos en el HISTORIAL del lead (`lead_audit`), con el antes y el después y el actor,
 * en UN insert: comparten el instante y la ficha las muestra como un solo movimiento (molde: `logLeadChanges`,
 * lib/leads.ts, que sólo conoce las columnas de AUDIT_FIELDS y no los jsonb del deal ni las cuotas).
 * No rompe la escritura si falla: lo peor es una línea de menos, que se ve; perder el cambio, no.
 */
export async function anotarEnHistorial(
  leadId: number,
  filas: ReadonlyArray<{ campo: string; valor_anterior: string | null; valor_nuevo: string | null }>,
  autor: string,
): Promise<void> {
  if (!filas.length) return;
  try {
    const rows = filas.map((f) => ({
      lead_id: leadId, campo: f.campo.slice(0, 120), autor,
      valor_anterior: f.valor_anterior == null ? null : f.valor_anterior.slice(0, 2000),
      valor_nuevo: f.valor_nuevo == null ? null : f.valor_nuevo.slice(0, 2000),
    }));
    const { error } = await (await getTenantDb()).from('lead_audit').insert(rows);
    if (error) console.error(`[pagos] historial del lead ${leadId}: ${error.message}`);
  } catch (e) {
    console.error(`[pagos] historial del lead ${leadId}:`, e instanceof Error ? e.message : e);
  }
}

/** La clave de la moneda del negocio en `app_settings` (decisión 7: va por negocio, como el resto de la config). */
export const KEY_MONEDA_NEGOCIO = 'negocio.moneda';

/**
 * La moneda en que el NEGOCIO carga lo que cobra a mano. Hasta el 14/10/2026 no existía en ningún lado (todo el
 * CRM asumía dólares): sin configurar, es USD, que es lo que hacía. No es la de la pasarela, que la decide la
 * cuenta de Stripe o de Mercado Pago (`monedasCobroAction`).
 */
export async function monedaDelNegocio(): Promise<string> {
  try {
    return normalizarMoneda(await getSetting(KEY_MONEDA_NEGOCIO)) ?? MONEDA_POR_DEFECTO;
  } catch {
    return MONEDA_POR_DEFECTO;
  }
}

/** Guarda la moneda del negocio. Quien llama ya verificó que es el admin. */
export async function guardarMonedaDelNegocio(moneda: string): Promise<string> {
  const m = normalizarMoneda(moneda);
  if (!m) throw new Error('Esa moneda no existe (va el código de 3 letras: USD, MXN, ARS…).');
  // ⚠️ SIN NEGOCIO NO SE ESCRIBE (revisión del 14/10/2026): `setSetting` cae al ws1 cuando no hay workspace, y el super
  // admin sin `?ws` ni negocio propio le cambiaba la moneda al CRM de Mauricio, que es un cliente.
  if ((await getWorkspaceActual()) == null) throw new Error('Sin negocio: la moneda es de cada negocio (entra con ?ws).');
  await setSetting(KEY_MONEDA_NEGOCIO, m);
  return m;
}

/**
 * Cancela (o reactiva) una suscripción MANUAL: la que no cobra una pasarela y se registra mes a mes. Como la de la
 * pasarela (`aplicarSuscripcionCancelada`, lib/cobros.ts), la pasa a PLAZO FIJO hasta hoy (`suscripcion_meses` =
 * meses transcurridos), así el MRR deja de contarla; y además deja la fecha en `suscripcion_cancelada_at`
 * (mig 0292), que es lo que distingue «cancelada» de «terminó su plazo». Reactivar devuelve el plazo de antes.
 *
 * ⚠️ EL PLAZO DE ANTES SE GUARDA AL CANCELAR (`suscripcion_meses_antes`, la misma mig). Pisar `suscripcion_meses`
 * con los meses transcurridos lo perdía, y reactivar escribía `mesesAlReactivar ?? null`: la API pasa siempre null,
 * así que una suscripción de 12 meses cancelada en el mes 3 y reactivada por MaKo quedaba mes a mes, y el MRR la
 * contaba para siempre (revisión del 14/10/2026). Ahora reactivar devuelve lo que vino o, si no vino, el guardado.
 * Una cancelada antes de esta columna no tiene guardado: vuelve mes a mes, como antes.
 *
 * Compare-and-set sobre el tipo: sólo una suscripción. Devuelve el plazo que había (para Deshacer).
 */
export async function cambiarEstadoSuscripcionManual(
  leadId: number,
  estado: 'cancelada' | 'activa',
  opts: { hoy: string; mesesAlCancelar: number; mesesAlReactivar?: number | null; autor: string },
): Promise<{ cambio: boolean; mesesAntes: number | null; canceladaAntes: string | null }> {
  const db = await getTenantDb();
  const before = await getLead(leadId).catch(() => null);
  const { data, error } = await db.from('leads').select('venta_tipo, suscripcion_meses, suscripcion_cancelada_at, suscripcion_meses_antes').eq('id', leadId).maybeSingle();
  if (error) throw new Error(`No pude leer la suscripción: ${error.message}`);
  if (!data) throw new Error('No encontré ese lead en este negocio.');
  const fila = data as { venta_tipo: string | null; suscripcion_meses: number | null; suscripcion_cancelada_at: string | null; suscripcion_meses_antes: number | null };
  if (fila.venta_tipo !== 'suscripcion') throw new Error('Ese lead no es una suscripción.');
  const mesesAntes = fila.suscripcion_meses ?? null;
  const canceladaAntes = fila.suscripcion_cancelada_at ?? null;
  if ((estado === 'cancelada') === !!canceladaAntes) return { cambio: false, mesesAntes, canceladaAntes };
  const patch = estado === 'cancelada'
    ? { suscripcion_cancelada_at: `${opts.hoy}T12:00:00Z`, suscripcion_meses: opts.mesesAlCancelar, suscripcion_meses_antes: mesesAntes }
    : { suscripcion_cancelada_at: null, suscripcion_meses: plazoAlReactivar(opts.mesesAlReactivar, fila.suscripcion_meses_antes), suscripcion_meses_antes: null };
  const { data: hecho, error: e2 } = await db.from('leads').update(patch).eq('id', leadId).eq('venta_tipo', 'suscripcion').select('id');
  if (e2) throw new Error(`No pude guardar la suscripción: ${e2.message}`);
  const cambio = !!hecho?.length;
  if (cambio) {
    // El plazo deja su diff («Plazo de la suscripción», AUDIT_FIELDS): la ficha lo sabe REVERTIR desde el historial.
    await logLeadChanges(leadId, before, await getLead(leadId).catch(() => null), opts.autor);
    await anotarEnHistorial(leadId, [{ campo: 'Suscripción', valor_anterior: estado === 'cancelada' ? 'Activa' : 'Cancelada', valor_nuevo: estado === 'cancelada' ? 'Cancelada' : 'Activa' }], opts.autor);
  }
  return { cambio, mesesAntes, canceladaAntes };
}

/**
 * Recalcula total_cobrado_usd y fecha_primer_pago del lead a partir de sus
 * pagos pagados. Mantiene coherentes los consumidores que leen total_cobrado.
 * Desde la 0324 (22/10/2026) es lo cobrado en TODOS sus CRMs, como antes: lo leen el rendimiento de un anuncio, la
 * columna «cobrado» de los leads y el export, y una renovación también es plata que trajo esa persona (la revisión del
 * 22/10 lo frenó: contar sólo la casa los bajaba sin decir nada).
 */
export async function sincronizarTotalCobrado(leadId: number): Promise<void> {
  const supabase = (await getTenantDb());
  const [todos, agregados] = await Promise.all([getPagosByLead(leadId, 'todos'), crmsAgregadosDelLead(leadId)]);
  const pagados = todos.filter((p) => p.pagado);
  // Y lo cobrado de la venta de la CASA (mig 0325, segunda revisión del 22/10/2026): el saldo se compara con ESTO.
  const deLaCasa = pagados.filter((p) => esDelTrato(p.funnel_id, null, agregados)).reduce((s, p) => s + Number(p.monto_usd), 0);

  const total = pagados.reduce((s, p) => s + Number(p.monto_usd), 0);
  // Primer pago = la fecha_pago más temprana entre los pagados (de cualquier CRM)
  const fechas = pagados
    .map((p) => p.fecha_pago)
    .filter((f): f is string => !!f)
    .sort();
  const fechaPrimerPago = fechas[0] ?? null;

  const fila = {
    total_cobrado_usd: total > 0 ? total : null,
    ...(fechaPrimerPago ? { fecha_primer_pago: fechaPrimerPago } : {}),
  };
  // ⚠️ CERO, no NULL (revisión del SQL de la 0325): con NULL, quien sólo pagó una renovación caía a `total_cobrado_usd`
  // (`cobradoDeLaVenta`) y el saldo de su venta volvía a salir de menos.
  let { error } = await supabase.from('leads').update({ ...fila, total_cobrado_casa_usd: Math.round(deLaCasa * 100) / 100 }).eq('id', leadId);
  // Sin la 0325 la columna no está: lo de siempre, sin ella (el saldo cae a `total_cobrado_usd`, `cobradoDeLaVenta`).
  if (error && /total_cobrado_casa_usd/.test(error.message)) ({ error } = await supabase.from('leads').update(fila).eq('id', leadId));
  if (error) throw new Error(`Error sincronizando total_cobrado del lead ${leadId}: ${error.message}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Cuotas que escribe la PASARELA (Stripe / Mercado Pago, mig 0255)
// ─────────────────────────────────────────────────────────────────────────────
// Las llama SOLO lib/cobros.ts, adentro de runWithWorkspace(ws del cobro): un webhook no tiene
// sesión, y `pagos.workspace_id` tiene DEFAULT 1 (Mauricio, un cliente) — un insert con
// getSupabaseServer() o fuera del contexto escribiría el cobro de otro negocio en su CRM sin un error.

const PG_DUPLICADO = '23505';

/**
 * Asienta en el CRM un pago que CONFIRMÓ la pasarela. Si el cobro salda una cuota existente
 * (`pagoId`), la marca con `marcarPago` (que además corta los recordatorios de cobranza) y le
 * pone de qué pasarela salió; si no, inserta una cuota PAGADA nueva (molde: «Registrar
 * mensualidad cobrada», saveCuotasAction).
 *
 * IDEMPOTENTE por (workspace_id, proveedor, proveedor_pago_id) —el índice único de la mig 0255—:
 * Stripe y Mercado Pago reentregan, y la renovación de una suscripción es una cuota nueva por
 * factura. El 23505 de ESE índice es «ya estaba»; el del UNIQUE(lead_id, numero) es una carrera
 * con otro escritor y se reintenta una vez con el número recalculado.
 */
export async function registrarCobroDeProveedor(p: {
  leadId: number;
  cobroId: number;
  pagoId?: number | null;
  proveedor: Pasarela;
  proveedorPagoId: string;
  montoUsd: number;
  montoOriginal: number;
  moneda: string;
  fechaPago: string;
  /**
   * El CRM agregado donde entra un pago NUEVO (mig 0326: el producto vinculado a la etapa Ganado de ese CRM). Sin él, la
   * casa (o el CRM de la cuota que saldaba el link). Con él no se casa por monto contra las cuotas de la casa: es otro trato.
   */
  crm?: number | null;
}): Promise<{ pagoId: number; yaEstaba: boolean }> {
  // El lead sale del cobro (crearCobro ya lo leyó de este negocio), pero esta función INSERTA en `pagos`: la
  // regla es una sola para todos los escritores. Si tira, cobros.ts lo deja en el `motivo` del cobro.
  await asegurarLeadDelNegocio(p.leadId);
  const db = await getTenantDb();
  const marca = {
    cobro_id: p.cobroId,
    proveedor: p.proveedor,
    proveedor_pago_id: p.proveedorPagoId,
    moneda: p.moneda,
    monto_original: p.montoOriginal,
  };
  const buscarMia = () =>
    db.from('pagos').select('id, pagado, cobro_id').eq('lead_id', p.leadId)
      .eq('proveedor', p.proveedor).eq('proveedor_pago_id', p.proveedorPagoId).maybeSingle();

  const yaEsta = await buscarMia();
  if (yaEsta.error) throw new Error(`Error buscando el cobro ${p.proveedorPagoId}: ${yaEsta.error.message}`);
  if (yaEsta.data) {
    // «Ya estaba» puede ser un intento anterior que marcó la cuota y se cortó ANTES de sincronizar o de cortar: sin esto,
    // `fecha_primer_pago` y lo cobrado no se escribían nunca (revisión del 11/10/2026), y los recordatorios y el otro link
    // seguían vivos (21/10/2026). Lo de después se puede repetir: se cura acá, como el «ya estaba» de `cobrarCuota`.
    const f = yaEsta.data as { id: number; pagado?: boolean | null; cobro_id?: number | null };
    await curarDespues(Number(f.id), p.leadId, f.pagado === true, f.cobro_id == null ? p.cobroId : Number(f.cobro_id));
    return { pagoId: Number(f.id), yaEstaba: true };
  }

  // La cuota que saldaba el link, si sigue existiendo y sigue sin pagar. Si ya la marcó alguien a
  // mano, el pago de la pasarela NO la pisa: entra como cuota nueva (la plata entró dos veces y
  // eso lo tiene que ver una persona, no esconderse).
  let crmDeLaCuota: number | null = p.crm ?? null;
  if (p.pagoId) {
    // De ESTE lead: un pagoId que viniera de otro lado no puede saldar la cuota de otra persona.
    const cuota = await db.from('pagos').select('*').eq('id', p.pagoId).eq('lead_id', p.leadId).maybeSingle();
    if (cuota.error) throw new Error(`Error leyendo la cuota ${p.pagoId}: ${cuota.error.message}`);
    // El CRM de la cuota que saldaba el link (M6): si este pago entra como uno nuevo, entra en ESE trato, no en la casa.
    crmDeLaCuota = cuota.data?.funnel_id != null ? Number(cuota.data.funnel_id) : crmDeLaCuota;
    // ⚠️ Y POR LO MISMO QUE COBRA (14/10/2026, el link por cuota): saldarla la marca pagada por SU monto, no por el del
    // link. Si alguien la cambió después de crear el link, marcarla mentiría en el cash: entra como una cuota nueva
    // y la persona ve las dos. NO salda otra del mismo monto: el casamiento por monto de abajo es sólo para los links
    // SIN cuota (`!p.pagoId`); un link de la cuota 2 pagado de nuevo es plata que entró dos veces, no la cuota 3.
    const mismoMonto = !!cuota.data && mismoCentavo(cuota.data.monto_usd, p.montoUsd);
    if (cuota.data && !cuota.data.pagado && !cuota.data.proveedor_pago_id && mismoMonto) {
      // ⚠️ LA MARCA Y EL COBRO EN UNA ESCRITURA CONDICIONAL (21/10/2026, revisión adversarial): un cobro a mano entre la
      // lectura y esta escritura quedaba PISADO por la pasarela (dos pagos se veían como uno). Si ya no está impaga, este
      // pago entra como cuota nueva, abajo: la plata entró dos veces y eso lo tiene que ver una persona.
      const { data: saldada, error } = await siSigue(db.from('pagos').update({ ...marca, pagado: true, fecha_pago: p.fechaPago }).eq('id', p.pagoId).is('proveedor_pago_id', null), true).select('id');
      if (error) {
        if (error.code === PG_DUPLICADO) return { pagoId: p.pagoId, yaEstaba: true };
        throw new Error(`Error marcando la cuota ${p.pagoId}: ${error.message}`);
      }
      if (saldada?.length) {
        await curarDespues(p.pagoId, p.leadId, true, p.cobroId);
        return { pagoId: p.pagoId, yaEstaba: false };
      }
    }
  }

  // ⚠️ SI EL LEAD YA TENÍA UNA CUOTA IMPAGA DE ESE MONTO, el pago la SALDA (revisión del 11/10/2026). Ningún
  // link nace atado a una cuota (`pagoId`), y sin esto el pago entraba como cuota NUEVA con la del plan
  // todavía impaga: Outstanding de más, recordatorios de cobranza a quien ya pagó y, cuando el closer la
  // marcaba a mano, el doble de cash. Se casa por monto en USD, la más vieja primero, sólo una sin pasarela.
  if (!p.pagoId && p.crm == null) {
    // ⚠️ SÓLO EN LA CASA (revisión del 22/10/2026, M5): un pago sin cuota (un link suelto, la renovación mensual de una
    // suscripción) es de la casa, que es donde nace (el trigger). Contra todos los CRMs, la mensualidad de Stripe saldaba
    // por monto la cuota de una renovación. La cuota de un CRM agregado se cobra con SU link (`pagoId`), arriba.
    const impagas = (await getPagosByLead(p.leadId))
      .filter((q) => !q.pagado && !q.proveedor_pago_id && q.fecha_esperada && mismoCentavo(q.monto_usd, p.montoUsd))
      .sort((a, b) => String(a.fecha_esperada).localeCompare(String(b.fecha_esperada)) || a.numero - b.numero);
    // ⚠️ DE A UNA, EN ORDEN (21/10/2026, segunda revisión adversarial): con la misma condición, si la elegida la cobró
    // alguien a mano en el medio, este pago no la pisa y prueba la SIGUIENTE del mismo monto. Antes entraba como cuota
    // nueva aunque quedara otra impaga: Outstanding de más y recordatorios a quien ya pagó. Sólo sin ninguna, cuota nueva.
    for (const casa of impagas) {
      const { data: marcada, error } = await siSigue(db.from('pagos').update({ ...marca, pagado: true, fecha_pago: p.fechaPago }).eq('id', casa.id).eq('lead_id', p.leadId).is('proveedor_pago_id', null), true).select('id');
      if (error && error.code !== PG_DUPLICADO) throw new Error(`Error saldando la cuota ${casa.id}: ${error.message}`);
      if (!error && marcada && marcada.length) {
        await curarDespues(casa.id, p.leadId, true, p.cobroId);
        return { pagoId: casa.id, yaEstaba: false };
      }
      // La reentrega (el índice del proveedor): este pago ya entró por otro lado.
      const otra = await buscarMia();
      if (otra.data) return { pagoId: Number(otra.data.id), yaEstaba: true };
    }
  }

  for (let intento = 0; intento < 2; intento++) {
    // El número después del más alto de TODOS los CRMs: nace en la casa (el trigger) y no choca con nada.
    const existentes = await getPagosByLead(p.leadId, 'todos');
    const base = existentes.length > 0 ? Math.max(...existentes.map((q) => q.numero)) : 0;
    const { data, error } = await db
      .from('pagos')
      .insert({
        lead_id: p.leadId,
        numero: base + 1,
        monto_usd: p.montoUsd,
        fecha_esperada: p.fechaPago,
        pagado: true,
        fecha_pago: p.fechaPago,
        // ⚠️ NACE COBRADA, NO ES UNA CUOTA DEL PLAN (revisión de 7524ec1c9, alta): sin la marca, la seña cobrada por link
        // tomaba el lugar de la cuota 1 al armar el plan en la ficha ('slots'), y «Cambiar el plan» lo dejaba corto.
        // Deshacerla no la quita (`quitarSiNacioCobrada` no toca lo de la pasarela).
        nacio_cobrada: true,
        ...marca,
        ...(crmDeLaCuota != null ? { funnel_id: crmDeLaCuota } : {}),
      })
      .select('id')
      .single();
    if (!error && data) {
      await sincronizarTotalCobrado(p.leadId);
      return { pagoId: Number(data.id), yaEstaba: false };
    }
    if (error?.code === PG_DUPLICADO) {
      // ¿Fue la reentrega (el índice del proveedor) o una carrera por el número?
      const otra = await buscarMia();
      if (otra.data) return { pagoId: Number(otra.data.id), yaEstaba: true };
      continue;
    }
    throw new Error(`Error registrando el cobro ${p.proveedorPagoId} del lead ${p.leadId}: ${error?.message ?? 'sin respuesta'}`);
  }
  throw new Error(`No pude numerar la cuota del cobro ${p.proveedorPagoId} del lead ${p.leadId} (dos choques seguidos).`);
}

/**
 * Lo contrario de `desmarcarCobroDeProveedor`, cuando la DEVOLUCIÓN FALLA (15/10/2026): Stripe devuelve la plata al
 * saldo del negocio y el cargo vuelve a estar cobrado, así que la cuota también. Va por `marcarPago` (sincroniza lo
 * cobrado y el primer pago) con la fecha del CARGO: desmarcar borró la del pago y el vencimiento, y el vencimiento se
 * repone con esa misma fecha (una cuota pagada sin vencimiento quedaba fuera de las lecturas que lo filtran). Una cuota
 * que no estaba desmarcada (una devolución parcial nunca desmarca) no se toca.
 */
export async function remarcarCobroDeProveedor(p: {
  leadId: number;
  proveedor: Pasarela;
  proveedorPagoId: string;
  fechaPago: string;
}): Promise<{ remarcado: boolean }> {
  await asegurarLeadDelNegocio(p.leadId);
  const db = await getTenantDb();
  const { data, error } = await db.from('pagos').select('id, pagado, fecha_esperada')
    .eq('lead_id', p.leadId).eq('proveedor', p.proveedor).eq('proveedor_pago_id', p.proveedorPagoId).maybeSingle();
  if (error) throw new Error(`Error buscando el cobro ${p.proveedorPagoId}: ${error.message}`);
  if (!data || data.pagado) return { remarcado: false };
  if (!data.fecha_esperada) {
    const { error: e1 } = await db.from('pagos').update({ fecha_esperada: p.fechaPago }).eq('id', data.id).is('fecha_esperada', null);
    if (e1) throw new Error(`Error reponiendo el vencimiento del cobro ${p.proveedorPagoId}: ${e1.message}`);
  }
  await marcarPago(Number(data.id), true, p.fechaPago, { mirarLinks: false });
  return { remarcado: true };
}

/**
 * El reembolso de un pago de la pasarela: la cuota queda DESMARCADA (no se borra: el historial
 * del lead la cuenta) y se recalcula lo cobrado.
 *
 * ⚠️ `sincronizarTotalCobrado` NUNCA limpia `fecha_primer_pago` (sólo la escribe), y de esa fecha
 * cuelgan `esLeadCliente` (el WhatsApp sale solo en vez de borrador), la condición «Pagó» y la
 * nutrición. Un reembolso que deja al lead sin ninguna cuota pagada la limpia ACÁ, y sólo acá: en
 * los demás caminos (una importación que gana con monto y sin cuotas) esa fecha puede venir de
 * otro lado y borrarla mentiría al revés.
 */
export async function desmarcarCobroDeProveedor(p: {
  leadId: number;
  proveedor: Pasarela;
  proveedorPagoId: string;
}): Promise<{ desmarcado: boolean; quedanPagadas: number }> {
  const db = await getTenantDb();
  const { data, error } = await db
    .from('pagos')
    .select('id, pagado')
    .eq('lead_id', p.leadId)
    .eq('proveedor', p.proveedor)
    .eq('proveedor_pago_id', p.proveedorPagoId)
    .maybeSingle();
  if (error) throw new Error(`Error buscando el cobro ${p.proveedorPagoId}: ${error.message}`);
  let desmarcado = false;
  if (data?.pagado) {
    // ⚠️ SIN `fecha_esperada` (revisión del 11/10/2026): con `pagado=false` y la fecha del pago, la cuota
    // devuelta entraba al Outstanding, a «A quién cobrarle» y al cron de cobranza — un reembolso hecho hoy
    // salía como `cuota-por-vencer`. Lo devuelto no es una deuda: queda en la tabla (el historial la cuenta)
    // y fuera de esas lecturas, que filtran `fecha_esperada` null.
    const { error: e1 } = await db.from('pagos').update({ pagado: false, fecha_pago: null, fecha_esperada: null }).eq('id', data.id);
    if (e1) throw new Error(`Error desmarcando el cobro ${p.proveedorPagoId}: ${e1.message}`);
    await sincronizarTotalCobrado(p.leadId);
    desmarcado = true;
  }
  // De cualquier CRM (0324): el que pagó una renovación sigue siendo cliente aunque le devuelvan la venta de la casa.
  const quedanPagadas = (await getPagosByLead(p.leadId, 'todos')).filter((q) => q.pagado).length;
  if (quedanPagadas === 0) {
    const { error: e2 } = await db.from('leads').update({ fecha_primer_pago: null }).eq('id', p.leadId);
    if (e2) throw new Error(`Error limpiando el primer pago del lead ${p.leadId}: ${e2.message}`);
  }
  return { desmarcado, quedanPagadas };
}

// ─────────────────────────────────────────────────────────────────────────────
// Agregados para el dashboard
// ─────────────────────────────────────────────────────────────────────────────

/** Cash collected de un período: Σ pagos pagado=true con fecha_pago en rango. */
export async function getCashCollectedPeriodo(start: string, end: string): Promise<number> {
  const supabase = (await getTenantDb());
  // PAGINADO (17/10/2026): PostgREST corta en 1.000 filas SIN error, y un negocio con más cuotas cobradas en el
  // período daba de menos. Lo mismo en las demás lecturas de cobranza de abajo (docs/hallazgos-pagos.md).
  const data = await leerTodo<{ monto_usd: number | null }>(supabase, 'pagos', 'id, monto_usd', {
    filtros: (q) => q.eq('pagado', true).gte('fecha_pago', start).lte('fecha_pago', end),
  }).catch((e: unknown) => { throw new Error(`Error sumando cash del período: ${e instanceof Error ? e.message : String(e)}`); });
  return data.reduce((s, p) => s + Number(p.monto_usd ?? 0), 0);
}

/**
 * Outstanding del período: Σ cuotas NO pagadas con vencimiento DESDE el inicio
 * del rango (sin tope superior — las cuotas futuras son receivables válidos, así
 * que "Máximo" trae el total). Un inicio más tardío excluye las ya vencidas
 * de antes del período.
 */
export async function getOutstandingPeriodo(start: string, _end: string): Promise<number> {
  const supabase = (await getTenantDb());
  const data = await leerTodo<{ monto_usd: number | null }>(supabase, 'pagos', 'id, monto_usd', {
    filtros: (q) => q.eq('pagado', false).gte('fecha_esperada', start),
  }).catch((e: unknown) => { throw new Error(`Error sumando outstanding del período: ${e instanceof Error ? e.message : String(e)}`); });
  return data.reduce((s, p) => s + Number(p.monto_usd ?? 0), 0);
}

// Desglose por lead de las 3 métricas de Revenue (para los pop-ups).
// leadId permite el botón "Editar lead" dentro del desglose.
export type RevItem = { nombre: string; monto: number; fecha: string | null; detalle?: string; leadId?: number; funnel?: number | null };
export type RevenueBreakdowns = { sold: RevItem[]; cash: RevItem[]; outstanding: RevItem[] };

const relNombre = (leads: unknown): string => {
  const r = Array.isArray(leads) ? leads[0] : leads;
  return (r as { nombre?: string } | null)?.nombre ?? '—';
};

export const getRevenueBreakdowns = cachedRead('getRevenueBreakdowns', _getRevenueBreakdowns, { tags: [TAG.pagos, TAG.leads], revalidate: TTL.user });
async function _getRevenueBreakdowns(start: string, end: string): Promise<RevenueBreakdowns> {
  const supabase = (await getTenantDb());
  // Cash con el funnel que guardó cada pago (#897, mig 0310): el desglose de un OKR de UNOS funnels filtra igual que su
  // número. Sin la columna, se reintenta sin ella (la regla de siempre).
  type FilaCash = { monto_usd: unknown; fecha_pago: unknown; numero: unknown; lead_id: unknown; funnel_id?: unknown; leads: unknown };
  type FilaOut = { monto_usd: unknown; fecha_esperada: unknown; numero: unknown; lead_id: unknown; leads: unknown };
  // PAGINADAS (17/10/2026): los pop-ups del Revenue listan cuotas, y PostgREST corta en 1.000 sin error.
  const enPeriodo = (q: ConsultaPaginada) => q.eq('pagado', true).gte('fecha_pago', start).lte('fecha_pago', end);
  const cashDe = (cols: string) => leerTodo<FilaCash>(supabase, 'pagos', cols, { filtros: enPeriodo });
  const [soldRes, cashData, outData, enCrms] = await Promise.all([
    // Sin los «sin cobro» (#747): el desglose cuenta lo MISMO que el «N cierres» de
    // getRevenuePeriod, o el pop-up lista un cierre más que el número de arriba.
    supabase.from('leads').select('id, nombre, monto_cierre_usd, fecha_cierre').eq('cerro', true).neq('venta_tipo', VENTA_SIN_COBRO).gte('fecha_cierre', start).lte('fecha_cierre', end),
    // Sin la columna del funnel (mig 0310), se reintenta sin ella (la regla de siempre).
    cashDe('id, monto_usd, fecha_pago, numero, lead_id, funnel_id, leads(nombre)')
      .catch((e: unknown) => (faltaColumnaFunnel(e) ? cashDe('id, monto_usd, fecha_pago, numero, lead_id, leads(nombre)') : Promise.reject(e)))
      .catch((e: unknown) => { throw new Error(`Cash detalle: ${e instanceof Error ? e.message : String(e)}`); }),
    leerTodo<FilaOut>(supabase, 'pagos', 'id, monto_usd, fecha_esperada, numero, lead_id, leads(nombre)', {
      filtros: (q) => q.eq('pagado', false).gte('fecha_esperada', start),
    }).catch((e: unknown) => { throw new Error(`Outstanding detalle: ${e instanceof Error ? e.message : String(e)}`); }),
    // Las ventas de los CRMs agregados (una renovación, CO2): el desglose lista lo MISMO que suma el número de arriba.
    (async () => { const { ventasDeCrms } = await import('./ventas-crm'); return ventasDeCrms(start, end); })(),
  ]);
  if (soldRes.error) throw new Error(`Sold detalle: ${soldRes.error.message}`);
  const cashRes = { data: cashData };
  const outRes = { data: outData };

  const cuotaLabel = (n: number) => (n === 0 ? 'cobro inicial' : `cuota ${n}`);
  const sold: RevItem[] = [
    ...(soldRes.data ?? []).map((r) => ({ nombre: (r.nombre as string) ?? '—', monto: Number(r.monto_cierre_usd ?? 0), fecha: (r.fecha_cierre as string | null) ?? null, leadId: Number(r.id) })),
    // Con SU funnel: el desglose por funnel la pone en la renovación.
    ...enCrms.map((v) => ({ nombre: v.nombre ?? '—', monto: v.monto, fecha: v.fecha, leadId: v.leadId, funnel: v.funnelId })),
  ].sort((a, b) => b.monto - a.monto);
  const cash: RevItem[] = (cashRes.data ?? []).map((r) => ({ nombre: relNombre(r.leads), monto: Number(r.monto_usd ?? 0), fecha: (r.fecha_pago as string | null) ?? null, detalle: cuotaLabel(Number(r.numero)), leadId: Number(r.lead_id), funnel: r.funnel_id == null ? null : Number(r.funnel_id) }))
    .sort((a, b) => (a.fecha && b.fecha ? (a.fecha < b.fecha ? 1 : -1) : 0));
  const outstanding: RevItem[] = (outRes.data ?? []).map((r) => ({ nombre: relNombre(r.leads), monto: Number(r.monto_usd ?? 0), fecha: (r.fecha_esperada as string | null) ?? null, detalle: cuotaLabel(Number(r.numero)), leadId: Number(r.lead_id) }))
    .sort((a, b) => (a.fecha && b.fecha ? (a.fecha < b.fecha ? -1 : 1) : 0));
  return { sold, cash, outstanding };
}

/**
 * Outstanding global: Σ monto_usd de pagos NO pagados (lo que falta cobrar). Sin las cuotas DEVUELTAS por un
 * reembolso (`esCuotaDevuelta`): quedan impagas en la tabla para el historial y no son deuda (15/10/2026).
 */
export async function getOutstandingTotal(): Promise<number> {
  const supabase = (await getTenantDb());
  // `*`: la regla mira proveedor, cobro_id y `baja_at` (mig 0307); con la lista, una base sin la migración rompía el número.
  const data = await leerTodo<Pago>(supabase, 'pagos', '*', { eq: { pagado: false } })
    .catch((e: unknown) => { throw new Error(`Error sumando outstanding: ${e instanceof Error ? e.message : String(e)}`); });
  // Sin las de un cliente dado de baja (#871, `noEsDeuda`): impagas y sin vencimiento, como las devueltas.
  return data.filter((p) => !noEsDeuda(p)).reduce((s, p) => s + Number(p.monto_usd ?? 0), 0);
}

export type OutstandingLead = {
  lead_id: number;
  lead_nombre: string;
  vendido_usd: number | null;
  cobrado_usd: number;
  pendiente_usd: number;
  proxima_cuota: { pago_id: number; numero: number; monto_usd: number; fecha_esperada: string | null } | null;
  dias_desde_cierre: number | null;
  fecha_cierre: string | null;
  /**
   * De qué trato es el renglón (mig 0324, lib/pagos-crm.ts): `crm` es el CRM agregado (una renovación) o null para la
   * casa, y `funnel_id` el CRM de verdad (la casa ya resuelta: su funnel, o el del negocio). Un cliente que debe en la casa
   * Y en una renovación tiene DOS renglones: cada uno con su vendido, su cobrado y su próxima cuota.
   */
  crm?: number | null;
  funnel_id?: number | null;
};

/**
 * Detalle nominal del outstanding (Fase 13): un renglón por lead Y POR CRM (0324) con cuotas
 * pendientes. La suma de pendiente_usd iguala getOutstandingTotal().
 *
 * Devuelve además `cuotas`: un renglón POR CUOTA sin pagar dentro de la ventana
 * (para el desglose del KPI "Outstanding" del pop-up), ordenadas por
 * vencimiento. Así el número, el desglose y la tabla "a quién cobrarle" salen
 * TODOS de la misma query y quedan siempre coherentes entre sí.
 */
export const getOutstandingDetalle = cachedRead('getOutstandingDetalle', _getOutstandingDetalle, { tags: [TAG.pagos], revalidate: TTL.user });
async function _getOutstandingDetalle(
  // Sin default (20/10/2026): el de antes era el día UTC. Quien llama pasa el del negocio (`hoyEnWorkspace`).
  hoy: string,
  // Ventana opcional (filtro de fecha de Comercial): Outstanding mira hacia
  // ADELANTE, así que acota por VENCIMIENTO (fecha_esperada) de las cuotas sin
  // pagar dentro de [desde, hasta]. Sin ventana, es el pipeline completo a hoy.
  desde: string | null = null,
  hasta: string | null = null,
): Promise<{ items: OutstandingLead[]; total: number; cuotas: RevItem[] }> {
  const supabase = (await getTenantDb());
  // `*`: la regla (`noEsDeuda`) mira proveedor, cobro_id y `baja_at` (mig 0307), y con `*` una base sin la migración no rompe.
  // PAGINADO: «A quién cobrarle» y el Outstanding salen de acá; sin paginar, pasadas las 1.000 cuotas daban de menos.
  const data = await leerTodo<Record<string, unknown>>(supabase, 'pagos', '*, leads(nombre, monto_cierre_usd, fecha_cierre, funnel_id)')
    .catch((e: unknown) => { throw new Error(`Error leyendo detalle de outstanding: ${e instanceof Error ? e.message : String(e)}`); });
  // LOS CRMs AGREGADOS de estos leads, con su venta (mig 0324): cada pago va al renglón de su trato (`esDelTrato`). `*`: sin
  // la 0324 no hay columnas de venta, y el renglón de una renovación sale sin «vendido». Si no se pueden leer, todo va a la
  // casa, como antes de la 0324: lo dice el log y la lista sigue.
  const conLead = [...new Set((data ?? []).map((r) => Number(r.lead_id)).filter(Number.isFinite))];
  const tratos = new Map<number, Map<number, CamposTrato>>();
  let casaDelNegocio: number | null = null;
  try {
    const lf = conLead.length ? await leerTodo<Record<string, unknown>>(supabase, 'lead_funnel', '*') : [];
    for (const f of lf) {
      const lead = Number(f.lead_id);
      if (!conLead.includes(lead)) continue;
      const m = tratos.get(lead) ?? new Map<number, CamposTrato>();
      m.set(Number(f.funnel_id), camposDeFila(f));
      tratos.set(lead, m);
    }
    const { data: fd } = await supabase.from('funnels').select('id').eq('es_default', true).limit(1).maybeSingle();
    casaDelNegocio = fd ? Number((fd as { id: number }).id) : null;
  } catch (e) {
    console.error('[pagos] «a quién cobrar» sin los CRMs agregados:', e instanceof Error ? e.message : String(e));
  }

  type Row = {
    id: number;
    lead_id: number;
    numero: number;
    monto_usd: number;
    fecha_esperada: string | null;
    pagado: boolean;
    proveedor: string | null;
    cobro_id: number | null;
    baja_at?: string | null;
    funnel_id?: number | null;
    leads: RelLead | RelLead[] | null;
  };
  type RelLead = { nombre: string; monto_cierre_usd: number | null; fecha_cierre: string | null; funnel_id?: number | null };

  // Por lead Y POR TRATO (0324): la clave es `lead|crm` (crm vacío = la casa).
  const porTrato = new Map<string, { leadId: number; crm: number | null; rows: Row[] }>();
  for (const row of (data ?? []) as Row[]) {
    // Sin la casa del lead (M3): una fila de `lead_funnel` que la repite no la parte en dos renglones.
    const relDe = Array.isArray(row.leads) ? row.leads[0] : row.leads;
    const casa = relDe?.funnel_id != null ? Number(relDe.funnel_id) : casaDelNegocio;
    const agregados = [...(tratos.get(Number(row.lead_id))?.keys() ?? [])].filter((k) => k !== casa);
    const f = row.funnel_id == null ? null : Number(row.funnel_id);
    const crm = f != null && !esDelTrato(f, null, agregados) ? f : null;
    const clave = `${row.lead_id}|${crm ?? ''}`;
    const g = porTrato.get(clave) ?? { leadId: Number(row.lead_id), crm, rows: [] };
    g.rows.push(row);
    porTrato.set(clave, g);
  }

  const [hy, hm, hd] = hoy.split('-').map(Number);
  const hoyUTC = Date.UTC(hy, hm - 1, hd);
  const items: OutstandingLead[] = [];
  const cuotas: RevItem[] = [];
  const cuotaLabel = (n: number) => (n === 0 ? 'cobro inicial' : `cuota ${n}`);

  for (const { leadId, crm, rows } of porTrato.values()) {
    // ⚠️ Sin las DEVUELTAS por un reembolso (15/10/2026): sin ventana, una cuota devuelta (impaga y sin vencimiento)
    // sumaba como deuda en el Outstanding y en «A quién cobrarle». Con ventana ya quedaba afuera (no tiene vencimiento).
    // Y sin las de un cliente que se dio de baja (#871): «A quién cobrarle» no le cobra a quien se fue.
    let noPagados = rows.filter((r) => !r.pagado && !noEsDeuda(r));
    // Filtro de fecha de Comercial: "lo que se está por cobrar en el intervalo"
    // = cuotas SIN pagar cuyo VENCIMIENTO (fecha_esperada) cae dentro de la
    // ventana. Sin ventana, es el outstanding total a hoy.
    if (desde && hasta) {
      noPagados = noPagados.filter((r) => r.fecha_esperada && r.fecha_esperada >= desde && r.fecha_esperada <= hasta);
    }
    const pendiente = noPagados.reduce((s, r) => s + Number(r.monto_usd), 0);
    if (pendiente <= 0) continue;
    const cobrado = rows.filter((r) => r.pagado).reduce((s, r) => s + Number(r.monto_usd), 0);
    const rel = Array.isArray(rows[0].leads) ? rows[0].leads[0] : rows[0].leads;
    const nombre = rel?.nombre ?? `Lead #${leadId}`;
    // La venta del renglón es la de SU trato: la de la casa en `leads`, la de una renovación en su `lead_funnel`.
    const trato = crm != null ? tratos.get(leadId)?.get(crm) ?? null : null;
    const fechaCierre = crm != null ? trato?.fecha_cierre ?? null : rel?.fecha_cierre ?? null;
    const conFecha = noPagados.filter((r) => r.fecha_esperada).sort((a, b) => (a.fecha_esperada! < b.fecha_esperada! ? -1 : 1));
    const prox = conFecha[0] ?? noPagados[0];
    let dias: number | null = null;
    if (fechaCierre) {
      const [cy, cm, cd] = fechaCierre.split('-').map(Number);
      dias = Math.floor((hoyUTC - Date.UTC(cy, cm - 1, cd)) / (1000 * 60 * 60 * 24));
    }
    items.push({
      lead_id: leadId,
      lead_nombre: nombre,
      vendido_usd: crm != null ? trato?.monto_cierre_usd ?? null : rel?.monto_cierre_usd ?? null,
      cobrado_usd: cobrado,
      pendiente_usd: pendiente,
      proxima_cuota: prox ? { pago_id: prox.id, numero: prox.numero, monto_usd: Number(prox.monto_usd), fecha_esperada: prox.fecha_esperada } : null,
      dias_desde_cierre: dias,
      fecha_cierre: fechaCierre,
      crm,
      funnel_id: crm ?? (rel?.funnel_id != null ? Number(rel.funnel_id) : casaDelNegocio),
    });
    for (const r of noPagados) {
      cuotas.push({ nombre, monto: Number(r.monto_usd), fecha: r.fecha_esperada, detalle: cuotaLabel(r.numero), leadId });
    }
  }

  items.sort((a, b) => b.pendiente_usd - a.pendiente_usd);
  // Desglose por cuota: la que vence primero, arriba (fechas nulas al final).
  cuotas.sort((a, b) => (a.fecha && b.fecha ? (a.fecha < b.fecha ? -1 : 1) : a.fecha ? -1 : 1));
  const total = items.reduce((s, i) => s + i.pendiente_usd, 0);
  return { items, total, cuotas };
}

/**
 * Las SUSCRIPCIONES por cobrar de «a quién cobrarle» (20/10/2026): una suscripción no genera cuotas, así que la lista de
 * arriba no las veía nunca. La regla es la de toda la app (`cobradoDelLead`), en lib/suscripciones-por-cobrar.ts: un mes
 * sin registrar, una renovación rechazada o la próxima mensualidad manual dentro de la ventana.
 * ⚠️ No suma al Outstanding (ver la cabecera de ese módulo). Y una lectura que falla no tumba la lista de cuotas: lo
 * dice el log y vuelve vacía.
 */
export async function getSuscripcionesPorCobrar(hoy: string, desde: string | null, hasta: string | null): Promise<ItemPorCobrar[]> {
  try {
    const db = await getTenantDb();
    const { data: leads, error } = await db.from('leads')
      .select('id, nombre, fecha_cierre, suscripcion_monto_usd, suscripcion_meses, suscripcion_cancelada_at, funnel_id')
      .eq('venta_tipo', 'suscripcion').eq('estado_lead', 'ganado').is('suscripcion_cancelada_at', null).limit(500);
    if (error) throw new Error(error.message);
    const filas = (leads ?? []) as Array<LeadSuscripcion & { funnel_id?: number | null }>;
    if (!filas.length) return [];
    const ids = filas.map((l) => Number(l.id));
    const [pg, cb, fd, lf, mv] = await Promise.all([
      db.from('pagos').select('*').in('lead_id', ids),
      db.from('cobros').select('lead_id, tipo, estado, suscripcion_estado, motivo').in('lead_id', ids).eq('tipo', 'suscripcion'),
      db.from('funnels').select('id').eq('es_default', true).limit(1).maybeSingle(),
      db.from('lead_funnel').select('lead_id, funnel_id').in('lead_id', ids),
      // Los cambios de cada suscripción (mig 0401): sin leerlos, el monto del lead vale para todos los meses (lo de antes).
      leerCambiosDeSuscripcion(ids),
    ]);
    if (lf.error) throw new Error(lf.error.message);
    // La suscripción es de la CASA (0324): su CRM es el del lead, o el del negocio.
    const casaDelNegocio = fd.data ? Number((fd.data as { id: number }).id) : null;
    const agregadosDe = new Map<number, number[]>();
    for (const r of (lf.data ?? []) as Array<{ lead_id: number; funnel_id: number }>) agregadosDe.set(Number(r.lead_id), [...(agregadosDe.get(Number(r.lead_id)) ?? []), Number(r.funnel_id)]);
    if (pg.error) throw new Error(pg.error.message);
    if (cb.error) throw new Error(cb.error.message);
    const pagosDe = new Map<number, Pago[]>();
    for (const p of (pg.data ?? []) as Pago[]) pagosDe.set(Number(p.lead_id), [...(pagosDe.get(Number(p.lead_id)) ?? []), p]);
    const cobrosDe = new Map<number, CobroParaCobrado[]>();
    for (const c of (cb.data ?? []) as Array<CobroParaCobrado & { lead_id: number }>) cobrosDe.set(Number(c.lead_id), [...(cobrosDe.get(Number(c.lead_id)) ?? []), c]);
    return filas.flatMap((l): ItemPorCobrar[] => {
      // Los pagos de la CASA, con la regla de `esDelTrato` (M2): lo de una renovación no es un mes de esta suscripción, y un
      // mes cobrado en una casa anterior (la que se quitó) sigue siendo de la casa.
      const casa = l.funnel_id != null ? Number(l.funnel_id) : casaDelNegocio;
      const agregados = (agregadosDe.get(Number(l.id)) ?? []).filter((f) => f !== casa);
      const it = itemDeSuscripcion({ lead: l, pagos: (pagosDe.get(Number(l.id)) ?? []).filter((p) => esDelTrato(p.funnel_id, null, agregados)), cobros: cobrosDe.get(Number(l.id)) ?? [], movimientos: mv.porLead.get(Number(l.id)) ?? [], hoy, ventana: { desde, hasta } });
      return it ? [{ ...it, crm: null, funnel_id: l.funnel_id != null ? Number(l.funnel_id) : casaDelNegocio }] : [];
    });
  } catch (e) {
    console.error('[pagos] suscripciones por cobrar:', e instanceof Error ? e.message : String(e));
    return [];
  }
}

/**
 * «A quién cobrarle» entero: las filas de las cuotas (`getOutstandingDetalle`) y las de las suscripciones. Un lead que
 * ya tiene una fila por una cuota no se repite. El `detalle` (y su `total`, el Outstanding) sigue siendo el de las
 * cuotas. Lo leen la tab General, el teléfono, el conjunto «Clientes por cobrar» del Dashboard y la API de MaKo.
 */
export async function getPorCobrar(hoy: string, desde: string | null, hasta: string | null): Promise<{ detalle: Awaited<ReturnType<typeof getOutstandingDetalle>>; items: ItemPorCobrar[] }> {
  const [detalle, subs] = await Promise.all([getOutstandingDetalle(hoy, desde, hasta), getSuscripcionesPorCobrar(hoy, desde, hasta)]);
  // Una suscripción es de la casa (0324): la tapa un renglón de cuotas de la CASA, no el de una renovación.
  const conCuota = new Set(detalle.items.filter((i) => i.crm == null).map((i) => Number(i.lead_id)));
  return { detalle, items: [...detalle.items, ...subs.filter((s) => !conCuota.has(Number(s.lead_id)))] };
}

export type CuotaPendiente = {
  pago_id: number;
  lead_id: number;
  lead_nombre: string;
  numero: number;
  monto_usd: number;
  fecha_esperada: string;
  dias: number; // negativo = vencida hace N días; positivo = vence en N días
  /** La moneda de la cuota (null = USD) y su monto en ella: la de un tramo en pesos se le recuerda en pesos. */
  moneda?: string | null;
  monto_original?: number | null;
};

/**
 * Cuotas no pagadas con su estado de vencimiento, para las alertas de Vista
 * General. `vencidas` = fecha_esperada < hoy; `porVencer` = vence dentro de
 * `diasAviso` días (default 3).
 */
export const getCuotasPendientes = cachedRead('getCuotasPendientes', _getCuotasPendientes, { tags: [TAG.pagos], revalidate: TTL.user });
async function _getCuotasPendientes(
  // Sin default (20/10/2026): el de antes era el día UTC. Quien llama pasa el del negocio (`hoyEnWorkspace`).
  hoy: string,
  diasAviso = 3,
): Promise<{ vencidas: CuotaPendiente[]; porVencer: CuotaPendiente[] }> {
  const supabase = (await getTenantDb());
  // PAGINADO, con un orden ÚNICO (vencimiento + id): con uno que empata, las páginas se pisan (lib/supabase-paginado.ts).
  const data = await leerTodo<Record<string, unknown>>(supabase, 'pagos', 'id, lead_id, numero, monto_usd, fecha_esperada, moneda, monto_original, leads(nombre)', {
    orden: ['fecha_esperada', 'id'],
    filtros: (q) => q.eq('pagado', false).not('fecha_esperada', 'is', null),
  }).catch((e: unknown) => { throw new Error(`Error listando cuotas pendientes: ${e instanceof Error ? e.message : String(e)}`); });

  const [hy, hm, hd] = hoy.split('-').map(Number);
  const hoyUTC = Date.UTC(hy, hm - 1, hd);

  const vencidas: CuotaPendiente[] = [];
  const porVencer: CuotaPendiente[] = [];

  for (const row of (data ?? []) as Array<{
    id: number;
    lead_id: number;
    numero: number;
    monto_usd: number;
    fecha_esperada: string;
    moneda?: string | null;
    monto_original?: number | string | null;
    leads: { nombre: string } | { nombre: string }[] | null;
  }>) {
    const [fy, fm, fd] = row.fecha_esperada.split('-').map(Number);
    const dias = Math.floor((Date.UTC(fy, fm - 1, fd) - hoyUTC) / (1000 * 60 * 60 * 24));
    const leadRel = Array.isArray(row.leads) ? row.leads[0] : row.leads;
    const item: CuotaPendiente = {
      pago_id: row.id,
      lead_id: row.lead_id,
      lead_nombre: leadRel?.nombre ?? `Lead #${row.lead_id}`,
      numero: row.numero,
      monto_usd: Number(row.monto_usd),
      fecha_esperada: row.fecha_esperada,
      dias,
      moneda: row.moneda ?? null,
      monto_original: row.monto_original == null ? null : Number(row.monto_original),
    };
    if (dias < 0) vencidas.push(item);
    else if (dias <= diasAviso) porVencer.push(item);
  }

  return { vencidas, porVencer };
}

// ─────────────────────────────────────────────────────────────────────────────
// El deal CAMPO POR CAMPO (14/10/2026, docs/diseno-ficha-bloques.md §3 Pagos)
// ─────────────────────────────────────────────────────────────────────────────
// Lo llaman los bloques de Pagos (app/crm/[id]/pagos-campo-actions.ts, que cortan sin sesión) y la API de MaKo
// (lib/api-mako/areas/cobros.run.ts, adentro de runWithWorkspace). Las reglas son puras (lib/pagos-campo.ts);
// acá se lee la fila del NEGOCIO, se escribe con compare-and-set y se deja la línea del historial con el actor.
//
// ⚠️ EL MERGE DE UN JSONB ES READ-MODIFY-WRITE, y dos pestañas editando dos campos de la misma sección en el
// mismo segundo se pisarían una a la otra. Por eso el update va con `.eq('updated_at', lo_leido)` (el trigger de
// la mig 0001 lo mueve en cada escritura del lead) y se reintenta con la fila fresca: la segunda escritura
// mergea sobre la primera en vez de borrarla.

type Fallo = { ok: false; error: string; faltan?: string[] };
const esFallo = (x: unknown): x is Fallo => !!x && typeof x === 'object' && (x as { ok?: unknown }).ok === false;

/** La fila del lead de ESTE negocio con las columnas pedidas, o null. */
async function filaDelLead(leadId: number, cols: string): Promise<Record<string, unknown> | null> {
  if (!Number.isInteger(leadId) || leadId <= 0) return null;
  const { data, error } = await (await getTenantDb()).from('leads').select(cols).eq('id', leadId).maybeSingle();
  if (error) throw new Error(`No pude leer el lead ${leadId}: ${error.message}`);
  return (data as Record<string, unknown> | null) ?? null;
}

/**
 * Read-modify-write de UNA columna del lead con compare-and-set sobre `updated_at`, hasta 3 vueltas. `armar` recibe
 * el valor fresco y devuelve el nuevo (o null para no escribir). Devuelve lo que armó la vuelta que escribió.
 */
async function escribirConCas<T extends object = object>(leadId: number, col: string, armar: (actual: unknown) => ({ nuevo: unknown } & T) | Fallo | null): Promise<({ ok: true; escribio: boolean } & Partial<T>) | Fallo> {
  const db = await getTenantDb();
  for (let vuelta = 0; vuelta < 3; vuelta++) {
    const fila = await filaDelLead(leadId, `${col}, updated_at`);
    if (!fila) return { ok: false, error: 'No encontré ese lead en este negocio.' };
    const r = armar(fila[col]);
    if (r == null) return { ok: true, escribio: false };
    if (esFallo(r)) return r;
    const { nuevo, ...resto } = r as { nuevo: unknown } & T;
    let q = db.from('leads').update({ [col]: nuevo }).eq('id', leadId);
    q = fila.updated_at == null ? q.is('updated_at', null) : q.eq('updated_at', fila.updated_at as string);
    const { data, error } = await q.select('id');
    if (error) return { ok: false, error: `No pude guardar: ${error.message}` };
    if (data?.length) return { ok: true, escribio: true, ...(resto as unknown as Partial<T>) };
  }
  return { ok: false, error: 'El lead cambió mientras guardabas. Vuelve a intentarlo.' };
}

export type CambioCampoDeal =
  | { seccion: SeccionDeal; campo: string; valor: string | null }
  | { seccion: 'lead'; campo: CampoLeadDeal; valor: string | number | null };

/**
 * Un campo del deal: de una sección jsonb (MERGE, el resto y el documento fiscal quedan) o uno de los dos sueltos
 * (`fecha_inicio_servicio`, `facturado_por_id`, que tiene que ser una identidad fiscal de ESTE negocio).
 * Devuelve el valor de antes, que es el Deshacer (se vuelve a llamar con él).
 */
export async function escribirCampoDeal(leadId: number, c: CambioCampoDeal, autor: string): Promise<{ ok: true; cambio: boolean; antes: string | number | null; despues: string | number | null } | Fallo> {
  if (c.seccion === 'lead') {
    if (!esCampoLeadDeal(c.campo)) return { ok: false, error: 'Ese dato no existe en el deal.' };
    let valor: string | number | null = c.valor == null || c.valor === '' ? null : c.valor;
    if (c.campo === 'fecha_inicio_servicio' && valor != null && (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor))) return { ok: false, error: 'La fecha tiene que ser AAAA-MM-DD.' };
    let nombreNuevo: string | null = null;
    if (c.campo === 'facturado_por_id' && valor != null) {
      const id = Number(valor);
      if (!Number.isInteger(id) || id <= 0) return { ok: false, error: 'Esa identidad fiscal no existe.' };
      const { data, error } = await (await getTenantDb()).from('identidades_fiscales').select('id, nombre').eq('id', id).maybeSingle();
      if (error) return { ok: false, error: `No pude leer la identidad fiscal: ${error.message}` };
      if (!data) return { ok: false, error: 'Esa identidad fiscal no es de este negocio.' };
      valor = id;
      nombreNuevo = String((data as { nombre: string }).nombre);
    }
    const fila = await filaDelLead(leadId, c.campo);
    if (!fila) return { ok: false, error: 'No encontré ese lead en este negocio.' };
    const antes = (fila[c.campo] as string | number | null) ?? null;
    if (String(antes ?? '') === String(valor ?? '')) return { ok: true, cambio: false, antes, despues: valor };
    const { error } = await (await getTenantDb()).from('leads').update({ [c.campo]: valor }).eq('id', leadId);
    if (error) return { ok: false, error: `No pude guardar: ${error.message}` };
    let nombreAntes: string | null = antes == null ? null : String(antes);
    if (c.campo === 'facturado_por_id' && antes != null) {
      const { data } = await (await getTenantDb()).from('identidades_fiscales').select('nombre').eq('id', Number(antes)).maybeSingle();
      nombreAntes = (data as { nombre?: string } | null)?.nombre ?? `#${String(antes)}`;
    }
    await anotarEnHistorial(leadId, [{ campo: CAMPOS_LEAD_DEAL[c.campo], valor_anterior: nombreAntes, valor_nuevo: nombreNuevo ?? (valor == null ? null : String(valor)) }], autor);
    return { ok: true, cambio: true, antes, despues: valor };
  }
  if (!esSeccionDeal(c.seccion)) return { ok: false, error: 'Esa sección no existe en el deal.' };
  const seccion = c.seccion;
  const v = valorDeCampoDeal(seccion, c.campo, c.valor);
  if (!v.ok) return v;
  const r = await escribirConCas<{ antes: string | null }>(leadId, COLUMNA_SECCION[seccion], (actual) => {
    const m = fusionarCampo(actual as Record<string, unknown> | null, c.campo, v.valor);
    return m.cambio ? { nuevo: m.seccion, antes: m.antes } : null;
  });
  if (!r.ok) return r;
  if (!r.escribio) return { ok: true, cambio: false, antes: v.valor, despues: v.valor };
  const antes = r.antes ?? null;
  await anotarEnHistorial(leadId, [{ campo: rotuloCampoDeal(seccion, c.campo), valor_anterior: antes, valor_nuevo: v.valor }], autor);
  return { ok: true, cambio: true, antes, despues: v.valor };
}

/** Un renglón de las obligaciones (agregar, editar o quitar), con compare-and-set y su Deshacer. */
export async function escribirObligacion(leadId: number, cambio: CambioObligacion, autor: string): Promise<{ ok: true; obligaciones: Obligaciones; deshacer: CambioObligacion } | Fallo> {
  let aplicado: { obligaciones: Obligaciones; antes: string | null; despues: string | null; deshacer: CambioObligacion } | null = null;
  const r = await escribirConCas(leadId, 'deal_obligaciones', (actual) => {
    const a = aplicarObligacion(actual, cambio);
    if (!a.ok) return a;
    aplicado = a;
    return { nuevo: a.obligaciones };
  });
  if (!r.ok) return r;
  const hecho = aplicado as { obligaciones: Obligaciones; antes: string | null; despues: string | null; deshacer: CambioObligacion } | null;
  if (!hecho) return { ok: false, error: 'No se guardó nada.' };
  await anotarEnHistorial(leadId, [{ campo: rotuloObligacion(cambio.parte), valor_anterior: hecho.antes, valor_nuevo: hecho.despues }], autor);
  return { ok: true, obligaciones: hecho.obligaciones, deshacer: hecho.deshacer };
}

const ROTULO_TIPO: Readonly<Record<VentaTipo, string>> = { unico: 'Pago único', suscripcion: 'Suscripción', sin_cobro: 'Sin cobro' };

/**
 * Un dato de la venta (monto, plazo, fecha o tipo), con compare-and-set sobre `venta_tipo` como Editar deal
 * (deal-actions.ts): una pantalla vieja no le cuelga una mensualidad a un pago único. `tipoVisto` es el tipo que
 * dibujó la pantalla: si ya no es ése, no se escribe. Salir de «sin cobro» va por `quitarSinCobro` (su CAS).
 *
 * La plata deja su diff con `logLeadChanges` (AUDIT_FIELDS: «Monto de cierre», «Suscripción (USD/mes)», «Plazo de
 * la suscripción»), que la ficha sabe REVERTIR; la fecha y el tipo dejan su línea con el antes y el después.
 */
export async function escribirVenta(leadId: number, cambio: CambioVenta, opts: { autor: string; tipoVisto?: VentaTipo | null; crm?: Crm }): Promise<{ ok: true; cambio: boolean; ventaTipo: VentaTipo; deshacer: CambioVenta[] } | Fallo> {
  if (opts.crm != null) return escribirVentaDeCrm(leadId, opts.crm, cambio, opts);
  const fila = await filaDelLead(leadId, 'venta_tipo, monto_cierre_usd, suscripcion_monto_usd, suscripcion_meses, fecha_cierre');
  if (!fila) return { ok: false, error: 'No encontré ese lead en este negocio.' };
  const tipo = ventaTipoDe(fila.venta_tipo as string | null);
  if (opts.tipoVisto && opts.tipoVisto !== tipo) return { ok: false, error: 'El tipo de venta cambió en otra pantalla. Recarga la ficha.' };
  // ⚠️ UNA SUSCRIPCIÓN QUE COBRA LA PASARELA NO SE CAMBIA DESDE EL CRM (revisión del 14/10/2026): pasarla a pago
  // único, o cambiarle la mensualidad o el plazo, dejaba al MRR contando otra cosa mientras Stripe o Mercado Pago
  // seguían cobrando lo de siempre (y la renovación siguiente entraba como cuota de un pago único). Es la misma
  // condición con que se niega cancelarla a mano (`laCobraLaPasarela`). La fecha sí se corrige.
  if (tipo === 'suscripcion' && cambio.campo !== 'fecha') {
    const { data: cs, error: eC } = await (await getTenantDb()).from('cobros').select('tipo, estado, suscripcion_estado').eq('lead_id', leadId).eq('tipo', 'suscripcion');
    if (eC) return { ok: false, error: `No pude revisar si la cobra la pasarela: ${eC.message}` };
    if (laCobraLaPasarela((cs ?? []) as Array<{ tipo: string; estado: string; suscripcion_estado: string | null }>)) {
      return { ok: false, error: 'Esta suscripción la cobra la pasarela: se cambia o se cancela desde su cobro, en Links de pago.' };
    }
  }
  const cuotas = await getPagosByLead(leadId);
  const cobradas = cuotas.filter((q) => q.pagado).length;
  const impagas = cuotas.filter((q) => !q.pagado && !noEsDeuda(q)).length;
  const p = patchDeVenta(fila as FilaVenta, cambio, { hayCobradas: cobradas > 0, impagas });
  if (!p.ok) {
    if ('usarQuitarSinCobro' in p && p.usarQuitarSinCobro) {
      const q = await quitarSinCobro(leadId, opts.autor);
      return q.cambio
        ? { ok: true, cambio: true, ventaTipo: 'unico', deshacer: [{ campo: 'tipo', valor: VENTA_SIN_COBRO }] }
        : { ok: false, error: 'El tipo de venta cambió en otra pantalla. Recarga la ficha.' };
    }
    return p;
  }
  if (p.nada) return { ok: true, cambio: false, ventaTipo: tipo, deshacer: [] };
  const before = await getLead(leadId).catch(() => null);
  const db = await getTenantDb();
  let q = db.from('leads').update(p.patch).eq('id', leadId);
  if (p.tipoEsperado) q = q.eq('venta_tipo', p.tipoEsperado);
  const { data, error } = await q.select('id');
  if (error) return { ok: false, error: `No pude guardar la venta: ${error.message}` };
  if (!data?.length) return { ok: false, error: 'El tipo de venta cambió en otra pantalla. Recarga la ficha.' };
  const after = await getLead(leadId).catch(() => null);
  await logLeadChanges(leadId, before, after, opts.autor);
  const lineas: Array<{ campo: string; valor_anterior: string | null; valor_nuevo: string | null }> = [];
  if (cambio.campo === 'fecha') lineas.push({ campo: 'Fecha de cierre', valor_anterior: (fila.fecha_cierre as string | null) ?? null, valor_nuevo: cambio.valor ?? null });
  const nuevoTipo = cambio.campo === 'tipo' ? ventaTipoDe(cambio.valor) : tipo;
  if (nuevoTipo !== tipo) lineas.push({ campo: 'Tipo de venta', valor_anterior: ROTULO_TIPO[tipo], valor_nuevo: ROTULO_TIPO[nuevoTipo] });
  await anotarEnHistorial(leadId, lineas, opts.autor);
  return { ok: true, cambio: true, ventaTipo: nuevoTipo, deshacer: p.deshacer };
}

/** El nombre de un CRM para el historial («Monto · Renovación»). Si no se puede leer, «otro CRM». */
async function nombreDelCrm(crm: number): Promise<string> {
  const { data } = await (await getTenantDb()).from('funnels').select('nombre').eq('id', crm).maybeSingle();
  return ((data as { nombre?: string } | null)?.nombre ?? '').trim() || 'otro CRM';
}

/**
 * La venta de un CRM AGREGADO (mig 0324): monto, fecha de cierre o tipo (pago único o «sin cobro»; la suscripción es de la
 * casa), en su fila de `lead_funnel`, con el MISMO `patchDeVenta` y el mismo compare-and-set sobre el tipo que la casa.
 * La salida de «Sin cobro» va acá mismo (la de la casa es `quitarSinCobro`, sobre `leads`). Deja su línea en el historial
 * del lead con el nombre del CRM.
 */
async function escribirVentaDeCrm(leadId: number, crm: number, cambio: CambioVenta, opts: { autor: string; tipoVisto?: VentaTipo | null }): Promise<{ ok: true; cambio: boolean; ventaTipo: VentaTipo; deshacer: CambioVenta[] } | Fallo> {
  const t = await filaDelTrato(leadId, crm);
  if (!t) return { ok: false, error: 'Este lead ya no está en ese CRM. Recarga la ficha.' };
  const tipo = ventaTipoDe(t.venta_tipo);
  if (opts.tipoVisto && opts.tipoVisto !== tipo) return { ok: false, error: 'El tipo de venta cambió en otra pantalla. Recarga la ficha.' };
  if (cambio.campo === 'tipo' && cambio.valor === 'suscripcion') return { ok: false, error: 'Una suscripción va en el CRM de la casa del lead: aquí la venta es de un pago o en cuotas.' };
  const db = await getTenantDb();
  const ahora = new Date().toISOString();
  const nombre = await nombreDelCrm(crm);
  const cuotas = await getPagosByLead(leadId, crm);
  const p = patchDeVenta(t, cambio, { hayCobradas: cuotas.some((q) => q.pagado), impagas: cuotas.filter((q) => !q.pagado && !noEsDeuda(q)).length });
  if (!p.ok) {
    if ('usarQuitarSinCobro' in p && p.usarQuitarSinCobro) {
      const { data, error } = await db.from('lead_funnel').update({ venta_tipo: 'unico', updated_at: ahora }).eq('id', t.id).eq('venta_tipo', VENTA_SIN_COBRO).select('id');
      if (error) return { ok: false, error: `No pude guardar la venta: ${error.message}` };
      if (!data?.length) return { ok: false, error: 'El tipo de venta cambió en otra pantalla. Recarga la ficha.' };
      await anotarEnHistorial(leadId, [{ campo: `Tipo de venta · ${nombre}`, valor_anterior: ROTULO_TIPO.sin_cobro, valor_nuevo: ROTULO_TIPO.unico }], opts.autor);
      return { ok: true, cambio: true, ventaTipo: 'unico', deshacer: [{ campo: 'tipo', valor: VENTA_SIN_COBRO }] };
    }
    return p;
  }
  if (p.nada) return { ok: true, cambio: false, ventaTipo: tipo, deshacer: [] };
  // Sólo lo que un CRM agregado guarda: la mensualidad y el plazo de `patchDeVenta` son de una suscripción, que acá no hay.
  const patch = Object.fromEntries(Object.entries(p.patch).filter(([k]) => k === 'venta_tipo' || k === 'monto_cierre_usd' || k === 'fecha_cierre'));
  let q = db.from('lead_funnel').update({ ...patch, updated_at: ahora }).eq('id', t.id);
  // El compare-and-set del tipo: NULL es «pago único» sin elegir todavía.
  if (p.tipoEsperado) q = t.venta_tipo == null ? q.is('venta_tipo', null) : q.eq('venta_tipo', t.venta_tipo);
  const { data, error } = await q.select('id');
  if (error) return { ok: false, error: /column|columna/i.test(error.message) ? FALTA_0324 : `No pude guardar la venta: ${error.message}` };
  if (!data?.length) return { ok: false, error: 'El tipo de venta cambió en otra pantalla. Recarga la ficha.' };
  const nuevoTipo = cambio.campo === 'tipo' ? ventaTipoDe(cambio.valor) : tipo;
  const txt = (v: unknown) => (v == null ? null : String(v));
  const lineas: Array<{ campo: string; valor_anterior: string | null; valor_nuevo: string | null }> = [];
  if ('monto_cierre_usd' in patch && txt(patch.monto_cierre_usd) !== txt(t.monto_cierre_usd)) lineas.push({ campo: `Monto de cierre · ${nombre}`, valor_anterior: txt(t.monto_cierre_usd), valor_nuevo: txt(patch.monto_cierre_usd) });
  if (cambio.campo === 'fecha') lineas.push({ campo: `Fecha de cierre · ${nombre}`, valor_anterior: t.fecha_cierre, valor_nuevo: cambio.valor ?? null });
  if (nuevoTipo !== tipo) lineas.push({ campo: `Tipo de venta · ${nombre}`, valor_anterior: ROTULO_TIPO[tipo], valor_nuevo: ROTULO_TIPO[nuevoTipo] });
  await anotarEnHistorial(leadId, lineas, opts.autor);
  return { ok: true, cambio: true, ventaTipo: nuevoTipo, deshacer: p.deshacer };
}

/**
 * Saca a un lead de «Sin cobro»: vuelve a pago único, con compare-and-set sobre el tipo. Es la regla de
 * `quitarSinCobroAction` (deal-actions.ts) para quien no es una pantalla con sesión (la API) o la llama por
 * dentro (`escribirVenta`); la acción se queda con la suya, que la tarjeta del deal usa tal cual.
 */
export async function quitarSinCobro(leadId: number, autor: string): Promise<{ cambio: boolean }> {
  const { data, error } = await (await getTenantDb()).from('leads')
    .update({ venta_tipo: 'unico' }).eq('id', leadId).eq('venta_tipo', VENTA_SIN_COBRO).select('id');
  if (error) throw new Error(`No se pudo cambiar el tipo de venta: ${error.message}`);
  if (!data?.length) return { cambio: false };
  await logLeadEvent(leadId, 'Tipo de venta', 'Con cobro', autor);
  return { cambio: true };
}
