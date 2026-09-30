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

/** Tope del texto. Viaja entero adentro del system prompt del juez, una vez por reunion. */
export const TOPE_CRITERIO = 24000;

/**
 * Guarda (o borra, con texto vacio) el criterio del workspace ACTUAL.
 *
 * Tira si falla: esto lo llama una persona que acaba de apretar «Guardar», y un guardado
 * que no guarda y contesta ok es la falla que esta casa ya pago varias veces.
 *
 * ⚠️ NO USA `setSetting`, por lo mismo que la lectura de arriba: `setSetting` cae al
 * workspace 1 cuando no hay contexto, y el 1 es Mauricio. Escribir el criterio de otro
 * cliente encima del suyo no daria ningun error — le cambiaria el juez de sus reuniones.
 */
export async function guardarCriterio(texto: string): Promise<void> {
  const ws = await getWorkspaceActual();
  if (ws == null) throw new Error('No hay workspace en contexto: no se puede guardar el criterio.');
  const v = texto.trim().slice(0, TOPE_CRITERIO);
  const { error } = await getSupabaseServer()
    .from('app_settings')
    .upsert({ workspace_id: ws, key: KEY_CRITERIO, value: v, updated_at: new Date().toISOString() }, { onConflict: 'workspace_id,key' });
  if (error) throw new Error(`No pude guardar el criterio: ${error.message}`);
  console.log(`[plan-criterio] ws=${ws}: criterio ${v ? `guardado (${v.length} chars)` : 'borrado'}`);
}
