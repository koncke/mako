// =============================================================================
// webhook-routing — índice reverse-map identificador entrante → workspace
// =============================================================================
// Los webhooks entrantes (Meta / Chatwoot / Calendly / Fathom) llegan SIN
// sesión: la única forma de saber de qué workspace es cada evento es mirar un
// identificador en claro que trae el payload (page_id, account_id, URI del
// event type, email que grabó). Esta tabla (webhook_routing, mig 0090) es ese
// índice de plataforma: (servicio, identificador) → workspace_id. Es el mismo
// patrón que evolution_instancias (instancia → workspace) para su webhook.
//
// Se puebla en el choke point de guardado de credenciales (lib/credenciales.ts)
// y en setSetting('meta_page_id'). NO es data tenant: es un índice global, por
// eso usa getSupabaseServer() crudo (cross-workspace) — RLS on, solo
// server-side. Todo best-effort: si la base falla no rompemos el guardado; la
// lectura devuelve null y el webhook decide (fail-closed, no asume el dueño).

import 'server-only';
import { getSupabaseServer } from './supabase';
import { OWNER_WS } from './auth-session';

/** Normaliza un identificador entrante: trim; lowercase SOLO para emails. */
export function normalizar(id: string): string {
  const t = id.trim();
  return t.includes('@') ? t.toLowerCase() : t;
}

/**
 * Mapa clave-de-credencial → servicio de routing. Las claves que aparecen acá
 * se espejan a webhook_routing al guardarse/borrarse una credencial
 * (lib/credenciales.ts).
 */
export const ROUTING_CREDS: Record<string, string> = {
  CHATWOOT_ACCOUNT_ID: 'chatwoot',
  FATHOM_HOST_EMAIL: 'fathom',
  CALENDLY_EVENT_TYPE_J1: 'calendly',
  CALENDLY_EVENT_TYPE_J2: 'calendly',
  META_PAGE_ID: 'meta',
};

/**
 * Workspace dueño de un identificador entrante, o null si no está mapeado o el
 * id viene vacío. Cross-workspace a propósito (índice de plataforma).
 */
export async function wsPorIdentificador(
  servicio: string,
  id: string | null | undefined,
): Promise<number | null> {
  if (!id || !id.trim()) return null;
  try {
    const { data } = await getSupabaseServer()
      .from('webhook_routing')
      .select('workspace_id')
      .eq('servicio', servicio)
      .eq('identificador', normalizar(id))
      .maybeSingle();
    return (data as { workspace_id?: number } | null)?.workspace_id ?? null;
  } catch (e) {
    console.error('[webhook-routing] wsPorIdentificador falló:', e);
    return null;
  }
}

/**
 * Mapea (servicio, identificador) → ws (upsert). Best-effort (no lanza). Si el
 * identificador ya estaba mapeado a OTRO ws, loguea un warning antes de pisar.
 */
export async function upsertRouting(servicio: string, id: string, ws: number): Promise<void> {
  if (!id || !id.trim()) return;
  const ident = normalizar(id);
  try {
    const supabase = getSupabaseServer();
    // Leer antes para detectar reasignación (mismo identificador, otro ws).
    const { data: previo } = await supabase
      .from('webhook_routing')
      .select('workspace_id')
      .eq('servicio', servicio)
      .eq('identificador', ident)
      .maybeSingle();
    const wsPrevio = (previo as { workspace_id?: number } | null)?.workspace_id ?? null;
    if (wsPrevio != null && wsPrevio !== ws) {
      console.warn(
        `[webhook-routing] colisión: ${servicio}/${ident} reasignado de ws ${wsPrevio} a ws ${ws}`,
      );
    }
    await supabase
      .from('webhook_routing')
      .upsert(
        { servicio, identificador: ident, workspace_id: ws, created_at: new Date().toISOString() },
        { onConflict: 'servicio,identificador' },
      );
  } catch (e) {
    console.error('[webhook-routing] upsertRouting falló:', e);
  }
}

/**
 * Borra todas las filas de un servicio para un workspace (al quitar su
 * credencial de routing, se van sus mapeos de ese servicio). Best-effort.
 */
export async function borrarRoutingDeWs(servicio: string, ws: number): Promise<void> {
  try {
    await getSupabaseServer()
      .from('webhook_routing')
      .delete()
      .eq('servicio', servicio)
      .eq('workspace_id', ws);
  } catch (e) {
    console.error('[webhook-routing] borrarRoutingDeWs falló:', e);
  }
}

/**
 * Siembra el routing del DUEÑO (OWNER_WS) desde el env, en cada boot. Las
 * credenciales del dueño viven en el env de Vercel (nunca pasan por
 * guardarCredencial → no auto-espejan), así que sin esto sus webhooks quedarían
 * sin fila y se ignorarían (fail-closed). Idempotente y best-effort; corre en
 * hidratarCredenciales (instrumentation.ts).
 */
export async function seedRoutingDelDueno(): Promise<void> {
  const real = (v: string | undefined): v is string => Boolean(v && v.trim() && !v.trim().startsWith('PENDING'));
  const pares: Array<[string, string | undefined]> = [
    ['meta', process.env.META_PAGE_ID],
    ['chatwoot', process.env.CHATWOOT_ACCOUNT_ID],
    ['calendly', process.env.CALENDLY_EVENT_TYPE_J1],
    ['calendly', process.env.CALENDLY_EVENT_TYPE_J2],
    ['fathom', process.env.FATHOM_HOST_EMAIL],
  ];
  for (const [servicio, val] of pares) {
    if (real(val)) await upsertRouting(servicio, val, OWNER_WS);
  }
}
