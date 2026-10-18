// =============================================================================
// Las sesiones del agente de los clientes (en qué trabajan en SU Claude Code) — la lectura, en UN lugar
// =============================================================================
// La leen /admin/agente (la computadora) y /m/agente (el teléfono, 17/10/2026). Vivía adentro de la página de
// escritorio; con dos pantallas, dos copias de una lectura que CRUZA el aislamiento por workspace es justo lo que no
// puede divergir.
//
// ⚠️ CRUZA EL AISLAMIENTO POR WORKSPACE, Y ES EL ÚNICO LUGAR DEL SISTEMA DONDE ESO PASA: lee con el cliente de SERVICIO,
// sin scope, porque el punto es ver a todos los clientes juntos. Quien la llama pregunta antes `getSesionAdmin()`.
// =============================================================================

import 'server-only';
import { getSupabaseServer } from './supabase';

export type SesionAgente = {
  id: number;
  workspace_id: number;
  sesion_id: string;
  empezo_en: string | null;
  termino_en: string | null;
  acta: { titulo?: string; resumen?: string; turnos?: number; herramientas?: number } | null;
  turnos: Array<{ ts: string; texto: string }> | null;
  redacciones: number;
  created_at: string;
};

/** Las últimas sesiones (de todos los clientes) y el nombre de cada workspace. */
export async function leerSesionesAgente(limite = 200): Promise<{ sesiones: SesionAgente[]; nombreWs: Map<number, string> }> {
  const svc = getSupabaseServer();
  const [{ data: filas }, { data: wss }] = await Promise.all([
    svc.from('agente_sesiones').select('*').order('created_at', { ascending: false }).limit(limite),
    svc.from('workspaces').select('id, nombre'),
  ]);
  const sesiones: SesionAgente[] = filas ?? [];
  const nombreWs = new Map(((wss ?? []) as Array<{ id: number; nombre: string }>).map((w) => [w.id, w.nombre]));
  return { sesiones, nombreWs };
}
