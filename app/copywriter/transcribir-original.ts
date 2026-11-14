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

/** Lo transcrito se ve AL LADO de la página (./OriginalAlLado.tsx; en el teléfono, la pestaña «Original»). */
export const TRANSCRITO = 'Transcribí el video: lo ves en «Original», al lado de tu página.';
/**
 * Sin transcripción: por qué, que MaKo NO sabe lo que se dice, y con qué escribe (un YouTube, con su título y su descripción; un
 * reel, con su publicación; un anuncio, con su texto). 13/11/2026, el Cerebro: con la clave de Apify de Spy dando 401, un reel que
 * no se puede transcribir lo tiene que decir en la pantalla, no inventar lo que se dice. Un motivo que ya es una frase («No pude
 * traer el video de Instagram.») va tal cual, sin «No pude transcribir el video (no pude…)».
 */
export function sinTranscripcion(motivo: string, formato: 'youtube' | 'reel' | 'anuncio' | 'pagina' = 'youtube'): string {
  // 'pagina': el VSL de una landing que trajo la persona (lib/copywriter/pegado.ts): se escribe con el texto de su página.
  const con = formato === 'reel' ? 'el texto de su publicación' : formato === 'anuncio' ? 'el texto del anuncio' : formato === 'pagina' ? 'el texto de su página' : 'su título y su descripción';
  const m = motivo.trim().replace(/\.$/, '');
  // Dentro del paréntesis, en minúscula («(no autorizado)», no «(No autorizado)»).
  const primera = /^no pude /i.test(m) ? `${m.charAt(0).toUpperCase()}${m.slice(1)}` : `No pude transcribir el video (${m.charAt(0).toLowerCase()}${m.slice(1)})`;
  return `${primera}, así que no sé lo que se dice: lo escribo con ${con} y tomo sólo su gancho y su estructura.`;
}
export const LINEA_TRANSCRIBIENDO = 'Transcribiendo el video para replicarlo: puede tardar un par de minutos.';

/** Por qué no hay transcripción, en una frase corta. */
export function motivoSinTranscripcion(g: VistaGuion): string {
  switch (g.estado) {
    case 'sin-gemini': return 'hace falta tu Gemini conectado';
    case 'sin-ia': return 'no hay ninguna IA conectada';
    case 'sin-clave': return 'falta la clave de Competitors Spy';
    case 'clave-rechazada': return 'la clave de Competitors Spy fue rechazada por Apify';
    case 'no-aplica': return 'ese video no se puede transcribir';
    case 'listo': return g.texto ? '' : (g.motivo ?? 'el video no tiene voz');
    default: return g.motivo ?? 'falló la transcripción';
  }
}

type Transcripcion = Promise<{ ok: true; guion: VistaGuion } | { ok: false; error: string }>;
export type Dependencias = {
  original: typeof pedirOriginal;
  transcribir: (piezaId: number) => Transcripcion;
  /** Lo que TRAJO la persona (`pegado:<n>`, lib/copywriter/pegado.ts): su video de YouTube lo transcribe /api/copywriter/pegado. */
  transcribirPegado?: (outlier: string) => Transcripcion;
  espera: (ms: number) => Promise<void>;
  ahora: () => number;
};
const DEPENDENCIAS: Dependencias = {
  original: pedirOriginal,
  transcribir: (piezaId) => postJson<{ ok: true; guion: VistaGuion }>('/api/competitor-spy/transcribir', { piezaId }, 60_000),
  transcribirPegado: (outlier) => postJson<{ ok: true; guion: VistaGuion }>('/api/copywriter/pegado', { accion: 'transcribir', outlier }, 60_000),
  espera: (ms) => new Promise((r) => setTimeout(r, ms)),
  ahora: () => Date.now(),
};

/**
 * Si el original es un video de YouTube sin transcribir, lo transcribe y espera. null = no hacía falta (no es de YouTube, ya
 * estaba transcrito o es de la biblioteca); si no, lo que MaKo le dice a la persona antes de escribir.
 */
export async function transcribirSiHaceFalta(outlier: string, onLinea: (t: string) => void, d: Dependencias = DEPENDENCIAS): Promise<{ ok: boolean; texto: string } | null> {
  // Lo de Spy y lo que trajo la persona (14/11/2026: el link de un YouTube o la landing de un VSL, lib/copywriter/pegado.ts).
  const pegado = outlier.startsWith('pegado:');
  if (!outlier.startsWith('spy:') && !pegado) return null;
  const o = await d.original(outlier);
  // Un YouTube, un REEL (13/11/2026, el relevo: 2 de 48 reels de la portada traían lo que se dice) y un ANUNCIO en video (el
  // Cerebro, el mismo día): los tres los transcribe Spy. Un anuncio de imagen vuelve «no-aplica» y no se dice nada.
  const f = o.ok ? o.outlier.formato : null;
  if (!o.ok || (f !== 'youtube' && f !== 'reel' && f !== 'anuncio') || o.outlier.deDonde === 'guion') return null;
  // Lo traído de una página se escribe con el texto de la PÁGINA si su video no se puede transcribir.
  const formato: 'youtube' | 'reel' | 'anuncio' | 'pagina' = pegado && o.outlier.deDonde === 'copy' ? 'pagina' : f === 'reel' ? 'reel' : f === 'anuncio' ? 'anuncio' : 'youtube';
  const piezaId = Number(outlier.split(':')[1]);
  if (!Number.isInteger(piezaId) || piezaId <= 0) return null;
  const nota = o.outlier.nota ?? null;
  const pedir = pegado ? () => (d.transcribirPegado ?? DEPENDENCIAS.transcribirPegado!)(outlier) : () => d.transcribir(piezaId);
  onLinea(LINEA_TRANSCRIBIENDO);
  const hasta = d.ahora() + ESPERA_TRANSCRIPCION_MS;
  while (d.ahora() < hasta) {
    const r = await pedir();
    if (!r.ok) return { ok: false, texto: sinTranscripcion(r.error, formato) };
    const g = r.guion;
    if (formato === 'anuncio' && g.estado === 'no-aplica') return null;
    // Lo traído sin un video que se pueda transcribir (el VSL de la página está en Panda): MaKo dice lo que no pudo traer, o nada.
    if (pegado && g.estado === 'no-aplica') return nota ? { ok: false, texto: nota } : null;
    if (g.estado === 'listo' && g.texto) return { ok: true, texto: TRANSCRITO };
    if (g.estado !== 'transcribiendo') return { ok: false, texto: sinTranscripcion(motivoSinTranscripcion(g), formato) };
    await d.espera(CADA_MS);
  }
  return { ok: false, texto: sinTranscripcion('tardó más de 4 minutos', formato) };
}
