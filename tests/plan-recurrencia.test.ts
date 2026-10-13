// =============================================================================
// LA RECURRENCIA COMO LA GUARDA GOOGLE: una RRULE, su ida y vuelta, y la CADENA (mig 0167)
// =============================================================================
// «El tema de la frecuencia, copialo tal cual como lo hace Google Calendar… porque puede
// ser personalizado, varios días de la semana, etc. Pero más simple, investiga y copialo
// tal cual» (26/09/2026).
//
// Reemplaza a `tests/plan-frecuencia.test.ts` y `tests/plan-frecuencia-dia.test.ts`, que
// fijaban el modelo de dos columnas (`frecuencia` enum + `frecuencia_dia`) que la 0167
// borró. No se dejaron «por las dudas»: un test que fija un modelo muerto es la forma más
// barata de que alguien lo resucite.
//
// Lo que este archivo fija son CUATRO cosas:
//
//  1. EL MODELO Y SU IDA Y VUELTA. `escribirRRule(leerRRule(x)) === x` sobre una batería de
//     reglas reales. Sin eso, la misma repetición se guarda con dos strings según por dónde
//     entró y todo lo que compara (los `next === prev` de los choke points) ve cambios
//     donde no los hay.
//  2. EL PARSE TOLERANTE. Una RRULE llega de la columna, de un modelo y del body de
//     `/api/todo`: lo que no se entiende se ignora, nunca tira. Un parse que explota deja la
//     tarjeta SIN DIBUJARSE, que es un tablero roto en vez de un dato perdido.
//  3. LA FRASE, Y QUE SEA UNA SOLA. `textoRepeticion` para la tarjeta, la tabla y la API;
//     `textoRepeticionCorto` para el toast, compartiendo la misma traducción.
//  4. LA CADENA, ENTERA Y EN LAS DOS MITADES. Es la parte que no se ve compilando: cada
//     `upd` que se arma campo por campo, cada payload que enumera claves y cada mapper que
//     castea una fila son una puerta donde el campo se cae en SILENCIO. `editarTarea`,
//     `editarCategoria` y las cuatro ramas de `/api/todo` son exactamente eso — y la mitad
//     del CLIENTE ya se olvidó DOS veces con `recurrente` (migs 0163 y 0164).
//     Y el final de la cadena: que las dos acciones nuevas del board TENGAN CALL SITE. Una
//     acción que nadie llama compila, pasa los tests y no existe en pantalla.
//
// ⚠️ PROBADO ROMPIÉNDOLO, UNA ROTURA POR VEZ, CON LOS NÚMEROS DE CADA UNA. Base: **25
// pasan, 0 fallan** (`node --import tsx --test tests/plan-recurrencia.test.ts`). Cada línea
// es un cambio hecho a propósito en el código de producción, corrido, y revertido:
//
//  #  Qué se rompió                                                     Result.  Qué cayó
//  1  `escribirRRule` emitiendo `INTERVAL=` siempre (`> 1` → `>= 1`)     16 / 9  ver abajo
//  2  `escribirRRule` poniendo BYSETPOS antes que BYDAY                  22 / 3  ida y vuelta · forma canónica · el ordinal pegado
//  3  `normalizar` sin filtrar `byday` contra `ORDEN_DIAS`               24 / 1  «los días salen SIEMPRE en orden de semana»
//  4  `leerRRule` tirando ante una FREQ desconocida en vez de dar null   21 / 4  ver abajo
//  5  `leerRRule` sin levantar el ordinal pegado (`BYDAY=2TU`)           24 / 1  «el ordinal PEGADO al día»
//  6  `recurrenciaDe` devolviendo `recurrenciaOk(t.recurrencia)` a secas 24 / 1  «una recurrencia sin `recurrente` no existe»
//  7  quitar `recurrencia: recurrenciaDe(t)` de `taskToRow`              23 / 2  «los cuatro mappers del DUEÑO» + «la invariante vive en los MAPPERS»
//  8  quitar el `if (patch.recurrencia …)` de `editarTarea`              23 / 2  «el `upd` del CLIENTE» + «la invariante vive en los MAPPERS»
//  9  lo mismo en `editarCategoria` (la otra rama de 8)                  23 / 2  los MISMOS dos tests que 8
// 10  quitar `recurrencia: t.recurrencia` del alta de `/api/todo`        24 / 1  «las CUATRO ramas de /api/todo»
// 11  quitar `recurrencia` de `editPatch` en TodoBoard.tsx               24 / 1  «el board del CLIENTE la manda en los dos sentidos»
// 12  sacar `setRecurrencia` del `return` de `useBoard`                  24 / 1  «las dos acciones están en el `return`»
// 13  `else upd.recurrencia = null` → nada, en `editarTarea`             24 / 1  «al dejar de repetirse se BORRA»
// 14  `ORDINALES` con `{ id: 2, label: 'segunda' }`                      23 / 2  «el ordinal concuerda con el día» + «la frase en español»
// 15  quitar `repeticion: textoRepeticion(…)` del 1er mapper de helpers  24 / 1  «la repetición viaja en la API de MaKo»
// 16  el call site — MEDIDO SIN MUTAR NADA, ver abajo                    24 / 1  «las dos acciones TIENEN call site»
//
// ⚠️ CINCO COSAS QUE LA ROTURA ENSEÑÓ Y NO SE VEÍAN ESCRIBIENDO EL TEST:
//
//  · **La rotura 1 tumbó NUEVE tests, no el de la ida y vuelta solo.** Eso dice algo que no
//    se ve leyendo el código: la forma canónica la usan, sin nombrarla, el desplegable
//    (`PRESETS` deriva su etiqueta de `textoRepeticion` sobre su propio string), el chequeo
//    de que nunca se emita `UNTIL`, el del orden de los días y hasta el de la invariante,
//    que compara contra un literal. **Canonizar no es prolijidad: es lo que hace
//    comparables dos valores**, y de eso cuelgan los `next === prev` de los dos choke
//    points — sin eso, cada guardado de la tarjeta deja una entrada de historial y un toast.
//  · **La rotura 4 tumbó cuatro, y dos fueron una sorpresa útil:** «la frase en español» y
//    «una repetición NO se puede escribir como una fecha» también pasan strings por
//    `leerRRule`, así que un parse que tira se lleva puesta TODA superficie que lea el
//    campo. Es la versión medida de «un parse que explota deja la tarjeta sin dibujarse»:
//    el daño no es perder el dato, es que no se pinte nada. Por eso el caso
//    `'cualquier cosa'` está escrito con `assert.doesNotThrow` y no sólo con el valor.
//  · **La rotura 3 tumbó UNO y esperaba dos, y eso descubrió un agujero.** Sin el filtro
//    contra `ORDEN_DIAS`, el test de «lo que la unidad no sabe leer se BORRA» seguía en
//    verde: la guarda del día del mes cuelga de `!byday.length`, que es otra línea. O sea
//    que el ÚNICO test que cubre ese filtro es el del orden de los días — si alguien lo
//    borra por «cosmético», se va también la deduplicación y la estabilidad del string.
//  · **8 y 9 comparten resultado a propósito**: son las dos ramas del mismo caso —la tarea
//    y la categoría del CLIENTE— y no hay un default correcto entre ellas. Es la mitad que
//    ya se olvidó dos veces con `recurrente` (migs 0163 y 0164).
//  · **La 16 no se midió mutando: se midió mirando.** Mientras el paquete de la UI todavía
//    no había cableado `BoardShell.tsx`, la base de este archivo era **24 / 1** y el único
//    rojo era exactamente «las dos acciones TIENEN call site»; en cuanto aparecieron los dos
//    `board.setRecurrencia(` / `board.setLabelRecurrencia(`, pasó a 25 / 0 sin tocar una
//    línea del test. Es la trampa que este repo pagó cuatro veces —la CAPACIDAD en un
//    archivo y el CALL SITE en otro, con el typecheck en verde— y ésta es la única guarda
//    que la ve. Si vuelve a ponerse roja, no hay que borrarla: hay que enchufar el control.
//
// ⚠️ `lib/plan-board.ts`, `lib/todo.ts` y `app/api/todo/route.ts` son `server-only` y
// `useBoard`/`BoardShell`/`TodoBoard` son `'use client'` con React adentro: los seis se leen
// como TEXTO. `lib/plan-recurrentes.ts` sí se importa — no lleva `server-only` a propósito,
// justamente para esto.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PRESETS, ORDINALES, DIAS, UNIDADES, ROTULO_REPETICION, DIA_MES_MAX, INTERVALO_MAX,
  leerRRule, escribirRRule, recurrenciaOk, recurrenciaDe, textoRepeticion, textoRepeticionCorto,
  type Repeticion, type Dia,
} from '../lib/plan-recurrentes';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// ⚠️ SIN LOS `\r`. En Windows el árbol de trabajo es CRLF y el repo guarda LF, así que
// cualquier búsqueda de una frase que cruce de renglón pasa en un clon y falla en el otro.
const leer = (...p: string[]): string => readFileSync(resolve(RAIZ, ...p), 'utf8').replace(/\r/g, '');
const cuenta = (src: string, aguja: string): number => src.split(aguja).length - 1;

