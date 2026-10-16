// =============================================================================
// LA PUNTA DE LA FLECHA SE AGARRA Y SE SUELTA (15/10/2026, el 1 de las doce de Martín)
// =============================================================================
// «En Automatios, cuando agarro el extremo de la flecha, no donde está el +, sino donde esta la punta de la flecha, si
// la saco se bugea, se queda trabada y no se puede mover más, ni apretando esc.»
//
// La causa (app/_components/Lienzo.tsx): la lista de puntas se dibujaba con `!arrastreFlecha && …`. Al volverse
// arrastre (`moverCirculo` → `setArrastreFlecha`), se DESMONTABA entera, incluida la punta que tenía el puntero
// capturado: el `pointerup` no le llegaba a nadie, `soltarCirculo` no corría y `arrastreFlecha` quedaba puesto para
// siempre. Esc sólo cancelaba «Conectar a una tarjeta», no este gesto.
//
// No hay DOM en los tests de esta casa (sin jsdom): se fija el fuente. Lo visual se mira en el navegador.
//
// ⚠️ PROBADO ROMPIENDO (15/10/2026, scratchpad romper-punta.mjs; base 4 pass / 0 fail). El resultado MEDIDO de cada
// rotura, al lado de su test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const LIENZO = readFileSync(new URL('../app/_components/Lienzo.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

// rotura 1 (volver a `!arrastreFlecha && grafo.aristas.map`): 3 pass / 1 fail, cae éste.
test('durante un arrastre se esconden las puntas MENOS la llevada', () => {
  // (Las zonas del medio de cada flecha sí se esconden enteras: ésas no capturan el puntero de un arrastre.)
  assert.doesNotMatch(LIENZO, /onReconectar && !revelando && !arrastreFlecha/, 'la lista de puntas ya no depende del arrastre');
  assert.match(LIENZO, /onReconectar && !revelando && grafo\.aristas\.map\(\(a, i\) => \{\n\s*if \(arrastreFlecha && arrastreFlecha\.indice !== i\) return null;/);
});

// rotura 2 (sin el listener de `pointerup` en la ventana): 3 pass / 1 fail, cae éste.
test('si el pointerup no le llega a la punta, lo termina la ventana', () => {
  const red = LIENZO.slice(LIENZO.indexOf('LA RED DEL ARRASTRE DE UNA FLECHA'), LIENZO.indexOf('/** Arranca «Conectar a una tarjeta»'));
  assert.ok(red.length > 0, 'la red existe');
  assert.match(red, /if \(!arrastreFlecha \|\| eligiendo\) return;/, 'vale mientras dura un arrastre (no en «Conectar a una tarjeta», que tiene la suya)');
  assert.match(red, /window\.addEventListener\('pointerup', soltar\)/);
  assert.match(red, /const soltar = \(e: PointerEvent\) => \{ if \(gestoFlecha\.current\) soltarCirculo\(/, 'si React ya soltó, `gestoFlecha` está en null y no corre dos veces');
});

// rotura 3 (Esc sin limpiar `arrastreFlecha`): 3 pass / 1 fail, cae éste.
test('Esc cancela el arrastre de una flecha', () => {
  const red = LIENZO.slice(LIENZO.indexOf('LA RED DEL ARRASTRE DE UNA FLECHA'), LIENZO.indexOf('/** Arranca «Conectar a una tarjeta»'));
  assert.match(red, /if \(e\.key !== 'Escape'\) return;\n\s*e\.preventDefault\(\);\n\s*gestoFlecha\.current = null;\n\s*setArrastreFlecha\(null\); setSobreFlecha\(null\);/);
  assert.match(red, /window\.addEventListener\('keydown', tecla\)/);
});

// rotura 4 (`tarjetaBajo` con `elementFromPoint`, sin saltear la punta llevada): 3 pass / 1 fail, cae éste.
test('la tarjeta de destino se busca DEBAJO de la punta llevada', () => {
  assert.match(LIENZO, /document\.elementsFromPoint\(clientX, clientY\)\.find\(\(x\) => !x\.closest\('\[data-punta-flecha\]'\)\)/);
});
