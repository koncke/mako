import 'server-only';

// =============================================================================
// /m/video — lo que el teléfono lee de Video Generator (sólo LEE)
// =============================================================================
// Las MISMAS lecturas que escritorio (/video-generator), ninguna propia:
//   · los anuncios en curso → `leerHistorial` (app/video-generator/video-datos.ts): los planes
//     del workspace, con lo filmado por toma (`video`). Ya scopea por workspace (getSetting) y ya
//     limpia las urls que se sabe que no funcionan;
//   · los terminados → `leerAnuncios` (anuncios-datos.ts), la lista «Anuncios terminados» de
//     escritorio;
//   · el montaje → `estadoMontajeAction` (video-action.ts), la que sondea PasoMontaje. Lleva su
//     propio `ctxAdmin`: sólo el admin del negocio, igual que el Sidebar para `video-generator`.
//
// ⚠️ NADA DE ACÁ ESCRIBE NI ENCOLA. Escritorio arranca el montaje solo al llegar al último paso
// (PasoMontaje → montarAnuncioAction) y sondea las tomas con estadoTomaAction, que BAJA clips y
// reescribe el historial. El teléfono no hace ninguna de las dos: decisión del 11/10/2026 (no
// gasta créditos ni encola), y además el historial se escribe read-modify-write sin lock — un
// segundo escritor mientras la computadora sondea puede pisar la marca de un clip pagado.
// =============================================================================

import { leerHistorial, type PlanGuardado } from '@/app/video-generator/video-datos';
import { leerAnuncios } from '@/app/video-generator/anuncios-datos';
import { estadoMontajeAction } from '@/app/video-generator/video-action';
import { puestaPorId } from '@/lib/puestas-data';
import type { MontajeM } from './modelo';
import { adelgazar, tituloDe } from './adelgazar';

/** Un anuncio en curso: su nombre, su plan (ADELGAZADO, ver `adelgazar`) y su montaje si corresponde. */
export type EnCursoM = { titulo: string; plan: PlanGuardado; montaje: MontajeM | null };

/** Un anuncio terminado de «Anuncios terminados» (escritorio), listo para mirar y descargar. */
export type TerminadoM = {
  id: string;
  titulo: string;
  url: string;
  poster: string | null;
  segundos: number;
  /** El nombre del formato (`puestaPorId`), como la fila de escritorio. */
  formato: string | null;
};

/**
 * El montaje de un anuncio, sólo cuando puede existir: con TODAS sus tomas filmadas, que es la
 * condición de `montarAnuncioAction` y la del último paso del wizard. Antes de eso no se pregunta
 * (escritorio tampoco lo muestra). `null` = no corresponde o no se pudo leer.
 */
export async function montajeDe(p: PlanGuardado): Promise<MontajeM | null> {
  const clips = p.plan.clips;
  if (!clips.length || !clips.every((c) => !!p.video?.[String(c.n)]?.url)) return null;
  const r = await estadoMontajeAction(p.id).catch(() => null);
  if (!r?.ok) return null;
  const e = r.estado;
  if (e.fase === 'listo') return { fase: 'listo', url: e.url, segundos: e.segundosDespues ?? null };
  if (e.fase === 'encolado' || e.fase === 'montando') return { fase: 'montando' };
  if (e.fase === 'error') return { fase: 'error' };
  return { fase: 'sin_empezar' };
}

/** La lista: los planes del historial (en su orden: el último tocado primero) y los terminados. */
export async function leerVideos(): Promise<{ enCurso: EnCursoM[]; terminados: TerminadoM[] }> {
  const [historial, anuncios] = await Promise.all([leerHistorial(), leerAnuncios().catch(() => [])]);
  const enCurso = await Promise.all(historial.map(async (p): Promise<EnCursoM> => ({
    titulo: tituloDe(p), plan: adelgazar(p), montaje: await montajeDe(p),
  })));
  const terminados: TerminadoM[] = anuncios.map((a) => ({
    id: a.id,
    titulo: a.titulo.trim() || 'Anuncio',
    url: a.url,
    poster: a.poster || null,
    segundos: Number.isFinite(a.duracionSeg) ? a.duracionSeg : 0,
    formato: puestaPorId(a.puestaId)?.nombre ?? null,
  }));
  return { enCurso, terminados };
}

/** Un anuncio del historial por su id (el de la URL), del workspace del request. */
export async function leerVideo(id: string): Promise<EnCursoM | null> {
  const p = (await leerHistorial()).find((e) => e.id === id);
  if (!p) return null;
  return { titulo: tituloDe(p), plan: adelgazar(p), montaje: await montajeDe(p) };
}
