// =============================================================================
// Antes de replicar un video de YouTube, su TRANSCRIPCIÓN (13/11/2026) — sin 'use client', a propósito
// =============================================================================
// Martín, en la llamada con Leila: el outlier de YouTube de los «7 ejercicios de bíceps» se replicó sin la transcripción (MaKo sólo
// tenía el título y la descripción). Primero se transcribe y se muestra; después escribe. La transcripción es la de Competitors Spy
// (/api/competitor-spy/transcribir, con el Gemini del negocio y su tope por día): la pide, la espera unos minutos y, cuando queda
// guardada, el original que lee MaKo (lib/copywriter/outliers-servidor.ts → guionesDe) y el de «Ver el original» ya la traen.
// Si no se puede (sin Gemini, el tope del día, un video sin voz, se pasó del tiempo), lo dice y la réplica se escribe igual, con el
// título y la descripción: sólo el gancho y la estructura.
// =============================================================================

import { postJson } from '@/app/web-generator/cliente';
import type { VistaGuion } from '@/lib/spy-transcripcion';
import { pedirOriginal } from './cliente';

/** Cuánto se espera la transcripción antes de escribir sin ella (un video de 30 minutos son 3 tramos de ~1 minuto). */
export const ESPERA_TRANSCRIPCION_MS = 4 * 60_000;
export const CADA_MS = 6_000;

export const TRANSCRITO = 'Transcribí el video para replicarlo: lo ves en «Ver el original».';
/** Sin transcripción: con qué se escribe (un YouTube, con su título y su descripción; un reel, con el texto de su publicación). */
export const sinTranscripcion = (motivo: string, formato: 'youtube' | 'reel' = 'youtube') =>
  `No pude transcribir el video (${motivo}): lo escribo con ${formato === 'reel' ? 'el texto de su publicación' : 'su título y su descripción'}, y tomo sólo el gancho y la estructura.`;
export const LINEA_TRANSCRIBIENDO = 'Transcribiendo el video para replicarlo: puede tardar un par de minutos.';

/** Por qué no hay transcripción, en una frase corta. */
export function motivoSinTranscripcion(g: VistaGuion): string {
  switch (g.estado) {
    case 'sin-gemini': return 'hace falta tu Gemini conectado';
    case 'sin-ia': return 'no hay ninguna IA conectada';
    case 'sin-clave': return 'falta la clave de Competitors Spy';
    case 'no-aplica': return 'ese video no se puede transcribir';
    case 'listo': return g.texto ? '' : (g.motivo ?? 'el video no tiene voz');
    default: return g.motivo ?? 'falló la transcripción';
  }
}

export type Dependencias = {
  original: typeof pedirOriginal;
  transcribir: (piezaId: number) => Promise<{ ok: true; guion: VistaGuion } | { ok: false; error: string }>;
  espera: (ms: number) => Promise<void>;
  ahora: () => number;
};
const DEPENDENCIAS: Dependencias = {
  original: pedirOriginal,
  transcribir: (piezaId) => postJson<{ ok: true; guion: VistaGuion }>('/api/competitor-spy/transcribir', { piezaId }, 60_000),
  espera: (ms) => new Promise((r) => setTimeout(r, ms)),
  ahora: () => Date.now(),
};

/**
 * Si el original es un video de YouTube sin transcribir, lo transcribe y espera. null = no hacía falta (no es de YouTube, ya
 * estaba transcrito o es de la biblioteca); si no, lo que MaKo le dice a la persona antes de escribir.
 */
export async function transcribirSiHaceFalta(outlier: string, onLinea: (t: string) => void, d: Dependencias = DEPENDENCIAS): Promise<{ ok: boolean; texto: string } | null> {
  if (!outlier.startsWith('spy:')) return null;
  const o = await d.original(outlier);
  // Un YouTube y un REEL (13/11/2026, el relevo: 2 de 48 reels de la portada traían lo que se dice): los dos los transcribe Spy.
  if (!o.ok || (o.outlier.formato !== 'youtube' && o.outlier.formato !== 'reel') || o.outlier.deDonde === 'guion') return null;
  const formato: 'youtube' | 'reel' = o.outlier.formato === 'reel' ? 'reel' : 'youtube';
  const piezaId = Number(outlier.split(':')[1]);
  if (!Number.isInteger(piezaId) || piezaId <= 0) return null;
  onLinea(LINEA_TRANSCRIBIENDO);
  const hasta = d.ahora() + ESPERA_TRANSCRIPCION_MS;
  while (d.ahora() < hasta) {
    const r = await d.transcribir(piezaId);
    if (!r.ok) return { ok: false, texto: sinTranscripcion(r.error.replace(/\.$/, '').toLowerCase(), formato) };
    const g = r.guion;
    if (g.estado === 'listo' && g.texto) return { ok: true, texto: TRANSCRITO };
    if (g.estado !== 'transcribiendo') return { ok: false, texto: sinTranscripcion(motivoSinTranscripcion(g), formato) };
    await d.espera(CADA_MS);
  }
  return { ok: false, texto: sinTranscripcion('tardó más de 4 minutos', formato) };
}
