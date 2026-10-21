// =============================================================================
// plan-mover — mover una tarea de COLUMNA desde el teléfono, por el camino de cada tablero
// =============================================================================
// El kanban del Plan es por ESTADO desde el 16/10/2026 («hacer el kanban un kanban»), y el
// teléfono lo mueve con el mismo gesto que el CRM (mantener y arrastrar, o «Mover a…»). La
// escritura es la MISMA del arrastre de escritorio y de la API de MaKo: `moverPlanTarea`
// (dueño) / `moverTarea` (cliente), con `trasMover` adentro (Completada = 100%, sacarla de ahí
// la reabre en 0%). Acá sólo se decide el tablero y se arma la entrada del historial.
//
// ⚠️ SE RELEE EL HISTORIAL EN EL SERVER, JUSTO ANTES DE ESCRIBIR: el teléfono manda un id y una
// columna, nunca una copia de la tarea. Es el patrón de `lib/plan-marcar.ts`.
//
// ⚠️ SIN `orden`: va arriba de la columna destino (`ordenTope`), como una tarjeta recién soltada
// ahí. Y el Deshacer la devuelve a su columna —arriba—, no al lugar exacto de antes: el teléfono
// no elige lugares dentro de una columna. Pero SÍ con el avance y el motivo de antes
// (`antesAvance` / `antesMotivo`, 16/10/2026): sin ellos, deshacer un «Mover a Completada» de una
// tarea al 40% la devolvía al 0% (`avanceAlMover` reabre en 0), y una «Atorada» volvía sin motivo.
//
// ⚠️ NO TOCA la prioridad: «cuando tú muevas una tarjeta, yo no debería preguntarte cuál es la
// nueva prioridad» → «Es correcto» (Mauricio, 12/10/2026).
// =============================================================================

import 'server-only';
import { getTenantDb } from '@/lib/workspace';
import { enPlan, moverPlanTarea } from '@/lib/plan-board';
import { moverTarea } from '@/lib/todo';
import { tableroActual, type QueTablero } from '@/lib/tablero-actual';
import { esEstado, estadoDeAvance, motivoAtoradaOk, type EstadoTarea } from '@/lib/todo-estados';
import { claveDeTarea, destinoDeClave, esIdColumnaPropia, etiquetaDeClave, type ConfigColumnasPlan } from '@/lib/plan-columnas';
import { leerColumnasPlan } from '@/lib/plan-columnas-server';
import { HIST_CAP, sanearHist, type Hist } from '@/app/plan/board/types';

/** `antes` = la CLAVE de la columna de donde salió (el estado, o el id de una propia: lo que el Deshacer devuelve),
 *  con su avance y su motivo de «Atorada»; `entryId` = la entrada que escribió. */
export type ResultadoMoverTarea =
  | { ok: true; antes: string; antesAvance: number; antesMotivo: string | null; entryId: string; yaEstaba?: true }
  | { ok: false; error: string };

/** El Deshacer: la entrada a sacar del historial, y el avance y el motivo a los que vuelve (los que
 *  devolvió el mover). Sin la entrada, mover es un movimiento nuevo. */
export type DeshacerMover = { entryId: string; progreso?: number; motivo?: string | null };

const nuevoId = (): string => 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const avanceDe = (v: unknown): number => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0; };

/** Lo que el Deshacer le pasa al mover: el avance y el motivo de ANTES (`trasMover`). Un mover que
 *  no es un Deshacer no manda nada: el avance y el motivo los acomoda la regla de siempre. */
function alDeshacer(d?: DeshacerMover): { progreso?: number; motivo?: string | null } {
  if (!d?.entryId) return {};
  return {
    ...(typeof d.progreso === 'number' && Number.isFinite(d.progreso) ? { progreso: d.progreso } : {}),
    ...(d.motivo !== undefined ? { motivo: d.motivo } : {}),
  };
}

/**
 * Mueve una tarea del tablero de QUIEN MIRA a `estado`. Nunca tira: un fallo vuelve como
 * `{ ok: false, error }` con una frase corta para el toast, y el detalle va al log.
 *
 * ⚠️ NO EXIGE SESIÓN: la exige quien la llama (`app/m/plan/acciones.ts`).
 */
export async function moverDesdeElTelefono(id: string, estado: unknown, deshacer?: DeshacerMover): Promise<ResultadoMoverTarea> {
  let que: QueTablero;
  try { que = await tableroActual(); } catch (e) {
    console.error('[plan-mover] tablero:', e instanceof Error ? e.message : e);
    return { ok: false, error: 'No se pudo mover' };
  }
  return moverEnTablero(que, id, estado, deshacer);
}

/**
 * El cuerpo, con el tablero ya decidido (scripts y pruebas). En una request, `moverDesdeElTelefono`. `destino` es la
 * CLAVE de la columna (lib/plan-columnas.ts): un estado, o el id de una columna propia del negocio.
 */
