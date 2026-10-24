// =============================================================================
// El dictado en vivo no duplica lo dicho (24/10/2026) — app/plan/board/dictado-vivo.ts
// =============================================================================
// Martín, el 17/10: «El audio falla: cuando lo probé, se dicta y se duplica lo que dije. Revisalo.» El pedido no llegó a
// nadie (el cartero del Ops Center estaba caído) y el 24/10 le volvió a pasar: «Me grabé 1 sola vez el audio y salió así,
// un bug...», con un pedido que decía «continúa continúa con continúa con todo continúa con todo porque…».
//
// No repetía palabras sueltas: repetía el PREFIJO creciendo. El Chrome de Android (Martín usa Android) entrega cada
// resultado final con la frase ACUMULADA, y el dictado los pegaba uno atrás del otro como si fueran pedazos sueltos (que es
// lo que entrega Chrome de escritorio). Acá se simulan los dos navegadores con los eventos del reconocedor.
//
// Probado rompiéndolo (24/10/2026, con la base en 0 fallos):
//   · `sumarDictado` que sólo pega atrás (el código de antes)        → 4 fallos (1, 3, 4, 5);
//   · sin el caso «el nuevo empieza con lo acumulado»                  → 3 fallos (1, 3, 5);
//   · sin el caso «lo acumulado ya termina con el nuevo»               → 1 fallo (4);
//   · sin el caso «lo acumulado ya empieza con el nuevo»               → 1 fallo (3);
//   · comparando sin normalizar (mayúsculas, tildes y comas)           → 1 fallo (5).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sumarDictado, textoDelEvento, unirDictado } from '../app/plan/board/dictado-vivo';

type Res = [texto: string, final: boolean];
/** Un evento del reconocedor como lo entrega el navegador: desde `resultIndex`, cada resultado con su transcripción. */
function evento(resultIndex: number, resultados: Res[]) {
  const results = resultados.map(([texto, final]) => {
    const alt = { transcript: texto };
    return { isFinal: final, length: 1, item: () => alt, 0: alt };
  });
  return { resultIndex, results: Object.assign(results, { item: (i: number) => results[i] }) };
}
/** Corre una sesión de dictado entera y devuelve lo que se fue mostrando y lo que quedó firme. */
function sesion(eventos: ReturnType<typeof evento>[]) {
  let final = '';
  const mostrado: string[] = [];
  for (const e of eventos) {
    const t = textoDelEvento(final, e);
    final = t.final;
    mostrado.push(t.mostrar);
  }
  return { final, mostrado };
}

/** La frase que Martín dictó el 24/10, leída entre las repeticiones. */
const FRASE = 'continúa con todo porque no veo ningún solo chat trabajando en Ops Center desde mobile';
const PALABRAS = FRASE.split(' ');

test('1. Android: cada final trae la frase acumulada, y queda UNA vez (el dictado del 24/10)', () => {
  // Cada evento suma un resultado nuevo, final, con todo lo dicho hasta ahí (resultIndex apunta al nuevo).
  const prefijos = PALABRAS.map((_, i) => PALABRAS.slice(0, i + 1).join(' '));
  const eventos = prefijos.map((p, i) => evento(i, [...prefijos.slice(0, i).map((x): Res => [x, true]), [p, true]]));
  // El código de antes pegaba cada final atrás: así sale EXACTAMENTE lo que le llegó a Martín.
  const antes = prefijos.join(' ');
  assert.ok(antes.startsWith('continúa continúa con continúa con todo continúa con todo porque'), 'la simulación no reproduce el síntoma');
  assert.equal(sesion(eventos).final, FRASE);
});

test('2. Chrome de escritorio: los pedazos sueltos van uno atrás del otro', () => {
  const r = sesion([
    evento(0, [['hola', false]]),
    evento(0, [['hola', true]]),
    evento(1, [['hola', true], [' cómo', false]]),
    evento(1, [['hola', true], [' cómo estás', true]]),
    evento(2, [['hola', true], [' cómo estás', true], [' bien', true]]),
  ]);
  assert.equal(r.final, 'hola cómo estás bien');
  assert.deepEqual(r.mostrado, ['hola', 'hola', 'hola cómo', 'hola cómo estás', 'hola cómo estás bien']);
});

test('3. Android que reenvía todos los finales en cada evento (resultIndex 0): tampoco duplica', () => {
  const r = sesion([
    evento(0, [['continúa', true]]),
    evento(0, [['continúa', true], ['continúa con', true]]),
    evento(0, [['continúa', true], ['continúa con', true], ['continúa con todo', true]]),
  ]);
  assert.equal(r.final, 'continúa con todo');
});

test('4. un final que repite lo último que ya se vio no suma nada; el interino se muestra sin pegarse dos veces', () => {
  assert.equal(sumarDictado('hola cómo estás', 'cómo estás'), 'hola cómo estás');
  assert.equal(sumarDictado('hola', 'hola'), 'hola');
  const r = sesion([
    evento(0, [['continúa con', false]]),
    evento(0, [['continúa con todo', false]]),
    evento(0, [['continúa con todo', true]]),
  ]);
  assert.deepEqual(r.mostrado, ['continúa con', 'continúa con todo', 'continúa con todo']);
  assert.equal(r.final, 'continúa con todo');
});

test('5. entre un resultado y el siguiente cambian la mayúscula, una tilde o una coma: sigue siendo la misma frase', () => {
  assert.equal(sumarDictado('Continua con todo.', 'continúa con todo, porque'), 'continúa con todo, porque');
  assert.equal(sumarDictado('hola', 'Hola, ¿cómo estás?'), 'Hola, ¿cómo estás?');
  // Un pedazo distinto (escritorio) se pega con su espacio, sin comerse nada.
  assert.equal(sumarDictado('hola', 'cómo estás'), 'hola cómo estás');
  assert.equal(sumarDictado('', '  cómo estás '), 'cómo estás');
  assert.equal(sumarDictado('hola ', '   '), 'hola');
});

test('6. lo dictado se pega atrás de lo escrito, una vez (unirDictado, sin cambios)', () => {
  assert.equal(unirDictado('Escribí esto', 'y dicté esto'), 'Escribí esto y dicté esto');
  assert.equal(unirDictado('', 'sólo dictado'), 'sólo dictado');
  assert.equal(unirDictado('nada dictado ', ''), 'nada dictado ');
});

test('7. el hook usa la suma, no la concatenación de antes', async () => {
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const src = readFileSync(join(import.meta.dirname, '..', 'app/plan/board/dictado-vivo.ts'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(src, /r\.onresult = \(e\) => \{\s*const t = textoDelEvento\(finalRef\.current, e\);\s*finalRef\.current = t\.final;\s*cbTexto\.current\(t\.mostrar, false\);/);
  assert.doesNotMatch(src, /finalRef\.current = `\$\{finalRef\.current\} \$\{txt\}`/, 'volvió la concatenación que duplicaba en Android');
});
