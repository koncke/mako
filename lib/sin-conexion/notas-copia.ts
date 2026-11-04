// =============================================================================
// Las notas de la copia sin conexión, leídas ENTERAS (verificación de 90d6410eb, 28/10/2026)
// =============================================================================
// Era un `.limit(3000)` sin paginar sobre `lead_audit`: PostgREST devuelve 1000 filas como mucho y no avisa, así que en un
// negocio con más de 1000 notas, el lead con notas viejas salía «Sin notas guardadas» en la copia. Ahora: por tandas de
// leads (`.in`) y de a una página (`leerPorPaginas`, con ORDER BY único), hasta un tope que se dice (`recortado`).
// Sin 'server-only' A PROPÓSITO (como lib/supabase-paginado.ts): recibe el cliente YA scopeado por getTenantDb(), y los
// tests lo ejercitan con uno de mentira que corta en 1000 como el de verdad.
// =============================================================================

import { leerPorPaginas } from '../supabase-paginado';

/** Filas del historial que se leen como mucho; pasado esto, `recortado` (la copia lo dice). */
export const TOPE_FILAS_NOTAS = 20_000;
/** Leads por consulta: miles de ids no entran en la dirección del pedido. */
export const LEADS_POR_TANDA = 200;

export type FilaNota = { id: number; lead_id: number | string; valor_nuevo: string | null; autor: string | null; created_at: string };

/** Las filas `Nota` de esos leads, de cada lead las más nuevas primero. `recortado` = se llegó al tope. */
export async function filasDeNotas(db: Parameters<typeof leerPorPaginas>[0], leads: readonly number[], tope = TOPE_FILAS_NOTAS): Promise<{ filas: FilaNota[]; recortado: boolean }> {
  const filas: FilaNota[] = [];
  let recortado = false;
  for (let i = 0; i < leads.length && !recortado; i += LEADS_POR_TANDA) {
    const tanda = leads.slice(i, i + LEADS_POR_TANDA);
    await leerPorPaginas<FilaNota>(db, 'lead_audit', 'id, lead_id, valor_nuevo, autor, created_at', (pagina) => {
      filas.push(...pagina);
      if (filas.length >= tope) { recortado = true; return false; }
    }, { orden: [{ col: 'created_at', asc: false }, { col: 'id', asc: false }], eq: { campo: 'Nota' }, filtros: (q) => q.in('lead_id', tanda) });
  }
  return { filas, recortado };
}
