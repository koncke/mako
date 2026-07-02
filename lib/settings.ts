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
  const { error } = await supabase
    .from('app_settings')
    .upsert(
      { workspace_id: await wsActual(), key, value, updated_at: new Date().toISOString() },
      { onConflict: 'workspace_id,key' },
    );
  if (error) throw new Error(`Error guardando setting ${key}: ${error.message}`);
}
