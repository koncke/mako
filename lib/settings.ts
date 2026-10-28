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
 * ⚠️ SÓLO PARA VALORES CORTOS: `esperado` va entero en la URL. Si el valor puede pasar de ~4 KB, `cambiarSettingSiMarca`.
 */
export async function cambiarSettingSi(key: string, esperado: string | null, nuevo: string): Promise<boolean> {
  const supabase = getSupabaseServer();
  const ws = await wsObligatorio();
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

// ── El compare-and-set para valores LARGOS: por la marca de escritura, no por el valor ───────────────────────────
// ⚠️ `cambiarSettingSi` y `borrarSettingSi` ponen el valor ENTERO en la URL del PATCH (`value=eq.<valor>`), y PostgREST
// no aguanta una URL larga: medido en prod el 12/10/2026, con 6 KB contesta, de 8 a 12 KB «fetch failed», con 16 a 32 KB
// 400 y con 64 KB 414 (docs/hallazgos-infra.md). Un guion del Copywriter o su índice pasan esos tamaños con uso normal
// (verificación del Cerebro del 28/10/2026: desde ~900 palabras el guion no se guardaba MÁS). Para todo valor que pueda
// pasar de ~4 KB se compara la MARCA (`updated_at`, un token corto) y se escribe una ESTRICTAMENTE posterior a la leída:
// dos escritores que leyeron lo mismo no pueden ganar los dos. Es el molde de lib/automatizacion-chat-db.ts.

/** Una setting con su marca de escritura, ESTRICTA (un error de lectura tira). null = no existe. */
export async function getSettingConMarca(key: string): Promise<{ valor: string; marca: string } | null> {
  const { data, error } = await getSupabaseServer()
    .from('app_settings')
    .select('value, updated_at')
    .eq('workspace_id', await wsActual())
    .eq('key', key)
    .maybeSingle();
  if (error) throw new Error(`No pude leer el setting ${key}: ${error.message}`);
  if (!data) return null;
  const f = data as { value: string | null; updated_at: string };
  return { valor: f.value ?? '', marca: f.updated_at };
}

/** Una marca posterior a la leída aunque el reloj de este servidor vaya atrasado. */
export function marcaDespuesDe(leida: string | null): string {
  const antes = leida ? Date.parse(leida) : NaN;
  const ahora = Date.now();
  return new Date(Number.isNaN(antes) ? ahora : Math.max(ahora, antes + 1)).toISOString();
}

/**
 * Cambia una setting SOLO si su marca sigue siendo `marca` (la que se leyó con `getSettingConMarca`). `marca: null` =
 * sólo si la fila no existe. Devuelve la marca NUEVA si ganó, o null si otro escribió en el medio. El valor no viaja en
 * la URL: sirve para valores de cualquier largo.
 */
export async function cambiarSettingSiMarca(key: string, marca: string | null, nuevo: string): Promise<string | null> {
  const supabase = getSupabaseServer();
  const ws = await wsObligatorio();
  const escrita = marcaDespuesDe(marca);
  const { data, error } = marca === null
    ? await supabase.from('app_settings')
      .upsert({ workspace_id: ws, key, value: nuevo, updated_at: escrita }, { onConflict: 'workspace_id,key', ignoreDuplicates: true })
      .select('updated_at')
    : await supabase.from('app_settings')
      .update({ value: nuevo, updated_at: escrita })
      .eq('workspace_id', ws)
      .eq('key', key)
      .eq('updated_at', marca)
      .select('updated_at');
  if (error) throw new Error(`Error guardando setting ${key}: ${error.message}`);
  const fila = (data as Array<{ updated_at: string }> | null)?.[0];
  return fila ? fila.updated_at : null;
}

/** Borra una setting SOLO si su marca sigue siendo `marca`. Devuelve si borró. El valor no viaja en la URL. */
export async function borrarSettingSiMarca(key: string, marca: string): Promise<boolean> {
  const { data, error } = await getSupabaseServer()
    .from('app_settings')
    .delete()
    .eq('workspace_id', await wsObligatorio())
    .eq('key', key)
    .eq('updated_at', marca)
    .select('key');
  if (error) throw new Error(`Error borrando setting ${key}: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

/**
 * Borra una setting SOLO si todavía vale `esperado` (el compare-and-set de `cambiarSettingSi`, para borrar).
 * Devuelve si borró. ⚠️ El valor va en la URL: sólo para valores cortos (ver `cambiarSettingSiMarca`).
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
