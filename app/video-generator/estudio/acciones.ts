'use server';

// =============================================================================
// El estudio de video — releer los proyectos (27/10/2026)
// =============================================================================
// Lo que MaKo hace por el chat (lib/api-mako/areas/video-estudio.run.ts) escribe en el historial del negocio. La pantalla no
// se entera sola: al terminar cada turno del chat, el estudio vuelve a leer los proyectos con esto. Es una LECTURA, con la
// misma puerta que el resto de las acciones de la tab (sólo el admin del negocio, nunca el workspace de otro).
// ⚠️ 'use server': sólo funciones async exportadas (AGENTS.md, «En un archivo 'use server' SOLO se exportan funciones async»).
// =============================================================================

import { getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import type { PlanGuardado } from '../video-datos';
import { HistorialIlegible, leerHistorialEstricto } from '@/lib/api-mako/areas/video.helpers';
import { leerAnuncios, type AnuncioHecho } from '../anuncios-datos';

export async function releerProyectosAction(): Promise<
  { ok: true; historial: PlanGuardado[]; anuncios: AnuncioHecho[] } | { ok: false; error: string }
> {
  if ((await getRolWsEfectivo()) !== 'admin') return { ok: false, error: 'Solo el administrador del workspace puede hacer esto.' };
  if ((await getWorkspaceActual()) == null) return { ok: false, error: 'Sin workspace activo.' };
  // ESTRICTO: si la base no contesta, la pantalla se queda con lo que tenía. Con la lectura tolerante, un bache devolvía
  // [] y la barra de proyectos se vaciaba sola — «no pude leer» no es «no tienes anuncios».
  try {
    const [historial, anuncios] = await Promise.all([leerHistorialEstricto(), leerAnuncios().catch(() => [])]);
    return { ok: true, historial, anuncios };
  } catch (e) {
    if (e instanceof HistorialIlegible) return { ok: false, error: 'No pude leer tus anuncios. Vuelve a intentarlo.' };
    throw e;
  }
}