export async function moverEnTablero(que: QueTablero, id: string, destino: unknown, deshacer?: DeshacerMover): Promise<ResultadoMoverTarea> {
  const limpio = String(id ?? '').trim();
  if (!limpio || limpio.length > 80) return { ok: false, error: 'Tarea inválida' };
  const clave = typeof destino === 'string' ? destino.trim() : '';
  if (!esEstado(clave) && !esIdColumnaPropia(clave)) return { ok: false, error: 'Columna inválida' };
  try {
    // Las columnas del negocio: a dónde va una propia, de dónde sale la tarea y el nombre que dice el historial.
    const config = await leerColumnasPlan();
    const d = destinoDeClave(config, clave);
    if (!d) return { ok: false, error: 'Esa columna ya no existe' };
    return que === 'dueno' ? await moverDueno(limpio, clave, d, config, deshacer) : await moverCliente(limpio, clave, d, config, deshacer);
  } catch (e) {
    console.error('[plan-mover]', que, limpio, e instanceof Error ? e.message : e);
    return { ok: false, error: 'No se pudo mover' };
  }
}

/** La entrada nueva (o la que se saca, al deshacer) y el historial que queda. Con el nombre de la columna del negocio. */
function historialAlMover(hist: Hist[], nombreDestino: string, deshacer?: DeshacerMover): { historial: Hist[]; entryId: string } {
  if (deshacer?.entryId) return { historial: hist.filter((h) => h.id !== deshacer.entryId), entryId: '' };
  const entrada: Hist = { id: nuevoId(), ts: Date.now(), actor: 'user', text: `Movió a ${nombreDestino}` };
  return { historial: [entrada, ...hist].slice(0, HIST_CAP), entryId: entrada.id };
}

type Destino = { estado: EstadoTarea; columna: string | null };

async function moverDueno(id: string, clave: string, d: Destino, config: ConfigColumnasPlan, deshacer?: DeshacerMover): Promise<ResultadoMoverTarea> {
  return enPlan(async () => {
    const db = await getTenantDb();
    // `*` y no una lista: sin la mig 0317, pedir `columna` por nombre rechaza la consulta entera (42703).
    const { data, error } = await db.from('plan_tareas').select('*').eq('id', id).limit(1);
    // «No pude leer» no es «no existe».
    if (error) { console.error('[plan-mover] leer plan_tareas:', error.message); return { ok: false as const, error: 'No se pudo leer' }; }
    const fila = (data ?? [])[0] as { estado?: unknown; progress?: unknown; motivo_atorada?: unknown; historial?: unknown; columna?: unknown } | undefined;
    if (!fila) return { ok: false as const, error: 'Ya no existe' };
    const estadoAntes: EstadoTarea = esEstado(fila.estado) ? fila.estado : estadoDeAvance(Number(fila.progress) || 0);
    const antes = claveDeTarea({ estado: estadoAntes, columna: typeof fila.columna === 'string' ? fila.columna : null }, config);
    const previo = { antes, antesAvance: avanceDe(fila.progress), antesMotivo: motivoAtoradaOk(fila.motivo_atorada) };
    if (antes === clave && !deshacer) return { ok: true as const, ...previo, entryId: '', yaEstaba: true as const };
    const h = historialAlMover(sanearHist(fila.historial), etiquetaDeClave(config, clave), deshacer);
    const r = await moverPlanTarea(id, d.estado, undefined, { historial: h.historial, columna: d.columna, ...alDeshacer(deshacer) });
    return r.ok ? { ok: true as const, ...previo, entryId: h.entryId } : { ok: false as const, error: r.error };
  });
}

async function moverCliente(id: string, clave: string, d: Destino, config: ConfigColumnasPlan, deshacer?: DeshacerMover): Promise<ResultadoMoverTarea> {
  // El id del tablero del cliente es bigint y viaja como texto: lo que no sea un entero positivo
  // no llega a la base.
  const n = Number(id);
  if (!Number.isSafeInteger(n) || n <= 0) return { ok: false, error: 'Tarea inválida' };
  const db = await getTenantDb();
  // `*` y no una lista: sin la mig 0317, pedir `columna` por nombre rechaza la consulta entera (42703).
  const { data, error } = await db.from('experimento_tareas').select('*').eq('id', n).limit(1);
  if (error) { console.error('[plan-mover] leer experimento_tareas:', error.message); return { ok: false, error: 'No se pudo leer' }; }
  const fila = (data ?? [])[0] as { estado?: unknown; progreso?: unknown; motivo_atorada?: unknown; historial?: unknown; columna?: unknown } | undefined;
  if (!fila) return { ok: false, error: 'Ya no existe' };
  const estadoAntes: EstadoTarea = esEstado(fila.estado) ? fila.estado : 'por_hacer';
  const antes = claveDeTarea({ estado: estadoAntes, columna: typeof fila.columna === 'string' ? fila.columna : null }, config);
  const previo = { antes, antesAvance: avanceDe(fila.progreso), antesMotivo: motivoAtoradaOk(fila.motivo_atorada) };
  if (antes === clave && !deshacer) return { ok: true, ...previo, entryId: '', yaEstaba: true };
  const h = historialAlMover(sanearHist(fila.historial), etiquetaDeClave(config, clave), deshacer);
  const r = await moverTarea(n, d.estado, undefined, { historial: h.historial, columna: d.columna, ...alDeshacer(deshacer) });
  return r.ok ? { ok: true, ...previo, entryId: h.entryId } : { ok: false, error: r.error };
}
