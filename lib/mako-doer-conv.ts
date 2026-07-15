// =============================================================================
// mako-doer-conv — memoria de conversación del doer por grupo (mig 0086)
// =============================================================================
// Guarda cada turno (dueño y MaKo) por grupo y devuelve el historial reciente para
// re-inyectarlo como contexto en cada respuesta. Sin esto, MaKo arranca de cero en
// cada mensaje (era la queja: "no guarda los mensajes anteriores"). Tenant-scoped.

import 'server-only';
import { getTenantDb, runWithWorkspace } from '@/lib/workspace';

export type TurnoConv = { role: 'user' | 'assistant'; content: string };

/** Guarda un turno de la conversación de un grupo. */
export async function guardarTurno(ws: number, grupoJid: string, role: 'user' | 'assistant', content: string, waMessageId?: string): Promise<void> {
  if (!content.trim()) return;
  await runWithWorkspace(ws, async () => {
    const db = await getTenantDb();
    const { error } = await db.from('mako_doer_conv').insert({ grupo_jid: grupoJid, role, content, wa_message_id: waMessageId ?? null });
    if (error) console.error('[mako-doer-conv] guardar:', error.message);
  });
}

/** Historial reciente de un grupo (los últimos `limite` turnos, en orden cronológico). */
export async function historialGrupo(ws: number, grupoJid: string, limite = 24): Promise<TurnoConv[]> {
  return runWithWorkspace(ws, async () => {
    const db = await getTenantDb();
    const { data } = await db.from('mako_doer_conv')
      .select('role, content, created_at')
      .eq('grupo_jid', grupoJid)
      .order('created_at', { ascending: false })
      .limit(limite);
    const rows = ((data ?? []) as Array<{ role: string; content: string }>).reverse();
    return rows.map((r) => ({ role: r.role === 'assistant' ? 'assistant' : 'user', content: r.content } as TurnoConv));
  });
}
