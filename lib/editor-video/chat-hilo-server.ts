// =============================================================================
// editor-video/chat-hilo-server — leer y guardar el hilo del chat del Video Editor (`video_editor_chats`, mig 0298)
// =============================================================================
// El formato y las reglas viven en ./chat-hilo.ts (puro, con test); acá sólo la base:
//   · una fila por (workspace, persona, proyecto); `version` es compare-and-set, como `image_disenos`;
//   · el alta es idempotente por clave: dos pestañas que guardan la primera vez a la vez no duplican (la segunda
//     recibe el conflicto con la fila de la primera y une);
//   · SIN TABLA (la migración todavía no se aplicó) no es un error de la pantalla: contesta `sinTabla` y el editor
//     sigue con el hilo en la pestaña, como antes del 16/10. Sólo la TABLA que falta se tolera; una columna que falta
//     es un error de verdad (AGENTS.md, «una migración con columnas que el código ya lee»).
// =============================================================================

import 'server-only';
import { getTenantDb } from '../workspace';
import { hiloParaGuardar, type MensajeGuardado } from './chat-hilo';

const TABLA = 'video_editor_chats';

export type Clave = { ws: number; persona: string; proyecto: string };
export type HiloLeido = { mensajes: MensajeGuardado[]; version: number };

export type RespLeer = { ok: true; hilo: HiloLeido | null } | { ok: false; error: string; sinTabla?: true };
export type RespGuardar =
  | { ok: true; version: number }
  | { ok: false; conflicto: true; hilo: HiloLeido }
  | { ok: false; error: string; sinTabla?: true; status?: number };

/** La tabla no existe (PGRST205 de PostgREST, 42P01 de Postgres). Una columna que falta NO entra acá. */
const faltaLaTabla = (e: { code?: string | null } | null | undefined): boolean => e?.code === 'PGRST205' || e?.code === '42P01';

/** Un id de proyecto del motor: lo arma el navegador, así que se valida como texto acotado. */
export const proyectoValido = (x: unknown): x is string => typeof x === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(x);

export async function leerHilo(k: Clave): Promise<RespLeer> {
  const db = await getTenantDb();
  const { data, error } = await db.from(TABLA).select('mensajes, version')
    .eq('workspace_id', k.ws).eq('persona', k.persona).eq('proyecto_id', k.proyecto).maybeSingle();
  if (error) return faltaLaTabla(error) ? { ok: false, error: 'sin tabla', sinTabla: true } : { ok: false, error: error.message };
  if (!data) return { ok: true, hilo: null };
  const fila = data as { mensajes: unknown; version: number };
  return { ok: true, hilo: { mensajes: hiloParaGuardar(fila.mensajes), version: fila.version } };
}

/**
 * Guarda el hilo entero. `version` es la que leyó la pestaña (null: no había fila). Si otra pestaña guardó en el medio,
 * devuelve el conflicto CON la fila de ahora: la pestaña une (`unirHilos`) y vuelve a guardar con esa versión.
 */
export async function guardarHilo(k: Clave & { nombre: string | null; mensajes: unknown; version: number | null }): Promise<RespGuardar> {
  const mensajes = hiloParaGuardar(k.mensajes);
  const nombre = k.nombre ? k.nombre.slice(0, 200) : null;
  const ahora = new Date().toISOString();
  const db = await getTenantDb();
  const conflicto = async (): Promise<RespGuardar> => {
    const r = await leerHilo(k);
    if (!r.ok) return { ok: false, error: r.error, ...(r.sinTabla ? { sinTabla: true as const } : {}) };
    // La fila ya no está (se vació el workspace): se vuelve a crear.
    if (!r.hilo) return k.version == null ? { ok: false, error: 'No se pudo guardar el chat', status: 500 } : guardarHilo({ ...k, version: null });
    return { ok: false, conflicto: true, hilo: r.hilo };
  };

  if (k.version == null) {
    const { error } = await db.from(TABLA).insert({ persona: k.persona, proyecto_id: k.proyecto, nombre, mensajes, version: 1, updated_at: ahora });
    if (!error) return { ok: true, version: 1 };
    if (faltaLaTabla(error)) return { ok: false, error: 'sin tabla', sinTabla: true };
    // 23505: otra pestaña la creó primero.
    if (error.code === '23505') return conflicto();
    return { ok: false, error: error.message, status: 500 };
  }

  const { data, error } = await db.from(TABLA).update({ nombre, mensajes, version: k.version + 1, updated_at: ahora })
    .eq('workspace_id', k.ws).eq('persona', k.persona).eq('proyecto_id', k.proyecto).eq('version', k.version)
    .select('version');
  if (error) return faltaLaTabla(error) ? { ok: false, error: 'sin tabla', sinTabla: true } : { ok: false, error: error.message, status: 500 };
  const fila = (data ?? [])[0] as { version: number } | undefined;
  return fila ? { ok: true, version: fila.version } : conflicto();
}
