// =============================================================================
// La transcripción de un VIDEO, guardada para reusarla en cada anuncio que lo use (18/11/2026, O9) — la parte PURA
// =============================================================================
// Martín, 31/07/2026: «guardar la transcripción al cargar el anuncio, para no transcribir dos veces». Se hizo (la tabla
// `creative_transcripts`, mig 0106, indexada por el `video_id` de Meta) y se perdió el 27/10 al borrar la ruta vieja de
// subida (app/api/ads-manager/creative-upload): desde ahí NADIE escribía la tabla, sólo se leía
// (`adoptarTranscripcionDelCreativo`, lib/meta-ads-create.ts) y ese lector quedó sin efecto.
//
// Hoy un video se transcribe en UN lugar: por anuncio, en el cron diario (app/api/cron/transcribe-ads) y en la extracción
// del historial al conectar Meta (lib/onboarding-extract.ts → jobTranscripts), los dos por `transcribeAd`. El mismo video en
// varios anuncios (lo normal al probar ángulos o al duplicar un conjunto) se pagaba una vez POR ANUNCIO. Con esto se paga
// una vez POR VIDEO: lo que se transcribió queda en `creative_transcripts` y el anuncio siguiente con ese video lo reusa.
//
// Qué se guarda y qué se reusa, acá (sin `server-only`: lo prueban los tests):
//   · `ok` (con o sin texto: un video sin voz es un resultado) y `muy_grande` (el tamaño de un video no cambia);
//   · NUNCA `error`: suele ser transitorio (la IA sin cuota, Meta que no contestó) y una condena permanente apagaría ese video.
// =============================================================================

import type { Seccion, TranscribeResult } from './transcribe';

/** Lo que se reusa de un video ya transcripto: los campos de `ad_transcripts` que no dependen del anuncio. */
export type TranscripcionGuardada = {
  status: 'ok' | 'muy_grande';
  transcript: string | null;
  secciones: Seccion[] | null;
  idioma: string | null;
  duracion_s: number | null;
  model: string | null;
  error: string | null;
};

/** Las columnas que se leen de `creative_transcripts`. */
export const COLUMNAS_GUARDADA = 'status, transcript, secciones, idioma, duracion_s, model, error';

const textoONull = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const numeroONull = (v: unknown): number | null => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

/** Una fila de `creative_transcripts` que se puede reusar, o null (otro estado, o una fila rota). */
export function guardadaDeFila(fila: unknown): TranscripcionGuardada | null {
  if (!fila || typeof fila !== 'object') return null;
  const f = fila as Record<string, unknown>;
  if (f.status !== 'ok' && f.status !== 'muy_grande') return null;
  const secciones = Array.isArray(f.secciones)
    ? (f.secciones as unknown[]).filter((s): s is Seccion => !!s && typeof s === 'object' && typeof (s as Seccion).titulo === 'string' && typeof (s as Seccion).texto === 'string')
    : null;
  return {
    status: f.status, transcript: textoONull(f.transcript), secciones, idioma: textoONull(f.idioma),
    duracion_s: numeroONull(f.duracion_s), model: textoONull(f.model), error: textoONull(f.error),
  };
}

/**
 * La fila para `creative_transcripts` de un resultado recién transcripto, o null si no se guarda: no es un video, no se
 * sabe su `video_id`, falló, o salió de lo guardado (ya está).
 */
export function filaParaGuardar(r: TranscribeResult & { reusada?: boolean }): Record<string, unknown> | null {
  if (r.reusada || r.tipo !== 'video' || !r.video_id) return null;
  if (r.status !== 'ok' && r.status !== 'muy_grande') return null;
  return {
    video_id: r.video_id, status: r.status, transcript: r.transcript, secciones: r.secciones, idioma: r.idioma,
    duracion_s: r.duracion_s, model: r.model, error: r.error,
  };
}
