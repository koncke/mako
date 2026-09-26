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
// CÓMO SE REPITE — UNA RRULE DE RFC 5545, QUE ES LO QUE GUARDA GOOGLE (mig 0167)
// =============================================================================
// «El tema de la frecuencia, copialo tal cual como lo hace Google Calendar… porque puede
// ser personalizado, varios días de la semana, etc. Pero más simple, investiga y copialo
// tal cual» (26/09/2026).
//
// LO QUE TIENE EL DIÁLOGO «PERSONALIZADO» DE GOOGLE, que es lo que hay que copiar:
//   1. «Repetir cada [N] [día | semana | mes | año]»                 → FREQ + INTERVAL
//   2. si la unidad es SEMANA, VARIOS días a la vez (L M M J V S D)  → BYDAY
//   3. si es MES, «el día 15» O «el segundo martes»                  → BYMONTHDAY | BYDAY+BYSETPOS
//   4. «Termina: nunca / el [fecha] / después de [N] repeticiones»   → UNTIL | COUNT
//
// ⚠️ EL PUNTO 4 NO SE COPIA, Y ESTÁ DECIDIDO. Nada en este producto calcula la próxima
// ocurrencia: la repetición es una ETIQUETA — no dispara el reparto diario, ni un aviso, ni
// un recordatorio. «Después de 12 repeticiones» sería un dato que nadie lee nunca y un
// control que no hace nada, que es justo lo que la casa prohíbe. Vuelve el día que la
// recurrencia GENERE algo, y ese día `UNTIL`/`COUNT` se suman acá y en ningún otro lado.
//
// ── POR QUÉ UN STRING Y NO CUATRO CAMPOS NUESTROS ────────────────────────────────────
//
// Las 0165 y 0166 modelaron esto con `frecuencia` (enum de 6) + `frecuencia_dia` (texto), y
// ese modelo NO PUEDE EXPRESAR lo que se pidió: «varios días de la semana» necesita una
// lista, «cada 3 semanas» un intervalo y «el segundo martes» un ordinal. Cada una sería
// otra columna — y una repetición tiene UNA forma por vez, así que con cuatro columnas
// pasar de «cada semana, los lunes» a «cada mes» deja las viejas vivas contradiciendo a la
// nueva. Es el mismo modo de falla del `deadline` que sobrevivía a marcar algo recurrente
// (lo que la 0163 vino a cortar), multiplicado por cuatro.
//
// La RRULE lo dice todo en un string, es un ESTÁNDAR y es lo que Google guarda por debajo,
// así que el día que esto tenga que expandirse cualquier librería lo hace sin traducir:
//   FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,FR      cada 2 semanas, lunes miércoles y viernes
//   FREQ=MONTHLY;BYMONTHDAY=15                 el día 15 de cada mes
//   FREQ=MONTHLY;BYDAY=TU;BYSETPOS=2           el segundo martes de cada mes
//
// ⚠️ Y EL MODELO VIEJO SE FUE ENTERO. `Frecuencia`, `FRECUENCIAS`, `frecuenciaOk`,
// `frecuenciaDe`, `textoFrecuencia`, `DiaSemana`, `DIAS_SEMANA`, `pideDia`,
// `frecuenciaDiaOk`, `textoDia` y `textoCuando` no quedaron «por compatibilidad»: dos
// modelos de la misma cosa es el bug que la 0167 vino a cerrar, y el que queda vivo sin
// consumidores es el que un día alguien vuelve a usar. El dato viejo ya está migrado.
// =============================================================================

/** Cada cuánto, en el vocabulario de RFC 5545. Cerrado: lo que no esté acá no se lee. */
export type Freq = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

/** Los días, con el código de dos letras de RFC 5545 — que es la CLAVE que se guarda. */
export type Dia = 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU';

/**
 * LA REPETICIÓN YA LEÍDA: la RRULE partida en las cinco piezas que este producto soporta.
 * Es la forma con la que trabaja una PANTALLA (marcar tres días es tocar `byday`); lo que
 * se GUARDA es siempre el string, y la ida y vuelta son `leerRRule` / `escribirRRule`.
 *
 * ⚠️ NO TIENE `until` NI `count` A PROPÓSITO — ver el punto 4 de acá arriba. No es un
 * olvido: un campo en este tipo es un control en la pantalla, y ese control no haría nada.
 */
