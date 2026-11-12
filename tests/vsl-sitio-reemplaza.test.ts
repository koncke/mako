// =============================================================================
// Las apps que MaKo reemplaza (app/vsl/_sitio/reemplaza.ts): cada una con su logo de verdad, y el número que se dice es el de la lista
// =============================================================================
// Martín (12/11/2026): «te quedaste muy corto con esas 8. Pero fíjate que siempre los logos sean los logos reales originales».
// Lo que se cuida: cada app tiene su archivo en public/vsl-assets/logos/apps/ (un logo que no está se ve como un recuadro blanco
// vacío), ninguna se repite, no entran las apps con las que MaKo se CONECTA (ésas no se reemplazan) y el titular de la comparación,
// y la tira de la portada dicen el mismo número («MaKo, en números» se fue el 12/11/2026).
// PROBADO ROMPIÉNDOLO (12/11/2026): un logo con el nombre mal escrito → 0 / 1; «Calendly» sumada a la lista → 0 / 1; el video de
// una tarjeta con el nombre mal escrito → 0 / 1.
// Correr: node --import tsx --test tests/vsl-sitio-reemplaza.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { STACK_QUE_REEMPLAZA, appsQueReemplaza } from '../app/vsl/_sitio/reemplaza';
import { LOGO_INTEGRACION, TARJETAS_PORTADA, filasDeComparacion, nAppsQueReemplaza } from '../app/vsl/_sitio/datos';

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

test('el número de la comparación es el de la lista, y cada trabajo lleva a su landing', () => {
  const n = nAppsQueReemplaza();
  assert.equal(n, appsQueReemplaza().length);
  for (const f of filasDeComparacion()) {
    assert.ok(f.apps.length > 0, `${f.trabajo}: sin apps`);
    assert.ok(f.href.startsWith('/vsl/') || f.href.startsWith('#fila-'), `${f.trabajo}: ${f.href}`);
  }
});

test('las grabaciones de «Todo lo que necesitas» y los logos de «Funciona con las apps que ya usas» están en disco', () => {
  for (const t of TARJETAS_PORTADA) {
    if (typeof t.visual !== 'object' || !('video' in t.visual)) continue;
    for (const f of [t.visual.video, t.visual.poster]) assert.ok(existsSync(join(RAIZ, 'public', f)), `${t.slug}: falta ${f}`);
  }
  for (const [id, f] of Object.entries(LOGO_INTEGRACION)) assert.ok(existsSync(join(RAIZ, 'public', 'vsl-assets', 'logos', 'integraciones', f)), `${id}: falta ${f}`);
});