const PLAN_BOARD = leer('lib', 'plan-board.ts');
const TODO = leer('lib', 'todo.ts');
const RUTA_TODO = leer('app', 'api', 'todo', 'route.ts');
const TODO_BOARD = leer('app', 'plan', 'TodoBoard.tsx');
// ⚠️ LOS MAPPERS DE ENTRADA SE MUDARON EL 26/09/2026. `toBoard`/`toLabel` vivían adentro
// de `TodoBoard.tsx` y ahora están en `board/desde-todo.ts`, para que los pueda importar
// también el SERVER (hasta el 11/10/2026 /productivity-analyst; desde entonces el Dashboard,
// lib/graficos-datos-extra.ts) — un `.tsx` con `'use client'` no exporta
// valores al grafo del server. La guarda sigue al código: apuntarla al archivo viejo
// habría dado verde sobre un mapper que ya no está ahí, que es peor que no tenerla.
const TODO_ENTRADA = leer('app', 'plan', 'board', 'desde-todo.ts');
const USE_BOARD = leer('app', 'plan', 'board', 'useBoard.ts');
const SHELL = leer('app', 'plan', 'board', 'BoardShell.tsx');
const TABLAS = leer('app', 'plan', 'board', 'Tablas.tsx');
const HELPERS = leer('lib', 'api-mako', 'areas', 'plan.helpers.ts');

