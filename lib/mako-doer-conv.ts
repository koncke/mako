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

// Cuánto para atrás mira MaKo. Sin corte, un "sí, dale" se pegaba a la última cosa
// que hubiera en la tabla AUNQUE FUERA DE HACE CUATRO DÍAS: pasó de verdad — Martín
// contestó "sí cargalo" a una pregunta de esa tarde y MaKo confirmó una charla del 26
// de julio, duplicando dos tareas que ya estaban en el board. Una conversación de
// WhatsApp de hace dos días no es contexto: es ruido.
// Bajado de 48 a 14 el 12/8. El propio comentario de arriba ya decía que una
// charla de hace dos días es ruido, y la ventana seguía en dos días: MaKo
// contestó un pedido nuevo con material de 33 h antes (ver lib/mako-intencion.ts).
// 14 h cubre lo que importa —la charla de hoy, y la de anoche a la mañana
// siguiente— sin arrastrar anteayer. La marca de CONTEXTO en mako-doer-in.ts es
// la otra mitad: acota QUÉ ES el historial; esto acota CUÁNTO.
const HORAS_CONTEXTO = 14;

/** Historial reciente de un grupo (los últimos `limite` turnos, en orden cronológico). */
export async function historialGrupo(ws: number, grupoJid: string, limite = 24): Promise<TurnoConv[]> {
  return runWithWorkspace(ws, async () => {
    const db = await getTenantDb();
    const desde = new Date(Date.now() - HORAS_CONTEXTO * 3600_000).toISOString();
    const { data } = await db.from('mako_doer_conv')
      .select('role, content, created_at')
      .eq('grupo_jid', grupoJid)
      .gte('created_at', desde)
      .order('created_at', { ascending: false })
      .limit(limite);
    const rows = ((data ?? []) as Array<{ role: string; content: string }>).reverse();
    return rows.map((r) => ({ role: r.role === 'assistant' ? 'assistant' : 'user', content: r.content } as TurnoConv));
  });
}
