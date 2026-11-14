// =============================================================================
// spy-tope — el tope del plan al sumar un competidor, con la base (la regla pura: lib/spy-tope-reglas.ts)
// =============================================================================
// Lo llama `agregarCompetidor` (lib/spy.ts) DESPUÉS de buscar si ya lo mira y ANTES de crear la fila. Corre en el negocio
// que pregunta (`getWorkspaceActual`): la pantalla, la extensión y la API de MaKo ya corren adentro de su workspace.
// Si no se puede leer el plan, deja pasar: el tope vende, no protege nada.
// =============================================================================

import 'server-only';
import { aplicanTopes } from './topes-plan-server';
import { getWorkspace, getWorkspaceActual } from './workspace';
import { topeAlSumarCompetidor, type TopeAlSumarCompetidor } from './spy-tope-reglas';

/** `usadas`: los competidores que el negocio ya tiene. `nuevo`: false si lo que se guarda cae sobre una fila que ya existe. */
export async function topeDeCompetidores(usadas: number, nuevo: boolean): Promise<TopeAlSumarCompetidor> {
  if (!nuevo) return { ok: true };
  try {
    const ws = await getWorkspaceActual();
    if (ws == null || !(await aplicanTopes(ws))) return { ok: true };
    const w = await getWorkspace(ws);
    return topeAlSumarCompetidor({ aplica: true, capa: w?.capa ?? null, usadas, nuevo });
  } catch (e) {
    console.error('[spy-tope] no pude leer el plan, no se frena:', e instanceof Error ? e.message : String(e));
    return { ok: true };
  }
}
