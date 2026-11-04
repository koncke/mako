// =============================================================================
// La frase de la Acción del día achica hasta que el bloque entra (31/10/2026)
// =============================================================================
// Medido en producción, con una hoja guardada de 6 × 7 y 90 letras: a 1440 la frase daba 57 px en 4 líneas y el botón salía 18 px
// de la tarjeta. No fue la letra nueva: con Geist eran 5 líneas y 48 px. El tamaño salía sólo del ancho.
// Correr: node --import tsx --test tests/general-frase-que-entra.test.ts
// ROTURAS (31/10/2026, una por vez y restaurada; base 7 / 0): nunca achicar → 4 / 3; bajar del piso → 6 / 1; otro piso que el de la
// clase → 6 / 1; sin la caja en el `gb-centro` → 6 / 1; no medir al abrir el detalle → 6 / 1; `center` sin `safe` → 6 / 1.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PISO_FRASE, tamanoQueEntra } from '../app/general/bloques/frase-que-entra';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');

test('si entra con el tamaño de la tarjeta, no se toca y no se prueba otro', () => {
  const probados: number[] = [];
  assert.equal(tamanoQueEntra(57, PISO_FRASE, (px) => { probados.push(px); return false; }), 57);
  assert.deepEqual(probados, [57]);
});

test('elige el más grande que entra', () => {
  for (const limite of [24, 31, 40, 56]) assert.equal(tamanoQueEntra(57, PISO_FRASE, (px) => px > limite), limite, `límite ${limite}`);
});

test('si ni con el piso entra, se queda en el piso y nunca baja de ahí', () => {
  const probados: number[] = [];
  assert.equal(tamanoQueEntra(57, PISO_FRASE, (px) => { probados.push(px); return true; }), PISO_FRASE);
  assert.ok(probados.every((px) => px > PISO_FRASE), `probó ${probados.join(',')}`);
});

test('pocas preguntas: cada una acomoda la tarjeta de nuevo', () => {
  let veces = 0;
  tamanoQueEntra(60, PISO_FRASE, (px) => { veces++; return px > 33; });
  assert.ok(veces <= 7, `preguntó ${veces} veces`);
});

test('el piso es el de `.gb-frase`', () => {
  assert.match(leer('app/general/bloques/comun.tsx'), new RegExp(`\\.gb-frase\\{margin:0;font-size:clamp\\(${PISO_FRASE}px,`));
});

test('la Acción del día lo usa, en la caja que tiene su alto', () => {
  const t = leer('app/general/bloques/Meta.tsx');
  assert.match(t, /const caja = useFraseQueEntra\(`\$\{foco\.accion\}\|\$\{conRazon\}\|\$\{abierto\}`\);/);
  assert.match(t, /<div ref=\{caja\} className="gb-centro"[^>]*>\n\s*<p className="gb-frase">\{foco\.accion\}<\/p>/);
});

test('lo que igual no entra se va para abajo: nunca encima del título', () => {
  assert.match(leer('app/general/bloques/comun.tsx'), /\.gb-centro\{[^}]*justify-content:safe center\}/);
});
