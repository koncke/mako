// =============================================================================
// «Editar con MaKo» (Dashboard y General) tiene la cara del Second Brain: el muñeco de la tab y su micrófono
// =============================================================================
// Lo mismo que el chat del CRM (8db1e3cbc, tests/crm-chat-second-brain.test.ts), pedido por el Cerebro el 17/10/2026:
// donde iba el logo de MaKo va el muñeco de la tab («Dashboard» o «General», el mismo del Centro de Operaciones), y la
// caja dicta con el micrófono del Second Brain. El hilo sigue siendo el suyo (lo que cambió, con su Deshacer).
//
// Correr: node --import tsx --test tests/dashboard-editar-mako-muneco.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (17/10/2026, base 2/0): volver a `<LogoMako lado={22} />` en la respuesta → 1 / 1; la caja
// con `BotonDictar` → 1 / 1.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const panel = readFileSync('app/dashboard/PanelEditarMako.tsx', 'utf8').replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '');

test('el muñeco de la tab en la cabecera, la portada, cada respuesta y mientras piensa', () => {
  assert.match(panel, /const tab = informe === 'general' \? 'General' : 'Dashboard';/);
  assert.match(panel, /<Muneco titulo=\{tab\} animo=\{animo\} size=\{26\} \/>/, 'la cabecera');
  assert.match(panel, /<Muneco titulo=\{tab\} animo=\{animo\} size=\{64\} \/>/, 'la portada vacía');
  assert.equal((panel.match(/<span className="em-logo"><Muneco titulo=\{tab\} animo="despierto" size=\{26\} \/><\/span>/g) ?? []).length, 2, 'lo que hizo MaKo y los pedidos de otra hoja');
  assert.match(panel, /<Muneco titulo=\{tab\} animo="trabajando" size=\{26\} \/>/, 'mientras piensa');
  assert.doesNotMatch(panel, /<LogoMako\b/, 'volvió el logo');
});

test('la caja dicta con el micrófono del Second Brain', () => {
  assert.match(panel, /<Microfono valor=\{texto\} onValor=\{\(v\) => \{ setTexto\(v\.slice\(0, TOPE_PEDIDO_IA\)\); setErrorDictado\(null\); \}\} onError=\{setErrorDictado\} apagado=\{pensando\} \/>/);
  assert.doesNotMatch(panel, /<BotonDictar\b/);
  assert.match(panel, /import '@\/app\/admin\/operaciones\/centro\.css';/, 'sin la hoja del Centro, el muñeco no se anima y el micrófono no tiene forma');
});
