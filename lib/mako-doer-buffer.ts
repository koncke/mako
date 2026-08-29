import 'server-only';

// =============================================================================
// mako-doer-buffer — esperá a que termine de hablar antes de contestar
// =============================================================================
// El pedido del dueño, textual: «si detecta que le estoy enviando muchos mensajes
// debería esperar y luego cargar TODAS las tareas al mismo tiempo».
//
// Lo que pasaba: cada mensaje entrante disparaba su propia invocación del agente, en
// paralelo. El 5/8 llegaron 16 mensajes en 4 segundos y salieron 16 borradores, 133
// tareas y 19 proyectos. Las tareas duplicadas (7 tarjetas decían "Reportar error")
// y los proyectos inventados NO eran dos problemas: eran el mismo, visto de dos lados.
//
// EL MECANISMO, en tres piezas:
//
//   1. ENCOLAR. Todo mensaje entra a mako_doer_buffer, siempre. Barato y durable: si
//      la función muere, el mensaje sigue ahí y lo levanta el cron.
//   2. RECLAMAR. Una sola invocación gana el candado del grupo (un UPDATE atómico
//      sobre una fila; el que recibe la fila de vuelta ganó). Las demás encolan y se
//      van sin contestar nada.
//   3. ESPERAR EL SILENCIO. El que ganó duerme de a 3 segundos y mira si entró algo
//      nuevo. Cuando pasan VENTANA segundos sin mensajes nuevos, junta TODO lo
//      pendiente y responde UNA vez.
//
// Por qué el silencio y no un temporizador fijo: escribiendo se manda un mensaje cada
// 5-15 segundos y no se sabe cuántos van a ser. Una ventana de silencio se adapta
// sola: al que manda uno solo le contesta a los 8 segundos, y al que manda quince lo
// deja terminar. El TOPE existe para el caso patológico (alguien que escribe sin
// parar diez minutos): a los 90 segundos se contesta con lo que haya.
// =============================================================================

import { getTenantDb } from './workspace';
import { getSupabaseServer } from './supabase';

/** Silencio que hay que ver para considerar que terminó de hablar. */
export const VENTANA_MS = 8000;
/** Con audio se espera más: grabar y mandar una nota de voz lleva su tiempo. */
export const VENTANA_AUDIO_MS = 20000;
/** Tope duro: aunque siga escribiendo, a esto se contesta. */
export const TOPE_MS = 90000;
/** Cada cuánto se mira si entró algo nuevo. */
const LATIDO_MS = 3000;

export type MsgBuffer = {
  id: number;
  wa_message_id: string;
  texto: string;
  tiene_media: boolean;
  tiene_audio: boolean;
  payload: Record<string, unknown>;
  created_at: string;
};

const dormir = (ms: number) => new Promise<void>((r) => { setTimeout(r, ms); });

/**
 * Mete el mensaje en la cola del grupo. Devuelve false si ya estaba (re-entrega de
 * Evolution): el índice único lo resuelve en el motor, no en el código — el dedup
 * viejo guardaba UN id en app_settings y dos invocaciones concurrentes se lo pisaban.
 */
export async function encolar(jid: string, msg: { waId: string; texto: string; tieneMedia?: boolean; tieneAudio?: boolean; payload?: unknown }): Promise<boolean> {
  const db = await getTenantDb();
  const { error } = await db.from('mako_doer_buffer').insert({
    grupo_jid: jid,
    wa_message_id: msg.waId || '',
    texto: msg.texto.slice(0, 20000),
    tiene_media: !!msg.tieneMedia,
    tiene_audio: !!msg.tieneAudio,
    payload: (msg.payload ?? {}) as Record<string, unknown>,
  });
  if (error) {
    // 23505 = ya lo teníamos. Cualquier otro error se avisa pero no rompe el webhook.
    if (error.code !== '23505') console.error('[doer-buffer] encolar:', error.message);
    return false;
  }
  return true;
}

/**
 * ¿Me toca a mí juntar y contestar? UPDATE atómico sobre la fila del grupo: gana el
 * que se lleva la fila de vuelta. El candado VENCE solo (`hasta`), así que una
 * invocación que se muere no deja el grupo mudo para siempre.
 */
export async function reclamar(jid: string, quien: string, ttlMs = TOPE_MS + 60000): Promise<boolean> {
  const db = await getTenantDb();
  const ahora = new Date();
  const hasta = new Date(ahora.getTime() + ttlMs).toISOString();
  // La fila tiene que existir para poder pelearla. El insert que pierde no molesta.
  await db.from('mako_doer_lock').insert({ grupo_jid: jid, quien: null, hasta: null })
    .then(({ error }) => { if (error && error.code !== '23505') console.error('[doer-buffer] lock init:', error.message); });
  const { data, error } = await db.from('mako_doer_lock')
    .update({ quien, hasta, updated_at: ahora.toISOString() })
    .eq('grupo_jid', jid)
    .or(`hasta.is.null,hasta.lt.${ahora.toISOString()}`)
    .select('grupo_jid');
  if (error) { console.error('[doer-buffer] reclamar:', error.message); return false; }
  return (data ?? []).length > 0;
}

