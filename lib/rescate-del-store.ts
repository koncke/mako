// =============================================================================
// rescate-del-store — lo que la voz GUARDÓ y nunca pasó por el webhook (13/11/2026, Mauricio, ws1)
// =============================================================================
// Mauricio escribió en su grupo de MaKo el 12/11 de 19:23 a 20:21 UTC y el 13/11 de 15:58 a 15:59. MaKo no le contestó, y
// no quedó NADA: ni la cola (`mako_doer_buffer`), ni el hilo de la app (`grupo_mensajes`), ni una clasificación, ni el
// aviso de «llegó tarde». Medido (sólo lectura, 13/11 18:40 UTC):
//   · el …2605 estaba cortado por WhatsApp desde el 12/11 12:13 (403) y la voz, desde las 17:38, en el …3479, que recibía
//     con ~24 h de atraso. A tiempo no entró nada;
//   · los 7 mensajes SÍ están en el store de Evolution de las dos líneas, pero entraron EN LOTE al re-vincularlas: el id de
//     cada fila es un cuid y su hora es la del guardado → …2605 el 13/11 17:12:27, …3479 17:13:37. La fila trae
//     `pushName` = el número del @lid, sin `participant` y `source: unknown`: es la sincronización de historial, que
//     Evolution guarda y NO manda como `messages.upsert` (el único evento de mensajes que lee el webhook).
// El diagnóstico obvio era «la línea estaba sorda». Lo fue, pero eso no explica el silencio de DESPUÉS: al re-vincular,
// WhatsApp entregó todo, y como entró por el historial el doer nunca lo vio. MaKo calló con los mensajes a la vista en el store.
//
// El arreglo: el cron alerta-critica (cada 10 min) lee el store de la VOZ en los grupos oficiales y rescata lo que una persona
// escribió, que entró al store hace poco y que el webhook no vio (no está en el hilo ni en la cola). Pasa por las MISMAS puertas
// de la entrada (`atenderEntranteDoer`: más de 6 h de atraso va a SuperAdmin; el comprobante; la respuesta al equipo) y se
// ENCOLA; contesta `doer-flush`, que levanta la cola sin candado.
//
// ⚠️ «Hace poco» es por la hora de GUARDADO (el cuid), no la de WhatsApp: el historial trae mensajes de un día antes, y lo que
// importa es cuándo los vio la línea. Así el rescate no barre de nuevo lo viejo del store en cada vuelta, ni lo que ya estaba
// cuando se desplegó (los mensajes del 13/11 de Mauricio, que contestó el equipo a mano). Con un id que no es cuid se usa la
// hora de WhatsApp, con una ventana de un día.
//
// PURO y sin `server-only`: tests/rescate-del-store.test.ts.
// =============================================================================

/** Lo que entró al store en esta ventana se rescata. El cron corre cada 10 min: seis vueltas para encontrarlo. */
export const RECIENTE_MS = 60 * 60_000;
/** Lo más nuevo que esto se deja al webhook: un mensaje que está entrando por el camino normal no se agarra a la mitad. */
export const RESPIRO_MS = 3 * 60_000;
/** Sin hora de guardado (un id que no es cuid): la hora de WhatsApp, con esta ventana. */
export const VENTANA_SIN_GUARDADO_MS = 24 * 3_600_000;

export type RegistroDelStore = {
  id?: string;
  key?: { id?: string; remoteJid?: string; fromMe?: boolean; participant?: string; participantAlt?: string };
  pushName?: string | null;
  message?: Record<string, unknown> | null;
  messageType?: string;
  messageTimestamp?: unknown;
};

const ANIO_MS = 365 * 86_400_000;

/**
 * Cuándo GUARDÓ Evolution la fila. Su id es un cuid (Prisma, `@default(cuid())`): «c», la hora en ms en base 36 (8
 * caracteres), contador, huella y azar; 25 caracteres. Comprobado el 13/11: el webhook del …2605 (`cmwbivfnn…`) da
 * 2026-11-11T02:51:12.515Z, su `createdAt` exacto. null: no es un cuid, o da una hora que no puede ser.
 */
