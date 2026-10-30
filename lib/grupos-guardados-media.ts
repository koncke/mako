// =============================================================================
// grupos-guardados-media — la media de un grupo que se guarda, bajada EN EL MOMENTO del webhook (27/10/2026, MK-01)
// =============================================================================
// El espejo sube la media a nuestro bucket SÓLO si el webhook trae el base64 (`webhookBase64`); la línea de voz de MaKo, que
// es por donde entra el grupo Makito, no lo manda. Y el CDN de WhatsApp deja de servir la media a los ~15-17 días (medido
// con los audios de Makito, 27/10/2026): pedirla después es perderla. Acá se pide a la instancia mientras el link vive.
//
// Sin `server-only`: lo usa el webhook y lo prueba tests/grupos-guardados-ruta.test.ts con una bajada de mentira.
// =============================================================================

type Msg = Record<string, unknown> & { key?: { remoteJid?: string; id?: string; fromMe?: boolean }; message?: Record<string, unknown> };
type Bajar = (instance: string, chatJid: string, waMessageId: string, fromMe: boolean) => Promise<{ base64: string; mimetype: string } | null>;

const CON_MEDIA = ['audioMessage', 'imageMessage', 'videoMessage', 'documentMessage', 'stickerMessage'] as const;

/** ¿Trae media sin los bytes? (el caso de la línea de voz: `webhookBase64` apagado). */
export function mediaSinBytes(m: Msg): boolean {
  if (typeof m.base64 === 'string' && m.base64) return false;
  const msg = m.message ?? {};
  if (typeof msg.base64 === 'string' && msg.base64) return false;
  return CON_MEDIA.some((k) => {
    const v = msg[k] as { base64?: unknown } | undefined;
    return !!v && !(typeof v.base64 === 'string' && v.base64);
  });
}

/** El mensaje con su media en base64 (`base64`, donde la lee `extraerContenido`), bajada ahora. Si no se pudo, tal cual:
 *  el texto se guarda igual y la fila queda sin media (no se pierde el mensaje por el audio). */
export async function conMediaDelMomento(instance: string, m: Msg, bajar: Bajar): Promise<Msg> {
  if (!mediaSinBytes(m) || !m.key?.remoteJid || !m.key?.id) return m;
  const b = await bajar(instance, m.key.remoteJid, m.key.id, !!m.key.fromMe).catch(() => null);
  return b?.base64 ? { ...m, base64: b.base64 } : m;
}