/** El cuerpo de una función del fuente, desde su firma hasta la siguiente declaración de
 *  primer nivel. Alcanza para preguntar «¿esta función nombra el campo?», que es lo único
 *  que la capa de texto puede contestar y justo lo que se cae en silencio. */
function cuerpo(src: string, firma: string): string {
  const i = src.indexOf(firma);
  assert.ok(i >= 0, `no encontré «${firma}»`);
  const resto = src.slice(i + firma.length);
  const fin = resto.search(/\n(export |function |async function )/);
  return fin >= 0 ? resto.slice(0, fin) : resto;
}

/**
 * LA BATERÍA DE REGLAS REALES. Las cinco primeras son las que sale a escribir el
 * desplegable; las otras, las cuatro formas que tiene el diálogo «Personalizado» de Google
 * (intervalo, varios días, día del mes, ordinal + día) más las dos que dejó migradas la
 * 0167 desde el modelo viejo (`FREQ=WEEKLY` pelada, `FREQ=WEEKLY;INTERVAL=2;BYDAY=…`).
 */
const REGLAS = [
  'FREQ=DAILY',
  'FREQ=WEEKLY',
  'FREQ=MONTHLY',
  'FREQ=YEARLY',
  'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
  'FREQ=DAILY;INTERVAL=3',
  'FREQ=WEEKLY;BYDAY=MO',
  'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,FR',
  'FREQ=WEEKLY;BYDAY=SA,SU',
  'FREQ=MONTHLY;BYMONTHDAY=15',
  'FREQ=MONTHLY;BYMONTHDAY=31',
  'FREQ=MONTHLY;BYDAY=TU;BYSETPOS=2',
  'FREQ=MONTHLY;BYDAY=FR;BYSETPOS=-1',
  'FREQ=MONTHLY;INTERVAL=3;BYDAY=MO;BYSETPOS=1',
  'FREQ=YEARLY;BYMONTHDAY=5',
];

// ── 1. EL MODELO Y SU IDA Y VUELTA ───────────────────────────────────────────────────

test('la IDA Y VUELTA: escribirRRule(leerRRule(x)) === x para las reglas reales', () => {
  // Es la propiedad de la que cuelga todo lo demás. Sin ella la misma repetición se guarda
  // con dos strings distintos según por dónde entró —el desplegable, el diálogo, un modelo,
  // un lote— y los `next === prev` de los dos choke points ven un cambio que no existe:
  // una entrada de historial y un toast por cada guardado de la tarjeta.
  for (const r of REGLAS) {
    const leida = leerRRule(r);
    assert.ok(leida, `no se pudo leer «${r}»`);
    assert.equal(escribirRRule(leida), r, `la ida y vuelta de «${r}» no cierra`);
  }
});

test('la FORMA CANÓNICA: el orden es fijo y el INTERVAL=1 no se escribe', () => {
  // Las dos mitades de lo de arriba, por separado, para que la falla diga cuál de las dos
  // se rompió en vez de «no cierra».
  assert.equal(recurrenciaOk('FREQ=WEEKLY;INTERVAL=1'), 'FREQ=WEEKLY', 'el intervalo 1 es el default: no se escribe');
  assert.equal(recurrenciaOk('BYDAY=MO,WE;FREQ=WEEKLY;INTERVAL=2'), 'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE', 'el orden de las partes es FREQ, INTERVAL, BYDAY…');
  assert.equal(recurrenciaOk('FREQ=MONTHLY;BYSETPOS=2;BYDAY=TU'), 'FREQ=MONTHLY;BYDAY=TU;BYSETPOS=2');
  // Y canonizar es idempotente: aplicarlo dos veces no puede cambiar nada.
  for (const r of REGLAS) assert.equal(recurrenciaOk(recurrenciaOk(r)), recurrenciaOk(r), `«${r}»`);
});

test('los días salen SIEMPRE en orden de semana', () => {
  // De esto depende la frase («los viernes y lunes» no se dice) y también la comparación:
  // dos personas marcando los mismos tres días en distinto orden tienen que producir el
  // mismo string, o el tablero registra un cambio en cada guardado.
  assert.equal(recurrenciaOk('FREQ=WEEKLY;BYDAY=FR,MO,WE'), 'FREQ=WEEKLY;BYDAY=MO,WE,FR');
  assert.equal(recurrenciaOk('FREQ=WEEKLY;BYDAY=SU,SA'), 'FREQ=WEEKLY;BYDAY=SA,SU');
  // Y un día repetido no se duplica: el filtro es contra el catálogo, no sobre la entrada.
  assert.equal(recurrenciaOk('FREQ=WEEKLY;BYDAY=MO,MO'), 'FREQ=WEEKLY;BYDAY=MO');
});

