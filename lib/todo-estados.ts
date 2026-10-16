// =============================================================================
// todo-estados — los estados de una tarea del Plan: las COLUMNAS del kanban
// =============================================================================
// Sin `server-only` a propósito: lo lee el tablero para dibujar las columnas y lo
// importa el test. La base tiene el mismo juego en un CHECK, en LAS DOS mitades del
// tablero: `experimento_tareas` (mig 0159, el cliente) y `plan_tareas` (mig 0294, el
// dueño). Si se agrega uno acá y no allá, el insert falla — que es lo que tiene que pasar.
//
// Las CLAVES no se renombran nunca: cambian las ETIQUETAS. Ya pasó dos veces.
//   · 08-T49 (09/2026): Mauricio pidió columnas por estado → «Nuevas / En seguimiento /
//     Concluidas».
//   · 16/10/2026, «hacer el kanban un kanban» (reunión Fathom 191993679 del 12/10): «el
//     espíritu más importante del Kanban es el flujo… No la clasificación». Columnas
//     acordadas: «por iniciar… en proceso… atorada y resuelta o ya completada». Así que
//     `por_hacer` se muestra «Por iniciar», `en_seguimiento` se muestra «Atorada» («porque
//     el cliente no da o porque yo no tengo dinero… o los recursos») y `hecho`
//     «Completada». El valor en la base sigue siendo el mismo: 212 filas del ws1 y ~10
//     lectores lo usan, y renombrar una clave es una migración para cambiar una palabra.
// =============================================================================

export type EstadoTarea = 'no_cumple' | 'por_hacer' | 'en_curso' | 'en_seguimiento' | 'hecho';

/**
 * En el orden en que se dibujan las columnas, de izquierda a derecha (decisión 1 del
 * 16/10/2026): Por iniciar · En proceso · Atorada · Completada, y «No cumplen tu criterio»
 * AL FINAL — y sólo si tiene tareas (`columnasDelKanban`). Hasta el 16/10 iba primera: era
 * la bandeja de lo que la extracción no dejó pasar; ahora es lo último que se mira.
 */
export const ESTADOS: ReadonlyArray<{ key: EstadoTarea; label: string }> = [
  { key: 'por_hacer', label: 'Por iniciar' },
  { key: 'en_curso', label: 'En proceso' },
  { key: 'en_seguimiento', label: 'Atorada' },
  { key: 'hecho', label: 'Completada' },
  { key: 'no_cumple', label: 'No cumplen tu criterio' },
];

export const esEstado = (e: unknown): e is EstadoTarea => ESTADOS.some((s) => s.key === e);

/** La etiqueta que se DIBUJA de un estado. Una sola fuente: la pantalla, la API y el historial. */
export const etiquetaEstado = (e: EstadoTarea): string => ESTADOS.find((s) => s.key === e)?.label ?? e;

/**
 * Las columnas del kanban, en orden. `no_cumple` aparece SÓLO si tiene tareas: es la columna
 * de lo que el criterio no dejó pasar (Mauricio, 8/9: «una columna dentro del Kanban que dice
 * tareas que no cumplieron tu criterio»), y vacía es una columna que ocupa un quinto del ancho
 * para decir nada. Las otras cuatro están siempre, vacías o no: son el FLUJO, y una columna de
 * flujo que aparece y desaparece mueve todo el tablero cada vez que alguien arrastra.
 */
export function columnasDelKanban(tieneTareas: (e: EstadoTarea) => boolean): EstadoTarea[] {
  return ESTADOS.map((s) => s.key).filter((k) => k !== 'no_cumple' || tieneTareas(k));
}

/**
 * ¿Es trabajo que alguien tiene que hacer? Es lo que antes se preguntaba con
 * `estado !== 'hecho'`, y con `no_cumple` esa pregunta dejó de alcanzar: una tarea
 * que el criterio no dejó pasar NO es un pendiente. Si se contara, el Perro la
 * puntuaría, el agente la listaría como abierta y el contador de /general la sumaría
 * — justo lo que el criterio existe para evitar.
 * `en_seguimiento` («Atorada») SÍ es pendiente: está frenada por algo de afuera (el
 * cliente, la plata, los recursos), pero no está terminada.
 */
export const estaPendiente = (e: EstadoTarea): boolean => e !== 'hecho' && e !== 'no_cumple';

/** Los que NO son pendientes, para filtrar en la base: `.not('estado', 'in', …)`. */
export const NO_PENDIENTES_SQL = '(hecho,no_cumple)';

/**
 * El estado que le corresponde a un avance cuando NO hay ningún estado decidido: una fila
 * nueva sin estado, o una fila vieja del dueño de antes de la mig 0294. Es la MISMA regla
 * que el backfill de esa migración (100→hecho, >0→en_curso, resto→por_hacer), y el test la
 * cruza contra el SQL.
 */
export const estadoDeAvance = (progreso: number): EstadoTarea =>
  progreso >= 100 ? 'hecho' : progreso > 0 ? 'en_curso' : 'por_hacer';

