// =============================================================================
// «A revisar»: los datos sin marcar se resuelven en el lugar, sin ir a otra tab
// =============================================================================
// Pedido de Martín (12/10/2026, tercer feedback del CRM, punto 4): «A revisar» sin ir a otra tab.
// Estaba en docs/relevo/crm.md como «SIN HACER, por la cuota». El panel
// (app/_components/MakoConfirmGate.tsx) tenía sólo el CONTEO y una fila que llevaba a
// `/crm?pendientes=1`. Ahora lista los primeros y cada uno abre la ficha del lead encima.
//
// Y desde el 13/10/2026 (feedback del detalle del lead, punto 1: «Todo esto también afecta al
// desplegable que aparece en el CRM debajo a la derecha de "A revisar"») cada fila es UN DATO, con
// «solucionar» —abre la ficha llevando a ese dato— e «ignorar»; lo ignorado va detrás de «Ver más».
//
// Correr: npx tsx --test tests/a-revisar-en-el-lugar.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (13/10/2026, base 4/0): importar LeadEditModal de forma estática → 3 / 1;
// que solucionar vuelva a mandar a la cola → 3 / 1; que no le pase el dato a la ficha → 3 / 1;
// que el endpoint devuelva la lista sin el parámetro → 3 / 1; sin el tope → 3 / 1; ignorar sin el
// candado de la asistencia → 3 / 1.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const gate = leer('app/_components/MakoConfirmGate.tsx');
const ruta = leer('app/api/datos-sin-marcar-count/route.ts');

test('solucionar abre la ficha del lead EN EL LUGAR, llevando al dato', () => {
  assert.match(gate, /fetch\('\/api\/datos-sin-marcar-count\?lista=1'\)/);
  const ini = gate.indexOf('{filas.map(');
  const filas = gate.slice(ini, gate.indexOf('{verMas && ignorados.map(', ini));
  assert.ok(filas.length > 200, 'no encontré las filas');
  assert.match(filas, /onClick=\{\(\) => setFicha\(\{ id: p\.lead_id, nombre: p\.lead_nombre, paso: p\.paso\?\.id \}\)\}/, 'solucionar volvió a llevar a otra pantalla');
  assert.doesNotMatch(filas, /irAPendientes/);
  assert.match(gate, /<LeadEditModal leadId=\{ficha\.id\} seed=\{\{ nombre: ficha\.nombre \}\} solucionar=\{ficha\.paso\}/, 'la ficha no se entera de qué dato solucionar');
  // La cola entera sigue a un clic.
  assert.match(gate, />Ver todos<\/button>/);
});

test('ignorar no se ofrece para la asistencia de una reunión pasada', () => {
  assert.match(gate, /\{p\.paso && !NO_IGNORABLES\.has\(p\.paso\.id\) && \(/);
});

test('la ficha se carga recién al abrirla: el panel está en TODAS las páginas', () => {
  assert.doesNotMatch(gate, /import \{ LeadEditModal \} from/, 'importarla estática mete el CRM entero en cada página');
  assert.match(gate, /dynamic\(\(\) => import\('@\/app\/crm\/LeadEditModal'\)/);
});

test('el endpoint da la lista sólo si se la piden, y con tope', () => {
  // El Sidebar lo pide en cada página para el número: sin `?lista=1` no viajan nombres.
  assert.match(ruta, /if \(new URL\(req\.url\)\.searchParams\.get\('lista'\) === '1'\) \{/);
  // Dos cortes: el de los leads y el de los datos de cada lead (con uno solo, las filas de un lead
  // sin datos —una nutrición vencida— pasan el tope).
  assert.equal((ruta.match(/if \(filas\.length >= TOPE_LISTA\) break;/g) ?? []).length, 2, 'la lista perdió un tope');
  assert.match(ruta, /const TOPE_LISTA = 12;/);
  assert.match(ruta, /return Response\.json\(\{ total \}\);/);
});
