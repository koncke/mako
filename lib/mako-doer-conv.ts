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

export type FilaConv = { role: 'user' | 'assistant'; content: string; created_at: string };

/**
 * El hilo de un grupo para LEERLO en pantalla (el Second Brain, tanda 8 de docs/diseno-mako-ai-native.md, 16/10/2026),
 * por páginas: los `limite` anteriores a `antes`, en orden cronológico, y si hay más atrás.
 * ⚠️ NO ES `historialGrupo`: ése es el CONTEXTO del modelo (14 h, 24 turnos) y no mira el error. Éste es estricto: si la
 *    base no contesta, tira, porque una lista vacía en pantalla diría «no hay mensajes».
 */
export async function hiloDelGrupo(
  ws: number, grupoJid: string, { antes = null, limite = 60 }: { antes?: string | null; limite?: number } = {},
): Promise<{ filas: FilaConv[]; hayMas: boolean }> {
  return runWithWorkspace(ws, async () => {
    const db = await getTenantDb();
    let q = db.from('mako_doer_conv').select('role, content, created_at').eq('grupo_jid', grupoJid);
    if (antes) q = q.lt('created_at', antes);
    const { data, error } = await q.order('created_at', { ascending: false }).limit(limite + 1);
    if (error) throw new Error(`hiloDelGrupo falló: ${error.message}`);
    const rows = (data ?? []) as Array<{ role: string; content: string; created_at: string }>;
    return {
      filas: rows.slice(0, limite).reverse().map((r) => ({ role: r.role === 'assistant' ? 'assistant' : 'user', content: r.content, created_at: r.created_at })),
      hayMas: rows.length > limite,
    };
  });
}
