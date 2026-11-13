// =============================================================================
// config-automatizacion-db — leer y guardar la configuración de UNA automatización (server-only)
// =============================================================================
// Las reglas viven en lib/config-automatizacion.ts (puro). Acá, la clave de `app_settings` de cada automatización
// (`claveConfigAutomatizacion`), por workspace y SIN migración, como el chat de MaKo (lib/automatizacion-chat-db.ts).
//
// ⚠️ TODO ESTRICTO: «no pude leer» TIRA, nunca es «no tiene nada propio». Leído como vacío, una automatización que puso
// «de 9 a 18» caería al del negocio —o a ninguno— con la base caída, y le escribiría a sus leads a las 3 de la mañana:
// la misma regla que el horario del negocio (`horarioDeEnvio`, lib/nutricion.ts).
// =============================================================================

import 'server-only';
import { getSupabaseServer } from './supabase';
import { getWorkspaceActual } from './workspace';
import { setSetting } from './settings';
import { secuenciaDelWorkspace } from './automatizacion-chat-db';
import { opcionesDeRango } from './limites-envio-cuenta';
import {
  CLAVE_PREFIJO, claveConfigAutomatizacion, configParaGuardar, sanearConfigAutomatizacion, secuenciaDeClave, tieneConfigPropia,
  type ConfigAutomatizacion,
} from './config-automatizacion';

/** Lo propio de UNA automatización (`{}` = todo como el negocio). Tira si no puede leer. */
export async function leerConfigAutomatizacion(secuenciaId: number): Promise<ConfigAutomatizacion> {
  const ws = await getWorkspaceActual();
  if (ws == null) throw new Error('No sé de qué negocio es.');
  const { data, error } = await getSupabaseServer()
    .from('app_settings').select('value')
    .eq('workspace_id', ws).eq('key', claveConfigAutomatizacion(secuenciaId)).maybeSingle();
  if (error) throw new Error(`No pude leer la configuración de la automatización: ${error.message}`);
  return sanearConfigAutomatizacion((data as { value?: unknown } | null)?.value ?? null);
}

/**
 * LO PROPIO DE TODAS LAS AUTOMATIZACIONES DEL NEGOCIO, en UNA lectura (el motor, una vez por corrida). Sólo las que tienen
 * algo (las demás van como el negocio). Tira si no puede leer.
 */
export async function configsDelNegocio(): Promise<Map<number, ConfigAutomatizacion>> {
  const ws = await getWorkspaceActual();
  const out = new Map<number, ConfigAutomatizacion>();
  if (ws == null) return out;
  const { data, error } = await getSupabaseServer()
    .from('app_settings').select('key, value')
    .eq('workspace_id', ws).like('key', `${CLAVE_PREFIJO}%`);
  if (error) throw new Error(`No pude leer la configuración de las automatizaciones: ${error.message}`);
  for (const f of (data ?? []) as Array<{ key: string; value: unknown }>) {
    const id = secuenciaDeClave(f.key);
    if (id == null) continue;
    const c = sanearConfigAutomatizacion(f.value);
    if (Object.keys(c).length) out.set(id, c);
  }
  return out;
}

/**
 * GUARDA UN CAMBIO de la configuración de una automatización de ESTE negocio (`configParaGuardar`: `null` en una parte la
 * vuelve a la del negocio). Devuelve lo que quedó.
 */
export async function guardarConfigAutomatizacion(secuenciaId: number, cambio: unknown): Promise<{ ok: true; config: ConfigAutomatizacion } | { ok: false; error: string }> {
  const ws = await getWorkspaceActual();
  if (ws == null) return { ok: false, error: 'No sé de qué negocio es.' };
  if (!(await secuenciaDelWorkspace(ws, secuenciaId))) return { ok: false, error: 'Esa automatización no existe en este negocio.' };
  const previo = await leerConfigAutomatizacion(secuenciaId);
  // El tope por día del goteo con el rango de SU cuenta (#93): 2.000 con su Resend y su dominio, 500 con la de la plataforma.
  const r = configParaGuardar(previo, cambio, await opcionesDeRango());
  if (!r.ok) return r;
  // Todo como el negocio: la clave se BORRA (revisión del 20/10/2026). Un '{}' por cada «volver a como el negocio» se
  // acumulaba y engordaba la lectura de todas las del tick.
  if (r.vacia) await borrarConfig(ws, secuenciaId);
  else await setSetting(claveConfigAutomatizacion(secuenciaId), r.valor);
  return { ok: true, config: r.config };
}

async function borrarConfig(ws: number, secuenciaId: number): Promise<void> {
  const { error } = await getSupabaseServer().from('app_settings').delete()
    .eq('workspace_id', ws).eq('key', claveConfigAutomatizacion(secuenciaId));
  if (error) throw new Error(`No pude volver la automatización a como el negocio: ${error.message}`);
}

/**
 * LA COPIA HEREDA LA CONFIGURACIÓN PROPIA (revisión del 20/10/2026). Vive FUERA de la fila (en `app_settings`), así que
 * «Duplicar» la perdía: la copia de una «Prospección fría» de 9 a 18 con 48 h nacía mandando a las 3 AM con 20 h. La
 * llama quien crea un id nuevo desde otro (`duplicarSecuencia`); estricta: si no puede leer o escribir, TIRA, y quien
 * la llama borra la copia.
 */
export async function copiarConfigAutomatizacion(de: number, a: number): Promise<void> {
  const c = await leerConfigAutomatizacion(de);
  if (!tieneConfigPropia(c)) return;
  await setSetting(claveConfigAutomatizacion(a), JSON.stringify(c));
}
