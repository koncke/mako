// =============================================================================
// tests/editor-landing-barra-agencia.test.ts — la barra de la agencia no tapa el editor
// =============================================================================
// Medido el 14/10/2026 en el Chrome de Martín, viendo un cliente como administrador: la barra
// fija «Estás viendo el dashboard de…» (50 px, app/globals.css → --barra-agencia) le reserva su
// alto al body con padding-top, y el editor medía 100dvh ENTERO. El documento scrolleaba 50 px y
// la barra tapaba la de arriba del editor, con Publicar incluido; en el Panel, el título.
//
// Fija que los altos de pantalla completa del Landing Generator descuentan --barra-agencia.
//
// ── Roturas (14/10/2026, a mano y restauradas; base en verde: 3 pasan, 0 fallan) ──
//   · .gma-app con height: 100dvh pelado ........................................ 2 / 1
//   · .gp-panel con min-height: 100vh pelado .................................... 2 / 1
//   · .gp-velo con padding: 16px pelado ......................................... 2 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const leer = (r: string) => readFileSync(join(__dirname, '..', r), 'utf8').replace(/\r\n/g, '\n');
/** El bloque de una regla CSS, desde su selector hasta la llave que la cierra. */
const regla = (src: string, selector: string): string => {
  const i = src.indexOf(selector);
  assert.ok(i >= 0, `no encontré ${selector}`);
  return src.slice(i, src.indexOf('}', i));
};

test('el editor (.gma-app) descuenta la barra de la agencia en sus dos altos', () => {
  const r = regla(leer('app/landing-generator/gamma.css'), '.gma-app {');
  assert.match(r, /height: calc\(100vh - var\(--barra-agencia, 0px\)\)/);
  assert.match(r, /height: calc\(100dvh - var\(--barra-agencia, 0px\)\)/);
  assert.doesNotMatch(r, /height: 100d?vh;/);
});

test('el Panel (.gp-panel) descuenta la barra de la agencia', () => {
  const r = regla(leer('app/landing-generator/Inicio.tsx'), '.gp.gp-panel {');
  assert.match(r, /min-height: calc\(100vh - var\(--barra-agencia, 0px\)\)/);
});

test('el velo de los diálogos arranca debajo de la barra y el diálogo la descuenta', () => {
  const src = leer('app/landing-generator/MiniaturaLanding.tsx');
  assert.match(regla(src, '.gp .gp-velo {'), /padding: calc\(16px \+ var\(--barra-agencia, 0px\)\)/);
  assert.match(regla(src, '.gp .gp-dialogo {'), /max-height: calc\(100vh - 32px - var\(--barra-agencia, 0px\)\)/);
});
