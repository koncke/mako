// =============================================================================
// mapa-autores — «quién habla de qué»: temas × autores principales (pestaña Autores)
// =============================================================================
// Módulo PURO (sin React, sin server-only) para que lo pruebe un test. Sale de
// lib/offer-autores.ts; acá sólo se cuenta.
//
// Los «principales» son los que más conclusiones tienen (hoy los cinco cursos
// grandes: Contreras, Razzetti, Cubría y Molina, Carrizo y Hormozi); el resto va
// sumado en una columna, así ninguna conclusión queda afuera de la cuenta.
// =============================================================================

import { AUTORES_OFERTA, TEMAS_OFERTA, type AutorOferta, type TemaOferta } from '@/lib/offer-autores';

/** Cuántos autores llevan columna propia. Con más, la tabla deja de leerse. */
export const N_PRINCIPALES = 5;

export type FilaMapa = {
  tema: { id: TemaOferta; label: string };
  /** Una cifra por autor principal, en el orden de `principales`. */
  porAutor: number[];
  /** La suma de los demás autores. */
  otros: number;
  total: number;
};

export function mapaDeTemas(
  autores: readonly AutorOferta[] = AUTORES_OFERTA,
  temas: ReadonlyArray<{ id: TemaOferta; label: string }> = TEMAS_OFERTA,
): { principales: AutorOferta[]; resto: AutorOferta[]; filas: FilaMapa[] } {
  // `sort` es estable: con empate queda el orden del archivo.
  const principales = [...autores].sort((a, b) => b.conclusiones.length - a.conclusiones.length).slice(0, N_PRINCIPALES);
  const resto = autores.filter((a) => !principales.includes(a));
  const cuenta = (a: AutorOferta, t: TemaOferta) => a.conclusiones.filter((c) => c.tema === t).length;
  const filas = temas.map((tema) => {
    const porAutor = principales.map((a) => cuenta(a, tema.id));
    const otros = resto.reduce((n, a) => n + cuenta(a, tema.id), 0);
    return { tema, porAutor, otros, total: porAutor.reduce((x, y) => x + y, 0) + otros };
  }).filter((f) => f.total > 0);
  return { principales, resto, filas };
}

/** «Marcos Razzetti (con Yosana…)» → «Razzetti»; «Ramiro Cubría y Matías Molina» → «Cubría y Molina». */
export function nombreCorto(autor: string): string {
  return autor
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .trim()
    .split(/\s+y\s+/)
    .map((p) => p.trim().split(/\s+/).pop() ?? p)
    .join(' y ');
}

/** El ancla de la tarjeta de un autor (y el valor de `?ver=` que la abre). */
export const idAutor = (a: Pick<AutorOferta, 'autor'>): string =>
  `autor-${a.autor.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '')}`;
