// =============================================================================
// doer-reenvio — el mensaje que alguien REENVÍA al grupo es de otra persona (29/10/2026, el grupo de SuperAdmin; sin base: puro)
// =============================================================================
// Martín reenvió al grupo de SuperAdmin el audio y la captura de un cliente («Che Tincho, te hago una consulta… pegué el token del
// pixel… le doy a conectar Facebook y no me hace nada») y MaKo le contestó a ÉL: «Te voy a ser directo, Martín: olvídate del método
// viejo…». La consulta era del cliente. WhatsApp lo dice en el mensaje (`contextInfo.isForwarded` / `forwardingScore`: medido en
// `mako_doer_buffer` 340 y 341, el audio y la imagen de ese reenvío) y nadie lo leía. Ahora el turno lo sabe.
// =============================================================================

type Ctx = { isForwarded?: unknown; forwardingScore?: unknown };

/** ¿WhatsApp marca el mensaje como reenviado? Mira el `contextInfo` donde venga: arriba (Evolution v2), adentro, o en el medio. */
export function esReenviado(m: { message?: Record<string, unknown> | null; contextInfo?: unknown } | null | undefined): boolean {
  const msg = (m?.message ?? {}) as Record<string, unknown>;
  const candidatos: Array<Ctx | undefined> = [
    m?.contextInfo as Ctx | undefined,
    msg.contextInfo as Ctx | undefined,
    ...['extendedTextMessage', 'imageMessage', 'videoMessage', 'documentMessage', 'audioMessage', 'pttMessage'].map((k) => (msg[k] as { contextInfo?: Ctx } | undefined)?.contextInfo),
  ];
  return candidatos.some((c) => c?.isForwarded === true || (typeof c?.forwardingScore === 'number' && c.forwardingScore > 0));
}

/** La marca del turno: lo escribió otra persona. Va DELANTE, para que el modelo lo lea antes que el texto. */
export const MARCA_REENVIADO = '(REENVIADO: esto lo escribió OTRA persona y quien te lo manda te lo pasó. Si es una consulta o un problema, es de esa persona, no de quien te lo reenvía: no le contestes como si fuera suya)';

export function conElReenvio(texto: string): string {
  return texto.startsWith(MARCA_REENVIADO) ? texto : `${MARCA_REENVIADO}\n${texto}`;
}
