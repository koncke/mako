// =============================================================================
// Automations: ninguna inicial se corta por índice (lo que quedaba del ticket #10, 27/10/2026)
// =============================================================================
// `nombre.trim()[0]` es la primera UNIDAD UTF-16, no el primer carácter: con «🚀 Ana» es media pieza del emoji, el server y
// el navegador dibujan cosas distintas y React tira #418. La cabecera de un DM (app/automations/social-ui.tsx) y el globo de
// «Probar» (app/automations/PanelProbar.tsx) sacaban así su inicial. Fija que en Automations las iniciales salen de
// `iniciales` (lib/unicode-seguro.ts) y que no queda ninguna cortada por índice.
// Correr: node --import tsx --test tests/automations-iniciales.test.ts
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { iniciales } from '../lib/unicode-seguro';

const DIR = join(__dirname, '..', 'app', 'automations');
const CORTE = /\.trim\(\)(\[0\]|\.charAt\(0\)|\.slice\(0, ?1\))/;

test('las iniciales de Automations salen de `iniciales`, nunca del primer «carácter» por índice', () => {
  const malos = readdirSync(DIR).filter((f) => /\.tsx?$/.test(f)).filter((f) => CORTE.test(readFileSync(join(DIR, f), 'utf8')));
  assert.deepEqual(malos, [], 'una inicial cortada por índice: un nombre con emoji rompe la pantalla (React #418)');
  for (const f of ['social-ui.tsx', 'PanelProbar.tsx']) {
    assert.match(readFileSync(join(DIR, f), 'utf8'), /import \{ iniciales \} from '@\/lib\/unicode-seguro';/, `${f} sin la pieza de la casa`);
  }
  // Una letra, como antes, y nunca media pieza de un emoji.
  assert.equal(iniciales('🚀 Ana', 1), 'A');
  assert.equal(iniciales('  ', 1, '·'), '·');
});

// ROTURAS (27/10/2026, una por vez y restaurada; base 1 / 0): la cabecera del DM vuelve a `nombre.trim()[0]` → 0 / 1; el globo
// de «Probar» también → 0 / 1.
