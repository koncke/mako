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
// y en setSetting('landing_token'). NO es data tenant: es un índice global, por
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
  // Cal.com va bajo SU PROPIO servicio, no bajo 'calendly'. Son dos productos
  // distintos y sus identificadores pueden colisionar: un slug como 'cierre' o
  // 'llamada' es plausible en los dos, y compartir el espacio de nombres haría
  // que la reserva de un cliente se ruteara al workspace de otro.
  CALCOM_EVENT_TYPE_J1: 'calcom',
  CALCOM_EVENT_TYPE_J2: 'calcom',
  META_PAGE_ID: 'meta',
  // 'zernio' NO va acá a propósito: su única credencial es la API key (secreta —
  // un secreto jamás se espeja en claro a webhook_routing) y el identificador de
  // ruteo es el profileId, que ACUÑA EL SERVER. Lo reclama ensureProfile() en
  // lib/zernio.ts vía upsertRouting('zernio', profileId, ws) — el mismo camino
  // que landing_token en setSetting (identificador acuñado por el server).
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
/**
 * Resultado de reclamar un identificador.
 *  · 'ok'      → es tuyo (lo reclamaste ahora, o ya lo eras).
 *  · 'ocupado' → lo tiene OTRO workspace. NO se pisa.
 *  · 'error'   → no se pudo escribir (problema de base).
 */
export type ResultadoRouting = 'ok' | 'ocupado' | 'error';

/**
 * Reclama un identificador para un workspace. PRIMER RECLAMANTE GANA.
 *
 * Antes esto detectaba la colisión, escribía un console.warn… y pisaba igual. Era
 * un secuestro cross-tenant servido: los identificadores NO son secretos (el ID
 * de una página de Facebook es público, y lo mismo el event type de Calendly o el
 * mail del host de Fathom). Un admin de cliente pegaba el identificador de otro y
 * desde ese momento los webhooks le entregaban a SU CRM los leads, los chats y
 * las reuniones de la víctima — que además dejaba de recibirlos.
 *
 * Ahora falla cerrado: si el identificador ya es de otro workspace, no se toca.
 *
 * La atomicidad importa: leer-y-después-escribir tiene una ventana donde dos
 * workspaces leen "libre" y los dos escriben. Por eso va INSERT ... ON CONFLICT
 * DO NOTHING (ignoreDuplicates) y DESPUÉS se lee quién quedó dueño: gana el que
 * llegó primero, lo decide la base y no una carrera.
 */
export async function upsertRouting(servicio: string, id: string, ws: number): Promise<ResultadoRouting> {
  if (!id || !id.trim()) return 'ok';
  const ident = normalizar(id);
  try {
    const supabase = getSupabaseServer();
    // Inserta solo si está libre. Si ya existe (de quien sea), no toca nada.
    const { error } = await supabase
      .from('webhook_routing')
      .upsert(
        { servicio, identificador: ident, workspace_id: ws, created_at: new Date().toISOString() },
        { onConflict: 'servicio,identificador', ignoreDuplicates: true },
      );
    if (error) throw new Error(error.message);

    // ¿Quién quedó dueño? Es la única fuente de verdad después de la carrera.
    const { data } = await supabase
      .from('webhook_routing')
      .select('workspace_id')
      .eq('servicio', servicio)
      .eq('identificador', ident)
      .maybeSingle();
    // Number(): workspace_id es BIGINT. supabase-js hoy lo devuelve como número
    // (verificado), pero una comparación estricta contra un string haría que NADIE
    // pudiera reclamar un identificador nunca más, y en silencio. El modo de falla
    // no justifica confiar en el tipado del driver.
    const raw = (data as { workspace_id?: number | string } | null)?.workspace_id;
    const dueno = raw == null ? null : Number(raw);

    if (dueno === ws) return 'ok';
    console.warn(
      `[webhook-routing] ${servicio}/${ident} ya es del ws ${dueno}: el ws ${ws} NO lo reclama (primer reclamante gana).`,
    );
    return 'ocupado';
  } catch (e) {
    console.error('[webhook-routing] upsertRouting falló:', e);
    return 'error';
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
