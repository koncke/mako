// =============================================================================
// Una tarea tiene que poder NACER recurrente (mig 0163)
// =============================================================================
// El agujero que este test cierra: hasta el 26/09/2026 el único camino a `recurrente` era
// un interruptor en el DETALLE de una tarjeta que ya existía. O sea que se extraía una
// reunión, «Reunión semanal con Esquer» entraba como tarea normal, el Perro le ponía score
// y deadline, se llevaba un puesto del ranking y titilaba pidiendo una fecha que nunca iba
// a tener — el síntoma que la feature vino a eliminar seguía entrando por la puerta
// principal todos los días.
//
// Lo que se fija acá son las DOS capas que AGENTS.md exige para toda regla que gobierne la
// salida de un modelo, más la cadena que las une:
//   1. el TEXTO en el prompt de extracción (la cuarta pregunta del criterio, con sus
//      ejemplos en las dos direcciones);
//   2. la VALIDACIÓN determinista en el saneo (`decidirRecurrente`), que es lo que hace que
//      la regla exista cuando el modelo no acierta;
//   3. que el campo VIAJE desde donde el modelo contesta hasta el alta. Lo tercero no es
//      paranoia: el `minuto` se perdió exactamente así, en uno de estos mismos mapeos, y
//      «escribir la salida no es ofrecerla» es el nombre que este repo le puso al bug.
//
// ⚠️ PROBADO ROMPIÉNDOLO, UNA ROTURA POR VEZ, CON LOS NÚMEROS. Base: **12 pasan, 0 fallan**
// (`node --import tsx --test tests/plan-recurrente-nace.test.ts`). Cada línea es un cambio
// hecho a propósito en el código de producción, corrido, y revertido:
//
//  #  Qué se rompió                                                        Resultado  Qué cayó
//  1  `decidirRecurrente` con `crudo === true` → `!!crudo`                  10 / 2     «=== true, no truthy» + «el juez sanea igual»
//  2  …y además devolviendo `{recurrente: marcado, conflicto:false}`         9 / 3     las dos de arriba + «CON FECHA GANA LA FECHA»
//     siempre (o sea: sacar el desempate del deadline)
//  3  quitar `recurrente: t.recurrente` del map de `reunion-auto.ts`        11 / 1     «la cadena no se corta en ningún mapeo»
//  4  quitar `recurrente: t.recurrente` del map de `app/api/plan-fathom`    11 / 1     el MISMO test que 3
//  5  quitar `recurrente: t.recurrente` del alta de `agregarTareasPlanOwner` 11 / 1    «el alta lo pasa en los DOS tableros»
//  6  `recurrente: decidirRecurrente(...)` → `!!o.recurrente` en            11 / 1     «el extractor lo lee, y no con !!»
//     `coerceCandidatas`
//  7  renombrar el encabezado «¿SE REPITE PARA SIEMPRE?» del prompt        11 / 1     «el prompt hace la cuarta pregunta»
//  8  escribir «BAU» adentro de CRITERIO_JUEZ_SYSTEM_TEMPLATE              11 / 1     «los prompts NUNCA dicen BAU»
//  9  borrar el `console.warn` del conflicto en `limpiarTarea`             11 / 1     «el descarte deja rastro»
// 10  agregar `'recurrente'` a `CUBETAS`                                   11 / 1     «no es una cubeta ni una regla nueva»
//
// ⚠️ DOS COSAS QUE LA ROTURA ENSEÑÓ Y NO SE VEÍAN ESCRIBIENDO EL TEST:
//
//  · **La rotura 1 sola NO tumba «CON FECHA GANA LA FECHA»** (10/2, y ese test queda en
//    verde). Con `!!crudo` el flag igual se cae cuando hay deadline —porque el desempate
//    está una línea más abajo—, así que ese test pasa por una razón que no es la suya.
//    Hacen falta las dos capas rotas (#2, 9/3) para verlo. Queda escrito en vez de
//    borrarlo: son dos reglas distintas viviendo en la misma función, y el que saque una
//    creyendo que la otra la cubre tiene que leer esto.
//
//  · **La rotura 7 dio 11/1, no 10/2 como esperaba.** Renombrar el encabezado del bloque
//    tumba «el prompt hace la cuarta pregunta» y deja en VERDE «el caso que más se
//    confunde», porque los ejemplos siguen ahí sueltos. O sea que los dos tests no son uno
//    partido en dos: uno cuida que la pregunta EXISTA y el otro que esté el par de
//    ejemplos que la hace acertar. Un prompt puede perder el encabezado y conservar los
//    ejemplos, y al revés — y el segundo caso es el caro, porque el modelo lee una lista
//    de ejemplos sin saber qué le están preguntando.
//
// ⚠️ Los módulos del riel (`plan-fathom`, `plan-propuesta`, `reunion-auto`, el route) son
// `server-only` y no se pueden importar desde acá: se leen como TEXTO, igual que hace
// `tests/plan-fathom-prompt.test.ts`. `lib/plan-criterio-reglas.ts` sí se importa —no
// lleva `server-only` a propósito, justamente para que esta capa se pueda correr.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  decidirRecurrente, sanearVeredictos, transcriptParaCitas, CUBETAS,
  CRITERIO_JUEZ_SYSTEM_TEMPLATE, CRITERIO_JUEZ_JSON_SHAPE,
} from '../lib/plan-criterio-reglas';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (...p: string[]): string => readFileSync(resolve(RAIZ, ...p), 'utf8');

