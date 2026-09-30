// =============================================================================
// El consenso de las TRES corridas del juez del criterio
// =============================================================================
// EL PEDIDO, textual, del documento que Mauricio entregó el 8/9/2026: «Tres corridas
// del mismo transcript y unión de las tres. No es opcional: una corrida suelta pierde
// entre 5 y 8 puntos de recall contra la unión.» El juez hacía UNA.
//
// Y su advertencia más fuerte, que es lo que estos tests cuidan de verdad: «Emparejar
// compromisos por parecido de palabras no funciona y produce métricas falsas. "Análisis
// de la marca de empleador comparando ofertas de la competencia" y "benchmark de
// condiciones laborales frente a la competencia" son el mismo compromiso y casi no
// comparten vocabulario.» Acá el agrupamiento se hace por la CITA —que está verificada
// contra la transcripción, así que es una posición en el texto y no una paráfrasis— y
// el parecido de palabras queda como red secundaria.
//
// ⚠️ Y LA SEPARACIÓN QUE ESTUVO AL REVÉS UNAS HORAS DEL 30/09/2026, decidida por mí:
// los VEREDICTOS se unían igual que los faltantes, así que UNA corrida de tres diciendo
// «compromiso» le ganaba a DOS diciendo «descartado». Las tres corridas no eran
// neutras: estaban sesgadas a INCLUIR, y el número que inflaban es exactamente el que
// el dueño quiere bajar («que no cargue 70 tareas de una llamada»). La unión del
// documento es la del conjunto de compromisos ENCONTRADOS, no la de las
// clasificaciones — ENCONTRAR se une, CLASIFICAR se vota.
//
// ⚠️ Y EL TEST QUE LO CUIDABA PASÓ IGUAL CON LA MAYORÍA PUESTA, por la razón
// equivocada: su caso era 1 compromiso / 1 descartado / 1 fuera, o sea un EMPATE a
// tres, que la regla nueva resuelve a favor del más inclusivo. Verde sin medir nada de
// lo que su nombre decía. Por eso ahora el caso es 2 contra 1, y el empate tiene su
// propio test.
//
// ⚠️ PROBADO ROMPIÉNDOLO, siete veces (30/09/2026):
//   1. Cambiando el agrupamiento a solo léxico (`return mismaTarea(a.titulo, b.titulo)`
//      como única condición): falla 1 de 13 — justo el caso que el documento nombra,
//      dos redacciones del mismo compromiso sin vocabulario en común.
//   2. Sacando el corte por dueño de `elMismo`: falla 1 de 13 — los compromisos 4 y 5
//      del anexo de Mauricio comparten la cita entera y son DOS (regla 1).
//   3. Cambiando el voto de veredictos por «gana la primera corrida» (`vs[0]`):
//      fallan 2 de 13, y no da error: devuelve un veredicto perfectamente válido.
//   4. Poniendo `recurrente: vs.some((v) => v.recurrente)` (o sea, unión también en el
//      flag): falla 1 de 13. Una sola corrida dudosa le saca el deadline a un
//      compromiso real, y la regla del criterio dice «ante la duda, false».
//   5. Devolviendo la UNIÓN a los veredictos: falla 1 de 13 — el sesgo a incluir.
//   6. Rompiendo el empate ESCONDIENDO (la cubeta menos inclusiva): fallan 2 de 13.
//   7. Votando también los FALTANTES: falla 1 de 13 — ahí la unión SÍ es recall, y lo
//      que una sola corrida rescata del techo del extractor no existe en ningún lado.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { anclaDeCita, unirVeredictos, unirFaltantes, aporteDeCadaCorrida, VENTANA_ANCLA } from '../lib/plan-criterio-consenso';
import { transcriptParaCitas } from '../lib/plan-criterio-reglas';
import type { Veredicto, Faltante } from '../lib/plan-criterio-reglas';

