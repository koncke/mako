// =============================================================================
// nutricion-envios-resumen — «qué SALIÓ de verdad» por inscripción, sin el corte
// =============================================================================
// El evaluador de desenlaces (lib/nutricion-desenlace.ts) decide si una
// secuencia FALLÓ por silencio mirando cuándo salió el último mensaje de cada
// inscripción (`silencioCumplido`). Lo leía con un `.in('inscripcion_id', ids)`
// suelto sobre nutricion_envios, para hasta 500 inscripciones de una vez.
//
// PostgREST corta en 1000 filas y no avisa (cabecera de lib/supabase-paginado.ts).
// Con 500 inscripciones de 3-5 pasos son 1.500-2.500 envíos: la respuesta venía
// cortada y a las inscripciones del final les faltaban envíos. Las dos formas en
// que eso sale mal, y ninguna da error:
//   · les faltan TODOS → `ultimo` null → «nunca salió nada» → no falla nunca y la
//     secuencia queda colgada para siempre;
//   · les falta el ÚLTIMO → `ultimo` es un envío anterior → el reloj del silencio
//     arranca antes de tiempo → se marca FALLO y se MUEVE AL LEAD de etapa
//     mientras todavía estaba dentro del plazo para contestar.
// Hoy son 5 envíos en total (17/09/2026): no rompe, pero es la cola de TODA la
// nutrición y crece 1:1 con cada mensaje que sale.
//
// Sin 'server-only' a propósito: recibe el cliente YA scopeado por getTenantDb()
// y así el test puede simular el techo de 1000, que es justo lo que se rompía.

import type { SupabaseClient } from '@supabase/supabase-js';
import { leerPorPaginas } from './supabase-paginado';
import { enTandas } from './ids-con-filas';

export type ResumenEnvio = { n: number; ultimo: string };
export type FilaEnvio = { inscripcion_id: number | null; created_at: string };

/**
 * Tanda de ids por `.in()`. No es por el techo de filas (eso lo resuelve el
 * paginado): es por el largo de la URL — cada id viaja en el query string.
 */
const TANDA_IDS = 200;

/**
 * Acumula envíos en el mapa. Pura y conmutativa a propósito: el `ultimo` sale de
 * comparar fechas, no del orden en que llegan las filas, así que da lo mismo en
 * qué página o en qué tanda cayó cada una.
 */
export function acumularEnvios(acc: Map<number, ResumenEnvio>, filas: readonly FilaEnvio[]): Map<number, ResumenEnvio> {
  for (const e of filas) {
    if (e.inscripcion_id == null) continue;
    const prev = acc.get(e.inscripcion_id);
    if (!prev) acc.set(e.inscripcion_id, { n: 1, ultimo: e.created_at });
    else acc.set(e.inscripcion_id, { n: prev.n + 1, ultimo: e.created_at > prev.ultimo ? e.created_at : prev.ultimo });
  }
  return acc;
}

/**
 * Envíos con estado 'enviado' de las inscripciones dadas, resumidos por
 * inscripción. Paginado por `id` (única) y agregado al vuelo: de cada fila solo
 * sobrevive un contador y una fecha, no hace falta juntarlas.
 */
export async function enviosPorInscripcion(db: SupabaseClient, inscIds: readonly number[]): Promise<Map<number, ResumenEnvio>> {
  const acc = new Map<number, ResumenEnvio>();
  for (const tanda of enTandas([...new Set(inscIds)], TANDA_IDS)) {
    await leerPorPaginas<FilaEnvio>(
      db, 'nutricion_envios', 'id, inscripcion_id, created_at',
      (filas) => { acumularEnvios(acc, filas); },
      { orden: 'id', eq: { estado: 'enviado' }, filtros: (q) => q.in('inscripcion_id', tanda) },
    );
  }
  return acc;
}
