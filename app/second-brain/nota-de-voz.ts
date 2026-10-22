// =============================================================================
// La nota de voz de la caja del Ops Center, en MP3 (22/10/2026, OC7)
// =============================================================================
// Lo que el transcriptor y cualquier navegador aceptan: el webm de Chrome no. La usan los dos caminos de la nota: el de una
// conversación de Offer (motor-offer.ts → subirNotaDeVoz, a Storage como en la tab) y el de un chat de MaKo (useChatCliente →
// postArchivos, a /api/mako/chat, que la escucha con la IA del negocio).

/** Un audio que el navegador no puede pasar a MP3: se graba de nuevo (reintentar lo mismo no sirve). */
export class AudioInservible extends Error {}

/** La nota en MP3. Perezoso, como la tab de Offer: el codificador (lamejs) sólo se baja al mandar una nota de voz. */
export async function notaEnMp3(blob: Blob): Promise<Blob> {
  if (blob.type === 'audio/mpeg') return blob;
  try {
    return await (await import('@/app/whatsapp/audio')).blobToMp3(blob);
  } catch {
    throw new AudioInservible('No se pudo procesar el audio. Grábalo de nuevo.');
  }
}
