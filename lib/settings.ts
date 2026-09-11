// =============================================================================
// app_settings — configuración editable desde la UI (Fase 14)
// =============================================================================
// Pares clave/valor. El parseo numérico es tolerante: si el valor no parsea,
// devuelve null y loguea — nunca rompe la página.
// =============================================================================

import 'server-only';
import { getSupabaseServer } from './supabase';
import { getWorkspaceActual } from './workspace';
import { OWNER_WS } from './auth-session';
import { upsertRouting } from './webhook-routing';

// app_settings es per-workspace (PK compuesta workspace_id+key). Scopeamos
// explícito: el default es el dueño (1) para crons/sistema, que leen la config
// de Mauricio como hasta ahora.
const wsActual = async () => (await getWorkspaceActual()) ?? OWNER_WS;

/** Valor crudo (string) de una setting, o null si no existe. */
export async function getSetting(key: string): Promise<string | null> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('workspace_id', await wsActual())
    .eq('key', key)
    .maybeSingle();
  if (error) {
    console.error(`[settings] error leyendo ${key}: ${error.message}`);
    return null;
  }
  return (data?.value as string | undefined) ?? null;
}

/**
 * Como `getSetting`, pero un error de lectura TIRA en vez de devolver null.
 *
 * ⚠️ `getSetting` convierte «no pude leer» en «no existe», y quien llama lo completa con un
 * default. Para la línea de WhatsApp de MaKo ese default es OTRA línea: con un 5xx de Supabase,
 * el canal pasaba a ser la instancia zombi y la voz la de un cliente, y de ahí salían una
 * rotación encima de la línea viva y alarmas falsas (revisión adversarial del 11/09/2026).
 * Donde el default decide algo destructivo, se lee con esto.
 */
export async function getSettingEstricto(key: string): Promise<string | null> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('workspace_id', await wsActual())
    .eq('key', key)
    .maybeSingle();
  if (error) throw new Error(`No pude leer el setting ${key}: ${error.message}`);
  return (data?.value as string | undefined) ?? null;
}

/**
 * Cambia una setting SOLO si todavía vale `esperado` (compare-and-set). Devuelve si ganó.
 * `esperado: null` = solo si la fila no existe.
 *
 * Es atómico en la base: de dos requests que compiten por el mismo cambio, gana UNA. Existe
 * porque dos clics a la vez en «Conectar por QR» abrían dos líneas de WhatsApp y el QR de una
 * quedaba huérfano (lib/mako-canal.ts, `rotarCanal`).
 */
export async function cambiarSettingSi(key: string, esperado: string | null, nuevo: string): Promise<boolean> {
  const supabase = getSupabaseServer();
  const ws = await wsActual();
  const ahora = new Date().toISOString();
  if (esperado === null) {
    const { data, error } = await supabase
      .from('app_settings')
      .upsert({ workspace_id: ws, key, value: nuevo, updated_at: ahora }, { onConflict: 'workspace_id,key', ignoreDuplicates: true })
      .select('key');
    if (error) throw new Error(`Error guardando setting ${key}: ${error.message}`);
    return (data?.length ?? 0) > 0;
  }
  const { data, error } = await supabase
    .from('app_settings')
    .update({ value: nuevo, updated_at: ahora })
    .eq('workspace_id', ws)
    .eq('key', key)
    .eq('value', esperado)
    .select('key');
  if (error) throw new Error(`Error guardando setting ${key}: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

/** Valor numérico tolerante: null si no existe o no parsea (sin romper). */
export async function getSettingNum(key: string): Promise<number | null> {
  const raw = await getSetting(key);
  if (raw === null) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    console.warn(`[settings] ${key}="${raw}" no es numérico — se ignora`);
    return null;
  }
  return n;
}

/** Guarda (upsert) una setting en el workspace actual. */
export async function setSetting(key: string, value: string): Promise<void> {
  const supabase = getSupabaseServer();
  const ws = await wsActual();
  const { error } = await supabase
    .from('app_settings')
    .upsert(
      { workspace_id: ws, key, value, updated_at: new Date().toISOString() },
      { onConflict: 'workspace_id,key' },
    );
  if (error) throw new Error(`Error guardando setting ${key}: ${error.message}`);
  // Espejo al índice de routing: identificadores en claro que vienen en payloads
  // SIN sesión y deciden a qué workspace pertenece el evento. Mismo ws que usó el
  // setting. Best-effort (si falla el espejo, no se pierde el setting).
  //   · landing_token → rutea el beacon de la landing (/api/track/vsl).
  //
  // OJO: acá NO va ningún identificador que el USUARIO pegue a mano. Este espejo
  // ignora el resultado de upsertRouting, así que un 'ocupado' (el identificador
  // ya es de otro workspace) se traga en silencio y queda un setting guardado que
  // no rutea a ningún lado. Esos van por guardarCredencial() (lib/credenciales.ts),
  // que falla cerrado con IdentificadorOcupadoError. Fue el caso de meta_page_id,
  // que ya vive como credencial META_PAGE_ID.
  // landing_token es seguro acá porque lo acuña el server (HMAC por workspace,
  // ver lib/landing-token.ts): nadie lo elige ni puede colisionar con el de otro.
  const ROUTING_SETTINGS: Record<string, string> = {
    landing_token: 'landing',
  };
  const servicio = ROUTING_SETTINGS[key];
  if (servicio && value && value.trim()) {
    await upsertRouting(servicio, value, ws);
  }
}
