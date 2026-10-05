// =============================================================================
// El arrastre del CRM: la columna que se empuja es la de ABAJO del cursor
// =============================================================================
// Lo avisó la sesión de Customer Success al extraer la pieza del Plan, y en el CRM
// aplica porque cada columna scrollea por dentro (`maxHeight: 68vh` + `overflowY`):
// `useArrastreCopia` resuelve su scroller UNA sola vez, en el `dragstart`, con la
// tarjeta de ORIGEN. En /plan eso está bien —ahí scrollea la ventana—; acá empujaría
// la columna de la que salió la tarjeta y no la que estás mirando.
//
// Lo que se fija acá es la DECISIÓN (cuánto empujar), que es lo único que se puede
// equivocar sin que nadie lo note: el empuje en sí es un `scrollTop += d`.
//
// Correr: npx tsx --test tests/crm-arrastre-columna.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { empujeDeColumna } from '../app/crm/arrastre-columna';

/** ⚠️ Sin comentarios: un guard que busca una ausencia encuentra el párrafo que la explica. */
const soloCodigo = (src: string): string =>
  src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const CAJA = { top: 200, bottom: 800 };

test('en el medio de la columna NO se empuja', () => {
  // Si empujara siempre, la columna se desplazaría sola con sólo pasar por encima.
  assert.equal(empujeDeColumna(CAJA, 500), 0);
  assert.equal(empujeDeColumna(CAJA, 300), 0);
  assert.equal(empujeDeColumna(CAJA, 700), 0);
});

test('cerca del borde de ARRIBA empuja hacia arriba, y del de ABAJO hacia abajo', () => {
  assert.ok(empujeDeColumna(CAJA, 210) < 0, 'pegado al techo tiene que subir');
  assert.ok(empujeDeColumna(CAJA, 790) > 0, 'pegado al piso tiene que bajar');
});

test('⚠️ el borde se mide contra la CAJA, no contra la ventana', () => {
  // Es el bug que este test existe para cazar: con la ventana como referencia, una
  // columna que empieza a mitad de pantalla empuja cuando el cursor está lejos de
  // ella, y no empuja cuando está en su borde real.
  const abajo = { top: 600, bottom: 1000 };
  assert.equal(empujeDeColumna(abajo, 300), 0, 'un punto FUERA de la caja no empuja');
  assert.ok(empujeDeColumna(abajo, 610) < 0, 'el borde de ESTA caja sí empuja');
});

test('una columna más corta que dos bordes no se queda trabada empujando', () => {
  // Con 100 px de alto y bordes de 90, todo punto cae en los dos bordes a la vez.
  // Gana el de arriba, que es una decisión, no un empate: lo que no puede pasar es
  // que devuelva algo que no sea un número.
  const chica = { top: 0, bottom: 100 };
  assert.equal(typeof empujeDeColumna(chica, 50), 'number');
});

test('el empuje vive DENTRO del dragover, no en un rAF ni en un timer', () => {
  // Durante un arrastre nativo Chrome congela rAF y los timers: medido en esta casa,
  // 0 px en 1,2 s sobre el borde. Lo único que el navegador sigue entregando es
  // `dragover`, así que si alguien «mejora» esto moviéndolo a un rAF, deja de andar
  // y no falla: simplemente no scrollea.
  const src = soloCodigo(readFileSync('app/crm/CrmBoard.tsx', 'utf8'));
  const i = src.indexOf('empujeDeColumna(carril.getBoundingClientRect()');
  assert.ok(i > 0, 'el dragover de la columna no llama a empujeDeColumna');
  const bloque = src.slice(Math.max(0, i - 700), i + 200);
  assert.ok(!/requestAnimationFrame|setInterval|setTimeout/.test(bloque),
    'el empuje quedó detrás de un rAF o un timer: durante el arrastre no corren');
  assert.match(bloque, /onDragOver=\{\(e\) => \{/, 'el empuje tiene que colgar del dragover');
});

// Verificado ROMPIÉNDOLO, una por vez y restaurando:
//   · `empujeDeColumna` devolviendo siempre `paso`            → 3 fallos, 2 pases
//   · un punto FUERA de la caja devolviendo empuje (el bug real) → 1 fallo, 4 pases
//   · el empuje movido adentro de un requestAnimationFrame     → 1 fallo, 4 pases
// En verde: 5 pases, 0 fallos.