/**
 * El estado después de tocar el avance. Pero esa derivación solo sabe de los tres estados
 * de siempre, y aplicada a ciegas se come los otros dos:
 *
 *  · `no_cumple` + avance al 40% → saldría a «En proceso». Sería PROMOVER una tarea
 *    que el criterio no dejó pasar sin que nadie lo decida — y Mauricio pidió que
 *    promover pida un motivo. Se queda donde está.
 *  · `en_seguimiento` («Atorada») + avance → saldría a «En proceso» y se perdería que
 *    está frenada por algo de afuera. Se queda.
 *
 * El 100% sí manda desde cualquier lado: terminada es un HECHO, no una decisión de
 * criterio. (Es lo que hace el cierre automático por señales, lib/todo-seeds.ts.)
 *
 * ⚠️ ESTO SÓLO SE APLICA CUANDO EL AVANCE CAMBIA (`estadoAlGuardar`). Aplicado en cada
 * guardado, devolvía de columna una tarjeta movida a mano en cuanto alguien le editaba el
 * título (16/10/2026: el tablero mandaba el avance en cada guardado aunque no se hubiera
 * tocado).
 */
export function estadoTrasProgreso(actual: EstadoTarea, progreso: number): EstadoTarea {
  if (progreso >= 100) return 'hecho';
  if (actual === 'no_cumple' || actual === 'en_seguimiento') return actual;
  return progreso > 0 ? 'en_curso' : 'por_hacer';
}

/**
 * EL ESTADO AL GUARDAR UNA TAREA QUE YA EXISTE: el estado explícito MANDA, y el avance lo
 * mueve SÓLO SI EL AVANCE CAMBIÓ respecto de lo guardado (decisión 10 del 16/10/2026).
 *
 * Por qué hace falta, medido sobre el código del 16/10: `editPatch` (app/plan/TodoBoard.tsx)
 * mandaba `progreso` en CADA guardado —es el objeto entero de la tarjeta— y `editarTarea`
 * recalculaba el estado desde el avance cada vez que venía. Con columnas de prioridad no se
 * notaba (el estado no se dibujaba); con columnas de ESTADO, arrastrar una tarjeta de 0% a
 * «En proceso» y después corregirle una tilde del título la devolvía a «Por iniciar». Un
 * kanban que deshace los arrastres solo no es un kanban.
 *
 * La pregunta «¿cambió el avance?» se contesta contra la FILA GUARDADA, nunca contra lo que
 * manda el navegador: el navegador no sabe qué hay en la base (otra pestaña, MaKo, la API).
 */
export function estadoAlGuardar(guardado: { estado: EstadoTarea; progreso: number }, progreso: number): EstadoTarea {
  if (progreso === guardado.progreso) return guardado.estado;
  return estadoTrasProgreso(guardado.estado, progreso);
}

/**
 * El avance en el patch de un GUARDADO del tablero del cliente: sólo si cambió respecto del
 * último que confirmó la base (`editPatch`, app/plan/TodoBoard.tsx). `guardado` desconocido →
 * va, y decide el server con `estadoAlGuardar`.
 */
export const avanceSiCambio = (progreso: number, guardado?: number): { progreso?: number } =>
  guardado === undefined || guardado !== progreso ? { progreso } : {};

/**
 * EL AVANCE AL MOVER una tarjeta de columna. El estado lo decidió la persona; el avance se
 * acomoda para que los dos no se contradigan:
 *  · a «Completada» → 100%, siempre: completada es un hecho y el 100% es lo que leen TODOS
 *    los que preguntan «¿está terminada?» (`progress < 100` en el reparto, las vistas, la API).
 *  · DESDE «Completada» (avance 100%) a cualquier otra → 0%. Es lo mismo que «Reabrir»
 *    (`useBoard.toggleDone`, `cambioAlMarcar`): una tarjeta abierta al 100% la contaría como
 *    hecha medio sistema y como abierta el otro medio.
 *  · Entre columnas abiertas, el avance NO se toca: arrastrar a «Por iniciar» una tarea al 40%
 *    es una decisión sobre el FLUJO, no sobre cuánto se hizo.
 */
export function avanceAlMover(destino: EstadoTarea, progreso: number): number {
  if (destino === 'hecho') return 100;
  return progreso >= 100 ? 0 : progreso;
}

/** El tope del motivo de «Atorada». Es una línea que se lee en la tarjeta, no un detalle. */
export const MOTIVO_ATORADA_MAX = 140;

/**
 * El motivo de «Atorada» como se GUARDA: texto corto, una línea, o `null`. La columna tiene un
 * CHECK de largo en la base (mig 0294) — un motivo más largo se RECORTA acá en vez de hacer
 * fallar el arrastre entero.
 */
export function motivoAtoradaOk(m: unknown): string | null {
  if (typeof m !== 'string') return null;
  const s = m.replace(/\s+/g, ' ').trim();
  return s ? s.slice(0, MOTIVO_ATORADA_MAX) : null;
}

