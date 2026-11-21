// =============================================================================
// RESET EN UN ESPACIO DE PRUEBA: los chats, como en una cuenta recién creada (21/11/2026)
// =============================================================================
// Lo llama /api/admin/reiniciar-onboarding DESPUÉS de «Reiniciar onboarding» y sólo en un negocio de prueba (el 3 y el 9). Qué se vacía y
// por qué: ./reset-chats-prueba-reglas.ts. Como lib/reset-workspace.ts: crudo (getSupabaseServer) y con el `.eq('workspace_id', ws)` a mano
// (getTenantDb miraría el workspace del PEDIDO, que no tiene por qué ser el destino), y tira fuera de un negocio de prueba.
// =============================================================================
import 'server-only';
import { getSupabaseServer } from './supabase';
import { SETTINGS_DE_LOS_COACHES, TABLAS_DE_LOS_CHATS, seVacianLosChats } from './reset-chats-prueba-reglas';

export type ChatsVaciados = { borrado: Record<string, number>; avisos: string[] };

export async function vaciarChatsDePrueba(ws: number): Promise<ChatsVaciados> {
  // La lista CERRADA (3 y 4): nunca el 9 (el espacio de Martín) ni el 11 (Leila). El cinturón que vale.
  if (!seVacianLosChats(ws)) throw new Error('Vaciar los chats sólo corre en el Cliente de Prueba (3) o el de Diseño (4).');
  const db = getSupabaseServer();
  const borrado: Record<string, number> = {};
  const avisos: string[] = [];
  for (const t of TABLAS_DE_LOS_CHATS) {
    const { error, count } = await db.from(t).delete({ count: 'exact' }).eq('workspace_id', ws);
    if (error) avisos.push(`${t}: ${error.message}`);
    else borrado[t] = count ?? 0;
  }
  const s = await db.from('app_settings').delete({ count: 'exact' }).eq('workspace_id', ws).in('key', [...SETTINGS_DE_LOS_COACHES]);
  if (s.error) avisos.push(`app_settings (coaches): ${s.error.message}`);
  else borrado.coaches = s.count ?? 0;
  return { borrado, avisos };
}
