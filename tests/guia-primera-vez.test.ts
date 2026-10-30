// =============================================================================
// La guía: la primera vez de cada persona en cada pestaña (29/10/2026, G1 de docs/mako-iniciativa/guia.md §3.1)
// =============================================================================
//   1. sin saber lo visto, no se pregunta (`null`); con la marca de la tab, la de `guia-ninguna` o la del recorrido viejo que la
//      reemplaza (`sb-inicio` para el Ops Center), tampoco;
//   2. contestar marca la tab; «Ya sé usarla» además su `sabe`, y al tercero `guia-ninguna` (no pregunta más en ninguna);
//   3. las marcas pasan la validación de /api/recorridos (sin migración: viven en `perfil.recorridos`, como los recorridos).
//
// Correr: node --import tsx --test tests/guia-primera-vez.test.ts
// PROBADO ROMPIÉNDOLO (base 3/0), ver la cosecha (docs/hallazgos-ui.md).
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { ID_NINGUNA, YA_VISTO_POR, idGuia, idSabe, marcasAlContestar, yaLaVio } from '../lib/guia/primera-vez';
import { CATALOGOS } from '../lib/guia/catalogo';
import { idRecorridoValido } from '../lib/recorridos';

test('1. sin saber, no pregunta; ya vista, por su marca, por «ninguna» o por el recorrido viejo, tampoco', () => {
  assert.equal(yaLaVio(null, 'mako'), null);
  assert.equal(yaLaVio(new Set(), 'mako'), false);
  assert.equal(yaLaVio(new Set(['guia-mako']), 'mako'), true);
  assert.equal(yaLaVio(new Set([ID_NINGUNA]), 'crm'), true);
  assert.equal(yaLaVio(new Set(['sb-inicio']), 'mako'), true, 'quien hizo el tutorial del Ops Center ya lo conoce');
  assert.equal(yaLaVio(new Set(['dashboard-edicion']), 'graphics'), true);
  assert.equal(yaLaVio(new Set(['sb-inicio']), 'graphics'), false, 'el de otra tab no cuenta');
});

test('2. contestar marca la tab; «Ya sé usarla», su `sabe`, y al tercero ninguna', () => {
  assert.deepEqual(marcasAlContestar(new Set(), 'mako', false), ['guia-mako']);
  assert.deepEqual(marcasAlContestar(new Set(), 'mako', true), ['guia-mako', 'guia-sabe-mako']);
  assert.deepEqual(marcasAlContestar(new Set(['guia-sabe-crm']), 'mako', true), ['guia-mako', 'guia-sabe-mako']);
  assert.deepEqual(marcasAlContestar(new Set(['guia-sabe-crm', 'guia-sabe-graphics']), 'mako', true), ['guia-mako', 'guia-sabe-mako', ID_NINGUNA], 'el tercero');
  assert.deepEqual(marcasAlContestar(new Set(['guia-sabe-crm', 'guia-sabe-mako']), 'mako', true).includes(ID_NINGUNA), false, 'la misma tab dos veces no suma');
});

test('3. las marcas pasan la validación de /api/recorridos (viven en perfil.recorridos, sin migración)', () => {
  const keys = [...(CATALOGOS as readonly { key: string }[]).map((g) => g.key), ...Object.keys(YA_VISTO_POR), 'customer-success', 'video-editor'];
  for (const k of keys) {
    assert.ok(idRecorridoValido(idGuia(k)), idGuia(k));
    assert.ok(idRecorridoValido(idSabe(k)), idSabe(k));
  }
  assert.ok(idRecorridoValido(ID_NINGUNA));
});