export type Repeticion = {
  /** La unidad. `DAILY | WEEKLY | MONTHLY | YEARLY`. */
  freq: Freq;
  /** Cada cuántas unidades. Siempre >= 1; el `1` no se escribe en la RRULE (es el default). */
  interval: number;
  /** Qué días de la semana, en orden de semana. `[]` = ninguno. Sólo `WEEKLY` y `MONTHLY`. */
  byday: Dia[];
  /** Qué día del mes (1-31). Sólo `MONTHLY` y `YEARLY`, y sólo si no hay `byday`. */
  bymonthday: number | null;
  /** Qué ocurrencia del `byday` dentro del mes: 1…4 o -1 (el último). Sólo `MONTHLY`. */
  bysetpos: number | null;
};

/** El día del mes más alto que se puede elegir. 31 y no 28: el ancla es «el 31 de cada
 *  mes», y qué hace febrero con eso es una pregunta del calendario, no del campo. */
export const DIA_MES_MAX = 31;

/** El intervalo más alto. Es el tope de Google, y existe para que un `INTERVAL=999999`
 *  venido de un modelo o de un import entre como `1` en vez de pintarse en la tarjeta. */
export const INTERVALO_MAX = 99;

/**
 * LOS DÍAS, Y ES UNA SOLA LISTA. Pinta los botones L M M J V S D del diálogo
 * personalizado (`inicial`), la tabla y el chip (`corto`) y la frase (`label`). Dos listas
 * —una de claves y otra de textos— es cómo se muere una de las dos.
 *
 * ⚠️ EL ORDEN ES EL DE LA SEMANA, y de eso depende la frase: `escribirRRule` normaliza
 * `byday` contra este orden, así que «los viernes y lunes» sale siempre «los lunes y
 * viernes» y la misma repetición se guarda con el mismo string venga de donde venga.
 *
 * ⚠️ EL PLURAL NO ES UNA COLUMNA MÁS: se DERIVA (`enPlural`). En español los días que
 * terminan en `s` son invariables (lunes … viernes) y los otros dos suman una: es una regla
 * regular, y escribirla como lista sería la segunda lista que esta lista viene a evitar.
 *
 * ⚠️ Y LAS CLAVES SON LAS DE RFC 5545, no unas nuestras: son las que viajan adentro del
 * string que se guarda, así que traducirlas al escribir sería una tabla más para mantener.
 */
export const DIAS: Array<{ id: Dia; label: string; corto: string; inicial: string }> = [
  { id: 'MO', label: 'Lunes', corto: 'Lun', inicial: 'L' },
  { id: 'TU', label: 'Martes', corto: 'Mar', inicial: 'M' },
  { id: 'WE', label: 'Miércoles', corto: 'Mié', inicial: 'M' },
  { id: 'TH', label: 'Jueves', corto: 'Jue', inicial: 'J' },
  { id: 'FR', label: 'Viernes', corto: 'Vie', inicial: 'V' },
  { id: 'SA', label: 'Sábado', corto: 'Sáb', inicial: 'S' },
  { id: 'SU', label: 'Domingo', corto: 'Dom', inicial: 'D' },
];

/** Las unidades del «Repetir cada [N] […]», con su singular y su plural. Sale de acá la
 *  frase Y el desplegable del diálogo personalizado: una lista, no dos. */
export const UNIDADES: Array<{ id: Freq; singular: string; plural: string }> = [
  { id: 'DAILY', singular: 'día', plural: 'días' },
  { id: 'WEEKLY', singular: 'semana', plural: 'semanas' },
  { id: 'MONTHLY', singular: 'mes', plural: 'meses' },
  { id: 'YEARLY', singular: 'año', plural: 'años' },
];

/**
 * LOS ORDINALES DEL «el segundo martes», y son los cinco que ofrece Google. Van en
 * masculino apocopado (`primer`, `tercer`) porque lo único que modifican es un día de la
 * semana, que en español es masculino: «el primer lunes», nunca «el primero lunes».
 */