const FATHOM = leer('lib', 'plan-fathom.ts');
const PROPUESTA = leer('lib', 'plan-propuesta.ts');
const AUTO = leer('lib', 'reunion-auto.ts');
const IMPORTAR = leer('lib', 'importar-en-segundo-plano.ts');
const ROUTE = leer('app', 'api', 'plan-fathom', 'route.ts');

/** El cuerpo de una plantilla de prompt, sacado del fuente. Es seguro cortar por el
 *  backtick siguiente porque adentro de un template de este repo no va ninguno (regla de
 *  la casa: un backtick ahí cierra la cadena a la mitad). */
function plantilla(src: string, nombre: string): string {
  const marca = `export const ${nombre} = \``;
  const i = src.indexOf(marca);
  assert.ok(i >= 0, `no encontré la plantilla ${nombre}`);
  const desde = i + marca.length;
  const hasta = src.indexOf('`', desde);
  assert.ok(hasta > desde, `la plantilla ${nombre} no cierra`);
  return src.slice(desde, hasta);
}

// ── Capa 2: la validación determinista ───────────────────────────────────────────────

test('«=== true», no truthy: lo que manda un modelo no es un booleano', () => {
  // El valor sale del JSON de un modelo, así que puede venir de cualquier forma. Ante la
  // duda la respuesta es NO: una tarea mal marcada desaparece del ranking sin que nadie lo
  // haya pedido, y eso es peor que una recurrente que todavía compite.
  assert.equal(decidirRecurrente(true).recurrente, true);
  for (const crudo of ['true', 'sí', 1, {}, [], 'false', undefined, null, false]) {
    assert.equal(decidirRecurrente(crudo).recurrente, false, `«${JSON.stringify(crudo)}» no puede marcar una recurrente`);
  }
});

test('CON FECHA GANA LA FECHA: el desempate de dos señales que se contradicen', () => {
  // Lo que se repite no vence, así que `recurrente: true` + `deadline` es una
  // contradicción. AGENTS.md ya decidió el criterio: gana la señal MÁS CARA DE PRODUCIR.
  // Un booleano es un token que el modelo tira sin pensar; una fecha concreta sólo se
  // escribe habiendo oído a alguien decirla, y se puede verificar contra la transcripción.
  const r = decidirRecurrente(true, '2026-10-15');
  assert.equal(r.recurrente, false, 'la fecha tiene que ganarle al flag');
  assert.equal(r.conflicto, true, 'y el descarte tiene que quedar declarado');
  // Sin fecha no hay conflicto que declarar.
  assert.deepEqual(decidirRecurrente(true), { recurrente: true, conflicto: false });
  // Y una fecha que no está no es una fecha: `''`, espacios y null no descartan nada.
  for (const vacia of ['', '   ', null, undefined]) {
    assert.equal(decidirRecurrente(true, vacia).recurrente, true, `«${JSON.stringify(vacia)}» no es una fecha`);
  }
});

test('el juez sanea «recurrente» con la MISMA regla, no con la suya', () => {
  const TRANSCRIPT = '[00:10:00] Mauricio Bustos: la junta de los miercoles no se mueve, es la que sostiene todo el seguimiento';
  const NORM = transcriptParaCitas(TRANSCRIPT);
  const vs = sanearVeredictos({
    veredictos: [
      { i: 0, cubeta: 'compromiso', cita: 'la junta de los miércoles no se mueve', recurrente: true },
      { i: 1, cubeta: 'compromiso', cita: 'la junta de los miércoles no se mueve', recurrente: 'true' },
      { i: 2, cubeta: 'compromiso', cita: 'la junta de los miércoles no se mueve' },
    ],
  }, 3, NORM);
  assert.equal(vs[0]?.recurrente, true);
  assert.equal(vs[1]?.recurrente, false, 'el string "true" no puede marcar una recurrente');
  assert.equal(vs[2]?.recurrente, false, 'sin el campo, false');
  // Y sigue siendo un compromiso: repetirse no la saca del tablero.
  assert.equal(vs[0]?.cubeta, 'compromiso');
});

