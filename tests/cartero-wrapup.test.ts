// =============================================================================
// Un chat que cierra con `wrap_up` (y sin texto) igual llega al Ops Center, y su pregunta es un formulario (20/10/2026)
// =============================================================================
// Martín: «Debate me dice que espera mi respuesta, pero ya respondí... Y no veo que se esté utilizando la funcionalidad que
// creamos de respuestas múltiples en Ops Center». Medido: después de la respuesta de las 21:10Z, Debate cerró sus dos turnos
// SÓLO con herramientas (SendMessage y `mcp__ccd_turn__wrap_up` con `recap`, `ask` y `actions`), sin texto; el cartero subía
// sólo los bloques de texto y el último turno de Debate en MaKo quedó en las 20:58. El diagnóstico obvio («Debate no recibió
// la respuesta») era el equivocado. Lo que se fija (cartero 1.17.2):
//   1. un transcript con sólo `wrap_up` da UN turno con el resumen, y UNA pregunta con una opción por botón (título = label,
//      detalle = message, la primera recomendada), que MaKo acepta;
//   2. un `wrap_up` sin `ask` da sólo el turno; con un solo botón, el `ask` va como texto (no hay formulario de una opción);
//   3. releer da la MISMA pregunta (id fijo), y la de un `wrap_up` no se sube si el chat ya hizo esa pregunta con `preguntar`;
//   4. la vuelta las sube junto con las de `preguntar`.
//
// Probado rompiéndolo (20/10/2026, con la base en 0 fallos):
//   · turnosDeLineas sin leer el `wrap_up` (sólo texto, como antes) → 3 fallos (1, 2 y 3: el 3 también necesita la pregunta);
//   · el id de la pregunta al azar (randomUUID) → 1 fallo (3);
//   · `preguntasSinRepetir` sin mirar las de `preguntar` → 1 fallo (3).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sanearPregunta } from '../lib/centro-preguntas-chat';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const cartero = () => import('../scripts/operaciones/cartero.mjs');
const LOCAL = 'local_752add17-1111-4111-8111-111111111111';

const yo = (uuid: string, texto: string, at: string) => JSON.stringify({ type: 'user', uuid, timestamp: at, message: { role: 'user', content: texto } });
const usa = (uuid: string, at: string, nombre: string, input: unknown, id = `toolu_${uuid}`) =>
  JSON.stringify({ type: 'assistant', uuid, timestamp: at, message: { role: 'assistant', content: [{ type: 'tool_use', id, name: nombre, input }] } });
const fin = JSON.stringify({ type: 'system', subtype: 'stop_hook_summary', uuid: 'fin-1', timestamp: '2026-10-20T21:20:00Z' });
const WRAP = 'mcp__ccd_turn__wrap_up';
const cierre = {
  recap: 'Investigué dónde corre el Claude de cada cliente: hay dos caminos posibles.',
  ask: '¿Dónde corre el Claude de cada cliente?',
  actions: [
    { label: 'En su PC', message: 'Que corra en la PC del cliente, con su suscripción.' },
    { label: 'En la nube', message: 'Que corra en la nube de MaKo, con la key del cliente.' },
  ],
};

test('1. sólo con wrap_up: un turno con el resumen y una pregunta con un botón por opción', async () => {
  const { turnosDeLineas } = await cartero();
  const r = turnosDeLineas([
    yo('u-yo-0000001', 'Respondé el debate', '2026-10-20T21:10:00Z'),
    usa('u-el-0000001', '2026-10-20T21:12:00Z', 'SendMessage', { to: 'x', message: 'hola' }),
    usa('u-el-0000002', '2026-10-20T21:13:00Z', WRAP, cierre),
    fin,
  ]);
  const del = r.turnos.filter((t: { rol: string }) => t.rol === 'el');
  assert.equal(del.length, 1, 'un turno del chat');
  assert.equal(del[0].texto, cierre.recap, 'con su resumen (la pregunta va como formulario, no repetida en el texto)');
  assert.equal(r.preguntas.length, 1);
  const q = r.preguntas[0];
  assert.equal(q.pregunta, cierre.ask);
  assert.deepEqual(q.opciones, [
    { titulo: 'En su PC', detalle: 'Que corra en la PC del cliente, con su suscripción.' },
    { titulo: 'En la nube', detalle: 'Que corra en la nube de MaKo, con la key del cliente.' },
  ]);
  assert.equal(q.recomendada, 0);
  assert.ok(sanearPregunta({ ...q, local: LOCAL }), 'MaKo la acepta, con las mismas reglas que `preguntar`');
});

