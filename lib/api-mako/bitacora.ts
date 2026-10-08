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

export function registrarLlamada(x: { ws: number; operacion: string; canal: Canal; ok: boolean; status: number; ms: number; req: Request; token?: string }): void {
  // Se escribe con el cliente de servicio y `workspace_id` explícito: acá no hay
  // sesión que resuelva el workspace, lo resolvió el token.
  const fila = { workspace_id: x.ws, operacion: x.operacion, canal: x.canal, ok: x.ok, status: x.status, ms: x.ms, ip: ipRecortada(clientIp(x.req)) };
  // QUÉ TOKEN pidió (mig 0222, 08/10/2026: con tokens detallados que ESCRIBEN, «¿quién hizo
  // esto?» es la pregunta). Si la columna todavía no existe —la migración se aplica aparte—,
  // se reintenta sin ella: la bitácora no puede perder filas por un orden de despliegue.
  const insertar = (f: Record<string, unknown>) => getSupabaseServer().from('api_llamadas').insert(f);
  void insertar(x.token ? { ...fila, token_id: x.token } : fila)
    .then(({ error }) => {
      if (!error) return;
      if (x.token && /token_id/.test(error.message)) {
        return insertar(fila).then(({ error: e2 }) => { if (e2) console.error('[api-mako] bitácora:', e2.message); });
      }
      console.error('[api-mako] bitácora:', error.message);
    });

  // RETENCIÓN. Con el tope de 120 pedidos por minuto son hasta ~170 mil filas por día
  // por workspace, y nada las borraba. Una de cada cien escrituras purga lo de ese
  // workspace más viejo que RETENCION_DIAS: sin cron nuevo, y el costo cae sobre quien
  // más escribe, que es quien más acumula.
  if (Math.random() < 0.01) {
    const corte = new Date(Date.now() - RETENCION_DIAS * 86_400_000).toISOString();
    void getSupabaseServer().from('api_llamadas').delete()
      .eq('workspace_id', x.ws).lt('created_at', corte)
      .then(({ error }) => { if (error) console.error('[api-mako] purga de bitácora:', error.message); });
  }
}

/** Cuánto vive una fila de la bitácora. Un trimestre alcanza para contestar «¿me
 *  filtraron el token?» sobre cualquier cosa que alguien note en el CRM. */
export const RETENCION_DIAS = 90;
