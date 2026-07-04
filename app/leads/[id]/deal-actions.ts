'use server';

// =============================================================================
// Server actions de la tab Deal Details (+ identidades fiscales del workspace)
// =============================================================================
// - Identidades fiscales ("Facturado por"): CRUD por workspace. Se cargan una
//   sola vez en /configuraciones y se eligen en el Deal Details de cada lead.
// - Secciones del deal (fiscal / servicio / promesa / obligaciones): update
//   PARCIAL del lead — solo pisa las claves presentes en el patch.
// - Cuotas explícitas + marcar pago con hora/comprobante (migración 0060).
// Toda mutación humana deja rastro en lead_audit (patrón de app/leads/actions).

import { revalidatePath, updateTag } from 'next/cache';
import { TAG } from '@/lib/cache';
import { getTenantDb } from '@/lib/workspace';
import { getUsuarioActual } from '@/lib/auth';
import { logLeadEvent, type Lead } from '@/lib/leads';
import { saveLeadPlanManual, marcarPago } from '@/lib/pagos';
import { fmtDDMMYYYY } from '@/lib/date-utils';

// updateTag en try/catch: la mutación ya ocurrió; si la invalidación fallara,
// la caché igual vence sola por su TTL — nunca debe romper el guardado.
function bust(...tags: string[]) {
  try {
    for (const t of tags) updateTag(t);
  } catch {
    /* no-op: la caché vence por TTL */
  }
}

/** Autor para el historial: email del usuario logueado o 'CRM' (legacy/dev). */
async function autorActual(): Promise<string> {
  try {
    const s = await getUsuarioActual();
    return s?.email?.trim() || 'CRM';
  } catch {
    return 'CRM';
  }
}

function revalidarLead(leadId: number) {
  revalidatePath(`/leads/${leadId}`);
  revalidatePath('/leads');
}

// ─────────────────────────────────────────────────────────────────────────────
// Identidades fiscales del workspace ("Facturado por")
// ─────────────────────────────────────────────────────────────────────────────

export type IdentidadFiscal = {
  id: number;
  nombre: string;
  id_fiscal: string | null;
  domicilio: string | null;
  correo: string | null;
  es_default: boolean;
  created_at: string;
};

/** Identidades fiscales del workspace (default primero). */
export async function getIdentidadesFiscalesAction(): Promise<IdentidadFiscal[]> {
  const { data, error } = await (await getTenantDb())
    .from('identidades_fiscales')
    .select('id, nombre, id_fiscal, domicilio, correo, es_default, created_at')
    .order('es_default', { ascending: false })
    .order('created_at', { ascending: true });
  if (error) throw new Error(`Error listando identidades fiscales: ${error.message}`);
  return (data ?? []) as IdentidadFiscal[];
}

export type IdentidadFiscalInput = {
  id?: number | null;           // con id = editar; sin id = crear
  nombre: string;
  id_fiscal?: string | null;
  domicilio?: string | null;
  correo?: string | null;
  es_default?: boolean;
};

/** Crea o edita una identidad fiscal. Marcar default desmarca el resto. */
export async function saveIdentidadFiscalAction(input: IdentidadFiscalInput): Promise<void> {
  const nombre = input.nombre?.trim();
  if (!nombre) throw new Error('La razón social / nombre es obligatoria.');
  const db = await getTenantDb();
  const row = {
    nombre,
    id_fiscal: input.id_fiscal?.trim() || null,
    domicilio: input.domicilio?.trim() || null,
    correo: input.correo?.trim() || null,
    es_default: !!input.es_default,
  };
  // Un solo default por workspace: al marcar uno se desmarca el anterior.
  if (row.es_default) {
    const { error } = await db.from('identidades_fiscales').update({ es_default: false }).eq('es_default', true);
    if (error) throw new Error(`Error desmarcando el default anterior: ${error.message}`);
  }
  if (input.id) {
    const { error } = await db.from('identidades_fiscales').update(row).eq('id', input.id);
    if (error) throw new Error(`Error actualizando la identidad fiscal: ${error.message}`);
  } else {
    const { error } = await db.from('identidades_fiscales').insert([row]);
    if (error) throw new Error(`Error creando la identidad fiscal: ${error.message}`);
  }
  revalidatePath('/configuraciones');
}

/** Borra una identidad fiscal. Los leads que la referenciaban muestran "—". */
export async function deleteIdentidadFiscalAction(id: number): Promise<void> {
  const { error } = await (await getTenantDb()).from('identidades_fiscales').delete().eq('id', id);
  if (error) throw new Error(`Error borrando la identidad fiscal: ${error.message}`);
  revalidatePath('/configuraciones');
}

// ─────────────────────────────────────────────────────────────────────────────
// Secciones del deal en el lead (update parcial)
// ─────────────────────────────────────────────────────────────────────────────

export type DealSectionsInput = {
  deal_fiscal?: Lead['deal_fiscal'];
  deal_servicio?: Lead['deal_servicio'];
  deal_promesa?: Lead['deal_promesa'];
  deal_obligaciones?: Lead['deal_obligaciones'];
  facturado_por_id?: number | null;
  // Cierre (vive dentro de Pagos): monto, fecha de cierre, inicio de servicio.
  monto_cierre_usd?: number | null;
  fecha_cierre?: string | null;
  fecha_inicio_servicio?: string | null;
};