test('2. sin ask, sólo el turno; con un solo botón, el ask va como texto', async () => {
  const { turnosDeLineas } = await cartero();
  const sinAsk = turnosDeLineas([yo('u-yo-0000002', 'Seguí', '2026-10-20T21:10:00Z'), usa('u-el-0000003', '2026-10-20T21:13:00Z', WRAP, { recap: 'Listo el punto 4.' }), fin]);
  assert.deepEqual(sinAsk.turnos.filter((t: { rol: string }) => t.rol === 'el').map((t: { texto: string }) => t.texto), ['Listo el punto 4.']);
  assert.equal(sinAsk.preguntas.length, 0);
  const unBoton = turnosDeLineas([yo('u-yo-0000003', 'Seguí', '2026-10-20T21:10:00Z'),
    usa('u-el-0000004', '2026-10-20T21:13:00Z', WRAP, { recap: 'Hecho.', ask: '¿Lo subo?', actions: [{ label: 'Subilo' }] }), fin]);
  assert.equal(unBoton.preguntas.length, 0, 'no hay formulario de una sola opción');
  assert.equal(unBoton.turnos.filter((t: { rol: string }) => t.rol === 'el')[0].texto, 'Hecho.\n\n¿Lo subo?', 'la pregunta se lee igual');
});

test('3. releer da la misma pregunta, y no se repite la que el chat hizo con `preguntar`', async () => {
  const { turnosDeLineas, preguntasSinRepetir } = await cartero();
  const lineas = [yo('u-yo-0000004', 'x', '2026-10-20T21:10:00Z'), usa('u-el-0000005', '2026-10-20T21:13:00Z', WRAP, cierre, 'toolu_fijo'), fin];
  const a = turnosDeLineas(lineas).preguntas[0];
  const b = turnosDeLineas(lineas).preguntas[0];
  assert.equal(a.id, b.id, 'id fijo: MaKo no la duplica ni le pisa la respuesta (unirPreguntas se queda con la que tiene)');
  const deCierre = { ...a, local: LOCAL };
  const explicita = { ...a, id: '11111111-1111-4111-8111-111111111111', local: LOCAL, pregunta: '  ¿dónde corre el Claude de cada cliente?' };
  assert.deepEqual(preguntasSinRepetir([explicita], [deCierre]).map((q: { id: string }) => q.id), [explicita.id], 'la de `preguntar` gana');
  assert.equal(preguntasSinRepetir([], [deCierre, deCierre]).length, 1, 'y dos iguales del mismo chat van una vez');
  assert.equal(preguntasSinRepetir([{ ...explicita, local: 'local_22222222-2222-4222-8222-222222222222' }], [deCierre]).length, 2, 'la de otro chat no cuenta');
});

test('4. la vuelta sube las de los cierres junto con las de `preguntar`', () => {
  const s = leer('scripts/operaciones/cartero.mjs');
  // Desde la 1.17.3 (la revisión de caja-voz): la última de cada chat y el tope antes de mandar (tests/caja-voz-revision.test.ts).
  assert.match(s, /const \{ preguntas, sinLugar \} = preguntasParaSubir\(deArchivos, delaVuelta\.preguntas\);/);
  assert.match(s, /\.\.\.\(preguntas\.length \? \{ preguntas \} : \{\}\),/);
  assert.match(s, /export const VERSION = '1\.17\.3';/);
});
