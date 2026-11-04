// =============================================================================
// app_settings — configuración editable desde la UI (Fase 14)
// =============================================================================
// Pares clave/valor. El parseo numérico es tolerante: si el valor no parsea,
// devuelve null y loguea — nunca rompe la página.
// =============================================================================

import 'server-only';
import { getSupabaseServer } from './supabase';
import { getWorkspaceActual, WS_NINGUNO, wsObligatorio } from './workspace';
import { upsertRouting } from './webhook-routing';
import { cabeEnLaUrl, despuesDe } from './settings-cas';

// app_settings es per-workspace (PK compuesta workspace_id+key). Scopeamos
// explícito. Un cron o un webhook SIN cookie sigue resolviendo al ws1 (lo decide el resolver,
// lib/workspace.ts); lo que cambió el 17/10/2026 es el null —una cookie que no resuelve contra la
// base, como la de un suspendido—: antes caía al ws1 (Mauricio, un cliente) por un `?? OWNER_WS`
// escrito acá. Ahora LEER no trae nada (WS_NINGUNO) y ESCRIBIR tira (wsObligatorio).
const wsActual = async () => (await getWorkspaceActual()) ?? WS_NINGUNO;

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
 *
 * Con un `esperado` largo (más de ~6 KB en la URL, lib/settings-cas.ts) no se compara el valor en el filtro: se lee la fila,
 * se compara acá y se escribe con la condición en `updated_at`. Sigue siendo atómico: toda escritura de app_settings marca
 * `updated_at`, así que si otro escribió entre la lectura y la escritura, ésta no encuentra la fila y pierde.
 */
export async function cambiarSettingSi(key: string, esperado: string | null, nuevo: string): Promise<boolean> {
  const supabase = getSupabaseServer();
  const ws = await wsObligatorio();
  if (!cabeEnLaUrl(esperado)) return cambiarSettingSiPorFecha(ws, key, esperado as string, nuevo);
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

/** El compare-and-set de un valor largo: compara en el server y filtra por `updated_at` (ver `cambiarSettingSi`). */
async function cambiarSettingSiPorFecha(ws: number, key: string, esperado: string, nuevo: string): Promise<boolean> {
  const supabase = getSupabaseServer();
  const { data: fila, error } = await supabase
    .from('app_settings').select('value, updated_at').eq('workspace_id', ws).eq('key', key).maybeSingle();
  if (error) throw new Error(`Error leyendo setting ${key}: ${error.message}`);
  const leida = fila as { value: unknown; updated_at: string | null } | null;
  if (!leida || leida.value !== esperado) return false;
  const base = supabase.from('app_settings').update({ value: nuevo, updated_at: despuesDe(leida.updated_at) })
    .eq('workspace_id', ws).eq('key', key);
  const { data, error: e2 } = await (leida.updated_at == null ? base.is('updated_at', null) : base.eq('updated_at', leida.updated_at))
    .select('key');
  if (e2) throw new Error(`Error guardando setting ${key}: ${e2.message}`);
  return (data?.length ?? 0) > 0;
}

/** Borra una setting del negocio en curso: lo que se va con otra cosa (la oferta de un competidor que se dejó de mirar). */
export async function borrarSetting(key: string): Promise<void> {
  const { error } = await getSupabaseServer().from('app_settings').delete().eq('workspace_id', await wsObligatorio()).eq('key', key);
  if (error) throw new Error(`Error borrando setting ${key}: ${error.message}`);
}

/**
 * Borra una setting SOLO si todavía vale `esperado` (el compare-and-set de `cambiarSettingSi`, para borrar).
 * Devuelve si borró.
 */
export async function borrarSettingSi(key: string, esperado: string): Promise<boolean> {
  const { data, error } = await getSupabaseServer()
    .from('app_settings')
    .delete()
    .eq('workspace_id', await wsObligatorio())
    .eq('key', key)
    .eq('value', esperado)
    .select('key');
  if (error) throw new Error(`Error borrando setting ${key}: ${error.message}`);
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
  const ws = await wsObligatorio();
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