// Un pedazo de reunión real de las que este juez lee: renglones `[hh:mm:ss] Nombre:`.
const TRANSCRIPT = [
  '[00:01:10] Mauricio: Voy a mandarles un video sobre el tema de estos, de estos se llama el cuadrante de los 3X',
  '[00:04:20] Director General: creo que hay que analizarlo Director Comercial, tú por tu lado yo por el mío, ya nos los mandó este Mauricio',
  '[00:09:02] Mauricio: Entonces te voy a mandar yo un correo con copia nomás al Director Comercial para que esté en contexto',
  '[00:31:40] Director General: me interesa que revisen el análisis de la marca de empleador comparando ofertas de la competencia antes del viernes',
].join('\n');
const NORM = transcriptParaCitas(TRANSCRIPT);

const V = (o: Partial<Veredicto>): Veredicto => ({
  cubeta: 'compromiso', regla: null, parteDe: null, razon: '', cita: null,
  tema: null, estado: null, recurrente: false, ...o,
});
const F = (o: Partial<Faltante>): Faltante => ({
  quien: 'Mauricio', titulo: '', producto: null, cubeta: 'compromiso',
  cita: '', tema: null, estado: null, razon: '', recurrente: false, ...o,
});

// ── El ancla ─────────────────────────────────────────────────────────────────

test('el ancla de una cita es DÓNDE se dijo, no cómo se escribió', () => {
  const a = anclaDeCita('Voy a mandarles un video sobre el tema de estos', NORM);
  const b = anclaDeCita('te voy a mandar yo un correo con copia', NORM);
  assert.ok(a >= 0 && b >= 0, 'no ubicó citas que están textuales en la transcripción');
  assert.ok(b > a, 'el correo se dijo DESPUÉS del video y el ancla dice lo contrario');
  assert.ok(b - a > VENTANA_ANCLA, 'dos momentos distintos caen dentro de la misma ventana');
});

test('una cita que no está devuelve -1, no cero', () => {
  // Cero es una posición válida (el arranque de la reunión): confundirlos haría que
  // todo lo no ubicable se agrupara con lo primero que se dijo.
  assert.equal(anclaDeCita('esto no lo dijo nadie en esta reunión jamás', NORM), -1);
});

// ── La unión de veredictos ───────────────────────────────────────────────────

test('EL QUE IMPORTA: la cubeta la decide la MAYORÍA, no la más inclusiva', () => {
  // ⚠️ ESTO ESTUVO AL REVÉS unas horas del 30/09/2026. Con la unión aplicada a los
  // veredictos, UNA corrida de tres diciendo «compromiso» le ganaba a DOS diciendo
  // «descartado»: las tres corridas no eran neutras, estaban sesgadas a INCLUIR, y el
  // número que inflaban es justo el que el dueño quiere bajar («que no cargue 70
  // tareas de una llamada»).
  const dosContraUna = unirVeredictos([
    [V({ cubeta: 'descartado', regla: '2', razon: 'no estaba presente' })],
    [V({ cubeta: 'compromiso', razon: 'lo prometió él', cita: 'te voy a mandar yo un correo' })],
    [V({ cubeta: 'descartado', regla: '2', razon: 'tampoco esta vez' })],
  ], 1);
  assert.equal(dosContraUna[0]?.cubeta, 'descartado', 'una corrida sola le ganó a dos: volvió la unión');

  // Y al revés: dos que lo ven como compromiso mandan sobre una que lo descarta.
  const alReves = unirVeredictos([
    [V({ cubeta: 'compromiso', razon: 'lo prometió' })],
    [V({ cubeta: 'descartado', regla: '2', razon: 'no' })],
    [V({ cubeta: 'compromiso', razon: 'lo prometió' })],
  ], 1);
  assert.equal(alReves[0]?.cubeta, 'compromiso');
});