// ── Capa 1: el texto del prompt ──────────────────────────────────────────────────────

test('el prompt de extracción hace la CUARTA pregunta, y declara el campo', () => {
  const sys = plantilla(FATHOM, 'PLAN_FATHOM_SYSTEM_TEMPLATE');
  const shape = plantilla(FATHOM, 'PLAN_FATHOM_JSON_SHAPE');
  assert.match(sys, /¿SE REPITE PARA SIEMPRE\?/, 'falta el bloque de la cuarta pregunta');
  // Tiene que decir por qué es APARTE: las otras tres del criterio no la contestan.
  assert.match(sys, /tienen un inicio y tienen un fin/, 'falta el criterio del dueño, textual');
  assert.match(sys, /al cerrarla hay que volver a crearla/i, 'falta lo que delata a una recurrente');
  // Y que una recurrente NO se descarta: sigue siendo una tarea, sólo que marcada.
  assert.match(sys, /NO la descartes por repetirse/, 'el prompt tiene que prohibir descartarla');
  assert.ok(shape.includes('"recurrente"'), 'el JSON shape no declara el campo');
});

test('está el caso que la migración midió y que es el que MÁS se confunde', () => {
  // «Diseñar la estructura de la junta semanal» e «Implementar la cadencia de juntas» son
  // tareas CON FIN que montan un ritual: terminan el día que el ritual existe. Lo
  // recurrente es ASISTIR a la junta cada semana. Sin los dos lados escritos, el modelo
  // marca cualquier cosa que nombre algo semanal.
  const sys = plantilla(FATHOM, 'PLAN_FATHOM_SYSTEM_TEMPLATE');
  assert.match(sys, /Diseñar la estructura de la junta semanal.*false/, 'falta el caso «montar el ritual»');
  assert.match(sys, /Implementar la cadencia de juntas.*false/, 'falta el segundo caso «montar el ritual»');
  assert.match(sys, /ASISTIR al ritual, no inventarlo/, 'falta la regla corta que los separa');
  // Y el otro lado: al menos un ejemplo de lo que SÍ se repite.
  assert.match(sys, /seguimiento diario a los leads/, 'falta un ejemplo de lo que SÍ se repite');
  // El JSON shape trae un ejemplo con true, no sólo la descripción del campo.
  assert.match(plantilla(FATHOM, 'PLAN_FATHOM_JSON_SHAPE'), /"recurrente": true/, 'ningún ejemplo del shape marca true');
});

test('los prompts NUNCA dicen «BAU» — ni el del extractor ni el del juez', () => {
  // El nombre con el que nació el criterio se descartó a propósito («el nombre tal vez no
  // es muy conocido»). Puede vivir en un comentario que explique de dónde salió; en un
  // texto que lee el modelo —y que el cliente edita en /configuraciones— no.
  for (const [nombre, texto] of [
    ['PLAN_FATHOM_SYSTEM_TEMPLATE', plantilla(FATHOM, 'PLAN_FATHOM_SYSTEM_TEMPLATE')],
    ['PLAN_FATHOM_JSON_SHAPE', plantilla(FATHOM, 'PLAN_FATHOM_JSON_SHAPE')],
    ['CRITERIO_JUEZ_SYSTEM_TEMPLATE', CRITERIO_JUEZ_SYSTEM_TEMPLATE],
    ['CRITERIO_JUEZ_JSON_SHAPE', CRITERIO_JUEZ_JSON_SHAPE],
  ] as const) {
    assert.doesNotMatch(texto, /\bBAU\b/, `«BAU» no va en ${nombre}`);
  }
});

test('el juez también pregunta, y con el mismo par de ejemplos', () => {
  assert.match(CRITERIO_JUEZ_SYSTEM_TEMPLATE, /CUARTA pregunta del criterio/, 'el juez no hace la cuarta pregunta');
  assert.match(CRITERIO_JUEZ_SYSTEM_TEMPLATE, /implementar la cadencia de juntas/i, 'al juez le falta el caso que se confunde');
  assert.match(CRITERIO_JUEZ_SYSTEM_TEMPLATE, /SIGUE siendo "compromiso"/, 'el juez tiene que saber que no la baja de cubeta');
});

// ── Capa 3: que el campo VIAJE ───────────────────────────────────────────────────────