/**
 * LO QUE QUEDA DESPUÉS DE MOVER una tarjeta: estado, avance y motivo de «Atorada», en una
 * función que usan las DOS mitades del server (`moverTarea` en lib/todo.ts, `moverPlanTarea`
 * en lib/plan-board.ts) y el estado optimista del navegador. Tres copias de esta regla serían
 * tres respuestas a «¿qué avance tiene una tarjeta reabierta?».
 *
 * El motivo:
 *  · fuera de «Atorada» no existe (se borra): un motivo viejo pegado a una tarjeta que ya se
 *    destrabó diría que sigue frenada por eso;
 *  · `undefined` = «no me dijeron»: si ya estaba atorada (un reordenamiento dentro de la
 *    columna) se conserva; si recién entra, nace sin motivo;
 *  · `null` o '' lo borran; un texto lo pone (saneado por `motivoAtoradaOk`).
 */
export function trasMover(
  actual: { estado: EstadoTarea; progreso: number; motivo: string | null },
  destino: EstadoTarea,
  motivo?: unknown,
  /**
   * EL AVANCE QUE TENÍA, cuando quien mueve lo sabe: el «Deshacer» de un mover (16/10/2026). Sin
   * esto, deshacer un «Mover a Completada» de una tarea al 40% la devolvía a su columna al 0%
   * (`avanceAlMover` reabre en 0) — y el escritorio lo arreglaba con un SEGUNDO guardado que el
   * server leía como «cambió el avance» y la pasaba de «Por iniciar» a «En proceso». Va en la
   * MISMA escritura que el estado. Manda salvo que contradiga la columna: «Completada» es 100%
   * siempre, y fuera de ahí un 100% no se acepta (sería una abierta terminada).
   */
  avance?: number,
): { estado: EstadoTarea; progreso: number; motivo: string | null } {
  const dado = typeof avance === 'number' && Number.isFinite(avance) ? Math.max(0, Math.min(100, Math.round(avance))) : null;
  const progreso = destino !== 'hecho' && dado != null && dado < 100 ? dado : avanceAlMover(destino, actual.progreso);
  if (destino !== 'en_seguimiento') return { estado: destino, progreso, motivo: null };
  if (motivo === undefined) return { estado: destino, progreso, motivo: actual.estado === 'en_seguimiento' ? actual.motivo : null };
  return { estado: destino, progreso, motivo: motivoAtoradaOk(motivo) };
}

/** Lo que NO se puede mover, con la frase que se muestra. `null` = se puede. */
export const NO_SE_COMPLETA = 'Se repite: no se completa';
export function motivoParaNoMover(t: { recurrente?: boolean }, destino: EstadoTarea): string | null {
  // Lo mismo que `cambioAlMarcar` (app/plan/board/hoy.ts): lo que se repite no termina, y
  // al 100% saldría del ranking, de las vistas y del avance de su proyecto para siempre.
  if (destino === 'hecho' && t.recurrente) return NO_SE_COMPLETA;
  return null;
}

/**
 * ESTADO Y AVANCE DE UNA TAREA QUE NACE. Con estado (el «＋» de una columna crea la tarea con
 * ESE estado, decisión 4 del 16/10/2026; restaurar un borrado vuelve con el suyo), el estado
 * manda y el avance se acomoda como al mover. Sin estado, sale del avance.
 */
export function alCrear(estado: unknown, progreso: number): { estado: EstadoTarea; progreso: number } {
  const p = Math.max(0, Math.min(100, Math.round(Number.isFinite(progreso) ? progreso : 0)));
  if (esEstado(estado)) return { estado, progreso: avanceAlMover(estado, p) };
  return { estado: estadoDeAvance(p), progreso: p };
}

/**
 * EL LUGAR AL SOLTAR dentro de una columna: un `orden` entre la de arriba y la de abajo. La
 * columna ordena ASCENDENTE (la de menor `orden` arriba), así que se inserta entre dos sin
 * renumerar a nadie — es el diseño de `orden` desde las migs 0051 y 0093 (`double precision`).
 *  · sin vecinas → 0; sólo la de abajo (se soltó primera) → una menos; sólo la de arriba (se
 *    soltó última) → una más.
 *
 * ⚠️ El punto medio se parte en dos cada vez: después de ~50 inserciones en EL MISMO hueco, un
 * `double` ya no distingue los dos vecinos. Para un tablero de personas no llega; si un día
 * llega, se renumera la columna (no se cambia el tipo).
 */
export function ordenEntre(arriba?: number | null, abajo?: number | null): number {
  const a = typeof arriba === 'number' && Number.isFinite(arriba) ? arriba : null;
  const b = typeof abajo === 'number' && Number.isFinite(abajo) ? abajo : null;
  if (a != null && b != null) return a === b ? a : (a + b) / 2;
  if (b != null) return b - 1;
  if (a != null) return a + 1;
  return 0;
}

/** De quién es la tarea, RELATIVO al dueño del tablero. null = no se sabe (≠ 'mio'). */
export type ResponsableTipo = 'mio' | 'cliente' | 'tercero';
export const esResponsableTipo = (t: unknown): t is ResponsableTipo => t === 'mio' || t === 'cliente' || t === 'tercero';

export type CriterioVeredicto = 'cumple' | 'no_cumple';
