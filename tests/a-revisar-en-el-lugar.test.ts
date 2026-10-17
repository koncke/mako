// =============================================================================
// «A revisar»: los datos sin marcar se resuelven en el lugar, sin ir a otra tab
// =============================================================================
// Pedido de Martín (12/10/2026, tercer feedback del CRM, punto 4): «A revisar» sin ir a otra tab.
// Estaba en docs/relevo/crm.md como «SIN HACER, por la cuota». El panel
// (app/_components/MakoConfirmGate.tsx) tenía sólo el CONTEO y una fila que llevaba a
// `/crm?pendientes=1`. Ahora lista los primeros y cada uno abre la ficha del lead encima.
//
// El 13/10/2026 cada fila pasó a ser UN DATO, con «solucionar» e «ignorar». Y el 14/10/2026 volvió
// a ser UN LEAD (Martín: «No pongas muchas filas del mismo lead, en todo caso un número de cuantos
// datos sin revisar tiene»): estos tests CAMBIARON A PROPÓSITO ese día. Revisar lleva al PRIMER dato
// que falta (`p.pasos[0]`), la ✕ ignora todos los ignorables del lead, y la ruta tiene UN tope (el
// de leads) en vez de dos. Lo nuevo de ese pedido (la cara, los botones, el cierre de afuera) se
// prueba en tests/a-revisar-por-lead.test.ts.
//
// Correr: npx tsx --test tests/a-revisar-en-el-lugar.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (13/10/2026, base 4/0): importar LeadEditModal de forma estática → 3 / 1;
// que solucionar vuelva a mandar a la cola → 3 / 1; que no le pase el dato a la ficha → 3 / 1;
// que el endpoint devuelva la lista sin el parámetro → 3 / 1; sin el tope → 3 / 1; ignorar sin el
// candado de la asistencia → 3 / 1.
// ⚠️ Y OTRA VEZ CON LA FILA POR LEAD (14/10/2026, base 4/0): revisar al ÚLTIMO dato
// (`p.pasos[p.pasos.length - 1]?.id`) → 3 / 1; `ignorablesDe` sin el filtro de NO_IGNORABLES → 3 / 1;
// sin el tope de leads → 3 / 1; un segundo tope por dato de vuelta → 3 / 1.
// ⚠️ CAMBIÓ A PROPÓSITO EL 16/10/2026 (Martín): «Revisar» abre la ficha con el «Ver» de los datos sin marcar YA
// desplegado (en vez de llevar al primer dato), y «Ver todos» (la cola de /crm?pendientes=1) pasó a ser «Ignorar
// todos». Probado rompiéndolo (base 4/0): volver a `paso: p.pasos[0]?.id` → 3 / 1; no pasarle `verDatos` a la
// ficha → 3 / 1; volver a poner «Ver todos» → 3 / 1.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const gate = leer('app/_components/MakoConfirmGate.tsx');
const ruta = leer('app/api/datos-sin-marcar-count/route.ts');

test('revisar abre la ficha del lead EN EL LUGAR, con el «Ver» de sus datos abierto', () => {
  assert.match(gate, /fetch\('\/api\/datos-sin-marcar-count\?lista=1'\)/);
  const ini = gate.indexOf('{filas.map(');
  const filas = gate.slice(ini, gate.indexOf('{verMas && ignorados.map(', ini));
  assert.ok(filas.length > 200, 'no encontré las filas');
  assert.match(filas, /onClick=\{\(\) => setFicha\(\{ id: p\.lead_id, nombre: p\.lead_nombre, ver: true \}\)\}/, 'revisar volvió a llevar a otra pantalla, o no abre el «Ver»');
  assert.doesNotMatch(filas, /irAPendientes/);
  assert.match(gate, /<LeadEditModal leadId=\{ficha\.id\} seed=\{\{ nombre: ficha\.nombre \}\} verDatos=\{ficha\.ver\}/, 'la ficha no se entera de que abra el «Ver»');
  // La cola de /crm?pendientes=1 ya no se ofrece desde acá: en su lugar, ignorar la lista de una vez.
  assert.doesNotMatch(gate, />Ver todos<\/button>|qs\.set\('pendientes'|irAPendientes/);
  assert.match(gate, /onClick=\{ignorarTodos\}[\s\S]{0,200}>Ignorar todos<\/button>/);
  // Y la ficha lo cumple: el modal se lo pasa a la hoja y la hoja a la tarjeta, que se monta abierta.
  assert.match(leer('app/crm/LeadEditModal.tsx'), /verDatosAlAbrir=\{verDatos\}/);
  // (O el engranaje, que la abre para elegir qué avisa MaKo: tests/a-revisar-engranaje.test.ts.)
  assert.match(leer('app/crm/LeadSheet.tsx'), /<DatosSinMarcarCard [^>]*abrirAlMontar=\{verDatosAlAbrir \|\| avisosAlAbrir\}/);
  assert.match(leer('app/crm/lead-view/DatosSinMarcarCard.tsx'), /useEffect\(\(\) => \{ if \(abrirAlMontar\) setAbierto\(true\); \}, \[abrirAlMontar\]\);/);
});

test('ignorar no se ofrece para la asistencia de una reunión pasada', () => {
  assert.match(gate, /const ignorablesDe = \(l: LeadARevisar\): StepId\[\] => l\.pasos\.filter\(\(p\) => !NO_IGNORABLES\.has\(p\.id\)\)/);
  assert.match(gate, /\{ignorablesDe\(p\)\.length > 0 && \(/);
});

test('la ficha se carga recién al abrirla: el panel está en TODAS las páginas', () => {
  assert.doesNotMatch(gate, /import \{ LeadEditModal \} from/, 'importarla estática mete el CRM entero en cada página');
  assert.match(gate, /dynamic\(\(\) => import\('@\/app\/crm\/LeadEditModal'\)/);
});

test('el endpoint da la lista sólo si se la piden, y con tope', () => {
  // El Sidebar lo pide en cada página para el número: sin `?lista=1` no viajan nombres.
  assert.match(ruta, /if \(new URL\(req\.url\)\.searchParams\.get\('lista'\) === '1'\) \{/);
  // UN corte, el de los leads: cada lead es una fila, con todos sus datos adentro (hasta el
  // 13/10/2026 eran dos, porque cada dato era una fila).
  // El tope se aplica en filasPorLead (lib/a-revisar-filas.ts, con test que lo ejecuta), por LEAD.
  assert.match(ruta, /filasPorLead\(items \?\? \[\], TOPE_LISTA\)/, 'la lista perdió su tope');
  assert.match(ruta, /const TOPE_LISTA = 12;/);
  assert.match(ruta, /return Response\.json\(\{ total \}\);/);
});
