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

/**
 * EL RELOJ DE LA VENTANA, Y POR QUÉ SE PUEDE ACORTAR POR ENTORNO (31/10/2026).
 * `esperarSilencio` duerme sobre el reloj de VERDAD, que es justo lo que tiene que hacer en producción. Pero los tests que
 * replican la entrada REAL del grupo (`manejarEntranteDoer`) lo pagan escena por escena: `tests/_grupo-leandro-2910-hijo.ts`
 * tiene doce y tardaba **234 s** en una máquina libre, casi todo durmiendo. Y el runner de node imprime la salida de un
 * archivo de test cuando el archivo TERMINA, así que mientras ese archivo corre la tanda entera no imprime NADA: el vigía de
 * `scripts/tests-afectados.mjs` mata al proceso que no juzga un caso en 5 min (`TOPE_SIN_AVANCE_MS`) y se lleva los 100
 * archivos de la tanda con código 99 — «no se pudo chequear», que es lo que trabó el run 41207922805 de Actions.
 * Así que la ventana se puede ACORTAR con `MAKO_DOER_VENTANA_MS`, nunca alargar (`Math.min`): un entorno mal puesto puede
 * hacer que MaKo conteste antes, jamás que se quede esperando más de lo medido. Lo que el test cuida —que un lote se junte y
 * se conteste UNA vez— no depende del reloj: los mensajes del lote ya están en la cola cuando el turno llama a esperar.
 * ⚠️ Y la variable VACÍA no vale: `Number('')` es **0**, así que una clave agregada sin valor en el panel de Vercel dejaría a
 * MaKo contestando al instante, sin esperar el lote y sin que nada lo diga. Tiene que haber un número escrito.
 */
const PEDIDO = process.env.MAKO_DOER_VENTANA_MS?.trim();
const VENTANA_DE_PRUEBA_MS = PEDIDO ? Number(PEDIDO) : NaN;
const reloj = (produccion: number) => (Number.isFinite(VENTANA_DE_PRUEBA_MS) && VENTANA_DE_PRUEBA_MS >= 0 ? Math.min(produccion, VENTANA_DE_PRUEBA_MS) : produccion);

/** Silencio que hay que ver para considerar que terminó de hablar. */
export const VENTANA_MS = reloj(8000);
/** Con audio se espera más: grabar y mandar una nota de voz lleva su tiempo. */
export const VENTANA_AUDIO_MS = reloj(20000);
/** Tope duro: aunque siga escribiendo, a esto se contesta. */
export const TOPE_MS = 90000;
/** Cada cuánto se mira si entró algo nuevo. */
const LATIDO_MS = reloj(3000);
/** Lo que dura el candado sin renovarse. `MAKO_DOER_CANDADO_MS` lo ACORTA sólo en un test (como `MAKO_DOER_VENTANA_MS`): nunca lo alarga. */
const CANDADO_PEDIDO = Number(process.env.MAKO_DOER_CANDADO_MS?.trim() || NaN);
export const TTL_CANDADO_MS = Number.isFinite(CANDADO_PEDIDO) && CANDADO_PEDIDO > 0 ? Math.min(TOPE_MS + 60000, CANDADO_PEDIDO) : TOPE_MS + 60000;
/** Cada cuánto se renueva mientras corre el turno. */
const LATIDO_CANDADO_MS = Math.max(50, Math.floor(Math.min(60_000, TTL_CANDADO_MS / 2.5)));

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
export async function reclamar(jid: string, quien: string, ttlMs = TTL_CANDADO_MS): Promise<boolean> {
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

/**
 * ⚠️ EL CANDADO SE RENUEVA MIENTRAS EL TURNO CORRE (3/11/2026). Vence a los 150 s y un turno puede pasar de eso (`replicar_landing` corre ~275 s), y la fila sigue `pendiente` hasta el
 * final: a los 160 s el mensaje siguiente ganaba el candado vencido y la cola traía el pedido de antes, así que MaKo contestaba dos veces y podía repetir lo que hacía. Existía en
 * WhatsApp; con personas charlando en el grupo se vuelve frecuente. Devuelve la función que lo apaga. Nunca tira.
 */
export function renovarCandado(jid: string, quien: string): () => void {
  const t = setInterval(() => {
    void (async () => {
      const db = await getTenantDb();
      await db.from('mako_doer_lock').update({ hasta: new Date(Date.now() + TTL_CANDADO_MS).toISOString(), updated_at: new Date().toISOString() }).eq('grupo_jid', jid).eq('quien', quien);
    })().catch((e) => console.error('[doer-buffer] renovar:', e instanceof Error ? e.message : String(e)));
  }, LATIDO_CANDADO_MS);
  (t as { unref?: () => void }).unref?.();
  return () => clearInterval(t);
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
