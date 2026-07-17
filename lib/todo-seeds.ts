import 'server-only';

// =============================================================================
// todo-seeds — board /plan por defecto para clientes nuevos (G4, proyectos finitos)
// =============================================================================
// Un PROYECTO es una INICIATIVA FINITA (inicio y fin), NO un área infinita:
//   MAL: "Adquisición & Ads" · BIEN: "Encontrar el primer anuncio ganador".
// Los DATOS viven en todo-seeds-data.ts (sin server-only, compartido con el script
// de reseed de Mauricio). Acá solo el insert tenant-scoped (getTenantDb).
// Idempotente: solo siembra si el cliente todavía no tiene ni proyectos ni tareas.
// =============================================================================

import { getCapaActual, getTenantDb } from './workspace';
import { capaDef } from './capas';
import type { Categoria } from './todo';
import { SEED_CATEGORIAS, buildCatRows, buildTarRows } from './todo-seeds-data';

export { SEED_CATEGORIAS } from './todo-seeds-data';

/**
 * Siembra el board por defecto (proyectos finitos + tareas) SOLO si el cliente todavía
 * no tiene ninguno. Idempotente: re-chequea antes de insertar. Si `esMauricio`, marca
 * hechas las tareas que él ya tiene armadas. Devuelve las categorías creadas.
 *
 * OJO — el seed es el de un negocio que vende con ads + funnel VSL ("Conectar Meta
 * Ads", "Encontrar el primer anuncio ganador"…). Para una capa que NO compró eso,
 * son 8 proyectos y 34 tareas del negocio de otro: le dicen que su trabajo es algo
 * que no hace. Esas capas arrancan con el board limpio y crean sus proyectos con
 * MaKo (que ya sabe proponerlos). Lo decide capas.ts, no un `if` acá.
 */
export async function seedTodoBoardSiVacio(esMauricio = false): Promise<Categoria[]> {
  if (!capaDef(await getCapaActual()).seedBoardVsl) return [];
  const supabase = await getTenantDb();
  const [{ data: cats0, error: e1 }, { data: tar0, error: e2 }] = await Promise.all([
    supabase.from('tarea_categorias').select('id').limit(1),
    supabase.from('experimento_tareas').select('id').limit(1),
  ]);
  if (e1) throw new Error(`seedTodoBoard(select cat): ${e1.message}`);
  if (e2) throw new Error(`seedTodoBoard(select tar): ${e2.message}`);
  if ((cats0 && cats0.length) || (tar0 && tar0.length)) return []; // ya arrancó su plan → no tocar

  const now = Date.now();
  const { filas: filasCat, deadlinePorKey } = buildCatRows(now);
  const { data: catsIns, error: eIns } = await supabase.from('tarea_categorias').insert(filasCat).select('*');
  if (eIns) throw new Error(`seedTodoBoard(insert cat): ${eIns.message}`);
  const creadas = (catsIns ?? []) as unknown as Categoria[];
  const idPorKey = new Map<string, number>();
  SEED_CATEGORIAS.forEach((c, i) => { const row = creadas[i]; if (row) idPorKey.set(c.key, row.id); });

  const filasTar = buildTarRows(now, esMauricio, idPorKey, deadlinePorKey);
  const { error: eTar } = await supabase.from('experimento_tareas').insert(filasTar);
  if (eTar) throw new Error(`seedTodoBoard(insert tar): ${eTar.message}`);
  return creadas;
}
