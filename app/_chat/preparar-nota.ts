// =============================================================================
// Lo que tarda de una nota de voz, sin React y sin 'use client' (27/10/2026)
// =============================================================================
// Pasarla a MP3 y transcribirla. La corre la pantalla POR DETRÁS después de dibujar la nota (./nota-que-se-manda.ts →
// `onGrabada`; el Ops Center, app/admin/operaciones/useCentro.ts → mandarNota), y no depende de que la caja siga montada. Va
// aparte de ./nota-que-se-manda.ts porque ése es 'use client' y el motor del Ops Center no (tests/frontera-use-client.test.ts).
// =============================================================================

import { transcribirNota, type ResultadoTranscripcion } from '@/app/_components/transcribir-nota';
import { notaEnMp3 } from '@/app/second-brain/nota-de-voz';

/** Lo que vuelve de transcribir: el texto para mandar, o la frase de por qué no. Pura (test). */
export function textoDeLaNota(r: ResultadoTranscripcion): { texto: string } | { error: string } {
  if (!r.ok) return { error: r.error };
  const t = r.texto.trim();
  return t ? { texto: t } : { error: 'No se escuchó nada en la nota. Grábala de nuevo.' };
}

/** Pasa la nota a MP3 (el webm de Chrome no lo toma el transcriptor) y la transcribe. Nunca tira: el fallo vuelve con la
 *  frase para la persona. */
export async function prepararNota(audio: Blob): Promise<{ mp3: Blob; texto: string } | { error: string }> {
  let mp3: Blob;
  try { mp3 = await notaEnMp3(audio); } catch (e) { return { error: e instanceof Error ? e.message : 'No se pudo procesar el audio.' }; }
  const r = textoDeLaNota(await transcribirNota(mp3, 300_000, 'chat'));
  return 'error' in r ? r : { mp3, texto: r.texto };
}
