// =============================================================================
// mako_confirmaciones — cambios automáticos de MaKo pendientes de confirmar
// =============================================================================
// El CRM automático aplica un cambio y, en los "fuertes", deja una fila acá. El
// modal bloqueante (MakoConfirmGate) las lista y el humano:
//   · Confirmar  → deja el cambio de MaKo.
//   · Rechazar   → revierte (aplica el patch `revert` a la fila del lead).
//   · Opción     → aplica una alternativa (mueve a opcion.stage por setPipelineStage).
// =============================================================================

import 'server-only';

import { getTenantDb } from './workspace';
import { setPipelineStage, logLeadEvent } from './leads';

export type CambioCampo = { campo: string; antes: string | null; despues: string | null };
export type ConfOpcion = { key: string; label: string; stage?: string | null; motivo?: string | null; tone?: 'primary' | 'danger' | 'neutral' };

export type MakoConfirmacion = {
  id: number;
  lead_id: number;
  lead_nombre: string | null;
  regla: string;
  tipo: string;
  clave: string;
  titulo: string;
  detalle: string | null;
  aplicado: boolean;
  cambios: CambioCampo[];
  revert: Record<string, unknown> | null;
  opciones: ConfOpcion[] | null;
  estado: 'pendiente' | 'confirmado' | 'rechazado';
  created_at: string;
};

export type CrearConfirmacionInput = {
  leadId: number;
  leadNombre?: string | null;
  regla: string;
  tipo: string;
  clave: string;
  titulo: string;
  detalle?: string | null;
  aplicado: boolean;
  cambios?: CambioCampo[];
  revert?: Record<string, unknown> | null;
  opciones?: ConfOpcion[] | null;
};

const COLS = 'id, lead_id, lead_nombre, regla, tipo, clave, titulo, detalle, aplicado, cambios, revert, opciones, estado, created_at';

/**
 * ¿Ya hay una confirmación (en CUALQUIER estado) para este lead + clave? Anti-loop:
 * evita re-proponer/re-aplicar algo que ya está pendiente o que el humano resolvió
 * (ej. rechazó un No Show y la reunión sigue en el pasado → no volver a marcarla).
 */
export async function existeConfirmacion(leadId: number, clave: string): Promise<boolean> {
  const supabase = await getTenantDb();
  const { data } = await supabase
    .from('mako_confirmaciones')
    .select('id')
    .eq('lead_id', leadId)
    .eq('clave', clave)
    .limit(1);
  return !!(data && data.length);
}

/** Crea una confirmación pendiente. No duplica: si ya hay una del mismo lead+clave, no hace nada. */
export async function crearConfirmacion(input: CrearConfirmacionInput): Promise<boolean> {
  const supabase = await getTenantDb();
  const { data: ya } = await supabase
    .from('mako_confirmaciones')
    .select('id')
    .eq('lead_id', input.leadId)
    .eq('clave', input.clave)
    .eq('estado', 'pendiente')
    .limit(1);
  if (ya && ya.length) return false;

  const { error } = await supabase.from('mako_confirmaciones').insert({
    lead_id: input.leadId,
    lead_nombre: input.leadNombre ?? null,
    regla: input.regla,
    tipo: input.tipo,
    clave: input.clave,
    titulo: input.titulo,
    detalle: input.detalle ?? null,
    aplicado: input.aplicado,
    cambios: input.cambios ?? [],
    revert: input.revert ?? null,
    opciones: input.opciones ?? null,
    estado: 'pendiente',
  });
  if (error) {
    // Violación del índice único (carrera con otra corrida) = ya existe: no es fatal.
    console.error(`[mako-conf] crear falló: ${error.message}`);
    return false;
  }
  return true;
}

/** Confirmaciones pendientes del workspace actual (más viejas primero). */
export async function listPendientes(): Promise<MakoConfirmacion[]> {
  const supabase = await getTenantDb();
  const { data, error } = await supabase
    .from('mako_confirmaciones')
    .select(COLS)
    .eq('estado', 'pendiente')
    .order('created_at', { ascending: true })
    .limit(100);
  if (error) return [];
  return (data ?? []) as MakoConfirmacion[];
}

