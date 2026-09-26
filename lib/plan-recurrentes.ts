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

// =============================================================================
// ¿QUÉ DÍA? — EL ANCLA DE LA FRECUENCIA (mig 0166)
// =============================================================================
// «La frecuencia debe poder configurarse como Google Calendar, es decir, si es 1 vez a la
// semana ¿qué día? y así» (26/09/2026).
//
// La 0165 dejó el RITMO y le faltaba el ANCLA: «cada semana» no distingue la junta de los
// lunes de la de los viernes, que en el calendario de cualquiera son dos cosas distintas, y
// sin ella la tarjeta no alcanza para saber si algo cae hoy.
//
// ⚠️ UN SOLO CAMPO (`frecuencia_dia`), LEÍDO SEGÚN LA FRECUENCIA. No son dos columnas
// —día-de-semana y día-del-mes— y eso es LA decisión de la migración: una recurrente tiene
// UNA frecuencia por vez, así que con dos columnas pasar de «cada semana» a «cada mes» deja
// la vieja viva contradiciendo a la nueva. Es el mismo modo de falla del `deadline` que
// sobrevivía a marcar una tarea recurrente, y el que la 0163 vino a cortar.
//
//   semanal | quincenal            → 'lun' … 'dom'
//   mensual | trimestral | anual   → '1' … '31' (día del mes)
//   diaria                         → null (todos los días no tiene ancla)
//   sin frecuencia                 → null
// =============================================================================

/** Los días de la semana, en el orden en que se leen. Enum CERRADO como `Frecuencia`. */
export type DiaSemana = 'lun' | 'mar' | 'mie' | 'jue' | 'vie' | 'sab' | 'dom';

/**
 * LA LISTA, Y ES UNA SOLA. Pinta el selector (`label`), la tabla y el chip (`corto`) y
 * describe el valor en cualquier otro lado. Dos listas —una de ids y otra de textos— es
 * cómo se muere una de las dos, exactamente igual que en `FRECUENCIAS`.
 *
 * ⚠️ EL PLURAL NO ES UNA CUARTA COLUMNA: se DERIVA (`enPlural`). En español los días que
 * terminan en `s` son invariables (lunes … viernes) y los otros dos suman una: es una regla
 * regular, y escribirla como lista sería la segunda lista que esta lista viene a evitar.
 *
 * ⚠️ Y LOS IDS VAN SIN ACENTO (`mie`, `sab`) a propósito: son la CLAVE que se guarda en la
 * columna, y una clave con acento se compara distinto según cómo la normalice quien la
 * escriba (NFC/NFD). El acento vive en el texto que se lee, que es donde importa.
 */
export const DIAS_SEMANA: Array<{ id: DiaSemana; label: string; corto: string }> = [
  { id: 'lun', label: 'Lunes', corto: 'Lun' },
  { id: 'mar', label: 'Martes', corto: 'Mar' },
  { id: 'mie', label: 'Miércoles', corto: 'Mié' },
  { id: 'jue', label: 'Jueves', corto: 'Jue' },
  { id: 'vie', label: 'Viernes', corto: 'Vie' },
  { id: 'sab', label: 'Sábado', corto: 'Sáb' },
  { id: 'dom', label: 'Domingo', corto: 'Dom' },
];

/** El día del mes más alto que se puede elegir. 31 y no 28: el ancla es «el 31 de cada
 *  mes», y qué hace febrero con eso es una pregunta del calendario, no del campo. */
export const DIA_MES_MAX = 31;

/**
 * QUÉ ANCLA PIDE UNA FRECUENCIA. `'semana'` = un día de la semana, `'mes'` = un día del
 * mes, `null` = ninguna (todos los días no tiene día, y sin frecuencia no hay nada).
 *
 * ⚠️ ES UN `Record` Y NO UN `switch` CON DEFAULT, y eso es la guarda: el día que
 * `Frecuencia` sume `'bimestral'`, el compilador exige decidir qué ancla pide. Un `switch`
 * con `default: null` lo dejaría entrar mudo —una frecuencia nueva sin día, sin error y sin
 * que nadie se entere—, que es el modo de falla que este archivo persigue en todos lados.
 * El `?? null` cubre lo que el tipo no puede: una lista ampliada en runtime.
 */
