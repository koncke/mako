// =============================================================================
// Las apps que MaKo reemplaza (app/vsl/_sitio/reemplaza.ts): cada una con su logo de verdad, y el número que se dice es el de la lista
// =============================================================================
// Martín (12/11/2026): «te quedaste muy corto con esas 8. Pero fíjate que siempre los logos sean los logos reales originales».
// Lo que se cuida: cada app tiene su archivo en public/vsl-assets/logos/apps/ (un logo que no está se ve como un recuadro blanco
// vacío), ninguna se repite, no entran las apps con las que MaKo se CONECTA (ésas no se reemplazan) y el titular de la comparación,
// la tira de la portada y «MaKo, en números» dicen el mismo número.
// PROBADO ROMPIÉNDOLO (12/11/2026): un logo con el nombre mal escrito → 0 / 1; «Calendly» sumada a la lista → 0 / 1.
// Correr: node --import tsx --test tests/vsl-sitio-reemplaza.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { STACK_QUE_REEMPLAZA, appsQueReemplaza } from '../app/vsl/_sitio/reemplaza';
import { filasDeComparacion, nAppsQueReemplaza, numerosDelSitio } from '../app/vsl/_sitio/datos';

const RAIZ = join(import.meta.dirname, '..');
const CONECTA = /calendly|cal\.com|fathom|stripe|mercado pago|zoom|whatsapp|meta ads|google/i;

test('cada app con su logo en disco, una sola vez, y ninguna de las que se conectan', () => {
  const todas = STACK_QUE_REEMPLAZA.flatMap((t) => t.apps);
  for (const a of todas) {
    assert.ok(existsSync(join(RAIZ, 'public', a.logo)), `${a.nombre}: falta ${a.logo}`);
    assert.doesNotMatch(a.nombre, CONECTA, `${a.nombre}: MaKo se conecta con ella, no la reemplaza`);
  }
  assert.equal(new Set(todas.map((a) => a.nombre)).size, todas.length, 'una app repetida');
  assert.ok(appsQueReemplaza().length >= 40, 'eran 8 y Martín pidió todas');
});

test('el número es el mismo en la comparación y en «MaKo, en números», y cada trabajo lleva a su landing', () => {
  const n = nAppsQueReemplaza();
  assert.equal(n, appsQueReemplaza().length);
  assert.ok(numerosDelSitio().some((x) => x.valor === String(n) && /reemplaza/.test(x.texto)), '«MaKo, en números» dice otro número');
  for (const f of filasDeComparacion()) {
    assert.ok(f.apps.length > 0, `${f.trabajo}: sin apps`);
    assert.ok(f.href.startsWith('/vsl/') || f.href.startsWith('#fila-'), `${f.trabajo}: ${f.href}`);
  }
});
