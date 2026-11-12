// =============================================================================
// hilo-real — el contexto del turno sale del CHAT de verdad, no sólo de lo que guardó el turno (11/11/2026)
// =============================================================================
// Dos casos de la misma noche, del mismo bug:
//   · grupo de SuperAdmin, 23:18-23:26 UTC: un cron le mandó a Martín el comprobante de Código para revisar; «Si perfecto, dalo de
//     alta» → «¿a quién le doy de alta al CRM?» (lo arregló, para lo que sale por `enviarAlGrupoSuperAdmin`, su memoria);
//   · grupo de Código Inmobiliario, 23:33 UTC: el equipo de MaKo (el Cerebro, con /message/sendText por la línea de MaKo) le pidió a
//     Joan «¿Me pasan el correo bien escrito?»; Joan contestó «ceo@sellersoficial.com» y MaKo: «No entiendo a qué se refiere
//     ceo@sellersoficial.com».
// Lo que sale por la línea de MaKo SIN pasar por su turno —un aviso de un cron, un mensaje del equipo, un envío a mano— no entraba a
// `mako_doer_conv`, y el turno armaba su contexto sólo con eso. El chat de verdad está en el store de Evolution de esa línea
// (`findMessages`, con los `fromMe`). Esto funde los dos: la memoria del turno, y lo del chat que la memoria no tiene, en orden.
//   · lo que la memoria ya tiene no se repite: por id, o por el texto (MaKo manda en partes y guarda el turno entero; un lote junta
//     varios mensajes de personas en uno);
//   · lo del mensaje que se está atendiendo no entra (es el «último mensaje», no el contexto);
//   · lo que escribió el EQUIPO va marcado como del equipo: un «sí» a una pregunta del equipo no es un «sí» a MaKo (28/10/2026, F2),
//     y `ultimoDeMaKo` (lib/mako-doer-in.ts) lo saltea;
//   · lo que no es texto va con su marca ([foto], [audio], [documento]); las reacciones, no.
// Puro, con test (tests/hilo-del-superadmin.test.ts).
// =============================================================================

export type FilaDeMemoria = { role: 'user' | 'assistant'; content: string; created_at: string; wa_message_id?: string | null };
export type MensajeDelChat = {
  key?: { id?: string; fromMe?: boolean; remoteJid?: string; participantAlt?: string };
  pushName?: string | null; messageTimestamp?: number | string; messageType?: string; message?: Record<string, unknown> | null;
};
export type TurnoDelHilo = { role: 'user' | 'assistant'; content: string };

/** La marca de lo que escribió el equipo de MaKo, en el historial. `ultimoDeMaKo` la saltea: no es una oferta de MaKo. */
export const MARCA_DEL_EQUIPO = '[Equipo de MaKo] ';
export const esDelEquipoEnElHilo = (content: string): boolean => content.startsWith(MARCA_DEL_EQUIPO);

/** Firmado por el equipo (lib/doer-equipo.ts, `sinFirmaDelEquipo`): «— Equipo de MaKo», «👨‍💻 Desarrollador de MaKo». */
const FIRMA_DEL_EQUIPO = /(?:^|\n)\s*(?:—|–|-)\s*Equipo de MaKo\s*$|Desarrollador de MaKo|^👨‍💻/iu;

/** El texto de un mensaje del store, o null si no es para el contexto (una reacción, un mensaje de protocolo). */
export function textoDelMensajeDelChat(m: MensajeDelChat): string | null {
  const msg = (m.message ?? {}) as Record<string, Record<string, unknown> | string | undefined>;
  const tipo = m.messageType ?? '';
  if (tipo === 'reactionMessage' || tipo === 'protocolMessage' || msg.reactionMessage || msg.protocolMessage) return null;
  const texto = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
  const conversacion = texto(msg.conversation) || texto((msg.extendedTextMessage as Record<string, unknown> | undefined)?.text);
  if (conversacion) return conversacion;
  const de = (k: string) => msg[k] as Record<string, unknown> | undefined;
  if (de('imageMessage') || tipo === 'imageMessage') return `[foto]${texto(de('imageMessage')?.caption) ? ` ${texto(de('imageMessage')?.caption)}` : ''}`;
  if (de('videoMessage') || tipo === 'videoMessage') return `[video]${texto(de('videoMessage')?.caption) ? ` ${texto(de('videoMessage')?.caption)}` : ''}`;
  if (de('audioMessage') || tipo === 'audioMessage') return '[audio]';
  const doc = de('documentMessage') ?? (de('documentWithCaptionMessage')?.message as Record<string, Record<string, unknown>> | undefined)?.documentMessage;
  if (doc || tipo === 'documentMessage' || tipo === 'documentWithCaptionMessage') {
    const nombre = texto(doc?.caption) || texto(doc?.fileName) || texto(doc?.title);
    return `[documento]${nombre ? ` ${nombre}` : ''}`;
  }
  if (de('stickerMessage') || tipo === 'stickerMessage') return null;
  return null;
}