export const ORDINALES: Array<{ id: number; label: string }> = [
  { id: 1, label: 'primer' },
  { id: 2, label: 'segundo' },
  { id: 3, label: 'tercer' },
  { id: 4, label: 'cuarto' },
  { id: -1, label: 'último' },
];

const FREQS: Freq[] = UNIDADES.map((u) => u.id);
const ORDEN_DIAS: Dia[] = DIAS.map((d) => d.id);

/**
 * LA NORMALIZACIÓN, Y LA APLICAN LAS DOS PUNTAS. `leerRRule` la corre sobre lo que parseó y
 * `escribirRRule` sobre lo que le pasan, así que la ida y la vuelta no pueden divergir: es
 * lo que hace que `escribirRRule(leerRRule(x)) === x` valga para una regla ya canónica.
 *
 * ⚠️ LO QUE LA FRECUENCIA NO SABE LEER SE BORRA ACÁ, y es la misma decisión que ya pagó el
 * día del modelo viejo: un `BYDAY=MO` con `FREQ=MONTHLY;BYMONTHDAY=15` son dos anclas
 * contradictorias para la misma repetición, y ninguna de las dos lecturas es la que alguien
 * eligió. Gana la más específica (`byday`) y la otra desaparece, en vez de quedar viva
 * esperando a que un cambio de unidad la resucite afirmando un día que nadie dijo hoy.
 */
const normalizar = (r: Repeticion): Repeticion | null => {
  if (!FREQS.includes(r.freq)) return null;
  const n = Number(r.interval);
  const interval = Number.isInteger(n) && n >= 1 && n <= INTERVALO_MAX ? n : 1;
  // `byday` sólo tiene sentido en una repetición semanal («los lunes y miércoles») o
  // mensual («el segundo martes»). En una diaria o anual es ruido que la frase no sabe
  // decir. Se filtra CONTRA `ORDEN_DIAS` —y no se ordena la lista de entrada— para que el
  // orden de salida sea siempre el de la semana y para que un duplicado (`MO,MO`) se caiga.
  const byday = (r.freq === 'WEEKLY' || r.freq === 'MONTHLY')
    ? ORDEN_DIAS.filter((d) => (r.byday ?? []).includes(d))
    : [];
  const md = Number(r.bymonthday);
  const bymonthday = (r.freq === 'MONTHLY' || r.freq === 'YEARLY') && !byday.length
    && Number.isInteger(md) && md >= 1 && md <= DIA_MES_MAX ? md : null;
  const sp = Number(r.bysetpos);
  // Un ordinal sin día al que aplicarse no dice nada («el segundo» de qué), y fuera de una
  // repetición mensual tampoco: Google sólo lo ofrece en «cada mes».
  const bysetpos = r.freq === 'MONTHLY' && byday.length > 0 && ORDINALES.some((o) => o.id === sp) ? sp : null;
  return { freq: r.freq, interval, byday, bymonthday, bysetpos };
};

/**
 * LEER UNA RRULE. Devuelve `null` cuando no hay nada que leer: no se repite, o se repite y
 * nadie dijo cada cuánto, que es un estado real y distinto.
 *
 * ⚠️ TOLERANTE A PROPÓSITO: LO QUE NO ENTIENDE SE IGNORA, NUNCA TIRA. El string llega de
 * cuatro lugares con cuatro formas —la columna de la 0167 (que no tiene `check`: esto es la
 * única guarda), el JSON de un modelo, el body de `/api/todo` y el estado optimista del
 * navegador— y un parse que explota deja la tarjeta SIN DIBUJARSE. Una repetición que no se
 * entiende es un dato perdido; una tarjeta que no se dibuja es un tablero roto.
 *
 * Lo que tolera, y cada una existe de verdad en un `.ics` de Google o en este repo:
 *   · el prefijo `RRULE:` de un `.ics` pegado a mano
 *   · minúsculas, espacios y un `;` de más
 *   · `UNTIL` y `COUNT` (el «Termina» de Google): se ignoran, no se guardan — ver el punto 4
 *   · `WKST`, `BYMONTH` y cualquier otra parte que este producto no modela
 *   · `BYDAY=2TU`, que es como Google escribe «el segundo martes» en un `.ics`: el ordinal
 *     pegado al día se levanta y se guarda como `BYSETPOS`, que es la forma canónica de acá
 */
