// =============================================================================
// plan-recurrentes — «se repite para siempre», en UN solo lugar
// =============================================================================
// El criterio es de Mauricio (16/07/2026): «acá lo que entran son tareas que tienen un
// inicio y tienen un fin». Una reunión de los miércoles pasa las otras tres preguntas del
// criterio —se puede completar esta semana, no es una decisión, no está hecha— y aun así
// no debería estar compitiendo en el tablero. Lo que la delata es que al cerrarla haya que
// volver a crearla.
//
// ⚠️ EN EL PRODUCTO SE LLAMA **RECURRENTES**, NUNCA «BAU». El nombre con el que nació el
// criterio se descartó a propósito —«el nombre tal vez no es muy conocido»—, así que no va
// en un rótulo, ni en un tooltip, ni en una clase. Sólo puede aparecer en un comentario que
// explique de dónde salió el criterio, como el de la migración 0163.
//
// ── POR QUÉ ESTE MÓDULO EXISTE, Y POR QUÉ NO TIENE `server-only` ──────────────────────
//
// Sin `server-only` A PROPÓSITO, como `preguntas-contrato.ts` y `app/plan/board/types.ts`:
// lo importan el servidor (el reparto diario, el Perro, los avisos), las PANTALLAS
// (`'use client'`: `piezas.tsx`, `Tablas.tsx`, el board) y el test. Si cada lado tuviera su
// propio `t.recurrente === true`, el día que la recurrencia deje de ser un booleano —una
// cadencia, una fecha de próximo ciclo— habría que tocar once archivos y uno se iba a
// quedar viejo sin que nada avisara. Nadie escribe `t.recurrente` suelto en una pantalla.
//
// ── LO QUE UNA RECURRENTE NO HACE, Y DÓNDE SE APLICA CADA COSA ────────────────────────
//
// | No hace                                  | Dónde se corta                                   |
// |------------------------------------------|--------------------------------------------------|
// | competir en el reparto diario            | `recurvarPlanOwner` (lib/plan-board.ts)          |
// | ser puntuada por el Perro                | `priorizarNuevasOwner` (lib/plan-board.ts)       |
// | ser la vara contra la que se puntúa      | `existentes` de `puntuarNuevas` (ídem)           |
// | contar como trabajo abierto del proyecto | `priorizarProyectosOwner` (ídem) · `projProgress`|
// | llevar deadline (ni quarter derivado)    | `taskToRow` (ídem) + `useBoard.setDeadline`      |
// | heredar urgencia ni bloquear a nadie     | `resolverDeps` (app/plan/board/dependencias.ts)  |
// | entrar al universo de una re-priorización| `lib/plan-reprio.ts`                             |
// | gastar tokens en «¿la cierra un commit?» | `lib/cerrar-por-commits.ts`                      |
// =============================================================================

/** Cómo se dice en pantalla. Es lo único que el usuario lee: el rótulo del chip, de la
 *  vista y del control. No se escribe a mano en ninguna pantalla. */
export const ROTULO_RECURRENTE = 'Se repite';

/**
 * Por qué una recurrente no tiene número de prioridad. Va en el mensaje que devuelve el
 * server cuando alguien intenta re-priorizarla y en el historial cuando se la marca: un
 * «no se puede» sin motivo se lee como un bug del tablero.
 */
export const PORQUE_NO_COMPITE = 'Una tarea que se repite para siempre no compite por un puesto: no tiene un fin que se pueda adelantar ni atrasar.';

/** Por qué se le saca la fecha al marcarla. Mismo criterio que el de arriba. */
export const PORQUE_SIN_FECHA = 'Lo que se repite no vence: una fecha ahí es la del próximo ciclo, no un deadline.';

/**
 * ¿Esta tarea se repite para siempre?
 *
 * ⚠️ `=== true`, no truthy. El campo llega de tres lugares con tres formas distintas —la
 * fila de Postgres (`boolean`), el estado optimista del navegador (`undefined` mientras la
 * tarea no se guardó) y el JSON de un modelo (cualquier cosa)— y en la duda la respuesta
 * correcta es NO: una tarea mal marcada como recurrente desaparece del ranking sin que
 * nadie lo haya pedido, que es mucho peor que una recurrente que todavía compite.
 */
export const esRecurrente = (t: { recurrente?: boolean }): boolean => t.recurrente === true;

/** Las que SÍ compiten: el universo de todo lo que rankea, puntúa, cuenta o vence. */
export const sinRecurrentes = <T extends { recurrente?: boolean }>(ts: T[]): T[] => ts.filter((t) => !esRecurrente(t));

/** Las que se repiten. Es el contenido de la vista «Recurrentes» y el contador del log. */
export const soloRecurrentes = <T extends { recurrente?: boolean }>(ts: T[]): T[] => ts.filter((t) => esRecurrente(t));

/**
 * ¿A esta tarea le corresponde una fecha de vencimiento?
 *
 * Existe como función y no como un `!esRecurrente(t)` escrito en cada lado porque esto es
 * una REGLA («una recurrente no lleva deadline») y no una negación cualquiera: se puede
 * grepear, y el día que aparezca un caso con fecha —una recurrente con fecha de próximo
 * ciclo— cambia acá y no en los cuatro lugares que hoy la aplican.
 *
 * ⚠️ Se aplica en el CHOKE POINT de la escritura (`taskToRow`), no sólo en el handler del
 * formulario. Es la misma lección que el Quarter pagó el 24/09/2026: la regla vivía en
 * `useBoard.setDeadline`, o sea en el único camino que pasa por el navegador, y todo lo que
 * escribe el SERVER —el Perro al priorizar, una reunión al crear la tarea, un lote— seguía
 * pasando de largo.
 */
export const llevaDeadline = (t: { recurrente?: boolean }): boolean => !esRecurrente(t);
