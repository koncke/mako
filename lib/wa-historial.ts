// =============================================================================
// wa-historial — la charla reciente con un lead por el WhatsApp no oficial
// =============================================================================
// UN lector para los dos que escriben mirando la charla: el paso en modo IA
// (lib/paso-ia.ts) y el setter del modo asistido (lib/nutricion.ts → asistirRespuesta).
// Eran dos `select` iguales escritos por separado, y la regla de la casa es que el
// segundo se queda viejo: el día que uno filtre por línea y el otro no, MaKo escribe
// mirando otra conversación.

import 'server-only';
import { getTenantDb } from './workspace';
import type { FilaMensaje } from './setter-conversacion';

/**
 * Los últimos `limite` mensajes con este lead, de la más vieja a la más nueva.
 *
 * `linea`: sólo los de esa línea (evolution_instancias.instance_name). Un negocio puede
 * tener varios números, y el setter le contesta por el que la persona escribió: la charla
 * que tiene que leer es la de ESE número.
 *
 * Devuelve `null` si la lectura falla, distinto de `[]` (no hay charla): el que llama
 * decide qué hacer sin poder leer, y no lo confunde con «nunca hablaron».
 */
export async function mensajesRecientesDelLead(
  leadId: number,
  opts: { limite: number; linea?: string | null },
): Promise<FilaMensaje[] | null> {
  try {
    const db = await getTenantDb();
    let q = db.from('wa_mensajes')
      .select('from_me, texto, tipo, wa_timestamp')
      .eq('lead_id', leadId)
      .neq('tipo', 'evento');
    if (opts.linea) q = q.eq('instance_name', opts.linea);
    const { data, error } = await q.order('wa_timestamp', { ascending: false }).limit(opts.limite);
    if (error) return null;
    return ((data ?? []) as FilaMensaje[]).reverse();
  } catch {
    return null;
  }
}
