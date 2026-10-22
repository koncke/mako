// =============================================================================
// automatizacion-chat-db — leer y escribir el chat con MaKo de una automatización (server-only)
// =============================================================================
// Duodécima tanda (12/10/2026, docs/diseno-duodecima-tanda.md §2.5 y §3.3). El chat vive en `app_settings`, SIN
// migración: clave `claveChat(id)` (por workspace) y valor `{ v: 1, mensajes }` (lib/automatizacion-chat.ts, puro).
// Lo escriben la ruta de IA, `crearConIA` y la API de MaKo; lo lee el GET de la ruta.
//
// ⚠️ LAS DOS VAN SIEMPRE DENTRO DE `runWithWorkspace(ws)`: `getSetting` / `cambiarSettingSi` toman el workspace del
// contexto y, sin él, CAEN AL WS 1 (lib/settings.ts, `wsActual`). Un turno de la API de MaKo no tiene cookies: sin
// esto, el chat de una automatización de un cliente se escribía en el de Mauricio.
//
// ⚠️ EL COMPARE-AND-SET NO COMPARA EL VALOR ENTERO. `cambiarSettingSi(clave, esperado, nuevo)` filtra por
// `.eq('value', esperado)`, y PostgREST pone ese filtro en la URL. MEDIDO contra prod el 12/10/2026 (sólo lectura,
// scratchpad/wf-duodecima/ia-contexto-chat/url-largo.mjs, un workspace que no existe): con 6 KB de valor contesta 200;
// con 8 y 12 KB, «fetch failed»; con 16 a 32 KB, 400; con 64 KB, 414. Un chat de ~30 mensajes ya pasa los 6 KB: desde
// ahí cada escritura TIRABA y el chat dejaba de guardarse, sin que nada lo dijera en la pantalla. Por eso:
//   · la PRIMERA escritura (no hay fila) sí va por `cambiarSettingSi(clave, null, …)`: es un upsert sin filtro;
//   · las siguientes comparan `updated_at` (un token corto) y escriben uno ESTRICTAMENTE posterior al leído, así dos
//     escritores que leyeron lo mismo no pueden ganar los dos.
// Hasta 3 vueltas; si las 3 pierden, tira (quien llama decide: la ruta no corta el flujo por el chat).
// =============================================================================

import 'server-only';
import { getSupabaseServer } from './supabase';
import { runWithWorkspace } from './workspace';
import { cambiarSettingSi } from './settings';
import { claveChat, idDeClaveChat, sanearChat, agregarMensajes, type ChatAutomatizacion, type MensajeChatMako } from './automatizacion-chat';

const VUELTAS = 3;

const idValido = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n > 0;

type FilaChat = { value: string | null; updated_at: string } | null;

/** La fila del chat, ESTRICTA: «no pude leer» tira (nunca es «no hay chat», que escribiría encima). */
async function leerFila(ws: number, clave: string): Promise<FilaChat> {
  const { data, error } = await getSupabaseServer()
    .from('app_settings').select('value, updated_at')
    .eq('workspace_id', ws).eq('key', clave).maybeSingle();
  if (error) throw new Error(`No pude leer el chat de MaKo: ${error.message}`);
  return (data as FilaChat) ?? null;
}

/** Un `updated_at` posterior al leído aunque el reloj de este servidor vaya atrasado (el token del compare-and-set). */
function despuesDe(leido: string): string {
  const antes = Date.parse(leido);
  const ahora = Date.now();
  return new Date(Number.isNaN(antes) ? ahora : Math.max(ahora, antes + 1)).toISOString();
}

/**
 * ¿ESTA AUTOMATIZACIÓN ES DE ESTE WORKSPACE? (decimotercera tanda, punto 7: el ✦ «MaKo te ayuda a escribirlo» de una
 * tarjeta anota en su chat, y el id llega del navegador). Una clave huérfana no molesta (la del chat va por workspace),
 * pero no se escribe el chat de una automatización que no existe acá. Estricta: «no pude leer» tira.
 */
export async function secuenciaDelWorkspace(ws: number, secuenciaId: number): Promise<boolean> {
  if (!idValido(ws) || !idValido(secuenciaId)) return false;
  const { data, error } = await getSupabaseServer()
    .from('nutricion_secuencias').select('id')
    .eq('workspace_id', ws).eq('id', secuenciaId).maybeSingle();
  if (error) throw new Error(`No pude leer la automatización: ${error.message}`);
  return !!data;
}

