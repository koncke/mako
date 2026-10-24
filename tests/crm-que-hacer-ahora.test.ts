// =============================================================================
// «¿Qué hacer ahora?»: el asistente que estaba escrito y NADA abría (24/10/2026)
// =============================================================================
// Pedido de Martín del 04/07 (fecha aproximada, docs/feedback-diseno-pendiente.md, «El CRM, medido aparte»): con una
// nutrición manual vencida, un «¿qué hacer ahora?» que ofrezca seguir nutriendo con otro plazo o mover el lead. El asistente
// (app/crm/CrmBoard.tsx, `queHacer`) se escribió entero, y desde el 16/10 no lo abría nada: `abrirQueHacer` se quedó sin
// llamadas cuando se borró la vista «Pendientes». Ahora lo abren la tarjeta del lead que tiene algo por decidir y su clic
// derecho. Lo mismo para una reunión que ya pasó sin desenlace (R).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { opcionesCrm, OPCION_CRM } from '../app/crm/menu-contextual-crm';

const leer = (r: string) => readFileSync(join(__dirname, '..', r), 'utf8').replace(/\r\n/g, '\n');
const BOARD = leer('app/crm/CrmBoard.tsx');

const lead = (queHacer: boolean) => ({
  sobre: 'tarjeta' as const, conWhatsapp: false, conTelefono: false, conEmail: false, seleccionado: false, seleccionados: 0,
  hayEquipo: false, hayOtroFunnel: false, queHacer,
});

test('el clic derecho ofrece «¿Qué hacer ahora?» sólo al lead que tiene algo por decidir, después de «Abrir ficha»', () => {
  const con = opcionesCrm(lead(true));
  assert.deepEqual(con.slice(0, 3), ['abrir', 'que_hacer', 'mover_etapa']);
  assert.ok(!opcionesCrm(lead(false)).includes('que_hacer'), 'se ofrece a un lead sin nada por decidir');
  assert.equal(OPCION_CRM.que_hacer.texto, '¿Qué hacer ahora?');
});

test('el tablero lo abre: la tarjeta (un botón propio, que no abre la ficha) y el clic derecho', () => {
  // Qué cuenta como «algo por decidir»: nutrición manual vencida (M) o reunión pasada sin desenlace (R). Los datos sin marcar
  // (A/B/C) se resuelven en «A revisar», no acá.
  assert.match(BOARD, /const m = marcar\.find\(\(x\) => x\.leadId === id && \(x\.tipo === 'M' \|\| x\.tipo === 'R'\)\);/);
  assert.match(BOARD, /acciones: queHacerDe\(l\.id\) \? \(\n\s+<button type="button" className="tk-pill tk-pill--suave" data-que-hacer/);
  assert.match(BOARD, /onClick=\{\(e\) => \{ e\.stopPropagation\(\); abrirQueHacer\(l\.id\); \}\}>\n\s+¿Qué hacer ahora\?/, 'el clic abre la ficha en vez del asistente');
  assert.match(BOARD, /queHacer: queHacerDe\(id\) != null,/);
  assert.match(BOARD, /case 'que_hacer': if \(l\) abrirQueHacer\(l\.id\); return;/);
  // Nunca más código muerto: el asistente tiene quien lo abra.
  const llamadas = [...BOARD.matchAll(/abrirQueHacer\(/g)].length; // la definición es «abrirQueHacer = (»: no cuenta
  assert.ok(llamadas >= 2, `abrirQueHacer tiene ${llamadas} llamadas: el asistente volvió a quedar sin puerta`);
});
