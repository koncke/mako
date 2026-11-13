// =============================================================================
// MaKo Mobile — SheetM en «medio»: el pie va ENCIMA de la lista, y el final de la lista se alcanza
// =============================================================================
// En «medio» el panel está corrido hacia abajo y el pie se corre hacia ARRIBA lo mismo (SheetM.aplicar), así que el
// pie queda encima del cuerpo. Dos defectos, medidos a 375×812 con una lista larga (13/11/2026, ticket #94, lo vio el
// chat de tickets en el Agency Dashboard):
//   1. Las filas (`.m-fila`, z-index 1) pintaban por ENCIMA del pie: `elementFromPoint` en el centro de «Entrar a su
//      cuenta» devolvía una `.m-fila--toca` y el toque no llegaba al botón (0 toques; en «alto», 1).
//   2. Lo último de la lista quedaba FUERA de la pantalla: scrolleada hasta el final, la última fila iba en 1014–1074
//      con la pantalla en 812. Ahora, en «medio», tirar hacia arriba desde el cuerpo (o la rueda) primero la agranda.
//
// Verificado ROMPIÉNDOLO (13/11/2026; base 3 / 0), de a una y restaurando:
//   · sin `isolation: isolate` en el cuerpo: 2 / 1.   · sin `z-index` en el pie: 2 / 1.
//   · `if (p.dy < 0) return false;` en cuerpoMueveElSheet: 2 / 1.
//   · la condición vieja en SheetM (`dy <= 0 || c.scrollTop > 0`): 2 / 1.   · sin el listener de la rueda: 2 / 1.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cuerpoMueveElSheet } from '../app/m/_ui/gestos';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

/** Las declaraciones de la regla cuyo selector es exactamente `sel`. */
function regla(css: string, sel: string): string {
  const r = [...css.matchAll(/([^{}]*)\{([^}]*)\}/g)].find((m) => m[1].trim() === sel);
  assert.ok(r, `no encontré la regla ${sel} en m.css`);
  return r[2];
}

test('1. el pie pinta encima del cuerpo: ninguna fila con z-index se le sube', () => {
  const css = leer('app/m/m.css');
  assert.match(regla(css, '.m-sheet__cuerpo'), /isolation\s*:\s*isolate/, 'el cuerpo es una capa propia: sus z-index no salen de ahí');
  const pie = regla(css, '.m-sheet__pie');
  assert.match(pie, /position\s*:\s*relative/, 'el pie va posicionado para que su z-index cuente');
  assert.match(pie, /z-index\s*:\s*[1-9]/, 'el pie va por encima de la capa del cuerpo');
});

test('2. desde el cuerpo: abajo sólo arriba de todo; arriba sólo en «medio»', () => {
  // Hacia abajo (dy > 0): mueve la hoja sólo con la lista arriba de todo.
  assert.equal(cuerpoMueveElSheet({ dy: 12, scrollTop: 0, enMedio: true }), true);
  assert.equal(cuerpoMueveElSheet({ dy: 12, scrollTop: 0, enMedio: false }), true);
  assert.equal(cuerpoMueveElSheet({ dy: 12, scrollTop: 40, enMedio: true }), false, 'con la lista scrolleada, abajo scrollea');
  // Hacia arriba (dy < 0): en «medio» la agranda; en «alto» scrollea.
  assert.equal(cuerpoMueveElSheet({ dy: -12, scrollTop: 0, enMedio: true }), true, 'en «medio», primero se agranda');
  assert.equal(cuerpoMueveElSheet({ dy: -12, scrollTop: 0, enMedio: false }), false, 'en «alto», scrollea');
  assert.equal(cuerpoMueveElSheet({ dy: -12, scrollTop: 80, enMedio: false }), false);
  assert.equal(cuerpoMueveElSheet({ dy: 0, scrollTop: 0, enMedio: true }), false);
});

test('3. SheetM decide con cuerpoMueveElSheet, y la rueda en «medio» la agranda', () => {
  const sheet = leer('app/m/_ui/SheetM.tsx');
  assert.match(sheet, /cuerpoMueveElSheet\(\{\s*dy,\s*scrollTop:\s*c\.scrollTop,\s*enMedio:\s*enMedio\(\)\s*\}\)/, 'el arrastre desde el cuerpo decide con cuerpoMueveElSheet');
  assert.doesNotMatch(sheet, /dy <= 0 \|\| c\.scrollTop > 0/, 'la condición vieja no deja tirar hacia arriba en «medio»');
  assert.match(sheet, /const enMedio = \(\) => actual\.current === 'medio' && permitidosRef\.current\.includes\('alto'\)/);
  assert.match(sheet, /addEventListener\('wheel', rueda, \{ passive: false \}\)/, 'la rueda tiene que poder frenar el scroll');
  assert.match(sheet, /removeEventListener\('wheel', rueda\)/);
  const rueda = sheet.slice(sheet.indexOf('const rueda'), sheet.indexOf("c.addEventListener('touchstart'"));
  assert.match(rueda, /e\.deltaY <= 0[^\n]*!enMedio\(\)\) return/, 'sólo bajando la lista y sólo en «medio»');
  assert.match(rueda, /actual\.current = 'alto'/);
});
