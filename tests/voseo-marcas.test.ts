// =============================================================================
// La segunda capa de la voz (`marcasDeVoseo`) mide con el MISMO generador que el guard del repo
// =============================================================================
// Hasta el 29/10/2026, `marcasDeVoseo` (lib/puestas-data.ts) era una lista de 21 palabras: «Escribime por mensaje»,
// «Agendá tu llamada», «Mandame un audio» y «Decime qué querés» (salvo «querés») pasaban como neutros por el
// Copywriter, el Video Planner, flujo-ia, mako-redacta y las variaciones del Media Buyer. El generador de formas
// (de los verbos, no de una lista) ya existía adentro del guard del repo (tests/puente-panel-copy.test.ts); se mudó a
// lib/voseo.ts para que las dos puntas usen la misma regla. Fija:
//   · las formas que faltaban (imperativos con clítico, agudos en -á/-é/-í, presentes en -ás/-és/-ís);
//   · que nada de lo que la lista vieja veía se pierde;
//   · que lo neutro sigue limpio: pretéritos de 1.ª persona, futuros de tú, «más», «papá», «está», nombres y gentilicios.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { marcasDeVoseo } from '../lib/puestas-data';
import { marcasDeVoseo as directa, NEUTRO } from '../lib/voseo';

const leer = (r: string) => readFileSync(join(__dirname, '..', r), 'utf8').replace(/\r\n/g, '\n');

test('las que pasaban limpias: imperativos con clítico, agudos y presentes de vos', () => {
  assert.deepEqual(marcasDeVoseo('Escribime por mensaje'), ['escribime']);
  assert.deepEqual(marcasDeVoseo('Agendá tu llamada'), ['agendá']);
  assert.deepEqual(marcasDeVoseo('Mandame un audio'), ['mandame']);
  assert.deepEqual(marcasDeVoseo('Decime qué querés'), ['decime', 'querés']);
  // Sus parientes: la llamada a la acción de todos los días.
  assert.deepEqual(marcasDeVoseo('Suscribite, inscribite o registrate hoy'), ['suscribite', 'inscribite', 'registrate']);
  assert.deepEqual(marcasDeVoseo('Escuchá esto: ¿sabés cuánto perdés?'), ['escuchá', 'sabés', 'perdés']);
  assert.deepEqual(marcasDeVoseo('Contanos tu caso y pedime el link'), ['contanos', 'pedime']);
  assert.deepEqual(marcasDeVoseo('Necesitás clientes: avisame y lo armamos'), ['necesitás', 'avisame']);
  assert.deepEqual(marcasDeVoseo('Probalo gratis, compartilo y sumate'), ['probalo', 'compartilo', 'sumate']);
});

test('nada de lo que la lista vieja veía se pierde', () => {
  const vieja = 'vos sos tenés querés podés sabés hacés venís decís ponés elegís andá tocá mandá fijate acordate dejá mirá escuchá contame acá'.split(' ');
  const sinVer = vieja.filter((w) => marcasDeVoseo(`Una frase con ${w} en el medio.`).length === 0);
  assert.deepEqual(sinVer, [], 'formas que la lista de antes marcaba y el generador no');
  // Con mayúscula inicial y pegada a la puntuación, como llega de la IA.
  assert.deepEqual(marcasDeVoseo('«Tocá acá», dijo. ¡Mirá!'), ['tocá', 'acá', 'mirá']);
});

test('lo neutro sigue limpio (un falso positivo descarta el texto de la IA)', () => {
  const neutros = [
    'Ya está: más fácil para papá y mamá, desde el sofá. Estás a un paso.',
    'Elegí este curso, viví la experiencia y escribí mi historia.', // pretérito de 1.ª persona, no imperativo
    'Verás resultados, tendrás clientes y podrás cobrar más.', // futuro de tú
    'Clases en inglés y francés, después de tu interés; en tu país.',
    'Tomás, de Monterrey, y Andrés colorean un mandala con chocolate y tomate.',
    'Escríbeme, agenda, mándame, dime, suscríbete y regístrate.', // el imperativo de tú
    'Dame un minuto, date cuenta y dale clic.',
    'Si quieres, puedes empezar hoy: tienes todo lo que necesitas.',
  ];
  for (const t of neutros) assert.deepEqual(marcasDeVoseo(t), [], t);
});

test('una sola regla: puestas-data re-exporta la de lib/voseo.ts, y el guard del repo importa de ahí', () => {
  assert.equal(marcasDeVoseo, directa, 'dos detectores distintos vuelven a desfasarse');
  assert.ok(NEUTRO.size > 3000, `el generador armó ${NEUTRO.size} formas: no corrió`);
  assert.match(leer('lib/puestas-data.ts'), /^export \{ marcasDeVoseo \} from '\.\/voseo';$/m);
  assert.doesNotMatch(leer('lib/puestas-data.ts'), /const VOSEO = /, 'la lista vieja no vuelve');
  assert.match(leer('tests/puente-panel-copy.test.ts'), /from '\.\.\/lib\/voseo';/);
});

// ── Probado ROMPIÉNDOLO (29/10/2026) ──────────────────────────────────────────
// Sano: 4 / 0. Rota, una por vez y restaurando (cada una hace fallar al menos un test):
//   · puestas-data vuelve a una lista propia (1 / 3)   · sin «escuchar» en los verbos (2 / 2)
//   · sin «saber» en los verbos (2 / 2)                · «suscribir» sin el clítico te (3 / 1)
//   · «Tomás» deja de ser homógrafo (3 / 1)            · el imperativo pelado de «elegir» (3 / 1)
//   · las marcas sin pasar a minúscula (2 / 2)
// Y con el detector nuevo, el guard del repo marcó UNA forma viva: «registrate» en lib/guion-cierre.ts, una entrada
// repetida (la lista se compara sin tildes, así que ya estaba «regístrate»). Se sacó la entrada, no se tocó la regla.
