// =============================================================================
// kanban — el tablero de Tareas por ESTADO (16/10/2026): columnas, orden, lugar y filtros
// =============================================================================
// «Hacer el kanban un kanban» (Martín, sobre la reunión con Mauricio del 12/10): «el espíritu
// más importante del Kanban es el flujo… No la clasificación». Las columnas pasan de ser la
// BANDA de prioridad a ser el ESTADO (Por iniciar · En proceso · Atorada · Completada, y «No
// cumplen tu criterio» al final sólo si tiene tareas), la prioridad pasa a FILTRO y chip, y
// dentro de una columna manda el orden que dejó la mano.
//
// PURO a propósito: sin `server-only` ni `'use client'`. Lo importan el tablero de escritorio
// (BoardShell + useBoard), el del teléfono (app/m/plan/tableros.ts) y los tests. Tres copias de
// «en qué columna va y en qué lugar» son tres respuestas distintas a la misma pregunta.
//
// Las CLAVES, las etiquetas y las reglas de mover (avance, motivo) viven en lib/todo-estados.ts,
// que es lo que lee también el server de las dos mitades. Acá está lo de la PANTALLA.
// =============================================================================

import {
  columnasDelKanban, estadoTrasProgreso, etiquetaEstado, ordenEntre,
  type EstadoTarea, type ResponsableTipo,
} from '@/lib/todo-estados';
import { estadoDe, prioFiltroDe, PCOLOR, PRIOS_FILTRO, PFILTRO_LABEL, type BoardTask, type PrioFiltro } from './types';

/**
 * El color de cada columna (el punto del encabezado y el borde de arriba).
 *
 * ⚠️ NO SON LOS DE LA PRIORIDAD (`PCOLOR`), a propósito: el chip de prioridad de cada tarjeta
 * se sigue pintando con esos (rojo Alta, ámbar Media, verde Baja), y una columna verde llena
 * de chips verdes se lee como «todo esto es Baja». Gris lo que no arrancó, azul lo que se está
 * haciendo, el ámbar del aviso (`--warn`, el mismo del candado) para lo frenado, teal para lo
 * terminado y violeta para lo que el criterio no dejó pasar.
 */
export const COLOR_ESTADO: Record<EstadoTarea, string> = {
  por_hacer: '#98A0AC',
  en_curso: '#2F6FED',
  en_seguimiento: '#B4762A',
  hecho: '#0E9B8E',
  no_cumple: '#7C5CFB',
};

/** El color del chip «Sin priorizar» (los demás, `PCOLOR` de su banda). */
export const COLOR_PRIO_FILTRO: Record<PrioFiltro, string> = { ...PCOLOR, sin_priorizar: '#7A8494' };

/**
 * EL ORDEN MANUAL de una columna: `orden` ASCENDENTE (la de menor arriba), que es el que
 * escriben el alta (`ordenTope`: arriba de la columna) y el arrastre (`ordenEntre`).
 *  · sin `orden` (la tarjeta optimista que todavía no volvió del server) → ARRIBA: es donde
 *    el server la va a poner, y si cayera al fondo se vería saltar al llegar la respuesta;
 *  · empate → la MÁS NUEVA arriba (`num` mayor), igual que el alta.
 *
 * Es el orden POR DEFECTO de cada columna (decisión 2 del 16/10/2026). No ordena por fecha
 * ni por score: «que no se maneje con deadlines» y «No quiero que se ponga a definir su
 * nivel de urgencia» (Mauricio, 8/9 — 08-T51 y 08-T43).
 */
export function enOrdenManual<T extends { orden?: number; num: number }>(items: readonly T[]): T[] {
  const clave = (t: T) => (typeof t.orden === 'number' && Number.isFinite(t.orden) ? t.orden : -Infinity);
  return [...items].sort((a, b) => {
    const ka = clave(a);
    const kb = clave(b);
    if (ka !== kb) return ka < kb ? -1 : 1;
    return b.num - a.num;
  });
}

export type ColumnaEstado<T> = { estado: EstadoTarea; label: string; items: T[] };

/**
 * LAS COLUMNAS DEL KANBAN con sus tarjetas, en orden. `tablero` decide si existe «No cumplen
 * tu criterio» (sólo si el TABLERO tiene alguna, no lo que dejó el filtro: una columna que
 * aparece y desaparece al filtrar mueve el tablero entero); `visibles` es lo que se dibuja.
 * `ordenar` es el orden dentro de cada columna (por defecto, el manual).
 */
export function columnasPorEstado<T extends { estado?: EstadoTarea; progress: number; orden?: number; num: number }>(
  visibles: readonly T[],
  tablero: readonly { estado?: EstadoTarea; progress: number }[],
  ordenar: (items: T[]) => T[] = enOrdenManual,
): ColumnaEstado<T>[] {
  const hay = new Set<EstadoTarea>(tablero.map((t) => estadoDe(t)));
  for (const t of visibles) hay.add(estadoDe(t));
  return columnasDelKanban((e) => hay.has(e)).map((estado) => ({
    estado,
    label: etiquetaEstado(estado),
    items: ordenar(visibles.filter((t) => estadoDe(t) === estado)),
  }));
}

