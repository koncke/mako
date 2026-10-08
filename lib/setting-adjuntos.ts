// =============================================================================
// setting-adjuntos — la biblioteca de ARCHIVOS de los mensajes (fotos, videos, documentos)
// =============================================================================
// ⚠️ ESQUELETO DEL CONTRATO (08/10/2026). La parte del composer lo implementa con el molde de
// lib/setting-audios.ts (mig nueva `setting_adjuntos`): un paso lleva `media_id`, nunca el
// binario (AGENTS.md: «un adjunto va por referencia»). El motor (lib/nutricion.ts) y la prueba
// real («Probar en mi WhatsApp») leen estas dos funciones.

import 'server-only';

export type AdjuntoSetting = {
  id: number;
  titulo: string;
  media_path: string;
  media_mime: string;
  nombre_archivo: string | null;
  tamano: number | null;
};

/** El archivo, o null si no existe en ESTE workspace. */
export async function getAdjunto(id: number): Promise<AdjuntoSetting | null> {
  void id;
  return null;
}

/** El binario en base64 (lo que pide Evolution `sendMedia`), o null si no se pudo bajar. */
export async function adjuntoBase64(a: Pick<AdjuntoSetting, 'media_path'>): Promise<string | null> {
  void a;
  return null;
}