const ANCLA: Record<Frecuencia, 'semana' | 'mes' | null> = {
  diaria: null,
  semanal: 'semana',
  quincenal: 'semana',
  mensual: 'mes',
  trimestral: 'mes',
  anual: 'mes',
};
export const pideDia = (f: unknown): 'semana' | 'mes' | null => {
  const ok = frecuenciaOk(f);
  return ok ? (ANCLA[ok] ?? null) : null;
};

/**
 * EL SANEO DEL DÍA, Y **DEPENDE DE LA FRECUENCIA**. Lo que no corresponda entra como
 * `null`, nunca como texto libre — la columna de la 0166 tampoco tiene `check`, así que
 * ésta es la única guarda que existe.
 *
 * ⚠️ **CAMBIAR LA FRECUENCIA INVALIDA EL DÍA, Y ESO ES UNA DECISIÓN.** Pasar de «cada
 * semana, los lunes» a «cada mes» deja un `'lun'` que, leído como día del mes, no es ningún
 * día: no hay forma de pintarlo, y ninguna de las dos lecturas posibles es la que alguien
 * eligió. Las tres alternativas, y por qué se descartaron:
 *
 *  · **Conservarlo** por si vuelve a «cada semana». Es el `deadline` que sobrevivía a
 *    marcar una recurrente, otra vez: un valor guardado donde ninguna pantalla lo muestra,
 *    que la API de MaKo sí publica, y que reaparece semanas después afirmando un día que
 *    nadie eligió hoy. Lo que se gana es un click; lo que se pierde es poder creerle al
 *    campo.
 *  · **Traducirlo** («los lunes» → «el 1»). Inventa un dato que nadie dijo, y plausible.
 *  · **Rechazar el cambio de frecuencia** hasta que se elija un día nuevo. Es el candado
 *    sin llave: frena por algo que no se arregla haciendo lo que el control pide.
 *
 * Así que se BORRA, y se borra acá —en la función que aplican los mappers— y no en el
 * handler del formulario, por la lección que ya pagaron el Quarter, el deadline y la
 * frecuencia: por `taskToRow`/`labelToRow` y por los dos `editar` del cliente pasan TODAS
 * las escrituras, incluidas las del Perro, las de una reunión y las de un lote.
 *
 * ⚠️ Y «SIN RECURRENTE NO HAY DÍA» NO SE ESCRIBE ACÁ: SE HEREDA. Los call sites pasan
 * `frecuenciaDe(t)` como segundo argumento, que ya devuelve `null` para lo que no se
 * repite → `pideDia(null)` → `null`. Es UNA regla —la que ya existe para la frecuencia— y
 * no dos: una segunda copia es la que se queda vieja.
 *
 * Devuelve `string` y no `DiaSemana` porque el mismo campo guarda las dos lecturas: un id
 * de día de semana o un número de día del mes. Quién es quién lo contesta `pideDia`.
 */
export const frecuenciaDiaOk = (v: unknown, f: unknown): string | null => {
  const pide = pideDia(f);
  if (!pide) return null;
  if (pide === 'semana') return DIAS_SEMANA.find((d) => d.id === v)?.id ?? null;
  // El día del mes llega como número desde el selector y como string desde la fila de
  // Postgres. `Number('')` y `Number(' ')` dan 0, que el rango descarta igual; lo que no
  // puede pasar es un `'12abc'` (NaN), un `'1.5'` ni un `true`.
  const n = typeof v === 'number' || typeof v === 'string' ? Number(v) : NaN;
  return Number.isInteger(n) && n >= 1 && n <= DIA_MES_MAX ? String(n) : null;
};