test('el EMPATE se rompe a favor de MOSTRAR, que no es lo mismo que unir', () => {
  // Tres corridas, tres cubetas distintas: el modelo no sabe. Ahí entra tildada y
  // decide la persona — barato, porque el juez escribe en un BORRADOR que se revisa.
  // La asimetría es deliberada: una tarea destildada sólo se ve abriendo el borrador.
  const empate = unirVeredictos([
    [V({ cubeta: 'descartado', regla: '2', razon: 'no estaba presente' })],
    [V({ cubeta: 'compromiso', razon: 'lo prometió él' })],
    [V({ cubeta: 'fuera' })],
  ], 1);
  assert.equal(empate[0]?.cubeta, 'compromiso', 'el empate se rompió escondiendo');

  // Con DOS corridas (una falló) todo empate es 1-1 y no hay mayoría que sacar.
  const dos = unirVeredictos([[V({ cubeta: 'descartado', regla: '1', razon: 'x' })], [V({ cubeta: 'compromiso' })]], 1);
  assert.equal(dos[0]?.cubeta, 'compromiso');
});

test('los FALTANTES siguen UNIÉNDOSE: ahí la unión SÍ es recall', () => {
  // La separación entera: ENCONTRAR se une (lo que vio una corrida y las otras no es
  // recall gratis, y es el canal que ataca el techo del extractor), CLASIFICAR se vota.
  // Si esto se votara, un compromiso que el extractor perdió y que sólo una corrida
  // rescató no entraría nunca — y no hay a quién destildarle nada, porque no existe.
  const out = unirFaltantes([
    [F({ titulo: 'Mandar el video del cuadrante', cita: 'Voy a mandarles un video sobre el tema de estos' })],
    [],
    [],
  ], NORM);
  assert.equal(out.length, 1, 'un faltante que vio UNA sola corrida se perdió');
});

test('y el veredicto que gana viaja ENTERO: la razón y la cita son las de ESA lectura', () => {
  // Un veredicto armado con la cubeta de una corrida y la razón de otra no lo escribió
  // nadie, y lo que se lee en pantalla es la razón.
  const out = unirVeredictos([
    [V({ cubeta: 'descartado', regla: '2', razon: 'RAZÓN DE LA DESCARTADA', cita: 'ya nos los mandó este Mauricio' })],
    [V({ cubeta: 'compromiso', razon: 'RAZÓN DE LA BUENA', cita: 'te voy a mandar yo un correo' })],
  ], 1);
  assert.equal(out[0]?.razon, 'RAZÓN DE LA BUENA');
  assert.equal(out[0]?.cita, 'te voy a mandar yo un correo');
  assert.equal(out[0]?.regla, null, 'se coló la regla de la corrida que descartaba');
});

test('`recurrente` va por MAYORÍA ESTRICTA, no por unión: ante la duda, false', () => {
  const unaSola = unirVeredictos([
    [V({ recurrente: true })], [V({ recurrente: false })], [V({ recurrente: false })],
  ], 1);
  assert.equal(unaSola[0]?.recurrente, false, 'una corrida sola le saca el deadline a un compromiso real');

  const dosDeTres = unirVeredictos([
    [V({ recurrente: true })], [V({ recurrente: true })], [V({ recurrente: false })],
  ], 1);
  assert.equal(dosDeTres[0]?.recurrente, true, 'dos de tres no alcanzan para marcarla');

  const empate = unirVeredictos([[V({ recurrente: true })], [V({ recurrente: false })]], 1);
  assert.equal(empate[0]?.recurrente, false, 'el empate tiene que caer en false');
});

test('un índice que ninguna corrida juzgó queda null, no en una cubeta inventada', () => {
  // null río abajo significa «entra como siempre». Rellenarlo con `fuera` borraría del
  // borrador una tarea real porque el modelo se salteó un índice.
  const out = unirVeredictos([[null, V({})], [null, V({})]], 2);
  assert.equal(out[0], null);
  assert.equal(out[1]?.cubeta, 'compromiso');
});

// ── La unión de faltantes ────────────────────────────────────────────────────

