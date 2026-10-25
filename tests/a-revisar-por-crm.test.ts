// =============================================================================
// «A revisar» trae sólo lo del CRM que se mira (24/10/2026)
// =============================================================================
// Martín, textual (punto 16 del 24/10): «El botón de "A revisar" no esta funcionando por CRM, cuando si debería... No debo
// estar en un CRM y que me traigan las notificaciones de otro.»
//   1. el corte (lib/a-revisar-filas.ts, `delCrm` y `crmPedido`), ejecutado;
//   2. el cableado: el panel manda el CRM del tablero, la ruta corta con él, y cada pendiente sabe su casa.
// PROBADO ROMPIÉNDOLO: ver el pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { crmPedido, delCrm } from '../lib/a-revisar-filas';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');

// El negocio tiene su funnel por defecto (id 1) y dos CRM más (7 y 9).
const items = [
  { lead_id: 10, funnel_id: null }, { lead_id: 11, funnel_id: 1 }, { lead_id: 12, funnel_id: 7 }, { lead_id: 13, funnel_id: 9 },
  { lead_id: 14 },
];
const ids = (xs: Array<{ lead_id: number }>) => xs.map((x) => x.lead_id);

test('1. cada CRM ve lo suyo: el del negocio, los sin funnel y los del funnel por defecto', () => {
  assert.deepEqual(ids(delCrm(items, { id: null, defaultId: 1 })), [10, 11, 14], 'el negocio');
  assert.deepEqual(ids(delCrm(items, { id: 7, defaultId: 1 })), [12], 'otro CRM: sólo los suyos');
  assert.deepEqual(ids(delCrm(items, { id: 1, defaultId: 1 })), [10, 11, 14], '?funnel= con el id del de por defecto es el negocio');
  assert.deepEqual(ids(delCrm(items, { id: null, defaultId: null })), [10, 14], 'sin saber el de por defecto, los sin funnel');
  assert.deepEqual(ids(delCrm(items, null)), [10, 11, 12, 13, 14], 'fuera del tablero (el Sidebar), todo');
});

test('1. lo que manda el panel', () => {
  assert.deepEqual(crmPedido('negocio'), { id: null });
  assert.deepEqual(crmPedido('7'), { id: 7 });
  assert.equal(crmPedido(null), null);
  assert.equal(crmPedido('x'), null, 'algo que no es un CRM no corta');
  assert.equal(crmPedido('-3'), null);
});

test('2. el panel manda el CRM del tablero, la ruta corta con él, y cada pendiente sabe su casa', () => {
  const panel = leer('app/_components/MakoConfirmGate.tsx');
  assert.match(panel, /const crmDelTablero = pathname === '\/crm' \?/);
  assert.match(panel, /fetch\(`\/api\/datos-sin-marcar-count\?lista=1\$\{crmDelTablero \? `&funnel=\$\{crmDelTablero\}` : ''\}`\)/);
  assert.match(panel, /\}, \[enCrm, pathname, releer, crmDelTablero\]\);/, 'cambiar de CRM no relee');
  const ruta = leer('app/api/datos-sin-marcar-count/route.ts');
  assert.match(ruta, /const items = delCrm\(todo\.items \?\? \[\], crm\);/);
  assert.match(ruta, /const ignorados = delCrm\(todo\.ignorados \?\? \[\], crm\);/);
  assert.match(ruta, /const total = crm \? items\.length : todo\.total;/, 'el número no es el de este CRM');
  // Los tres caminos que arman un pendiente (M, R y A) y los ignorados llevan la casa.
  const q = leer('lib/queries.ts');
  const f = q.slice(q.indexOf('async function _getPendientesDeMarcar('));
  assert.equal((f.slice(0, f.indexOf('\n}\n')).match(/funnel_id: l\.funnel_id \?\? null/g) ?? []).length, 4);
});

// PROBADO ROMPIÉNDOLO (25/10/2026), contra una base de 3 / 0, de a una y restaurando de una copia:
//   · `delCrm` sin el funnel por defecto (`crm.defaultId` ignorado)                     → 2 / 1
//   · el panel sin `crmDelTablero` en las dependencias del efecto                        → 2 / 1
//   · la ruta con el `total` de todo el negocio                                          → 2 / 1
