// =============================================================================
// plan-criterio — el INTERRUPTOR del tablero único, por workspace
// =============================================================================
// Mauricio pidió (reuniones del 8 y 9/9) que las tareas de sus reuniones se juzguen con
// SU criterio de compromisos, y que las de sus clientes y de terceros entren a SU
// tablero marcadas con el responsable, en vez de repartirse (08-T45). Eso le sirve a él
// y no necesariamente a los demás clientes: repartir es lo correcto cuando los de la
// reunión son un equipo con cuenta en la app.
//
// Así que no es un modo global: es un DATO del workspace. Si el workspace tiene criterio
// cargado, se activa todo lo que depende de él; si no, el pipeline de reuniones queda
// idéntico al de antes. Un solo interruptor para todo, a propósito: tablero único sin
// criterio sería meter a su tablero las tareas ajenas SIN el juez que las filtra, que
// es justo el ruido del que se quejó.
//
// ⚠️ NO USA `getSetting`. Ese cae al workspace 1 cuando no hay workspace en contexto
// (lib/settings.ts:17), y el 1 es Mauricio: un cron sin contexto leería SU criterio y
// se lo aplicaría a otro. Acá, sin workspace no hay criterio.
// =============================================================================

import 'server-only';
import { getSupabaseServer } from './supabase';
import { getWorkspaceActual } from './workspace';

export const KEY_CRITERIO = 'plan.criterio';

/**
 * El texto del criterio del workspace actual, o null si no tiene (o no hay workspace).
 *
 * Si la lectura FALLA devuelve null, que es «el pipeline de siempre»: las tareas ajenas
 * quedan en el borrador para repartir, como hasta hoy. No se pierde nada, solo no se
 * activa lo nuevo. El error se loguea.
 */
export async function criterioDelWorkspace(): Promise<string | null> {
  const ws = await getWorkspaceActual();
  if (ws == null) return null;
  const { data, error } = await getSupabaseServer()
    .from('app_settings')
    .select('value')
    .eq('workspace_id', ws)
    .eq('key', KEY_CRITERIO)
    .maybeSingle();
  if (error) {
    console.error(`[plan-criterio] ws=${ws}: no pude leer el criterio (${error.message}) — sigo sin él`);
    return null;
  }
  const v = typeof data?.value === 'string' ? data.value.trim() : '';
  return v || null;
}
