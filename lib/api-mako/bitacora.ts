// =============================================================================
// api-mako/bitacora — una fila por llamada HTTP, para contestar «¿me filtraron el token?»
// =============================================================================
// Con cientos de operaciones y acciones detrás de un bearer que vive en la máquina
// de un tercero, no saber qué pidió un token —y desde dónde— es no poder responder
// la única pregunta que importa el día que algo raro aparece en el CRM.
//
// Va a `api_llamadas` (mig 0158, en TENANT_TABLES): el cliente puede ver las suyas.
// BEST-EFFORT: nunca bloquea ni retrasa la respuesta, y si la escritura falla se
// registra por consola y se sigue. La IP se guarda recortada (los dos últimos
// octetos en cero): alcanza para ver «vino de otro lado» sin guardar un dato que
// identifica a una persona.
// =============================================================================

import 'server-only';
import { getSupabaseServer } from '@/lib/supabase';
import { clientIp } from '@/lib/rate-limit';
import type { Canal } from './tipos';

export function ipRecortada(ip: string): string {
  const v4 = /^(\d+)\.(\d+)\.\d+\.\d+$/.exec(ip);
  if (v4) return `${v4[1]}.${v4[2]}.0.0`;
  if (ip.includes(':')) return `${ip.split(':').slice(0, 3).join(':')}::`;
  return 'desconocida';
}

export function registrarLlamada(x: { ws: number; operacion: string; canal: Canal; ok: boolean; status: number; ms: number; req: Request }): void {
  // Se escribe con el cliente de servicio y `workspace_id` explícito: acá no hay
  // sesión que resuelva el workspace, lo resolvió el token.
  void getSupabaseServer()
    .from('api_llamadas')
    .insert({ workspace_id: x.ws, operacion: x.operacion, canal: x.canal, ok: x.ok, status: x.status, ms: x.ms, ip: ipRecortada(clientIp(x.req)) })
    .then(({ error }) => { if (error) console.error('[api-mako] bitácora:', error.message); });
}
