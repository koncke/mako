// =============================================================================
// mako-pendientes — confirmaciones seguras del doer de MaKo (punto 10)
// =============================================================================
// Cuando MaKo va a EJECUTAR algo, primero crea una "acción pendiente" con un
// vencimiento y le pide el OK al dueño. El "sí" se matchea con la pendiente MÁS
// RECIENTE vigente del grupo; si hay varias, MaKo re-pregunta (lo decide la capa
// conversacional). Las vencidas se invalidan solas. Así un "sí" nunca dispara
// algo viejo. Scopeado por workspace (tabla en TENANT_TABLES, mig 0085).

import 'server-only';
import { getTenantDb, runWithWorkspace } from './workspace';

export type EstadoPendiente = 'pendiente' | 'confirmada' | 'ejecutada' | 'cancelada' | 'vencida' | 'error';
export type Pendiente = {
  id: number; grupoJid: string; tipo: string; payload: Record<string, unknown>;
  resumen: string; estado: EstadoPendiente; venceAt: string; origen: string | null; createdAt: string;
};

type Row = {
  id: number; grupo_jid: string; tipo: string; payload: unknown; resumen: string;
  estado: string; vence_at: string; origen: string | null; created_at: string;
};
const toP = (r: Row): Pendiente => ({
  id: r.id, grupoJid: r.grupo_jid, tipo: r.tipo,
  payload: (r.payload && typeof r.payload === 'object' ? r.payload : {}) as Record<string, unknown>,
  resumen: r.resumen, estado: r.estado as EstadoPendiente, venceAt: r.vence_at, origen: r.origen, createdAt: r.created_at,
});

/** Crea una acción pendiente de confirmación (ttl por default 2h). Devuelve el id. */
export async function crearPendiente(
  ws: number,
  data: { grupoJid: string; tipo: string; payload?: Record<string, unknown>; resumen: string; origen?: string; ttlMin?: number },
): Promise<number | null> {
  return runWithWorkspace(ws, async () => {
    const db = await getTenantDb();
    const venceAt = new Date(Date.now() + (data.ttlMin ?? 120) * 60_000).toISOString();
    const { data: row, error } = await db.from('mako_acciones_pendientes')
      .insert({ grupo_jid: data.grupoJid, tipo: data.tipo, payload: data.payload ?? {}, resumen: data.resumen, origen: data.origen ?? null, vence_at: venceAt })
      .select('id').single();
    if (error) { console.error('[pendientes] crear:', error.message); return null; }
    return (row as { id: number }).id;
  });
}

/** Marca como 'vencida' toda pendiente cuyo vence_at ya pasó (limpieza previa a leer). */
async function vencerExpiradas(ws: number): Promise<void> {
  await runWithWorkspace(ws, async () => {
    const db = await getTenantDb();
    await db.from('mako_acciones_pendientes')
      .update({ estado: 'vencida', resuelto_at: new Date().toISOString() })
      .eq('estado', 'pendiente').lt('vence_at', new Date().toISOString());
  });
}

/** Pendientes VIGENTES (no vencidas, sin resolver) de un grupo, la más reciente primero. */
export async function pendientesVigentes(ws: number, grupoJid: string): Promise<Pendiente[]> {
  await vencerExpiradas(ws);
  return runWithWorkspace(ws, async () => {
    const db = await getTenantDb();
    const { data } = await db.from('mako_acciones_pendientes')
      .select('id, grupo_jid, tipo, payload, resumen, estado, vence_at, origen, created_at')
      .eq('grupo_jid', grupoJid).eq('estado', 'pendiente')
      .order('created_at', { ascending: false });
    return ((data ?? []) as Row[]).map(toP);
  });
}

export async function getPendiente(ws: number, id: number): Promise<Pendiente | null> {
  return runWithWorkspace(ws, async () => {
    const db = await getTenantDb();
    const { data } = await db.from('mako_acciones_pendientes')
      .select('id, grupo_jid, tipo, payload, resumen, estado, vence_at, origen, created_at').eq('id', id).maybeSingle();
    return data ? toP(data as Row) : null;
  });
}

/** Cierra una pendiente con un estado final + resultado. */
export async function resolverPendiente(ws: number, id: number, estado: EstadoPendiente, resultado?: string): Promise<void> {
  await runWithWorkspace(ws, async () => {
    const db = await getTenantDb();
    await db.from('mako_acciones_pendientes')
      .update({ estado, resultado: resultado ?? null, resuelto_at: new Date().toISOString() }).eq('id', id);
  });
}