/** Cantidad de confirmaciones pendientes del workspace actual. */
export async function contarPendientes(): Promise<number> {
  try {
    const supabase = await getTenantDb();
    const { count } = await supabase
      .from('mako_confirmaciones')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'pendiente');
    return count ?? 0;
  } catch {
    return 0;
  }
}

// estado_lead → cerro (misma tabla que updateLead). Al revertir con .update()
// directo bypassamos updateLead, así que derivamos cerro acá para no romper la
// invariante estado_lead ↔ cerro que leen las queries de Revenue/embudo.
const CERRO_POR_ESTADO: Record<string, boolean | null> = {
  ganado: true, perdido: false, descalificado: false, no_responde: false, abierto: null,
};

/**
 * Resuelve una confirmación:
 *  - 'confirmar' → deja el cambio de MaKo como está.
 *  - 'rechazar'  → revierte (aplica el patch `revert` a la fila del lead).
 *  - 'op:<key>'  → aplica la opción (mueve a opcion.stage por setPipelineStage).
 */
export async function resolverConfirmacion(id: number, decision: string, autor: string): Promise<void> {
  const supabase = await getTenantDb();
  const { data, error } = await supabase.from('mako_confirmaciones').select(COLS).eq('id', id).maybeSingle();
  if (error || !data) throw new Error('Confirmación no encontrada');
  const c = data as MakoConfirmacion;
  if (c.estado !== 'pendiente') return;

  let nuevoEstado: 'confirmado' | 'rechazado' = 'confirmado';
  let nota: string;

  if (decision === 'rechazar') {
    nuevoEstado = 'rechazado';
    if (c.aplicado && c.revert && Object.keys(c.revert).length) {
      const patch: Record<string, unknown> = { ...c.revert };
      // Sentinela: quitar SOLO el link que agregó MaKo (no pisar los que sumaron
      // otros flujos entre el apply y el rechazo).
      const removeUrl = typeof patch.fathom_remove_url === 'string' ? patch.fathom_remove_url : null;
      delete patch.fathom_remove_url;
      // Mantener la invariante estado_lead ↔ cerro.
      if (typeof patch.estado_lead === 'string') patch.cerro = CERRO_POR_ESTADO[patch.estado_lead] ?? null;
      if (Object.keys(patch).length) {
        const { error: e2 } = await supabase.from('leads').update(patch).eq('id', c.lead_id);
        if (e2) throw new Error(`No se pudo revertir: ${e2.message}`);
      }
      if (removeUrl) {
        const { data: row } = await supabase.from('leads').select('fathom_links').eq('id', c.lead_id).maybeSingle();
        const rawLinks = row?.fathom_links;
        const links = Array.isArray(rawLinks) ? (rawLinks as Array<{ url?: string }>) : [];
        const filtrados = links.filter((l) => l?.url !== removeUrl);
        if (filtrados.length !== links.length) await supabase.from('leads').update({ fathom_links: filtrados }).eq('id', c.lead_id);
      }
    }
    nota = `MaKo (${c.regla}): rechazado por ${autor}`;
  } else if (decision.startsWith('op:')) {
    const key = decision.slice(3);
    const op = (c.opciones ?? []).find((o) => o.key === key);
    if (!op) throw new Error('Opción inválida');
    if (op.stage) await setPipelineStage(c.lead_id, op.stage, { motivo: op.motivo ?? null });
    nota = `MaKo (${c.regla}): "${op.label}" por ${autor}`;
  } else {
    nota = `MaKo (${c.regla}): confirmado por ${autor}`;
  }

  const { error: e3 } = await supabase
    .from('mako_confirmaciones')
    .update({ estado: nuevoEstado, resolved_at: new Date().toISOString(), resolved_by: autor })
    .eq('id', id);
  if (e3) throw new Error(`No se pudo cerrar la confirmación: ${e3.message}`);
  try { await logLeadEvent(c.lead_id, 'CRM automático', nota, 'MaKo'); } catch { /* no fatal */ }
}
