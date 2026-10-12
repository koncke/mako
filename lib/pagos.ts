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

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de fecha
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Suma `meses` a una fecha YYYY-MM-DD y fija el día en `dia` (1-28, ya capado).
 * Trabaja en UTC para no depender del huso del server.
 */
function fechaCuota(base: string, meses: number, dia: number): string {
  const [y, m] = base.split('-').map(Number);
  // m es 1-based; pasamos a Date con (m-1)+meses; el día se setea explícito
  const d = new Date(Date.UTC(y, m - 1 + meses, dia));
  return d.toISOString().slice(0, 10);
}

// ─────────────────────────────────────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Guarda el plan de pagos de un lead y (re)genera las filas de `pagos`.
 *
 * Regla de regeneración: SOLO toca las filas NO pagadas. Las cuotas ya cobradas
 * quedan intactas (su monto/fecha real es histórico). Si el plan se achica, las
 * cuotas no pagadas que sobran se borran.
 *
 * fecha base = fecha_cierre del lead (o hoy si no hay). El inicial vence en la
 * fecha del cierre; la cuota N vence el `dia_de_pago` del mes N siguiente.
 */
export async function savePlanPagos(
  leadId: number,
  plan: PlanPagos,
  hoy: string = new Date().toISOString().slice(0, 10),
): Promise<Pago[]> {
  const supabase = (await getTenantDb());

  // Necesitamos la fecha de cierre como ancla del calendario
  const { data: leadRow, error: leadErr } = await supabase
    .from('leads')
    .select('fecha_cierre')
    .eq('id', leadId)
    .single();
  if (leadErr) throw new Error(`Error leyendo lead ${leadId}: ${leadErr.message}`);
  const base = (leadRow?.fecha_cierre as string | null) ?? hoy;

  // Persistir las columnas del plan en el lead
  const { error: planErr } = await supabase
    .from('leads')
    .update({
      cobro_inicial_usd: plan.cobro_inicial_usd,
      monto_cuota_usd: plan.monto_cuota_usd,
      total_cuotas: plan.total_cuotas,
      dia_de_pago: plan.dia_de_pago,
    })
    .eq('id', leadId);
  if (planErr) throw new Error(`Error guardando plan del lead ${leadId}: ${planErr.message}`);

  const existentes = await getPagosByLead(leadId);
  const pagados = new Set(existentes.filter((p) => p.pagado).map((p) => p.numero));

  // Construir las filas DESEADAS del plan
  const totalCuotas = plan.total_cuotas ?? 0;
  const dia = plan.dia_de_pago ?? 1;
  const deseadas: Array<{ numero: number; monto_usd: number; fecha_esperada: string }> = [];

  if (plan.cobro_inicial_usd && plan.cobro_inicial_usd > 0) {
    deseadas.push({ numero: 0, monto_usd: plan.cobro_inicial_usd, fecha_esperada: base });
  }
  if (plan.monto_cuota_usd && plan.monto_cuota_usd > 0) {
    for (let n = 1; n <= totalCuotas; n++) {
      deseadas.push({
        numero: n,
        monto_usd: plan.monto_cuota_usd,
        fecha_esperada: fechaCuota(base, n, dia),
      });
    }
  }

  const numerosDeseados = new Set(deseadas.map((d) => d.numero));

  // 1) Borrar filas NO pagadas que ya no están en el plan
  const aBorrar = existentes
    .filter((p) => !p.pagado && !numerosDeseados.has(p.numero))
    .map((p) => p.id);
  if (aBorrar.length > 0) {
    const { error } = await supabase.from('pagos').delete().in('id', aBorrar);
    if (error) throw new Error(`Error borrando pagos obsoletos: ${error.message}`);
  }

  // 2) Upsert de las deseadas que NO estén ya pagadas (a las pagadas no se tocan)
  const aUpsert = deseadas
    .filter((d) => !pagados.has(d.numero))
    .map((d) => ({
      lead_id: leadId,
      numero: d.numero,
      monto_usd: d.monto_usd,
      fecha_esperada: d.fecha_esperada,
    }));
  if (aUpsert.length > 0) {
    // onConflict (lead_id, numero): si ya existía una fila no pagada, actualiza
    // monto/fecha sin tocar pagado/fecha_pago (defaults solo aplican al insert).
    const { error } = await supabase
      .from('pagos')
      .upsert(aUpsert, { onConflict: 'lead_id,numero' });
    if (error) throw new Error(`Error guardando pagos del plan: ${error.message}`);
  }

  await sincronizarTotalCobrado(leadId);
  return getPagosByLead(leadId);
}

/**
 * Plan MANUAL desde el CRM: guarda las cuotas TAL CUAL (cada una su monto y su
 * fecha), sin la generación uniforme de savePlanPagos. Persiste también total,
 * duración y fechas del lead. Conserva las cuotas ya pagadas (no se tocan); las
 * no pagadas se reemplazan por la lista nueva.
 */
export type PlanManual = {
  total_usd: number | null;
  duracion_meses: number | null;
  fecha_cierre: string | null;   // YYYY-MM-DD
  fecha_inicio: string | null;   // YYYY-MM-DD
  cuotas: Array<{ monto_usd: number; fecha_esperada: string | null }>;
};

export async function saveLeadPlanManual(leadId: number, p: PlanManual): Promise<void> {
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

  // Conservar cuotas pagadas; reemplazar las no pagadas por la lista nueva.
  const existentes = await getPagosByLead(leadId);
  const pagados = existentes.filter((q) => q.pagado);
  const noPagadosIds = existentes.filter((q) => !q.pagado).map((q) => q.id);
  if (noPagadosIds.length > 0) {
    const { error } = await supabase.from('pagos').delete().in('id', noPagadosIds);
    if (error) throw new Error(`Error limpiando cuotas previas: ${error.message}`);
  }

  const base = pagados.length > 0 ? Math.max(...pagados.map((q) => q.numero)) : 0;
  const rows = p.cuotas
    .filter((c) => c.monto_usd > 0)
    .map((c, i) => ({ lead_id: leadId, numero: base + 1 + i, monto_usd: c.monto_usd, fecha_esperada: c.fecha_esperada }));
  if (rows.length > 0) {
    const { error } = await supabase.from('pagos').insert(rows);
    if (error) throw new Error(`Error guardando cuotas del lead ${leadId}: ${error.message}`);
  }

  await sincronizarTotalCobrado(leadId);
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
    const cuota = await db.from('pagos').select('id, pagado, proveedor_pago_id').eq('id', p.pagoId).eq('lead_id', p.leadId).maybeSingle();
    if (cuota.error) throw new Error(`Error leyendo la cuota ${p.pagoId}: ${cuota.error.message}`);
    if (cuota.data && !cuota.data.pagado && !cuota.data.proveedor_pago_id) {
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
