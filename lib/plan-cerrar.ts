import 'server-only';

// =============================================================================
// plan-cerrar — marcar HECHA una tarea con su evidencia, EN EL ACTO (17/10/2026)
// =============================================================================
// Martín, 17/10/2026: que marcar resuelta una tarea, cuando algo ya está, sea AUTOMÁTICO siempre. Hasta ese día
// el único camino para cerrar desde afuera del tablero era `proponer_cierre_tareas`, que deja un BORRADOR en
// /plan/revisar y espera a que alguien lo confirme: el Centro lo proponía y lo aplicaba en el acto con dos
// escrituras (y si el segundo paso fallaba, quedaba un borrador colgado), y el «Ya está» de un chat no cerraba
// nada. Ahora `cerrar_tareas_plan` (lib/api-mako/areas/plan.run.ts) cierra por acá, sin borrador.
//
// Cerrar NO es borrar: la tarjeta queda con su historial y su checklist tildada, con el renglón «MaKo la marcó
// hecha: <evidencia> · Se revisa en <ruta>». Se reabre moviéndola de columna, como siempre.
//
// Los dos tableros, con las MISMAS escrituras que ya usaba el borrador al aplicar un cierre:
//   · el del super admin: `cerrarPlanTareaOwner` (lib/plan-board.ts);
//   · el de un cliente: `cerrarTareaCliente`, que también usa `aplicarPropuestas` (lib/plan-propuesta.ts).
// ⚠️ NO FIJA EL WORKSPACE: quien llama ya está adentro de `runWithWorkspace` (la API de MaKo lo fija).
// =============================================================================

import { cerrarPlanTareaOwner, fusionarDetalle } from './plan-board';
import { listTareas, editarTarea } from './todo';
import { renglonDeCierre, pruebaConRuta } from './cierre-tarjeta';

/** Cierra (o deja a medias) UNA tarea del tablero de un cliente. `true` sólo si tocó una fila. */
export async function cerrarTareaCliente(id: number, evidencia: string, parcial = false): Promise<boolean> {
  const actual = (await listTareas()).find((t) => t.id === id);
  if (!actual) return false;
  await editarTarea(id, {
    progreso: parcial ? Math.max(50, actual.progreso ?? 0) : 100,
    detalle: parcial ? fusionarDetalle(actual.detalle ?? '', evidencia) : (actual.detalle ?? null),
    historial: [{ id: `cerr${Date.now()}${id}`, ts: Date.now(), actor: 'ia', text: renglonDeCierre(evidencia, parcial) }, ...(actual.historial ?? [])],
  });
  return true;
}

export type CierreEnElActo = { id: string; titulo: string; evidencia: string; revisar?: string | null };

/**
 * Cierra estas tareas, ya validadas (existen, están abiertas, traen evidencia). Devuelve las que de verdad se
 * cerraron: un contador que dice «cerré 1» sin haber tocado una fila es peor que no tenerlo.
 */
export async function cerrarConEvidencia(enElTableroDelDueno: boolean, items: readonly CierreEnElActo[]): Promise<{ cerradas: Array<{ id: string; titulo: string }>; fallidas: string[] }> {
  const cerradas: Array<{ id: string; titulo: string }> = [];
  const fallidas: string[] = [];
  for (const c of items) {
    const prueba = pruebaConRuta(c.evidencia, c.revisar);
    try {
      const ok = enElTableroDelDueno
        ? await cerrarPlanTareaOwner(c.id, prueba, false)
        : Number.isFinite(Number(c.id)) && await cerrarTareaCliente(Number(c.id), prueba, false);
      if (ok) cerradas.push({ id: c.id, titulo: c.titulo }); else fallidas.push(c.titulo);
    } catch (e) {
      console.error(`[plan-cerrar] «${c.titulo}»: ${e instanceof Error ? e.message : String(e)}`);
      fallidas.push(c.titulo);
    }
  }
  return { cerradas, fallidas };
}
