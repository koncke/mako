import 'server-only';

// =============================================================================
// reunion-cruce — el cruce anti-duplicados de un borrador, del lado del SERVER
// =============================================================================
// 16/10/2026, «Fathom sin fricción» (decisión 7 de «hacer el kanban un kanban»): el cruce con IA
// contra el tablero sale del modal. Corre en el cron después de `crearPropuesta`
// (lib/reunion-auto.ts), al final de la lectura en segundo plano de una reunión o un archivo, y en
// un barrido de los borradores pendientes que quedaron sin sellar. El modal ya no lo corre ni lo
// espera: «Agregar» está siempre habilitado.
//
// La regla de qué se marca y cómo vive en lib/cruce-borrador.ts (pura, con test). Acá: las
// lecturas, la llamada al modelo y el sello (`guardarRevision(id, tareas, true)` → `cruzado_at`).
//
// ⚠️ EL SELLO SE ESCRIBE AUNQUE NO HAYA ENCONTRADO NADA, y NO se escribe si el modelo falló. «Ya se
// cruzó y no encontró nada» y «todavía no se cruzó» son distintos: el segundo lo vuelve a intentar
// el barrido de la próxima corrida; el primero no se vuelve a pagar nunca.
//
// El Plan NUNCA paga IA: `cruzarCandidatas` va por `chatClaude` con la feature `mako-guardian`, que
// está en FEATURES_DEL_PLAN (lib/veto-claude.ts) — la misma llamada que hacía el modal, movida de
// lugar, no una nueva.
// =============================================================================

import { getPropuesta, guardarRevision, listPropuestasPendientes, type PropuestaTarea } from './plan-propuesta';
import { cruzarCandidatas } from './mako-guardian';
import { listPlanBoard } from './plan-board';
import { listTareas } from './todo';
import { getWorkspace, getWorkspaceActual } from './workspace';
import { tableroDeCapa } from './tablero-de-capa';
import { candidatasDelCruce, aplicarCruces, PREFIJO_BORRADOR, type ItemUniverso } from './cruce-borrador';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Lo que hay que tener libre para animarse a cruzar UN borrador: una llamada del Perro con su
 *  techo (`maxTokens: 4000`, ~40 s medidos en el modal) y margen para escribir. */
export const CRUCE_MS = 60_000;

/** Las tareas ABIERTAS del tablero de este workspace, con su detalle (el modelo lo lee). La misma
 *  vara que el anti-duplicado de `aplicarPropuestas` (`progress < 100`): el id que marque el cruce
 *  tiene que existir del otro lado. */
async function abiertasConDetalle(): Promise<ItemUniverso[]> {
  const ws = await getWorkspaceActual();
  const duenio = ws != null && tableroDeCapa((await getWorkspace(ws))?.capa) === 'dueno';
  if (duenio) return (await listPlanBoard()).tareas.filter((t) => t.progress < 100).map((t) => ({ id: t.id, titulo: t.title, detalle: t.detalle ?? '' }));
  return (await listTareas()).filter((t) => t.progreso < 100).map((t) => ({ id: String(t.id), titulo: t.titulo, detalle: t.detalle ?? '' }));
}

export type ResultadoCruce = { sellado: boolean; marcadas: number; conIA: boolean; motivo?: string };

/** Lo que hace falta para escribir un cruce: contra qué se cruzó y qué devolvió el modelo. */
type Cruce = { candidatas: PropuestaTarea[]; universo: ItemUniverso[]; cruces: Parameters<typeof aplicarCruces>[2] };

/**
 * EL CRUCE EN SÍ, sin escribir nada: contra el tablero y contra los otros borradores pendientes (la
 * misma reunión grabada por dos personas llega como dos borradores). `corrio: false` = no se pudo
 * (no hay que sellar); `cruce: null` con `corrio: true` = no había nada que cruzar (se sella igual).
 */
async function hacerCruce(tareas: PropuestaTarea[], opts: { excluirId?: string; hasta?: number; etiqueta: string }): Promise<{ corrio: boolean; cruce: Cruce | null; conIA: boolean; motivo?: string }> {
  const candidatas = candidatasDelCruce(tareas);
  const [delTablero, otros] = await Promise.all([
    abiertasConDetalle().catch((e) => { console.error(`[reunion-cruce] ${opts.etiqueta}: no pude leer el tablero (${msg(e)})`); return null; }),
    listPropuestasPendientes(8).catch(() => []),
  ]);
  // «No pude leer el tablero» NO es «el tablero está vacío»: sellar ahí diría «se cruzó y no
  // encontró nada» sobre un cruce que no se hizo.
  if (delTablero == null) return { corrio: false, cruce: null, conIA: false, motivo: 'no pude leer el tablero' };
  const deOtrosBorradores: ItemUniverso[] = otros
    .filter((p) => p.id !== opts.excluirId)
    .flatMap((p) => p.tareas.filter((t) => !t.esDeOtro))
    .map((t, k) => ({ id: `${PREFIJO_BORRADOR}${k}`, titulo: t.titulo, detalle: t.detalle ?? '' }));
  const universo = [...delTablero, ...deOtrosBorradores];
  // Nada que cruzar, o nada contra qué: se sella SIN IA.
  if (!candidatas.length || !universo.length) return { corrio: true, cruce: null, conIA: false, motivo: 'nada que cruzar' };
  if (opts.hasta != null && Date.now() + CRUCE_MS > opts.hasta) {
    return { corrio: false, cruce: null, conIA: false, motivo: 'sin tiempo en esta corrida' };
  }
  try {
    const out = await cruzarCandidatas(
      candidatas.map((t) => ({ titulo: t.titulo, detalle: t.detalle ?? '' })),
      universo,
      'Cruzar el borrador de una reunión con el plan (en segundo plano)',
      opts.hasta,
    );
    return { corrio: true, cruce: { candidatas, universo, cruces: out.cruces }, conIA: true };
  } catch (e) {
    console.error(`[reunion-cruce] ${opts.etiqueta}: el cruce falló (${msg(e)}) — queda SIN sellar, lo reintenta el barrido`);
    return { corrio: false, cruce: null, conIA: true, motivo: msg(e) };
  }
}

