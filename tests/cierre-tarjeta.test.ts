// =============================================================================
// La prueba de un cierre tiene UN tope: el que la persona vio al confirmar
// =============================================================================
// Medido el 06/10/2026 al cerrar el tablero del Chatbot: el borrador aceptaba una prueba de 400
// caracteres y el cierre cortaba el renglón entero del historial en 240 (219 para la prueba).
// Tres pruebas de 16 —227, 233 y 420 caracteres— habrían quedado partidas a la mitad en la
// tarjeta, sin error. Ver lib/cierre-tarjeta.ts y docs/hallazgos-plan.md → «Cerrar desde un
// script…».
//
// Probado rompiéndolo (07/10/2026), una rotura por vez y restaurando desde memoria: el renglón
// cortado otra vez en 240 (2 / 2), el corte sin «…» (3 / 1), el corte con un espacio colgando
// (3 / 1), el borrador con su propio número (3 / 1), cada uno de los dos escritores armando el
// renglón a mano (3 / 1 cada uno), la API con un 400 copiado (3 / 1) y otro prefijo (2 / 2).
// Restaurado: 4 / 0.
//
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TOPE_PRUEBA_CIERRE, recortarPrueba, renglonDeCierre } from '../lib/cierre-tarjeta';
import { DEFS } from '../lib/api-mako/areas/plan.def';

const leer = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
// Las líneas de comentario PRIMERO y los bloques después (ver AGENTS.md).
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const prueba = (n: number) => 'x'.repeat(n);

test('una prueba que entró al borrador queda ENTERA en el historial', () => {
  // Los tres largos medidos, y los bordes. Antes, todo lo que pasaba de 219 se cortaba.
  for (const n of [10, 219, 220, 227, 233, TOPE_PRUEBA_CIERRE]) {
    const p = recortarPrueba(prueba(n));
    assert.equal(p.length, n, `una prueba de ${n} caracteres se recortó en el borrador`);
    for (const parcial of [false, true]) {
      assert.ok(renglonDeCierre(p, parcial).endsWith(`: ${p}`), `una prueba de ${n} caracteres quedó partida en el renglón`);
    }
  }
});

test('si una prueba pasa del tope, el corte se VE', () => {
  // El 420 medido: se corta en el borrador —que es donde la persona lo lee antes de confirmar—
  // y termina en «…», no a mitad de palabra como si estuviera completa.
  // «palabr » mide 7 y 7 divide a 399: el corte cae JUSTO después de un espacio, que es el caso
  // en que sin el `trimEnd` quedaría «palabr …».
  const p = recortarPrueba(`${'palabr '.repeat(70)}fin`);
  assert.equal(p.length <= TOPE_PRUEBA_CIERRE, true);
  assert.ok(p.endsWith('…'), 'el corte no se marca');
  assert.ok(!p.endsWith(' …'), 'el corte deja un espacio colgando antes de los puntos');
  assert.equal(renglonDeCierre(prueba(420), false), `MaKo la marcó hecha: ${recortarPrueba(prueba(420))}`);
});

test('el prefijo es el que leen los demás', () => {
  // `MARCA_AUTO` (lib/todo-seeds.ts) reconoce los cierres automáticos por este texto.
  assert.ok(renglonDeCierre('prueba de diez', false).startsWith('MaKo la marcó hecha: '));
  assert.ok(renglonDeCierre('prueba de diez', true).startsWith('MaKo la dejó a medias: '));
  assert.match(leer('../lib/todo-seeds.ts'), /const MARCA_AUTO = 'MaKo la marcó hecha';/);
});

test('el saneo, los dos renglones y la API usan el MISMO tope', () => {
  const propuesta = sinComentarios(leer('../lib/plan-propuesta.ts'));
  const board = sinComentarios(leer('../lib/plan-board.ts'));
  assert.match(propuesta, /const evidencia = recortarPrueba\(str\(o\.evidencia\)\);/, 'el borrador volvió a topear la prueba con su propio número');
  assert.match(propuesta, /text: renglonDeCierre\(c\.evidencia, c\.parcial\)/, 'el cierre del cliente volvió a armar su propio renglón');
  assert.match(board, /const texto = renglonDeCierre\(evidencia, parcial\);/, 'el cierre del super admin volvió a armar su propio renglón');
  // Y nadie vuelve a armar el renglón a mano con un corte propio.
  for (const [nombre, src] of [['lib/plan-propuesta.ts', propuesta], ['lib/plan-board.ts', board]] as const) {
    assert.ok(!/MaKo la (?:marcó hecha|dejó a medias): \$\{/.test(src), `${nombre} arma el renglón del cierre a mano`);
  }
  // La API de MaKo le dice al modelo el mismo tope (no un 400 copiado a mano).
  const op = DEFS.find((d) => d.id === 'proponer_cierre_tareas');
  const ev = op?.parametros?.find((p) => p.nombre === 'cerrar')?.campos?.find((c) => c.nombre === 'evidencia');
  assert.equal(ev?.max, TOPE_PRUEBA_CIERRE);
  assert.match(sinComentarios(leer('../lib/api-mako/areas/plan.def.ts')), /max: TOPE_PRUEBA_CIERRE/, 'la API declara el tope con un número copiado');
});