/**
 * Guarda las secciones del deal que vengan en el patch (las ausentes no se
 * tocan). Deja el evento en lead_audit y revalida las vistas del lead.
 */
export async function saveDealSectionsAction(leadId: number, patch: DealSectionsInput): Promise<void> {
  const upd: Record<string, unknown> = {};
  const tocadas: string[] = [];
  if (patch.deal_fiscal !== undefined) { upd.deal_fiscal = patch.deal_fiscal; tocadas.push('datos fiscales'); }
  if (patch.deal_servicio !== undefined) { upd.deal_servicio = patch.deal_servicio; tocadas.push('servicio'); }
  if (patch.deal_promesa !== undefined) { upd.deal_promesa = patch.deal_promesa; tocadas.push('promesa'); }
  if (patch.deal_obligaciones !== undefined) { upd.deal_obligaciones = patch.deal_obligaciones; tocadas.push('obligaciones'); }
  if (patch.facturado_por_id !== undefined) { upd.facturado_por_id = patch.facturado_por_id; tocadas.push('facturado por'); }
  if (patch.monto_cierre_usd !== undefined) { upd.monto_cierre_usd = patch.monto_cierre_usd; tocadas.push('monto de cierre'); }
  if (patch.fecha_cierre !== undefined) { upd.fecha_cierre = patch.fecha_cierre; tocadas.push('fecha de cierre'); }
  if (patch.fecha_inicio_servicio !== undefined) { upd.fecha_inicio_servicio = patch.fecha_inicio_servicio; tocadas.push('inicio de servicio'); }
  if (Object.keys(upd).length === 0) return;

  const { error } = await (await getTenantDb()).from('leads').update(upd).eq('id', leadId);
  if (error) throw new Error(`Error guardando el deal del lead ${leadId}: ${error.message}`);

  await logLeadEvent(leadId, 'Deal details', `Guardó: ${tocadas.join(', ')}`, await autorActual());
  bust(TAG.leads);
  revalidarLead(leadId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Cuotas explícitas + pagos
// ─────────────────────────────────────────────────────────────────────────────

export type CuotaInput = { monto: number; fecha: string | null; pagado?: boolean };

/**
 * Reemplaza las cuotas NO pagadas del lead por la lista nueva (cuotas
 * explícitas: cada una con su monto y su fecha). Las pagadas del array se
 * descartan acá porque saveLeadPlanManual las CONSERVA intactas en la base.
 */
export async function saveCuotasAction(leadId: number, cuotas: CuotaInput[]): Promise<void> {
  const nuevas = cuotas.filter((c) => !c.pagado && Number(c.monto) > 0);
  await saveLeadPlanManual(leadId, {
    total_usd: null,
    duracion_meses: null,
    fecha_cierre: null,
    fecha_inicio: null,
    cuotas: nuevas.map((c) => ({ monto_usd: Number(c.monto), fecha_esperada: c.fecha })),
  });
  await logLeadEvent(leadId, 'Plan de pagos', `Cuotas actualizadas desde Deal Details (${nuevas.length} sin pagar)`, await autorActual());
  bust(TAG.pagos, TAG.leads);
  revalidarLead(leadId);
  revalidatePath('/comercial');
  revalidatePath('/general');
}

export type PagoManualInput = {
  monto?: number | null;   // si difiere del de la cuota, se actualiza
  fecha: string;           // YYYY-MM-DD (obligatoria)
  hora?: string | null;    // HH:MM
};

/**
 * Marca una cuota como pagada con fecha + hora (y monto real si difiere).
 * Se usa tanto desde el registro manual como al confirmar lo extraído del
 * comprobante por IA. marcarPago sincroniza total_cobrado del lead.
 */
export async function marcarPagoManualAction(pagoId: number, leadId: number, datos: PagoManualInput): Promise<void> {
  if (!datos.fecha) throw new Error('La fecha del pago es obligatoria.');
  const db = await getTenantDb();

  // Hora (y monto si vino uno válido) primero; marcarPago sincroniza después.
  const upd: Record<string, unknown> = { pago_hora: datos.hora?.trim() || null };
  if (datos.monto != null && Number.isFinite(datos.monto) && datos.monto > 0) upd.monto_usd = datos.monto;
  const { error } = await db.from('pagos').update(upd).eq('id', pagoId);
  if (error) throw new Error(`Error actualizando el pago ${pagoId}: ${error.message}`);

  await marcarPago(pagoId, true, datos.fecha);

  const nota = `Cuota cobrada el ${fmtDDMMYYYY(datos.fecha)}${datos.hora ? ` · ${datos.hora}` : ''}`;
  await logLeadEvent(leadId, 'Pago registrado', nota, await autorActual());
  bust(TAG.pagos, TAG.leads);
  revalidarLead(leadId);
  revalidatePath('/comercial');
  revalidatePath('/general');
}