export const leerRRule = (s: unknown): Repeticion | null => {
  if (typeof s !== 'string') return null;
  const partes = new Map<string, string>();
  for (const trozo of s.replace(/^\s*RRULE\s*:/i, '').split(';')) {
    const i = trozo.indexOf('=');
    if (i < 0) continue;
    const k = trozo.slice(0, i).trim().toUpperCase();
    const v = trozo.slice(i + 1).trim().toUpperCase();
    // La PRIMERA gana: una RRULE con `FREQ` dos veces es inválida, y elegir la última sería
    // dejar que un apéndice pegado al final cambie lo que la regla dice.
    if (k && !partes.has(k)) partes.set(k, v);
  }
  const freq = partes.get('FREQ') as Freq | undefined;
  if (!freq || !FREQS.includes(freq)) return null;

  // `BYDAY` puede traer el ordinal pegado (`2TU`, `-1FR`). Se separa y se recuerda; si no
  // vino un `BYSETPOS` propio, ése es el ordinal.
  let pegado: number | null = null;
  const byday: Dia[] = [];
  for (const crudo of (partes.get('BYDAY') ?? '').split(',')) {
    const m = /^([+-]?\d+)?(MO|TU|WE|TH|FR|SA|SU)$/.exec(crudo.trim());
    if (!m) continue;
    if (m[1] && pegado === null) pegado = Number(m[1]);
    byday.push(m[2] as Dia);
  }
  const num = (k: string): number | null => {
    const v = (partes.get(k) ?? '').split(',')[0];
    const n = Number(v);
    return v !== '' && Number.isInteger(n) ? n : null;
  };
  return normalizar({
    freq,
    interval: num('INTERVAL') ?? 1,
    byday,
    bymonthday: num('BYMONTHDAY'),
    bysetpos: num('BYSETPOS') ?? pegado,
  });
};

/**
 * ESCRIBIR LA RRULE. `null` cuando no hay repetición que escribir.
 *
 * ⚠️ EL ORDEN DE LAS PARTES ES FIJO y el `INTERVAL=1` no se escribe: sin las dos cosas, la
 * misma repetición se guardaría con dos strings distintos según por dónde entró, y todo lo
 * que compara (el `if (next === prev)` de los choke points, un test, un índice) empezaría a
 * ver cambios donde no los hay.
 */
export const escribirRRule = (r: Repeticion | null | undefined): string | null => {
  if (!r) return null;
  const n = normalizar(r);
  if (!n) return null;
  const p = [`FREQ=${n.freq}`];
  if (n.interval > 1) p.push(`INTERVAL=${n.interval}`);
  if (n.byday.length) p.push(`BYDAY=${n.byday.join(',')}`);
  if (n.bymonthday) p.push(`BYMONTHDAY=${n.bymonthday}`);
  if (n.bysetpos) p.push(`BYSETPOS=${n.bysetpos}`);
  return p.join(';');
};

/**
 * EL SANEO DE LA COLUMNA: entra cualquier cosa, sale una RRULE canónica o `null`.
 *
 * La 0167 dejó la columna SIN `check` a propósito, así que ésta es la única guarda que hay
 * — y el valor llega del `<select>`, de una fila de Postgres, del JSON de un modelo y del
 * body de `/api/todo`. Un string libre guardado acá no da error: deja una recurrente que
 * dice «cada 15 días más o menos», que ninguna pantalla sabe pintar y que un agente repite
 * como si fuera un dato del negocio.
 *
 * ⚠️ `null` Y NO `undefined`: «se repite, pero nadie dijo cada cuánto» es un estado real y
 * tiene que poder ESCRIBIRSE en la columna para borrar el valor anterior. `undefined` en un
 * payload de supabase-js es una clave que no viaja, o sea que no borra nada.
 */
export const recurrenciaOk = (v: unknown): string | null => escribirRRule(leerRRule(v));