/**
 * CRUZA LAS TAREAS ANTES DE QUE EL BORRADOR SE VEA (16/10/2026, revisión adversarial). Las tres
 * lecturas —el cron, la de una reunión a mano y la de archivos— dejaban el borrador «pendiente» y
 * RECIÉN DESPUÉS lo cruzaban (hasta ~60 s). En esa ventana el modal lo tomaba sin el cruce, su
 * autosave lo guardaba sin la marca `enriquece` (con el sello ya puesto, así que nadie volvía a
 * cruzarlo), y «Cargar» creaba la tarjeta duplicada. Ahora las tres cruzan acá, en memoria, y
 * escriben tareas y sello en la MISMA escritura que las hace visibles. `cruzado: false` = no se pudo
 * (sin tiempo, el modelo no contestó): el borrador sale sin sello y lo cruza el barrido.
 */
export async function cruzarTareas(tareas: PropuestaTarea[], opts: { excluirId?: string; hasta?: number } = {}): Promise<{ tareas: PropuestaTarea[]; cruzado: boolean; marcadas: number; motivo?: string }> {
  const r = await hacerCruce(tareas, { ...opts, etiqueta: opts.excluirId ?? 'lectura' });
  if (!r.corrio) return { tareas, cruzado: false, marcadas: 0, motivo: r.motivo };
  if (!r.cruce) return { tareas, cruzado: true, marcadas: 0, motivo: r.motivo };
  const out = aplicarCruces(tareas, r.cruce.candidatas, r.cruce.cruces, r.cruce.universo);
  return { tareas: out.tareas, cruzado: true, marcadas: out.marcadas };
}

/**
 * Cruza UN borrador pendiente que ya está a la vista (el barrido: el cruce de la lectura falló o no
 * entró en el reloj) y lo sella. Corre en el workspace del contexto: quien llama envuelve con
 * `runWithWorkspace`.
 */
export async function cruzarBorrador(id: string, opts: { hasta?: number } = {}): Promise<ResultadoCruce> {
  const prop = await getPropuesta(id);
  if (!prop || prop.estado !== 'pendiente') return { sellado: false, marcadas: 0, conIA: false, motivo: 'el borrador no está pendiente' };
  if (prop.cruzadoAt) return { sellado: true, marcadas: 0, conIA: false, motivo: 'ya estaba cruzado' };
  const r = await hacerCruce(prop.tareas, { excluirId: id, hasta: opts.hasta, etiqueta: id });
  if (!r.corrio) return { sellado: false, marcadas: 0, conIA: r.conIA, motivo: r.motivo };
  if (!r.cruce) {
    const ok = await guardarRevision(id, prop.tareas, true);
    return { sellado: ok, marcadas: 0, conIA: false, motivo: ok ? 'nada que cruzar' : 'no pude sellar' };
  }
  // Se RELEE antes de escribir: mientras el modelo pensaba, alguien pudo corregir la revisión.
  const fresca = await getPropuesta(id);
  if (!fresca || fresca.estado !== 'pendiente') return { sellado: false, marcadas: 0, conIA: true, motivo: 'el borrador cambió de estado mientras se cruzaba' };
  const { tareas, marcadas } = aplicarCruces(fresca.tareas as PropuestaTarea[], r.cruce.candidatas, r.cruce.cruces, r.cruce.universo);
  const ok = await guardarRevision(id, tareas, true);
  if (marcadas) console.log(`[reunion-cruce] ${id}: ${marcadas} tarea(s) ya estaban (en el plan o en otro borrador)`);
  return { sellado: ok, marcadas, conIA: true, motivo: ok ? undefined : 'no pude sellar' };
}

/**
 * EL BARRIDO: los borradores pendientes que todavía no se cruzaron (el cruce falló, no entró en el
 * reloj, o los dejó un camino que no cruza, como WhatsApp). Tope `max` por corrida y el mismo reloj.
 */
export async function cruzarPendientes(opts: { hasta?: number; max?: number } = {}): Promise<{ cruzados: number; fallidos: number; marcadas: number }> {
  const max = opts.max ?? 3;
  const out = { cruzados: 0, fallidos: 0, marcadas: 0 };
  const pendientes = (await listPropuestasPendientes(8).catch(() => []))
    .filter((p) => !p.cruzadoAt && p.tareas.some((t) => !t.esDeOtro && !t.enriquece));
  for (const p of pendientes.slice(0, max)) {
    if (opts.hasta != null && Date.now() + CRUCE_MS > opts.hasta) break;
    const r = await cruzarBorrador(p.id, opts).catch((e) => ({ sellado: false, marcadas: 0, conIA: false, motivo: msg(e) }));
    if (r.sellado) { out.cruzados += 1; out.marcadas += r.marcadas; } else out.fallidos += 1;
  }
  return out;
}