const normal = (s: string): string => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}@.]+/gu, ' ').replace(/\s+/g, ' ').trim();
/** ¿Un texto ya está en el otro? Para lo corto, igualdad; para lo largo, que uno contenga al otro (las partes y los lotes). */
const yaEsta = (a: string, b: string): boolean => {
  if (!a || !b) return false;
  if (a === b) return true;
  const [corto, largo] = a.length <= b.length ? [a, b] : [b, a];
  return corto.length >= 12 && largo.includes(corto);
};

/**
 * La memoria del turno con lo del chat que no tiene, en orden, recortado a los últimos `turnos`. `memoria` va en orden cronológico
 * (las filas de `mako_doer_conv` de la ventana); `chat`, como venga del store. `textoActual`/`idActual`: el mensaje que se está
 * atendiendo, que no es contexto.
 */
export function conElChatReal(memoria: readonly FilaDeMemoria[], chat: readonly MensajeDelChat[], o: {
  ahoraMs: number; horas?: number; turnos?: number; idActual?: string | null; textoActual?: string; idsDelEquipo?: ReadonlySet<string>; esDeMaKo?: (alt: unknown) => boolean;
}): TurnoDelHilo[] {
  const desde = o.ahoraMs - (o.horas ?? 14) * 3_600_000;
  const turnos = o.turnos ?? 16;
  const ids = new Set(memoria.map((f) => f.wa_message_id).filter((x): x is string => !!x));
  const memNorm = memoria.map((f) => ({ role: f.role, n: normal(f.content) }));
  const actual = normal(o.textoActual ?? '');
  const items: Array<{ at: number; role: 'user' | 'assistant'; content: string }> = memoria.map((f) => ({ at: Date.parse(f.created_at), role: f.role, content: f.content }));
  const vistos = new Set<string>();
  for (const m of chat) {
    const id = m.key?.id ?? '';
    if (id && (vistos.has(id) || ids.has(id) || id === o.idActual)) continue;
    if (id) vistos.add(id);
    const segundos = Number(m.messageTimestamp);
    const at = Number.isFinite(segundos) ? (segundos < 1e12 ? segundos * 1000 : segundos) : NaN;
    if (!Number.isFinite(at) || at < desde || at > o.ahoraMs + 60_000) continue;
    const texto = textoDelMensajeDelChat(m);
    if (!texto) continue;
    const n = normal(texto);
    // MaKo vista desde otra línea del grupo llega como una persona (su número en `participantAlt`): es lo suyo.
    const deMaKo = !!m.key?.fromMe || (o.esDeMaKo?.(m.key?.participantAlt) ?? false);
    if (deMaKo) {
      if (memNorm.some((x) => x.role === 'assistant' && yaEsta(x.n, n))) continue;
      const delEquipo = (!!id && !!o.idsDelEquipo?.has(id)) || FIRMA_DEL_EQUIPO.test(texto);
      items.push({ at, role: 'assistant', content: delEquipo ? `${MARCA_DEL_EQUIPO}${texto}` : texto });
    } else {
      if (actual && yaEsta(actual, n)) continue;
      if (memNorm.some((x) => x.role === 'user' && yaEsta(x.n, n))) continue;
      const quien = (m.pushName ?? '').trim();
      items.push({ at, role: 'user', content: quien ? `${quien}: ${texto}` : texto });
    }
  }
  return items.filter((x) => Number.isFinite(x.at)).sort((a, b) => a.at - b.at).slice(-turnos).map(({ role, content }) => ({ role, content }));
}