/**
 * LAS CHARLAS DEL LIENZO DE UN NEGOCIO (22/10/2026, OC5: el Ops Center las lista; medido ese día, 239 chats y nadie los
 * proyectaba), la más reciente primero, con el nombre de su automatización. Sólo la clave y la fecha: el chat se lee al
 * abrirlo (`leerChat`, que parsea el value: es un STRING JSON, y `value.mensajes` sin parsear da 0 sin error). Una clave sin su
 * automatización en este negocio (borrada) no se lista. Tira si no se pudo leer.
 */
export async function listarChats(ws: number, tope = 60): Promise<Array<{ secuenciaId: number; nombre: string; updatedAt: string }>> {
  if (!idValido(ws)) return [];
  const db = getSupabaseServer();
  const { data, error } = await db.from('app_settings').select('key, updated_at')
    .eq('workspace_id', ws).like('key', 'automatizacion.chat:%').order('updated_at', { ascending: false }).limit(tope);
  if (error) throw new Error(`No pude leer las charlas de Automations: ${error.message}`);
  const filas = ((data ?? []) as Array<{ key: string; updated_at: string }>)
    .map((f) => ({ id: idDeClaveChat(f.key), updatedAt: f.updated_at }))
    .filter((f): f is { id: number; updatedAt: string } => f.id != null);
  if (!filas.length) return [];
  const { data: secs, error: e2 } = await db.from('nutricion_secuencias').select('id, nombre')
    .eq('workspace_id', ws).in('id', filas.map((f) => f.id));
  if (e2) throw new Error(`No pude leer las automatizaciones: ${e2.message}`);
  const nombre = new Map(((secs ?? []) as Array<{ id: number; nombre: string | null }>).map((s) => [s.id, s.nombre?.trim() || `Automatización ${s.id}`]));
  return filas.flatMap((f) => { const n = nombre.get(f.id); return n ? [{ secuenciaId: f.id, nombre: n, updatedAt: f.updatedAt }] : []; });
}

/** El chat de una automatización (vacío si todavía no tiene). Tira si no se pudo leer. */
export async function leerChat(ws: number, secuenciaId: number): Promise<ChatAutomatizacion> {
  if (!idValido(ws) || !idValido(secuenciaId)) throw new Error('leerChat: workspace o automatización inválidos.');
  return runWithWorkspace(ws, async () => sanearChat((await leerFila(ws, claveChat(secuenciaId)))?.value ?? null));
}

/**
 * SUMA MENSAJES AL CHAT y devuelve cómo quedó. Un id que ya estaba no se repite y quedan los últimos `TOPE_CHAT`
 * (`agregarMensajes`). Sin nada nuevo, no escribe.
 */
export async function agregarAlChat(ws: number, secuenciaId: number, nuevos: MensajeChatMako[]): Promise<ChatAutomatizacion> {
  if (!idValido(ws) || !idValido(secuenciaId)) throw new Error('agregarAlChat: workspace o automatización inválidos.');
  const clave = claveChat(secuenciaId);
  return runWithWorkspace(ws, async () => {
    for (let vuelta = 0; vuelta < VUELTAS; vuelta++) {
      const fila = await leerFila(ws, clave);
      const actual = sanearChat(fila?.value ?? null);
      const nuevo = agregarMensajes(actual, nuevos);
      const ids = new Set(actual.mensajes.map((m) => m.id));
      if (!nuevo.mensajes.some((m) => !ids.has(m.id))) return actual;
      const valor = JSON.stringify(nuevo);
      if (!fila) {
        if (await cambiarSettingSi(clave, null, valor)) return nuevo;
        continue;
      }
      const { data, error } = await getSupabaseServer()
        .from('app_settings').update({ value: valor, updated_at: despuesDe(fila.updated_at) })
        .eq('workspace_id', ws).eq('key', clave).eq('updated_at', fila.updated_at)
        .select('key');
      if (error) throw new Error(`No pude guardar el chat de MaKo: ${error.message}`);
      if ((data ?? []).length) return nuevo;
    }
    throw new Error('El chat de MaKo cambió mientras se guardaba: prueba de nuevo.');
  });
}
