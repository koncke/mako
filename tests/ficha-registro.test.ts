// =============================================================================
// El contrato de un bloque: el título que se dibuja y si se dibuja sin datos
// =============================================================================
// lib/ficha/registro.ts es lo que comparten el armador y los bloques de la tanda B2. Dos reglas del
// diseño (docs/diseno-ficha-bloques.md §3) viven ahí y se prueban EJECUTÁNDOLAS:
//   · «Cada bloque toma su título del nombre de la etapa y nunca dice "Reunión 1"».
//   · «Un bloque de sólo lectura sin datos no se dibuja. Uno editable se dibuja con «—»».
//
// Correr: npx tsx --test tests/ficha-registro.test.ts
//
// ⚠️ VERIFICADO ROMPIÉNDOLO (14/10/2026, base 2/0), cada rotura restaurada antes de la siguiente:
//   · `tituloDeBloque` con la etapa por su lugar en la lista y no por ser reunión  → 1 / 1
//   · `seDibuja` dibujando siempre (sin mirar `sinDatos`)                          → 1 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tituloDeBloque, seDibuja } from '../lib/ficha/registro';
import { bloqueDef } from '../lib/ficha/catalogo';

test('las reuniones se titulan con el nombre de SU etapa', () => {
  const etapas = [
    { key: 'lead', label: 'Lead entrante', kind: 'entrada' },
    { key: 'conversando', label: 'Conversación abierta', kind: 'paso' },
    { key: 'agenda', label: '1ª sesión sin costo', kind: 'reunion' },
    { key: 'facturando', label: 'Facturando', kind: 'pago' },
  ];
  assert.equal(tituloDeBloque(bloqueDef('reunion-1')!, etapas), '1ª sesión sin costo');
  assert.equal(tituloDeBloque(bloqueDef('reunion-2')!, etapas), 'Segunda reunión', 'sin segunda etapa de reunión, el del catálogo');
  assert.equal(tituloDeBloque(bloqueDef('cuotas')!, etapas), 'Cuotas');
  assert.equal(tituloDeBloque(bloqueDef('reunion-1')!, null), 'Primera reunión');
});

test('sin datos: lo de sólo lectura se calla, lo que se llena se dibuja', () => {
  assert.equal(seDibuja(bloqueDef('cobrado')!, null), false);
  assert.equal(seDibuja(bloqueDef('cobrado')!, { total: 1 }), true);
  assert.equal(seDibuja(bloqueDef('venta')!, null), true, 'la venta se llena ahí: va con «—»');
  assert.equal(seDibuja(bloqueDef('lo-que-contesto')!, [], (d) => (d?.length ?? 0) > 0), false, 'cada bloque puede decir qué es «sin datos»');
});
