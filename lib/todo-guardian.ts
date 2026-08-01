// =============================================================================
// todo-guardian — el Perro Guardián para el board del CLIENTE (experimento_tareas)
// =============================================================================
// Gemelo de `priorizarNuevasOwner` (lib/plan-board.ts), que solo servía al board del
// super-admin (plan_tareas). Un cliente que cargaba tareas por WhatsApp o por su
// agente las veía entrar con la prioridad que había escrito MaKo —o 'media' por
// default— sin que nadie las comparara con su propio plan, sin checklist y sin razón.
//
// Mismo trato, misma doctrina: se puntúa lo NUEVO ubicándolo en la pirámide de lo que
// ya tiene (no se re-puntúa el resto), se le arma la checklist y queda RASTRO en el
// historial de cada tarjeta. Corre server-side: no depende de que el board esté abierto.
// =============================================================================

import 'server-only';
import { listTareas, listCategorias, editarTarea, type Prioridad, type ChecklistItem, type HistEntry } from './todo';
import { puntuarNuevas } from './mako-guardian';
import { checklistsParaTareas } from './checklist-coach';

/** Columna que le corresponde a un score (misma escala que el board del dueño). */
const prioridadDeScore = (s: number): Prioridad => (s >= 75 ? 'alta' : s >= 50 ? 'media' : s >= 25 ? 'baja' : 'futuro');

/** Lo que el board necesita para pintar el resultado sin recargar (y sin pisarlo). */
export type PatchCliente = {
  id: string; score?: number; scoreRazon?: string; priority?: Prioridad;
  detalle?: string; checklist?: ChecklistItem[]; historialEntry?: HistEntry;
};
export type ResultadoPerroCliente = { n: number; patches: PatchCliente[] };

/**
 * Puntúa + enriquece las tareas recién creadas del cliente. `ids` son ids de
 * experimento_tareas. `contexto` = las respuestas del wizard (los HECHOS que dio el
 * usuario). Best-effort por tarea: si una falla, las demás igual quedan.
 *
 * Devuelve los PATCHES además del conteo: sin eso, el Perro escribe en la base, el
 * navegador nunca se entera, y el próximo guardado —que sube la fila entera con el
 * estado viejo— le borra score, razón, detalle y checklist. Ese bug ya se pagó una
 * vez en el board del dueño; acá no se repite.
 */
export async function priorizarNuevasCliente(ids: number[], contexto = ''): Promise<ResultadoPerroCliente> {
  if (!ids.length) return { n: 0, patches: [] };
  const idSet = new Set(ids);
  const [todas, cats] = await Promise.all([listTareas(), listCategorias().catch(() => [])]);
  const nombreCat = new Map(cats.map((c) => [c.id, c.nombre]));

  // El proyecto viaja por NOMBRE: el Perro tiene que poder razonar "esto es de Ventas".
  const nuevas = todas.filter((t) => idSet.has(t.id)).map((t) => ({
    id: String(t.id), titulo: t.titulo, detalle: t.detalle ?? '',
    proyecto: t.categorias[0] != null ? nombreCat.get(t.categorias[0]) : undefined,
  }));
  if (!nuevas.length) return { n: 0, patches: [] };
  const existentes = todas
    .filter((t) => !idSet.has(t.id) && t.estado !== 'hecho')
    .map((t) => ({ titulo: t.titulo, score: t.score }));

  const [scoreRes, checklistRes] = await Promise.all([
    puntuarNuevas(nuevas, existentes, contexto, 'Priorización de tareas nuevas (cliente)'),
    checklistsParaTareas(nuevas.map((n) => ({ id: n.id, titulo: n.titulo, detalle: n.detalle })), 'Descripción + checklists de tareas nuevas (cliente)')
      .catch(() => ({} as Record<string, { detalle: string; items: string[] }>)),
  ]);

  const byId = new Map(scoreRes.tareas.map((t) => [t.id, t]));
  const ahora = Date.now();
  let n = 0;
  const patches: PatchCliente[] = [];
  await Promise.all(nuevas.map(async (nv) => {
    const g = byId.get(nv.id);
    const enr = checklistRes[nv.id];
    if (!g && !enr) return;
    const id = Number(nv.id);
    const actual = todas.find((t) => t.id === id);
    const patch: Parameters<typeof editarTarea>[1] = {};
    if (g) {
      patch.score = g.score;
      patch.score_razon = g.razon || null;
      patch.prioridad = prioridadDeScore(g.score);
    }
    if (enr?.detalle) patch.detalle = enr.detalle;
    if (enr?.items.length) patch.checklist = enr.items.map((text, i): ChecklistItem => ({ id: `c${ahora}${i}`, text, done: false }));
    // Rastro obligatorio: la tarjeta tiene que decir que la tocó MaKo y por qué.
    const texto = g ? `MaKo la priorizó — score ${g.score} (${g.razon || 'sin razón'})`.slice(0, 220) : 'MaKo le escribió la descripción y la checklist';
    const entrada: HistEntry = { id: `h${ahora}${id}`, ts: ahora, actor: 'ia', text: texto };
    patch.historial = [entrada, ...(actual?.historial ?? [])].slice(0, 40);
    try {
      await editarTarea(id, patch);
      n++;
      // El mismo cambio, para que el board lo pinte YA (y no lo pise al guardar).
      patches.push({
        id: nv.id,
        ...(g ? { score: g.score, scoreRazon: g.razon || '', priority: prioridadDeScore(g.score) } : {}),
        ...(enr?.detalle ? { detalle: enr.detalle } : {}),
        ...(patch.checklist ? { checklist: patch.checklist } : {}),
        historialEntry: entrada,
      });
    } catch (e) { console.error('[todo-guardian] editarTarea:', e instanceof Error ? e.message : String(e)); }
  }));
  return { n, patches };
}