test('el extractor lo LEE, y no con `!!`', () => {
  // `!!o.recurrente` sobre el JSON de un modelo convierte `"false"` en true. El parser
  // pasa por la misma función que todo lo demás, que es lo que hace que la regla sea una.
  assert.match(FATHOM, /recurrente: decidirRecurrente\(o\.recurrente\)\.recurrente/, 'coerceCandidatas no sanea recurrente');
  assert.doesNotMatch(FATHOM, /recurrente: !!o\.recurrente/, 'volvió el `!!` sobre la respuesta del modelo');
  assert.match(FATHOM, /recurrente\?: boolean;/, 'TareaCandidata no declara el campo: lo que no está en el tipo se cae en el map');
});

test('LA CADENA NO SE CORTA EN NINGÚN MAPEO INTERMEDIO', () => {
  // Los tres caminos por los que una extracción se vuelve borrador. Cada uno es un `map`
  // escrito a mano, y un `map` a mano es exactamente donde se perdió el `minuto` en agosto:
  // el modelo lo escribía, el tipo lo declaraba, y nadie lo copiaba.
  //   · reunión leída a mano desde el modal  → app/api/plan-fathom/route.ts
  //   · el cron que lee las reuniones nuevas → lib/reunion-auto.ts   (por acá entra la mayoría)
  //   · un acta subida como archivo          → lib/importar-en-segundo-plano.ts
  for (const [donde, src] of [
    ['app/api/plan-fathom/route.ts', ROUTE],
    ['lib/reunion-auto.ts', AUTO],
    ['lib/importar-en-segundo-plano.ts', IMPORTAR],
  ] as const) {
    assert.match(src, /recurrente: t\.recurrente/, `${donde} no copia «recurrente» al borrador`);
  }
  // Y el borrador lo declara y lo persiste: sin esto, el `map` copia a la nada.
  assert.match(PROPUESTA, /recurrente\?: boolean;/, 'PropuestaTarea no declara el campo');
});

test('el ALTA lo pasa en los DOS tableros, que es donde la tarea nace', () => {
  // El del dueño (plan_tareas, vía NuevaTareaPlan) y el del cliente (experimento_tareas,
  // vía crearTarea). Los dos tienen la columna desde la mig 0163: una tarea puede nacer
  // recurrente en los dos o en ninguno.
  assert.match(
    PROPUESTA,
    /agregarTareasPlanOwner\(base\.map\([\s\S]{0,400}?recurrente: t\.recurrente/,
    'el alta del tablero del dueño no pasa recurrente',
  );
  assert.match(
    PROPUESTA,
    /crearTarea\(\{[\s\S]{0,800}?recurrente: t\.recurrente/,
    'el alta del tablero del cliente no pasa recurrente',
  );
});

test('la segunda capa corre en el CHOKE POINT, y el descarte deja rastro', () => {
  // `limpiarTarea` es por donde pasan TODOS los productores de un borrador y también la
  // relectura de la fila. Poner la regla en cada productor la deja escrita N veces y
  // rompible en el N+1.
  assert.match(PROPUESTA, /const rec = decidirRecurrente\(o\.recurrente, deadline\);/, 'limpiarTarea no aplica el desempate');
  assert.match(PROPUESTA, /recurrente: rec\.recurrente \|\| undefined/, 'limpiarTarea no escribe el resultado saneado');
  // Un `continue` mudo hace indistinguibles «no llegó» de «lo tiramos nosotros».
  assert.match(PROPUESTA, /if \(rec\.conflicto\)[\s\S]{0,200}?console\.warn/, 'el conflicto se descarta sin dejar rastro');
});

// ── El criterio: qué NO se tocó, y por qué ───────────────────────────────────────────

test('«se repite» NO es una cubeta ni una regla nueva del criterio', () => {
  // Una reunión de los miércoles es un compromiso de verdad: alguien con nombre dijo que
  // la iba a sostener. Lo que cambia no es su cubeta —no es «descartado» ni «fuera»— sino
  // que no compite en el ranking. Meterla como cubeta la sacaría del tablero, que es lo
  // contrario de lo que se decidió.
  assert.deepEqual([...CUBETAS], ['compromiso', 'acuerdo_interno', 'descartado', 'fuera']);
  // Y el enum de reglas es DE MAURICIO: sus cinco numeradas. El '4' ya es suyo (el dueño
  // sugirió y el otro aceptó más adelante), así que no hay un id libre que tomar — y
  // pisarlo sería reescribir su criterio para meter el nuestro.
  const REGLAS = leer('lib', 'plan-criterio-reglas.ts');
  assert.match(REGLAS, /export type ReglaCriterio = '1' \| '2' \| '3' \| '4' \| '5' \| 'definicion' \| 'contexto';/, 'alguien tocó los ids de las reglas de Mauricio');
  assert.match(REGLAS, /EL '4' YA ESTÁ TOMADO/, 'falta escrito por qué no se agrega una regla');
});
