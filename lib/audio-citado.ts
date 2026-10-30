// =============================================================================
// audio-citado — la nota de voz que alguien CITA en el grupo (28/10/2026, Leandro, ws10)
// =============================================================================
// Leandro contestó citando su audio de 1:34 («No me respondiste lo de este audio») y MaKo le dijo «en este mensaje no puedo
// escuchar audios ni tengo la transcripción del tuyo. Mándame el texto exacto». La cita trae el audio en
// `contextInfo.quotedMessage.audioMessage` (94 s), pero el turno sólo transcribía el audio del mensaje NUEVO: el lote lo guardó
// con `tiene_audio=false`. Ahora el audio citado se baja (por el id de la cita), se transcribe por la vía de la nota de voz del
// grupo (Groq, `notaDeVozDelGrupo`) y entra al turno con su texto.
// =============================================================================

export type AudioCitado = { id: string; mime: string; segundos: number | null; base64: string | null; participante: string | null };

type Ctx = { stanzaId?: unknown; participant?: unknown; quotedMessage?: Record<string, unknown> };

/** La nota de voz citada de un mensaje de WhatsApp, o null. La cita viene en el mensaje o (Evolution v2) en el nivel de arriba. */
export function audioCitadoDe(m: { message?: Record<string, unknown> | null; contextInfo?: unknown } | null | undefined): AudioCitado | null {
  const msg = (m?.message ?? {}) as Record<string, unknown>;
  const candidatos: Array<Ctx | undefined> = [
    (msg.extendedTextMessage as { contextInfo?: Ctx } | undefined)?.contextInfo,
    msg.contextInfo as Ctx | undefined,
    m?.contextInfo as Ctx | undefined,
    ...['imageMessage', 'videoMessage', 'documentMessage', 'audioMessage'].map((k) => (msg[k] as { contextInfo?: Ctx } | undefined)?.contextInfo),
  ];
  for (const c of candidatos) {
    const q = c?.quotedMessage;
    const a = (q?.audioMessage ?? q?.pttMessage) as { mimetype?: string; seconds?: number; base64?: string } | undefined;
    if (!a || typeof c?.stanzaId !== 'string' || !c.stanzaId) continue;
    return {
      id: c.stanzaId, mime: a.mimetype || 'audio/ogg', segundos: Number.isFinite(Number(a.seconds)) ? Number(a.seconds) : null,
      base64: typeof a.base64 === 'string' && a.base64 ? a.base64 : null,
      participante: typeof c.participant === 'string' && c.participant ? c.participant : null,
    };
  }
  return null;
}

/** El texto del mensaje con lo que dice la nota de voz citada, para el turno. */
export function conElAudioCitado(texto: string, transcripcion: string, segundos: number | null): string {
  const dur = segundos ? ` de ${segundos} s` : '';
  return `${texto.trim()}\n\n(cita una nota de voz${dur}; la escuchaste y dice: «${transcripcion.trim()}»)`.trim();
}

/** ¿El texto del turno trae una nota de voz citada que se escuchó (`conElAudioCitado`)? */
export const conUnAudioCitadoEscuchado = (texto: string): boolean => /\(cita una nota de voz(?: de \d+ s)?; la escuchaste y dice: «/.test(texto);

/**
 * EL AUDIO DEL LOTE QUE NO SE ESCUCHÓ (29/10/2026, Leandro, ws10). Mandó una nota de voz y enseguida «Tal cual como lo hace
 * manychat»; el audio no se escuchó, no entró al turno (un `continue`), y el modelo contestó el «tal cual» solo, como si
 * supiera de qué hablaba: «Mira… no es arrancar por los flujos locos…». El aviso del audio sale aparte (`avisarElAudioDelLote`);
 * el turno lleva esta marca EN EL LUGAR del audio, para que lo que sigue no se conteste a ciegas. Un lote que sólo tiene esto
 * no corre turno: el aviso ya lo dijo.
 */
export const AUDIO_DEL_LOTE_SIN_ESCUCHAR = '(aquí mandó una nota de voz que no pudiste escuchar; el aviso ya salió aparte: no lo repitas. Lo que sigue puede referirse a ese audio: si no se entiende solo, dilo en una línea y pide que lo escriba; no adivines)';

/**
 * La nota de voz citada que NO entra al turno, con la marca de por qué (la verificación de 5b7a1917d): el resto del mensaje
 * sigue. Antes, la que no se podía bajar tiraba el mensaje entero (en el lote) o lo cambiaba por un cartel que culpaba a la IA
 * del negocio (en el suelto). `vacia`: Groq no le sacó texto (no se avisó nada: lo dice el modelo).
 */
export function conLaCitaSinEscuchar(texto: string, motivo: 'sin-bajar' | 'sin-escuchar' | 'vacia'): string {
  const marca = motivo === 'vacia'
    ? '(cita una nota de voz que salió vacía: no sabes qué dice; dilo en una línea y pide que la escriba)'
    : `(cita una nota de voz que no pudiste ${motivo === 'sin-bajar' ? 'bajar de WhatsApp' : 'escuchar'}; ya se lo avisaste aparte: no lo repitas, contesta lo demás del mensaje)`;
  return `${texto.trim()}\n\n${marca}`.trim();
}