/**
 * EL `orden` DE UNA TARJETA SOLTADA en el lugar `idx` de una columna. `otros` es la columna
 * SIN la que se está moviendo, en el orden en que se dibuja. Entre la de arriba y la de abajo
 * (`ordenEntre`: el punto medio, sin renumerar a nadie).
 */
export function ordenAlSoltar(otros: readonly { orden?: number }[], idx: number): number {
  const i = Math.max(0, Math.min(idx, otros.length));
  return ordenEntre(otros[i - 1]?.orden, otros[i]?.orden);
}

/**
 * El `orden` de «arriba de todo» en una columna, con lo que ve la pantalla. Es la misma regla
 * del server (`ordenTope` / `ordenTopePlan`: el menor menos uno), para que la tarjeta movida
 * sin lugar (el dedo, el detalle) no salte cuando vuelve la respuesta.
 */
export function ordenTopeLocal(tareas: readonly { estado?: EstadoTarea; progress: number; orden?: number }[], estado: EstadoTarea, sinId?: string): number {
  let min: number | null = null;
  for (const t of tareas) {
    if ((t as { id?: string }).id === sinId || estadoDe(t) !== estado) continue;
    if (typeof t.orden === 'number' && Number.isFinite(t.orden) && (min == null || t.orden < min)) min = t.orden;
  }
  return (min ?? 0) - 1;
}

/**
 * LO QUE LE PASA A LA COLUMNA CUANDO CAMBIA EL AVANCE en la pantalla (el check de completar, el
 * slider, deshacer un avance). Es la regla del server (`estadoAlGuardar` → `estadoTrasProgreso`)
 * aplicada al estado optimista: sin esto, completar una tarjeta desde «En proceso» la dejaba
 * tachada en «En proceso» hasta el F5, porque el server movía la columna y la pantalla no.
 *  · el avance no cambió → nada (el estado explícito manda);
 *  · cambió → `estadoTrasProgreso` (el 100% completa desde donde sea; Atorada y No cumplen se
 *    quedan donde están con cualquier otro avance);
 *  · el motivo de «Atorada» sólo existe ahí.
 */
export function avanceLocal(t: { estado?: EstadoTarea; progress: number; motivoAtorada?: string | null }, progress: number): { progress: number; estado: EstadoTarea; motivoAtorada: string | null } {
  const antes = estadoDe(t);
  const estado = progress === t.progress ? antes : estadoTrasProgreso(antes, progress);
  return { progress, estado, motivoAtorada: estado === 'en_seguimiento' ? t.motivoAtorada ?? null : null };
}

// ── LOS FILTROS NUEVOS: Prioridad y Responsable (decisión 3 del 16/10/2026) ─────────

export { PRIOS_FILTRO, PFILTRO_LABEL };
export const esPrioFiltro = (v: string): v is PrioFiltro => (PRIOS_FILTRO as readonly string[]).includes(v);

/**
 * «Responsable» (Mauricio, 8/9: «filtrar por compromisos míos, compromisos de clientes»). Sale
 * de `responsable_tipo` (mig 0159), que es RELATIVO al dueño del tablero; `null` = nadie lo
 * dijo, y eso NO es «mío» (inventarlo mentiría en este mismo filtro).
 *
 * ⚠️ CUATRO OPCIONES Y NO TRES. La decisión nombra «míos / de clientes / sin asignar», pero la
 * base tiene un cuarto valor que la extracción escribe todo el tiempo (`tipoDeResponsable`,
 * lib/reunion-reparto.ts): `tercero`, alguien del equipo con email. Sin la opción, esas tareas
 * no se podrían aislar nunca y cualquier filtro las escondería sin decir por qué.
 */
export type ResponsableFiltro = ResponsableTipo | 'sin_asignar';
export const RESPONSABLES_FILTRO: readonly ResponsableFiltro[] = ['mio', 'cliente', 'tercero', 'sin_asignar'];
export const RESPONSABLE_LABEL: Record<ResponsableFiltro, string> = { mio: 'Míos', cliente: 'De clientes', tercero: 'De terceros', sin_asignar: 'Sin asignar' };
export const esResponsableFiltro = (v: string): v is ResponsableFiltro => (RESPONSABLES_FILTRO as readonly string[]).includes(v);
export const responsableFiltroDe = (t: { responsableTipo?: ResponsableTipo | null }): ResponsableFiltro => t.responsableTipo ?? 'sin_asignar';

/**
 * ¿La tarjeta pasa los dos filtros nuevos? Un `Set` vacío es «no filtres». `responsable` null =
 * el tablero no tiene ese dato (el del dueño: `plan_tareas` no guarda el responsable), y ahí el
 * filtro no se dibuja ni se aplica — un `Set` que quedó guardado en el navegador de otra visita
 * no puede esconder tarjetas detrás de un control que no está a la vista.
 */
export function pasaPrioYResponsable(
  t: Pick<BoardTask, 'score' | 'responsableTipo'>,
  prio: ReadonlySet<string>,
  responsable: ReadonlySet<string> | null,
): boolean {
  if (prio.size > 0 && !prio.has(prioFiltroDe(t))) return false;
  if (responsable && responsable.size > 0 && !responsable.has(responsableFiltroDe(t))) return false;
  return true;
}
