'use server';

// =============================================================================
// El CRITERIO DE COMPROMISOS del workspace — leer y guardar
// =============================================================================
// El texto que decide qué de una reunión es un compromiso y qué es ruido. Lo lee
// `lib/plan-criterio-juez.ts` una vez por reunión; el interruptor completo está
// explicado en `lib/plan-criterio.ts`.
//
// ⚠️ ES UN CAMINO DE ESCRITURA QUE NO EXISTÍA. El juez estaba escrito entero, con sus
// 16 tests, y NINGÚN workspace tenía el criterio cargado: el setting no lo escribía
// nadie en todo el repo. Un módulo que sólo se puede leer es un módulo apagado.
//
// ⚠️ Y ADMIN, NO CUALQUIERA. Esto gobierna qué entra al tablero de todo el workspace:
// un closer que lo cambie decide qué compromisos existen para su jefe. `requireRolWs`
// no sirve acá —redirige, que es lo correcto en una página y no en una acción—, así
// que el corte se escribe a mano y devuelve el error.

import { requireSesion } from '@/lib/tab-access';
import { criterioDelWorkspace, guardarCriterio, TOPE_CRITERIO } from '@/lib/plan-criterio';

export type CriterioData = { texto: string; tope: number };

export async function getCriterioAction(): Promise<CriterioData> {
  await requireSesion();
  return { texto: (await criterioDelWorkspace()) ?? '', tope: TOPE_CRITERIO };
}

export async function saveCriterioAction(texto: string): Promise<{ ok: boolean; error?: string }> {
  const rol = await requireSesion();
  if (rol !== 'admin') return { ok: false, error: 'Solo un admin puede cambiar el criterio.' };
  if (typeof texto !== 'string') return { ok: false, error: 'Texto inválido.' };
  try {
    await guardarCriterio(texto);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo guardar.' };
  }
}
