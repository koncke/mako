// =============================================================================
// carruseles/marca — con qué nombre firma el negocio sus carruseles (la cabecera de cada lámina)
// =============================================================================
// El nombre del negocio (su workspace) y sus iniciales. El @ de Instagram del negocio NO se guarda en ningún lado de MaKo
// (se conecta por Zernio, sin dejar el usuario a mano), así que va null: la cabecera lleva el nombre y la persona le suma
// su @ en el editor. Nunca se inventa. Sin nombre (no se pudo leer), «Tu negocio»: es la guía de dónde va.
// =============================================================================

import 'server-only';
import { getWorkspace } from '../workspace';
import type { Marca } from './documento';

/** El nombre del negocio `ws`, o null si no se pudo leer (la pantalla lo pasa a las miniaturas: ../../app/image-editor). */
export async function nombreDelNegocio(ws: number | null): Promise<string | null> {
  if (ws == null) return null;
  const w = await getWorkspace(ws).catch(() => null);
  return typeof w?.nombre === 'string' && w.nombre.trim() ? w.nombre.trim() : null;
}

export async function marcaDelNegocio(ws: number): Promise<Marca> {
  return { nombre: (await nombreDelNegocio(ws)) ?? 'Tu negocio', usuario: null };
}