test('EL QUE IMPORTA: dos redacciones SIN vocabulario en común, mismo momento → UNA', () => {
  // El caso exacto que el documento de Mauricio pone como advertencia. El parecido de
  // palabras no los junta; la cita sí, porque es una posición en la transcripción.
  const cita = 'revisen el análisis de la marca de empleador comparando ofertas de la competencia';
  const out = unirFaltantes([
    [F({ quien: 'Director General', titulo: 'Análisis de la marca de empleador comparando ofertas de la competencia', cita })],
    [F({ quien: 'Director General', titulo: 'Benchmark de condiciones laborales frente a la competencia', cita })],
  ], NORM);
  assert.equal(out.length, 1, 'quedaron dos tarjetas para el mismo compromiso');
});

test('la MISMA cita con DOS dueños son DOS compromisos (regla 1 del criterio)', () => {
  // Los compromisos 4 y 5 del anexo de Mauricio comparten la cita entera, y él lo deja
  // escrito: «una sola frase de la conversación produce dos compromisos, porque hay dos
  // dueños con una entrega propia cada uno».
  const cita = 'creo que hay que analizarlo Director Comercial, tú por tu lado yo por el mío';
  const out = unirFaltantes([[
    F({ quien: 'Director General', titulo: 'Dar retroalimentación sobre la tarjeta de puesto', cita }),
    F({ quien: 'Director Comercial', titulo: 'Dar retroalimentación sobre la tarjeta de puesto', cita }),
  ]], NORM);
  assert.equal(out.length, 2, 'se fundieron dos compromisos de dos personas distintas');
});

test('lo que sólo encontró la tercera corrida NO se pierde: para eso son tres', () => {
  const out = unirFaltantes([
    [F({ titulo: 'Mandar el video del cuadrante', cita: 'Voy a mandarles un video sobre el tema de estos' })],
    [F({ titulo: 'Mandar el video del cuadrante', cita: 'Voy a mandarles un video sobre el tema de estos' })],
    [F({ titulo: 'Mandar el correo con copia', cita: 'te voy a mandar yo un correo con copia' })],
  ], NORM);
  assert.equal(out.length, 2);
  assert.deepEqual(aporteDeCadaCorrida([
    [F({ titulo: 'Mandar el video del cuadrante', cita: 'Voy a mandarles un video sobre el tema de estos' })],
    [F({ titulo: 'Mandar el video del cuadrante', cita: 'Voy a mandarles un video sobre el tema de estos' })],
    [F({ titulo: 'Mandar el correo con copia', cita: 'te voy a mandar yo un correo con copia' })],
  ], NORM), [1, 0, 1], 'el log del aporte por corrida miente, que es peor que no tenerlo');
});

// ── El juez ──────────────────────────────────────────────────────────────────

const JUEZ = readFileSync(resolve(import.meta.dirname, '../lib/plan-criterio-juez.ts'), 'utf8');

test('el juez corre TRES veces y las corre en SERIE', () => {
  assert.match(JUEZ, /CORRIDAS_JUEZ = 3/, 'volvió a una sola corrida');
  assert.match(JUEZ, /for \(let k = 0; k < CORRIDAS_JUEZ; k\+\+\)/, 'el bucle de corridas no está');
  // ⚠️ En paralelo son tres llamadas grandes contra la misma key: 429 garantizado. Y
  // esta feature va con `fallback: []`, o sea que un 429 no degrada de modelo: FALLA.
  // Tres corridas paralelas que se pisan la cuota dejan una corrida buena, que es
  // exactamente lo que las tres venían a arreglar.
  assert.doesNotMatch(JUEZ, /Promise\.all/, 'las corridas salieron en paralelo');
});

test('NO PAGA, ni siquiera para cumplir el documento de Mauricio', () => {
  // Su configuración pide Claude Sonnet 5, y el dueño de este repo decidió lo
  // contrario y con todas las letras: «NO, JAMÁS algo pago para el plan» (30/09/2026).
  // El juez pide su modelo por `feature`, que resuelve en lib/model-catalogo.ts.
  assert.doesNotMatch(JUEZ, /model:\s*['"]claude-/, 'el juez cablea un modelo pago');
  assert.match(JUEZ, /feature: 'plan-criterio'/, 'el juez dejó de pedir su modelo por feature');
});