/**
 * CÓMO SE LEE, Y ES LA ÚNICA QUE ARMA LA FRASE. «Cada semana, los lunes», «Cada mes, el
 * 15», «Todos los días». `null` = no se repite, o se repite y nadie dijo cada cuánto.
 *
 * ⚠️ UNA SOLA FUNCIÓN PARA LA TARJETA, LA TABLA Y LA API. Si cada superficie escribiera su
 * propia concatenación divergen a la primera corrección — y la de la API es la que peor
 * envejece, porque la lee un modelo y no la mira nadie. Es la misma razón por la que
 * `textoFrecuencia` sale de `FRECUENCIAS` y no de un segundo mapa.
 *
 * ⚠️ EL DÍA SE VUELVE A SANEAR ACÁ. Esto se aplica también sobre filas crudas y sobre el
 * estado optimista del navegador, donde el día puede estar todavía desalineado de una
 * frecuencia que se acaba de cambiar: «Cada mes, el lun» es peor que no decir el día.
 */
const enPlural = (s: string): string => (s.endsWith('s') ? s : `${s}s`);

/**
 * EL ANCLA EN PALABRAS, CON SU ARTÍCULO: «los lunes», «el 15». `null` cuando esa
 * frecuencia no pide día, o cuando el que hay no le corresponde.
 *
 * Es el PEDAZO, y existe como función para que `textoCuando` y `textoDia` no lo escriban
 * cada uno: son la frase entera y su recorte, no dos traducciones. El artículo va acá
 * adentro porque es lo único que cambia entre las dos lecturas del mismo campo.
 */
const ancla = (f: unknown, dia: unknown): string | null => {
  const d = frecuenciaDiaOk(dia, f);
  if (!d) return null;
  if (pideDia(f) === 'mes') return `el ${d}`;
  const nombre = DIAS_SEMANA.find((x) => x.id === d)?.label;
  return nombre ? `los ${enPlural(nombre.toLowerCase())}` : null;
};

/**
 * CÓMO SE LEE, Y ES LA ÚNICA QUE ARMA LA FRASE. «Cada semana, los lunes», «Cada mes, el
 * 15», «Todos los días». `null` = no se repite, o se repite y nadie dijo cada cuánto.
 *
 * ⚠️ UNA SOLA FUNCIÓN PARA LA TARJETA, LA TABLA Y LA API. Si cada superficie escribiera su
 * propia concatenación divergen a la primera corrección — y la de la API es la que peor
 * envejece, porque la lee un modelo y no la mira nadie. Es la misma razón por la que
 * `textoFrecuencia` sale de `FRECUENCIAS` y no de un segundo mapa.
 *
 * ⚠️ EL DÍA SE VUELVE A SANEAR ACÁ (adentro de `ancla`). Esto se aplica también sobre
 * filas crudas y sobre el estado optimista del navegador, donde el día puede estar todavía
 * desalineado de una frecuencia que se acaba de cambiar: «Cada mes, el lun» es peor que no
 * decir el día.
 */
export const textoCuando = (f: unknown, dia?: unknown): string | null => {
  const base = textoFrecuencia(f);
  if (!base) return null;
  const a = ancla(f, dia);
  return a ? `${base}, ${a}` : base;
};

/**
 * SÓLO EL DÍA, PARA CUANDO EL RITMO YA ESTÁ DICHO AL LADO: «Los lunes», «El 15».
 *
 * ⚠️ EXISTE POR EL TECHO DEL TOAST, no por gusto. El deshacer tiene 3-4 palabras escritas
 * como regla de la casa, y «Cada dos semanas, los miércoles» son cinco: en una barra de 5
 * segundos encima de la pantalla, el ritmo que la persona NO acaba de tocar es justo lo
 * que sobra. Lo mismo vale para una columna angosta o un chip.
 *
 * ⚠️ Y NO ES UNA SEGUNDA TRADUCCIÓN: comparte `ancla` con `textoCuando`, así que el día
 * se convierte en palabras en UN solo lugar. Lo único propio es la mayúscula inicial, que
 * es lo que cambia entre «Cada semana, los lunes» y un renglón que empieza en el día.
 */
export const textoDia = (f: unknown, dia: unknown): string | null => {
  const a = ancla(f, dia);
  return a ? a[0].toUpperCase() + a.slice(1) : null;
};

/** Cómo se dice en pantalla el rótulo del campo. Una palabra, el NOMBRE de la cosa: el
 *  «¿cada cuánto?» ya lo contesta el control de al lado (`ROTULO_FRECUENCIA`). */
export const ROTULO_DIA = 'Día';
