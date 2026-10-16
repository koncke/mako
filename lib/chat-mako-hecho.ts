// =============================================================================
// «Lo que hizo»: las acciones que MaKo dejó en UNA conversación del Second Brain (tanda 7, 16/10/2026)
// =============================================================================
// Etapa 2 de docs/diseno-mako-ai-native.md. El riel del chat lista lo que MaKo propuso en ESA conversación y cómo
// quedó (esperando, hecha, cancelada, vencida, falló), como el registro de actividad de un issue de Linear. Lee
// `mako_acciones_pendientes` por la clave de canal del turno (`app:<id>`, lib/api-mako/canal.ts): la misma con la que
// el turno las crea (`grupoJid: ctx.canalKey`, lib/api-mako/acciones.ts).
//
// ⚠️ NO USA `pendientesVigentes`: ésa ESCRIBE antes de leer (`vencerExpiradas`) y trae sólo las vigentes. Esto es una
//    lectura: lo vencido se calcula en memoria, y no se toca la fila.
// ⚠️ ES ESTRICTA: si la base no contesta, tira. Un riel vacío diría «MaKo no hizo nada».
// ⚠️ SÓLO SE LLAMA CON LAS CLAVES DE CONVERSACIONES DE LA PERSONA (quien llama ya miró de quién es la sesión): el admin
//    no ve lo que hizo el chat de un closer, como no ve su chat.

import 'server-only';
import { getTenantDb, runWithWorkspace } from './workspace';
import { estadoDeLoHecho, type HechoChat } from './chat-mako-reglas';

/** Como mucho, lo que muestra el riel. */
const TOPE = 50;

export async function loQueHizo(ws: number, claves: readonly string[], ahora = Date.now()): Promise<HechoChat[]> {
  if (!claves.length) return [];
  return runWithWorkspace(ws, async () => {
    const db = await getTenantDb();
    const { data, error } = await db.from('mako_acciones_pendientes')
      .select('id, tipo, resumen, estado, vence_at, created_at, resuelto_at')
      .in('grupo_jid', [...claves])
      .order('created_at', { ascending: false })
      .limit(TOPE);
    if (error) throw new Error(`loQueHizo falló: ${error.message}`);
    return ((data ?? []) as Array<{ id: number; tipo: string; resumen: string; estado: string; vence_at: string; created_at: string; resuelto_at: string | null }>)
      .map((r) => ({
        id: r.id, tipo: r.tipo, resumen: r.resumen, at: r.created_at, resueltoAt: r.resuelto_at,
        estado: estadoDeLoHecho(r.estado, r.vence_at, ahora),
      }));
  });
}
