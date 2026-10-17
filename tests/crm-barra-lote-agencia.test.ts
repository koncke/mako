// =============================================================================
// #850: la barra de lote del tablero del CRM queda DEBAJO de la barra de agencia (17/10/2026)
// =============================================================================
// Al inspeccionar un negocio, la barra de agencia va fija arriba (`--barra-agencia`, app/globals.css), y la barra de
// lote del tablero (`sticky`, `top: 8`) quedaba tapada por ella. La anotó el chat Onboarding al arreglar el resto de
// #850 (la ficha y su cabecera). Lo que se fija: la barra se pega debajo de la de agencia, que vale 0 sin ella.
//
// PROBADO ROMPIÉNDOLO (17/10/2026): con `top: 8` otra vez → 0 / 1.
// Correr: node --import tsx --test tests/crm-barra-lote-agencia.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

test('la barra de lote se pega debajo de la barra de agencia', () => {
  const tablero = readFileSync(join(__dirname, '..', 'app/crm/CrmBoard.tsx'), 'utf8');
  assert.match(tablero, /<div style=\{\{ position: 'sticky', top: 'calc\(var\(--barra-agencia, 0px\) \+ 8px\)', zIndex: 20, marginBottom: 10 \}\}>\s*<AccionesLoteLeads/);
});
