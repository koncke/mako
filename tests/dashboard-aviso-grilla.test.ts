// =============================================================================
// Dashboard — un aviso ATRASADO de la grilla no pisa el deshacer (app/dashboard/aviso-grilla.ts)
// =============================================================================
// 10/11/2026, en producción (ws 3, hoja Closing): agrandar una tarjeta dos veces y apretar Ctrl+Z dos veces seguidas dejaba
// la tarjeta con el tamaño del paso de en medio y la pila de deshacer vacía. La grilla avisaba, con atraso, la posición del
// primer deshacer y el editor la escribía encima del segundo.
//
// Probado ROMPIÉNDOLO, de a una y restaurando:
//   · `mismasCajas` sin mirar `y` (un reordenamiento atrasado pasa por acomodo)        -> 3 / 1
//   · `alMoverGrilla` sin la guarda de `esAcomodoDe`                                   -> 3 / 1
//   · `alTerminarGesto` sin escribir la grilla final (el gesto no se guardaba)         -> 3 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { acomodoDe, esAcomodoDe, mismasCajas } from '../app/dashboard/aviso-grilla';

const caja = (i: string, x: number, y: number, w: number, h: number) => ({ i, x, y, w, h });
const COLS = 12;

test('el acomodo: lo que se le da, metido en las columnas y subido sin huecos', () => {
  const dado = [caja('a', 0, 0, 6, 4), caja('b', 0, 9, 6, 4), caja('c', 10, 0, 4, 2)];
  const a = acomodoDe(dado, COLS);
  assert.ok(mismasCajas(a, [caja('a', 0, 0, 6, 4), caja('b', 0, 4, 6, 4), caja('c', 8, 0, 4, 2)]), JSON.stringify(a));
  assert.equal(dado[1].y, 9, 'no toca lo que se le dio');
});

test('un aviso sin gesto que ES el acomodo de lo dado se escribe (al montar, al agregar o borrar una tarjeta)', () => {
  const dado = [caja('a', 0, 0, 6, 4), caja('b', 0, 9, 6, 4)];
  assert.equal(esAcomodoDe(acomodoDe(dado, COLS), dado, COLS), true);
  assert.equal(esAcomodoDe(dado.slice().reverse().map((c) => (c.i === 'b' ? { ...c, y: 4 } : c)), dado, COLS), true, 'el orden no importa');
});

test('el aviso ATRASADO del deshacer anterior no es el acomodo de lo dado: no se escribe', () => {
  // Lo que se ve en producción: el informe ya volvió a 260 (h 7), y la grilla avisa la tarjeta de 352 (h 10) del paso de antes.
  const dado = [caja('tasa', 0, 0, 7, 7), caja('desenlace', 7, 0, 5, 7), caja('ultimas', 7, 7, 5, 7)];
  const atrasado = [caja('tasa', 0, 0, 7, 7), caja('desenlace', 7, 0, 5, 10), caja('ultimas', 7, 10, 5, 7)];
  assert.equal(esAcomodoDe(atrasado, dado, COLS), false);
  // Y un reordenamiento atrasado (sólo cambia `y`): tampoco.
  const arriba = [caja('a', 0, 0, 6, 4), caja('b', 0, 4, 6, 4)];
  const atrasadoOrden = [caja('a', 0, 4, 6, 4), caja('b', 0, 0, 6, 4)];
  assert.equal(esAcomodoDe(atrasadoOrden, arriba, COLS), false);
  assert.equal(mismasCajas(arriba, arriba.slice(0, 1)), false, 'una tarjeta de menos no es la misma grilla');
});

test('el editor: fuera de un gesto sólo escribe el acomodo, y el final del gesto escribe su grilla', () => {
  const ed = readFileSync(join(__dirname, '..', 'app', 'dashboard', 'EditorInforme.tsx'), 'utf8').replace(/\r\n/g, '\n');
  const mover = ed.slice(ed.indexOf('const alMoverGrilla = useCallback('), ed.indexOf('}, [idHoja, editando]);'));
  assert.match(mover, /if \(!gestoRef\.current && !esAcomodoDe\(l, v\.dado, COLS\)\) return;/, 'un aviso atrasado pisa el deshacer');
  assert.match(ed, /const alTerminarGesto = useCallback\(\(l: Layout\) => \{ alMoverGrilla\(l\); gestoRef\.current = false;/, 'el final del gesto no se escribe');
  assert.match(ed, /const alEmpezarGesto = useCallback\(\(\) => \{ apilar\(tableroRef\.current\); gestoRef\.current = true;/);
  assert.match(ed, /dado: layout \}; \}\);/, 'lo dado tiene que ser lo que se le pasa a la grilla');
});
