// =============================================================================
// El alta de un lead no acepta un funnel de OTRO negocio (17/10/2026)
// =============================================================================
// El id del funnel lo manda el navegador (el alta del tablero, la importación) o un webhook, y hasta el
// 17/10/2026 `createLead` lo escribía sin mirarlo: un id ajeno dejaba al lead colgado de un funnel de otro
// negocio, fuera de todos los tableros de éste y sin un error (docs/relevo/crm.md §0-Ω7). Ahora la casa
// pasa por `casaDelAlta` (lib/lead-funnel-reglas.ts) contra la fila leída CON el workspace.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { casaDelAlta } from '../lib/lead-funnel-reglas';

// Verificado rompiéndolo (el archivo da 2 / 0): `casaDelAlta` devolviendo `pedido` sin mirar la fila → 1 / 1
// (éste); sin el caso `es_default` → 1 / 1 (éste).
test('casaDelAlta: sólo un funnel de ESTE negocio; el del negocio, uno ajeno y uno ilegible nacen en NULL', () => {
  assert.equal(casaDelAlta(null, null), null, 'sin pedido: el del negocio');
  assert.equal(casaDelAlta(undefined, { id: 7 }), null);
  assert.equal(casaDelAlta(7, { id: 7, es_default: false }), 7, 'uno de acá: el pedido');
  assert.equal(casaDelAlta('7' as unknown as number, { id: '7' }), 7, 'el id puede venir como texto');
  assert.equal(casaDelAlta(7, null), null, 'no existe en este negocio (o es de otro): el del negocio');
  assert.equal(casaDelAlta(7, undefined), null, 'no se pudo leer: el del negocio, el alta no se pierde');
  assert.equal(casaDelAlta(7, { id: 8 }), null, 'una fila que no es la pedida no cuenta');
  assert.equal(casaDelAlta(1, { id: 1, es_default: true }), null, 'el del negocio con su id va NULL (casaParaEscribir)');
});

// Verificado rompiéndolo: `funnel_id: input.funnel_id ?? null` de vuelta en el insert → 1 / 1 (éste).
test('CABLEADO: createLead escribe la casa comprobada, leída con el workspace', () => {
  const src = readFileSync(join(import.meta.dirname, '../lib/leads.ts'), 'utf8').replace(/\r\n/g, '\n');
  const i = src.indexOf('export async function createLead(');
  const alta = src.slice(i, src.indexOf('\nexport ', i + 10));
  assert.match(alta, /const casa = await casaParaElAlta\(supabase, input\.funnel_id\);/);
  assert.match(alta, /funnel_id: casa,/);
  assert.doesNotMatch(alta, /funnel_id: input\.funnel_id/, 'el insert volvió a escribir el id que llegó');
  const ayuda = src.slice(src.indexOf('async function casaParaElAlta('), i);
  assert.match(ayuda, /\.from\('funnels'\)\.select\('id, es_default'\)\.eq\('id', pedido\)/);
  assert.match(ayuda, /return casaDelAlta\(pedido, fila\);/);
});
