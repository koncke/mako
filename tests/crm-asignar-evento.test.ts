// =============================================================================
// «Asignar evento»: el «⋯» de una etapa de reunión abre la lista de eventos de la agenda
// =============================================================================
// Feedback de Martín del 16/10/2026, punto 3 del CRM: «Falta la misma opción para las etapas de reunión "Asignar
// evento" con el logo de Meet, y que ahí se puedan seleccionar de la misma manera (en diseño) que la lista de
// campañas... Y que tenga la opción ahí mismo de crear un nuevo evento». La pantalla es app/crm/EventosDeEtapaModal.tsx
// y el motor (que ya estaba) app/crm/agenda-evento-actions.ts.
//
// Correr: node --import tsx --test tests/crm-asignar-evento.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (16/10/2026, base 2/0): la opción en TODAS las columnas (sin `c.kind === 'reunion'`) → 1 / 1;
// «Traer aquí» sin desvincular antes (el motor rechaza el segundo vínculo) → 1 / 1; marcar sin vincular → 1 / 1.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '');
const board = leer('app/crm/CrmBoard.tsx');
const modal = leer('app/crm/EventosDeEtapaModal.tsx');

test('el «⋯» de una etapa de REUNIÓN (sólo esas) ofrece «Asignar evento» y abre la lista', () => {
  // Desde el 21/10/2026 con el calendario de línea de la casa y no el logo de Meet (Martín: «no me gusta que tenga color»).
  // Desde el 22/10/2026 el «⋯» abre el MISMO menú que el clic derecho (app/crm/menu-contextual-crm.ts, «ponlas en secciones»).
  assert.match(board, /reunion: c\.kind === 'reunion'/);
  assert.match(board, /case 'col_evento': if \(c\) setEventoDe\(\{ etapa: c\.key, nombre: c\.label \}\); return;/);
  assert.match(board, /<EventosDeEtapaModal funnelId=/);
});

test('marcar vincula, desmarcar desvincula, y «Traer aquí» primero desvincula de la otra etapa', () => {
  assert.match(modal, /listarEventosAgendaAction\(\)/);
  const cambiar = modal.slice(modal.indexOf('const cambiar = async'), modal.indexOf('const conectados'));
  assert.match(cambiar, /if \(accion !== 'vincular'\) \{\s*const d = await desvincularEventoEtapaAction/);
  assert.match(cambiar, /if \(accion !== 'desvincular'\) \{\s*const v = await vincularEventoEtapaAction\(\{ proveedor: e\.proveedor, identificador: e\.identificador, funnelId, etapa \}\)/);
  assert.match(modal, /onClick=\{\(\) => \{ void cambiar\(e, 'traer'\); \}\}/);
  // Crear un evento: desde el 21/10/2026 AHÍ MISMO (tests/crm-eventos-crear.test.ts); «Actualizar» sigue releyendo.
  assert.match(modal, /onClick=\{leer\}>Actualizar</);
  // Google Calendar (17/10/2026): no hay cómo vincular sus páginas de reserva (su API no las expone); el modal lo dice
  // en vez de callarlo (Martín las nombró en el pedido). Probado rompiéndolo: sin la línea, 1 fallo. Desde el 21/10, con
  // su estado (conectado o no).
  assert.match(modal, /Google no comparte sus páginas de reserva, así que no se pueden asignar\./);
});