export function horaDeGuardado(id: unknown, ahora: number): number | null {
  const s = String(id ?? '');
  if (!/^c[0-9a-z]{24}$/.test(s)) return null;
  const ms = parseInt(s.slice(1, 9), 36);
  if (!Number.isFinite(ms) || ms > ahora + 86_400_000 || ms < ahora - 2 * ANIO_MS) return null;
  return ms;
}

/** La hora de WhatsApp en ms (segundos, texto o `{ low }`), o null. */
function horaDeWhatsApp(ts: unknown): number | null {
  const crudo = typeof ts === 'object' && ts !== null && 'low' in ts ? (ts as { low: unknown }).low : ts;
  const n = Number(crudo);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n < 1e12 ? n * 1000 : n;
}

/** ¿Trae algo que se lee? La misma regla que el espejo (`leerMensajeDeWhatsApp`, lib/grupo-espejo.ts): una reacción o un protocolo (un borrado, una edición) no. */
export function tieneContenido(message: Record<string, unknown> | null | undefined): boolean {
  const m = message ?? {};
  if (m.reactionMessage || m.protocolMessage) return false;
  if (typeof m.conversation === 'string' && m.conversation.trim()) return true;
  const ext = m.extendedTextMessage as { text?: unknown } | undefined;
  if (typeof ext?.text === 'string' && ext.text.trim()) return true;
  return ['imageMessage', 'audioMessage', 'pttMessage', 'documentMessage', 'documentWithCaptionMessage', 'videoMessage', 'stickerMessage',
    'contactMessage', 'contactsArrayMessage', 'locationMessage'].some((k) => !!m[k]);
}

const SOLO_NUMERO = /^\d{6,20}$/;

/**
 * Lo que hay que rescatar de los registros de UN grupo, en el orden en que se escribió, con el autor puesto.
 *
 * `vistos`: los ids que el webhook ya vio (están en el hilo de la app o en la cola). Se rescata lo que escribió una persona
 * (no `fromMe`), trae algo que se lee, no se vio, entró al store dentro de `RECIENTE_MS` y tiene al menos `RESPIRO_MS`.
 *
 * El historial guarda la fila SIN `participant` y con el número del @lid como `pushName`. El doer sabe quién escribió por el
 * `participant`: se arma `<número>@lid`, y el nombre sale de otra fila del mismo grupo con ese `participant` (una que sí llegó
 * por el webhook); si no hay, sin nombre (nunca el número como si fuera uno).
 */
export function queRescatar(registros: readonly RegistroDelStore[], o: { ahora: number; vistos: ReadonlySet<string> }): RegistroDelStore[] {
  const nombres = new Map<string, string>();
  for (const r of registros) {
    const p = r.key?.participant;
    const n = (r.pushName ?? '').trim();
    if (p && n && !SOLO_NUMERO.test(n)) nombres.set(p, n);
  }
  const ya = new Set<string>();
  const salen: Array<{ r: RegistroDelStore; ts: number }> = [];
  for (const r of registros) {
    const id = r.key?.id ?? '';
    if (!id || ya.has(id) || o.vistos.has(id)) continue;
    if (!String(r.key?.remoteJid ?? '').endsWith('@g.us') || r.key?.fromMe) continue;
    if (!tieneContenido(r.message)) continue;
    const ts = horaDeWhatsApp(r.messageTimestamp);
    if (ts == null || o.ahora - ts < RESPIRO_MS) continue;
    const guardado = horaDeGuardado(r.id, o.ahora);
    if (guardado != null ? o.ahora - guardado > RECIENTE_MS || o.ahora - guardado < RESPIRO_MS : o.ahora - ts > VENTANA_SIN_GUARDADO_MS) continue;
    ya.add(id);
    const crudo = (r.pushName ?? '').trim();
    const participant = r.key?.participant || (SOLO_NUMERO.test(crudo) ? `${crudo}@lid` : undefined);
    const pushName = r.key?.participant ? r.pushName ?? undefined : participant ? nombres.get(participant) : (crudo || undefined);
    salen.push({ r: { ...r, key: { ...r.key, ...(participant ? { participant } : {}) }, pushName: pushName ?? undefined }, ts });
  }
  return salen.sort((a, b) => a.ts - b.ts).map((x) => x.r);
}