test('lo que la unidad no sabe leer se BORRA, y no queda contradiciendo', () => {
  // Es la lección del modelo viejo aplicada al nuevo: dos anclas para la misma repetición
  // —un día de la semana y un día del mes— son dos lecturas y ninguna es la que alguien
  // eligió. La específica gana y la otra desaparece, en vez de quedar viva esperando a que
  // un cambio de unidad la resucite afirmando un día que nadie dijo hoy.
  assert.equal(recurrenciaOk('FREQ=MONTHLY;BYDAY=MO;BYMONTHDAY=15'), 'FREQ=MONTHLY;BYDAY=MO', 'gana el byday, el día del mes se va');
  assert.equal(recurrenciaOk('FREQ=DAILY;BYDAY=MO'), 'FREQ=DAILY', 'todos los días no tiene día de la semana');
  assert.equal(recurrenciaOk('FREQ=WEEKLY;BYMONTHDAY=15'), 'FREQ=WEEKLY', 'una semanal no tiene día del mes');
  assert.equal(recurrenciaOk('FREQ=WEEKLY;BYDAY=MO;BYSETPOS=2'), 'FREQ=WEEKLY;BYDAY=MO', 'el ordinal es de «cada mes»');
  assert.equal(recurrenciaOk('FREQ=MONTHLY;BYSETPOS=2'), 'FREQ=MONTHLY', 'un ordinal sin día no dice nada: «el segundo» de qué');
  assert.equal(recurrenciaOk(`FREQ=MONTHLY;BYMONTHDAY=${DIA_MES_MAX + 1}`), 'FREQ=MONTHLY', 'no hay día 32');
  assert.equal(recurrenciaOk(`FREQ=WEEKLY;INTERVAL=${INTERVALO_MAX + 1}`), 'FREQ=WEEKLY', 'el intervalo fuera de rango cae al default');
  assert.equal(recurrenciaOk('FREQ=WEEKLY;INTERVAL=0'), 'FREQ=WEEKLY');
});

// ── 2. EL PARSE TOLERANTE ────────────────────────────────────────────────────────────

test('el parse es TOLERANTE: lo que no entiende se ignora, nunca tira', () => {
  // Una RRULE llega de la columna (que no tiene `check`), del JSON de un modelo, del body
  // de `/api/todo` y del estado optimista del navegador. Un parse que explota no pierde un
  // dato: deja la TARJETA SIN DIBUJARSE, que es un tablero roto.
  for (const basura of ['', 'cualquier cosa', 'FREQ=', 'FREQ=HOURLY', ';;;', '=', 'FREQ=WEEKLY;=', null, undefined, 42, {}, []]) {
    assert.doesNotThrow(() => leerRRule(basura as unknown), `tiró con ${JSON.stringify(basura)}`);
  }
  assert.equal(leerRRule('cualquier cosa'), null);
  assert.equal(leerRRule('FREQ=HOURLY'), null, 'una unidad que este producto no modela no es una repetición a medias: es null');
  // Y lo que sí entiende lo levanta aunque venga sucio.
  assert.equal(recurrenciaOk('  rrule:freq=weekly ; byday = mo , we ; '), 'FREQ=WEEKLY;BYDAY=MO,WE');
});

test('UNTIL y COUNT se IGNORAN, y eso está decidido', () => {
  // Es el punto 4 del diálogo de Google y es lo único que NO se copia: nada en este
  // producto calcula la próxima ocurrencia, así que «después de 12 repeticiones» sería un
  // dato que nadie lee nunca y un control que no hace nada. Ignorarlas en el parse es lo
  // que impide que una RRULE pegada de un `.ics` las meta en la columna por la puerta de
  // atrás — donde nadie las vería y donde el día que esto genere algo, mandarían.
  assert.equal(recurrenciaOk('FREQ=WEEKLY;UNTIL=20261231T000000Z'), 'FREQ=WEEKLY');
  assert.equal(recurrenciaOk('FREQ=WEEKLY;COUNT=12;BYDAY=MO'), 'FREQ=WEEKLY;BYDAY=MO');
  assert.equal(recurrenciaOk('FREQ=WEEKLY;WKST=SU;BYMONTH=3;BYDAY=MO'), 'FREQ=WEEKLY;BYDAY=MO', 'y cualquier otra parte que no modelamos');
  for (const r of REGLAS) {
    const s = escribirRRule(leerRRule(r)) ?? '';
    assert.ok(!/UNTIL|COUNT/.test(s), `«${r}» no puede emitir UNTIL ni COUNT`);
  }
});

test('el ordinal PEGADO al día (`BYDAY=2TU`) se lee como BYSETPOS', () => {
  // Es como Google escribe «el segundo martes» cuando exporta un `.ics`, así que es lo que
  // llega si alguien pega una regla de ahí. Sin esta rama el ordinal se pierde en silencio
  // y la tarjeta dice «los martes» sobre algo que pasa una vez al mes.
  assert.equal(recurrenciaOk('FREQ=MONTHLY;BYDAY=2TU'), 'FREQ=MONTHLY;BYDAY=TU;BYSETPOS=2');
  assert.equal(recurrenciaOk('FREQ=MONTHLY;BYDAY=-1FR'), 'FREQ=MONTHLY;BYDAY=FR;BYSETPOS=-1');
  // Y un `BYSETPOS` propio le gana al pegado: es el que la pantalla escribe.
  assert.equal(recurrenciaOk('FREQ=MONTHLY;BYDAY=2TU;BYSETPOS=3'), 'FREQ=MONTHLY;BYDAY=TU;BYSETPOS=3');
});

