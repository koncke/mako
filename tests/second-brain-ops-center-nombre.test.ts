// =============================================================================
// Para los negocios, la tab /second-brain se llama «Ops Center» (18/10/2026, Martín por el Cerebro)
// =============================================================================
// Los textos de MaKo que nombran el lugar («Ops Center → Persona», y lo que el chat le dice a MaKo de dónde está) usan
// el nombre que el negocio VE; la ruta (`/second-brain`), las keys y las constantes internas no cambian.
//
// Verificado ROMPIÉNDOLO (18/10/2026), contra la base en verde (3 / 0):
//   · `SB.tab` de vuelta en «Second Brain»: 2 / 1.
//   · el texto del chat diciendo «el Second Brain de MaKo»: 2 / 1.
//   · la ruta cambiada a «/ops-center»: 2 / 1.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DONDE_SE_EDITA, lugarSeccion, rutaSeccion } from '../lib/secciones-negocio';
import { CONTEXTO_SECOND_BRAIN } from '../lib/chat-mako-reglas';

test('el lugar se nombra «Ops Center» en todas las secciones', () => {
  for (const [s, d] of Object.entries(DONDE_SE_EDITA)) assert.equal(d.tab, 'Ops Center', s);
  assert.equal(lugarSeccion('archivero'), 'Ops Center → Documentos');
});

test('MaKo sabe que el chat central se llama «Ops Center»', () => {
  assert.match(CONTEXTO_SECOND_BRAIN, /el Ops Center de MaKo/);
  assert.ok(!/Second Brain/.test(CONTEXTO_SECOND_BRAIN), 'ningún «Second Brain» en lo que MaKo puede repetir');
});

test('la ruta y las keys siguen iguales', () => {
  assert.equal(rutaSeccion('persona'), '/second-brain?area=voz&vista=persona');
  assert.match(readFileSync(join(__dirname, '..', 'lib/chat-mako-reglas.ts'), 'utf8'), /export const CONTEXTO_SECOND_BRAIN = /);
});