/**
 * LA INVARIANTE: UNA RECURRENCIA SIN `recurrente` NO EXISTE.
 *
 * Es la MISMA regla que tenía el modelo viejo, con el campo nuevo — no una segunda. Al
 * dejar de repetirse, la recurrencia SE BORRA, y ése es el porqué:
 *
 *  · El campo sólo se DIBUJA al lado de «Se repite». Un valor que queda guardado donde
 *    ninguna pantalla lo muestra es el «consumidor huérfano» de AGENTS.md al revés: no
 *    falla, no avisa, y el día que alguien lo lea afirma «cada semana» sobre una tarea que
 *    tiene deadline y vence. La API de MaKo lo publica al lado de `se_repite`; una fila con
 *    `recurrente: false` y una RRULE viva es exactamente esa mentira esperando.
 *  · Lo que se gana conservándolo es un click si alguien desmarca por error, y ese click ya
 *    está cubierto: los choke points del navegador guardan el valor ANTERIOR y el toast lo
 *    devuelve.
 *  · Y va acá —en una función que aplican los MAPPERS— y no en el handler del formulario,
 *    por la lección que ya pagaron el Quarter y el deadline: por `taskToRow`/`labelToRow` y
 *    por los dos `editar` del cliente pasan TODAS las escrituras, incluidas las del Perro,
 *    las de una reunión y las de un lote, y ninguna de esas tres abre un navegador.
 *
 * Acepta `recurrencia?: unknown` para poder aplicarse también sobre una fila cruda de
 * Postgres: si exigiera el tipo ya saneado, el mapper de lectura tendría que sanear por su
 * cuenta y ahí nace la segunda copia de la regla.
 */
export const recurrenciaDe = (t: { recurrente?: boolean; recurrencia?: unknown }): string | null =>
  (esRecurrente(t) ? recurrenciaOk(t.recurrencia) : null);

// ── LA FRASE ─────────────────────────────────────────────────────────────────────────

/** Plural de un día. Los que terminan en `s` son invariables; los otros dos suman una. */
const enPlural = (s: string): string => (s.endsWith('s') ? s : `${s}s`);

/** «lunes y miércoles» · «lunes, miércoles y viernes». Sin esto la frase sale «los
 *  lun,mie», que es un volcado de la RRULE, no una frase. */