// ── 3. LA FRASE ──────────────────────────────────────────────────────────────────────

test('la frase en español, con su plural y su enumeración', () => {
  // «los lun,mie» es un volcado de la RRULE, no una frase. Y el plural de un día no es una
  // columna del catálogo: se deriva, porque en español los que terminan en `s` son
  // invariables y los otros dos suman una.
  assert.equal(textoRepeticion('FREQ=DAILY'), 'Todos los días');
  assert.equal(textoRepeticion('FREQ=DAILY;INTERVAL=3'), 'Cada 3 días');
  assert.equal(textoRepeticion('FREQ=WEEKLY'), 'Cada semana');
  assert.equal(textoRepeticion('FREQ=WEEKLY;BYDAY=MO'), 'Cada semana, los lunes');
  assert.equal(textoRepeticion('FREQ=WEEKLY;BYDAY=MO,WE'), 'Cada semana, los lunes y miércoles');
  assert.equal(textoRepeticion('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,FR'), 'Cada 2 semanas, los lunes, miércoles y viernes');
  assert.equal(textoRepeticion('FREQ=WEEKLY;BYDAY=SA,SU'), 'Cada semana, los sábados y domingos', 'sábado y domingo SÍ pluralizan');
  assert.equal(textoRepeticion('FREQ=MONTHLY;BYMONTHDAY=15'), 'Cada mes, el día 15');
  assert.equal(textoRepeticion('FREQ=MONTHLY;INTERVAL=2;BYDAY=TU;BYSETPOS=2'), 'Cada 2 meses, el segundo martes');
  assert.equal(textoRepeticion('FREQ=MONTHLY;BYDAY=FR;BYSETPOS=-1'), 'Cada mes, el último viernes');
  assert.equal(textoRepeticion('FREQ=YEARLY'), 'Cada año');
  // Y «Todos los días laborables» es el preset de Google, con su frase propia: enumerar los
  // cinco días («Cada semana, los lunes, martes, miércoles, jueves y viernes») dice lo mismo
  // y no entra en ninguna tarjeta.
  assert.equal(textoRepeticion('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR'), 'Todos los días laborables');
  // `null` = no se repite, o se repite y nadie dijo cada cuánto. NO es una ausencia.
  assert.equal(textoRepeticion(null), null);
  assert.equal(textoRepeticion('cualquier cosa'), null);
});

test('el ordinal concuerda con el día, que en español es masculino', () => {
  // «el segunda martes» es el error que sale solo si alguien escribe los ordinales pensando
  // en «la semana». Lo que modifican es un día, y los siete son masculinos.
  for (const o of ORDINALES) {
    assert.ok(!/a$/.test(o.label), `«${o.label}» concuerda en femenino: el día es masculino`);
  }
  assert.equal(textoRepeticion('FREQ=MONTHLY;BYDAY=MO;BYSETPOS=1'), 'Cada mes, el primer lunes', 'apocopado: «primer», no «primero»');
  assert.equal(textoRepeticion('FREQ=MONTHLY;BYDAY=WE;BYSETPOS=3'), 'Cada mes, el tercer miércoles');
});

test('el TOAST usa la forma corta, y comparte traducción con la larga', () => {
  // «el mensaje del botón de deshacer es MUY largo, por dios deja de escribir textos así de
  // largos, que sea una regla» (26/09/2026). El techo de esa superficie son 3-4 palabras, y
  // la frase larga de una personalizada son siete.
  assert.equal(textoRepeticionCorto('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,FR'), 'Cada 2 semanas');
  assert.equal(textoRepeticionCorto('FREQ=MONTHLY;BYDAY=TU;BYSETPOS=2'), 'Cada mes');
  assert.equal(textoRepeticionCorto(null), null);
  for (const r of REGLAS) {
    const corto = textoRepeticionCorto(r) ?? '';
    const n = corto.trim().split(/\s+/).length;
    assert.ok(n <= 4, `«${corto}» son ${n} palabras; el techo del toast son 4`);
    // Y no es una segunda traducción: la larga EMPIEZA por la corta, siempre.
    assert.ok((textoRepeticion(r) ?? '').startsWith(corto), `«${r}»: la frase larga y la corta divergieron`);
  }
});

test('nada de BAU, nada de rioplatense, y el rótulo es el NOMBRE de la cosa', () => {
  // El producto se usa en México: «aquí», nunca «acá». Y «BAU» se descartó a propósito
  // —«el nombre tal vez no es muy conocido»—: no va en un rótulo, ni en un tooltip.
  const textos = [ROTULO_REPETICION, ...PRESETS.map((p) => p.label), ...DIAS.map((d) => d.label),
    ...UNIDADES.flatMap((u) => [u.singular, u.plural]), ...ORDINALES.map((o) => o.label)];
  for (const t of textos) {
    assert.ok(!/\bbau\b/i.test(t), `«${t}»: en el producto NUNCA se escribe BAU`);
    assert.ok(!/ac[áa]\b/i.test(t), `«${t}»: en México se dice «aquí»`);
  }
  assert.equal(ROTULO_REPETICION, 'Repetición', 'el rótulo es el nombre, no la pregunta que contesta');
  assert.ok(!/\?/.test(ROTULO_REPETICION));
});

