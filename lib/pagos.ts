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
import { cachedRead, TAG, TTL } from './cache';
import { VENTA_SIN_COBRO } from './venta-tipo';
import { pasaAGanado } from './crm-curso-al-ganar-reglas';
import { centavos, diferenciaPendiente, type RestoDeCobro } from './pagos-diferencia';
import {
  cuotasDelPlan, etiquetaDePago, pagoEnMoneda, reconciliarCuotas, MONEDA_POR_DEFECTO,
  type CuotaDeseada, type CuotaExistente, type ModoReconciliar, type PlanDeCuotas, type PlanUniforme, type Proteccion,
} from './pagos-campo';
import { esCuotaDevuelta } from './cobrado-lead';
import { normalizarMoneda } from './pasarela-moneda';
import { getSetting, setSetting } from './settings';

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
  proveedor?: 'stripe' | 'mercadopago' | null;
  proveedor_pago_id?: string | null;
  moneda?: string | null;          // la del cobro real; null = USD
  monto_original?: number | null;  // en esa moneda
  // Lo cargado a mano (mig XXXX): por qué y cómo se cobró. null en lo de la pasarela y en lo viejo.
  concepto?: string | null;
  metodo?: string | null;
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

/** Pagos de un lead, ordenados por numero (inicial primero). */
export async function getPagosByLead(leadId: number): Promise<Pago[]> {
  const supabase = (await getTenantDb());
  const { data, error } = await supabase
    .from('pagos')
    .select('*')
    .eq('lead_id', leadId)
    .order('numero', { ascending: true });
  if (error) throw new Error(`Error listando pagos del lead ${leadId}: ${error.message}`);
  return (data ?? []) as Pago[];
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
 * Qué protege a cada cuota impaga: un link sin pagar que la salda (`cobros.pago_id`, pendiente o rechazado) o
 * un recordatorio de cobranza abierto (`flujo_corridas.ctx.cuotaId`, pendiente).
 *
 * ⚠️ TIRA si no pudo leer: «no pude ver si tiene un link» NO es «no tiene». Con un default vacío, una falla de
 * lectura dejaba borrar la cuota de un link que el cliente está por pagar.
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

/** Las cuotas del lead como las lee `reconciliarCuotas`, con lo que protege a cada impaga. */
async function cuotasParaReconciliar(leadId: number): Promise<CuotaExistente[]> {
  const pagos = await getPagosByLead(leadId);
  const prot = await proteccionesDeCuotas(leadId, pagos.filter((q) => !q.pagado).map((q) => q.id));
  return pagos.map((q) => ({
    id: q.id, numero: q.numero, monto_usd: Number(q.monto_usd), fecha_esperada: q.fecha_esperada, pagado: q.pagado,
    devuelta: esCuotaDevuelta(q), protegida: prot.get(q.id) ?? [],
  }));
}

/**
 * Escribe lo que decidió `reconciliarCuotas`: primero actualiza por id, después inserta y AL FINAL borra. Si algo
 * falla a mitad de camino, quedan cuotas de más (se ven y se quitan), nunca de menos (una deuda que desaparece).
 * Cada escritura lleva `lead_id` y `pagado = false`: una cuota que se cobró mientras tanto no se pisa ni se borra.
 */
async function escribirReconciliacion(leadId: number, plan: PlanDeCuotas): Promise<void> {
  const db = await getTenantDb();
  for (const u of plan.actualizar) {
    const { error } = await db.from('pagos').update({ monto_usd: u.monto_usd, fecha_esperada: u.fecha_esperada })
      .eq('id', u.id).eq('lead_id', leadId).eq('pagado', false);
    if (error) throw new Error(`Error actualizando la cuota ${u.id}: ${error.message}`);
  }
  if (plan.insertar.length) {
    const rows = plan.insertar.map((i) => ({ lead_id: leadId, numero: i.numero, monto_usd: i.monto_usd, fecha_esperada: i.fecha_esperada }));
    const { error } = await db.from('pagos').insert(rows);
    if (error) throw new Error(`Error guardando cuotas del lead ${leadId}: ${error.message}`);
  }
  if (plan.borrar.length) {
    const { error } = await db.from('pagos').delete().in('id', plan.borrar.map((b) => b.id)).eq('lead_id', leadId).eq('pagado', false);
    if (error) throw new Error(`Error quitando cuotas del lead ${leadId}: ${error.message}`);
  }
}

/** Reconcilia una lista de cuotas impagas y sincroniza lo cobrado. Devuelve lo que hizo (y lo que NO tocó). */
export async function reconciliarYGuardar(leadId: number, deseadas: readonly CuotaDeseada[], modo: ModoReconciliar): Promise<PlanDeCuotas> {
  await asegurarLeadDelNegocio(leadId);
  const plan = reconciliarCuotas(await cuotasParaReconciliar(leadId), deseadas, modo);
  await escribirReconciliacion(leadId, plan);
  await sincronizarTotalCobrado(leadId);
  return plan;
}

/**
 * Las cuotas impagas de una pantalla que manda el ID de cada una (Editar deal, `saveCuotasAction`): la que trae
 * id se actualiza POR ID, la que no se inserta, y la impaga que no vino se borra — salvo que tenga un link sin
 * pagar o un recordatorio corriendo, que se conserva y se devuelve en `conservar`. NO gana el lead: ganarlo es
 * mover de etapa, no guardar cuotas.
 */
export async function guardarCuotasPorId(leadId: number, cuotas: ReadonlyArray<{ id?: number | null; monto_usd: number; fecha_esperada: string | null }>): Promise<PlanDeCuotas> {
  return reconciliarYGuardar(leadId, cuotas, 'porId');
}

export type ResultadoPlan = { pagos: Pago[]; cambios: PlanDeCuotas };

/**
 * Arma o ajusta el plan UNIFORME (inicial, cuota, cantidad y día de pago) y reconcilia sus cuotas por número:
 * la cuota N que ya existe se actualiza POR ID, la que falta se inserta, la que sobra se borra si no tiene link
 * ni recordatorio, y las cobradas no se tocan (cubren su número). NO gana el lead.
 *
 * fecha base = fecha_cierre del lead (o hoy si no hay). El inicial vence en la fecha del cierre; la cuota N vence
 * el `dia_de_pago` del mes N siguiente (el calendario de siempre, `cuotasDelPlan`).
 */
export async function ajustarPlanPagos(leadId: number, plan: PlanUniforme, hoy: string): Promise<ResultadoPlan> {
  const supabase = (await getTenantDb());
  const { data: leadRow, error: leadErr } = await supabase.from('leads').select('fecha_cierre').eq('id', leadId).single();
  if (leadErr) throw new Error(`Error leyendo lead ${leadId}: ${leadErr.message}`);
  const base = (leadRow?.fecha_cierre as string | null) ?? hoy;

  const { error: planErr } = await supabase.from('leads').update({
    cobro_inicial_usd: plan.cobro_inicial_usd,
    monto_cuota_usd: plan.monto_cuota_usd,
    total_cuotas: plan.total_cuotas,
    dia_de_pago: plan.dia_de_pago,
  }).eq('id', leadId);
  if (planErr) throw new Error(`Error guardando plan del lead ${leadId}: ${planErr.message}`);

  const cambios = await reconciliarYGuardar(leadId, cuotasDelPlan(plan, base), 'slots');
  return { pagos: await getPagosByLead(leadId), cambios };
}

/**
 * Guarda el plan de pagos de un lead y (re)genera las filas de `pagos`. Lo llaman el wizard de Ganado
 * (app/crm/actions.ts), `savePlanPagosAction` y la API (`guardar_plan_pagos`): es `ajustarPlanPagos` con la firma
 * de siempre. Desde el 14/10/2026 no borra una cuota con un link sin pagar ni con un recordatorio corriendo.
 */
export async function savePlanPagos(
  leadId: number,
  plan: PlanPagos,
  hoy: string = new Date().toISOString().slice(0, 10),
): Promise<Pago[]> {
  return (await ajustarPlanPagos(leadId, plan, hoy)).pagos;
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
  const supabase = (await getTenantDb());

  // El plan de pagos pertenece a un lead GANADO: dejamos el desenlace coherente
  // (estado_lead/cerro) para que Sold Revenue y los cierres lo cuenten siempre.
  const leadUpdate: Record<string, unknown> = { estado_lead: 'ganado', cerro: true };
  if (p.total_usd != null) leadUpdate.monto_cierre_usd = p.total_usd;
  if (p.duracion_meses != null) leadUpdate.duracion_meses = p.duracion_meses;
  if (p.fecha_cierre) leadUpdate.fecha_cierre = p.fecha_cierre;
  if (p.fecha_inicio) leadUpdate.fecha_inicio_servicio = p.fecha_inicio;
  // ⚠️ ESTE UPDATE TAMBIÉN GANA: no pasa por updateLead, así que el enganche «al ganar» (la
  // invitación automática al curso, lib/crm-curso-al-ganar.ts) se llama acá. Por eso se lee
  // el estado de ANTES: sólo la transición invita, y guardar las cuotas de un ganado no.
  const { data: antes } = await supabase.from('leads').select('estado_lead, funnel_id').eq('id', leadId).maybeSingle();
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
 * Edita UNA cuota impaga por su id: el monto, el vencimiento o los dos, sin borrar ni reinsertar nada (el link,
 * el recordatorio y el dedup siguen apuntando a la misma cuota). Lo que no se puede, lo dice:
 *   · una cuota cobrada se corrige desde el pago (desmarcarla), no acá: su monto es lo que entró;
 *   · con un link sin pagar, el monto no cambia (el link cobraría otro); la fecha sí;
 *   · con un recordatorio corriendo, nada: el recordatorio lleva el monto y la fecha de ESTA cuota.
 * Devuelve el antes y el después (para el historial y para Deshacer, que llama a esta misma función).
 */
export async function editarCuota(
  leadId: number,
  pagoId: number,
  cambio: { monto?: number | null; fecha?: string | null },
): Promise<{ antes: { monto_usd: number; fecha_esperada: string | null }; despues: { monto_usd: number; fecha_esperada: string | null }; numero: number }> {
  const db = await getTenantDb();
  const { data, error } = await db.from('pagos').select('id, numero, monto_usd, fecha_esperada, pagado, proveedor, cobro_id').eq('id', pagoId).eq('lead_id', leadId).maybeSingle();
  if (error) throw new Error(`Error leyendo la cuota ${pagoId}: ${error.message}`);
  if (!data) throw new Error('Esa cuota no existe en este lead.');
  const q = data as { numero: number; monto_usd: number; fecha_esperada: string | null; pagado: boolean; proveedor: string | null; cobro_id: number | null };
  if (q.pagado) throw new Error('Esa cuota ya está cobrada: para corregirla, desmárcala primero.');
  if (esCuotaDevuelta(q)) throw new Error('Esa cuota se devolvió: no se edita.');
  const antes = { monto_usd: Number(q.monto_usd), fecha_esperada: q.fecha_esperada };
  const despues = { ...antes };
  if (cambio.monto !== undefined) {
    const m = Number(cambio.monto);
    if (!Number.isFinite(m) || m <= 0) throw new Error('El monto tiene que ser mayor a cero.');
    despues.monto_usd = centavos(m);
  }
  if (cambio.fecha !== undefined) {
    if (cambio.fecha != null && !/^\d{4}-\d{2}-\d{2}$/.test(cambio.fecha)) throw new Error('La fecha tiene que ser AAAA-MM-DD.');
    despues.fecha_esperada = cambio.fecha;
  }
  const cambiaMonto = Math.abs(despues.monto_usd - antes.monto_usd) >= 0.005;
  const cambiaFecha = despues.fecha_esperada !== antes.fecha_esperada;
  if (!cambiaMonto && !cambiaFecha) return { antes, despues, numero: q.numero };
  const prot = (await proteccionesDeCuotas(leadId, [pagoId])).get(pagoId) ?? [];
  if (prot.includes('recordatorio')) throw new Error('Tiene un recordatorio de cobro en curso: córtalo para editarla.');
  if (prot.includes('link') && cambiaMonto) throw new Error('Tiene un link de pago sin pagar: anúlalo para cambiar el monto.');
  const { data: hecho, error: e2 } = await db.from('pagos').update({ monto_usd: despues.monto_usd, fecha_esperada: despues.fecha_esperada })
    .eq('id', pagoId).eq('lead_id', leadId).eq('pagado', false).select('id');
  if (e2) throw new Error(`Error guardando la cuota ${pagoId}: ${e2.message}`);
  if (!hecho?.length) throw new Error('La cuota cambió mientras tanto (¿se cobró?). Recarga la ficha.');
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
  return cerrarCorridasDeCuota(ws, pagoId);
}

/**
 * Marca un pago como cobrado (o lo revierte). Sincroniza total_cobrado_usd y
 * fecha_primer_pago del lead.
 */
export async function marcarPago(
  pagoId: number,
  pagado: boolean,
  fechaPago: string | null = new Date().toISOString().slice(0, 10),
): Promise<void> {
  const supabase = (await getTenantDb());
  const { data: pago, error: getErr } = await supabase
    .from('pagos')
    .select('lead_id')
    .eq('id', pagoId)
    .single();
  if (getErr) throw new Error(`Error leyendo pago ${pagoId}: ${getErr.message}`);

  const { error } = await supabase
    .from('pagos')
    .update({
      pagado,
      fecha_pago: pagado ? (fechaPago ?? new Date().toISOString().slice(0, 10)) : null,
    })
    .eq('id', pagoId);
  if (error) throw new Error(`Error marcando pago ${pagoId}: ${error.message}`);

  await sincronizarTotalCobrado(pago.lead_id as number);

  // ⚠️ MARCAR EL PAGO CORTA EL RECORDATORIO, y por eso vive acá y no en la pantalla: el
  // pago se marca desde la ficha, desde el doer de WhatsApp y desde la API, y una cura
  // puesta en un call site deja los otros dos mandando cobranza sobre algo ya cobrado.
  // Es la mitad de la tarjeta #19 que dice «sin que nadie la pause a mano».
  //
  // Sólo al marcar PAGADO: desmarcar un pago (un error de carga) no reabre la
  // secuencia, porque las corridas cerradas no vuelven a `pendiente` — y reabrirla
  // sería mandar de nuevo los mensajes que ya salieron.
  if (pagado) {
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
  }
}

/**
 * COBRA una cuota con fecha, hora y —si fue distinto— el monto real (pedido de Mauricio del 13/10/2026: «un pago
 * diferente»). Es lo que llaman la ficha del CRM (`marcarPagoManualAction`) y la API de MaKo (`marcar_pago_cobrado`):
 * una sola implementación.
 *
 * ⚠️ UN PAGO DE MENOS DEJA LA DIFERENCIA PENDIENTE (salvo `resto: 'descuento'`; la regla en lib/pagos-diferencia.ts):
 *    una fila NUEVA de `pagos` con el vencimiento de la cuota, numerada después de la última (el índice único es
 *    (lead_id, numero)). Se inserta ANTES de marcar: si falla, la cuota vuelve a su monto y no se marca nada. Sin
 *    esto, la diferencia desaparecía del plan y del Outstanding como si el cliente ya no la debiera.
 * ⚠️ La cuota tiene que ser de ESE lead (`lead_id`): el id llega de afuera.
 * No escribe el historial del lead: lo escribe quien llama, con su autor.
 */
export async function cobrarCuota(
  pagoId: number,
  leadId: number,
  datos: { monto?: number | null; fecha: string; hora?: string | null; resto?: RestoDeCobro } & DatosDeMoneda,
): Promise<{ original: number; monto: number | null; pendiente: number | null; descuento: number; moneda: string | null; montoOriginal: number | null }> {
  if (!datos.fecha) throw new Error('La fecha del pago es obligatoria.');
  const db = await getTenantDb();
  const { data: antes, error: eLeer } = await db.from('pagos').select('monto_usd, fecha_esperada, pagado').eq('id', pagoId).eq('lead_id', leadId).maybeSingle();
  if (eLeer) throw new Error(`Error leyendo el pago ${pagoId}: ${eLeer.message}`);
  if (!antes) throw new Error('Esa cuota no existe en este lead.');
  const fila = antes as { monto_usd: number; fecha_esperada: string | null; pagado: boolean };
  const original = Number(fila.monto_usd) || 0;
  const monto = datos.monto != null && Number.isFinite(datos.monto) && datos.monto > 0 ? centavos(datos.monto) : null;
  // La moneda en que se cobró (decisión 7). `monto` sigue siendo DÓLARES; sin `moneda`, todo como siempre.
  const enMonedaR = datos.moneda ? pagoEnMoneda({ montoUsd: monto ?? original, moneda: datos.moneda, montoOriginal: datos.montoOriginal }) : null;
  if (enMonedaR && !enMonedaR.ok) throw new Error(enMonedaR.error);
  const enMoneda = enMonedaR && enMonedaR.ok ? enMonedaR : null;
  const pend = diferenciaPendiente(original, monto, { yaPagada: fila.pagado, resto: datos.resto });
  const descuento = !fila.pagado && datos.resto === 'descuento' && monto != null && monto < original ? centavos(original - monto) : 0;

  // Hora (y monto si vino uno válido) primero; marcarPago sincroniza después.
  const upd: Record<string, unknown> = { pago_hora: datos.hora?.trim() || null };
  if (monto != null) upd.monto_usd = monto;
  if (enMoneda) { upd.moneda = enMoneda.moneda; upd.monto_original = enMoneda.montoOriginal; }
  const { error } = await db.from('pagos').update(upd).eq('id', pagoId);
  if (error) throw new Error(`Error actualizando el pago ${pagoId}: ${error.message}`);
  await etiquetarPago(pagoId, datos);

  if (pend > 0) {
    const existentes = await getPagosByLead(leadId);
    const base = existentes.length > 0 ? Math.max(...existentes.map((q) => q.numero)) : 0;
    const { error: eResto } = await db.from('pagos').insert({ lead_id: leadId, numero: base + 1, monto_usd: pend, fecha_esperada: fila.fecha_esperada ?? datos.fecha, pagado: false });
    if (eResto) {
      // Sin la fila de la diferencia, marcar por menos la borraría: la cuota vuelve a su monto.
      await db.from('pagos').update({ monto_usd: original }).eq('id', pagoId);
      throw new Error(`No pude dejar pendiente la diferencia: ${eResto.message}`);
    }
  }

  await marcarPago(pagoId, true, datos.fecha);
  return {
    original, monto, pendiente: pend > 0 ? pend : null, descuento,
    moneda: enMoneda?.moneda ?? null, montoOriginal: enMoneda?.montoOriginal ?? null,
  };
}

/**
 * Un pago FUERA DEL PLAN (un adelanto, un extra, otro esquema): una cuota nueva ya cobrada, numerada después de la
 * última, que pasa por `marcarPago` —lo cobrado del lead y el corte de los recordatorios—. No toca el monto de
 * cierre: si fue una venta nueva, se corrige en el deal. Lo llaman la ficha y la API de MaKo (`registrar_pago_suelto`).
 */
export async function registrarPagoSuelto(
  leadId: number,
  datos: { monto: number; fecha: string; hora?: string | null } & DatosDeMoneda,
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
  const existentes = await getPagosByLead(leadId);
  const base = existentes.length > 0 ? Math.max(...existentes.map((q) => q.numero)) : 0;
  const redondo = centavos(monto);
  const { data, error } = await db.from('pagos')
    .insert({
      lead_id: leadId, numero: base + 1, monto_usd: redondo, fecha_esperada: datos.fecha, pagado: false, pago_hora: datos.hora?.trim() || null,
      ...(enMoneda ? { moneda: enMoneda.moneda, monto_original: enMoneda.montoOriginal } : {}),
    })
    .select('id').single();
  if (error || !data) throw new Error(`No pude registrar el pago: ${error?.message ?? 'sin fila'}`);
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
 * Concepto y método del pago (mig XXXX). ⚠️ UPDATE APARTE Y QUE NO TIRA: si la migración todavía no corrió, la
 * columna no existe y PostgREST rechazaría la fila ENTERA. Perder la etiqueta se ve en el historial; perder el
 * pago, no. Molde: las omisiones del wizard de Ganado (app/crm/actions.ts, «update APARTE»).
 */
async function etiquetarPago(pagoId: number, datos: DatosDeMoneda): Promise<void> {
  const e = etiquetaDePago(datos);
  if (!e.concepto && !e.metodo) return;
  try {
    const { error } = await (await getTenantDb()).from('pagos').update({ concepto: e.concepto, metodo: e.metodo }).eq('id', pagoId);
    if (error) console.error(`[pagos] el concepto y el método del pago ${pagoId} no se guardaron (¿falta la migración?): ${error.message}`);
  } catch (err) {
    console.error(`[pagos] etiquetar el pago ${pagoId}:`, err instanceof Error ? err.message : err);
  }
}

/**
 * ⚠️ EL LEAD TIENE QUE SER DE ESTE NEGOCIO antes de insertarle una cuota. `getTenantDb` estampa el workspace en el
 * insert, pero `pagos.lead_id` sólo tiene FK a `leads(id)`: con el id de un lead de OTRO negocio, la fila entraba
 * en el cash de éste apuntando a una persona ajena, sin un error.
 */
export async function asegurarLeadDelNegocio(leadId: number): Promise<void> {
  if (!Number.isInteger(leadId) || leadId <= 0) throw new Error('Lead inválido.');
  const { data, error } = await (await getTenantDb()).from('leads').select('id').eq('id', leadId).maybeSingle();
  if (error) throw new Error(`No pude leer el lead ${leadId}: ${error.message}`);
  if (!data) throw new Error('No encontré ese lead en este negocio.');
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
  await setSetting(KEY_MONEDA_NEGOCIO, m);
  return m;
}

/**
 * Cancela (o reactiva) una suscripción MANUAL: la que no cobra una pasarela y se registra mes a mes. Como la de la
 * pasarela (`aplicarSuscripcionCancelada`, lib/cobros.ts), la pasa a PLAZO FIJO hasta hoy (`suscripcion_meses` =
 * meses transcurridos), así el MRR deja de contarla; y además deja la fecha en `suscripcion_cancelada_at`
 * (mig XXXX), que es lo que distingue «cancelada» de «terminó su plazo». Reactivar devuelve el plazo de antes.
 *
 * Compare-and-set sobre el tipo: sólo una suscripción. Devuelve el plazo que había (para Deshacer).
 */
export async function cambiarEstadoSuscripcionManual(
  leadId: number,
  estado: 'cancelada' | 'activa',
  opts: { hoy: string; mesesAlCancelar: number; mesesAlReactivar?: number | null },
): Promise<{ cambio: boolean; mesesAntes: number | null; canceladaAntes: string | null }> {
  const db = await getTenantDb();
  const { data, error } = await db.from('leads').select('venta_tipo, suscripcion_meses, suscripcion_cancelada_at').eq('id', leadId).maybeSingle();
  if (error) throw new Error(`No pude leer la suscripción: ${error.message}`);
  if (!data) throw new Error('No encontré ese lead en este negocio.');
  const fila = data as { venta_tipo: string | null; suscripcion_meses: number | null; suscripcion_cancelada_at: string | null };
  if (fila.venta_tipo !== 'suscripcion') throw new Error('Ese lead no es una suscripción.');
  const mesesAntes = fila.suscripcion_meses ?? null;
  const canceladaAntes = fila.suscripcion_cancelada_at ?? null;
  if ((estado === 'cancelada') === !!canceladaAntes) return { cambio: false, mesesAntes, canceladaAntes };
  const patch = estado === 'cancelada'
    ? { suscripcion_cancelada_at: `${opts.hoy}T12:00:00Z`, suscripcion_meses: opts.mesesAlCancelar }
    : { suscripcion_cancelada_at: null, suscripcion_meses: opts.mesesAlReactivar ?? null };
  const { data: hecho, error: e2 } = await db.from('leads').update(patch).eq('id', leadId).eq('venta_tipo', 'suscripcion').select('id');
  if (e2) throw new Error(`No pude guardar la suscripción: ${e2.message}`);
  return { cambio: !!hecho?.length, mesesAntes, canceladaAntes };
}

/**
 * Recalcula total_cobrado_usd y fecha_primer_pago del lead a partir de sus
 * pagos pagados. Mantiene coherentes los consumidores que leen total_cobrado.
 */
export async function sincronizarTotalCobrado(leadId: number): Promise<void> {
  const supabase = (await getTenantDb());
  const pagos = await getPagosByLead(leadId);
  const pagados = pagos.filter((p) => p.pagado);

  const total = pagados.reduce((s, p) => s + Number(p.monto_usd), 0);
  // Primer pago = la fecha_pago más temprana entre los pagados
  const fechas = pagados
    .map((p) => p.fecha_pago)
    .filter((f): f is string => !!f)
    .sort();
  const fechaPrimerPago = fechas[0] ?? null;

  const { error } = await supabase
    .from('leads')
    .update({
      total_cobrado_usd: total > 0 ? total : null,
      ...(fechaPrimerPago ? { fecha_primer_pago: fechaPrimerPago } : {}),
    })
    .eq('id', leadId);
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
  proveedor: 'stripe' | 'mercadopago';
  proveedorPagoId: string;
  montoUsd: number;
  montoOriginal: number;
  moneda: string;
  fechaPago: string;
}): Promise<{ pagoId: number; yaEstaba: boolean }> {
  const db = await getTenantDb();
  const marca = {
    cobro_id: p.cobroId,
    proveedor: p.proveedor,
    proveedor_pago_id: p.proveedorPagoId,
    moneda: p.moneda,
    monto_original: p.montoOriginal,
  };
  const buscarMia = () =>
    db.from('pagos').select('id').eq('lead_id', p.leadId)
      .eq('proveedor', p.proveedor).eq('proveedor_pago_id', p.proveedorPagoId).maybeSingle();

  const yaEsta = await buscarMia();
  if (yaEsta.error) throw new Error(`Error buscando el cobro ${p.proveedorPagoId}: ${yaEsta.error.message}`);
  if (yaEsta.data) {
    // «Ya estaba» puede ser un intento anterior que insertó la cuota y se cortó ANTES de sincronizar: sin esto,
    // `fecha_primer_pago` y lo cobrado no se escribían nunca (revisión del 11/10/2026). Sincronizar es idempotente.
    await sincronizarTotalCobrado(p.leadId);
    return { pagoId: Number(yaEsta.data.id), yaEstaba: true };
  }

  // La cuota que saldaba el link, si sigue existiendo y sigue sin pagar. Si ya la marcó alguien a
  // mano, el pago de la pasarela NO la pisa: entra como cuota nueva (la plata entró dos veces y
  // eso lo tiene que ver una persona, no esconderse).
  if (p.pagoId) {
    // De ESTE lead: un pagoId que viniera de otro lado no puede saldar la cuota de otra persona.
    const cuota = await db.from('pagos').select('id, pagado, proveedor_pago_id, monto_usd').eq('id', p.pagoId).eq('lead_id', p.leadId).maybeSingle();
    if (cuota.error) throw new Error(`Error leyendo la cuota ${p.pagoId}: ${cuota.error.message}`);
    // ⚠️ Y POR LO MISMO QUE COBRA (14/10/2026, el link por cuota): saldarla la marca pagada por SU monto, no por el del
    // link. Si alguien la cambió después de crear el link, marcarla mentiría en el cash: entra como una cuota nueva
    // (o salda otra del mismo monto, abajo) y la persona ve las dos.
    const mismoMonto = !!cuota.data && Math.abs(Number(cuota.data.monto_usd) - p.montoUsd) < 0.01;
    if (cuota.data && !cuota.data.pagado && !cuota.data.proveedor_pago_id && mismoMonto) {
      const { error } = await db.from('pagos').update(marca).eq('id', p.pagoId).is('proveedor_pago_id', null);
      if (error) {
        if (error.code === PG_DUPLICADO) return { pagoId: p.pagoId, yaEstaba: true };
        throw new Error(`Error marcando la cuota ${p.pagoId}: ${error.message}`);
      }
      await marcarPago(p.pagoId, true, p.fechaPago);
      return { pagoId: p.pagoId, yaEstaba: false };
    }
  }

  // ⚠️ SI EL LEAD YA TENÍA UNA CUOTA IMPAGA DE ESE MONTO, el pago la SALDA (revisión del 11/10/2026). Ningún
  // link nace atado a una cuota (`pagoId`), y sin esto el pago entraba como cuota NUEVA con la del plan
  // todavía impaga: Outstanding de más, recordatorios de cobranza a quien ya pagó y, cuando el closer la
  // marcaba a mano, el doble de cash. Se casa por monto en USD, la más vieja primero, sólo una sin pasarela.
  if (!p.pagoId) {
    const impagas = (await getPagosByLead(p.leadId))
      .filter((q) => !q.pagado && !q.proveedor_pago_id && q.fecha_esperada && Math.abs(Number(q.monto_usd) - p.montoUsd) < 0.01)
      .sort((a, b) => String(a.fecha_esperada).localeCompare(String(b.fecha_esperada)) || a.numero - b.numero);
    const casa = impagas[0];
    if (casa) {
      const { data: marcada, error } = await db.from('pagos').update(marca).eq('id', casa.id).eq('lead_id', p.leadId).is('proveedor_pago_id', null).select('id');
      if (error && error.code !== PG_DUPLICADO) throw new Error(`Error saldando la cuota ${casa.id}: ${error.message}`);
      if (!error && marcada && marcada.length) {
        await marcarPago(casa.id, true, p.fechaPago);
        return { pagoId: casa.id, yaEstaba: false };
      }
      // Otro escritor la tomó en el medio, o fue la reentrega: se sigue como si no hubiera.
      const otra = await buscarMia();
      if (otra.data) return { pagoId: Number(otra.data.id), yaEstaba: true };
    }
  }

  for (let intento = 0; intento < 2; intento++) {
    const existentes = await getPagosByLead(p.leadId);
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
        ...marca,
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
  proveedor: 'stripe' | 'mercadopago';
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
  const quedanPagadas = (await getPagosByLead(p.leadId)).filter((q) => q.pagado).length;
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
  const { data, error } = await supabase
    .from('pagos')
    .select('monto_usd')
    .eq('pagado', true)
    .gte('fecha_pago', start)
    .lte('fecha_pago', end);
  if (error) throw new Error(`Error sumando cash del período: ${error.message}`);
  return (data ?? []).reduce((s, p) => s + Number(p.monto_usd ?? 0), 0);
}

/**
 * Outstanding del período: Σ cuotas NO pagadas con vencimiento DESDE el inicio
 * del rango (sin tope superior — las cuotas futuras son receivables válidos, así
 * que "Máximo" trae el total). Un inicio más tardío excluye las ya vencidas
 * de antes del período.
 */
export async function getOutstandingPeriodo(start: string, _end: string): Promise<number> {
  const supabase = (await getTenantDb());
  const { data, error } = await supabase
    .from('pagos')
    .select('monto_usd')
    .eq('pagado', false)
    .gte('fecha_esperada', start);
  if (error) throw new Error(`Error sumando outstanding del período: ${error.message}`);
  return (data ?? []).reduce((s, p) => s + Number(p.monto_usd ?? 0), 0);
}

// Desglose por lead de las 3 métricas de Revenue (para los pop-ups).
// leadId permite el botón "Editar lead" dentro del desglose.
export type RevItem = { nombre: string; monto: number; fecha: string | null; detalle?: string; leadId?: number };
export type RevenueBreakdowns = { sold: RevItem[]; cash: RevItem[]; outstanding: RevItem[] };

const relNombre = (leads: unknown): string => {
  const r = Array.isArray(leads) ? leads[0] : leads;
  return (r as { nombre?: string } | null)?.nombre ?? '—';
};

export const getRevenueBreakdowns = cachedRead('getRevenueBreakdowns', _getRevenueBreakdowns, { tags: [TAG.pagos, TAG.leads], revalidate: TTL.user });
async function _getRevenueBreakdowns(start: string, end: string): Promise<RevenueBreakdowns> {
  const supabase = (await getTenantDb());
  const [soldRes, cashRes, outRes] = await Promise.all([
    // Sin los «sin cobro» (#747): el desglose cuenta lo MISMO que el «N cierres» de
    // getRevenuePeriod, o el pop-up lista un cierre más que el número de arriba.
    supabase.from('leads').select('id, nombre, monto_cierre_usd, fecha_cierre').eq('cerro', true).neq('venta_tipo', VENTA_SIN_COBRO).gte('fecha_cierre', start).lte('fecha_cierre', end),
    supabase.from('pagos').select('monto_usd, fecha_pago, numero, lead_id, leads(nombre)').eq('pagado', true).gte('fecha_pago', start).lte('fecha_pago', end),
    supabase.from('pagos').select('monto_usd, fecha_esperada, numero, lead_id, leads(nombre)').eq('pagado', false).gte('fecha_esperada', start),
  ]);
  if (soldRes.error) throw new Error(`Sold detalle: ${soldRes.error.message}`);
  if (cashRes.error) throw new Error(`Cash detalle: ${cashRes.error.message}`);
  if (outRes.error) throw new Error(`Outstanding detalle: ${outRes.error.message}`);

  const cuotaLabel = (n: number) => (n === 0 ? 'cobro inicial' : `cuota ${n}`);
  const sold: RevItem[] = (soldRes.data ?? []).map((r) => ({ nombre: (r.nombre as string) ?? '—', monto: Number(r.monto_cierre_usd ?? 0), fecha: (r.fecha_cierre as string | null) ?? null, leadId: Number(r.id) }))
    .sort((a, b) => b.monto - a.monto);
  const cash: RevItem[] = (cashRes.data ?? []).map((r) => ({ nombre: relNombre(r.leads), monto: Number(r.monto_usd ?? 0), fecha: (r.fecha_pago as string | null) ?? null, detalle: cuotaLabel(Number(r.numero)), leadId: Number(r.lead_id) }))
    .sort((a, b) => (a.fecha && b.fecha ? (a.fecha < b.fecha ? 1 : -1) : 0));
  const outstanding: RevItem[] = (outRes.data ?? []).map((r) => ({ nombre: relNombre(r.leads), monto: Number(r.monto_usd ?? 0), fecha: (r.fecha_esperada as string | null) ?? null, detalle: cuotaLabel(Number(r.numero)), leadId: Number(r.lead_id) }))
    .sort((a, b) => (a.fecha && b.fecha ? (a.fecha < b.fecha ? -1 : 1) : 0));
  return { sold, cash, outstanding };
}

/** Outstanding global: Σ monto_usd de pagos NO pagados (lo que falta cobrar). */
export async function getOutstandingTotal(): Promise<number> {
  const supabase = (await getTenantDb());
  const { data, error } = await supabase
    .from('pagos')
    .select('monto_usd')
    .eq('pagado', false);
  if (error) throw new Error(`Error sumando outstanding: ${error.message}`);
  return (data ?? []).reduce((s, p) => s + Number(p.monto_usd ?? 0), 0);
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
};

/**
 * Detalle nominal del outstanding (Fase 13): un renglón por lead con cuotas
 * pendientes. La suma de pendiente_usd iguala getOutstandingTotal().
 *
 * Devuelve además `cuotas`: un renglón POR CUOTA sin pagar dentro de la ventana
 * (para el desglose del KPI "Outstanding" del pop-up), ordenadas por
 * vencimiento. Así el número, el desglose y la tabla "a quién cobrarle" salen
 * TODOS de la misma query y quedan siempre coherentes entre sí.
 */
export const getOutstandingDetalle = cachedRead('getOutstandingDetalle', _getOutstandingDetalle, { tags: [TAG.pagos], revalidate: TTL.user });
async function _getOutstandingDetalle(
  hoy: string = new Date().toISOString().slice(0, 10),
  // Ventana opcional (filtro de fecha de Comercial): Outstanding mira hacia
  // ADELANTE, así que acota por VENCIMIENTO (fecha_esperada) de las cuotas sin
  // pagar dentro de [desde, hasta]. Sin ventana, es el pipeline completo a hoy.
  desde: string | null = null,
  hasta: string | null = null,
): Promise<{ items: OutstandingLead[]; total: number; cuotas: RevItem[] }> {
  const supabase = (await getTenantDb());
  const { data, error } = await supabase
    .from('pagos')
    .select('id, lead_id, numero, monto_usd, fecha_esperada, pagado, leads(nombre, monto_cierre_usd, fecha_cierre)');
  if (error) throw new Error(`Error leyendo detalle de outstanding: ${error.message}`);

  type Row = {
    id: number;
    lead_id: number;
    numero: number;
    monto_usd: number;
    fecha_esperada: string | null;
    pagado: boolean;
    leads: { nombre: string; monto_cierre_usd: number | null; fecha_cierre: string | null } | { nombre: string; monto_cierre_usd: number | null; fecha_cierre: string | null }[] | null;
  };

  const porLead = new Map<number, Row[]>();
  for (const row of (data ?? []) as Row[]) {
    const arr = porLead.get(row.lead_id) ?? [];
    arr.push(row);
    porLead.set(row.lead_id, arr);
  }

  const [hy, hm, hd] = hoy.split('-').map(Number);
  const hoyUTC = Date.UTC(hy, hm - 1, hd);
  const items: OutstandingLead[] = [];
  const cuotas: RevItem[] = [];
  const cuotaLabel = (n: number) => (n === 0 ? 'cobro inicial' : `cuota ${n}`);

  for (const [leadId, rows] of porLead) {
    let noPagados = rows.filter((r) => !r.pagado);
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
    const fechaCierre = rel?.fecha_cierre ?? null;
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
      vendido_usd: rel?.monto_cierre_usd ?? null,
      cobrado_usd: cobrado,
      pendiente_usd: pendiente,
      proxima_cuota: prox ? { pago_id: prox.id, numero: prox.numero, monto_usd: Number(prox.monto_usd), fecha_esperada: prox.fecha_esperada } : null,
      dias_desde_cierre: dias,
      fecha_cierre: fechaCierre,
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

export type CuotaPendiente = {
  pago_id: number;
  lead_id: number;
  lead_nombre: string;
  numero: number;
  monto_usd: number;
  fecha_esperada: string;
  dias: number; // negativo = vencida hace N días; positivo = vence en N días
};

/**
 * Cuotas no pagadas con su estado de vencimiento, para las alertas de Vista
 * General. `vencidas` = fecha_esperada < hoy; `porVencer` = vence dentro de
 * `diasAviso` días (default 3).
 */
export const getCuotasPendientes = cachedRead('getCuotasPendientes', _getCuotasPendientes, { tags: [TAG.pagos], revalidate: TTL.user });
async function _getCuotasPendientes(
  hoy: string = new Date().toISOString().slice(0, 10),
  diasAviso = 3,
): Promise<{ vencidas: CuotaPendiente[]; porVencer: CuotaPendiente[] }> {
  const supabase = (await getTenantDb());
  const { data, error } = await supabase
    .from('pagos')
    .select('id, lead_id, numero, monto_usd, fecha_esperada, leads(nombre)')
    .eq('pagado', false)
    .not('fecha_esperada', 'is', null)
    .order('fecha_esperada', { ascending: true });
  if (error) throw new Error(`Error listando cuotas pendientes: ${error.message}`);

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
    };
    if (dias < 0) vencidas.push(item);
    else if (dias <= diasAviso) porVencer.push(item);
  }

  return { vencidas, porVencer };
}
