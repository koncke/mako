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

// =============================================================================
// CADA CUÁNTO SE REPITE (mig 0165)
// =============================================================================
// «Una tarea o proyecto recurrente se le debe eliminar el quarter y deadline, pero se debe
// dejar una casilla de "Frecuencia", algo similar a Google Calendar con una reunión que se
// puede repetir diariamente, 1 vez a la semana, 1 vez al mes, etc.» (26/09/2026).
//
// ⚠️ UNA FRECUENCIA NO ES UN DEADLINE, Y DE ESO DEPENDE TODO EL DISEÑO. Un deadline es una
// fecha que LLEGA, pasa y deja la tarea vencida; una frecuencia es un RITMO que no vence
// nunca. Por eso NO es una fecha, no se tiñe por proximidad, no titila y no entra en el
// filtro «Cuándo»: el día que alguien la guarde en `deadline` para «reusar el campo»,
// vuelve exactamente el problema que las 0163 y 0164 sacaron —el motor de vencimientos
// avisando que «la junta semanal está atrasada»— y encima con la fecha inventada por
// nosotros. El tipo es un enum cerrado justamente para que no se pueda escribir una fecha
// adentro.
// =============================================================================

/** Cada cuánto se repite. Enum CERRADO: lo que no esté acá no se guarda (`frecuenciaOk`). */
export type Frecuencia = 'diaria' | 'semanal' | 'quincenal' | 'mensual' | 'trimestral' | 'anual';

/**
 * LA LISTA, Y ES UNA SOLA. Pinta el selector Y describe el valor en cualquier otro lado
 * (el chip de la tarjeta, el historial, el JSON que lee un agente). Dos listas —una de
 * ids para guardar y otra de textos para mostrar— es cómo se muere una de las dos: se
 * agrega `bimestral` en el selector, nadie toca el traductor, y la tarjeta muestra el id
 * crudo o nada.
 *
 * ⚠️ LAS ETIQUETAS NO REPITEN «Se repite». El rótulo del campo ya lo dice
 * (`ROTULO_FRECUENCIA`), así que «Se repite cada semana» adentro del control es la misma
 * palabra dos veces en el mismo renglón. Y son de México neutro: «Todos los días», nunca
 * «Todos los dias» ni un «acá».
 */
export const FRECUENCIAS: Array<{ id: Frecuencia; label: string }> = [
  { id: 'diaria', label: 'Todos los días' },
  { id: 'semanal', label: 'Cada semana' },
  { id: 'quincenal', label: 'Cada dos semanas' },
  { id: 'mensual', label: 'Cada mes' },
  { id: 'trimestral', label: 'Cada trimestre' },
  { id: 'anual', label: 'Cada año' },
];

/** Cómo se dice en pantalla el rótulo del campo. Una palabra: es el NOMBRE de la cosa. */
export const ROTULO_FRECUENCIA = 'Frecuencia';

/**
 * EL SANEO. Lo que no esté en `FRECUENCIAS` entra como `null`, nunca como texto libre.
 *
 * La migración 0165 dejó la columna SIN `check` a propósito, así que ésta es la única
 * guarda que hay — y el campo llega de cuatro lugares con cuatro formas: el `<select>` del
 * navegador, la fila de Postgres (una fila vieja no tiene la columna), el JSON de un modelo
 * y el body de `/api/todo`. Un string libre guardado acá no da error: deja una recurrente
 * que dice «cada 15 días más o menos», que ninguna pantalla sabe pintar y que un agente
 * repite como si fuera un dato del negocio.
 *
 * ⚠️ `null` y no `undefined`: «se repite, pero nadie dijo cada cuánto» es un estado real y
 * tiene que poder ESCRIBIRSE en la columna para borrar el valor anterior. `undefined` en un
 * payload de supabase-js es una clave que no viaja, o sea que no borra nada.
 */
export const frecuenciaOk = (v: unknown): Frecuencia | null =>
  (FRECUENCIAS.find((f) => f.id === v)?.id ?? null);

/**
 * Cómo se lee una frecuencia. Sale de `FRECUENCIAS` —nunca de un segundo mapa— y `null`
 * cuando no se dijo cada cuánto, que NO es lo mismo que «no se repite».
 */
export const textoFrecuencia = (v: unknown): string | null =>
  (FRECUENCIAS.find((f) => f.id === v)?.label ?? null);

/**
 * LA INVARIANTE: UNA FRECUENCIA SIN `recurrente` NO EXISTE.
 *
 * Contesta qué frecuencia le corresponde a una tarjeta, y la respuesta para algo que no se
 * repite es `null` — o sea que **al dejar de repetirse, la frecuencia SE BORRA**. Eso es
 * una decisión, y éste es el porqué:
 *
 *  · El campo sólo se DIBUJA al lado de «Se repite». Un valor que queda guardado donde
 *    ninguna pantalla lo muestra es el «consumidor huérfano» de AGENTS.md al revés: no
 *    falla, no avisa, y el día que alguien lo lea afirma «cada semana» sobre una tarea que
 *    tiene deadline y vence. La API de MaKo lo expone al lado de `se_repite`; una fila con
 *    `recurrente: false` y `frecuencia: 'semanal'` es exactamente esa mentira esperando.
 *  · Lo que se gana conservándolo es un click si alguien desmarca por error, y ese click ya
 *    está cubierto: los dos choke points del navegador guardan el valor ANTERIOR. En un
 *    PROYECTO las dos cosas viajan en una sola entrada (`patchLabelLog`), así que un solo
 *    deshacer las devuelve juntas. En una TAREA son dos entradas —«Ya no se repite» y «Sin
 *    frecuencia»—, exactamente igual que cuando marcarla le saca el deadline y el quarter:
 *    el toast ofrece la del usuario y la otra queda en el historial, que es de donde se
 *    revierte. No es un olvido, es el mismo criterio de `setRecurrente`: dos toasts encima
 *    del mismo click son dos oportunidades de deshacer la mitad equivocada.
 *  · Y va acá —en una función que aplican los MAPPERS— y no en el handler del formulario,
 *    por la lección que ya pagaron el Quarter y el deadline: por `taskToRow`/`labelToRow`
 *    pasan TODAS las escrituras, incluidas las del Perro, las de una reunión y las de un
 *    lote, y ninguna de esas tres abre un navegador.
 *
 * Acepta `frecuencia?: unknown` para poder aplicarse también sobre una fila cruda de
 * Postgres: si exigiera el tipo ya saneado, el mapper de lectura tendría que sanear por su
 * cuenta y ahí nace la segunda copia de la regla.
 */
export const frecuenciaDe = (t: { recurrente?: boolean; frecuencia?: unknown }): Frecuencia | null =>
  (esRecurrente(t) ? frecuenciaOk(t.frecuencia) : null);
