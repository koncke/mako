// =============================================================================
// api-mako/areas/metricas.helpers — contar filas para poder DECIR un recorte
// =============================================================================
// Varias lecturas de lib/queries.ts y lib/pagos.ts hacen un `.select()` pelado
// (sin paginar) y PostgREST corta en 1000 filas SIN AVISAR: el total sale corto y
// siempre hacia abajo (menos gasto, mejor CAC). Arreglarlas es tocar libs
// compartidas, que esta área no toca; lo que sí se puede es preguntarle a la base
// cuántas filas había con un `count` exacto (head: true, no trae datos) y, si
// pasan del techo, decirlo ADENTRO de la respuesta que lee el modelo.
//
// Deuda: la cura real es paginar esas lecturas en la lib (leerTodo). Mientras
// tanto, esto convierte un número mentiroso en un número con su salvedad.
//
// Solo lee. Todo por getTenantDb(): scopea sola por workspace_id.
// =============================================================================

import 'server-only';
import { getTenantDb } from '@/lib/workspace';
import { PAGINA_POSTGREST, type ConsultaPaginada } from '@/lib/supabase-paginado';

/** Cuántas filas de `tabla` cumplen `filtro`. null = no se pudo contar (no es 0). */
export async function contarFilas(tabla: string, filtro: (q: ConsultaPaginada) => ConsultaPaginada): Promise<number | null> {
  const db = await getTenantDb();
  const q = db.from(tabla).select('id', { count: 'exact', head: true }) as ConsultaPaginada;
  const { count, error } = await filtro(q);
  if (error) return null;
  return typeof count === 'number' ? count : null;
}

/**
 * La salvedad de una lectura sin paginar, o null si no hace falta. `que` nombra lo
 * que se afectó («el gasto de Meta»), `filas` es lo que contó la base.
 */
export function avisoRecorte(que: string, filas: number | null, consecuencia = 'el número real es MAYOR'): string | null {
  if (filas == null) return `No se pudo comprobar si ${que} está completo (el conteo de filas falló): tómalo como aproximado.`;
  if (filas > PAGINA_POSTGREST) {
    return `${que} está calculado sobre ${PAGINA_POSTGREST} de ${filas} filas (la lectura no pagina y la base corta en ${PAGINA_POSTGREST} sin avisar): ${consecuencia}. No lo presentes como exacto.`;
  }
  return null;
}
