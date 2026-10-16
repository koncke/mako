// =============================================================================
// El engranaje de «A revisar»: abre una ficha, y su basurero pregunta «¿Ignorar siempre?»
// =============================================================================
// Feedback de Martín del 16/10/2026 (punto 6 del CRM): «El botón de "Elegir que datos te avisa MaKo" no debería
// llevarme a un desplegable con los botones de "on-off"... debería abrirme el detalle de un lead "ficticio" con el
// desplegable de "Datos sin marcar" abierto, y dentro de ese otro desplegable el botón de Basura rojo, y cuando le doy
// me pregunta ¿Ignorar siempre? y si le doy que sí, se desmarca de obligatorio ese bloque». Se abre la ficha del
// PRIMER lead de la lista (uno de verdad); sin leads, el modal de interruptores de siempre.
//
// Correr: node --import tsx --test tests/a-revisar-engranaje.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (16/10/2026, base 2/0): el engranaje abriendo el modal de interruptores → 1 / 1; «Ignorar
// siempre» que ignora sólo en el lead (sin `op: 'aviso'`) → 1 / 1; el basurero sin preguntar → 1 / 1.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '');
const gate = leer('app/_components/MakoConfirmGate.tsx');
const card = leer('app/crm/lead-view/DatosSinMarcarCard.tsx');

test('el engranaje abre la ficha del primer lead de la lista en modo «elegir qué avisa»', () => {
  assert.match(gate, /onClick=\{\(\) => \{ const p = filas\[0\]; if \(p\) setFicha\(\{ id: p\.lead_id, nombre: p\.lead_nombre, ver: true, avisos: true \}\); else setConfig\(true\); \}\}/);
  assert.match(gate, /verDatos=\{ficha\.ver\} avisos=\{ficha\.avisos\}/);
  assert.match(leer('app/crm/LeadEditModal.tsx'), /avisosAlAbrir=\{avisos\}/);
  assert.match(leer('app/crm/LeadSheet.tsx'), /ignorarSiempre=\{avisosAlAbrir \? \{ funnelId: lead\.funnel_id \?\? null \} : undefined\}/);
});

test('en ese modo el basurero PREGUNTA, y el sí apaga el aviso del funnel (no sólo del lead)', () => {
  assert.match(card, /if \(si && ignorarSiempre\) \{ setPreguntar\(/);
  assert.match(card, /<Confirm title="¿Ignorar siempre\?"/);
  assert.match(card, /cambiarFichaFunnelAction\(ignorarSiempre\.funnelId, \{ op: 'aviso', paso: id, avisa \}\)/);
});