/** Suelta el candado (siempre, incluso si la corrida falló). */
export async function soltar(jid: string, quien: string): Promise<void> {
  const db = await getTenantDb();
  await db.from('mako_doer_lock').update({ quien: null, hasta: null, updated_at: new Date().toISOString() })
    .eq('grupo_jid', jid).eq('quien', quien)
    .then(({ error }) => { if (error) console.error('[doer-buffer] soltar:', error.message); });
}

/** Lo que está esperando en la cola de este grupo, en orden de llegada. */
export async function pendientes(jid: string): Promise<MsgBuffer[]> {
  const db = await getTenantDb();
  const { data, error } = await db.from('mako_doer_buffer')
    .select('id, wa_message_id, texto, tiene_media, tiene_audio, payload, created_at')
    .eq('grupo_jid', jid).eq('estado', 'pendiente')
    .order('created_at', { ascending: true }).limit(60);
  if (error) { console.error('[doer-buffer] pendientes:', error.message); return []; }
  return (data ?? []) as unknown as MsgBuffer[];
}

/** Los saca de la cola (ya se contestaron). */
export async function marcarProcesados(ids: number[]): Promise<void> {
  if (!ids.length) return;
  const db = await getTenantDb();
  await db.from('mako_doer_buffer').update({ estado: 'procesado' }).in('id', ids)
    .then(({ error }) => { if (error) console.error('[doer-buffer] marcar:', error.message); });
}

/**
 * Espera a que el dueño deje de escribir y devuelve TODO lo que se acumuló.
 *
 * Corta cuando pasaron `ventana` ms sin mensajes nuevos, o a los TOPE_MS pase lo que
 * pase. Si en el medio aparece un mensaje con imagen/PDF, corta ahí mismo: un adjunto
 * es un acto deliberado y merece su propia respuesta, no quedar sepultado en un lote.
 */
export async function esperarSilencio(jid: string, ventanaInicial = VENTANA_MS): Promise<MsgBuffer[]> {
  const arranque = Date.now();
  let ultimoConocido = 0;
  let ultimoCambio = Date.now();
  let ventana = ventanaInicial;
  for (;;) {
    const cola = await pendientes(jid);
    if (cola.length !== ultimoConocido) {
      ultimoConocido = cola.length;
      ultimoCambio = Date.now();
      // Una nota de voz que todavía no llegó completa merece más aire.
      if (cola.some((m) => m.tiene_audio)) ventana = Math.max(ventana, VENTANA_AUDIO_MS);
    }
    if (cola.some((m) => m.tiene_media)) return cola;
    const callado = Date.now() - ultimoCambio;
    const total = Date.now() - arranque;
    if (callado >= ventana || total >= TOPE_MS) return cola;
    await dormir(LATIDO_MS);
  }
}

/**
 * Cómo se le presenta un lote al agente. NO es una concatenación a lo bruto: se
 * numeran los mensajes para que el modelo entienda que fueron dichos por separado
 * (y que el último puede corregir al primero), y se le dice explícitamente que
 * conteste UNA sola vez por todo.
 */
export function unirMensajes(msgs: Array<{ texto: string }>): string {
  const textos = msgs.map((m) => m.texto.trim()).filter(Boolean);
  if (textos.length <= 1) return textos[0] ?? '';
  return [
    `[Te mandó ${textos.length} mensajes seguidos. Son UNA sola cosa: léelos todos antes de contestar, responde UNA vez por el conjunto y carga TODAS las tareas juntas, no de a una. Si un mensaje posterior corrige o amplía a uno anterior, gana el posterior.]`,
    ...textos.map((t, i) => `(${i + 1}) ${t}`),
  ].join('\n\n');
}

/**
 * Colas que quedaron colgadas: mensajes viejos sin candado vivo. Pasa cuando la
 * invocación que estaba esperando el silencio se murió (Vercel recicla la instancia y
 * el `after()` se va con ella). Va sin scope de workspace a propósito — es el barrido
 * del cron sobre TODOS los inquilinos —, por eso devuelve el ws junto al grupo.
 */
export async function huerfanosGlobal(minAntiguedadMs = 120000): Promise<Array<{ ws: number; jid: string }>> {
  const db = getSupabaseServer();
  const corte = new Date(Date.now() - minAntiguedadMs).toISOString();
  const { data } = await db.from('mako_doer_buffer').select('workspace_id, grupo_jid')
    .eq('estado', 'pendiente').lt('created_at', corte).limit(300);
  const pares = new Map<string, { ws: number; jid: string }>();
  for (const r of (data ?? []) as Array<{ workspace_id: number; grupo_jid: string }>) {
    pares.set(`${r.workspace_id}|${r.grupo_jid}`, { ws: r.workspace_id, jid: r.grupo_jid });
  }
  if (!pares.size) return [];
  const ahora = new Date().toISOString();
  const { data: locks } = await db.from('mako_doer_lock').select('workspace_id, grupo_jid, hasta');
  const vivos = new Set(((locks ?? []) as Array<{ workspace_id: number; grupo_jid: string; hasta: string | null }>)
    .filter((l) => l.hasta && l.hasta > ahora).map((l) => `${l.workspace_id}|${l.grupo_jid}`));
  return [...pares].filter(([k]) => !vivos.has(k)).map(([, v]) => v);
}
