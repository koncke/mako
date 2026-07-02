// =============================================================================
// meta-health-history — registro/lectura del historial de estados de Meta
// =============================================================================
// Server-only (escribe en Supabase). Se separa de lib/meta-health.ts porque ese
// módulo lo importan componentes cliente (colores/tipos) y no puede arrastrar el
// cliente de Supabase. Nunca rompe al caller: si la tabla no existe todavía
// (migración 0050 sin aplicar), loguea y no-opea.
// =============================================================================

import 'server-only';
import { getTenantDb } from './workspace';
import type { MetaAccountHealth } from './meta-health';

export type MetaEstadoHist = {
  id: number;
  severidad: string;
  statusLabel: string;
  disableReason: string | null;
  entregaFrenada: boolean;
  balanceMxn: number;
  detalle: string | null;
  createdAt: string;
};

// Registra el estado si es NEGATIVO (severidad != verde o entrega frenada) y
// cambió respecto del último registrado (para no repetir la misma fila).
export async function registrarEstadoMeta(h: MetaAccountHealth): Promise<void> {
  try {
    if (h.severidad === 'verde' && !h.entregaFrenada) return;
    const supabase = (await getTenantDb());
    const { data: last } = await supabase
      .from('meta_health_history')
      .select('severidad, status_label, entrega_frenada')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const l = last as { severidad?: string; status_label?: string; entrega_frenada?: boolean } | null;
    if (l && l.severidad === h.severidad && l.status_label === h.statusLabel && !!l.entrega_frenada === h.entregaFrenada) return;
    await supabase.from('meta_health_history').insert({
      severidad: h.severidad,
      status_label: h.statusLabel,
      disable_reason: h.disableReasonLabel ?? null,
      entrega_frenada: h.entregaFrenada,
      balance_mxn: h.balanceMxn,
      detalle: h.entregaFrenada ? 'Entrega frenada' : (h.disableReasonLabel ?? h.statusLabel),
    });
  } catch (err) {
    console.error(`[meta-history] registrar: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function getHistorialMeta(limit = 20): Promise<MetaEstadoHist[]> {
  try {
    const supabase = (await getTenantDb());
    const { data, error } = await supabase
      .from('meta_health_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      id: Number(r.id),
      severidad: String(r.severidad),
      statusLabel: String(r.status_label ?? ''),
      disableReason: (r.disable_reason as string) ?? null,
      entregaFrenada: !!r.entrega_frenada,
      balanceMxn: Number(r.balance_mxn ?? 0),
      detalle: (r.detalle as string) ?? null,
      createdAt: String(r.created_at),
    }));
  } catch (err) {
    console.error(`[meta-history] leer: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
}
