// =============================================================================
// «A revisar»: los datos sin marcar se resuelven en el lugar, sin ir a otra tab
// =============================================================================
// Pedido de Martín (12/10/2026, tercer feedback del CRM, punto 4): «A revisar» sin ir a otra tab.
// Estaba en docs/relevo/crm.md como «SIN HACER, por la cuota». El panel
// (app/_components/MakoConfirmGate.tsx) tenía sólo el CONTEO y una fila que llevaba a
// `/crm?pendientes=1`. Ahora lista los primeros y cada uno abre la ficha del lead encima.
//
// Correr: npx tsx --test tests/a-revisar-en-el-lugar.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (13/10/2026): importar LeadEditModal de forma estática → 2 / 1; que las
// filas vuelvan a mandar a la cola → 2 / 1; que el endpoint devuelva la lista sin el parámetro
// → 2 / 1; sin el tope → 2 / 1.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const gate = leer('app/_components/MakoConfirmGate.tsx');
const ruta = leer('app/api/datos-sin-marcar-count/route.ts');

test('cada fila abre la ficha del lead EN EL LUGAR', () => {
  assert.match(gate, /fetch\('\/api\/datos-sin-marcar-count\?lista=1'\)/);
  const filas = gate.slice(gate.indexOf('{sinMarcarLista.map('), gate.indexOf('{sinMarcarLista.map(') + 400);
  assert.match(filas, /onClick=\{\(\) => setFicha\(\{ id: p\.lead_id/, 'las filas vuelven a llevar a otra pantalla');
  assert.doesNotMatch(filas, /irAPendientes/);
  assert.match(gate, /<LeadEditModal leadId=\{ficha\.id\}/);
  // La cola entera sigue a un clic.
  assert.match(gate, />Ver todos<\/button>/);
});

test('la ficha se carga recién al abrirla: el panel está en TODAS las páginas', () => {
  assert.doesNotMatch(gate, /import \{ LeadEditModal \} from/, 'importarla estática mete el CRM entero en cada página');
  assert.match(gate, /dynamic\(\(\) => import\('@\/app\/crm\/LeadEditModal'\)/);
});

test('el endpoint da la lista sólo si se la piden, y con tope', () => {
  // El Sidebar lo pide en cada página para el número: sin `?lista=1` no viajan nombres.
  assert.match(ruta, /if \(new URL\(req\.url\)\.searchParams\.get\('lista'\) === '1'\) \{/);
  assert.match(ruta, /\.slice\(0, TOPE_LISTA\)/);
  assert.match(ruta, /const TOPE_LISTA = 12;/);
  assert.match(ruta, /return Response\.json\(\{ total \}\);/);
});