const enumerar = (xs: string[]): string =>
  (xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`);

/** ¿Es el «Todos los días laborables (lunes a viernes)» de Google? Es un preset SUYO y por
 *  eso tiene frase propia: «Cada semana, los lunes, martes, miércoles, jueves y viernes»
 *  dice lo mismo y no entra en ninguna tarjeta. */
const esLaborable = (r: Repeticion): boolean =>
  r.freq === 'WEEKLY' && r.interval === 1 && r.byday.length === 5
  && (['MO', 'TU', 'WE', 'TH', 'FR'] as Dia[]).every((d) => r.byday.includes(d));

/** EL RITMO, SIN EL ANCLA: «Todos los días», «Cada 2 semanas», «Cada mes». */
const ritmo = (r: Repeticion): string => {
  if (esLaborable(r)) return 'Todos los días laborables';
  const u = UNIDADES.find((x) => x.id === r.freq);
  if (!u) return '';
  if (r.interval > 1) return `Cada ${r.interval} ${u.plural}`;
  return r.freq === 'DAILY' ? 'Todos los días' : `Cada ${u.singular}`;
};

/**
 * EL ANCLA EN PALABRAS, CON SU ARTÍCULO: «los lunes y miércoles», «el segundo martes», «el
 * día 15». `null` cuando esa repetición no tiene ancla.
 *
 * Es el PEDAZO, y existe como función para que la frase larga y la corta no lo escriban
 * cada una: son la misma traducción y su recorte, no dos traducciones.
 */
const ancla = (r: Repeticion): string | null => {
  if (esLaborable(r)) return null;
  const nombres = r.byday.map((id) => DIAS.find((d) => d.id === id)?.label.toLowerCase() ?? '');
  if (nombres.length) {
    const ord = r.bysetpos ? ORDINALES.find((o) => o.id === r.bysetpos)?.label : undefined;
    // Con ordinal es UNA ocurrencia («el segundo martes»), así que el día va en singular;
    // sin ordinal son todas («los martes») y va en plural. El artículo es lo único que
    // cambia entre las dos lecturas, y por eso vive acá adentro y no en cada call site.
    return ord ? `el ${ord} ${enumerar(nombres)}` : `los ${enumerar(nombres.map(enPlural))}`;
  }
  if (r.bymonthday) return `el día ${r.bymonthday}`;
  return null;
};

/**
 * CÓMO SE LEE, Y ES LA ÚNICA QUE ARMA LA FRASE. «Cada semana, los lunes y miércoles»,
 * «Cada 2 meses, el segundo martes», «Todos los días». `null` = no se repite, o se repite
 * y nadie dijo cada cuánto.
 *
 * ⚠️ UNA SOLA FUNCIÓN PARA LA TARJETA, LA TABLA, EL TOAST Y LA API. Si cada superficie
 * escribiera su propia concatenación divergen a la primera corrección — y la de la API es
 * la que peor envejece, porque la lee un modelo y no la mira nadie.
 *
 * Toma el STRING y no el `Repeticion` a propósito: así se le puede pasar la columna cruda,
 * el campo del `BoardTask` o lo que devolvió un modelo sin que cada call site parsee
 * primero (y sin que uno de ellos se olvide de sanear).
 */
export const textoRepeticion = (s: unknown): string | null => {
  const r = leerRRule(s);
  if (!r) return null;
  const a = ancla(r);
  return a ? `${ritmo(r)}, ${a}` : ritmo(r);
};

/**
 * SÓLO EL RITMO, PARA EL TOAST: «Cada 2 semanas», «Todos los días».
 *
 * ⚠️ EXISTE POR EL TECHO DEL TOAST, no por gusto. El deshacer tiene 3-4 palabras escritas
 * como regla de la casa, y «Cada 2 semanas, los lunes y miércoles» son siete: en una barra
 * de 5 segundos encima de la pantalla, el ancla que la persona acaba de tocar en el control
 * es justo lo que sobra.
 *
 * ⚠️ Y NO ES UNA SEGUNDA TRADUCCIÓN: comparte `ritmo` con `textoRepeticion`, así que la
 * repetición se convierte en palabras en UN solo lugar.
 */
export const textoRepeticionCorto = (s: unknown): string | null => {
  const r = leerRRule(s);
  return r ? ritmo(r) : null;
};

/**
 * EL DESPLEGABLE, TAL CUAL EL DE GOOGLE Y EN SU ORDEN. Lo que está arriba y abajo de esta
 * lista NO lleva RRULE y por eso no está acá: «No se repite» es desmarcar «Se repite»
 * (`setRecurrente`, y la invariante de `recurrenciaDe`) y «Personalizado…» abre el diálogo,
 * que construye su RRULE con `escribirRRule`.
 *
 * ⚠️ GOOGLE DERIVA DOS DE ESTOS DEL DÍA DEL EVENTO («Cada semana el martes», «Cada mes el
 * segundo martes») Y ACÁ NO SE PUEDE: una recurrente no tiene fecha —se la saca la 0163, y
 * ése es el punto de la columna—, así que no hay de dónde sacar el día. Quedan sin ancla, y
 * el que quiera uno lo elige en «Personalizado…». Inventarle el día de hoy sería un dato
 * plausible que nadie dijo, que es el modo de falla que este archivo persigue.
 *
 * ⚠️ LA ETIQUETA SALE DE `textoRepeticion`, NO ESCRITA A MANO. Si se escribieran acá, el
 * día que la frase cambie el desplegable diría una cosa y la tarjeta otra sobre el mismo
 * valor — que es la divergencia que `textoRepeticion` viene a cerrar, servida desde adentro.
 */
export const PRESETS: Array<{ rrule: string; label: string }> =
  ['FREQ=DAILY', 'FREQ=WEEKLY', 'FREQ=MONTHLY', 'FREQ=YEARLY', 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR']
    .map((rrule) => ({ rrule, label: textoRepeticion(rrule) ?? rrule }));

/** Cómo se dice en pantalla el rótulo del campo. Una palabra: es el NOMBRE de la cosa, no
 *  la pregunta que contesta. */
export const ROTULO_REPETICION = 'Repetición';