test('PRESETS: los de Google, con la etiqueta DERIVADA de la frase', () => {
  // Si las etiquetas se escribieran a mano, el día que la frase cambie el desplegable diría
  // una cosa y la tarjeta otra sobre el mismo valor — la divergencia que `textoRepeticion`
  // viene a cerrar, servida desde adentro.
  assert.ok(PRESETS.length >= 5, 'faltan presets');
  for (const p of PRESETS) {
    assert.equal(p.label, textoRepeticion(p.rrule), `«${p.rrule}»: la etiqueta no sale de textoRepeticion`);
    assert.equal(recurrenciaOk(p.rrule), p.rrule, `«${p.rrule}» no está en forma canónica`);
  }
  // Los cinco que ofrece Google antes de «Personalizado…». «No se repite» no está acá
  // porque no lleva RRULE: es desmarcar «Se repite».
  assert.deepEqual(PRESETS.map((p) => p.rrule),
    ['FREQ=DAILY', 'FREQ=WEEKLY', 'FREQ=MONTHLY', 'FREQ=YEARLY', 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR']);
});

test('una repetición NO se puede escribir como una fecha', () => {
  // De esto depende todo el diseño: un deadline LLEGA y vence, una repetición es un ritmo
  // que no vence nunca. Que la columna sólo acepte RRULEs es lo que impide que alguien
  // «reuse» el campo para la fecha del próximo ciclo y le devuelva al motor de vencimientos
  // algo que leer — o sea, que vuelva el «la junta semanal está atrasada».
  for (const fecha of ['2026-07-05', '05/07/2026', '2026-Q3', '2026-12-31T00:00:00Z']) {
    assert.equal(recurrenciaOk(fecha), null, `«${fecha}» es una fecha, no un ritmo`);
  }
});

// ── 4. LA INVARIANTE Y LA CADENA ─────────────────────────────────────────────────────

test('una recurrencia sin `recurrente` no existe', () => {
  assert.equal(recurrenciaDe({ recurrente: true, recurrencia: 'FREQ=WEEKLY' }), 'FREQ=WEEKLY');
  assert.equal(recurrenciaDe({ recurrente: false, recurrencia: 'FREQ=WEEKLY' }), null, 'lo que no se repite no tiene ritmo');
  assert.equal(recurrenciaDe({ recurrencia: 'FREQ=WEEKLY' }), null, 'sin el flag (tarjeta optimista, fila vieja) = null');
  assert.equal(recurrenciaDe({ recurrente: true }), null, 'se repite y no se dijo cada cuánto');
  assert.equal(recurrenciaDe({}), null);
  // El saneo se aplica DESPUÉS del flag, no en vez de él: son dos capas, no una.
  assert.equal(recurrenciaDe({ recurrente: true, recurrencia: 'cada tanto' }), null);
  // Y hereda el `=== true` de `esRecurrente`: un 1 del JSON de un modelo no marca nada.
  assert.equal(recurrenciaDe({ recurrente: 1 as unknown as boolean, recurrencia: 'FREQ=WEEKLY' }), null);
});

test('la invariante vive en los MAPPERS, no en el formulario', () => {
  // Es la lección que ya pagaron el Quarter, el deadline y la frecuencia: la regla vivía en
  // el único camino que pasa por el navegador y todo lo que escribe el SERVER —el Perro,
  // una reunión, un lote— pasaba de largo. Acá se exige en la LECTURA y en la ESCRITURA de
  // las dos mitades: si sólo se aplicara al escribir, una fila desalineada de antes seguiría
  // llegando al navegador y el próximo guardado la devolvería tal cual.
  // ⚠️ `recurrencia: recurrenciaDe(` Y NO `recurrenciaDe` A SECAS: el comentario de arriba
  // de cada línea NOMBRA la función, así que buscar el nombre suelto se cumple con la prosa
  // que explica la regla. Un test de texto tiene que buscar código — la prosa es justo lo
  // que sobrevive a que alguien borre la línea.
  for (const fn of ['rowToTask', 'taskToRow', 'rowToLabel', 'labelToRow']) {
    assert.ok(/recurrencia: recurrenciaDe\(/.test(cuerpo(PLAN_BOARD, `function ${fn}(`)), `${fn} no pasa por recurrenciaDe`);
  }
  assert.ok(/t\.recurrencia = recurrenciaDe\(/.test(TODO), 'rowTo (tarea del cliente) no sanea la recurrencia');
  assert.ok(/c\.recurrencia = recurrenciaDe\(/.test(TODO), 'catRow (proyecto del cliente) no sanea la recurrencia');
  assert.equal(cuenta(TODO, 'recurrenciaDe('), 6, 'los seis puntos del cliente: 2 lecturas, 2 altas y 2 ediciones');
});

test('al dejar de repetirse se BORRA la recurrencia, en las dos mitades', () => {
  // La simétrica de «al marcarla se le va la fecha». Sin esto queda una fila con
  // `recurrente: false` y una RRULE viva: un valor que ninguna pantalla dibuja (el campo
  // sólo existe al lado de «Se repite») y que la API de MaKo sí publica.
  assert.equal(cuenta(TODO, 'else upd.recurrencia = null'), 2, 'el editar de la tarea Y el de la categoría');
  // En el navegador: en su propia entrada del historial (tarea) y en la misma (proyecto).
  assert.ok(/patchLogExplicit\(id, 'recurrencia', null, t\.recurrencia/.test(USE_BOARD), 'la tarea no la suelta al desmarcarse');
  assert.ok(/recurrente: false, recurrencia: null/.test(USE_BOARD), 'el proyecto no la suelta al desmarcarse');
});

test('los cuatro mappers del DUEÑO nombran el campo', () => {
  assert.equal(cuenta(PLAN_BOARD, 'recurrencia: recurrenciaDe('), 4, 'rowToTask, taskToRow, rowToLabel y labelToRow');
});

test('el `upd` del CLIENTE se arma campo por campo: lo que no se nombra no llega', () => {
  // `editarTarea` y `editarCategoria` son la mitad que ya se olvidó dos veces con
  // `recurrente`. Un campo que no está en su `upd` deja el control dibujado en el tablero
  // de Mauricio contestando 200 y sin guardar nada.
  // ⚠️ `upd.recurrencia = recurrenciaDe(`, NO `upd.recurrencia =` A SECAS: cada uno de estos
  // dos `upd` escribe el campo DOS veces —una al desmarcar («bórrala») y otra al guardar el
  // valor elegido—, así que buscar el nombre suelto deja la aserción en verde cuando falta
  // la segunda.
  for (const fn of ['export async function editarTarea(', 'export async function editarCategoria(']) {
    const src = cuerpo(TODO, fn);
    assert.ok(src.includes('patch.recurrencia !== undefined'), `${fn} no mira patch.recurrencia`);
    assert.ok(/upd\.recurrencia = recurrenciaDe\(/.test(src), `${fn} no guarda la recurrencia elegida`);
  }
  // Y las dos ALTAS: si sólo el editar la guardara, una recurrente nacería sin ritmo.
  assert.ok(cuerpo(TODO, 'export async function crearTarea(').includes('recurrencia: recurrenciaDe(input)'), 'el alta de una tarea del cliente');
  assert.ok(TODO.includes('recurrente: repite, recurrencia: recurrenciaDe('), 'el alta de un proyecto del cliente');
});

test('las CUATRO ramas de /api/todo la dejan pasar', () => {
  // La ruta es la PUERTA: arma cada payload enumerando claves, así que una rama que no la
  // nombre la tira en silencio. Viaja CRUDA a propósito —el saneo con su invariante necesita
  // saber si la fila se repite, y eso sólo lo sabe `lib/todo.ts`, que la lee—: sanear en las
  // dos puntas sería la segunda copia de la regla, y sanear SÓLO acá dejaría entrar una
  // recurrencia a algo que vence.
  assert.ok(/recurrencia: t\.recurrencia/.test(RUTA_TODO), 'la rama «crear»');
  assert.ok(/recurrencia: patch\.recurrencia/.test(RUTA_TODO), 'la rama «editar»');
  // `categoria-crear` le suma un argumento por migración (el cliente en la 0172, la
  // portada en la 0173), así que la aserción mira los dos que le importan y NO el final de
  // la lista — anclada en el paréntesis de cierre volvía a fallar con cada columna nueva,
  // que es ruido: lo que este test persigue es que `recurrencia` siga llegando.
  assert.ok(/quarter, recurrente, recurrencia, cliente/.test(RUTA_TODO), 'la rama «categoria-crear»');
  assert.ok(/recurrente\?: boolean; recurrencia\?: unknown;/.test(RUTA_TODO), 'la rama «categoria-editar»: el tipo del patch ES la puerta');
  // Y `undefined` («no lo toques») nunca se colapsa con `null` («bórrala»): si se colara un
  // `?? null` en la ruta, editar cualquier otro campo borraría el ritmo.
  assert.ok(!/recurrencia: patch\.recurrencia \?\? null/.test(RUTA_TODO), 'la ruta no puede colapsar undefined con null');
});

test('el board del CLIENTE la manda en los dos sentidos', () => {
  // `toBoard`/`toLabel` son la puerta de ENTRADA: sin ellas el selector nace vacío en cada
  // carga aunque la fila tenga el dato — o sea que elegir un ritmo «no hace nada» al
  // recargar, que es exactamente cómo se reportó el bug hermano de `recurrente`.
  assert.ok(/recurrente: t\.recurrente, recurrencia: t\.recurrencia/.test(TODO_ENTRADA), 'toBoard');
  assert.ok(/recurrente: c\.recurrente, recurrencia: c\.recurrencia/.test(TODO_ENTRADA), 'toLabel');
  // Y los cuatro payloads de SALIDA (editar y alta de tarea, alta y editar de proyecto).
  assert.equal(cuenta(TODO_BOARD, 'recurrencia: d.recurrencia ?? null'), 2, 'los dos payloads de una tarea');
  assert.equal(cuenta(TODO_BOARD, 'recurrencia: l.recurrencia ?? null'), 2, 'los dos payloads de un proyecto');
});

test('las dos acciones están en el `return` de useBoard: si no, no existen', () => {
  // El modo de falla que este repo pagó dos veces el 25/09/2026: la capacidad queda
  // escrita, el typecheck pasa, los tests pasan, y en pantalla no hay nada que tocar
  // porque el board nunca la recibió.
  const ret = USE_BOARD.slice(USE_BOARD.lastIndexOf('\n  return {'));
  for (const accion of ['setRecurrencia', 'setLabelRecurrencia']) {
    assert.ok(new RegExp(`[,{\\s]${accion}[,\\s]`).test(ret), `${accion} no está en el objeto que devuelve useBoard`);
  }
});

test('las dos acciones TIENEN call site, y es el suyo', () => {
  // ⚠️ ÉSTE ESTUVO EN ROJO MIENTRAS SE ESCRIBÍA, Y ESA ES SU MEDICIÓN (la 16 de la tabla de
  // arriba). Contar los call sites es lo único que separa «lo escribí» de «se puede usar»,
  // y la trampa que este repo pagó cuatro veces es que la CAPACIDAD y el CALL SITE viven en
  // archivos distintos: la prop es opcional, el typecheck pasa, y en pantalla no hay nada
  // que agarrar. Si vuelve a ponerse rojo, no se borra: se enchufa el control.
  const ui = SHELL + TABLAS;
  assert.ok(cuenta(ui, 'board.setRecurrencia(') >= 1, 'nadie llama a board.setRecurrencia: el control de una TAREA no guarda');
  assert.ok(cuenta(ui, 'board.setLabelRecurrencia(') >= 1, 'nadie llama a board.setLabelRecurrencia: el de un PROYECTO no guarda');
});

test('la repetición viaja en la API de MaKo, pegada a `se_repite`', () => {
  // Un agente que ve «se repite» y no ve cada cuánto no puede decidir nada con eso: «la
  // junta de los miércoles» y «el seguimiento diario» se le ven idénticas. Va en TEXTO y no
  // como RRULE: lo que el modelo va a hacer con el dato es decírselo a una persona, y
  // traducir un `FREQ=MONTHLY;BYDAY=TU;BYSETPOS=2` es donde inventa.
  assert.ok(/se_repite: true, repeticion: t\.repeticion/.test(HELPERS), 'tareaCompacta no manda el ritmo');
  assert.ok(!/recurrencia: [tpc]\./.test(HELPERS), 'la API no puede mandar la RRULE cruda');
  assert.equal(cuenta(HELPERS, 'textoRepeticion('), 4, 'las dos mitades del tablero, tareas y proyectos');
});

test('el modelo VIEJO no quedó vivo en ningún lado', () => {
  // Dos modelos de la misma cosa es el bug que la 0167 vino a cerrar, y el que queda vivo
  // sin consumidores es el que un día alguien vuelve a usar. Se mira el CÓDIGO: los
  // comentarios que explican la migración sí nombran lo que se fue, y tienen que poder.
  const RECURRENTES = leer('lib', 'plan-recurrentes.ts');
  const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const muerto of ['FRECUENCIAS', 'frecuenciaOk', 'frecuenciaDe', 'textoFrecuencia', 'DIAS_SEMANA',
    'pideDia', 'frecuenciaDiaOk', 'textoDia', 'textoCuando', 'ROTULO_FRECUENCIA', 'ROTULO_DIA']) {
    assert.ok(!sinComentarios(RECURRENTES).includes(muerto), `«${muerto}» sigue vivo en lib/plan-recurrentes.ts`);
  }
  // Y las dos columnas que la 0168 saca DESPUÉS del deploy: el código ya no las nombra.
  for (const [nombre, src] of [['plan-board.ts', PLAN_BOARD], ['todo.ts', TODO], ['route.ts', RUTA_TODO],
    ['TodoBoard.tsx', TODO_BOARD], ['useBoard.ts', USE_BOARD], ['plan.helpers.ts', HELPERS]] as Array<[string, string]>) {
    assert.ok(!/\bfrecuencia_dia\b/.test(sinComentarios(src)), `${nombre} todavía nombra la columna frecuencia_dia`);
    assert.ok(!/\.frecuencia\b/.test(sinComentarios(src)), `${nombre} todavía lee la columna frecuencia`);
  }
});

// Lo que el tipo declara y el test usa, para que un renombre del contrato no pase callado.
test('el contrato del modelo se puede construir a mano', () => {
  const r: Repeticion = { freq: 'WEEKLY', interval: 2, byday: ['MO', 'WE'] as Dia[], bymonthday: null, bysetpos: null };
  assert.equal(escribirRRule(r), 'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE');
  assert.equal(escribirRRule(null), null);
  assert.equal(DIAS.length, 7);
  assert.equal(UNIDADES.length, 4, 'DAILY, WEEKLY, MONTHLY y YEARLY');
});
